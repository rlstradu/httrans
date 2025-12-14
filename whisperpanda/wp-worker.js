// wp-worker.js - Worker de la IA (V3.3 - Distil Fix)

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
        if (selectedModel.includes('distil-whisper') || selectedModel.includes('distil-small')) {
            selectedModel = 'Xenova/distil-small.en';
        }

        // 1. CARGA / CAMBIO DE MODELO
        if (!transcriber || currentModelId !== selectedModel) {
            try {
                if (transcriber) {
                    await transcriber.dispose();
                    transcriber = null;
                }
                
                self.postMessage({ status: 'loading' });
                self.postMessage({ status: 'debug', data: `Switching to model: ${selectedModel}` });
                
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

            const isDistil = selectedModel.includes('distil');
            const isTiny = selectedModel.includes('tiny');

            // --- CONFIGURACIÓN DINÁMICA ---
            // Distil: 15s chunk, timestamps por segmento (TRUE) para evitar crash
            // Normal: 30s chunk, timestamps por palabra ("word") para máxima precisión
            const chunkLength = isDistil ? 15 : 30;
            const timestampMode = isDistil ? true : "word"; 
            const repetitionPenalty = isTiny ? 1.0 : 1.2;

            self.postMessage({ status: 'debug', data: `Config: Chunk=${chunkLength}s, Stamps=${timestampMode}, RepPen=${repetitionPenalty}` });

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                
                chunk_length_s: chunkLength,
                stride_length_s: 5,
                return_timestamps: timestampMode, // AQUÍ ESTABA EL ERROR
                
                repetition_penalty: repetitionPenalty,
                no_repeat_ngram_size: 2, 
                temperature: 0,

                callback_function: (items) => {
                    try {
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            let end = 0;
                            
                            // Extracción segura del tiempo final para la barra
                            if (last.timestamp) {
                                if (Array.isArray(last.timestamp)) end = last.timestamp[1];
                                else if (typeof last.timestamp === 'number') end = last.timestamp;
                            }

                            // Sanitización de datos
                            const cleanData = {
                                text: last.text ? String(last.text) : "",
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
                    
                    if (Array.isArray(chunk.timestamp)) {
                        start = chunk.timestamp[0];
                        end = chunk.timestamp[1];
                    }
                    
                    // Aseguramos números
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
            self.postMessage({ status: 'error', data: "Transcription error: " + err.message });
        }
    }
});
