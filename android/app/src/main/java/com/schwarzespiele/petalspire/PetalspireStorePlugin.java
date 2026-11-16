package com.schwarzespiele.petalspire;

import android.util.Base64;
import android.util.Log;
import androidx.annotation.NonNull;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Google Play Billing bridge with the same JS interface as the iOS StoreKit plugin (ios/App/App/StoreKitPlugin.swift):
 * loadProducts, purchase, finish, restore, and a "transaction" event.
 * A purchase resolves as "purchased" only once Play reports PURCHASED (and, when PLAY_LICENSE_KEY is set, its signature checks out).
 * The game grants the contents, then calls finish: consumables are consumed, one-time items are acknowledged.
 * transactionId is the Play purchase token.
 */
@CapacitorPlugin(name = "PetalspireStore")
public class PetalspireStorePlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "PetalspireStore";

    static final List<String> PRODUCT_IDS = Arrays.asList(
        "com.petalspire.jewels.1",
        "com.petalspire.jewels.10",
        "com.petalspire.jewels.50",
        "com.petalspire.noads",
        "com.petalspire.starter2",
        "com.petalspire.collector"
    );

    static final Set<String> CONSUMABLES = new HashSet<>(Arrays.asList(
        "com.petalspire.jewels.1",
        "com.petalspire.jewels.10",
        "com.petalspire.jewels.50"
    ));

    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private final Map<String, Purchase> open = new HashMap<>();
    private final Set<String> announced = new HashSet<>();
    private PluginCall pendingPurchase;
    private String pendingProductId;
    private final List<Runnable> whenReady = new ArrayList<>();
    private boolean connecting = false;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        withClient(this::replayUnfinished);
    }

    private synchronized void withClient(Runnable task) {
        if (client.isReady()) { task.run(); return; }
        whenReady.add(task);
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                List<Runnable> tasks;
                synchronized (PetalspireStorePlugin.this) {
                    connecting = false;
                    tasks = new ArrayList<>(whenReady);
                    whenReady.clear();
                }
                for (Runnable t : tasks) t.run();
            }

            @Override
            public void onBillingServiceDisconnected() {
                synchronized (PetalspireStorePlugin.this) { connecting = false; }
            }
        });
    }

    private static boolean ok(BillingResult r) {
        return r != null && r.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private static String firstProduct(Purchase p) {
        List<String> ids = p.getProducts();
        return ids == null || ids.isEmpty() ? "" : ids.get(0);
    }

    /** Optional local check against the app's Play license key (Play Console > Monetization setup). */
    private boolean verified(Purchase p) {
        String key = BuildConfig.PLAY_LICENSE_KEY;
        if (key == null || key.isEmpty()) return true;
        try {
            PublicKey pub = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.decode(key, Base64.DEFAULT)));
            Signature sig = Signature.getInstance("SHA1withRSA");
            sig.initVerify(pub);
            sig.update(p.getOriginalJson().getBytes("UTF-8"));
            return sig.verify(Base64.decode(p.getSignature(), Base64.DEFAULT));
        } catch (Exception e) {
            Log.w(TAG, "signature check failed", e);
            return false;
        }
    }

    private JSObject payload(Purchase p) {
        JSObject o = new JSObject();
        o.put("status", "purchased");
        o.put("verified", true);
        o.put("productId", firstProduct(p));
        o.put("transactionId", p.getPurchaseToken());
        return o;
    }

    /** Like StoreKit's Transaction.updates on launch: re-send anything paid for but not yet finished. */
    private void replayUnfinished() {
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (!ok(result) || purchases == null) return;
                for (Purchase p : purchases) announce(p);
            }
        );
    }

    private void announce(Purchase p) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED || p.isAcknowledged() || !verified(p)) return;
        open.put(p.getPurchaseToken(), p);
        if (announced.add(p.getPurchaseToken())) notifyListeners("transaction", payload(p), true);
    }

    @PluginMethod
    public void loadProducts(PluginCall call) {
        List<String> requested = new ArrayList<>();
        JSArray arr = call.getArray("productIds");
        if (arr != null) {
            try { requested.addAll(arr.<String>toList()); } catch (Exception ignored) { /* fall back */ }
        }
        if (requested.isEmpty()) requested.addAll(PRODUCT_IDS);
        withClient(() -> {
            if (!client.isReady()) { call.resolve(rows(new ArrayList<>())); return; }
            List<QueryProductDetailsParams.Product> list = new ArrayList<>();
            for (String id : requested) {
                list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
            }
            client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(list).build(),
                (result, res) -> {
                    List<ProductDetails> found = ok(result) && res != null ? res.getProductDetailsList() : new ArrayList<>();
                    for (ProductDetails d : found) details.put(d.getProductId(), d);
                    call.resolve(rows(found));
                }
            );
        });
    }

    private JSObject rows(List<ProductDetails> found) {
        JSArray out = new JSArray();
        for (ProductDetails d : found) {
            ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
            if (offer == null) continue;
            JSObject row = new JSObject();
            row.put("productId", d.getProductId());
            row.put("displayPrice", offer.getFormattedPrice());
            row.put("displayName", d.getName());
            out.put(row);
        }
        JSObject o = new JSObject();
        o.put("products", out);
        return o;
    }

    private static JSObject failed(String reason) {
        JSObject o = new JSObject();
        o.put("status", "failed");
        o.put("reason", reason);
        return o;
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String id = call.getString("productId", "");
        if (id == null || id.isEmpty()) { call.resolve(failed("Purchase didn’t go through")); return; }
        if (pendingPurchase != null) { call.resolve(failed("Another purchase is still open")); return; }
        withClient(() -> {
            if (!client.isReady()) { call.resolve(failed("Google Play isn’t available right now.")); return; }
            ProductDetails cached = details.get(id);
            if (cached != null) { launch(call, cached); return; }
            client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(Arrays.asList(
                    QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build()
                )).build(),
                (result, res) -> {
                    List<ProductDetails> found = ok(result) && res != null ? res.getProductDetailsList() : new ArrayList<>();
                    if (found.isEmpty()) { call.resolve(failed("That item isn’t in Google Play yet.")); return; }
                    details.put(id, found.get(0));
                    launch(call, found.get(0));
                }
            );
        });
    }

    private void launch(PluginCall call, ProductDetails d) {
        getActivity().runOnUiThread(() -> {
            pendingPurchase = call;
            pendingProductId = d.getProductId();
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Arrays.asList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build()
                ))
                .build();
            BillingResult r = client.launchBillingFlow(getActivity(), params);
            if (!ok(r)) {
                pendingPurchase = null;
                pendingProductId = null;
                if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                    call.resolve(failed("You already own this. Try Restore Purchases."));
                } else {
                    call.resolve(failed("Purchase didn’t go through"));
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingPurchase;
        String wanted = pendingProductId;
        pendingPurchase = null;
        pendingProductId = null;
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (call != null) { JSObject o = new JSObject(); o.put("status", "cancelled"); call.resolve(o); }
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            if (call != null) call.resolve(failed("Purchase didn’t go through"));
            return;
        }
        boolean answered = false;
        for (Purchase p : purchases) {
            boolean mine = call != null && !answered && (wanted == null || p.getProducts().contains(wanted));
            if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                if (mine) {
                    JSObject o = new JSObject();
                    o.put("status", "pending");
                    o.put("reason", "Waiting for payment to finish in Google Play.");
                    call.resolve(o);
                    answered = true;
                }
                continue;
            }
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (!verified(p)) {
                if (mine) { call.resolve(failed("Purchase couldn’t be verified")); answered = true; }
                continue;
            }
            open.put(p.getPurchaseToken(), p);
            if (mine) {
                announced.add(p.getPurchaseToken());
                call.resolve(payload(p));
                answered = true;
            } else {
                // A pending purchase that completed later, or one bought outside the app.
                announce(p);
            }
        }
        if (call != null && !answered) call.resolve(failed("Purchase didn’t go through"));
    }

    @PluginMethod
    public void finish(PluginCall call) {
        String token = call.getString("transactionId", "");
        if (token == null || token.isEmpty()) { call.resolve(result(false)); return; }
        withClient(() -> {
            Purchase p = open.get(token);
            if (p != null) { complete(p, call); return; }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (ok(r) && purchases != null) {
                        for (Purchase q : purchases) {
                            if (token.equals(q.getPurchaseToken())) { complete(q, call); return; }
                        }
                    }
                    call.resolve(result(false));
                }
            );
        });
    }

    private void complete(Purchase p, PluginCall call) {
        String token = p.getPurchaseToken();
        if (CONSUMABLES.contains(firstProduct(p))) {
            client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (r, t) -> {
                if (ok(r)) open.remove(token);
                call.resolve(result(ok(r)));
            });
        } else if (p.isAcknowledged()) {
            open.remove(token);
            call.resolve(result(true));
        } else {
            client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), (r) -> {
                if (ok(r)) open.remove(token);
                call.resolve(result(ok(r)));
            });
        }
    }

    private static JSObject result(boolean value) {
        JSObject o = new JSObject();
        o.put("ok", value);
        return o;
    }

    @PluginMethod
    public void restore(PluginCall call) {
        withClient(() -> {
            if (!client.isReady()) { call.reject("Google Play isn’t available right now."); return; }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (!ok(r)) { call.reject("Restore failed"); return; }
                    JSArray ids = new JSArray();
                    if (purchases != null) {
                        for (Purchase p : purchases) {
                            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED || !verified(p)) continue;
                            String id = firstProduct(p);
                            if (CONSUMABLES.contains(id)) continue;
                            ids.put(id);
                            if (!p.isAcknowledged()) announce(p);
                        }
                    }
                    JSObject o = new JSObject();
                    o.put("productIds", ids);
                    call.resolve(o);
                }
            );
        });
    }
}
