export function createLuminanceHistogram(imageData: Uint8ClampedArray): Uint32Array {
  const histogram = new Uint32Array(256);
  const binSize = 256 / 256;

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i+1];
    const b = imageData[i+2];
    const luminance = u32(r * 0.2126 + g * 0.7152 + b * 0.0722);
    histogram[luminance]++;
  }
  return histogram;
}

// NOTA: Esta función ahora acepta DOS histogramas para comparar.
export function compareHistograms(prevHist: Uint32Array, currentHist: Uint32Array): f64 {
  let diff: f64 = 0;
  let totalPixels: f64 = 0;

  // NOTA: Se calcula primero el total de píxeles del fotograma actual.
  for (let i = 0; i < currentHist.length; i++) {
    totalPixels += currentHist[i];
  }
 if (totalPixels === 0) return 0;

  // NOTA: Se calcula la diferencia después.
  for (let i = 0; i < currentHist.length; i++) {
    diff += Math.abs(prevHist[i] - currentHist[i]);
  }

  return diff / totalPixels;
}
