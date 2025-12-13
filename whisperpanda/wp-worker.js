// wp-worker.js - Worker de la IA (Versión Anti-Alucinaciones)

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
                // CAMBIO: Usamos 'whisper-base' en lugar de 'tiny'. 
                // Es más robusto contra alucinaciones y bucles.
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
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
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                // PARÁMETROS ANTI-BUCLE
                no_repeat_ngram_size: 2, // Evita repetir frases cortas
                temperature: 0, // Fuerza a la IA a ser más determinista
            });

            self.postMessage({ status: 'complete', data: output });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
