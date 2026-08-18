import SwiftUI
import WebKit

/// Native iOS shell for Flux.
///
/// The web client remains the shared source of truth for Firebase Auth,
/// Firestore conversations, posts, messages, AskAI and workspace sync. This
/// shell adds a native navigation layer without creating a second data model.
struct FluxNativeShell: View {
    @State private var selectedTab: FluxTab = .home

    var body: some View {
        ZStack(alignment: .bottom) {
            FluxWebView(url: FluxConfiguration.url(for: selectedTab))
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()
                FluxGlassTabBar(selection: $selectedTab)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
            }
        }
        .preferredColorScheme(.light)
    }
}

private enum FluxConfiguration {
    static var baseURL: URL {
        if let configured = Bundle.main.object(forInfoDictionaryKey: "FluxBaseURL") as? String,
           let url = URL(string: configured),
           !configured.contains("YOUR_") {
            return url
        }

        return URL(string: "https://flux-544a6.web.app")!
    }

    static func url(for tab: FluxTab) -> URL {
        let path: String
        switch tab {
        case .home: path = "/home?app=1"
        case .explore: path = "/explore?app=1"
        case .askAI: path = "/ask-ai?app=1"
        case .alerts: path = "/notifications?app=1"
        case .profile: path = "/settings/profile?app=1"
        }

        return URL(string: path, relativeTo: baseURL) ?? baseURL
    }
}

private enum FluxTab: String, CaseIterable, Identifiable {
    case home, explore, askAI, alerts, profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .explore: "Explore"
        case .askAI: "AskAI"
        case .alerts: "Alerts"
        case .profile: "Profile"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house.fill"
        case .explore: "magnifyingglass"
        case .askAI: "sparkles"
        case .alerts: "bell.fill"
        case .profile: "person.crop.circle"
        }
    }
}

private struct FluxGlassTabBar: View {
    @Binding var selection: FluxTab

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 10) {
                HStack(spacing: 6) {
                    ForEach(FluxTab.allCases) { tab in
                        tabButton(tab)
                    }
                }
                .padding(8)
                .glassEffect(.regular, in: .rect(cornerRadius: 28))
            }
        } else {
            HStack(spacing: 6) {
                ForEach(FluxTab.allCases) { tab in
                    tabButton(tab)
                }
            }
            .padding(8)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
    }

    @ViewBuilder
    private func tabButton(_ tab: FluxTab) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.28)) {
                selection = tab
            }
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.symbol)
                    .font(.system(size: 17, weight: selection == tab ? .semibold : .regular))
                Text(tab.title)
                    .font(.system(size: 10, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundStyle(selection == tab ? Color.accentColor : Color.primary.opacity(0.72))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(selection == tab ? .isSelected : [])
        .modifier(FluxTabGlassModifier(isSelected: selection == tab))
    }
}

private struct FluxTabGlassModifier: ViewModifier {
    let isSelected: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(
                    isSelected ? .regular.tint(.blue).interactive() : .regular.interactive(),
                    in: .rect(cornerRadius: 20)
                )
        } else {
            content
                .background(
                    isSelected ? Color.accentColor.opacity(0.12) : .clear,
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                )
        }
    }
}

private struct FluxWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastURL != url else { return }
        context.coordinator.lastURL = url
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lastURL: URL?

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            lastURL = webView.url
        }
    }
}
