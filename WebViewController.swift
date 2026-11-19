import UIKit
import WebKit
import Network

/// الشاشة الوحيدة في التطبيق: المتجر داخل WKWebView + شاشة البداية + شاشة «لا يوجد اتصال».
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {

    private var webView: WKWebView!
    private let splashView = UIView()
    private let offlineView = OfflineView()
    private let monitor = NWPathMonitor()

    private var splashGone = false
    private var failedURL: URL?
    private var pageDark = false
    private var downloads: [ObjectIdentifier: URL] = [:]
    private weak var popupController: PopupViewController?

    override var preferredStatusBarStyle: UIStatusBarStyle { pageDark ? .lightContent : .darkContent }

    // MARK: - Setup

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Brand.background

        webView = makeWebView(configuration: Self.makeConfiguration(handler: self))
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // V2: المتجر بين شريط الحالة وخط الرجوع (زي تطبيق أندرويد)، والمساحتين فوق وتحت بلون المتجر (theme-color).
        // (V1 كان تحت شريط الحالة ← زر الإغلاق والجرس في نافذة «أهلاً بك» طلعوا تحت الساعة)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: safe.topAnchor),
            webView.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        setupOffline()
        setupSplash()
        startMonitor()

        webView.load(URLRequest(url: Brand.home))
        // احتياط: لو الصفحة ما ردّتش، شاشة البداية ما تقعدش للأبد
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in self?.hideSplash() }
    }

    static func makeConfiguration(handler: WKScriptMessageHandler) -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()                 // الدخول والسلة يقعدوا بين الفتحات
        config.applicationNameForUserAgent = Brand.userAgentSuffix
        config.allowsInlineMediaPlayback = true

        let ucc = WKUserContentController()
        ucc.add(WeakScriptHandler(handler), name: "mir")
        ucc.addUserScript(WKUserScript(source: Scripts.sharePolyfill, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        ucc.addUserScript(WKUserScript(source: Scripts.pageWatch, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController = ucc
        return config
    }

    private func makeWebView(configuration: WKWebViewConfiguration) -> WKWebView {
        let wv = WKWebView(frame: .zero, configuration: configuration)
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.allowsBackForwardNavigationGestures = true      // الرجوع بالسحب من الحافة
        wv.allowsLinkPreview = false                         // بدون معاينة الروابط بالضغط المطوّل
        wv.isOpaque = false
        wv.backgroundColor = Brand.background
        wv.scrollView.backgroundColor = Brand.background
        wv.scrollView.contentInsetAdjustmentBehavior = .never   // الصفحة نفسها داخل المساحة الآمنة (ما يلزمش إزاحة ثانية)
        return wv
    }

    /// نفس شاشة البداية (LaunchScreen) بالضبط: الشعار 190×178 في نص المساحة الآمنة + 7 لتحت (زي تسخينة المتجر)،
    /// تقعد لين المتجر يرسم تسخينته (نفس الشعار في نفس المكان)، فيبانوا شاشة وحدة.
    private func setupSplash() {
        splashView.backgroundColor = Brand.background
        splashView.translatesAutoresizingMaskIntoConstraints = false
        let logo = UIImageView(image: UIImage(named: "Splash"))
        logo.contentMode = .scaleAspectFit
        logo.translatesAutoresizingMaskIntoConstraints = false
        splashView.addSubview(logo)
        view.addSubview(splashView)
        NSLayoutConstraint.activate([
            splashView.topAnchor.constraint(equalTo: view.topAnchor),
            splashView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            splashView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splashView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            logo.widthAnchor.constraint(equalToConstant: 190),
            logo.heightAnchor.constraint(equalToConstant: 178),
            logo.centerXAnchor.constraint(equalTo: splashView.centerXAnchor),
            // نص المساحة الآمنة = نص المتجر (هو بين شريط الحالة وخط الرجوع) ← نفس مكان تسخينته
            logo.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor, constant: 7)
        ])
    }

    private func hideSplash() {
        guard !splashGone else { return }
        splashGone = true
        UIView.animate(withDuration: 0.12, animations: { self.splashView.alpha = 0 }) { _ in
            self.splashView.removeFromSuperview()
        }
    }

    private func setupOffline() {
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        offlineView.isHidden = true
        offlineView.onRetry = { [weak self] in self?.retry() }
        view.addSubview(offlineView)
        NSLayoutConstraint.activate([
            offlineView.topAnchor.constraint(equalTo: view.topAnchor),
            offlineView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offlineView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    private func startMonitor() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            DispatchQueue.main.async {
                guard let self = self, !self.offlineView.isHidden else { return }
                self.retry()   // النت رجع وشاشة «لا يوجد اتصال» قدامها: نعاودوا لحالنا
            }
        }
        monitor.start(queue: DispatchQueue(label: "ly.miracles.net"))
    }

    deinit { monitor.cancel() }

    // MARK: - Offline

    private func showOffline(for url: URL?) {
        failedURL = url
        hideSplash()
        view.bringSubviewToFront(offlineView)
        offlineView.isHidden = false
        offlineView.setBusy(false)
    }

    private func retry() {
        offlineView.setBusy(true)
        let target = failedURL ?? webView.url ?? Brand.home
        webView.load(URLRequest(url: target, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
    }

    private static let offlineCodes: Set<Int> = [
        NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut,
        NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost, NSURLErrorDNSLookupFailed,
        NSURLErrorInternationalRoamingOff, NSURLErrorDataNotAllowed, NSURLErrorSecureConnectionFailed
    ]

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }   // <a download> (إيصال الطلب)
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel); return
        }
        if ["about", "blob", "data", "javascript"].contains(scheme) { decisionHandler(.allow); return }
        if scheme != "http" && scheme != "https" {          // mailto: tel: whatsapp: sms: ...
            openExternally(url); decisionHandler(.cancel); return
        }
        let isMainOrNewWindow = navigationAction.targetFrame?.isMainFrame ?? true
        if isMainOrNewWindow && Brand.isExternalApp(url) {  // واتساب، فيسبوك، تيك توك...
            openExternally(url); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)   // المتجر، صفحة الدفع (إيزون والبنك)، والإطارات (Turnstile...)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === self.webView else { return }
        failedURL = nil
        offlineView.isHidden = true
        // احتياط لو رسالة «ready» ما وصلتش
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.hideSplash() }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleLoadError(webView, error, provisional: true)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleLoadError(webView, error, provisional: false)
    }

    /// provisional = الصفحة الجديدة ما وصلتش أصلاً (ما فيش نت) ← شاشة «لا يوجد اتصال» بزر «إعادة المحاولة».
    /// بعد ما الصفحة تبدا تترسم (didFail) ما نغطّوهاش: المتجر يتعامل مع النت الضعيف بنفسه.
    private func handleLoadError(_ wv: WKWebView, _ error: Error, provisional: Bool) {
        guard wv === webView else { return }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }   // رابط اتلغى (واتساب، رابط جديد فوقه)
        if ns.domain == "WebKitErrorDomain" && (ns.code == 102 || ns.code == 204) { return }   // تحميل ملف أو فتح برا
        let isNet = ns.domain == NSURLErrorDomain && Self.offlineCodes.contains(ns.code)
        if isNet && (provisional || !splashGone) {
            let url = (ns.userInfo[NSURLErrorFailingURLErrorKey] as? URL) ?? webView.url ?? Brand.home
            showOffline(for: url)
        } else {
            offlineView.setBusy(false)
            hideSplash()
        }
    }

    /// الصفحة طاحت في الخلفية (ذاكرة): نعاودوا بدل شاشة بيضا
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView === self.webView {
            if webView.url != nil { webView.reload() } else { webView.load(URLRequest(url: Brand.home)) }
        } else {
            popupController?.dismiss(animated: true)
        }
    }

    // MARK: - WKUIDelegate (نوافذ جديدة + alert/confirm/prompt)

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if Brand.isOwn(url) {                  // رابط من المتجر بـ target=_blank: في نفس الشاشة
            self.webView.load(navigationAction.request)
            return nil
        }
        // أي نافذة ثانية (مثلاً صفحة تحقق البنك وقت الدفع): نافذة فوق المتجر بزر «إغلاق»، والمتجر يقعد مكانه تحتها
        let popupView = makeWebView(configuration: configuration)
        let popup = PopupViewController(webView: popupView)
        popupController = popup
        let nav = UINavigationController(rootViewController: popup)
        nav.modalPresentationStyle = .pageSheet
        topController().present(nav, animated: true)
        return popupView
    }

    func webViewDidClose(_ webView: WKWebView) {
        if webView !== self.webView { popupController?.dismiss(animated: true) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "موافق", style: .default) { _ in completionHandler() })
        presentAlert(a) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "موافق", style: .default) { _ in completionHandler(true) })
        presentAlert(a) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "موافق", style: .default) { [weak a] _ in completionHandler(a?.textFields?.first?.text) })
        presentAlert(a) { completionHandler(nil) }
    }

    /// لو ما قدرناش نعرضوا النافذة (نافذة ثانية مفتوحة وتتسكّر)، نردوا على الصفحة على طول باش ما تعلقش
    private func presentAlert(_ alert: UIAlertController, fallback: @escaping () -> Void) {
        let top = topController()
        if top is UIAlertController || top.isBeingDismissed || top.view.window == nil { fallback(); return }
        top.present(alert, animated: true)
    }

    // MARK: - WKDownloadDelegate (إيصال الطلب ← قائمة المشاركة: حفظ الصورة، واتساب...)

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("dl-" + UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            completionHandler(nil); return
        }
        let name = suggestedFilename.isEmpty ? "Miracles" : suggestedFilename
        let dest = dir.appendingPathComponent(name)
        downloads[ObjectIdentifier(download)] = dest
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        share(items: [url])
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
    }

    // MARK: - رسائل من الصفحة (Scripts)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any], let type = body["t"] as? String else { return }
        switch type {
        case "ready":
            // تسخينة المتجر (نفس الشعار في نفس المكان) ترسمت: نشيلوا شاشة البداية
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in self?.hideSplash() }
        case "theme":
            if let hex = body["c"] as? String, let c = Brand.color(hex: hex) { applyPageColor(c) }
        case "share":
            var items: [Any] = []
            if let text = body["text"] as? String, !text.isEmpty { items.append(text) }
            if let s = body["url"] as? String, let u = URL(string: s) { items.append(u) }
            if !items.isEmpty { share(items: items) }
        default:
            break
        }
    }

    private func applyPageColor(_ c: UIColor) {
        let dark = Brand.isDark(c)
        view.backgroundColor = c
        webView.backgroundColor = c
        webView.scrollView.backgroundColor = c
        if dark != pageDark {
            pageDark = dark
            setNeedsStatusBarAppearanceUpdate()
        }
    }

    // MARK: - Helpers

    private func openExternally(_ url: URL) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    private func share(items: [Any]) {
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        let top = topController()
        if let pop = vc.popoverPresentationController {
            pop.sourceView = top.view
            pop.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.maxY - 40, width: 1, height: 1)
        }
        top.present(vc, animated: true)
    }

    private func topController() -> UIViewController {
        var top: UIViewController = self
        while let p = top.presentedViewController, !p.isBeingDismissed { top = p }
        return top
    }
}

/// WKUserContentController يمسك الـ handler بقوة؛ هذا يمنع حلقة ذاكرة
final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(ucc, didReceive: message)
    }
}

/// سكربتات صغيرة تنحقن في صفحة المتجر (ما تغيّرش في المتجر حتى شي)
enum Scripts {
    /// لو WKWebView ما فيهاش navigator.share: مشاركة المنتج تفتح قائمة المشاركة متاع الآيفون
    /// (الملفات: المتجر يرجع لحفظ الإيصال ← التحميل ← قائمة المشاركة)
    static let sharePolyfill = """
    (function(){try{if(navigator.share||!window.webkit||!window.webkit.messageHandlers||!window.webkit.messageHandlers.mir)return;
    navigator.share=function(d){d=d||{};if(d.files&&d.files.length)return Promise.reject(new DOMException('files','NotSupportedError'));
    window.webkit.messageHandlers.mir.postMessage({t:'share',title:String(d.title||''),text:String(d.text||''),url:String(d.url||'')});return Promise.resolve()};}catch(e){}})();
    """

    /// «ready» لما الصفحة تترسم (تسخينة المتجر)، ولون الصفحة (theme-color) لشريط الحالة والخلفية، ويتابع تبديل الوضع الليلي
    static let pageWatch = """
    (function(){try{var h=window.webkit.messageHandlers.mir;
    var col=function(){var m=document.querySelector('meta[name="theme-color"]');if(m&&m.content)h.postMessage({t:'theme',c:m.content})};
    col();requestAnimationFrame(function(){requestAnimationFrame(function(){h.postMessage({t:'ready'})})});
    new MutationObserver(col).observe(document.head,{attributes:true,subtree:true,childList:true,attributeFilter:['content']});}catch(e){}})();
    """
}
