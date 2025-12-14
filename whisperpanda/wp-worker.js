// wp-worker.js - Worker de la IA (Versión V3 Blindada)

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuración de entorno
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

// Función auxiliar para enviar logs a la consola de la interfaz
function log(msg) {
    self.postMessage({ status: 'debug', data: msg });
}

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message.type === 'run') {
        
        // 1. CARGA DEL MODELO
        if (!transcriber) {
            try {
                self.postMessage({ status: 'loading' });
                log("Initializing Whisper pipeline...");
                
                // Usamos 'Xenova/whisper-small' (aprox 250MB). 
                // Es el mejor equilibrio calidad/rendimiento para web hoy en día.
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
                    quantized: true,
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            // Clonamos datos simples para evitar errores de referencia
                            self.postMessage({ 
                                status: 'loading', 
                                data: { file: data.file, progress: data.progress, status: data.status } 
                            });
                        }
                    }
                });
                log("Model loaded successfully.");
            } catch (err) {
                log(`CRITICAL ERROR LOADING MODEL: ${err.message}`);
                self.postMessage({ status: 'error', data: "Error loading model: " + err.message });
                return;
            }
        }

        // 2. EJECUCIÓN
        try {
            self.postMessage({ status: 'initiate' });
            log("Starting transcription task...");

            const audio = message.audio;
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            // Ejecutamos la IA
            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                
                // Parámetros de segmentación (igual que tu Colab)
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: "word", // IMPORTANTE: Timestamps por palabra para tu algoritmo V5
                
                // Parámetros de estabilidad (estándar para evitar conflictos en web)
                no_repeat_ngram_size: 2,
                
                // Callback de progreso MUY simplificado para evitar el error "#<a> could not be cloned"
                callback_function: (items) => {
                    try {
                        // Solo enviamos una señal de vida, sin datos complejos
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            
                            // Intentamos extraer un timestamp seguro
                            let endSec = 0;
                            if (last && last.timestamp) {
                                if (Array.isArray(last.timestamp)) endSec = last.timestamp[1];
                                else if (typeof last.timestamp === 'number') endSec = last.timestamp;
                            }
                            
                            // Enviamos SOLO números y texto plano. Nada de objetos anidados.
                            self.postMessage({ 
                                status: 'progress', 
                                data: { 
                                    text: last.text ? String(last.text).substring(0, 50) : "...", 
                                    timeRef: typeof endSec === 'number' ? endSec : 0
                                } 
                            });
                        }
                    } catch (e) {
                        // Ignorar errores de progreso para no detener la transcripción
                    }
                }
            });

            log("Transcription finished. Processing output data...");

            // 3. SANITIZACIÓN DE DATOS (Crucial para evitar el error de clonación)
            // Reconstruimos el objeto paso a paso para asegurar que solo enviamos JSON puro.
            
            const cleanChunks = [];
            if (output.chunks && Array.isArray(output.chunks)) {
                for (const chunk of output.chunks) {
                    // Extracción segura de timestamps
                    let start = 0, end = 0;
                    if (Array.isArray(chunk.timestamp)) {
                        start = chunk.timestamp[0];
                        end = chunk.timestamp[1];
                    }
                    
                    cleanChunks.push({
                        text: chunk.text ? String(chunk.text) : "",
                        timestamp: [Number(start || 0), Number(end || 0)]
                    });
                }
            }

            const cleanOutput = {
                text: output.text ? String(output.text) : "",
                chunks: cleanChunks
            };

            log(`Sending ${cleanChunks.length} chunks to main thread.`);
            self.postMessage({ status: 'complete', data: cleanOutput });

        } catch (err) {
            log(`TRANSCRIPTION FAILED: ${err.message}`);
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
