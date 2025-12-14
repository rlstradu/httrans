// wp-worker.js - Worker V3 con soporte WebGPU

// Importamos la versión V3 (Alpha) que soporta WebGPU
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuración
env.allowLocalModels = false;
env.useBrowserCache = true;

// Intentar activar WebGPU si está disponible, si no, usar WASM (CPU)
// Nota: En la v2.17+ esto suele ser automático, pero lo definimos por si acaso.

let transcriber = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message.type === 'run') {
        if (!transcriber) {
            try {
                self.postMessage({ status: 'loading', data: { status: 'init', file: 'Model' } });
                
                // CAMBIO CLAVE: Usamos 'distil-whisper/distil-small.en' o 'Xenova/whisper-small'
                // 'distil-whisper' es 6 veces más rápido y casi tan preciso como el medium.
                // Si necesitas multilingüe obligatoriamente, usa 'Xenova/whisper-small'.
                
                const modelName = 'Xenova/whisper-small'; 

                transcriber = await pipeline('automatic-speech-recognition', modelName, {
                    quantized: true,
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            self.postMessage({ 
                                status: 'loading', 
                                data: { ...data } 
                            });
                        }
                    }
                });
            } catch (err) {
                self.postMessage({ status: 'error', data: "Error loading model (WebGPU/CPU): " + err.message });
                return;
            }
        }

        try {
            self.postMessage({ status: 'initiate' });

            // Configuración para obtener TIMESTAMPS POR PALABRA (Crucial para tu algoritmo)
            const output = await transcriber(message.audio, {
                language: message.language,
                task: message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe'),
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: "word", // ¡Esto nos da el nivel de detalle de tu Colab!
                
                // Parámetros de estabilidad
                no_repeat_ngram_size: 2,
                temperature: 0,
                
                callback_function: (items) => {
                    // Progreso simple
                    if (items && items.length > 0) {
                        const last = items[items.length - 1];
                        // Estimación de progreso
                        if (last && last.timestamp) {
                             const end = Array.isArray(last.timestamp) ? last.timestamp[1] : last.timestamp;
                             self.postMessage({ status: 'progress', data: { timestamp: [0, end] } });
                        }
                    }
                }
            });

            // Enviamos el objeto completo, que ahora incluye 'chunks' con palabras
            // Limpiamos un poco para evitar el error de clonación
            const safeOutput = {
                text: output.text,
                chunks: output.chunks // Aquí vendrán las palabras con timestamps
            };

            self.postMessage({ status: 'complete', data: safeOutput });

        } catch (err) {
            self.postMessage({ status: 'error', data: err.message });
        }
    }
});
