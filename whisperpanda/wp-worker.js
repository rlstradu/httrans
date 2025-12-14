// wp-worker.js - Worker de la IA (V3.7 - Model Name Patch)

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
        // El nombre correcto del repo web es 'Xenova/distil-whisper-small.en'
        // Si detectamos que intentan cargar un distil, lo redirigimos al correcto.
        if (selectedModel.includes('distil') && selectedModel.includes('small')) {
            selectedModel = 'Xenova/distil-whisper-small.en';
        }

        // 1. CARGA / CAMBIO DE MODELO
        if (!transcriber || currentModelId !== selectedModel) {
            try {
                if (transcriber) {
                    await transcriber.dispose(); // Liberar memoria
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
            // Los modelos Distil NO soportan 'word' timestamps (causa el error 'slice').
            // Normales -> 'word'
            // Distil -> true (segment level)
            const timestampMode = isDistil ? true : "word"; 
            
            // Distil prefiere chunks más cortos (15s)
            const chunkLength = isDistil ? 15 : 30;
            
            self.postMessage({ status: 'debug', data: `Config: Chunk=${chunkLength}s, Stamps=${timestampMode}` });

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                
                chunk_length_s: chunkLength,
                stride_length_s: 5,
                return_timestamps: timestampMode, // ESTO EVITA EL ERROR 'SLICE'
                
                repetition_penalty: isTiny ? 1.0 : 1.2,
                no_repeat_ngram_size: 2, 
                temperature: 0,

                // Callback de progreso seguro
                callback_function: (items) => {
                    try {
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            let end = 0;
                            
                            if (last.timestamp) {
                                if (Array.isArray(last.timestamp)) end = last.timestamp[1];
                                else if (typeof last.timestamp === 'number') end = last.timestamp;
                            }

                            const cleanData = {
                                text: last.text ? String(last.text).substring(0,60) : "...",
                                timeRef: typeof end === 'number' ? end : 0
                            };
                            self.postMessage({ status: 'progress', data: cleanData });
                        }
                    } catch (e) { }
                }
            });

            // 3. SANITIZACIÓN FINAL
            const cleanChunks = [];
            
            if (output.chunks && Array.isArray(output.chunks)) {
                output.chunks.forEach(chunk => {
                    let start = null;
                    let end = null;
                    
                    // Normalización de timestamps (Array vs Number)
                    if (Array.isArray(chunk.timestamp)) {
                        start = chunk.timestamp[0];
                        end = chunk.timestamp[1];
                    } else if (typeof chunk.timestamp === 'number') {
                        // Si devuelve solo un numero (caso raro), no tenemos start/end claros
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
