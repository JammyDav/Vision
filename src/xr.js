// WebXR compositor passthrough is never read back as camera imagery.
export class XRDiagnostic {
  session = null;
  lastResult = null;
  constructor({ root, onEvent = () => {}, onSelect = () => {} }) {
    Object.assign(this, { root, onEvent, onSelect });
  }
  async enter() {
    if (this.session) return;
    // Keep requestSession directly in the click gesture, before any awaits.
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['dom-overlay'], domOverlay: { root: this.root }
    });
    this.session = session;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: true, xrCompatible: true });
    const finish = () => {
      this.session = null;
      document.body.classList.remove('xr-active');
      this.onEvent('ended', this.lastResult);
    };
    session.addEventListener('end', finish, { once: true });
    try {
      if (!gl) throw new Error('WebGL is unavailable.');
      await gl.makeXRCompatible();
      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: true }) });
      await session.requestReferenceSpace('viewer');
      const render = () => {
        if (this.session !== session) return;
        gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        session.requestAnimationFrame(render);
      };
      session.addEventListener('select', () => this.onSelect());
      session.addEventListener('squeeze', () => { void this.exit(); });
      this.lastResult = { mode: 'immersive-ar', environmentBlendMode: session.environmentBlendMode,
        domOverlay: session.domOverlayState?.type || null, startedAt: new Date().toISOString() };
      session.requestAnimationFrame(render);
      document.body.classList.add('xr-active');
      this.onEvent('started', this.lastResult);
    } catch (error) { await session.end().catch(() => {}); throw error; }
  }
  async exit() { await this.session?.end(); }
}
