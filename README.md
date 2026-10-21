# Vision: Quest 3 camera lab

A modular JavaScript proof of concept for **camera diagnostics first, optional single-image AI second**. The frontend runs on GitHub Pages. No Unity, frontend dependencies, microphone, analytics, automatic camera prompt, or automatic image upload.

## Start here

1. Publish the static app using [deployment instructions](docs/DEPLOYMENT.md).
2. Open the HTTPS Pages URL directly in the **standalone Quest Browser**, not in an embedded preview or PC Link browser.
3. Follow [the headset test checklist](docs/HEADSET-TESTING.md). Inspect a captured JPEG of your real surroundings before claiming camera access works.
4. Only after that gate passes, configure [the private AI proxy](docs/AI-SETUP.md).

Expected Pages URL after deployment: **https://jammydav.github.io/Vision/**. This address is not proof that deployment has completed.

## Local development

Use Node.js 24 (22 or newer supported). There are no packages to install.

```sh
npm run dev
# http://localhost:4173
npm run check
npm test
npm run build
```

Localhost is useful for desktop webcam testing. `http://YOUR-PC-IP:4173` is not a secure context on the headset, and this dev server intentionally listens only on loopback. Use the HTTPS Pages deployment for Quest tests. Opening index.html as a file is not supported.

## What counts as success?

| Observation | What it proves |
| --- | --- |
| `getUserMedia` exists | An API is exposed, not that headset cameras are accessible |
| Permission says granted | Some camera access may be allowed; not proof of headset-camera OS permission |
| `immersive-ar` supported | A passthrough viewing session can be requested |
| A camera track starts | A stream exists; it could be an avatar or unreadable |
| Moving video and a readable JPEG | The selected browser input produces readable pixels |
| You verify that JPEG shows the real room | Practical source verification for this prototype |
| Proxy returns a description of that approved image | End-to-end image recognition works |

The app counts presented video frames, checks track state/muting and rejects stale video at capture time. It reports dark/uniform captures as suspicious; that heuristic cannot identify real cameras or prove correctness. There is no synthetic frame fallback.

## Repository map

```text
public/                 The only files published to Pages
  src/app.js            UI and lifecycle coordination
  src/camera.js         Strict selection, permission request, stream lifecycle
  src/diagnostics.js    Capability checks, actionable errors, redacted reports
  src/capture.js        Fresh-frame guard, bounded JPEG capture
  src/xr.js             Transparent WebXR AR compositor diagnostic
  src/vision.js         Explicit one-image upload to your proxy
server/                 Separate private Node service; never on Pages
scripts/                Local preview, static build, syntax/boundary checks
test/                   Camera/AI boundary and proxy tests (mocked hardware/provider)
docs/                   Deployment, headset checks, AI setup, compatibility evidence
.github/workflows/      Checks on PRs; Pages deployment after checks on main
```

The WebXR diagnostic renders a transparent layer so the headset compositor can show passthrough. It does **not** sample compositor pixels or claim to implement the experimental WebXR Raw Camera Access API. Camera pixel access uses standard `MediaDevices` only. Keep the first recognition flow in the browser panel; AR is a separate capability and concurrency diagnostic.

## Privacy and limits

Frames are kept in tab memory; stop, source change, discard, or leaving the page clears them. Backgrounding clears the stream and proxy token unless an immersive session is active. Reports omit images, device IDs, device labels, page URLs and AI credentials. Browser versions, optional OS version, test notes, timing and errors are included: review notes before sharing reports. There is no persistent storage or service worker.

AI requires a reviewed snapshot, source confirmation, a valid proxy URL, a separate private proxy token, and explicit per-request consent. The proxy uses OpenAI's Responses API with `store: false`. This does not mean the provider has zero retention; see [data controls](https://developers.openai.com/api/docs/guides/your-data). The server itself does not log or persist images. Review infrastructure logging settings separately.

This is a single-user diagnostic prototype, not real-time tracking, calibrated world-space detection, or a navigation system. Labels can be wrong. Hardware results are unknown until tested on your headset. See [compatibility evidence](docs/COMPATIBILITY.md).
