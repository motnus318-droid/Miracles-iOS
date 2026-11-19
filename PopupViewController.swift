import UIKit
import WebKit

/// نافذة تنفتح فوق المتجر لما صفحة تطلب نافذة جديدة (window.open / target=_blank لموقع ثاني، مثلاً تحقق البنك وقت الدفع).
/// تتسكّر بزر «إغلاق» أو لما الصفحة نفسها تسكّرها (window.close)، والمتجر يقعد مكانه تحتها.
final class PopupViewController: UIViewController {
    private let webView: WKWebView
    private var titleObservation: NSKeyValueObservation?

    init(webView: WKWebView) {
        self.webView = webView
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Brand.background
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "إغلاق", style: .done, target: self, action: #selector(close))
        navigationController?.navigationBar.tintColor = Brand.ink
        titleObservation = webView.observe(\.title, options: [.initial, .new]) { [weak self] wv, _ in
            self?.navigationItem.title = wv.title
        }
    }

    @objc private func close() { dismiss(animated: true) }
}
