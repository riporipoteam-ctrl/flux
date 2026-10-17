# Flux platform redesign

The platform uses `src/styles/flux-platform.css` as its final design layer. It replaces `flux-social-refresh.css` and supplies the shared palette, locally hosted Geist font, page layouts, responsive navigation, controls, dialogs, and loading/error states. Existing feature-specific styles still support editors and media runtimes.

## Page coverage

| Area | Changes |
| --- | --- |
| Shared desktop shell | New masthead, search, grouped navigation, account menu, contextual right rail, skip link |
| Shared mobile shell | New brand/header, labeled five-destination bottom navigation, compose button, drawer styling |
| Home and post surfaces | Continuous feed, new heading, refresh, composer, typography, media, actions, empty/retry states |
| Profiles | Banner/avatar composition, identity, metadata, statistics, timeline styling, revised fallback portraits |
| Explore | Discovery introduction, working destination shortcuts, people rows, search and trends |
| Notifications | Structured notification rows, read indicators, previews, tabs, failed read-receipt feedback |
| Messages | Two-pane conversation workspace, responsive list and conversation surfaces |
| Settings | Rebuilt account overview and grouped settings; shared edit-profile, accounts and appearance controls |
| Communities and events | New headers and responsive discovery cards; shared dialogs/forms for creation |
| Shop | Catalog presentation, product cards, balance header, shared purchase/gift controls |
| Premium | Rebuilt plan comparison, balance and usage, benefits and creator-tool entry |
| Create | Rebuilt creator workspace and tool directory |
| Live directory | Rebuilt searchable broadcast directory, actual counts, reconnect and empty states |
| Bookmarks, lists, gifts, rewards, help, stories and stickers | New shared page primitives, controls, typography, colors and empty states |
| AskAI | Theme-aware workspace and composer surfaces, revised navigation and controls |
| Media and Studio | Shared font/control treatment; specialized capture, rendering and game engines remain feature-specific |
| Login, signup, onboarding, errors | New editorial account entry, labeled fields, inline auth feedback, branded loading and recovery screens |

## Verification scope

Browser review uses an isolated temporary worktree with deterministic signed-in fixtures. Only that worktree substitutes the auth context and selected service reads. Production retains real Firebase authentication and services. External HTTPS requests are blocked in the fixture browser, so this verifies layouts and local interactions, not live account writes, real-time messaging, broadcasting, AI responses or 3D asset loading.

Desktop and phone route checks cover home, explore, profile, notifications, messages, settings and its subpages, create, communities, events, shop, Premium, bookmarks, stories, gifts, rewards, lists, help, stickers, Live, games redirect, Flux Rec, AskAI and Studio. Additional interaction checks cover theme switching, search handoff, desktop/mobile compose dialogs, navigation labels and password visibility. Production verification separately checks the exact deployed release and new stylesheet markers on the requested domain.

## Deployment

`publish-flux-live.yml` builds the static export for `flux.sitey.my`, verifies platform markers and the local font, publishes the same artifact to `gh-pages`, and deploys GitHub Pages. `/version.txt`, `/release.json`, and the `flux-release` meta tag identify the source commit. The `data-flux-ui="x5"` attribute remains a compatibility selector; the public UI version is `platform-2026`.
