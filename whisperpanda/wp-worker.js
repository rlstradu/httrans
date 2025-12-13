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
                // Es el equilibrio perfecto: evita los bucles locos del 'tiny' pero sigue siendo ligero (~80MB).
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
                    quantized: true,
                    // Callback para informar del progreso de la descarga del modelo
                    progress_callback: (data) => {
                        // Data tiene { status: 'progress', file: '...', progress: 0-100 }
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
            // Si la tarea es 'spotting', forzamos 'transcribe' internamente para detectar voz.
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            const output = await transcriber(audio, {
                // Parámetros básicos
                language: message.language,
                task: taskToRun,
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                
                // --- PARÁMETROS ANTI-ALUCINACIÓN Y ANTI-BUCLE ---
                // no_repeat_ngram_size: 2 -> Evita que repita frases cortas idénticas
                no_repeat_ngram_size: 2, 
                // temperature: 0 -> Hace al modelo más determinista y menos "creativo" (menos invenciones)
                temperature: 0,

                // --- PROGRESO EN TIEMPO REAL ---
                callback_function: (items) => {
                    // items es un array con los chunks generados hasta el momento.
                    // Enviamos el último para que el UI sepa por qué segundo vamos.
                    const last = items[items.length - 1];
                    if (last) {
                        self.postMessage({ status: 'progress', data: last });
                    }
                }
            });

            // 3. ¡Terminado!
            self.postMessage({ status: 'complete', data: output });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
