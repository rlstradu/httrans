// wp-worker.js - Worker de la IA (Versión Estabilizada)

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// Configuración para entorno web
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message.type === 'run') {
        
        // 1. Cargar Modelo (Whisper Base es el equilibrio ideal)
        if (!transcriber) {
            try {
                self.postMessage({ status: 'loading' });
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
                    quantized: true,
                    progress_callback: (data) => {
                        // Enviar progreso de descarga del modelo
                        if (data.status === 'progress') {
                            self.postMessage({ status: 'loading', data: data });
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
                
                // --- PARÁMETROS ANTI-ALUCINACIÓN ---
                // Castiga la repetición de frases
                repetition_penalty: 1.2, 
                // Evita repetir secuencias de 2 palabras idénticas
                no_repeat_ngram_size: 2, 
                // Fuerza al modelo a ser determinista
                temperature: 0,

                // --- PROGRESO EN TIEMPO REAL ---
                callback_function: (items) => {
                    // items es un array con todos los chunks generados hasta ahora.
                    // Enviamos el último para actualizar la barra de progreso.
                    if (items && items.length > 0) {
                        const last = items[items.length - 1];
                        self.postMessage({ status: 'progress', data: last });
                    }
                }
            });

            self.postMessage({ status: 'complete', data: output });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
