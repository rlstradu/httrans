// wp-main.js - V6.7 (FIXED: Restart Logic, Start Button Re-enable)

// ==========================================
// 1. CONFIGURACIÓN Y TRADUCCIONES
// ==========================================

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
        updateBtn: "Update Segmentation", 
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
        btnReadjust: "Restart with same file", 
        zoomLabel: "Zoom",
        ttNudgeStartM: "-1 Frame Start (-[)",
        ttNudgeStartP: "+1 Frame Start (+[)",
        ttNudgeEndM: "-1 Frame End (-])",
        ttNudgeEndP: "+1 Frame End (+])",
        ttPlaySegment: "Play subtitle (Ctrl+O)",
        ttPlay: "Play Segment",
        ttPrev: "Previous Subtitle (Alt+Up)",
        ttNext: "Next Subtitle (Alt+Down)",
        ttClear: "Clear Text",
        ttShiftPrev: "Move first word to previous",
        ttShiftNext: "Move last word to next",
        ttClearAll: "Clear ALL Text",
        ttDeleteSub: "Delete Subtitle Block",
        confirmClearAll: "Are you sure? This will remove text from ALL subtitles.",
        btnClear: "Clear Text",
        btnRecover: "Recover Text",
        confirmRecover: "Restore original text?",
        ttEditTime: "Click to edit timestamps",
        btnUndo: "Undo",
        ttUndo: "Undo last action (Ctrl+Z)",
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
        updateBtn: "Actualizar Segmentación",
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
        btnReadjust: "Reiniciar con mismo archivo", 
        zoomLabel: "Zoom",
        ttNudgeStartM: "-1 Frame Inicio (-[)",
        ttNudgeStartP: "+1 Frame Inicio (+[)",
        ttNudgeEndM: "-1 Frame Fin (-])",
        ttNudgeEndP: "+1 Frame Fin (+])",
        ttPlaySegment: "Reproducir subtítulo (Ctrl+O)",
        ttPlay: "Reproducir Segmento",
        ttPrev: "Subtítulo Anterior (Alt+Arr)",
        ttNext: "Siguiente Subtítulo (Alt+Abj)",
        ttClear: "Borrar Texto",
        ttShiftPrev: "Mover palabra al anterior",
        ttShiftNext: "Mover palabra al siguiente",
        ttClearAll: "Borrar TODO el texto",
        ttDeleteSub: "Eliminar bloque de subtítulo",
        confirmClearAll: "¿Seguro? Esto borrará el texto de TODOS los subtítulos.",
        btnClear: "Borrar Texto",
        btnRecover: "Recuperar Texto",
        confirmRecover: "¿Restaurar texto original?",
        ttEditTime: "Clic para editar tiempos manualmente",
        btnUndo: "Deshacer",
        ttUndo: "Deshacer última acción (Ctrl+Z)",
        dontBreakDefaults: "el, la, los, las, un, una, unos, unas, y, o, pero, ni, que, a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, mi, tu, su, mis, tus, sus, un, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez"
    }
};

// 2. VARIABLES GLOBALES
let currentLang = 'en';
let audioData = null; 
let audioBlobUrl = null; 
let rawFileName = "subtitulos";
let audioDuration = 0;
let worker = null;
let startTime = 0;
let lastConsoleLine = null;
let cachedData = null; 

// Variables Editor
let wavesurfer = null;
let wsRegions = null;
let currentSubtitles = []; 
const ONE_FRAME = 0.04; 
let useFrames = false; 

// Estados Editor
let stopAtTime = null; 
let playbackMonitorId = null;
let focusedSubtitleIndex = -1;
let isTextCleared = false;
let textBackup = [];

// Historial (Undo)
let historyStack = [];
const MAX_HISTORY = 50;

// ICONOS SVG
const ICON_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"></path></svg>`;
const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>`;
const ICON_X = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>`;
const ICON_ERASER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M222.14,136.69,141.49,36.56a23.93,23.93,0,0,0-36.87-.21l-79.16,95A24,24,0,0,0,24,146.6V192a24,24,0,0,0,24,24H216a8,8,0,0,0,0-16H168V166.42l53.94-24.16A8,8,0,0,0,222.14,136.69ZM152,189.65V200H48a8,8,0,0,1-8-8V146.6a8,8,0,0,1,.53-2.85L127,151.78ZM116.35,51.81a8,8,0,0,1,12.3-.07L194.75,134,141.27,158Z"></path></svg>`;
const ICON_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path></svg>`;
const ICON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>`;
const ICON_UNDO = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M237.66,106.34a8,8,0,0,1-11.32,11.32L188,79.31V80a88,88,0,1,1-88-88,87.6,87.6,0,0,1,47.6,13.92,8,8,0,1,1-9.2,13.2A71.64,71.64,0,0,0,100,8,72,72,0,1,0,172,80v-.69l-38.34,38.35a8,8,0,0,1-11.32-11.32l52-52a8,8,0,0,1,11.32,0Z"></path></svg>`;
const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path></svg>`;
const ICON_WORD_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;
const ICON_WORD_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path></svg>`;

let els = {}; 

// 3. INICIALIZACIÓN SEGURA (DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    
    // Captura segura de elementos
    els = {
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
        
        uploadSection: document.getElementById('upload-section'),
        configPanel: document.getElementById('config-panel'),
        headerSection: document.getElementById('header-section'),
        editorContainer: document.getElementById('editor-container'),
        
        // Elementos que pueden no existir inicialmente
        videoPreview: document.getElementById('video-preview'),
        subtitleOverlay: document.getElementById('subtitle-overlay'),
        subtitleList: document.getElementById('subtitle-list'),
        downloadEditorSrt: document.getElementById('download-editor-srt'),
        backToConfigBtn: document.getElementById('back-to-config-btn'),
        zoomSlider: document.getElementById('zoom-slider'),
        clearTextBtn: document.getElementById('clear-text-btn'),
        tcFormatBtn: document.getElementById('tc-format-btn'), 
        currentTimeDisplay: document.getElementById('current-time-display'),
        
        dontBreakInput: document.getElementById('dont-break-on'),
        modeRadios: document.getElementsByName('proc_mode'),
        groqContainer: document.getElementById('groq-key-container'),
        localModelContainer: document.getElementById('local-model-container'),
        resultsArea: document.getElementById('results-area'),
        outputText: document.getElementById('output-text'),
        copyBtn: document.getElementById('copy-btn'),
        dlSrt: document.getElementById('download-srt-btn'),
        dlTxt: document.getElementById('download-txt-btn'),
        
        endPunctuationInput: document.getElementById('end-punctuation')
    };

    // Asegurar z-index del overlay vía JS para evitar problemas de CSS
    if(els.subtitleOverlay) {
        els.subtitleOverlay.style.zIndex = "50";
        els.subtitleOverlay.style.pointerEvents = "none";
    }

    // Inicializar Worker
    try {
        worker = new Worker('wp-worker.js', { type: 'module' });
        if(worker) setupWorkerListeners();
    } catch(e) {
        console.error("Worker Init Failed:", e);
    }

    // Listeners básicos
    if(els.dropZone) {
        els.dropZone.addEventListener('click', () => els.fileInput.click());
        els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-[#ffb81f]', 'bg-yellow-50'); });
        els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#ffb81f]', 'bg-yellow-50'); });
        els.dropZone.addEventListener('drop', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-[#ffb81f]', 'bg-pink-50'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    }
    if(els.fileInput) els.fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
    if(els.removeFile) els.removeFile.addEventListener('click', (e) => { e.stopPropagation(); resetFile(false); });
    if(els.resetBtn) els.resetBtn.addEventListener('click', () => resetFile(false)); 
    if(els.runBtn) els.runBtn.addEventListener('click', runProcess);

    if(els.langEn) els.langEn.addEventListener('click', () => setLanguage('en'));
    if(els.langEs) els.langEs.addEventListener('click', () => setLanguage('es'));
    if(els.modeRadios) els.modeRadios.forEach(radio => radio.addEventListener('change', (e) => updateModeUI(e.target.value)));
    
    // BOTÓN "READJUST PARAMETERS" (SOFT RESET)
    if(els.backToConfigBtn) {
        els.backToConfigBtn.addEventListener('click', () => {
            // Detener video
            if(els.videoPreview) els.videoPreview.pause();
            
            // Usamos resetFile(true) para mantener el archivo pero reiniciar la interfaz y el botón Start
            resetFile(true); 
            
            // Scroll arriba
            els.configPanel.scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (els.tcFormatBtn) {
        els.tcFormatBtn.addEventListener('click', () => {
            useFrames = !useFrames;
            els.tcFormatBtn.innerText = useFrames ? "HH:MM:SS:FF" : "HH:MM:SS:MSS";
            renderSubtitleList(); 
            if(els.videoPreview) updateCurrentTimeDisplay(els.videoPreview.currentTime);
        });
    }
    
    if(els.clearTextBtn) {
        injectUndoButton();

        els.clearTextBtn.addEventListener('click', () => {
            pushHistory();
            const t = translations[currentLang];
            if (isTextCleared) {
                if(confirm(t.confirmRecover)) {
                    currentSubtitles.forEach((sub, i) => { if (textBackup[i] !== undefined) sub.text = textBackup[i]; });
                    isTextCleared = false; renderSubtitleList(); updateSubtitleOverlay(els.videoPreview.currentTime); updateClearButtonUI();
                }
            } else {
                if(confirm(t.confirmClearAll)) {
                    textBackup = currentSubtitles.map(s => s.text);
                    currentSubtitles.forEach(s => s.text = "");
                    isTextCleared = true; renderSubtitleList(); updateSubtitleOverlay(els.videoPreview.currentTime); updateClearButtonUI();
                }
            }
        });
    }

    if(els.downloadEditorSrt) els.downloadEditorSrt.addEventListener('click', () => { const srt = generateSRT(currentSubtitles); download(srt, `${rawFileName}_edited.srt`); });

    if (els.zoomSlider) {
        els.zoomSlider.addEventListener('input', (e) => {
            if(wavesurfer) wavesurfer.zoom(Number(e.target.value));
        });
    }

    // LISTENER GLOBAL DE ATAJOS
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            window.undoAction();
        }
        
        // Navigation Alt+Up / Alt+Down
        if (e.altKey && e.key === 'ArrowUp') {
            e.preventDefault();
            let targetIdx = focusedSubtitleIndex !== -1 ? focusedSubtitleIndex : findCurrentSubIndex(els.videoPreview.currentTime);
            window.navSub(targetIdx, -1);
        }
        
        if (e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            let targetIdx = focusedSubtitleIndex !== -1 ? focusedSubtitleIndex : findCurrentSubIndex(els.videoPreview.currentTime);
            if(targetIdx === -1 && currentSubtitles.length > 0) targetIdx = -1; 
            window.navSub(targetIdx, 1);
        }
    });

    updateModeUI('groq');
    setLanguage('en');
}); 

// --- 4. FUNCIONES GLOBALES ---

// Encuentra el subtítulo activo o el más cercano anterior
function findCurrentSubIndex(time) {
    const idx = currentSubtitles.findIndex(s => time >= s.start && time <= s.end);
    if (idx !== -1) return idx;
    for (let i = currentSubtitles.length - 1; i >= 0; i--) {
        if (time >= currentSubtitles[i].end) return i;
    }
    return -1; 
}

function updateModeUI(mode) {
    if(!els.groqContainer) return;
    if (mode === 'groq') {
        els.groqContainer.classList.remove('hidden');
        els.localModelContainer.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) { label.classList.add('border-[#ffb81f]', 'shadow-md'); label.classList.remove('border-gray-200'); } 
            else { label.classList.remove('border-[#ffb81f]', 'shadow-md'); label.classList.add('border-gray-200'); }
        });
        const savedKey = localStorage.getItem('groq_api_key');
        const defaultKey = "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";
        if(document.getElementById('groq-key')) document.getElementById('groq-key').value = savedKey || defaultKey;
    } else {
        els.groqContainer.classList.add('hidden');
        els.localModelContainer.classList.remove('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="proc_mode"]').forEach(r => {
            const label = r.closest('label');
            if (r.checked) { label.classList.add('border-gray-400', 'shadow-md'); label.classList.remove('border-gray-200'); } 
            else { label.classList.remove('border-gray-400', 'shadow-md'); label.classList.add('border-gray-200'); }
        });
    }
}

function setLanguage(lang) {
    currentLang = lang; const t = translations[lang];
    if (lang === 'en') { els.langEn.classList.add('active'); els.langEs.classList.remove('active'); } 
    else { els.langEs.classList.add('active'); els.langEn.classList.remove('active'); }
    document.querySelectorAll('[data-key]').forEach(el => {
        if(el.tagName === 'OPTION') { el.text = translations[currentLang][el.dataset.key] || el.text; } 
        else if(translations[currentLang][el.dataset.key]) el.innerHTML = translations[currentLang][el.dataset.key];
    });
    const btnText = cachedData ? t.updateBtn : t.startBtn;
    if (audioData && els.runBtn) els.runBtn.querySelector('span').innerText = btnText;
    if(els.dontBreakInput) els.dontBreakInput.value = t.dontBreakDefaults;
    
    const undoBtn = document.getElementById('undo-btn');
    if(undoBtn) undoBtn.innerHTML = `${ICON_UNDO} ${t.btnUndo}`;
    
    updateClearButtonUI();
}

function resetFile(keepFile = false) {
    if (!keepFile) {
        audioData = null; 
        audioDuration = 0; 
        if(audioBlobUrl) { URL.revokeObjectURL(audioBlobUrl); audioBlobUrl = null; }
        if(els.fileInput) els.fileInput.value = '';
        els.fileInfo.classList.add('hidden'); 
        els.warning.classList.add('hidden');
        els.resetBtn.classList.add('hidden'); 
    }
    
    cachedData = null; // Borrar caché para obligar a reprocesar
    isTextCleared = false; 
    textBackup = [];
    historyStack = []; 
    
    els.runBtn.disabled = !audioData; 
    
    // RESTAURAR ESTADO DEL BOTÓN START
    if (audioData) {
         els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-[#ffb81f] hover:bg-[#e0a01a] hover:scale-[1.02] cursor-pointer";
    } else {
         els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-gray-300 text-gray-500 cursor-not-allowed";
    }

    els.runBtn.querySelector('span').innerText = translations[currentLang].startBtn;

    // Resetear UI
    els.editorContainer.classList.add('hidden');
    els.configPanel.classList.remove('hidden'); els.uploadSection.classList.remove('hidden');
    els.headerSection.classList.remove('hidden'); els.progressCont.classList.add('hidden');
    
    if(els.resultsArea) els.resultsArea.classList.add('hidden');
    if(wavesurfer) { wavesurfer.destroy(); wavesurfer = null; }
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> System ready...</div>';
}

async function handleFile(file) {
    resetFile(false); // Reset total para archivo nuevo
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    els.fileName.innerText = file.name;
    els.fileInfo.classList.remove('hidden');
    els.resetBtn.classList.remove('hidden');
    if (file.size > 500 * 1024 * 1024) els.warning.classList.remove('hidden'); 
    
    audioBlobUrl = URL.createObjectURL(file);
    els.videoPreview.src = audioBlobUrl;

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
        
        els.runBtn.disabled = false;
        els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-[#ffb81f] hover:bg-[#e0a01a] hover:scale-[1.02] cursor-pointer";
        els.runBtn.querySelector('span').innerText = t.startBtn;
    } catch (err) {
        logToConsole(`ERROR: ${err.message}`);
    }
}

async function runProcess() {
    if (!audioData) return;
    if (cachedData) {
        logToConsole("Updating segmentation..."); processResultsV9(cachedData); showEditor(); return;
    }
    const mode = document.querySelector('input[name="proc_mode"]:checked').value;
    const langSelect = document.getElementById('language-select').value;
    const task = document.getElementById('task-select').value;
    
    els.runBtn.disabled = true;
    els.runBtn.classList.remove('bg-[#ffb81f]', 'hover:bg-[#e0a01a]', 'hover:scale-[1.02]', 'cursor-pointer');
    els.runBtn.classList.add('bg-gray-300', 'cursor-not-allowed'); 
    
    if(els.resultsArea) els.resultsArea.classList.add('hidden');
    els.progressCont.classList.remove('hidden'); 
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
}

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
        els.runBtn.classList.add('bg-[#ffb81f]', 'hover:bg-[#e0a01a]', 'hover:scale-[1.02]', 'cursor-pointer');
    } catch (error) {
        logToConsole(`GROQ ERROR: ${error.message}`);
        els.runBtn.disabled = false;
    }
}

function setupWorkerListeners() {
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
}

// --- UTILS ---
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

// --- UNDO SYSTEM ---
function pushHistory() {
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyStack.push(JSON.parse(JSON.stringify(currentSubtitles)));
}

window.undoAction = () => {
    if (historyStack.length === 0) return;
    const previousState = historyStack.pop();
    currentSubtitles = previousState;
    renderSubtitleList();
    renderRegions(); 
    updateSubtitleOverlay(els.videoPreview.currentTime);
};

function injectUndoButton() {
    const clearBtn = document.getElementById('clear-text-btn');
    if(clearBtn && clearBtn.parentNode) {
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undo-btn';
        undoBtn.className = "text-xs bg-white text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition font-bold flex items-center gap-1 mr-2";
        undoBtn.innerHTML = `${ICON_UNDO} ${translations[currentLang].btnUndo}`;
        undoBtn.title = translations[currentLang].ttUndo;
        undoBtn.onclick = window.undoAction;
        clearBtn.parentNode.insertBefore(undoBtn, clearBtn);
    }
}

// --- EDITOR LOGIC ---

function showConfigPanel() {
    els.editorContainer.classList.add('hidden');
    els.configPanel.classList.remove('hidden');
    els.runBtn.scrollIntoView({ behavior: 'smooth' });
    const t = translations[currentLang];
    els.runBtn.querySelector('span').innerText = t.updateBtn;
}

function showEditor() {
    els.uploadSection.classList.add('hidden');
    els.configPanel.classList.add('hidden');
    els.headerSection.classList.add('hidden');
    els.progressCont.classList.add('hidden');
    if(els.resultsArea) els.resultsArea.classList.add('hidden');
    els.editorContainer.classList.remove('hidden');
    
    historyStack = [];
    
    if (!wavesurfer) initWaveSurfer();
    else { renderRegions(); renderSubtitleList(); }
    
    isTextCleared = false;
    updateClearButtonUI();
}

function toggleTimecodeFormat() {
    useFrames = !useFrames;
    els.tcFormatBtn.innerText = useFrames ? "HH:MM:SS:FF" : "HH:MM:SS:MSS";
    renderSubtitleList(); 
    if(els.videoPreview) updateCurrentTimeDisplay(els.videoPreview.currentTime);
}

function updateClearButtonUI() {
    if(!els.clearTextBtn) return;
    const t = translations[currentLang];
    if (isTextCleared) {
        els.clearTextBtn.className = "text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition flex items-center gap-2";
        els.clearTextBtn.innerHTML = `<i class="ph-bold ph-arrow-u-up-left"></i> ${t.btnRecover}`;
    } else {
        els.clearTextBtn.className = "text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition flex items-center gap-2";
        els.clearTextBtn.innerHTML = `<i class="ph-bold ph-eraser"></i> ${t.btnClear}`;
    }
}

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
    wavesurfer.setVolume(0);
    
    const video = els.videoPreview;
    
    wavesurfer.on('interaction', () => {
        video.currentTime = wavesurfer.getCurrentTime();
        updateCurrentTimeDisplay(video.currentTime);
    });

    video.addEventListener('timeupdate', () => {
        updateCurrentTimeDisplay(video.currentTime);

        if (stopAtTime !== null && video.currentTime >= stopAtTime) {
            video.pause(); video.currentTime = stopAtTime; stopAtTime = null;
        }
        if (!wavesurfer.isPlaying()) wavesurfer.setTime(video.currentTime);
        
        updateSubtitleOverlay(video.currentTime);
        highlightActiveSub(video.currentTime);
    });
    video.addEventListener('play', () => wavesurfer.play());
    video.addEventListener('pause', () => wavesurfer.pause());
    
    wavesurfer.on('ready', () => { wavesurfer.zoom(100); renderRegions(); renderSubtitleList(); });
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
            id: `sub-${index}`, start: sub.start, end: sub.end,
            content: contentDiv, color: 'rgba(255, 184, 31, 0.4)', drag: true, resize: true
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
                <div class="flex items-center gap-2" id="tc-container-${index}">
                    <button class="text-[#ffb81f] hover:text-[#e0a01a] transition outline-none" 
                            onmousedown="event.preventDefault(); window.playSingleSub(${index})" 
                            title="${t.ttPlaySegment}">
                        ${ICON_PLAY}
                    </button>
                    <span id="time-display-${index}" onclick="window.editTimecode(${index})" 
                          class="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono cursor-pointer hover:bg-gray-200 border border-transparent hover:border-gray-300 transition" 
                          title="${t.ttEditTime}">
                        ${fmtTimeShort(sub.start)} - ${fmtTimeShort(sub.end)}
                    </span>
                </div>
            </div>
            <textarea id="ta-${index}" class="w-full resize-none outline-none bg-transparent text-gray-800 font-medium mb-2 focus:bg-yellow-50 p-1 rounded" rows="2">${sub.text}</textarea>
            <div id="metrics-${index}" class="flex justify-between text-[10px] text-gray-400 font-mono border-t border-gray-100 pt-1 mb-2"></div>
            
            <div class="flex items-center gap-1 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                <div class="flex gap-px border border-gray-200 rounded overflow-hidden shrink-0">
                    <button class="px-1 py-1 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-[10px] font-bold w-6" onclick="window.nudge(${index}, -${ONE_FRAME}, 'start')" title="${t.ttNudgeStartM}">-[</button>
                    <button class="px-1 py-1 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-[10px] font-bold w-6" onclick="window.nudge(${index}, ${ONE_FRAME}, 'start')" title="${t.ttNudgeStartP}">+[</button>
                    <div class="w-px bg-gray-200"></div>
                    <button class="px-1 py-1 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-[10px] font-bold w-6" onclick="window.nudge(${index}, -${ONE_FRAME}, 'end')" title="${t.ttNudgeEndM}">-]</button>
                    <button class="px-1 py-1 hover:bg-gray-100 text-gray-500 hover:text-[#ffb81f] font-mono text-[10px] font-bold w-6" onclick="window.nudge(${index}, ${ONE_FRAME}, 'end')" title="${t.ttNudgeEndP}">+]</button>
                </div>
                
                <button class="p-1 text-gray-300 hover:text-red-500 transition shrink-0" onclick="window.deleteSub(${index})" title="${t.ttDeleteSub}">${ICON_TRASH}</button>
                
                <div class="w-px bg-gray-200 h-4 mx-0.5 shrink-0"></div>

                <div class="flex items-center gap-1 ml-auto shrink-0">
                    <button class="p-1 hover:text-red-500 text-gray-400" onclick="window.clearSubText(${index})" title="${t.ttClear}">${ICON_ERASER}</button>
                    <button class="p-1 bg-gray-50 hover:bg-purple-100 text-purple-600 rounded border border-gray-200 hover:border-purple-300 transition" onclick="window.shiftWord(${index}, -1)" title="${t.ttShiftPrev}">${ICON_WORD_LEFT}</button>
                    <button class="p-1 bg-gray-50 hover:bg-purple-100 text-purple-600 rounded border border-gray-200 hover:border-purple-300 transition" onclick="window.shiftWord(${index}, 1)" title="${t.ttShiftNext}">${ICON_WORD_RIGHT}</button>
                    <div class="w-px bg-gray-200 h-4 mx-0.5"></div>
                    <button class="p-1 hover:text-blue-500 text-gray-400" onclick="window.navSub(${index}, -1)" title="${t.ttPrev}">${ICON_UP}</button>
                    <button class="p-1 hover:text-blue-500 text-gray-400" onclick="window.navSub(${index}, 1)" title="${t.ttNext}">${ICON_DOWN}</button>
                </div>
            </div>
        `;
        const ta = div.querySelector('textarea');
        
        let initialText = "";
        ta.addEventListener('focus', () => { 
            focusedSubtitleIndex = index;
            initialText = sub.text;
        });
        
        ta.addEventListener('blur', () => { 
            focusedSubtitleIndex = -1; 
            if(sub.text !== initialText) {
                const newText = sub.text;
                sub.text = initialText;
                pushHistory(); 
                sub.text = newText; 
            }
        });

        ta.addEventListener('input', () => { 
            sub.text = ta.value; 
            updateSubtitleOverlay(els.videoPreview.currentTime); 
            updateMetrics(index); 
        });

        div.addEventListener('click', (e) => { 
             if(e.target.closest('input') || e.target.closest('button') || e.target.tagName === 'TEXTAREA') return;
             els.videoPreview.currentTime = sub.start; 
        });
        els.subtitleList.appendChild(div);
        updateMetrics(index);
    });
}

function updateMetrics(index) {
    const sub = currentSubtitles[index];
    if (!sub) return;
    const div = document.getElementById(`metrics-${index}`);
    if(!div) return;
    
    const lines = sub.text.split('\n');
    const maxLineLen = Math.max(...lines.map(l => l.length), 0);
    
    const duration = sub.end - sub.start;
    const charCount = sub.text.replace(/\n/g, '').length;
    const cps = duration > 0 ? (charCount / duration).toFixed(1) : 0;
    
    let cpsColor = "text-gray-400";
    if(cps > 20) cpsColor = "text-red-500 font-bold";
    else if(cps > 15) cpsColor = "text-orange-400";
    
    div.innerHTML = `
        <span class="${maxLineLen > 42 ? 'text-red-500 font-bold' : ''}">CPL: ${maxLineLen}</span>
        <span class="${cpsColor}">CPS: ${cps}</span>
    `;
}

function highlightActiveSub(time) {
    if(focusedSubtitleIndex !== -1 && els.videoPreview.paused) return;

    currentSubtitles.forEach((sub, i) => {
        const card = document.getElementById(`card-sub-${i}`);
        if (!card) return;
        
        if (time >= sub.start && time <= sub.end) {
            if (!card.classList.contains('sub-card-active')) {
                card.classList.add('sub-card-active');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            card.classList.remove('sub-card-active');
        }
    });
}

// GLOBAL HELPERS
window.editTimecode = (index) => {
    pushHistory();
    const container = document.getElementById(`tc-container-${index}`);
    const sub = currentSubtitles[index];
    if (!container) return;
    container.dataset.original = container.innerHTML;
    container.innerHTML = `
        <div class="flex items-center gap-1 bg-white p-1 rounded border border-[#ffb81f] shadow-sm">
            <input type="text" id="start-in-${index}" value="${fmtTimeShort(sub.start)}" class="w-24 text-xs font-mono border border-gray-300 rounded px-1 py-1 focus:border-[#ffb81f] outline-none text-center">
            <span class="text-xs text-gray-400">-</span>
            <input type="text" id="end-in-${index}" value="${fmtTimeShort(sub.end)}" class="w-24 text-xs font-mono border border-gray-300 rounded px-1 py-1 focus:border-[#ffb81f] outline-none text-center">
            <button onclick="window.saveTimecode(${index})" class="text-green-500 hover:text-green-700 ml-1 p-1 bg-green-50 rounded border border-green-200">${ICON_CHECK}</button>
            <button onclick="window.cancelEditTimecode(${index})" class="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded border border-red-200">${ICON_X}</button>
        </div>
    `;
    const input = container.querySelector('input');
    if(input) input.focus();
    container.onclick = (e) => e.stopPropagation();
};

window.cancelEditTimecode = (index) => {
    const container = document.getElementById(`tc-container-${index}`);
    if (container && container.dataset.original) container.innerHTML = container.dataset.original;
};

window.saveTimecode = (index) => {
    const startVal = document.getElementById(`start-in-${index}`).value;
    const endVal = document.getElementById(`end-in-${index}`).value;
    const newStart = parseTimeStr(startVal);
    const newEnd = parseTimeStr(endVal);

    if (newStart !== null && newEnd !== null && newStart < newEnd) {
        currentSubtitles[index].start = newStart;
        currentSubtitles[index].end = newEnd;
        if(wsRegions) {
            const region = wsRegions.getRegions().find(r => r.id === `sub-${index}`);
            if(region) region.setOptions({ start: newStart, end: newEnd });
        }
        const container = document.getElementById(`tc-container-${index}`);
        const t = translations[currentLang];
        container.innerHTML = `
            <button class="text-[#ffb81f] hover:text-[#e0a01a] transition outline-none" onmousedown="event.preventDefault(); window.playSingleSub(${index})" title="${t.ttPlaySegment}">${ICON_PLAY}</button>
            <span id="time-display-${index}" onclick="window.editTimecode(${index})" class="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono cursor-pointer hover:bg-gray-200 border border-transparent hover:border-gray-300 transition" title="${t.ttEditTime}">${fmtTimeShort(newStart)} - ${fmtTimeShort(newEnd)}</span>
        `;
        updateMetrics(index);
    } else { alert("Invalid time format."); }
};

window.nudge = (index, amount, side) => {
    pushHistory(); 
    if(!currentSubtitles[index]) return;
    if(side === 'start') {
        currentSubtitles[index].start = Math.max(0, currentSubtitles[index].start + amount);
        if(currentSubtitles[index].start >= currentSubtitles[index].end) currentSubtitles[index].start = currentSubtitles[index].end - 0.1; 
    } else {
        currentSubtitles[index].end = Math.max(currentSubtitles[index].start + 0.1, currentSubtitles[index].end + amount);
    }
    if(wsRegions) {
        const region = wsRegions.getRegions().find(r => r.id === `sub-${index}`);
        if(region) region.setOptions({ start: currentSubtitles[index].start, end: currentSubtitles[index].end });
    }
    const timeSpan = document.getElementById(`time-display-${index}`);
    if(timeSpan) timeSpan.innerText = `${fmtTimeShort(currentSubtitles[index].start)} - ${fmtTimeShort(currentSubtitles[index].end)}`;
    updateMetrics(index);
};

window.playSingleSub = (index) => {
    if(!currentSubtitles[index]) return;
    const sub = currentSubtitles[index];
    if(playbackMonitorId) cancelAnimationFrame(playbackMonitorId);
    stopAtTime = sub.end;
    
    if (wavesurfer) wavesurfer.setTime(sub.start);
    els.videoPreview.currentTime = sub.start;
    els.videoPreview.play();
    
    const checkTime = () => {
        if (els.videoPreview.paused) return;
        if (els.videoPreview.currentTime >= stopAtTime) {
            els.videoPreview.pause();
            els.videoPreview.currentTime = stopAtTime;
            stopAtTime = null;
        } else {
            playbackMonitorId = requestAnimationFrame(checkTime);
        }
    };
    playbackMonitorId = requestAnimationFrame(checkTime);
};

window.playSub = (index) => { if(!currentSubtitles[index]) return; els.videoPreview.currentTime = currentSubtitles[index].start; els.videoPreview.play(); };

window.navSub = (index, dir) => {
    const newIndex = index + dir;
    if(newIndex >= 0 && newIndex < currentSubtitles.length) { 
        // 1. Desplazamiento
        const card = document.getElementById(`card-sub-${newIndex}`);
        card.scrollIntoView({behavior: "smooth", block: "center"});
        
        // 2. Reproducción
        window.playSingleSub(newIndex);
        
        // 3. Auto-foco
        setTimeout(() => {
            const textarea = document.getElementById(`ta-${newIndex}`);
            if(textarea) {
                textarea.focus();
            }
        }, 100);
    }
};

window.deleteSub = (index) => {
    pushHistory();
    currentSubtitles.splice(index, 1);
    
    renderSubtitleList();
    renderRegions(); 
    
    updateSubtitleOverlay(els.videoPreview.currentTime);
};

window.clearSubText = (index) => { 
    pushHistory(); 
    if(currentSubtitles[index]) { currentSubtitles[index].text = ""; document.getElementById(`ta-${index}`).value = ""; updateMetrics(index); updateSubtitleOverlay(els.videoPreview.currentTime); } 
};

window.shiftWord = (index, dir) => {
    pushHistory();

    if(dir === -1 && index > 0) { 
        const currentText = currentSubtitles[index].text;
        const prevText = currentSubtitles[index-1].text;
        const match = currentText.match(/^(\S+)(\s*)/); 
        
        if(match) {
            const word = match[1];
            currentSubtitles[index].text = currentText.substring(match[0].length);
            const spacer = prevText.trim().length > 0 ? " " : "";
            currentSubtitles[index-1].text = prevText.trimEnd() + spacer + word;
            document.getElementById(`ta-${index}`).value = currentSubtitles[index].text; 
            document.getElementById(`ta-${index-1}`).value = currentSubtitles[index-1].text;
            updateMetrics(index); updateMetrics(index-1);
        }

    } else if (dir === 1 && index < currentSubtitles.length - 1) { 
        const currentText = currentSubtitles[index].text;
        const nextText = currentSubtitles[index+1].text;
        const match = currentText.match(/(\S+)\s*$/);

        if(match) {
            const word = match[1];
            const wordIndex = match.index;
            currentSubtitles[index].text = currentText.substring(0, wordIndex).trimEnd();
            const spacer = nextText.trim().length > 0 ? " " : "";
            currentSubtitles[index+1].text = word + spacer + nextText.trimStart();
            document.getElementById(`ta-${index}`).value = currentSubtitles[index].text; 
            document.getElementById(`ta-${index+1}`).value = currentSubtitles[index+1].text;
            updateMetrics(index); updateMetrics(index+1);
        }
    }
    updateSubtitleOverlay(els.videoPreview.currentTime);
};

function updateSubtitleOverlay(time) {
    const activeSub = currentSubtitles.find(s => time >= s.start && time <= s.end);
    
    if(activeSub && activeSub.text.trim() !== "") {
        els.subtitleOverlay.innerText = activeSub.text;
        
        // Forzar visibilidad y estilo
        els.subtitleOverlay.style.display = "block";
        els.subtitleOverlay.style.opacity = "1";
        els.subtitleOverlay.style.background = "rgba(0,0,0,0.6)";
        els.subtitleOverlay.style.textShadow = "2px 2px 3px black";
        
    } else {
        els.subtitleOverlay.style.opacity = "0";
    }
    
    highlightActiveSub(time);
}

function updateCurrentTimeDisplay(time) {
    if(els.currentTimeDisplay) els.currentTimeDisplay.innerText = fmtTimeShort(time);
}
function parseTimeStr(timeStr) {
    try {
        const parts = timeStr.trim().split(':');
        let seconds = 0;
        if (useFrames && parts.length === 4) {
            seconds += parseInt(parts[0]) * 3600; seconds += parseInt(parts[1]) * 60; seconds += parseInt(parts[2]); seconds += parseInt(parts[3]) * 0.04; return seconds;
        }
        if (parts.length === 3) {
            const secParts = parts[2].split('.');
            seconds += parseInt(parts[0]) * 3600; seconds += parseInt(parts[1]) * 60; seconds += parseInt(secParts[0]);
            if(secParts[1]) seconds += parseFloat("0." + secParts[1]);
        } else if (parts.length === 2) {
            const secParts = parts[1].split('.');
            seconds += parseInt(parts[0]) * 60; seconds += parseInt(secParts[0]);
            if(secParts[1]) seconds += parseFloat("0." + secParts[1]);
        }
        return isNaN(seconds) ? null : seconds;
    } catch (e) { return null; }
}

function processResultsV9(data) {
    const maxCPL = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;
    const dontBreakStr = document.getElementById('dont-break-on').value;
    const dontBreakList = [...dontBreakStr.split(','), "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "zero"].map(s => s.trim().toLowerCase()).filter(s => s);
    
    let punctuationStr = ".?!:…";
    if (els.endPunctuationInput && els.endPunctuationInput.value) {
        punctuationStr = els.endPunctuationInput.value;
    }
    const strongPunct = punctuationStr.split('');

    let allWords = [];
    if (data.chunks) { data.chunks.forEach(chunk => { let start = chunk.timestamp[0]; let end = chunk.timestamp[1]; if (start !== null && end !== null) allWords.push({ word: chunk.text, start: start, end: end }); }); }
    
    let subs = createSrtV9(allWords, maxCPL, maxLines, minDurVal, dontBreakList, strongPunct);
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);
    const task = document.getElementById('task-select').value;
    if (task === 'spotting') subs.forEach(s => s.text = "");
    currentSubtitles = subs;
    isTextCleared = false; textBackup = []; 
    
    if(!document.getElementById('undo-btn')) injectUndoButton();
    updateClearButtonUI();
}

function createSrtV9(words, maxCpl, maxLines, minDur, dontBreakList, strongPunct) {
    const subtitles = []; let buffer = []; let startTime = null; 
    const maxChars = maxCpl * maxLines;
    const endsSentence = (w) => {
        const lastChar = w.word.trim().slice(-1);
        return strongPunct.includes(lastChar);
    };

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

function generateSRT(segs) { return segs.map((s, i) => `${i+1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}\n`).join('\n'); }
function fmtTime(s) { if (typeof s !== 'number' || isNaN(s)) return "00:00:00,000"; const d = new Date(s * 1000); return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')},${String(d.getUTCMilliseconds()).padStart(3,'0')}`; }
function fmtTimeShort(s) {
    const d = new Date(s * 1000);
    const hours = String(Math.floor(s / 3600)).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    if (useFrames) {
        const frames = Math.floor((s % 1) * 25);
        return `${hours}:${minutes}:${seconds}:${String(frames).padStart(2, '0')}`;
    } else {
        const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }
}
function download(content, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'})); a.download = name; a.click(); }
setLanguage('en');
