import UIKit

// Miracles iOS — غلاف يفتح https://miracles.ly داخل WKWebView.
// المتجر نفسه (الموقع + الدفع + لوحة التحكم + Supabase) ما يتغيرش: أي تعديل في الموقع يوصل للتطبيق بدون بناء جديد.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }
}
