import Foundation
import StoreKit
import Capacitor

/// StoreKit 2 bridge. A purchase resolves only after Apple verifies the transaction.
/// The game grants the contents, then calls finish.
@objc(PetalspireStore)
public class PetalspireStore: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PetalspireStore"
    public let jsName = "PetalspireStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    private let productIds = [
        "com.petalspire.jewels.1",
        "com.petalspire.jewels.10",
        "com.petalspire.jewels.50",
        "com.petalspire.noads",
        "com.petalspire.starter2",
        "com.petalspire.collector",
    ]
    private var open: [UInt64: Transaction] = [:]
    private var updates: Task<Void, Never>?

    override public func load() {
        updates = Task { await self.watchUpdates() }
    }

    deinit { updates?.cancel() }

    private static func verified(_ result: VerificationResult<Transaction>) throws -> Transaction {
        switch result {
        case .verified(let transaction):
            return transaction
        case .unverified:
            throw StoreError.unverified
        }
    }

    private func remember(_ transaction: Transaction) {
        open[transaction.id] = transaction
    }

    private func payload(_ transaction: Transaction) -> [String: Any] {
        [
            "status": "purchased",
            "verified": true,
            "productId": transaction.productID,
            "transactionId": String(transaction.id),
        ]
    }

    private func watchUpdates() async {
        for await result in Transaction.updates {
            guard let transaction = try? Self.verified(result), transaction.revocationDate == nil else { continue }
            remember(transaction)
            notifyListeners("transaction", data: payload(transaction))
        }
    }

    @objc func loadProducts(_ call: CAPPluginCall) {
        let requested = call.getArray("productIds", String.self) ?? productIds
        Task { @MainActor in
            do {
                let products = try await Product.products(for: requested)
                let rows: [[String: Any]] = products.map { product in
                    [
                        "productId": product.id,
                        "displayPrice": product.displayPrice,
                        "displayName": product.displayName,
                    ]
                }
                call.resolve(["products": rows])
            } catch {
                call.resolve(["products": []])
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), !id.isEmpty else {
            call.resolve(["status": "failed", "reason": "Purchase didn’t go through"])
            return
        }
        Task { @MainActor in
            do {
                let products = try await Product.products(for: [id])
                guard let product = products.first else {
                    call.resolve(["status": "failed", "reason": "That item isn’t in the App Store yet."])
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try Self.verified(verification)
                    self.remember(transaction)
                    call.resolve(self.payload(transaction))
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.resolve(["status": "failed", "reason": "Purchase didn’t go through"])
                }
            } catch {
                call.resolve(["status": "failed", "reason": "Purchase didn’t go through"])
            }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionId"), let id = UInt64(raw) else {
            call.resolve(["ok": false])
            return
        }
        Task { @MainActor in
            if let transaction = self.open[id] {
                await transaction.finish()
                self.open[id] = nil
                call.resolve(["ok": true])
                return
            }
            let finished = await withTaskGroup(of: Bool.self) { group in
                group.addTask {
                    for await result in Transaction.unfinished {
                        guard let transaction = try? Self.verified(result), transaction.id == id else { continue }
                        await transaction.finish()
                        return true
                    }
                    return false
                }
                group.addTask {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    return false
                }
                let first = await group.next() ?? false
                group.cancelAll()
                return first
            }
            call.resolve(["ok": finished])
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            var ids: [String] = []
            do { try await AppStore.sync() } catch { /* current entitlements still apply */ }
            for await result in Transaction.currentEntitlements {
                guard let transaction = try? Self.verified(result), transaction.revocationDate == nil else { continue }
                ids.append(transaction.productID)
            }
            call.resolve(["productIds": ids])
        }
    }
}

private enum StoreError: Error { case unverified }

class PetalspireBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PetalspireStore())
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.contentInset = .zero
        publishSafeArea()
    }

    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.contentInset = .zero
        publishSafeArea()
    }

    override open func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        publishSafeArea()
    }

    /// Hiding the status bar can make WebKit report a 0 inset while the island still covers the glass.
    private func publishSafeArea() {
        guard let webView = webView else { return }
        var top = view.safeAreaInsets.top
        var bottom = view.safeAreaInsets.bottom
        var left = view.safeAreaInsets.left
        var right = view.safeAreaInsets.right
        let height = max(view.bounds.height, UIScreen.main.bounds.height)
        if top < 20 && height >= 800 {
            top = 59
            if bottom < 20 { bottom = 34 }
        }
        let js = """
        document.documentElement.style.setProperty('--native-sat','\(top)px');
        document.documentElement.style.setProperty('--native-sab','\(bottom)px');
        document.documentElement.style.setProperty('--native-sal','\(left)px');
        document.documentElement.style.setProperty('--native-sar','\(right)px');
        document.documentElement.classList.add('native-app');
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
}
