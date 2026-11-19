import UIKit

/// شاشة «لا يوجد اتصال» (native) بدل صفحة خطأ — تطلع لو التطبيق انفتح والنت مقطوع.
/// ترجع للمتجر لحالها أول ما النت يرجع، أو بزر «إعادة المحاولة».
final class OfflineView: UIView {
    var onRetry: (() -> Void)?

    private let button = UIButton(type: .system)
    private let spinner = UIActivityIndicatorView(style: .medium)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = Brand.background
        semanticContentAttribute = .forceRightToLeft

        let mark = UIImageView(image: UIImage(named: "SplashMark"))
        mark.contentMode = .scaleAspectFit

        let icon = UIImageView(image: UIImage(systemName: "wifi.slash",
                                              withConfiguration: UIImage.SymbolConfiguration(pointSize: 30, weight: .regular)))
        icon.tintColor = Brand.gold
        icon.contentMode = .scaleAspectFit

        let title = UILabel()
        title.text = "لا يوجد اتصال بالإنترنت"
        title.font = .systemFont(ofSize: 19, weight: .bold)
        title.textColor = Brand.ink
        title.textAlignment = .center
        title.numberOfLines = 0

        let body = UILabel()
        body.text = "يُرجى التحقق من الاتصال، وسيفتح المتجر تلقائياً عند عودته."
        body.font = .systemFont(ofSize: 15)
        body.textColor = Brand.muted
        body.textAlignment = .center
        body.numberOfLines = 0

        var cfg = UIButton.Configuration.filled()
        cfg.title = "إعادة المحاولة"
        cfg.baseBackgroundColor = Brand.ink
        cfg.baseForegroundColor = .white
        cfg.cornerStyle = .capsule
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 13, leading: 34, bottom: 13, trailing: 34)
        cfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var out = incoming
            out.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
            return out
        }
        button.configuration = cfg
        button.addTarget(self, action: #selector(tapRetry), for: .touchUpInside)

        spinner.color = Brand.gold
        spinner.hidesWhenStopped = true

        let stack = UIStackView(arrangedSubviews: [mark, icon, title, body, button, spinner])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.setCustomSpacing(26, after: mark)
        stack.setCustomSpacing(22, after: body)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            mark.widthAnchor.constraint(equalToConstant: 96),
            mark.heightAnchor.constraint(equalToConstant: 88),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -32)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setBusy(_ busy: Bool) {
        button.isEnabled = !busy
        if busy { spinner.startAnimating() } else { spinner.stopAnimating() }
    }

    @objc private func tapRetry() { onRetry?() }
}
