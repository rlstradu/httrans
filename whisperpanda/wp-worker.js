// wp-worker.js - Worker de la IA (V3.0 - Multi-Modelo & Word Timestamps)

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configuración importante para entorno web
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let currentModelId = null;

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message.type === 'run') {
        const selectedModel = message.model || 'Xenova/whisper-small'; // Modelo por defecto
        
        // 1. CARGA / CAMBIO DE MODELO
        if (!transcriber || currentModelId !== selectedModel) {
            try {
                // Si cambiamos de modelo, liberamos el anterior
                transcriber = null; 
                
                self.postMessage({ status: 'loading' });
                self.postMessage({ status: 'debug', data: `Switching/Loading model: ${selectedModel}` });
                
                // Inicializamos el pipeline
                transcriber = await pipeline('automatic-speech-recognition', selectedModel, {
                    quantized: true,
                    // Callback para informar del progreso de la descarga
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
                self.postMessage({ status: 'debug', data: `Model ${selectedModel} loaded successfully.` });

            } catch (err) {
                self.postMessage({ status: 'error', data: "Error loading model: " + err.message });
                return;
            }
        }

        // 2. EJECUCIÓN
        try {
            self.postMessage({ status: 'initiate' });

            const audio = message.audio;
            // Si es 'spotting', usamos 'transcribe' internamente
            const taskToRun = message.task === 'spotting' ? 'transcribe' : (message.task || 'transcribe');

            // Ajuste automático de parámetros según modelo
            // Tiny necesita menos penalización para no quedarse mudo
            const repetitionPenalty = selectedModel.includes('tiny') ? 1.0 : 1.2;

            const output = await transcriber(audio, {
                language: message.language,
                task: taskToRun,
                
                // Segmentación
                chunk_length_s: 30,
                stride_length_s: 5,
                // IMPORTANTE: Pedimos timestamps por palabra para el algoritmo V5
                return_timestamps: "word", 
                
                // Estabilidad
                repetition_penalty: repetitionPenalty,
                no_repeat_ngram_size: 2, 
                temperature: 0,

                // Progreso en tiempo real (Sanitizado)
                callback_function: (items) => {
                    try {
                        if (items && items.length > 0) {
                            const last = items[items.length - 1];
                            let start = 0;
                            let end = 0;
                            
                            // Extracción segura de timestamps
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
                                timeRef: end // Enviamos solo la referencia de fin para la barra
                            };
                            self.postMessage({ status: 'progress', data: cleanData });
                        }
                    } catch (e) { 
                        // Ignoramos errores de progreso para no detener la transcripción
                    }
                }
            });

            // 3. SANITIZACIÓN FINAL (Crucial para evitar error de clonación)
            // Reconstruimos el objeto chunk a chunk asegurando tipos primitivos
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
