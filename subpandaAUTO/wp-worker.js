// wp-worker.js - Worker de la IA (V3.8 - Progress Bar Fix)

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuración para entorno web
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let currentModelId = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message.type === 'run') {
        let selectedModel = message.model || 'Xenova/whisper-small';
        
        // --- AUTO-CORRECCIÓN CRÍTICA DE NOMBRE DE MODELO ---
        if (selectedModel.includes('distil') && selectedModel.includes('small')) {
            selectedModel = 'Xenova/distil-whisper-small.en';
        }

        // 1. CARGA / CAMBIO DE MODELO
        if (!transcriber || currentModelId !== selectedModel) {
            try {
                if (transcriber) {
                    await transcriber.dispose();
                    transcriber = null;
                }
                
                self.postMessage({ status: 'loading' });
                self.postMessage({ status: 'debug', data: `Loading model: ${selectedModel}` });
                
                transcriber = await pipeline('automatic-speech-recognition', selectedModel, {
                    quantized: true,
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
                self.postMessage({ status: 'debug', data: `Model loaded.` });

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

            const isDistil = selectedModel.includes('distil');
            const isTiny = selectedModel.includes('tiny');

            // --- CONFIGURACIÓN CRÍTICA ---
            const timestampMode = isDistil ? true : "word"; 
            const chunkLength = isDistil ? 15 : 30;
            
            self.postMessage({ status: 'debug', data: `Config: Chunk=${chunkLength}s, Stamps=${timestampMode}` });

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                
                chunk_length_s: chunkLength,
                stride_length_s: 5,
                return_timestamps: timestampMode, 
                
                repetition_penalty: isTiny ? 1.0 : 1.2,
                no_repeat_ngram_size: 2, 
                temperature: 0,

                // --- CALLBACK DE PROGRESO BLINDADO ---
                callback_function: (items) => {
                    try {
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            let end = 0;
                            
                            // ESTRATEGIA 1: Timestamp del Chunk (Segmento)
                            if (last.timestamp) {
                                if (Array.isArray(last.timestamp)) end = last.timestamp[1];
                                else if (typeof last.timestamp === 'number') end = last.timestamp;
                            }

                            // ESTRATEGIA 2: Timestamp de la última palabra (Modo 'word')
                            // Si la estrategia 1 falló (end es null o 0) y tenemos palabras...
                            if ((!end || end === 0) && last.words && Array.isArray(last.words) && last.words.length > 0) {
                                const lastWord = last.words[last.words.length - 1];
                                if (lastWord.timestamp) {
                                     if (Array.isArray(lastWord.timestamp)) end = lastWord.timestamp[1];
                                     else if (typeof lastWord.timestamp === 'number') end = lastWord.timestamp;
                                }
                            }

                            // ESTRATEGIA 3: Fallback Matemático (Estimación)
                            // Si todo falla, asumimos que hemos procesado N chunks * duración
                            if ((!end || end === 0) && items.length > 0) {
                                end = items.length * chunkLength; 
                            }

                            // Enviamos el dato limpio
                            const cleanData = {
                                text: last.text ? String(last.text).substring(0,60) : "...",
                                timeRef: typeof end === 'number' ? end : 0
                            };
                            self.postMessage({ status: 'progress', data: cleanData });
                        }
                    } catch (e) { 
                        // Ignoramos errores silenciosamente para no parar la transcripción
                    }
                }
            });

            // 3. SANITIZACIÓN FINAL DEL OUTPUT
            const cleanChunks = [];
            
            if (output.chunks && Array.isArray(output.chunks)) {
                output.chunks.forEach(chunk => {
                    let start = null;
                    let end = null;
                    
                    if (Array.isArray(chunk.timestamp)) {
                        start = chunk.timestamp[0];
                        end = chunk.timestamp[1];
                    } else if (typeof chunk.timestamp === 'number') {
                        end = chunk.timestamp;
                    }
                    
                    cleanChunks.push({
                        text: chunk.text ? String(chunk.text) : "",
                        timestamp: [
                            typeof start === 'number' ? start : null, 
                            typeof end === 'number' ? end : null
                        ]
                    });
                });
            }

            const cleanOutput = {
                text: output.text ? String(output.text) : "",
                chunks: cleanChunks
            };

            self.postMessage({ status: 'complete', data: cleanOutput });

        } catch (err) {
            self.postMessage({ status: 'error', data: "Worker Error: " + err.message });
        }
    }
});
