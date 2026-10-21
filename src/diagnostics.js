export function describeError(error) {
  const hints = {
    NotAllowedError: 'Camera permission was denied, or browser/OS policy blocked it. Check this site’s permissions and headset browser permissions, then retry.',
    NotFoundError: 'No camera matching this request is exposed by the browser.',
    OverconstrainedError: 'The requested camera or constraint is unavailable. Try Any camera as a separate diagnostic; it may be an avatar.',
    NotReadableError: 'The camera could not start. Close other camera apps/tabs, check OS permissions, and retry.',
    SecurityError: 'Browser security or permissions policy blocked camera access.',
    TimeoutError: 'No usable camera arrived in time. Dismiss any pending permission prompt and retry.',
    AbortError: 'The camera operation was interrupted.',
    TypeError: 'Camera access is unavailable or the request is invalid. Use HTTPS in the full browser.'
  };
  return { name: error?.name || 'Error', constraint: error?.constraint || null,
    hint: hints[error?.name] || 'The operation failed. Check the event log and try again.' };
}

export async function inspectBrowser(nav = navigator, win = window, doc = document) {
  let permission = 'Unknown (query unsupported)';
  try { permission = (await nav.permissions.query({ name: 'camera' })).state; } catch { /* Optional browser API. */ }
  const xr = {};
  for (const mode of ['immersive-ar', 'immersive-vr']) {
    try { xr[mode] = nav.xr ? await nav.xr.isSessionSupported(mode) : false; }
    catch { xr[mode] = null; }
  }
  const policy = doc.permissionsPolicy || doc.featurePolicy;
  let cameraPolicy = 'Unknown';
  try { if (policy?.allowsFeature) cameraPolicy = policy.allowsFeature('camera'); } catch { /* Optional. */ }
  return {
    secureContext: win.isSecureContext, topLevel: win.self === win.top,
    getUserMedia: Boolean(nav.mediaDevices?.getUserMedia),
    enumerateDevices: Boolean(nav.mediaDevices?.enumerateDevices),
    cameraPermission: permission, cameraPolicy, xr,
    userAgent: nav.userAgent,
    supportedConstraints: nav.mediaDevices?.getSupportedConstraints?.() || {}
  };
}

export class DiagnosticLog {
  entries = [];
  record(event, data = {}) {
    this.entries.push({ time: new Date().toISOString(), event, ...data });
    if (this.entries.length > 150) this.entries.shift();
  }
  report(checks, camera, notes, osVersion, sourceConfirmed, xr) {
    return { schemaVersion: 1, appVersion: '0.1.0', createdAt: new Date().toISOString(),
      checks, camera, xr, sourceConfirmed, osVersion, notes, events: this.entries,
      privacy: 'No images, device IDs, camera labels, page query strings or AI credentials included.' };
  }
}
