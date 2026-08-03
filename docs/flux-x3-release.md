# Flux X3 live release

This release fixes the two failures that were still visible on the public site:

1. The mobile navigation is rendered through a React portal directly under `document.body`, outside every route transition and overflow container.
2. A new GitHub Actions workflow actively switches Pages to Actions deployment and also publishes the identical static export to a `gh-pages` fallback branch.

## Visible release markers

The deployed document contains `data-flux-ui="x3"`. The deployment also writes:

- `/flux/release.json`
- `/flux/version.txt`

A correct `release.json` contains `"ui":"x3"` and `"dock":"body-portal"`.

## Game update

Flux Arcade no longer uses one repeated generic cover. Ten procedural genre art systems generate deterministic unique cover scenes for every game. The release also includes Continue Playing, a rotating Daily Challenge, achievements, streaks and shareable score results.
