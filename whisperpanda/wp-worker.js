// wp-worker.js - Worker de la IA

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// Configuración importante para web
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    // --- ACCIÓN: RUN ---
    if (message.type === 'run') {
        
        // 1. Cargar Modelo
        if (!transcriber) {
            try {
                self.postMessage({ status: 'loading' });
                // Whisper Tiny Quantized es el mejor para navegador
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                    quantized: true,
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
            // Si es 'spotting', forzamos 'transcribe' para detectar voz. Luego el UI borra el texto.
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
            });

            self.postMessage({ status: 'complete', data: output });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
