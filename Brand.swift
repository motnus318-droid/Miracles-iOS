import UIKit

enum Brand {
    /// المتجر
    static let home = URL(string: "https://miracles.ly/")!
    static let ownHosts: Set<String> = ["miracles.ly", "www.miracles.ly"]

    /// نفس ألوان المتجر (#FBF9F7 الخلفية، #141110 الليلي، #C9A27E الذهبي، #0B0B0F الكتابة)
    static let background = UIColor(red: 251 / 255, green: 249 / 255, blue: 247 / 255, alpha: 1)
    static let darkBackground = UIColor(red: 20 / 255, green: 17 / 255, blue: 16 / 255, alpha: 1)
    static let gold = UIColor(red: 201 / 255, green: 162 / 255, blue: 126 / 255, alpha: 1)
    static let ink = UIColor(red: 11 / 255, green: 11 / 255, blue: 15 / 255, alpha: 1)
    static let muted = UIColor(red: 110 / 255, green: 102 / 255, blue: 96 / 255, alpha: 1)

    /// علامة في هوية المتصفح: الموقع يعرف منها إنه داخل تطبيق الآيفون (V105: html.in-app + in-ios)
    static var userAgentSuffix: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "Mobile/15E148 MiraclesiOS/\(v)"
    }

    /// روابط تفتح في تطبيقاتها (أو Safari) مش داخل المتجر: واتساب، فيسبوك، تيك توك، إنستغرام، تيليجرام، يوتيوب، الخرائط، App Store
    private static let externalHosts: [String] = [
        "wa.me", "whatsapp.com", "facebook.com", "fb.com", "fb.me", "fb.watch", "m.me", "messenger.com",
        "tiktok.com", "instagram.com", "t.me", "telegram.me", "x.com", "twitter.com",
        "youtube.com", "youtu.be", "apps.apple.com", "itunes.apple.com", "maps.apple.com",
        "maps.google.com", "maps.app.goo.gl", "goo.gl"
    ]

    static func isOwn(_ url: URL) -> Bool {
        guard let h = url.host?.lowercased() else { return false }
        return ownHosts.contains(h)
    }

    static func isExternalApp(_ url: URL) -> Bool {
        guard let h = url.host?.lowercased() else { return false }
        if h.hasSuffix("google.com"), url.path.hasPrefix("/maps") { return true }
        return externalHosts.contains { h == $0 || h.hasSuffix("." + $0) }
    }

    static func color(hex: String) -> UIColor? {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
                       blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }

    static func isDark(_ c: UIColor) -> Bool {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        c.getRed(&r, green: &g, blue: &b, alpha: &a)
        return (0.299 * r + 0.587 * g + 0.114 * b) < 0.5
    }
}
