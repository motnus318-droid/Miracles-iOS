import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.overrideUserInterfaceStyle = .light      // المتجر يتحكم في الوضع الليلي بنفسه (من «حسابي»)
        window.backgroundColor = Brand.background
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
    }
}
