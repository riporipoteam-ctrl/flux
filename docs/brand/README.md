# Flux identity

The Flux symbol was generated for this project with the image generation tool. Two interlocking currents represent conversation and connection. The source is `flux-symbol-source.png`; the production symbol is `/brand/flux-symbol.png`.

Run `node scripts/build-brand-assets.mjs` to reproduce the favicon, browser icons, Apple touch icon and PWA home-screen assets. The script exports and resamples the original generated artwork; it does not redraw the logo. Maskable icons use extra safe-area padding.

UI colors: emerald `#159a7b`, ink `#101c18`, white. Use `FluxMark` or `Logo` from the shared logo component so product surfaces use the same asset.

Validation for the identity update: 14 route layouts at 320, 390, 768, 1024 and 1440 pixels; keyboard focus trapping/restoration and drawer destination navigation; desktop/mobile resize handling; theme and browser chrome synchronization; full-screen phone composer bounds; profile banner control bounds at three phone/tablet widths; favicon container and icon dimension regression checks. Signed-in layouts use isolated fixture data, with production auth and services preserved.
