// wp-main.js - Lógica Híbrida (Groq + Local) v3.6 - Algoritmo V9 (Linguistic Flow & Deep Anti-Orphan)

const translations = {
    en: {
        backLink: "Back to HTTrans",
        heroDesc: "AI-powered automatic transcription and subtitling tool for audiovisual translators.",
        settingsTitle: "Assistant Preferences",
        audioLangLabel: "Audio Language",
        audioLangHelp: "Manually selecting the language improves accuracy.",
        modelLabel: "AI Model / Quality",
        modelHelp: "Local uses your PC. Cloud (Groq) uses API for speed.",
        modeLabel: "Processing Mode",
        modeLocalDesc: "Free, Private, Slower (CPU/GPU)",
        modeGroqDesc: "Ultra Fast, Best Quality, Requires Key",
        optTiny: "Tiny (Fastest - ~40MB)",
        optBase: "Base (Balanced - ~80MB)",
        optSmall: "Small (High Quality - ~250MB)",
        optDistil: "Distil-Small (English Only)",
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
        dontBreakLabel: "Do not end line on:",
        dropTitle: "Click or drag your file here",
        dropSubtitle: "Supports MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>Heads up!</strong> Large file. Browser might slow down.",
        startBtn: "Start",
        updateBtn: "Update Subtitles",
        startBtnProcessing: "Processing...",
        statusLoading: "Loading...",
        statusInitiating: "Initializing...",
        statusListening: "Processing...",
        statusComplete: "Completed!",
        resultTitle: "Result",
        copyBtn: "Copy",
        copiedBtn: "Copied!",
        saveSrtBtn: "Save SRT",
        saveTxtBtn: "Save TXT",
        resultFooter: "Please note that these subtitles are not perfect. Rely on a human professional to achieve the highest possible quality.",
        errorMsg: "Error processing audio.",
        downloadModel: "Downloading model...",
        dontBreakDefaults: "the, a, an, and, but, or, nor, for, yet, so, of, to, in, with, on, at, by, from, about, as, into, like, through, after, over, between, out, against, during, without, before, under, around, among, my, your, his, her, its, our, their, this, that, one, two, three, four, five, six, seven, eight, nine, ten"
    },
    es: {
        backLink: "Volver a HTTrans",
        heroDesc: "Asistente de transcripción y subtitulado automático para traductores audiovisuales.",
        settingsTitle: "Ajustes del asistente",
        audioLangLabel: "Idioma del audio",
        audioLangHelp: "Seleccionar el idioma manualmente mejora la precisión.",
        modelLabel: "Modelo IA / Calidad",
        modelHelp: "Local usa tu PC. Nube (Groq) usa API para velocidad.",
        modeLabel: "Modo de Procesamiento",
        modeLocalDesc: "Gratis, Privado, Más lento (CPU/GPU)",
        modeGroqDesc: "Ultra Rápido, Mejor Calidad, Requiere Key",
        optTiny: "Tiny (Rápido - ~40MB)",
        optBase: "Base (Equilibrado - ~80MB)",
        optSmall: "Small (Mejor Calidad - ~250MB)",
        optDistil: "Distil-Small (Solo Inglés)",
        optAuto: "✨ Detectar automáticamente",
        actionLabel: "Acción",
        optTranscribe: "Transcribir (Mantener idioma original)",
        optTranslate: "Traducir (Convertir audio a inglés)",
        optSpotting: "Spotting (Subtítulos vacíos)",
        gapLabel: "Intervalo Mín.",
        unitFrames: "Frames",
        unitMs: "ms",
        minDurLabel: "Duración mín. (s)",
        maxDurLabel: "Duración máx. (s)",
        maxLinesLabel: "Máx. Líneas",
        cplLabel: "Máx. caracteres/línea (CPL)",
        punctuationLabel: "Forzar salto de línea en los siguientes caracteres:",
        dontBreakLabel: "No terminar línea en:",
        dropTitle: "Haz clic o arrastra tu archivo aquí",
        dropSubtitle: "Soporta MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>¡Ojo!</strong> Archivo grande. El navegador podría ralentizarse.",
        startBtn: "Iniciar",
        updateBtn: "Actualizar subtítulos",
        startBtnProcessing: "Procesando...",
        statusLoading: "Cargando...",
        statusInitiating: "Iniciando...",
        statusListening: "Procesando...",
        statusComplete: "¡Completado!",
        resultTitle: "Resultado",
        copyBtn: "Copiar",
        copiedBtn: "¡Copiado!",
        saveSrtBtn: "Guardar SRT",
        saveTxtBtn: "Guardar TXT",
        resultFooter: "Ten en cuenta que el resultado no es perfecto. Es imprescindible una revisión humana (idealmente de un profesional) para conseguir la mejor calidad posible.",
        errorMsg: "No se ha podido procesar el audio.",
        downloadModel: "Descargando modelo...",
        dontBreakDefaults: "el, la, los, las, un, una, unos, unas, y, o, pero, ni, que, a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, mi, tu, su, mis, tus, sus, un, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez"
    }
};

let currentLang = 'en';
let audioData = null; // AudioBuffer
let rawFileName = "subtitulos";
let audioDuration = 0;
let worker = new Worker('wp-worker.js', { type: 'module' });
let startTime = 0;
let lastConsoleLine = null;
let cachedData = null; // Caché para re-segmentación rápida

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
    resetBtn: document.getElementById('reset-btn'),
    progressCont: document.getElementById('progress-container'),
    statusText: document.getElementById('status-text'),
    consoleOutput: document.getElementById('console-output'),
    resultsArea: document.getElementById('results-area'),
    outputText: document.getElementById('output-text'),
    dlSrt: document.getElementById('download-srt-btn'),
    dlTxt: document.getElementById('download-txt-btn'),
    copy: document.getElementById('copy-btn'),
    dontBreakInput: document.getElementById('dont-break-on'),
    modeRadios: document.getElementsByName('proc_mode'),
    groqContainer: document.getElementById('groq-key-container'),
    localModelContainer: document.getElementById('local-model-container')
};

// --- LOGICA DE MODOS ---
function updateModeUI(mode) {
    if (mode === 'groq') {
        els.groqContainer.classList.remove('hidden');
        els.localModelContainer.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) {
                label.classList.add('border-[#ffb81f]', 'shadow-md');
                label.classList.remove('border-gray-200');
            } else {
                label.classList.remove('border-[#ffb81f]', 'shadow-md');
                label.classList.add('border-gray-200');
            }
        });
        const savedKey = localStorage.getItem('groq_api_key');
        const defaultKey = "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";
        if(document.getElementById('groq-key')) {
             document.getElementById('groq-key').value = savedKey || defaultKey;
        }
    } else {
        els.groqContainer.classList.add('hidden');
        els.localModelContainer.classList.remove('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) {
                label.classList.add('border-gray-400', 'shadow-md');
                label.classList.remove('border-gray-200');
            } else {
                label.classList.remove('border-gray-400', 'shadow-md');
                label.classList.add('border-gray-200');
            }
        });
    }
}
updateModeUI('groq');
els.modeRadios.forEach(radio => { radio.addEventListener('change', (e) => updateModeUI(e.target.value)); });

// --- UTILS CONSOLA ---
function logToConsole(msg, isProgress = false) {
    if (!els.consoleOutput) return;
    if (!isProgress) lastConsoleLine = null;
    const div = document.createElement('div');
    div.innerText = typeof msg === 'object' ? `> ${JSON.stringify(msg)}` : `> ${msg}`;
    div.className = "hover:bg-gray-800 px-1 rounded font-mono text-xs";
    if (isProgress) div.style.color = "#a7f3d0";
    els.consoleOutput.appendChild(div);
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}
function updateConsoleLine(msg) {
    if (!els.consoleOutput) return;
    if (lastConsoleLine && lastConsoleLine.isConnected) {
        lastConsoleLine.innerText = `> ${msg}`;
    } else {
        const div = document.createElement('div');
        div.innerText = `> ${msg}`;
        div.className = "hover:bg-gray-800 px-1 rounded text-green-300 font-bold font-mono text-xs";
        els.consoleOutput.appendChild(div);
        lastConsoleLine = div;
    }
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}
function getAsciiBar(percent) {
    const width = 20;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return "[" + "=".repeat(filled) + ">".repeat(filled < width ? 1 : 0) + ".".repeat(Math.max(0, empty - (filled < width ? 1 : 0))) + "]";
}
function fmtDuration(seconds) {
    if(!seconds || seconds < 0) return "0s";
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

    const btnText = cachedData ? t.updateBtn : t.startBtn;
    if (els.runBtn.disabled && !audioData) els.runBtn.querySelector('span').innerText = btnText;
    else if (!els.runBtn.disabled) els.runBtn.querySelector('span').innerText = btnText;
    
    els.dontBreakInput.value = t.dontBreakDefaults;
}
els.langEn.addEventListener('click', () => setLanguage('en'));
els.langEs.addEventListener('click', () => setLanguage('es'));

// --- ARCHIVOS ---
function resetFile() {
    audioData = null;
    audioDuration = 0;
    cachedData = null; 
    els.fileInput.value = '';
    els.fileInfo.classList.add('hidden');
    els.warning.classList.add('hidden');
    els.runBtn.disabled = true;
    els.runBtn.querySelector('span').innerText = translations[currentLang].startBtn;
    els.resetBtn.classList.add('hidden'); 
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> System ready...</div>';
    
    els.resultsArea.classList.add('hidden');
    els.resultsArea.classList.remove('opacity-100');
    els.progressCont.classList.add('hidden');
}

async function handleFile(file) {
    resetFile();
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');
    els.resetBtn.classList.remove('hidden'); // Mostrar botón reset
    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden'); 
    els.runBtn.querySelector('span').innerText = t.startBtnProcessing;
    logToConsole(`File loaded: ${file.name}`);
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer; 
        audioDuration = audioBuffer.duration;
        logToConsole(`Audio decoded. Duration: ${fmtDuration(audioDuration)}`);
        
        // ACTIVACIÓN VISUAL DEL BOTÓN
        els.runBtn.disabled = false;
        els.runBtn.classList.remove('bg-gray-300', 'cursor-not-allowed', 'transform-none', 'shadow-none');
        // Usamos el amarillo corporativo #ffb81f
        els.runBtn.classList.add('bg-[#ffb81f]', 'hover:bg-[#e0a01a]', 'hover:scale-[1.02]', 'cursor-pointer', 'shadow-lg', 'transform');
        els.runBtn.querySelector('span').innerText = t.startBtn;
        
    } catch (err) {
        logToConsole(`ERROR: ${err.message}`);
        resetFile();
    }
}
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-[#ffb81f]', 'bg-yellow-50'); });
els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#ffb81f]', 'bg-yellow-50'); });
els.dropZone.addEventListener('drop', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#ffb81f]', 'bg-yellow-50'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
els.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
els.removeFile.addEventListener('click', (e) => { e.stopPropagation(); resetFile(); });
els.resetBtn.addEventListener('click', () => resetFile()); 

// --- UTILS AUDIO ---
function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length);
    const view = new DataView(out);
    const channels = [];
    let i, sample, offset = 0, pos = 0;
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    return new Blob([out], { type: 'audio/wav' });
}

// --- EJECUCIÓN ---
els.runBtn.addEventListener('click', async () => {
    if (!audioData) return;

    if (cachedData) {
        logToConsole("Updating subtitles with new parameters...");
        processResultsV9(cachedData);
        return; 
    }
    
    const mode = document.querySelector('input[name="proc_mode"]:checked').value;
    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    
    els.runBtn.disabled = true;
    els.resultsArea.classList.add('hidden');
    els.resultsArea.classList.remove('opacity-100');
    els.progressCont.classList.remove('hidden');
    els.consoleOutput.innerHTML = '';
    
    if (mode === 'groq') {
        const apiKey = document.getElementById('groq-key').value.trim();
        if (!apiKey) { alert("Please enter a Groq API Key."); els.runBtn.disabled = false; return; }
        localStorage.setItem('groq_api_key', apiKey); 
        await runGroq(apiKey, audioData, langSelect, task);
    } else {
        logToConsole("Panda Local Mode Started.");
        const modelSelect = document.getElementById('model-select').value;
        const channelData = audioData.getChannelData(0); 
        worker.postMessage({ type: 'run', audio: channelData, language: langSelect === 'auto' ? null : langSelect, task: task, model: modelSelect });
    }
});

async function runGroq(apiKey, audioBuffer, language, task) {
    logToConsole("Panda Cloud Mode (Groq) Started.");
    logToConsole("Encoding audio to WAV for upload...");
    try {
        const wavBlob = audioBufferToWav(audioBuffer);
        logToConsole(`Audio prepared (${(wavBlob.size/1024/1024).toFixed(2)} MB). Sending to Groq...`);
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        formData.append('model', 'whisper-large-v3'); 
        if (language !== 'auto') formData.append('language', language);
        formData.append('response_format', 'verbose_json'); 
        formData.append('timestamp_granularities[]', 'word');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData
        });

        if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || "API Error"); }
        logToConsole("Groq API Response received! Processing...");
        const result = await response.json();
        let chunks = [];
        if (result.words) { chunks = result.words.map(w => ({ text: w.word, timestamp: [w.start, w.end] })); } 
        else if (result.segments) { result.segments.forEach(s => { chunks.push({ text: s.text, timestamp: [s.start, s.end] }); }); }
        
        const data = { text: result.text, chunks: chunks };
        cachedData = data;
        els.runBtn.querySelector('span').innerText = translations[currentLang].updateBtn;
        
        logToConsole("Applying V9 Segmentation (Linguistic Flow)...");
        processResultsV9(data);
        els.statusText.innerText = "Completed!";
        updateConsoleLine(`${getAsciiBar(100)} 100% | DONE (GROQ)`);
        els.runBtn.disabled = false;
    } catch (error) {
        logToConsole(`GROQ ERROR: ${error.message}`);
        alert(`Groq API Error: ${error.message}`);
        els.runBtn.disabled = false;
    }
}

worker.onmessage = (e) => {
    const { status, data } = e.data;
    const t = translations[currentLang];
    if (status === 'debug') { logToConsole(data); } 
    else if (status === 'loading') {
        if (data && data.status === 'progress') {
            const percent = Math.round(data.progress || 0);
            updateConsoleLine(`Downloading Model: ${getAsciiBar(percent)} ${percent}%`);
            els.statusText.innerText = `${t.statusLoading} (${percent}%)`;
        } else { els.statusText.innerText = t.statusLoading; }
    } 
    else if (status === 'initiate') {
        els.statusText.innerText = t.statusInitiating;
        lastConsoleLine = null;
        logToConsole("Initializing Local Whisper Engine...");
        startTime = Date.now(); 
        updateConsoleLine(`${getAsciiBar(0)} 0% | ETA: Calc...`);
    } 
    else if (status === 'progress') {
        if (data && typeof data.timeRef === 'number' && audioDuration > 0) {
            const current = data.timeRef;
            const percent = Math.min(100, Math.max(0, (current / audioDuration) * 100));
            const elapsed = (Date.now() - startTime) / 1000;
            let etaText = "Calc...";
            if (elapsed > 1 && current > 0) { 
                const rate = current / elapsed;
                const remaining = audioDuration - current;
                etaText = `ETA: ${fmtDuration(remaining / rate)}`;
            }
            els.statusText.innerText = `${t.statusListening} ${Math.round(percent)}%`;
            updateConsoleLine(`${getAsciiBar(percent)} ${Math.round(percent)}% | ${etaText}`);
        }
    } 
    else if (status === 'complete') {
        els.statusText.innerText = t.statusComplete;
        lastConsoleLine = null;
        updateConsoleLine(`${getAsciiBar(100)} 100% | DONE`);
        logToConsole("Transcription done. Processing...");
        cachedData = data;
        els.runBtn.querySelector('span').innerText = translations[currentLang].updateBtn;
        processResultsV9(data); // V9
        els.runBtn.disabled = false;
    } 
    else if (status === 'error') {
        logToConsole(`ERROR: ${data}`);
        alert("Error: " + data);
        els.runBtn.disabled = false;
    }
};

// =================================================================
// 🚀 MOTOR LÓGICO V9 (LINGUISTIC FLOW + DEEP ANTI-ORPHAN)
// =================================================================

function processResultsV9(data) {
    const maxCpl = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;

    const dontBreakStr = document.getElementById('dont-break-on').value;
    const dontBreakList = [
        ...dontBreakStr.split(','),
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "zero"
    ].map(s => s.trim().toLowerCase()).filter(s => s);

    let allWords = [];
    if (data.chunks && Array.isArray(data.chunks)) {
        data.chunks.forEach(chunk => {
            let start = chunk.timestamp[0];
            let end = chunk.timestamp[1];
            if (start !== null && end !== null) {
                allWords.push({ word: chunk.text, start: start, end: end });
            }
        });
    }

    logToConsole(`Extracted ${allWords.length} words.`);
    
    let subs = createSrtV9(allWords, maxCpl, maxLines, minDurVal, dontBreakList);
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);

    const task = document.getElementById('task-select').value;
    if (task === 'spotting') subs.forEach(s => s.text = "");

    const srt = generateSRT(subs);
    els.outputText.value = srt;
    els.resultsArea.classList.remove('hidden');
    setTimeout(() => {
        els.resultsArea.classList.add('opacity-100');
        els.resultsArea.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    setupDownloads(srt, subs);
}

// --- ALGORITMO V9: Segmentación con Lookahead Anti-Huérfanas ---
function createSrtV9(words, maxCpl, maxLines, minDur, dontBreakList) {
    const subtitles = [];
    let buffer = [];
    let startTime = null;
    const strongPunct = ['.', '?', '!', '♪'];
    const maxChars = maxCpl * maxLines;

    const endsSentence = (w) => strongPunct.includes(w.word.trim().slice(-1));

    for (let i = 0; i < words.length; i++) {
        const wObj = words[i];
        if (!wObj.word.trim()) continue;

        if (startTime === null) startTime = wObj.start;
        buffer.push(wObj);
        
        const currentText = buffer.map(b => b.word.trim()).join(' ');
        let forceCut = false;
        let pendingWords = [];
        let endTime = wObj.end;
        let currentDur = endTime - startTime;

        // 1. REGLA HARD LIMIT (Longitud)
        if (currentText.length > maxChars) {
            const overflow = buffer.pop();
            pendingWords.push(overflow);
            
            // BUCLE DE SEGURIDAD (Revisión Continua)
            let safeCutFound = false;
            
            while (!safeCutFound && buffer.length > 0) {
                // A. Check Sticky Ending (Preposiciones / Números)
                const lastObj = buffer[buffer.length - 1];
                const last = lastObj.word.trim().toLowerCase().replace(/[.,?!]/g, '');
                const isSticky = dontBreakList.includes(last) || /^\d+$/.test(last);
                
                if (isSticky) {
                    pendingWords.unshift(buffer.pop()); // Mover a pendientes
                    continue; // Re-evaluar
                }

                // B. DEEP ANTI-ORPHAN (El "Water." fix)
                let pendingTextLen = pendingWords.map(w => w.word).join(' ').length;
                
                // Miramos qué viene DESPUÉS de lo que ya hemos "popeado"
                // i + 1 es la siguiente palabra en el loop principal
                let lookaheadIdx = i + 1;
                let distToNextDot = 0;
                while(lookaheadIdx < words.length && distToNextDot < 5) {
                    if(endsSentence(words[lookaheadIdx])) break;
                    distToNextDot++;
                    lookaheadIdx++;
                }

                // Condición de huérfana: lo que sobra + lo que viene hasta el punto es poco (< 25 chars)
                const isNextTooShort = (pendingTextLen + (distToNextDot * 5)) < 30; 
                const canSteal = buffer.length > 1 && currentText.length > (maxCpl * 0.4);

                if (isNextTooShort && canSteal) {
                     pendingWords.unshift(buffer.pop());
                     continue; // Seguir robando del buffer
                }
                
                safeCutFound = true; // El corte es seguro
            }

            forceCut = true;
            if(buffer.length > 0) endTime = buffer[buffer.length-1].end;
            else { 
                buffer.push(pendingWords.shift()); 
                endTime = buffer[0].end;
            }
        }
        
        // 2. REGLA PUNTUACIÓN (Soft Limit)
        else if (buffer.length > 0 && currentDur >= minDur) {
            if (endsSentence(wObj)) {
                forceCut = true;
                endTime = wObj.end;
            }
        }

        if (forceCut || i === words.length - 1) {
            const finalBlock = buffer.map(b => b.word.trim()).join(' ');
            const lines = balancedSplitV9(finalBlock, maxCpl, dontBreakList);
            subtitles.push({ start: startTime, end: endTime, text: lines.join('\n') });

            buffer = [];
            startTime = null;

            if (pendingWords.length > 0) {
                buffer = [...pendingWords]; 
                startTime = buffer[0].start;
            }
        }
    }
    return subtitles;
}

// --- BALANCEO V9: Alta Penalización para Sticky Words ---
function balancedSplitV9(text, maxCpl, dontBreakList) {
    if (text.length <= maxCpl) return [text];

    const words = text.split(' ');
    let bestCut = -1;
    let bestScore = Infinity; 
    
    const punct = [',', ':', ';', '-', '.'];
    const safeStart = Math.floor(words.length * 0.2); 
    const safeEnd = Math.floor(words.length * 0.9); 

    for (let i = 1; i < words.length; i++) {
        const l1Str = words.slice(0, i).join(' ');
        const l2Str = words.slice(i).join(' ');
        
        if (l1Str.length > maxCpl || l2Str.length > maxCpl) continue; 

        let score = Math.abs(l1Str.length - l2Str.length);

        // 1. Penalización Sticky (Masiva)
        const lastWordL1 = words[i-1].toLowerCase().replace(/[.,?!]/g, '');
        if (dontBreakList.includes(lastWordL1) || /^\d+$/.test(lastWordL1)) {
            score += 5000; 
        }

        // 2. Penalización Puntuación
        const lastCharL1 = words[i-1].slice(-1);
        if (punct.includes(lastCharL1)) {
            score -= 50; 
        }

        // 3. Preferencia central
        if (i > safeStart && i < safeEnd) {
            score -= 10;
        }

        if (score < bestScore) {
            bestScore = score;
            bestCut = i;
        }
    }

    if (bestCut !== -1) {
        return [words.slice(0, bestCut).join(' '), words.slice(bestCut).join(' ')];
    }

    const mid = Math.floor(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
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
        els.copy.classList.add('copy-success');
        setTimeout(() => {
            els.copy.querySelector('span').innerHTML = orig;
            els.copy.classList.remove('copy-success');
        }, 2000);
    };
}
function download(content, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'}));
    a.download = name;
    a.click();
}
setLanguage('en');
