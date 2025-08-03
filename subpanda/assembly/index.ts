// assembly/index.ts

// NOTA: Histograma más pequeño, solo para el brillo (luminancia)
export const histogram = new Uint32Array(256);

// Función que calcula el histograma de luminancia de una imagen
export function createLuminanceHistogram(imageData: Uint8ClampedArray): void {
  histogram.fill(0); // Reseteamos el histograma

  for (let i = 0; i < imageData.length; i += 4) {
    // Fórmula estándar para calcular la luminancia (brillo) de un píxel RGB
    const r = imageData[i];
    const g = imageData[i+1];
    const b = imageData[i+2];
    const luminance = u32(r * 0.2126 + g * 0.7152 + b * 0.0722);
    histogram[luminance]++;
  }
}

// La función de comparación sigue siendo válida, pero ahora para histogramas de luminancia
export function compareHistograms(prevHist: Uint32Array, totalPixels: i32): f64 {
  let diff: f64 = 0;
  if (totalPixels === 0) return 0;

  for (let i = 0; i < prevHist.length; i++) {
    diff += Math.abs(prevHist[i] - histogram[i]);
  }
  return diff / totalPixels;
}
