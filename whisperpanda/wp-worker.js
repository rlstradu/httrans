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
                            // CORRECCIÓN: Clonamos el objeto data con spread syntax {...data}
                            // para evitar problemas de clonación de objetos internos.
                            self.postMessage({ status: 'loading', data: { ...data } });
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
                        // En lugar de enviar 'last' directamente, creamos un objeto nuevo y limpio.
                        // Esto elimina cualquier referencia interna oculta que cause el error "#<a> could not be cloned".
                        const cleanData = {
                            text: last.text,
                            timestamp: [last.timestamp[0], last.timestamp[1]] // Copia explicita del array
                        };
                        
                        self.postMessage({ status: 'progress', data: cleanData });
                    }
                }
            });

            // CORRECCIÓN CRÍTICA FINAL:
            // Limpiamos también el objeto de salida final antes de enviarlo.
            const cleanOutput = {
                text: output.text,
                chunks: output.chunks.map(chunk => ({
                    text: chunk.text,
                    timestamp: [chunk.timestamp[0], chunk.timestamp[1]]
                }))
            };

            self.postMessage({ status: 'complete', data: cleanOutput });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
