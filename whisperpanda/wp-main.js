// wp-main.js - Lógica principal de WhisperPanda

const translations = {
    en: {
        backLink: "Back to HTTrans",
        heroDesc: "AI-powered automatic transcription and subtitling tool.",
        privacyBadge: "100% Private: Files never leave your device",
        settingsTitle: "Assistant Preferences",
        audioLangLabel: "Audio Language",
        audioLangHelp: "Manually selecting the language improves accuracy and speed.",
        optAuto: "✨ Detect automatically",
        actionLabel: "Action",
        optTranscribe: "Transcribe (Keep original language)",
        optTranslate: "Translate (Convert audio to English)",
        optSpotting: "Spotting (Empty subtitles)",
        gapLabel: "Min. Gap",
        unitFrames: "Frames",
        unitMs: "ms",
        minDurLabel: "Min Duration (s)",
        maxDurLabel: "Max Duration (s)",
        maxLinesLabel: "Max Lines",
        cplLabel: "Max chars/line (CPL)",
        punctuationLabel: "Force break on punctuation",
        dontBreakLabel: "Do not end line on (Prepositions)",
        dropTitle: "Click or drag your file here",
        dropSubtitle: "Supports MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>Heads up!</strong> This file is large (>500MB). The browser might slow down. We recommend extracting audio to MP3 first if you experience issues.",
        startBtn: "Start",
        startBtnProcessing: "Processing audio (Wait)...",
        statusLoading: "Loading AI model (~80MB, only first time)...", 
        statusInitiating: "Initiating transcription...",
        statusListening: "The Panda is listening...",
        statusComplete: "Completed!",
        statusGenerating: "Generating subtitles...",
        resultTitle: "Result",
        copyBtn: "Copy",
        copiedBtn: "Copied!",
        saveSrtBtn: "Save SRT",
        saveTxtBtn: "Save TXT",
        resultFooter: "Remember to check subtitles in a professional tool (like Subpanda or EZTitles) for fine-tuning.",
        errorMsg: "Error processing audio. Ensure it's a valid format.",
        downloadModel: "Downloading Whisper Base (~80MB)...", 
        dontBreakDefaults: "of, to, in, for, with, on, at, by, from, about, as, into, like, through, after, over, between, out, against, during, without, before, under, around, among"
    },
    es: {
        backLink: "Volver a HTTrans",
        heroDesc: "Herramienta de transcripción y subtitulado automático impulsada por IA.",
        privacyBadge: "100% Privado: Tus archivos nunca salen de tu dispositivo",
        settingsTitle: "Ajustes del asistente",
        audioLangLabel: "Idioma del audio",
        audioLangHelp: "Seleccionar el idioma manualmente mejora la precisión y velocidad.",
        optAuto: "✨ Detectar automáticamente",
        actionLabel: "Acción",
        optTranscribe: "Transcribir (Mantener idioma original)",
        optTranslate: "Traducir (Convertir audio al Inglés)",
        optSpotting: "Spotting (Subtítulos vacíos)",
        gapLabel: "Intervalo Mín.",
        unitFrames: "Frames",
        unitMs: "ms",
        minDurLabel: "Duración Mín. (s)",
        maxDurLabel: "Duración Máx. (s)",
        maxLinesLabel: "Máx. Líneas",
        cplLabel: "Máx. caracteres/línea (CPL)",
        punctuationLabel: "Forzar corte en puntuación",
        dontBreakLabel: "No terminar línea en (Preposiciones)",
        dropTitle: "Haz clic o arrastra tu archivo aquí",
        dropSubtitle: "Soporta MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>¡Ojo!</strong> Este archivo es grande (>500MB). El navegador podría ir lento. Recomendamos extraer el audio a MP3 antes de subirlo si experimentas problemas.",
        startBtn: "Iniciar",
        startBtnProcessing: "Procesando audio (Espere)...",
        statusLoading: "Cargando modelo de IA (~80MB, solo pasa la primera vez)...", 
        statusInitiating: "Iniciando transcripción...",
        statusListening: "El Panda está escuchando...",
        statusComplete: "¡Completado!",
        statusGenerating: "Generando subtítulos...",
        resultTitle: "Resultado",
        copyBtn: "Copiar",
        copiedBtn: "¡Copiado!",
        saveSrtBtn: "Guardar SRT",
        saveTxtBtn: "Guardar TXT",
        resultFooter: "Recuerda revisar los subtítulos en una herramienta profesional (como Subpanda o EZTitles) para el ajuste fino de tiempos.",
        errorMsg: "No se pudo procesar el audio. Asegúrate de que es un formato válido.",
        downloadModel: "Descargando Whisper Base (~80MB)...", 
        dontBreakDefaults: "a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, el, la, los, las, un, una, unos, unas"
    }
};

let currentLang = 'en';
let audioData = null;
let rawFileName = "subtitulos";
let audioDuration = 0; // Duración total para calcular %
let worker = new Worker('wp-worker.js', { type: 'module' });

const els = {
    langEn: document.getElementById('lang-en'),
    langEs: document.getElementById('lang-es'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    fileInfo: document.getElementById('file-info'),
    fileName: document.getElementById('file-name'),
    removeFile: document.getElementById('remove-file'),
    warning: document.getElementById('file-warning'),
    runBtn: document.getElementById('run-btn'),
    progressCont: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percentage'),
    statusText: document.getElementById('status-text'),
    detailText: document.getElementById('detail-text'),
    consoleOutput: document.getElementById('console-output'),
    resultsArea: document.getElementById('results-area'),
    outputText: document.getElementById('output-text'),
    dlSrt: document.getElementById('download-srt-btn'),
    dlTxt: document.getElementById('download-txt-btn'),
    copy: document.getElementById('copy-btn'),
    dontBreakInput: document.getElementById('dont-break-on')
};

// --- UTILS CONSOLA ---
function logToConsole(msg) {
    if (!els.consoleOutput) return;
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    div.className = "hover:bg-gray-800 px-1 rounded";
    els.consoleOutput.appendChild(div);
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

function updateProgress(percent) {
    const p = Math.min(100, Math.max(0, percent.toFixed(1)));
    if(els.progressBar) els.progressBar.style.width = `${p}%`;
    if(els.progressPercent) els.progressPercent.innerText = `${p}%`;
}

// --- IDIOMA ---
function setLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];

    if (lang === 'en') {
        els.langEn.classList.add('active');
        els.langEs.classList.remove('active');
    } else {
        els.langEs.classList.add('active');
        els.langEn.classList.remove('active');
    }

    document.querySelectorAll('[data-key]').forEach(el => {
        if (t[el.dataset.key]) el.innerHTML = t[el.dataset.key];
    });

    if (els.runBtn.disabled && !audioData) {
        els.runBtn.querySelector('span').innerText = t.startBtn;
    } else if (!els.runBtn.disabled) {
        els.runBtn.querySelector('span').innerText = t.startBtn;
    }

    els.dontBreakInput.value = t.dontBreakDefaults;
}

els.langEn.addEventListener('click', () => setLanguage('en'));
els.langEs.addEventListener('click', () => setLanguage('es'));

// --- ARCHIVOS ---
function resetFile() {
    audioData = null;
    audioDuration = 0;
    els.fileInput.value = '';
    els.fileInfo.classList.add('hidden');
    els.warning.classList.add('hidden');
    els.runBtn.disabled = true;
    els.runBtn.querySelector('span').innerText = translations[currentLang].startBtn;
    // Reset consola
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> System ready...</div>';
    updateProgress(0);
}

async function handleFile(file) {
    resetFile();
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');

    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden');

    els.runBtn.querySelector('span').innerText = t.startBtnProcessing;
    logToConsole(`File loaded: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`);
    logToConsole("Decoding audio...");
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer.getChannelData(0);
        audioDuration = audioBuffer.duration;
        
        logToConsole(`Audio decoded successfully. Duration: ${fmtTime(audioDuration)}`);
        els.runBtn.disabled = false;
        els.runBtn.querySelector('span').innerText = t.startBtn;
    } catch (err) {
        console.error(err);
        logToConsole(`ERROR: ${err.message}`);
        alert(t.errorMsg);
        resetFile();
    }
}

els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-[#E23B5D]', 'bg-pink-50'); });
els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#E23B5D]', 'bg-pink-50'); });
els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('border-[#E23B5D]', 'bg-pink-50');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
els.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
els.removeFile.addEventListener('click', (e) => { e.stopPropagation(); resetFile(); });

// --- WORKER COMMS ---
worker.onmessage = (e) => {
    const { status, data } = e.data;
    const t = translations[currentLang];

    if (status === 'loading') {
        // Data puede traer progreso de descarga del modelo
        if (data && data.status === 'progress') {
            els.statusText.innerText = `${t.statusLoading} (${Math.round(data.progress)}%)`;
            // Log solo cada 10% para no saturar consola
            if(Math.round(data.progress) % 10 === 0) {
                logToConsole(`Downloading model: ${data.file} - ${Math.round(data.progress)}%`);
            }
        } else {
            els.statusText.innerText = t.statusLoading;
            logToConsole("Loading AI Model...");
        }
        els.detailText.innerText = t.downloadModel;
    
    } else if (status === 'initiate') {
        els.statusText.innerText = t.statusInitiating;
        updateProgress(0);
        logToConsole("Starting transcription engine...");
    
    } else if (status === 'progress') {
        // PROGRESO EN TIEMPO REAL
        // data contiene los chunks parciales. Usamos el timestamp del último chunk.
        if (data && data.timestamp && audioDuration > 0) {
            const currentSeconds = data.timestamp[1]; // Fin del último chunk
            if (currentSeconds) {
                const percent = (currentSeconds / audioDuration) * 100;
                updateProgress(percent);
                els.statusText.innerText = `${t.statusListening} (${Math.round(percent)}%)`;
                
                // Mostrar texto parcial en consola
                if (data.text) {
                    // Limpiamos texto para log
                    const clean = data.text.trim();
                    if(clean.length > 0) logToConsole(`[${fmtTime(data.timestamp[0])}] ${clean.substring(0, 50)}...`);
                }
            }
        }

    } else if (status === 'complete') {
        updateProgress(100);
        els.statusText.innerText = t.statusComplete;
        logToConsole("Transcription finished. Refining subtitles...");
        els.detailText.innerText = t.statusGenerating;
        processResults(data);
    
    } else if (status === 'error') {
        logToConsole(`ERROR: ${data}`);
        alert("Error: " + data);
        els.runBtn.disabled = false;
    }
};

els.runBtn.addEventListener('click', () => {
    if (!audioData) return;
    els.runBtn.disabled = true;
    els.resultsArea.classList.add('hidden');
    els.resultsArea.classList.remove('opacity-100');
    els.progressCont.classList.remove('hidden');
    updateProgress(0);
    if(els.consoleOutput) els.consoleOutput.innerHTML = ''; // Limpiar consola anterior
    logToConsole("Initializing...");

    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    
    worker.postMessage({
        type: 'run',
        audio: audioData,
        language: langSelect === 'auto' ? null : langSelect,
        task: task
    });
});

// --- LÓGICA DE PROCESAMIENTO (Con Filtros de Alucinación) ---
function processResults(output) {
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    let minGap = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;
    const task = document.getElementById('task-select').value;

    const minDur = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDur = parseFloat(document.getElementById('max-duration').value) || 6.0;

    const options = {
        maxLines: parseInt(document.getElementById('max-lines').value),
        maxCPL: parseInt(document.getElementById('max-cpl').value),
        endPunctuation: document.getElementById('end-punctuation').value,
        dontBreakOn: document.getElementById('dont-break-on').value,
        minGap: minGap,
        minDur: minDur,
        maxDur: maxDur
    };

    let segments = refineSubtitles(output.chunks, options);
    segments = applyDurationConstraints(segments, options);

    if (task === 'spotting') {
        segments.forEach(s => s.text = "");
    }

    const srt = generateSRT(segments);

    els.outputText.value = srt;
    els.resultsArea.classList.remove('hidden');
    setTimeout(() => {
        els.resultsArea.classList.add('opacity-100');
        els.resultsArea.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setupDownloads(srt, segments);
}

function refineSubtitles(chunks, opts) {
    const refined = [];
    let lastText = "";
    
    chunks.forEach(chunk => {
        let text = chunk.text.trim().replace(/\s+/g, ' ');
        if (!text) return;

        // Limpieza de alucinaciones
        text = removeHallucinations(text);
        if (text.length === 0) return;

        // Filtro de duplicados consecutivos
        // Whisper a veces saca dos chunks seguidos con el mismo texto
        if (text.toLowerCase() === lastText.toLowerCase()) return;
        lastText = text;

        let start = chunk.timestamp[0];
        let end = chunk.timestamp[1] || (start + text.length * 0.05);

        const limit = opts.maxCPL * opts.maxLines;
        const duration = end - start;
        
        if (text.length > limit || duration > opts.maxDur) {
            const mid = Math.floor(text.length / 2);
            const splitIdx = text.lastIndexOf(' ', mid);
            if (splitIdx !== -1) {
                const p1 = text.substring(0, splitIdx).trim();
                const p2 = text.substring(splitIdx).trim();
                const splitTime = start + ((end - start) * (p1.length / text.length));
                refined.push({ text: formatLines(p1, opts), start, end: splitTime });
                refined.push({ text: formatLines(p2, opts), start: splitTime, end });
                return;
            }
        }
        refined.push({ text: formatLines(text, opts), start, end });
    });
    return refined;
}

// NUEVA: Función potente para limpiar alucinaciones típicas de Whisper
function removeHallucinations(text) {
    // 1. Detectar repeticiones de palabras sueltas "of of of of"
    const words = text.split(' ');
    if (words.length > 4) {
        const unique = new Set(words.map(w => w.toLowerCase()));
        // Si hay muchas palabras pero muy poca variedad (ej: "a more of a more"), es basura
        if (unique.size < 3 && words.length > 6) {
            logToConsole(`WARN: Removed repetitive garbage: "${text}"`);
            return "";
        }
    }

    // 2. Detectar patrones repetitivos internos (n-grams)
    // Ej: "and then I went and then I went"
    if (text.length > 20) {
        const half = Math.floor(text.length / 2);
        const firstHalf = text.substring(0, half).trim();
        const secondHalf = text.substring(half).trim();
        // Si la segunda mitad es casi igual a la primera
        if (secondHalf.includes(firstHalf) || firstHalf.includes(secondHalf)) {
             // Devolvemos solo una copia
             return firstHalf;
        }
    }

    // 3. Palabras prohibidas solas (alucinaciones comunes en silencio)
    const hallucinations = ['Subtitle by', 'Amara.org', 'music', 'Music', 'Silence', 'Y', 'y', '[Music]'];
    if (hallucinations.includes(text.trim())) return "";

    return text;
}

function applyDurationConstraints(segs, opts) {
    // 1. Mínima
    for (let i = 0; i < segs.length; i++) {
        let cur = segs[i];
        if ((cur.end - cur.start) < opts.minDur) {
            let newEnd = cur.start + opts.minDur;
            if (i < segs.length - 1) {
                let nextStart = segs[i+1].start;
                if (newEnd > nextStart - opts.minGap) {
                    newEnd = nextStart - opts.minGap;
                }
            }
            if (newEnd > cur.end) cur.end = newEnd;
        }
    }
    // 2. Gap
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i+1].start - segs[i].end < opts.minGap) {
            const newEnd = segs[i+1].start - opts.minGap;
            if (newEnd > segs[i].start + 0.1) segs[i].end = newEnd;
        }
    }
    return segs;
}

function formatLines(text, opts) {
    if (text.length <= opts.maxCPL) return text;
    if (opts.maxLines >= 2) {
        const mid = Math.floor(text.length / 2);
        const before = text.lastIndexOf(' ', mid);
        const after = text.indexOf(' ', mid);
        let idx = (before === -1) ? after : (after === -1) ? before : (mid - before < after - mid ? before : after);

        if (idx !== -1) {
            let l1 = text.substring(0, idx);
            let l2 = text.substring(idx + 1);
            const lastWord = l1.split(' ').pop().toLowerCase();
            const forbidden = opts.dontBreakOn.split(',').map(s => s.trim().toLowerCase());
            if (forbidden.includes(lastWord)) {
                l2 = lastWord + ' ' + l2;
                l1 = l1.substring(0, l1.lastIndexOf(' '));
            }
            return l1 + '\n' + l2;
        }
    }
    return text;
}

function generateSRT(segs) {
    return segs.map((s, i) => `${i+1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}\n`).join('\n');
}

function fmtTime(s) {
    if (!s) return "00:00:00,000";
    const d = new Date(s * 1000);
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')},${String(d.getUTCMilliseconds()).padStart(3,'0')}`;
}

function setupDownloads(srt, segs) {
    const t = translations[currentLang];
    els.dlSrt.onclick = () => download(srt, `${rawFileName}_subpanda.srt`);
    const cleanTxt = segs.map(s => s.text.replace(/\n/g, ' ')).join(' ');
    els.dlTxt.onclick = () => download(cleanTxt, `${rawFileName}.txt`);
    els.copy.onclick = () => {
        navigator.clipboard.writeText(srt);
        const orig = els.copy.querySelector('span').innerHTML;
        els.copy.querySelector('span').innerHTML = t.copiedBtn;
        setTimeout(() => els.copy.querySelector('span').innerHTML = orig, 2000);
    };
}

function download(content, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'}));
    a.download = name;
    a.click();
}

const obs = new MutationObserver((muts) => {
    muts.forEach((m) => {
        if (m.type === "attributes" && m.attributeName === "disabled") {
            if (!els.runBtn.disabled) {
                els.runBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
                els.runBtn.classList.add('bg-[#E23B5D]', 'hover:bg-[#c0304d]', 'hover:scale-[1.02]', 'cursor-pointer');
            } else {
                els.runBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
                els.runBtn.classList.remove('bg-[#E23B5D]', 'hover:bg-[#c0304d]', 'hover:scale-[1.02]', 'cursor-pointer');
            }
        }
    });
});
obs.observe(els.runBtn, { attributes: true });

setLanguage('en');
