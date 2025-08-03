// assembly/index.ts

// NOTA: Este código es AssemblyScript. Es muy parecido a JavaScript,
// pero con tipos de datos definidos (u32, f64) para máxima velocidad.

// Creamos un array para el histograma en la memoria de WebAssembly.
// La palabra "export" hace que sea accesible desde JavaScript.
export const histogram = new Uint32Array(16 * 16 * 16);

// Función rápida para crear el histograma.
// Recibe los datos de los píxeles de una imagen (un array de bytes).
export function createHistogram(imageData: Uint8ClampedArray): void {
  const bins = 16;
  const binSize = 256 / bins;
  histogram.fill(0); // Reseteamos el histograma

  for (let i = 0; i < imageData.length; i += 4) {
    const r = u32(Math.floor(imageData[i] / binSize));
    const g = u32(Math.floor(imageData[i+1] / binSize));
    const b = u32(Math.floor(imageData[i+2] / binSize));
    histogram[r + g * bins + b * bins * bins]++;
  }
}

// Función rápida para comparar dos histogramas.
// Recibe el histograma anterior y el número total de píxeles.
export function compareHistograms(prevHist: Uint32Array, totalPixels: i32): f64 {
  let diff: f64 = 0;
  if (totalPixels === 0) return 0;

  for (let i = 0; i < prevHist.length; i++) {
    diff += Math.abs(prevHist[i] - histogram[i]);
  }
  return diff / totalPixels;
}
