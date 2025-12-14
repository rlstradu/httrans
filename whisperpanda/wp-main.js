// wp-main.js - Lógica principal de WhisperPanda (V3.0 - Matrix Console & ETA)

const translations = {
    en: {
        backLink: "Back to HTTrans",
        heroDesc: "AI-powered automatic transcription and subtitling tool.",
        privacyBadge: "100% Private: Files never leave your device",
        settingsTitle: "Assistant Preferences",
        audioLangLabel: "Audio Language",
        audioLangHelp: "Manually selecting the language improves accuracy and speed.",
        modelLabel: "AI Model / Quality",
        modelHelp: "Use 'Small' for best accuracy or 'Tiny' for speed.",
        optTiny: "Tiny (Fastest - ~40MB)",
        optBase: "Base (Balanced - ~80MB)",
        optSmall: "Small (High Quality - ~250MB)",
        optDistil: "Distil-Small (English Only - ⚡ Ultra Fast)",
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
        statusLoading: "Loading AI model...", 
        statusInitiating: "Initiating transcription...",
        statusListening: "Processing audio...", 
        statusComplete: "Completed!",
        statusGenerating: "Generating subtitles...",
        resultTitle: "Result",
        copyBtn: "Copy",
        copiedBtn: "Copied!",
        saveSrtBtn: "Save SRT",
        saveTxtBtn: "Save TXT",
        resultFooter: "Remember to check subtitles in a professional tool (like Subpanda or EZTitles) for fine-tuning.",
        errorMsg: "Error processing audio. Ensure it's a valid format.",
        downloadModel: "Downloading AI Model...", 
        dontBreakDefaults: "of, to, in, for, with, on, at, by, from, about, as, into, like, through, after, over, between, out, against, during, without, before, under, around, among"
    },
    es: {
        backLink: "Volver a HTTrans",
        heroDesc: "Herramienta de transcripción y subtitulado automático impulsada por IA.",
        privacyBadge: "100% Privado: Tus archivos nunca salen de tu dispositivo",
        settingsTitle: "Ajustes del asistente",
        audioLangLabel: "Idioma del audio",
        audioLangHelp: "Seleccionar el idioma manualmente mejora la precisión y velocidad.",
        modelLabel: "Modelo IA / Calidad",
        modelHelp: "Usa 'Small' para mejor precisión o 'Tiny' para velocidad.",
        optTiny: "Tiny (Ultra Rápido - ~40MB)",
        optBase: "Base (Equilibrado - ~80MB)",
        optSmall: "Small (Alta Calidad - ~250MB)",
        optDistil: "Distil-Small (Solo Inglés - ⚡ Ultra Rápido)",
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
        statusLoading: "Cargando modelo de IA...", 
        statusInitiating: "Iniciando transcripción...",
        statusListening: "Procesando audio...", 
        statusComplete: "¡Completado!",
        statusGenerating: "Generando subtítulos...",
        resultTitle: "Resultado",
        copyBtn: "Copiar",
        copiedBtn: "¡Copiado!",
        saveSrtBtn: "Guardar SRT",
        saveTxtBtn: "Guardar TXT",
        resultFooter: "Recuerda revisar los subtítulos en una herramienta profesional (como Subpanda o EZTitles) para el ajuste fino de tiempos.",
        errorMsg: "No se pudo procesar el audio. Asegúrate de que es un formato válido.",
        downloadModel: "Descargando Modelo IA...", 
        dontBreakDefaults: "a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, el, la, los, las, un, una, unos, unas"
    }
};

let currentLang = 'en';
let audioData = null;
let rawFileName = "subtitulos";
let audioDuration = 0;
// Variables para el cálculo de tiempo
let startTime = 0;
let lastConsoleLine = null; 

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

// --- CONSOLA INTELIGENTE ---
function logToConsole(msg, isProgress = false) {
    if (!els.consoleOutput) return;
    
    // Si no es una actualización de progreso, rompemos la referencia a la última línea
    // para que la siguiente actualización cree una nueva
    if (!isProgress) lastConsoleLine = null;

    const div = document.createElement('div');
    if (typeof msg === 'object') div.innerText = `> ${JSON.stringify(msg)}`;
    else div.innerText = `> ${msg}`;
    
    div.className = "hover:bg-gray-800 px-1 rounded font-mono text-xs";
    els.consoleOutput.appendChild(div);
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

// Función para actualizar la última línea (Efecto barra de progreso en vivo)
function updateConsoleLine(msg) {
    if (!els.consoleOutput) return;
    
    // Si tenemos una línea activa y sigue en el DOM, la sobrescribimos
    if (lastConsoleLine && lastConsoleLine.isConnected) {
        lastConsoleLine.innerText = `> ${msg}`;
    } else {
        // Si no, creamos una nueva
        const div = document.createElement('div');
        div.innerText = `> ${msg}`;
        div.className = "hover:bg-gray-800 px-1 rounded text-green-300 font-bold font-mono text-xs";
        els.consoleOutput.appendChild(div);
        lastConsoleLine = div;
    }
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}

// Generador de barra ASCII
function getAsciiBar(percent) {
    const width = 20; // Ancho de la barra en caracteres
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    // Carácter lleno '=' y flecha '>', vacío '.'
    const bar = "[" + "=".repeat(filled) + ">".repeat(filled < width ? 1 : 0) + ".".repeat(Math.max(0, empty - (filled < width ? 1 : 0))) + "]";
    return bar;
}

function fmtDuration(seconds) {
    if(!seconds || seconds < 0) return "Calc...";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
}

// --- IDIOMA ---
function setLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];

    if (lang === 'en') { els.langEn.classList.add('active'); els.langEs.classList.remove('active'); } 
    else { els.langEs.classList.add('active'); els.langEn.classList.remove('active'); }
    
    document.querySelectorAll('[data-key]').forEach(el => {
        if (t[el.dataset.key]) el.innerHTML = t[el.dataset.key];
    });

    const modelSelect = document.getElementById('model-select');
    if(modelSelect) {
        modelSelect.options[0].text = t.optTiny;
        modelSelect.options[1].text = t.optBase;
        modelSelect.options[2].text = t.optSmall;
        if(modelSelect.options[3]) modelSelect.options[3].text = t.optDistil;
    }

    if (els.runBtn.disabled && !audioData) els.runBtn.querySelector('span').innerText = t.startBtn;
    else if (!els.runBtn.disabled) els.runBtn.querySelector('span').innerText = t.startBtn;
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
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> Panda Terminal v3.0 Ready...</div>';
}

async function handleFile(file) {
    resetFile();
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');
    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden');
    els.runBtn.querySelector('span').innerText = t.startBtnProcessing;
    logToConsole(`File loaded: ${file.name}`);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer.getChannelData(0);
        audioDuration = audioBuffer.duration;
        logToConsole(`Audio decoded. Duration: ${fmtDuration(audioDuration)}`);
        els.runBtn.disabled = false;
        els.runBtn.querySelector('span').innerText = t.startBtn;
    } catch (err) {
        logToConsole(`ERROR: ${err.message}`);
        resetFile();
    }
}
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-[#E23B5D]', 'bg-pink-50'); });
els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#E23B5D]', 'bg-pink-50'); });
els.dropZone.addEventListener('drop', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#E23B5D]', 'bg-pink-50'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
els.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
els.removeFile.addEventListener('click', (e) => { e.stopPropagation(); resetFile(); });

// --- WORKER COMMS ---
worker.onmessage = (e) => {
    const { status, data } = e.data;
    const t = translations[currentLang];

    if (status === 'debug') {
        logToConsole(data);
    } 
    else if (status === 'loading') {
        if (data && data.status === 'progress') {
            const percent = Math.round(data.progress || 0);
            // Actualizamos la misma línea para la descarga
            // data.file a veces trae ruta larga, limpiamos
            const fileName = data.file ? data.file.split('/').pop() : "Model";
            updateConsoleLine(`Downloading ${fileName}: ${getAsciiBar(percent)} ${percent}%`);
            els.statusText.innerText = `${t.statusLoading} (${percent}%)`;
        } else {
            els.statusText.innerText = t.statusLoading;
        }
    } 
    else if (status === 'initiate') {
        els.statusText.innerText = t.statusInitiating;
        // Rompemos la línea anterior para empezar logs nuevos
        lastConsoleLine = null;
        logToConsole("Initializing Whisper Engine...");
        startTime = Date.now(); // Arrancamos el cronómetro
    } 
    else if (status === 'progress') {
        if (data && data.timeRef && audioDuration > 0) {
            const current = data.timeRef;
            const percent = Math.min(100, Math.max(0, (current / audioDuration) * 100));
            
            // CÁLCULO DE ETA (Tiempo Restante)
            const elapsed = (Date.now() - startTime) / 1000; // segundos pasados
            let etaText = "Calc...";
            
            // Esperamos unos segundos para estabilizar el cálculo
            if (elapsed > 2 && percent > 1) { 
                const rate = current / elapsed; // segundos de audio procesados por segundo real
                const remainingAudio = audioDuration - current;
                const estimatedSecondsLeft = remainingAudio / rate;
                etaText = fmtDuration(estimatedSecondsLeft);
            }

            els.statusText.innerText = `${t.statusListening} ${Math.round(percent)}% (ETA: ${etaText})`;
            
            // Actualizar línea de consola con Barra y ETA
            updateConsoleLine(`${getAsciiBar(percent)} ${Math.round(percent)}% | ETA: ${etaText}`);
        }
    } 
    else if (status === 'complete') {
        els.statusText.innerText = t.statusComplete;
        lastConsoleLine = null; // Romper la línea de progreso
        updateConsoleLine(`${getAsciiBar(100)} 100% | DONE`);
        logToConsole("Raw transcription done. Applying Panda Logic V5...");
        processResultsV5(data);
    } 
    else if (status === 'error') {
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
    
    // Limpiamos consola y ponemos mensaje inicial
    els.consoleOutput.innerHTML = '';
    logToConsole("Panda Terminal v3.0 Started.");
    
    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    const modelSelect = document.getElementById('model-select').value;
    
    worker.postMessage({
        type: 'run',
        audio: audioData,
        language: langSelect === 'auto' ? null : langSelect,
        task: task,
        model: modelSelect
    });
});


// =================================================================
// 🚀 MOTOR LÓGICO V5: PORT DE PYTHON A JAVASCRIPT
// =================================================================

function processResultsV5(data) {
    const maxCPL = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;

    let allWords = [];
    if (data.chunks && Array.isArray(data.chunks)) {
        data.chunks.forEach(chunk => {
            let start = chunk.timestamp[0];
            let end = chunk.timestamp[1];
            if (start !== null && end !== null && typeof start === 'number' && typeof end === 'number') {
                allWords.push({
                    word: chunk.text,
                    start: start,
                    end: end
                });
            }
        });
    }

    logToConsole(`Extracted ${allWords.length} words.`);
    let subs = createSrtV5(allWords, maxCPL, maxLines);
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);

    const task = document.getElementById('task-select').value;
    if (task === 'spotting') {
        subs.forEach(s => s.text = "");
    }

    const srt = generateSRT(subs);
    els.outputText.value = srt;
    els.resultsArea.classList.remove('hidden');
    setTimeout(() => {
        els.resultsArea.classList.add('opacity-100');
        els.resultsArea.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setupDownloads(srt, subs);
}

function balancedSplit(text, maxCpl) {
    if (text.length <= maxCpl) return [text];
    const words = text.split(' ');
    let bestCut = -1;
    let bestDiff = Infinity;
    const punct = [',', ':', ';', '-', '.'];
    const safeStart = Math.floor(text.length * 0.3);
    const safeEnd = Math.floor(text.length * 0.7);
    let indices = [];
    for (let i = 0; i < text.length; i++) { if (punct.includes(text[i])) indices.push(i); }
    const candidates = indices.filter(i => i > safeStart && i < safeEnd);
    if (candidates.length > 0) {
        const center = text.length / 2;
        const bestPunct = candidates.reduce((prev, curr) => Math.abs(curr - center) < Math.abs(prev - center) ? curr : prev);
        const l1 = text.substring(0, bestPunct + 1).trim();
        const l2 = text.substring(bestPunct + 1).trim();
        if (l1.length <= maxCpl && l2.length <= maxCpl) return [l1, l2];
    }
    for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i).join(' ');
        if (l1.length > maxCpl || l2.length > maxCpl) continue;
        const diff = Math.abs(l1.length - l2.length);
        if (diff < bestDiff) { bestDiff = diff; bestCut = i; }
    }
    if (bestCut !== -1) return [words.slice(0, bestCut).join(' '), words.slice(bestCut).join(' ')];
    const mid = Math.floor(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function createSrtV5(words, maxCpl, maxLines) {
    const subtitles = [];
    let buffer = [];
    let startTime = null;
    const strongPunct = ['.', '?', '!', '♪'];
    for (let i = 0; i < words.length; i++) {
        const wObj = words[i];
        const wordText = wObj.word.trim();
        if (!wordText) continue;
        if (startTime === null) startTime = wObj.start;
        buffer.push(wordText);
        const currentText = buffer.join(' ');
        let forceCut = false;
        let pendingWord = null;
        let endTime = wObj.end;
        if (currentText.length > (maxCpl * maxLines)) {
            pendingWord = wObj;
            buffer.pop();
            forceCut = true;
            endTime = wObj.start; 
        } else if (buffer.length > 1) {
            const prevWord = buffer[buffer.length - 2];
            const lastChar = prevWord.slice(-1);
            if (strongPunct.includes(lastChar)) {
                pendingWord = wObj;
                buffer.pop();
                forceCut = true;
                endTime = wObj.start;
            }
        }
        if (forceCut || i === words.length - 1) {
            const finalBlock = buffer.join(' ');
            const lines = balancedSplit(finalBlock, maxCpl);
            subtitles.push({ start: startTime, end: endTime, text: lines.join('\n') });
            buffer = [];
            startTime = null;
            if (pendingWord) {
                buffer.push(pendingWord.word.trim());
                startTime = pendingWord.start;
            }
        }
    }
    return subtitles;
}

function applyTimeRules(subs, minDur, maxDur, minGap) {
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];
        if ((current.end - current.start) > maxDur) current.end = current.start + maxDur;
        if (i < subs.length - 1) {
            let next = subs[i+1];
            let limit = next.start - minGap;
            if (current.end > limit) current.end = limit;
            if (current.end <= current.start) current.end = current.start + 0.1;
        }
    }
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];
        let duration = current.end - current.start;
        if (duration < minDur) {
            let desiredEnd = current.start + minDur;
            let limit = Infinity;
            if (i < subs.length - 1) limit = subs[i+1].start - minGap;
            if (desiredEnd <= limit) current.end = desiredEnd;
            else current.end = limit;
        }
    }
    return subs;
}

function generateSRT(segs) {
    return segs.map((s, i) => `${i+1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}\n`).join('\n');
}

function fmtTime(s) {
    if (typeof s !== 'number' || isNaN(s)) return "00:00:00,000";
    const d = new Date(s * 1000);
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')},${String(d.getUTCMilliseconds()).padStart(3,'0')}`;
}

function setupDownloads(srt, segs) {
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
logToConsole("Panda Terminal v3.0 Ready...");
