# Flux iOS client

Flux uses a Capacitor iOS target so the shared Next.js/Firebase client can be
shipped as an IPA while keeping auth, posts, conversations, AskAI, agents,
jobs, and workspace sync on the same account.

`App/FluxNativeShell.swift` adds a native SwiftUI navigation layer. On iOS 26+
it uses Apple's `GlassEffectContainer` and `glassEffect` APIs; older supported
iOS versions fall back to `ultraThinMaterial`.

## Build on macOS

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Set `FluxBaseURL` in `ios/App/App/Info.plist` to the public Flux deployment
before archiving. The checked-in default is the GitHub Pages release at
`https://riporipoteam-ctrl.github.io/flux/`.
