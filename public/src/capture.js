export function fitDimensions(width, height, maxSide = 768) {
  if (!(width > 0 && height > 0)) throw new Error('No camera dimensions available.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function captureFrame(camera, doc = document) {
  if (!camera.readable) throw new Error('A live camera frame is required. Wait for moving video, then retry.');
  const canvas = doc.createElement('canvas');
  Object.assign(canvas, fitDimensions(camera.video.videoWidth, camera.video.videoHeight));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable.');
  context.drawImage(camera.video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  let sumSquares = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    sum += luminance;
    sumSquares += luminance * luminance;
  }
  const mean = sum / count;
  const variance = Math.max(0, sumSquares / count - mean * mean);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  if (!dataUrl.startsWith('data:image/jpeg;base64,')) throw new Error('JPEG capture is unavailable.');
  return { dataUrl, width: canvas.width, height: canvas.height, capturedAt: new Date().toISOString(),
    meanLuminance: Math.round(mean), variance: Math.round(variance),
    looksBlank: mean < 4 || variance < 2 };
}
