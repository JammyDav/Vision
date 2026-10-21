# Compatibility evidence

Reviewed **21 October 2026**. Public documentation is not a substitute for testing the installed headset OS and Browser build.

- [Meta: Mixed Reality Support in Browser](https://developers.meta.com/vr/documentation/web/webxr-mixed-reality/) documents `immersive-ar` and compositor passthrough separately from pixel access. A transparent render layer is required for viewing.
- [Meta: Quest Browser Headset Camera Permission Issue](https://developers.meta.com/vr/support/investigations/1557993751977106/) is an **Investigating** report, with an AI-summarized developer submission. It describes avatar-only enumeration and an environment-camera constraint failure on a specific Browser build, and reports real frames after an OS permission workaround. It is evidence of a build-specific problem, not a promise of general browser support or a supported workaround for this project.
- [Meta: Passthrough Camera API overview](https://developers.meta.com/vr/documentation/unity/unity-pca-overview/) describes native camera access. Native availability does not establish JavaScript availability.
- [Immersive Web SDK: Camera access](https://iwsdk.dev/guides/13-camera-access.html) distinguishes browser camera inputs from Quest passthrough imagery. We use standard MediaDevices directly rather than this SDK.
- [W3C: Media Capture and Streams](https://w3c.github.io/mediacapture-main/getusermedia.html) defines constraints, permissions, streams, and device enumeration. Device IDs and labels can be restricted before permission. The camera permission query may be unsupported even when capture works.
- [GitHub: Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes the artifact and deployment process used here.
- [OpenAI: Images and vision](https://developers.openai.com/api/docs/guides/images-vision) documents image inputs through the Responses API. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) explains retention considerations.

Because Meta's older viewing documentation, a current SDK guide, and a newer build-specific investigation do not establish a universal support baseline, the app uses runtime probes and a manual source-verification gate. We deliberately do not assert a minimum Browser/OS version that guarantees success.

| Environment | Expected diagnostic behavior | Verified here? |
| --- | --- | --- |
| Desktop browser, HTTPS/localhost, webcam | Standard camera diagnostic; XR may be unavailable | See delivery notes for local browser QA |
| Quest 3, standalone Browser, Pages HTTPS | Probe exact environment input and explicit devices; verify actual scene | Requires user's headset |
| Quest immersive-ar | Passthrough viewing can work independently of readable MediaDevices frames | Requires user's headset |
| Iframe preview | Camera/XR may be blocked by embedding policy | Open direct URL instead |
| Plain HTTP LAN URL | Usually fails secure-context prerequisite | Not a supported deployment |

Do not change system permissions through ADB just to turn a failed diagnostic green. First record the build, site/OS permission behavior and report. If the installed build only exposes an avatar, leave AI disconnected for the headset and revisit the browser rollout. A phone or desktop webcam may test the downstream pipeline, but does not prove Quest room-camera access.
