export function cameraConstraints(selection) {
  const video = { width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30, max: 30 } };
  if (selection === 'environment') video.facingMode = { exact: 'environment' };
  else if (selection !== 'any') video.deviceId = { exact: selection };
  return { audio: false, video };
}

export class CameraController {
  stream = null;
  generation = 0;
  frames = 0;
  lastFrameAt = 0;
  #timer;
  #callback;
  constructor(video, { mediaDevices = navigator.mediaDevices, onEvent = () => {} } = {}) {
    this.video = video;
    this.mediaDevices = mediaDevices;
    this.onEvent = onEvent;
  }
  async list() {
    if (!this.mediaDevices?.enumerateDevices) return [];
    return (await this.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
  }
  async start(selection, timeoutMs = 20000) {
    this.stop();
    if (!globalThis.isSecureContext || !this.mediaDevices?.getUserMedia) {
      throw new DOMException('HTTPS and getUserMedia are required.', 'SecurityError');
    }
    const generation = this.generation;
    let timer;
    const pending = this.mediaDevices.getUserMedia(cameraConstraints(selection)).then(stream => {
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        throw new DOMException('Request cancelled.', 'AbortError');
      }
      this.stream = stream;
      return stream;
    });
    try {
      const ready = pending.then(async () => {
        this.video.srcObject = this.stream;
        await this.video.play();
        if (generation !== this.generation) throw new DOMException('Request cancelled.', 'AbortError');
      });
      await Promise.race([ready, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DOMException('Camera timed out.', 'TimeoutError')), timeoutMs);
      })]);
      const track = this.stream.getVideoTracks()[0];
      track.addEventListener('ended', () => { if (generation === this.generation) { this.stop(); this.onEvent('ended'); } });
      track.addEventListener('mute', () => { if (generation === this.generation) { this.lastFrameAt = 0; this.onEvent('mute'); } });
      track.addEventListener('unmute', () => { if (generation === this.generation) this.onEvent('unmute'); });
      this.#monitor(generation);
      this.onEvent('started');
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    } finally { clearTimeout(timer); }
  }
  #monitor(generation) {
    const frame = () => {
      if (generation !== this.generation) return;
      this.frames++;
      this.lastFrameAt = performance.now();
      this.#callback = this.video.requestVideoFrameCallback(frame);
    };
    if (this.video.requestVideoFrameCallback) this.#callback = this.video.requestVideoFrameCallback(frame);
    else {
      let lastTime = this.video.currentTime;
      this.#timer = setInterval(() => {
        if (generation === this.generation && this.video.currentTime !== lastTime && this.video.readyState >= 2) {
          lastTime = this.video.currentTime;
          this.frames++;
          this.lastFrameAt = performance.now();
        }
      }, 100);
    }
  }
  get readable() {
    const track = this.stream?.getVideoTracks()[0];
    return Boolean(track?.readyState === 'live' && !track.muted && this.video.readyState >= 2 &&
      this.video.videoWidth > 0 && this.frames > 0 && performance.now() - this.lastFrameAt < 3000);
  }
  stats() {
    const track = this.stream?.getVideoTracks()[0];
    const settings = track?.getSettings() || {};
    return { active: Boolean(this.stream), readable: this.readable, framesObserved: this.frames,
      width: this.video.videoWidth, height: this.video.videoHeight,
      trackState: track?.readyState || 'none', muted: track?.muted || false,
      settings: Object.fromEntries(['width', 'height', 'frameRate', 'facingMode', 'resizeMode']
        .filter(key => settings[key] !== undefined).map(key => [key, settings[key]])) };
  }
  stop() {
    this.generation++;
    clearInterval(this.#timer);
    if (this.#callback !== undefined) this.video.cancelVideoFrameCallback?.(this.#callback);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.frames = 0;
    this.lastFrameAt = 0;
  }
}
