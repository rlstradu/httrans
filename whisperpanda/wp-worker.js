// wp-worker.js - Worker de la IA (Cerebro del Panda)

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// Configuración importante para entorno web estático
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    // --- ACCIÓN: RUN ---
    if (message.type === 'run') {
        
        // 1. Cargar Modelo (si no está cargado)
        if (!transcriber) {
            try {
                self.postMessage({ status: 'loading' });
                
                // Usamos 'whisper-base' cuantizado. 
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
                    quantized: true,
                    // Callback para informar del progreso de la descarga del modelo
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            // CORRECCIÓN ESTRICTA: Solo copiamos los datos primitivos que necesitamos.
                            // Evitamos copiar el objeto 'data' entero para prevenir errores de clonación.
                            self.postMessage({ 
                                status: 'loading', 
                                data: { 
                                    file: data.file, 
                                    progress: data.progress,
                                    status: data.status
                                } 
                            });
                        }
                    }
                });
            } catch (err) {
                self.postMessage({ status: 'error', data: "Error loading model: " + err.message });
                return;
            }
        }

        // 2. Ejecutar Transcripción
        try {
            self.postMessage({ status: 'initiate' });

            const audio = message.audio;
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                
                // Parámetros Anti-Bucle
                repetition_penalty: 1.2, 
                no_repeat_ngram_size: 2, 
                temperature: 0,

                // --- PROGRESO EN TIEMPO REAL ---
                callback_function: (items) => {
                    // items es un array con todos los chunks.
                    if (items && items.length > 0) {
                        const last = items[items.length - 1];
                        
                        // CORRECCIÓN CRÍTICA:
                        // Extraemos manualmente SOLO el texto y los números.
                        // Usamos Number() para asegurar que no enviamos tipos extraños.
                        const start = last.timestamp && last.timestamp[0] ? Number(last.timestamp[0]) : 0;
                        const end = last.timestamp && last.timestamp[1] ? Number(last.timestamp[1]) : 0;

                        const cleanData = {
                            text: last.text ? String(last.text) : "",
                            timestamp: [start, end]
                        };
                        
                        self.postMessage({ status: 'progress', data: cleanData });
                    }
                }
            });

            // CORRECCIÓN CRÍTICA FINAL:
            // Reconstruimos el objeto final desde cero para asegurar pureza.
            const cleanOutput = {
                text: output.text ? String(output.text) : "",
                chunks: output.chunks.map(chunk => {
                    const start = chunk.timestamp && chunk.timestamp[0] ? Number(chunk.timestamp[0]) : null;
                    const end = chunk.timestamp && chunk.timestamp[1] ? Number(chunk.timestamp[1]) : null;
                    return {
                        text: chunk.text ? String(chunk.text) : "",
                        timestamp: [start, end]
                    };
                })
            };

            self.postMessage({ status: 'complete', data: cleanOutput });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
