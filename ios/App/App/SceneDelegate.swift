import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Main.storyboard already builds the window with PetalspireBridgeViewController (it registers the
        // PetalspireStore StoreKit plugin). Replacing that window left the plain storyboard bridge on screen,
        // so JS never saw PetalspireStore and the Jewel Shop got zero products. Only build a window if UIKit did not.
        if window == nil {
            window = UIWindow(windowScene: windowScene)
            window?.rootViewController = PetalspireBridgeViewController()
            window?.makeKeyAndVisible()
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
