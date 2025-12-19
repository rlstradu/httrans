// wp-main.js - V5.5 (Button Labels Update)

const translations = {
    en: {
        backLink: "Back to HTTrans",
        heroDesc: "AI-powered automatic transcription and subtitling tool.",
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
        dontBreakLabel: "Do not end line on (Prepositions/Articles)",
        dropTitle: "Click or drag your file here",
        dropSubtitle: "Supports MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>Heads up!</strong> Large file. Browser might slow down.",
        startBtn: "Start",
        updateBtn: "Readjust", 
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
        resultFooter: "Remember to check subtitles in a professional tool.",
        errorMsg: "Error processing audio.",
        downloadModel: "Downloading Model...",
        btnReadjust: "Readjust Parameters",
        zoomLabel: "Zoom",
        ttNudgeStartM: "-1 Frame Start",
        ttNudgeStartP: "+1 Frame Start",
        ttNudgeEndM: "-1 Frame End",
        ttNudgeEndP: "+1 Frame End",
        ttPlay: "Play Segment",
        ttPrev: "Previous Subtitle",
        ttNext: "Next Subtitle",
        ttClear: "Clear Text (Spotting)",
        ttShiftPrev: "Move first word to previous",
        ttShiftNext: "Move last word to next",
        ttClearAll: "Clear ALL Text",
        confirmClearAll: "Are you sure? This will remove text from ALL subtitles.",
        dontBreakDefaults: "the, a, an, and, but, or, nor, for, yet, so, of, to, in, with, on, at, by, from, about, as, into, like, through, after, over, between, out, against, during, without, before, under, around, among, my, your, his, her, its, our, their, this, that, one, two, three, four, five, six, seven, eight, nine, ten"
    },
    es: {
        backLink: "Volver a HTTrans",
        heroDesc: "Herramienta de transcripción y subtitulado automático impulsada por IA.",
        settingsTitle: "Ajustes del asistente",
        audioLangLabel: "Idioma del audio",
        audioLangHelp: "Seleccionar el idioma manualmente mejora la precisión.",
        modelLabel: "Modelo IA / Calidad",
        modelHelp: "Local usa tu PC. Nube (Groq) usa API para velocidad.",
        modeLabel: "Modo de Procesamiento",
        modeLocalDesc: "Gratis, Privado, Muy Lento (CPU/GPU)",
        modeGroqDesc: "Ultra Rápido, Mejor Calidad, Requiere Key",
        optTiny: "Tiny (Rápido - ~40MB)",
        optBase: "Base (Equilibrado - ~80MB)",
        optSmall: "Small (Mejor Calidad - ~250MB)",
        optDistil: "Distil-Small (Solo Inglés)",
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
        dontBreakLabel: "No terminar línea en (Preposiciones/Artículos)",
        dropTitle: "Haz clic o arrastra tu archivo aquí",
        dropSubtitle: "Soporta MP3, WAV, MP4, MKV, MOV...",
        fileWarning: "<strong>¡Ojo!</strong> Archivo grande. El navegador podría ir lento.",
        startBtn: "Iniciar",
        updateBtn: "Reajustar",
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
        resultFooter: "Recuerda revisar los subtítulos en una herramienta profesional.",
        errorMsg: "No se pudo procesar el audio.",
        downloadModel: "Descargando Modelo...",
        btnReadjust: "Reajustar Parámetros",
        zoomLabel: "Zoom",
        ttNudgeStartM: "-1 Frame Inicio",
        ttNudgeStartP: "+1 Frame Inicio",
        ttNudgeEndM: "-1 Frame Fin",
        ttNudgeEndP: "+1 Frame Fin",
        ttPlay: "Reproducir Subtítulo",
        ttPrev: "Subtítulo Anterior",
        ttNext: "Siguiente Subtítulo",
        ttClear: "Borrar Texto",
        ttShiftPrev: "Mover palabra al anterior",
        ttShiftNext: "Mover palabra al siguiente",
        ttClearAll: "Borrar TODO el texto",
        confirmClearAll: "¿Seguro? Esto borrará el texto de TODOS los subtítulos.",
        dontBreakDefaults: "el, la, los, las, un, una, unos, unas, y, o, pero, ni, que, a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, mi, tu, su, mis, tus, sus, un, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez"
    }
};

let currentLang = 'en';
let audioData = null; // AudioBuffer
let audioBlobUrl = null; // URL del archivo para el video tag
let rawFileName = "subtitulos";
let audioDuration = 0;
let worker = new Worker('wp-worker.js', { type: 'module' });
let startTime = 0;
let lastConsoleLine = null;
let cachedData = null; 

// Variables del Editor Visual
let wavesurfer = null;
let wsRegions = null;
let currentSubtitles = []; 
const ONE_FRAME = 0.04; 

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
    
    // UI Sections
    uploadSection: document.getElementById('upload-section'),
    configPanel: document.getElementById('config-panel'),
    headerSection: document.getElementById('header-section'),
    editorContainer: document.getElementById('editor-container'),
    
    // Editor Elements
    videoPreview: document.getElementById('video-preview'),
    subtitleOverlay: document.getElementById('subtitle-overlay'),
    subtitleList: document.getElementById('subtitle-list'),
    downloadEditorSrt: document.getElementById('download-editor-srt'),
    backToConfigBtn: document.getElementById('back-to-config-btn'),
    zoomSlider: document.getElementById('zoom-slider'),
    clearTextBtn: document.getElementById('clear-text-btn'),
    
    // Config Inputs
    dontBreakInput: document.getElementById('dont-break-on'),
    modeRadios: document.getElementsByName('proc_mode'),
    groqContainer: document.getElementById('groq-key-container'),
    localModelContainer: document.getElementById('local-model-container')
};

// --- INIT & MODES ---
function updateModeUI(mode) {
    if (mode === 'groq') {
        if(els.groqContainer) els.groqContainer.classList.remove('hidden');
        if(els.localModelContainer) els.localModelContainer.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) { label.classList.add('border-[#ffb81f]', 'shadow-md'); label.classList.remove('border-gray-200'); } 
            else { label.classList.remove('border-[#ffb81f]', 'shadow-md'); label.classList.add('border-gray-200'); }
        });
        const savedKey = localStorage.getItem('groq_api_key');
        const defaultKey = "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";
        if(document.getElementById('groq-key')) document.getElementById('groq-key').value = savedKey || defaultKey;
    } else {
        if(els.groqContainer) els.groqContainer.classList.add('hidden');
        if(els.localModelContainer) els.localModelContainer.classList.remove('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) { label.classList.add('border-gray-400', 'shadow-md'); label.classList.remove('border-gray-200'); } 
            else { label.classList.remove('border-gray-400', 'shadow-md'); label.classList.add('border-gray-200'); }
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
    if (lastConsoleLine && lastConsoleLine.isConnected) { lastConsoleLine.innerText = `> ${msg}`; } 
    else {
        const div = document.createElement('div'); div.innerText = `> ${msg}`;
        div.className = "hover:bg-gray-800 px-1 rounded text-green-300 font-bold font-mono text-xs";
        els.consoleOutput.appendChild(div); lastConsoleLine = div;
    }
    els.consoleOutput.scrollTop = els.consoleOutput.scrollHeight;
}
function getAsciiBar(percent) {
    const width = 20; const filled = Math.round((percent / 100) * width); const empty = width - filled;
    return "[" + "=".repeat(filled) + ">".repeat(filled < width ? 1 : 0) + ".".repeat(Math.max(0, empty - (filled < width ? 1 : 0))) + "]";
}
function fmtDuration(seconds) {
    if(!seconds || seconds < 0) return "0s";
    const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
}
function setLanguage(lang) {
    currentLang = lang; const t = translations[lang];
    if (lang === 'en') { els.langEn.classList.add('active'); els.langEs.classList.remove('active'); } 
    else { els.langEs.classList.add('active'); els.langEn.classList.remove('active'); }
    document.querySelectorAll('[data-key]').forEach(el => { if (t[el.dataset.key]) el.innerHTML = t[el.dataset.key]; });
    const modelSelect = document.getElementById('model-select');
    if(modelSelect) {
        modelSelect.options[0].text = t.optTiny; modelSelect.options[1].text = t.optBase;
        modelSelect.options[2].text = t.optSmall; if(modelSelect.options[3]) modelSelect.options[3].text = t.optDistil;
    }
    const btnText = cachedData ? t.updateBtn : t.startBtn;
    if (audioData && els.runBtn) {
         els.runBtn.querySelector('span').innerText = btnText;
    }
    if(els.dontBreakInput) els.dontBreakInput.value = t.dontBreakDefaults;
}
els.langEn.addEventListener('click', () => setLanguage('en'));
els.langEs.addEventListener('click', () => setLanguage('es'));

// --- MANEJO DE ARCHIVOS ---
function resetFile() {
    audioData = null; audioDuration = 0; cachedData = null; 
    if(audioBlobUrl) { URL.revokeObjectURL(audioBlobUrl); audioBlobUrl = null; }
    els.fileInput.value = ''; els.fileInfo.classList.add('hidden'); els.warning.classList.add('hidden');
    
    // Disable Button
    els.runBtn.disabled = true; 
    els.runBtn.querySelector('span').innerText = translations[currentLang].startBtn;
    els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-gray-300 text-gray-500 cursor-not-allowed";

    els.resetBtn.classList.add('hidden'); 
    
    els.editorContainer.classList.add('hidden');
    els.configPanel.classList.remove('hidden'); els.uploadSection.classList.remove('hidden');
    els.headerSection.classList.remove('hidden'); els.progressCont.classList.add('hidden');
    // Hide old results if visible
    if(els.resultsArea) els.resultsArea.classList.add('hidden');

    if(wavesurfer) { wavesurfer.destroy(); wavesurfer = null; }
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> System ready...</div>';
}

async function handleFile(file) {
    resetFile();
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');
    els.resetBtn.classList.remove('hidden');
    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden'); 
    
    audioBlobUrl = URL.createObjectURL(file);
    els.videoPreview.src = audioBlobUrl;

    // Mostrar consola para feedback inmediato
    els.progressCont.classList.remove('hidden');
    logToConsole(`File loaded: ${file.name}`);
    logToConsole("Decoding audio... please wait.");
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer; audioDuration = audioBuffer.duration;
        logToConsole(`Audio decoded. Duration: ${fmtDuration(audioDuration)}`);
        logToConsole(`Ready to start.`);
        
        // Habilitar botón visualmente
        els.runBtn.disabled = false;
        els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-[#ffb81f] hover:bg-[#e0a01a] hover:scale-[1.02] cursor-pointer";
        els.runBtn.querySelector('span').innerText = t.startBtn;
    } catch (err) {
        logToConsole(`ERROR: ${err.message}`);
    }
}
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-[#ffb81f]', 'bg-yellow-50'); });
els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#ffb81f]', 'bg-yellow-50'); });
els.dropZone.addEventListener('drop', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#ffb81f]', 'bg-pink-50'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
els.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
els.removeFile.addEventListener('click', (e) => { e.stopPropagation(); resetFile(); });
els.resetBtn.addEventListener('click', () => resetFile()); 

function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels; const length = buffer.length * numOfChan * 2 + 44; const out = new ArrayBuffer(length); const view = new DataView(out);
    const channels = []; let i, sample, offset = 0, pos = 0;
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true); pos += 2;
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
        logToConsole("Updating segmentation..."); processResultsV9(cachedData); showEditor(); return;
    }
    const mode = document.querySelector('input[name="proc_mode"]:checked').value;
    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    
    // UI Update on Click
    els.runBtn.disabled = true;
    els.runBtn.classList.remove('bg-[#ffb81f]', 'hover:bg-[#e0a01a]', 'hover:scale-[1.02]', 'cursor-pointer');
    els.runBtn.classList.add('bg-gray-300', 'cursor-not-allowed'); 
    
    if(els.resultsArea) els.resultsArea.classList.add('hidden');
    els.progressCont.classList.remove('hidden'); 
    // No borramos la consola, solo añadimos
    logToConsole("--- STARTED ---");
    
    if (mode === 'groq') {
        const apiKey = document.getElementById('groq-key').value.trim();
        if (!apiKey) { alert("Please enter a Groq API Key."); els.runBtn.disabled = false; return; }
        localStorage.setItem('groq_api_key', apiKey); await runGroq(apiKey, audioData, langSelect, task);
    } else {
        logToConsole("Panda Local Mode Started.");
        const modelSelect = document.getElementById('model-select').value;
        const channelData = audioData.getChannelData(0); 
        worker.postMessage({ type: 'run', audio: channelData, language: langSelect === 'auto' ? null : langSelect, task: task, model: modelSelect });
    }
});

async function runGroq(apiKey, audioBuffer, language, task) {
    logToConsole("Panda Cloud Mode (Groq) Started.");
    try {
        const wavBlob = audioBufferToWav(audioBuffer);
        logToConsole(`Audio encoded. Sending to Groq...`);
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
        const result = await response.json();
        let chunks = [];
        if (result.words) { chunks = result.words.map(w => ({ text: w.word, timestamp: [w.start, w.end] })); } 
        else if (result.segments) { result.segments.forEach(s => { chunks.push({ text: s.text, timestamp: [s.start, s.end] }); }); }
        const data = { text: result.text, chunks: chunks };
        cachedData = data;
        els.runBtn.querySelector('span').innerText = translations[currentLang].updateBtn;
        logToConsole("Processing...");
        processResultsV9(data);
        showEditor();
        els.runBtn.disabled = false;
        els.runBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
        els.runBtn.classList.add('bg-[#ffb81f]', 'hover:bg-[#e0a01a]');
    } catch (error) {
        logToConsole(`GROQ ERROR: ${error.message}`);
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
        els.statusText.innerText = t.statusInitiating; lastConsoleLine = null; logToConsole("Initializing Engine..."); startTime = Date.now(); updateConsoleLine(`${getAsciiBar(0)} 0%`);
    } 
    else if (status === 'progress') {
        if (data && typeof data.timeRef === 'number' && audioDuration > 0) {
            const current = data.timeRef;
            const percent = Math.min(100, Math.max(0, (current / audioDuration) * 100));
            updateConsoleLine(`${getAsciiBar(percent)} ${Math.round(percent)}%`);
        }
    } 
    else if (status === 'complete') {
        updateConsoleLine(`${getAsciiBar(100)} 100% | DONE`);
        cachedData = data;
        els.runBtn.querySelector('span').innerText = translations[currentLang].updateBtn;
        processResultsV9(data);
        showEditor();
        els.runBtn.disabled = false;
        els.runBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
        els.runBtn.classList.add('bg-[#ffb81f]', 'hover:bg-[#e0a01a]');
    } 
    else if (status === 'error') { logToConsole(`ERROR: ${data}`); els.runBtn.disabled = false; }
};

// =================================================================
// 🚀 GESTIÓN DEL EDITOR VISUAL (WAVESURFER + INTERACCIÓN)
// =================================================================

function showEditor() {
    els.uploadSection.classList.add('hidden');
    els.configPanel.classList.add('hidden');
    els.headerSection.classList.add('hidden');
    els.progressCont.classList.add('hidden');
    if(els.resultsArea) els.resultsArea.classList.add('hidden');
    els.editorContainer.classList.remove('hidden');
    
    if (!wavesurfer) initWaveSurfer();
    else { renderRegions(); renderSubtitleList(); }
}

els.backToConfigBtn.addEventListener('click', () => {
    els.editorContainer.classList.add('hidden');
    els.configPanel.classList.remove('hidden');
    els.runBtn.scrollIntoView({ behavior: 'smooth' });
    const t = translations[currentLang];
    els.runBtn.querySelector('span').innerText = t.updateBtn;
});

function initWaveSurfer() {
    if (!document.getElementById('waveform')) return;
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#4b5563',
        progressColor: '#ffb81f',
        url: audioBlobUrl,
        height: 120,
        normalize: true,
        minimap: true,
        autoCenter: true, 
        minPxPerSec: 100, 
        plugins: [ WaveSurfer.Regions.create() ]
    });
    wsRegions = wavesurfer.plugins[0];
    
    els.zoomSlider.addEventListener('input', (e) => {
        wavesurfer.zoom(Number(e.target.value));
    });

    const video = els.videoPreview;
    wavesurfer.on('interaction', () => video.currentTime = wavesurfer.getCurrentTime());
    video.addEventListener('timeupdate', () => {
        if (!wavesurfer.isPlaying()) wavesurfer.setTime(video.currentTime);
        updateSubtitleOverlay(video.currentTime);
        highlightActiveSub(video.currentTime);
    });
    video.addEventListener('play', () => wavesurfer.play());
    video.addEventListener('pause', () => wavesurfer.pause());
    wavesurfer.on('ready', () => {
        wavesurfer.zoom(100);
        renderRegions();
        renderSubtitleList();
    });

    wsRegions.on('region-updated', (region) => {
        const index = parseInt(region.id.replace('sub-', ''));
        if (currentSubtitles[index]) {
            currentSubtitles[index].start = region.start;
            currentSubtitles[index].end = region.end;
            const timeSpan = document.getElementById(`time-display-${index}`);
            if(timeSpan) timeSpan.innerText = `${fmtTimeShort(region.start)} - ${fmtTimeShort(region.end)}`;
            updateMetrics(index);
        }
    });
    wsRegions.on('region-clicked', (region, e) => { e.stopPropagation(); video.currentTime = region.start; video.play(); });
}

function renderRegions() {
    wsRegions.clearRegions();
    currentSubtitles.forEach((sub, index) => {
        const contentDiv = document.createElement('div');
        contentDiv.textContent = (index + 1).toString();
        contentDiv.style.color = "black";
        contentDiv.style.fontSize = "10px";
        contentDiv.style.padding = "2px";
        contentDiv.style.fontWeight = "bold";

        wsRegions.addRegion({
            id: `sub-${index}`,
            start: sub.start,
            end: sub.end,
            content: contentDiv, 
            color: 'rgba(255, 184, 31, 0.4)',
            drag: true, resize: true
        });
    });
}

function renderSubtitleList() {
    els.subtitleList.innerHTML = '';
    const t = translations[currentLang];
    
    currentSubtitles.forEach((sub, index) => {
        const div = document.createElement('div');
        div.id = `card-sub-${index}`;
        div.className = "bg-white p-3 rounded border border-gray-200 hover:border-[#ffb81f] transition text-sm group mb-2";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-mono font-bold text-gray-500 text-xs">#${index+1}</span>
                <span id="time-display-${index}" class="text-[10px] bg-gray-100 px-1 rounded text-gray-500 font-mono">${fmtTimeShort(sub.start)} - ${fmtTimeShort(sub.end)}</span>
            </div>
            <textarea id="ta-${index}" class="w-full resize-none outline-none bg-transparent text-gray-800 font-medium mb-2 focus:bg-yellow-50 p-1 rounded" rows="2">${sub.text}</textarea>
            <div id="metrics-${index}" class="flex justify-between text-[10px] text-gray-400 font-mono border-t border-gray-100 pt-1 mb-2"></div>
            <div class="flex justify-between items-center opacity-70 group-hover:opacity-100 transition-opacity gap-1 flex-wrap">
                <div class="flex gap-0.5 border border-gray-200 rounded overflow-hidden">
                    <button class="px-1.5 py-0.5 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-xs" onclick="window.nudge(${index}, -${ONE_FRAME}, 'start')" title="${t.ttNudgeStartM}">-[</button>
                    <button class="px-1.5 py-0.5 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-xs" onclick="window.nudge(${index}, ${ONE_FRAME}, 'start')" title="${t.ttNudgeStartP}">+[</button>
                    <div class="w-px bg-gray-200"></div>
                    <button class="px-1.5 py-0.5 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-xs" onclick="window.nudge(${index}, -${ONE_FRAME}, 'end')" title="${t.ttNudgeEndM}">-]</button>
                    <button class="px-1.5 py-0.5 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-xs" onclick="window.nudge(${index}, ${ONE_FRAME}, 'end')" title="${t.ttNudgeEndP}">+]</button>
                </div>
                <div class="flex gap-2 text-gray-500 ml-auto">
                    <button class="hover:text-[#ffb81f]" onclick="window.playSub(${index})" title="${t.ttPlay}"><i class="ph-fill ph-play-circle text-xl"></i></button>
                    <button class="hover:text-red-500" onclick="window.clearSubText(${index})" title="${t.ttClear}"><i class="ph-bold ph-eraser text-lg"></i></button>
                    <button class="hover:text-blue-500" onclick="window.navSub(${index}, -1)" title="${t.ttPrev}"><i class="ph-bold ph-arrow-up"></i></button>
                    <button class="hover:text-blue-500" onclick="window.navSub(${index}, 1)" title="${t.ttNext}"><i class="ph-bold ph-arrow-down"></i></button>
                    <button class="hover:text-purple-500" onclick="window.shiftWord(${index}, -1)" title="${t.ttShiftPrev}"><i class="ph-bold ph-arrow-fat-line-up"></i></button>
                    <button class="hover:text-purple-500" onclick="window.shiftWord(${index}, 1)" title="${t.ttShiftNext}"><i class="ph-bold ph-arrow-fat-line-down"></i></button>
                </div>
            </div>
        `;
        const ta = div.querySelector('textarea');
        ta.addEventListener('input', () => { sub.text = ta.value; updateSubtitleOverlay(els.videoPreview.currentTime); updateMetrics(index); });
        div.addEventListener('click', (e) => { if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I' && e.target.tagName !== 'TEXTAREA') els.videoPreview.currentTime = sub.start; });
        els.subtitleList.appendChild(div);
        updateMetrics(index);
    });
}

function updateMetrics(index) {
    const sub = currentSubtitles[index];
    const duration = sub.end - sub.start;
    const cleanText = sub.text.replace(/\n/g, '').trim();
    const textLen = cleanText.length;
    const cps = duration > 0 ? (textLen / duration).toFixed(1) : "0";
    const lines = sub.text.split('\n');
    const cplText = lines.map((l, i) => `<span class="${l.length > 42 ? 'text-red-500 font-bold' : ''}">L${i+1}: ${l.length}</span>`).join(' | ');
    const container = document.getElementById(`metrics-${index}`);
    if(container) container.innerHTML = `<span>${cplText}</span><span class="${cps > 25 ? 'text-red-500 font-bold' : ''}">${cps} CPS</span>`;
}

function highlightActiveSub(time) {
    const activeIndex = currentSubtitles.findIndex(s => time >= s.start && time <= s.end);
    document.querySelectorAll('.sub-card-active').forEach(el => el.classList.remove('sub-card-active'));
    if(activeIndex !== -1) {
        const card = document.getElementById(`card-sub-${activeIndex}`);
        if(card) card.classList.add('sub-card-active');
    }
}

window.nudge = (index, amount, side) => {
    if(!currentSubtitles[index]) return;
    if(side === 'start') {
        currentSubtitles[index].start = Math.max(0, currentSubtitles[index].start + amount);
        if(currentSubtitles[index].start >= currentSubtitles[index].end) currentSubtitles[index].start = currentSubtitles[index].end - 0.1; 
    } else {
        currentSubtitles[index].end = Math.max(currentSubtitles[index].start + 0.1, currentSubtitles[index].end + amount);
    }
    
    // FIX: ACTUALIZAR VISUALMENTE LA REGIÓN
    if(wsRegions) {
        const region = wsRegions.getRegions().find(r => r.id === `sub-${index}`);
        if(region) {
            region.setOptions({
                start: currentSubtitles[index].start,
                end: currentSubtitles[index].end
            });
        }
    }
    const timeSpan = document.getElementById(`time-display-${index}`);
    if(timeSpan) timeSpan.innerText = `${fmtTimeShort(currentSubtitles[index].start)} - ${fmtTimeShort(currentSubtitles[index].end)}`;
    updateMetrics(index);
};
window.playSub = (index) => { if(!currentSubtitles[index]) return; els.videoPreview.currentTime = currentSubtitles[index].start; els.videoPreview.play(); };
window.navSub = (index, dir) => {
    const newIndex = index + dir;
    if(newIndex >= 0 && newIndex < currentSubtitles.length) { els.videoPreview.currentTime = currentSubtitles[newIndex].start; document.getElementById(`card-sub-${newIndex}`).scrollIntoView({behavior: "smooth", block: "center"}); }
};
window.clearSubText = (index) => { if(currentSubtitles[index]) { currentSubtitles[index].text = ""; document.getElementById(`ta-${index}`).value = ""; updateMetrics(index); updateSubtitleOverlay(els.videoPreview.currentTime); } };
window.shiftWord = (index, dir) => {
    if(dir === -1 && index > 0) { 
        const words = currentSubtitles[index].text.trim().split(/\s+/);
        if(words.length > 0 && words[0] !== "") {
            const word = words.shift();
            currentSubtitles[index].text = words.join(' ');
            currentSubtitles[index-1].text = (currentSubtitles[index-1].text.trim() + " " + word).trim();
            document.getElementById(`ta-${index}`).value = currentSubtitles[index].text; document.getElementById(`ta-${index-1}`).value = currentSubtitles[index-1].text;
            updateMetrics(index); updateMetrics(index-1);
        }
    } else if (dir === 1 && index < currentSubtitles.length - 1) { 
        const words = currentSubtitles[index].text.trim().split(/\s+/);
        if(words.length > 0 && words[0] !== "") {
            const word = words.pop();
            currentSubtitles[index].text = words.join(' ');
            currentSubtitles[index+1].text = (word + " " + currentSubtitles[index+1].text.trim()).trim();
            document.getElementById(`ta-${index}`).value = currentSubtitles[index].text; document.getElementById(`ta-${index+1}`).value = currentSubtitles[index+1].text;
            updateMetrics(index); updateMetrics(index+1);
        }
    }
    updateSubtitleOverlay(els.videoPreview.currentTime);
};

if(els.clearTextBtn) {
    els.clearTextBtn.addEventListener('click', () => {
        if(confirm(translations[currentLang].confirmClearAll)) { currentSubtitles.forEach(s => s.text = ""); renderSubtitleList(); }
    });
}
function updateSubtitleOverlay(time) {
    const activeSub = currentSubtitles.find(s => time >= s.start && time <= s.end);
    if(activeSub && activeSub.text.trim() !== "") {
        els.subtitleOverlay.innerText = activeSub.text; els.subtitleOverlay.style.opacity = "1"; els.subtitleOverlay.style.background = "rgba(0,0,0,0.6)";
    } else { els.subtitleOverlay.style.opacity = "0"; }
    highlightActiveSub(time);
}
if(els.downloadEditorSrt){
    els.downloadEditorSrt.addEventListener('click', () => { const srt = generateSRT(currentSubtitles); download(srt, `${rawFileName}_edited.srt`); });
}

function processResultsV9(data) {
    // ... (Parámetros y Lógica V9 igual que antes) ...
    const maxCPL = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;
    const dontBreakStr = document.getElementById('dont-break-on').value;
    const dontBreakList = [...dontBreakStr.split(','), "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "zero"].map(s => s.trim().toLowerCase()).filter(s => s);
    let allWords = [];
    if (data.chunks) { data.chunks.forEach(chunk => { let start = chunk.timestamp[0]; let end = chunk.timestamp[1]; if (start !== null && end !== null) allWords.push({ word: chunk.text, start: start, end: end }); }); }
    
    let subs = createSrtV9(allWords, maxCPL, maxLines, minDurVal, dontBreakList);
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);
    const task = document.getElementById('task-select').value;
    if (task === 'spotting') subs.forEach(s => s.text = "");
    
    currentSubtitles = subs;
}

// (Copiar funciones createSrtV9, balancedSplitV9, applyTimeRules, generateSRT, fmtTimeShort, download)

function createSrtV9(words, maxCpl, maxLines, minDur, dontBreakList) {
    const subtitles = []; let buffer = []; let startTime = null; const strongPunct = ['.', '?', '!', '♪']; const maxChars = maxCpl * maxLines;
    const endsSentence = (w) => strongPunct.includes(w.word.trim().slice(-1));
    for (let i = 0; i < words.length; i++) {
        const wObj = words[i]; if (!wObj.word.trim()) continue;
        if (startTime === null) startTime = wObj.start;
        buffer.push(wObj);
        const currentText = buffer.map(b => b.word.trim()).join(' ');
        let forceCut = false; let pendingWords = []; let endTime = wObj.end; let currentDur = endTime - startTime;
        if (currentText.length > maxChars) {
            const overflow = buffer.pop(); pendingWords.push(overflow);
            let safeCutFound = false;
            while (!safeCutFound && buffer.length > 0) {
                const last = buffer[buffer.length - 1].word.trim().toLowerCase().replace(/[.,?!]/g, '');
                const isSticky = dontBreakList.includes(last) || /^\d+$/.test(last);
                if (isSticky) { pendingWords.unshift(buffer.pop()); continue; }
                let pendingTextLen = pendingWords.map(w => w.word).join(' ').length;
                let lookaheadIdx = i + 1; let distToNextDot = 0;
                while(lookaheadIdx < words.length && distToNextDot < 5) { if(endsSentence(words[lookaheadIdx])) break; distToNextDot++; lookaheadIdx++; }
                const isNextTooShort = (pendingTextLen + (distToNextDot * 5)) < 30; 
                const canSteal = buffer.length > 1 && currentText.length > (maxCpl * 0.4);
                if (isNextTooShort && canSteal) { pendingWords.unshift(buffer.pop()); continue; }
                safeCutFound = true; 
            }
            forceCut = true;
            if(buffer.length > 0) endTime = buffer[buffer.length-1].end; else { buffer.push(pendingWords.shift()); endTime = buffer[0].end; }
        } else if (buffer.length > 0 && currentDur >= minDur) {
            if (endsSentence(wObj)) { forceCut = true; endTime = wObj.end; }
        }
        if (forceCut || i === words.length - 1) {
            const finalBlock = buffer.map(b => b.word.trim()).join(' ');
            const lines = balancedSplitV9(finalBlock, maxCpl, dontBreakList);
            subtitles.push({ start: startTime, end: endTime, text: lines.join('\n') });
            buffer = []; startTime = null;
            if (pendingWords.length > 0) { buffer = [...pendingWords]; startTime = buffer[0].start; }
        }
    }
    return subtitles;
}

function balancedSplitV9(text, maxCpl, dontBreakList) {
    if (text.length <= maxCpl) return [text];
    const words = text.split(' '); let bestCut = -1; let bestScore = Infinity; 
    const punct = [',', ':', ';', '-', '.']; const safeStart = Math.floor(words.length * 0.2); const safeEnd = Math.floor(words.length * 0.9); 
    for (let i = 1; i < words.length; i++) {
        const l1Str = words.slice(0, i).join(' '); const l2Str = words.slice(i).join(' ');
        if (l1Str.length > maxCpl || l2Str.length > maxCpl) continue; 
        let score = Math.abs(l1Str.length - l2Str.length);
        const lastWordL1 = words[i-1].toLowerCase().replace(/[.,?!]/g, '');
        if (dontBreakList.includes(lastWordL1) || /^\d+$/.test(lastWordL1)) score += 5000; 
        const lastCharL1 = words[i-1].slice(-1); if (punct.includes(lastCharL1)) score -= 50; 
        if (i > safeStart && i < safeEnd) score -= 10;
        if (score < bestScore) { bestScore = score; bestCut = i; }
    }
    if (bestCut !== -1) return [words.slice(0, bestCut).join(' '), words.slice(bestCut).join(' ')];
    const mid = Math.floor(words.length / 2); return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function applyTimeRules(subs, minDur, maxDur, minGap) {
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i];
        if ((current.end - current.start) > maxDur) current.end = current.start + maxDur;
        if (i < subs.length - 1) {
            let next = subs[i+1]; let limit = next.start - minGap;
            if (current.end > limit) current.end = limit;
            if (current.end <= current.start) current.end = current.start + 0.1;
        }
    }
    for (let i = 0; i < subs.length; i++) {
        let current = subs[i]; let duration = current.end - current.start;
        if (duration < minDur) {
            let desiredEnd = current.start + minDur; let limit = Infinity;
            if (i < subs.length - 1) limit = subs[i+1].start - minGap;
            if (desiredEnd <= limit) current.end = desiredEnd; else current.end = limit;
        }
    }
    return subs;
}

function fmtTimeShort(s) {
    const d = new Date(s * 1000);
    return `${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}.${String(d.getUTCMilliseconds()).padStart(3,'0').slice(0,2)}`;
}

setLanguage('en');
