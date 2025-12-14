// wp-worker.js - Worker de la IA (V3.2 - Multi-Modelo & Auto-Fix)

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuración importante para entorno web
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let currentModelId = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message.type === 'run') {
        let selectedModel = message.model || 'Xenova/whisper-small';
        
        // --- AUTO-CORRECCIÓN DE NOMBRE DE MODELO ---
        // Algunos IDs de HuggingFace cambian en la versión web (Xenova).
        // Este parche asegura que si seleccionas el Distil, cargue el correcto.
        if (selectedModel.includes('distil-whisper') || selectedModel.includes('distil-small')) {
            selectedModel = 'Xenova/distil-small.en';
        }

        // 1. CARGA / CAMBIO DE MODELO
        if (!transcriber || currentModelId !== selectedModel) {
            try {
                // Liberar memoria del modelo anterior
                if (transcriber) {
                    await transcriber.dispose();
                    transcriber = null;
                }
                
                self.postMessage({ status: 'loading' });
                self.postMessage({ status: 'debug', data: `Switching to model: ${selectedModel}` });
                
                transcriber = await pipeline('automatic-speech-recognition', selectedModel, {
                    quantized: true,
                    // Callback de descarga
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            self.postMessage({ 
                                status: 'loading', 
                                data: { file: data.file, progress: data.progress, status: data.status } 
                            });
                        }
                    }
                });
                
                currentModelId = selectedModel;
                self.postMessage({ status: 'debug', data: `Model loaded successfully.` });

            } catch (err) {
                self.postMessage({ status: 'error', data: `Error loading ${selectedModel}: ` + err.message });
                return;
            }
        }

        // 2. EJECUCIÓN
        try {
            self.postMessage({ status: 'initiate' });

            const audio = message.audio;
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            // Ajustes específicos por modelo
            const isDistil = selectedModel.includes('distil');
            const isTiny = selectedModel.includes('tiny');

            // Distil-Whisper funciona mejor con chunks de 15s (vs 30s estándar)
            const chunkLength = isDistil ? 15 : 30;
            
            // Tiny necesita menos penalización para no quedarse mudo en silencios
            const repetitionPenalty = isTiny ? 1.0 : 1.2;

            self.postMessage({ status: 'debug', data: `Config: Chunk=${chunkLength}s, RepPen=${repetitionPenalty}` });

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                
                // Segmentación
                chunk_length_s: chunkLength,
                stride_length_s: 5,
                // IMPORTANTE: Timestamps por palabra para el algoritmo V5
                return_timestamps: "word", 
                
                // Estabilidad
                repetition_penalty: repetitionPenalty,
                no_repeat_ngram_size: 2, 
                temperature: 0,

                // Progreso en tiempo real (Sanitizado para evitar error de clonación)
                callback_function: (items) => {
                    try {
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            let start = 0;
                            let end = 0;
                            
                            if (last.timestamp) {
                                if (Array.isArray(last.timestamp)) {
                                    start = typeof last.timestamp[0] === 'number' ? last.timestamp[0] : 0;
                                    end = typeof last.timestamp[1] === 'number' ? last.timestamp[1] : 0;
                                } else if (typeof last.timestamp === 'number') {
                                    end = last.timestamp;
                                }
                            }

                            const cleanData = {
                                text: last.text ? String(last.text) : "",
                                timeRef: end 
                            };
                            self.postMessage({ status: 'progress', data: cleanData });
                        }
                    } catch (e) { 
                        // Ignorar errores de progreso
                    }
                }
            });

            // 3. SANITIZACIÓN FINAL DEL OUTPUT
            // Reconstruimos el objeto para asegurar que solo enviamos datos puros
            const cleanChunks = [];
            
            if (output.chunks && Array.isArray(output.chunks)) {
                output.chunks.forEach(chunk => {
                    let start = null;
                    let end = null;
                    
                    if (Array.isArray(chunk.timestamp)) {
                        start = typeof chunk.timestamp[0] === 'number' ? chunk.timestamp[0] : null;
                        end = typeof chunk.timestamp[1] === 'number' ? chunk.timestamp[1] : null;
                    }
                    
                    cleanChunks.push({
                        text: chunk.text ? String(chunk.text) : "",
                        timestamp: [start, end]
                    });
                });
            }

            const cleanOutput = {
                text: output.text ? String(output.text) : "",
                chunks: cleanChunks
            };

            self.postMessage({ status: 'complete', data: cleanOutput });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
