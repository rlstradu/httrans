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
                            // Clonación segura manual
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
                    // BLINDAJE: Envolvemos esto en try-catch para que un error aquí
                    // NO detenga la transcripción completa.
                    try {
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            
                            // Extracción manual y paranoica de datos
                            let start = 0;
                            let end = 0;
                            
                            // Verificar que timestamp existe y es un array
                            if (Array.isArray(last.timestamp)) {
                                start = typeof last.timestamp[0] === 'number' ? last.timestamp[0] : 0;
                                end = typeof last.timestamp[1] === 'number' ? last.timestamp[1] : 0;
                            }

                            const cleanData = {
                                text: last.text ? String(last.text) : "",
                                timestamp: [start, end]
                            };
                            
                            self.postMessage({ status: 'progress', data: cleanData });
                        }
                    } catch (callbackError) {
                        // Si falla el progreso, lo ignoramos silenciosamente para que la transcripción siga
                        console.warn("Ignored progress error:", callbackError);
                    }
                }
            });

            // CORRECCIÓN CRÍTICA FINAL:
            // Reconstruimos el objeto final asegurando tipos primitivos
            const cleanOutput = {
                text: output.text ? String(output.text) : "",
                chunks: (output.chunks || []).map(chunk => {
                    // Verificación segura de timestamps
                    let start = null;
                    let end = null;
                    if (Array.isArray(chunk.timestamp)) {
                        start = typeof chunk.timestamp[0] === 'number' ? chunk.timestamp[0] : null;
                        end = typeof chunk.timestamp[1] === 'number' ? chunk.timestamp[1] : null;
                    }
                    
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
