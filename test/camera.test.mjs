import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraController, cameraConstraints } from '../public/src/camera.js';
import { fitDimensions, captureFrame } from '../public/src/capture.js';
import { DiagnosticLog, describeError, inspectBrowser } from '../public/src/diagnostics.js';
import { recognize, validateEndpoint } from '../public/src/vision.js';

function fakeCamera(getUserMedia) {
  const track = Object.assign(new EventTarget(), { stopped: false, readyState: 'live', muted: false,
    stop() { this.stopped = true; this.readyState = 'ended'; }, getSettings() { return { deviceId: 'private', width: 1280, frameRate: 30 }; } });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  let callback;
  const video = { srcObject: null, readyState: 2, videoWidth: 1280, videoHeight: 960,
    play: async () => {}, requestVideoFrameCallback: fn => { callback = fn; return 1; }, cancelVideoFrameCallback: () => {} };
  return { track, stream, video, deliver: () => callback(),
    camera: new CameraController(video, { mediaDevices: { getUserMedia: getUserMedia || (async () => stream) } }) };
}
globalThis.isSecureContext = true;

test('strict environment request never silently falls back to another camera', async () => {
  const requests = [];
  const mock = fakeCamera(async constraints => {
    requests.push(constraints); throw new DOMException('No environment camera', 'OverconstrainedError');
  });
  await assert.rejects(mock.camera.start('environment'), { name: 'OverconstrainedError' });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].video.facingMode, { exact: 'environment' });
  assert.equal(requests[0].audio, false);
  assert.equal(cameraConstraints('any').video.facingMode, undefined);
  assert.deepEqual(cameraConstraints('camera-id').video.deviceId, { exact: 'camera-id' });
});

test('opening a track is insufficient: a delivered frame, live track and non-muted input are required', async () => {
  const mock = fakeCamera();
  try {
    await mock.camera.start('any');
    assert.equal(mock.camera.readable, false);
    mock.deliver();
    assert.equal(mock.camera.readable, true);
    mock.track.muted = true;
    assert.equal(mock.camera.readable, false);
    assert.equal(mock.camera.stats().settings.deviceId, undefined);
  } finally { mock.camera.stop(); }
  assert.equal(mock.track.stopped, true);
  assert.equal(mock.video.srcObject, null);
});

test('a stream arriving after a permission timeout is stopped', async () => {
  let resolve;
  const mock = fakeCamera(() => new Promise(done => { resolve = done; }));
  await assert.rejects(mock.camera.start('any', 5), { name: 'TimeoutError' });
  resolve(mock.stream);
  await new Promise(done => setImmediate(done));
  assert.equal(mock.track.stopped, true);
  assert.equal(mock.video.srcObject, null);
});

test('stopping a pending request prevents late camera activation', async () => {
  let resolve;
  const mock = fakeCamera(() => new Promise(done => { resolve = done; }));
  const pending = mock.camera.start('any');
  mock.camera.stop();
  resolve(mock.stream);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(mock.track.stopped, true);
});

test('a video playback startup stall times out and releases the opened stream', async () => {
  const mock = fakeCamera();
  mock.video.play = () => new Promise(() => {});
  await assert.rejects(mock.camera.start('any', 5), { name: 'TimeoutError' });
  assert.equal(mock.track.stopped, true);
  assert.equal(mock.video.srcObject, null);
});

test('capture rejects unavailable camera pixels; resizing preserves ratio', () => {
  assert.throws(() => captureFrame({ readable: false }, {}), /live camera/);
  assert.deepEqual(fitDimensions(1280, 960), { width: 768, height: 576 });
  assert.deepEqual(fitDimensions(320, 240), { width: 320, height: 240 });
  assert.deepEqual(fitDimensions(960, 1280), { width: 576, height: 768 });
});

test('permissions query failures remain unknown, independent from XR capability', async () => {
  const win = { isSecureContext: true }; win.self = win; win.top = win;
  const report = await inspectBrowser({ userAgent: 'TestBrowser', permissions: { query: async () => { throw new Error(); } },
    xr: { isSessionSupported: async mode => mode === 'immersive-ar' } }, win, {});
  assert.match(report.cameraPermission, /Unknown/);
  assert.equal(report.getUserMedia, false);
  assert.equal(report.xr['immersive-ar'], true);
  assert.match(describeError({ name: 'NotAllowedError' }).hint, /permission/);
  const log = new DiagnosticLog(); log.record('frame.captured', { width: 768 });
  assert.equal(log.report(report, {}, '', '', false, {}).sourceConfirmed, false);
});

test('AI refuses unreviewed frames and insecure or credential-bearing endpoints', async () => {
  let called = false;
  await assert.rejects(recognize({ frame: { dataUrl: 'data:image/jpeg;base64,AA==' }, confirmed: false }, () => { called = true; }), /inspect/);
  assert.equal(called, false);
  for (const value of ['http://example.com/recognize', 'https://user:pass@example.com/recognize', 'https://example.com/?key=secret', 'https://example.com/#secret']) {
    assert.throws(() => validateEndpoint(value));
  }
  assert.equal(validateEndpoint('http://localhost:8787/recognize'), 'http://localhost:8787/recognize');
});

test('AI sends only one approved frame to proxy and never forwards provider keys', async () => {
  const args = { frame: { dataUrl: 'data:image/jpeg;base64,AA==' }, confirmed: true, consent: true,
    endpoint: 'https://proxy.example/recognize', token: 'a'.repeat(64) };
  const result = await recognize(args, async (url, init) => {
    assert.equal(url, args.endpoint);
    assert.deepEqual(JSON.parse(init.body), { image: args.frame.dataUrl });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    return { ok: true, json: async () => ({ description: 'A cup.' }) };
  });
  assert.equal(result, 'A cup.');
  await assert.rejects(recognize({ ...args, token: 'sk-' + 'a'.repeat(40) }), /OpenAI key/);
});
