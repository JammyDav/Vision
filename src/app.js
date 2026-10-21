import { CameraController } from './camera.js';
import { captureFrame } from './capture.js';
import { DiagnosticLog, describeError, inspectBrowser } from './diagnostics.js';
import { recognize, validateEndpoint } from './vision.js';
import { XRDiagnostic } from './xr.js';

const $ = id => document.getElementById(id);
const log = new DiagnosticLog();
let checks = null, frame = null, requesting = false, aiBusy = false, xrBusy = false;
let knownDeviceCount = null;
const camera = new CameraController($('video'), { onEvent(event) {
  log.record(`camera.${event}`);
  if (event === 'ended' || event === 'mute') discardFrame();
  update();
} });
const xr = new XRDiagnostic({ root: $('app'), onEvent(event, data) {
  log.record(`xr.${event}`, data || {}); update();
}, onSelect() {
  if (!camera.stream && !requesting) void startCamera();
  else if (camera.readable) takeFrame();
} });

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}
function fail(error, scope) {
  const detail = describeError(error);
  log.record(`${scope}.error`, detail);
  message(`${detail.name}: ${detail.hint}`, true);
  update();
}
function discardFrame() {
  frame = null;
  $('snapshot').hidden = true;
  $('snapshot').removeAttribute('src');
  $('snapshot-empty').hidden = false;
  $('confirm-source').checked = false;
  $('consent').checked = false;
  $('ai-result').textContent = '';
  $('snapshot-info').textContent = 'Snapshots are limited to 768 pixels on the longest side.';
}
function update() {
  const stats = camera.stats();
  $('start').disabled = requesting;
  $('camera-select').disabled = requesting;
  $('stop').disabled = !camera.stream && !requesting;
  $('capture').disabled = !stats.readable || aiBusy;
  $('clear-frame').disabled = !frame || aiBusy;
  $('confirm-source').disabled = !frame || aiBusy;
  $('live-badge').textContent = requesting ? 'REQUESTING' : stats.readable ? 'FRAMES ARRIVING' : stats.active ? 'WAITING FOR FRAMES' : 'CAMERA OFF';
  $('camera-status').textContent = requesting ? 'Requesting permission' : stats.readable ? 'Readable video' : stats.active ? 'Waiting / paused' : 'Not active';
  $('source-status').textContent = $('confirm-source').checked && frame ? 'Confirmed by you' : 'Unverified';
  $('preview-empty').hidden = stats.readable;
  $('frame-info').textContent = stats.active ? `${stats.width} × ${stats.height} · ${stats.framesObserved} frames observed${stats.readable ? '' : ' · waiting / paused'}` : 'No frames received';
  $('enter-xr').disabled = !checks?.xr['immersive-ar'] || Boolean(xr.session) || xrBusy;
  $('exit-xr').disabled = !xr.session;
  let endpointValid = false;
  try { validateEndpoint($('endpoint').value); endpointValid = true; } catch { /* No configuration yet. */ }
  const token = $('access-token').value.trim();
  const canSend = Boolean(frame && $('confirm-source').checked && $('consent').checked && endpointValid && token.length >= 32 && !token.startsWith('sk-'));
  $('recognize').disabled = !canSend || aiBusy;
  $('ai-status').textContent = aiBusy ? 'Sending one reviewed snapshot…' : canSend ? 'Ready. Only this snapshot will be sent when you press the button.' : 'Waiting for a captured, verified frame, consent and proxy configuration.';
  $('log').textContent = log.entries.map(entry => JSON.stringify(entry)).join('\n');
}
async function runChecks() {
  try {
    checks = await inspectBrowser();
    log.record('browser.checked');
    $('secure-status').textContent = checks.secureContext ? 'Secure context' : 'HTTPS required';
    $('xr-status').textContent = checks.xr['immersive-ar'] === true ? 'Available (untested)' : checks.xr['immersive-ar'] === null ? 'Check failed' : 'Not exposed';
    const rows = {
      'Secure context': checks.secureContext ? 'Yes' : 'No — open HTTPS',
      'Full browser page': checks.topLevel ? 'Yes' : 'Embedded — open directly',
      'Camera API': checks.getUserMedia ? 'Present' : 'Unavailable',
      'Camera permission': checks.cameraPermission,
      'Camera policy': String(checks.cameraPolicy),
      'Camera inputs': knownDeviceCount === null ? 'Refresh list to inspect' : knownDeviceCount,
      'Immersive AR': String(checks.xr['immersive-ar']),
      'Immersive VR': String(checks.xr['immersive-vr'])
    };
    $('checks').replaceChildren(...Object.entries(rows).map(([label, value]) => {
      const row = document.createElement('div'); row.className = 'check-row';
      const key = document.createElement('dt'); key.textContent = label;
      const detail = document.createElement('dd'); detail.textContent = value;
      row.append(key, detail); return row;
    }));
    update();
  } catch (error) { fail(error, 'browser'); }
}
async function listCameras() {
  const selection = $('camera-select').value;
  const devices = await camera.list();
  knownDeviceCount = devices.length;
  $('camera-select').querySelectorAll('[data-device]').forEach(option => option.remove());
  devices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId; option.dataset.device = 'true';
    option.textContent = device.label || `Camera ${index + 1} (label hidden until permission)`;
    if (device.deviceId) $('camera-select').append(option);
  });
  if ([...$('camera-select').options].some(option => option.value === selection)) $('camera-select').value = selection;
  log.record('camera.enumerated', { count: devices.length, labelsVisible: devices.some(device => Boolean(device.label)) });
  await runChecks();
  return devices;
}
async function startCamera() {
  if (requesting) return;
  requesting = true; discardFrame(); update();
  const selected = $('camera-select').value;
  log.record('camera.request', { selection: ['environment', 'any'].includes(selected) ? selected : 'explicit-device', inXR: Boolean(xr.session) });
  message('Waiting for camera permission. Approve only if you want this site to access the camera.');
  try {
    await camera.start(selected);
    message('Camera track opened. Wait for moving video, then capture a frame and verify its source.');
    try { await listCameras(); } catch (error) { fail(error, 'enumeration'); }
  } catch (error) { fail(error, 'camera'); }
  finally { requesting = false; update(); }
}
function takeFrame() {
  if (aiBusy) return;
  try {
    discardFrame();
    frame = captureFrame(camera);
    $('snapshot').src = frame.dataUrl; $('snapshot').hidden = false; $('snapshot-empty').hidden = true;
    const { dataUrl, ...metadata } = frame;
    log.record('frame.captured', metadata);
    $('snapshot-info').textContent = `${frame.width} × ${frame.height} JPEG · ${frame.capturedAt}${frame.looksBlank ? ' · Looks dark or uniform: check carefully and retry in better light.' : ''}`;
    message('Frame captured locally. Inspect it before confirming the camera source.');
  } catch (error) { message(error.message, true); log.record('frame.error', { name: error.name }); }
  update();
}
$('start').addEventListener('click', startCamera);
$('stop').addEventListener('click', () => { camera.stop(); discardFrame(); log.record('camera.stopped'); message('Camera stopped and snapshot discarded.'); update(); });
$('camera-select').addEventListener('change', () => { camera.stop(); discardFrame(); update(); message('Camera selection changed. Press Request camera.'); });
$('enumerate').addEventListener('click', () => { void listCameras().catch(error => fail(error, 'enumeration')); });
$('check').addEventListener('click', runChecks);
$('capture').addEventListener('click', takeFrame);
$('clear-frame').addEventListener('click', () => { discardFrame(); update(); });
for (const id of ['confirm-source', 'consent', 'endpoint', 'access-token']) $(id).addEventListener('input', update);
$('enter-xr').addEventListener('click', async () => {
  if (xrBusy) return;
  xrBusy = true; update();
  try { await xr.enter(); message('WebXR AR opened. Passthrough viewing is separate from pixel access.'); }
  catch (error) { fail(error, 'xr'); }
  finally { xrBusy = false; update(); }
});
$('exit-xr').addEventListener('click', () => { void xr.exit().catch(error => fail(error, 'xr')); });
// Prevent DOM overlay button clicks from also firing controller select capture.
$('app').addEventListener('beforexrselect', event => event.preventDefault());
$('recognize').addEventListener('click', async () => {
  if (aiBusy) return;
  aiBusy = true; update();
  $('ai-result').textContent = '';
  const submittedFrame = frame;
  try {
    const result = await recognize({ frame, confirmed: $('confirm-source').checked, consent: $('consent').checked,
      endpoint: $('endpoint').value, token: $('access-token').value });
    log.record('ai.completed');
    if (frame === submittedFrame) {
      $('ai-result').textContent = result;
      message('Recognition returned. Treat the description as an estimate.');
    } else message('Recognition completed for the discarded frame. Result discarded too.');
  } catch (error) {
    message(error.message, true); log.record('ai.error', { name: error.name });
  } finally { aiBusy = false; $('consent').checked = false; update(); }
});
$('report').addEventListener('click', () => {
  const report = log.report(checks, { ...camera.stats(), exposedDeviceCount: knownDeviceCount }, $('notes').value,
    $('os-version').value, Boolean(frame && $('confirm-source').checked), { active: Boolean(xr.session), lastSession: xr.lastResult });
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `quest-vision-${new Date().toISOString().replaceAll(':', '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
navigator.mediaDevices?.addEventListener('devicechange', () => { void listCameras().catch(error => fail(error, 'enumeration')); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !xr.session && !xrBusy) { camera.stop(); discardFrame(); $('access-token').value = ''; update(); }
});
window.addEventListener('pagehide', () => { camera.stop(); discardFrame(); $('access-token').value = ''; });
setInterval(update, 500);
void runChecks();
