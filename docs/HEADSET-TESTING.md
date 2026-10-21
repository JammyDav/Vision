# Headset test checklist

Run this in standalone Quest 3 Browser. This work cannot be verified by a desktop browser, an emulator, or watching passthrough around a window.

## 1. Record the environment

- Record Horizon OS version/build from headset Settings and enter it in the app's OS field.
- Open the deployed HTTPS URL directly. Run the browser check. The report records the Browser user-agent/build.
- Expect secure context = Yes, full browser page = Yes. Camera API, permission and immersive AR are separate observations.
- Download a baseline report. Avoid private information in test notes.

## 2. Test permissions and inputs

- Select **Environment camera (strict diagnostic)** and press **Request camera**. Note whether a permission prompt appears, and its wording.
- Deny once. Expect an actionable error and no active camera. Re-enable camera permission for the site through browser site settings; also inspect headset OS permissions for Browser. Run the check again.
- Retry and grant permission if prompted. Expect video that changes as you move a harmless object, such as a cup, in front of the headset. Do not assume success from the “granted” permission alone.
- Press **Refresh camera list** after permission. Select a particular camera and request again to compare exposed inputs. Labels are shown locally but excluded from exports.
- If strict environment selection fails, test **Any camera** separately. An avatar or virtual camera is a useful diagnostic result, not real-room success. Do not confirm its source.
- Record errors such as `OverconstrainedError`, `NotAllowedError`, `NotReadableError`, no prompt, avatar-only list, black image or frozen video.

**Failure path:** If only avatar/blank feeds exist, stop here for Quest AI. Download the report. Update the headset/Browser through normal settings if desired, then retest and record both builds. See the build-specific Meta investigation linked in COMPATIBILITY.md; this app does not bypass permissions.

## 3. Verify readable pixels

- Wait for “FRAMES ARRIVING.” Move the object and confirm the video changes. Frame callbacks do not prove real motion, so check visually.
- Press **Capture frame**. Confirm the JPEG shows the same actual scene and object, rather than only the surrounding OS passthrough.
- Only then tick the source-confirmation checkbox. Capture a new scene: confirmation and upload consent must reset.
- Press **Stop camera**. Expect the preview and snapshot to clear, capture to disable and the headset's camera indicator to turn off (unless another app uses it).
- Restart, change inputs, revoke permission, unplug/disconnect an input if relevant, and background/return to the page. The app should never claim fresh readable video from a stopped or muted input. Returning from background requires another camera request.

## 4. Test WebXR separately

- Start a readable camera in the panel first, then press **Enter WebXR AR** if offered. Approve the immersive request if appropriate.
- Expect passthrough viewing. A readable camera may continue, pause, or fail when entering AR; log what your build does.
- If the optional DOM overlay is supported, use the same controls. Otherwise the controller trigger captures a frame when video is readable, or requests the selected camera if none is active. Grip or the system WebXR exit returns to the panel.
- If a stream is active but paused, exit AR, stop it in the panel, re-enter AR and trigger a camera request there. Exit and inspect any captured snapshot.
- Exit and download another report. Do not interpret an AR view as raw-camera success.
- No WebXR UI or controller response? Use the system exit. The initial diagnostic intentionally draws only a transparent layer.

## 5. Optional recognition, after real frames pass

- Follow AI-SETUP.md, then enter the HTTPS proxy URL and private proxy token in the app. Never enter an OpenAI key in the page.
- Capture a harmless object, inspect and confirm the source. Check the per-request upload consent. Press **Send reviewed frame to AI** once.
- Expect a short description. Check the object yourself; the result may be wrong. Consent resets after every request.
- Missing consent, no snapshot, no source verification or no valid proxy configuration must keep Send disabled. A wrong token should fail without a provider call. Rapid/concurrent requests should be rejected by the proxy.
- Verify through browser network tools or your server configuration that opening, checking, capturing and entering AR cause no AI/image requests. Only Send may upload a JPEG.

## Report back

Share the downloaded JSON report and state: “Real room / avatar / blank / frozen”, which selection worked, whether the captured JPEG matched, whether AR changed camera availability, and whether a prompt appeared. Do not share your proxy token, provider key, or private room image. Desktop simulated-camera tests must be labelled as simulated.
