// wp-main.js - V7.5 (STABLE & ROBUST: Fixed DropZone, Safe Selectors, Error Proofing)

// ==========================================
// 1. VARIABLES GLOBALES (CRÍTICO: DEFINIDAS AL INICIO)
// ==========================================

// Elementos del DOM
let els = {}; 

// Estado de la Aplicación
let currentLang = 'en';
let audioData = null; 
let audioBlobUrl = null; 
let rawFileName = "subtitulos";
let audioDuration = 0;
let worker = null;
let cachedData = null; 

// Estado del Editor
let wavesurfer = null;
let wsRegions = null;
let currentSubtitles = []; 
const ONE_FRAME = 0.04; 
let useFrames = false; 
let stopAtTime = null; 
let playbackMonitorId = null;
let focusedSubtitleIndex = -1;
let isTextCleared = false;
let textBackup = [];

// Historial y Consola
let historyStack = [];
const MAX_HISTORY = 50;
let lastConsoleLine = null; 

// Configuración por defecto
const DEFAULT_SHORTCUTS = {
    playSegment: { keys: ['Alt', 'o'], code: 'KeyO', alt: true },
    playPause:   { keys: ['Alt', 'p'], code: 'KeyP', alt: true },
    editStart:   { keys: ['Alt', 'w'], code: 'KeyW', alt: true },
    editEnd:     { keys: ['Alt', 'e'], code: 'KeyE', alt: true },
    navPrev:     { keys: ['Alt', 'ArrowUp'], code: 'ArrowUp', alt: true },
    navNext:     { keys: ['Alt', 'ArrowDown'], code: 'ArrowDown', alt: true },
    undo:        { keys: ['Ctrl', 'z'], code: 'KeyZ', ctrl: true },
    nudgeStartM: { keys: ['Numpad4'], code: 'Numpad4' },
    nudgeEndM:   { keys: ['Numpad5'], code: 'Numpad5' },
    nudgeStartP: { keys: ['Numpad7'], code: 'Numpad7' },
    nudgeEndP:   { keys: ['Numpad8'], code: 'Numpad8' }
};

// Carga segura de LocalStorage
let userShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
try {
    const saved = localStorage.getItem('panda_shortcuts');
    if (saved) userShortcuts = JSON.parse(saved);
} catch(e) { console.warn("Error loading shortcuts:", e); }

let qaSettings = { maxCPL: 42, maxCPS: 20 };

// Traducciones
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
        ttPlaySegment: "Play subtitle (Alt+O)",
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
        btnShortcuts: "Shortcuts",
        btnQA: "QA Settings",
        qaTitle: "Quality Assurance Settings",
        shortcutsTitle: "Keyboard Shortcuts",
        lblMaxCpl: "Max CPL (Warning limit)",
        lblMaxCps: "Max CPS (Warning limit)",
        save: "Save",
        reset: "Reset Defaults",
        pressKey: "Press new key combination...",
        
        act_playSegment: "Play Current Subtitle",
        act_playPause: "Play / Pause Video",
        act_editStart: "Edit Start Time",
        act_editEnd: "Edit End Time",
        act_navPrev: "Previous Subtitle",
        act_navNext: "Next Subtitle",
        act_nudgeStartM: "-1 Frame Start",
        act_nudgeStartP: "+1 Frame Start",
        act_nudgeEndM: "-1 Frame End",
        act_nudgeEndP: "+1 Frame End",
        act_undo: "Undo Action",

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
        ttPlaySegment: "Reproducir subtítulo (Alt+O)",
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
        btnShortcuts: "Atajos",
        btnQA: "Configuración QA",
        qaTitle: "Ajustes de Control de Calidad",
        shortcutsTitle: "Atajos de Teclado",
        lblMaxCpl: "Máx CPL (Límite de aviso)",
        lblMaxCps: "Máx CPS (Límite de aviso)",
        save: "Guardar",
        reset: "Restaurar",
        pressKey: "Pulsa la nueva combinación...",
        
        act_playSegment: "Reproducir Subtítulo Actual",
        act_playPause: "Play / Pause General",
        act_editStart: "Modificar Tiempo Entrada",
        act_editEnd: "Modificar Tiempo Salida",
        act_navPrev: "Subtítulo Anterior",
        act_navNext: "Siguiente Subtítulo",
        act_nudgeStartM: "-1 Frame Inicio",
        act_nudgeStartP: "+1 Frame Inicio",
        act_nudgeEndM: "-1 Frame Fin",
        act_nudgeEndP: "+1 Frame Fin",
        act_undo: "Deshacer acción",

        dontBreakDefaults: "el, la, los, las, un, una, unos, unas, y, o, pero, ni, que, a, ante, bajo, cabe, con, contra, de, desde, en, entre, hacia, hasta, para, por, según, sin, so, sobre, tras, mi, tu, su, mis, tus, sus, un, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez"
    }
};

// ICONOS
const ICON_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"></path></svg>`;
const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg>`;
const ICON_X = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>`;
const ICON_ERASER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152.06A16,16,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.31L227.31,96A16,16,0,0,0,227.32,73.37ZM99.31,208H48V163.31l88-88L187.31,126.63Z"></path></svg>`;
const ICON_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path></svg>`;
const ICON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>`;
const ICON_UNDO = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M237.66,106.34a8,8,0,0,1-11.32,11.32L188,79.31V80a88,88,0,1,1-88-88,87.6,87.6,0,0,1,47.6,13.92,8,8,0,1,1-9.2,13.2A71.64,71.64,0,0,0,100,8,72,72,0,1,0,172,80v-.69l-38.34,38.35a8,8,0,0,1-11.32-11.32l52-52a8,8,0,0,1,11.32,0Z"></path></svg>`;
const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path></svg>`;
const ICON_WORD_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;
const ICON_WORD_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path></svg>`;
const ICON_GEAR = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M225.6,71.55l-22.37-3.76a77.89,77.89,0,0,0-10.86-18.72l12.44-18.73a8,8,0,0,0-2-10.74l-21.72-14.59a8,8,0,0,0-10.82,2L156.9,23.51a78.1,78.1,0,0,0-21.66,0L121.89,7a8,8,0,0,0-10.82-2L89.35,19.58a8,8,0,0,0-2,10.74L99.79,49.07A77.89,77.89,0,0,0,88.93,67.79L66.56,71.55a8,8,0,0,0-6.66,7.88V105.7a8,8,0,0,0,6.66,7.89l22.37,3.76a78.29,78.29,0,0,0,0,43.32l-22.37,3.76a8,8,0,0,0-6.66,7.89v26.27a8,8,0,0,0,6.66,7.88l22.37,3.76a77.89,77.89,0,0,0,10.86,18.72l-12.44,18.73a8,8,0,0,0,2,10.74l21.72,14.59a8,8,0,0,0,10.82-2l13.37-16.5a78.1,78.1,0,0,0,21.66,0l13.35,16.5a8,8,0,0,0,10.82-2l21.72-14.59a8,8,0,0,0,2-10.74l-12.44-18.73a77.89,77.89,0,0,0,10.86-18.72l22.37-3.76a8,8,0,0,0,6.66-7.88V125.18A8,8,0,0,0,225.6,71.55ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"></path></svg>`;
const ICON_KEYBOARD = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM64,120a8,8,0,0,1-8-8V96a8,8,0,0,1,16,0v16A8,8,0,0,1,64,120Zm0,48a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v16A8,8,0,0,1,64,168Zm40,0a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v16A8,8,0,0,1,104,168Zm0-48a8,8,0,0,1-8-8V96a8,8,0,0,1,16,0v16A8,8,0,0,1,104,120Zm48,48a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v16A8,8,0,0,1,152,168Zm0-48a8,8,0,0,1-8-8V96a8,8,0,0,1,16,0v16A8,8,0,0,1,152,120Zm48,48a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v16A8,8,0,0,1,200,168Zm0-48a8,8,0,0,1-8-8V96a8,8,0,0,1,16,0v16A8,8,0,0,1,200,120Z"></path></svg>`;

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 2.1 Capturar Referencias
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

    // 2.2 Fix Overlay Z-Index
    if(els.subtitleOverlay) {
        els.subtitleOverlay.style.zIndex = "50";
        els.subtitleOverlay.style.pointerEvents = "none";
    }

    // 2.3 Worker Init
    try {
        worker = new Worker('wp-worker.js', { type: 'module' });
        if(worker) setupWorkerListeners();
    } catch(e) { console.error("Worker Init Failed:", e); }

    // 2.4 Inject Dynamic UI
    injectHeaderButtons();
    injectModals();

    // 2.5 Event Listeners
    if(els.dropZone) {
        els.dropZone.addEventListener('click', () => {
            if(els.fileInput) els.fileInput.click();
        });
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
    
    if(els.backToConfigBtn) {
        els.backToConfigBtn.addEventListener('click', () => {
            if(els.videoPreview) els.videoPreview.pause();
            resetFile(true); // Soft Reset
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

    document.addEventListener('keydown', handleGlobalKeydown);

    // Initial Setup
    updateModeUI('groq');
    setLanguage('en');
    resetFile(false); // Force clean state
}); 

// ==========================================
// 3. UI INJECTION & MODALS
// ==========================================

function injectHeaderButtons() {
    const langBtn = document.getElementById('lang-en');
    if (!langBtn) return;
    const parent = langBtn.parentElement;
    if (!parent) return;
    
    // Check if already injected
    if(document.getElementById('btn-qa')) return;

    const container = document.createElement('div');
    container.className = "flex gap-2 mr-2";
    
    const btnQA = document.createElement('button');
    btnQA.id = "btn-qa";
    btnQA.className = "lang-btn px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1 bg-white/50 hover:bg-white";
    btnQA.innerHTML = `${ICON_GEAR} <span class="hidden sm:inline" data-key="btnQA">QA</span>`;
    btnQA.onclick = () => document.getElementById('modal-qa').classList.remove('hidden');
    
    const btnSC = document.createElement('button');
    btnSC.id = "btn-shortcuts";
    btnSC.className = "lang-btn px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1 bg-white/50 hover:bg-white";
    btnSC.innerHTML = `${ICON_KEYBOARD} <span class="hidden sm:inline" data-key="btnShortcuts">Shortcuts</span>`;
    btnSC.onclick = () => {
        renderShortcutsTable();
        document.getElementById('modal-shortcuts').classList.remove('hidden');
    };

    container.appendChild(btnQA);
    container.appendChild(btnSC);
    parent.parentNode.insertBefore(container, parent);
}

function injectModals() {
    if(document.getElementById('modal-qa')) return;

    const qaModal = document.createElement('div');
    qaModal.id = "modal-qa";
    qaModal.className = "fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center backdrop-blur-sm";
    qaModal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 w-96 shadow-2xl transform transition-all scale-100">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">${ICON_GEAR} <span data-key="qaTitle">QA Settings</span></h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-600 mb-1" data-key="lblMaxCpl">Max CPL</label>
                    <input type="number" id="qa-cpl" class="w-full p-2 border rounded" value="${qaSettings.maxCPL}">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-600 mb-1" data-key="lblMaxCps">Max CPS</label>
                    <input type="number" id="qa-cps" class="w-full p-2 border rounded" value="${qaSettings.maxCPS}">
                </div>
            </div>
            <div class="mt-6 flex justify-end gap-2">
                <button class="px-4 py-2 bg-gray-200 rounded font-bold hover:bg-gray-300 transition" onclick="closeQAModal()">Close</button>
                <button class="px-4 py-2 bg-[#ffb81f] rounded font-bold hover:bg-[#e0a01a] transition" onclick="saveQASettings()" data-key="save">Save</button>
            </div>
        </div>
    `;
    
    const scModal = document.createElement('div');
    scModal.id = "modal-shortcuts";
    scModal.className = "fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center backdrop-blur-sm";
    scModal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">${ICON_KEYBOARD} <span data-key="shortcutsTitle">Keyboard Shortcuts</span></h3>
            <div class="overflow-y-auto flex-1 border border-gray-100 rounded-lg p-2" id="sc-list"></div>
            <div class="mt-4 flex justify-between items-center">
                <button class="text-xs text-red-500 font-bold hover:underline" onclick="resetShortcuts()" data-key="reset">Reset Defaults</button>
                <button class="px-4 py-2 bg-gray-800 text-white rounded font-bold hover:bg-gray-700 transition" onclick="document.getElementById('modal-shortcuts').classList.add('hidden')">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(qaModal);
    document.body.appendChild(scModal);
}

// Logic for Modals
window.closeQAModal = () => document.getElementById('modal-qa').classList.add('hidden');
window.saveQASettings = () => {
    qaSettings.maxCPL = parseInt(document.getElementById('qa-cpl').value) || 42;
    qaSettings.maxCPS = parseInt(document.getElementById('qa-cps').value) || 20;
    closeQAModal();
    renderSubtitleList(); 
};

function renderShortcutsTable() {
    const list = document.getElementById('sc-list');
    list.innerHTML = '';
    const t = translations[currentLang];
    
    Object.keys(userShortcuts).forEach(action => {
        const sc = userShortcuts[action];
        const row = document.createElement('div');
        row.className = "flex justify-between items-center p-2 hover:bg-gray-50 border-b border-gray-100 last:border-0";
        
        const label = t[`act_${action}`] || action;
        let keysDisplay = sc.keys.join(' + ');
        if(action.startsWith('nudge')) keysDisplay = sc.code; 

        row.innerHTML = `
            <span class="text-sm font-medium text-gray-700">${label}</span>
            <button class="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded border border-gray-200 hover:bg-[#ffb81f] hover:border-yellow-400 group transition" onclick="remapShortcut('${action}')">
                <span class="font-mono text-xs font-bold text-gray-600 group-hover:text-black">${keysDisplay}</span>
                <i class="ph-bold ph-pencil-simple text-gray-400 group-hover:text-black"></i>
            </button>
        `;
        list.appendChild(row);
    });
}

window.remapShortcut = (action) => {
    const btn = event.currentTarget;
    btn.innerHTML = `<span class="text-xs font-bold animate-pulse text-red-600">${translations[currentLang].pressKey}</span>`;
    
    const handler = (e) => {
        e.preventDefault(); e.stopPropagation();
        
        const newSc = { code: e.code, keys: [] };
        if(e.ctrlKey) newSc.keys.push('Ctrl');
        if(e.altKey) newSc.keys.push('Alt');
        if(e.shiftKey) newSc.keys.push('Shift');
        
        let keyLabel = e.key.toUpperCase();
        if(e.code.startsWith('Numpad')) keyLabel = e.code;
        else if(e.code.startsWith('Arrow')) keyLabel = e.code;
        else if(e.key === ' ') keyLabel = 'Space';
        
        if(!['Control','Alt','Shift'].includes(e.key)) {
            newSc.keys.push(keyLabel);
            userShortcuts[action] = { 
                code: e.code, 
                keys: newSc.keys,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                shift: e.shiftKey
            };
            localStorage.setItem('panda_shortcuts', JSON.stringify(userShortcuts));
            renderShortcutsTable();
            document.removeEventListener('keydown', handler, true);
        }
    };
    document.addEventListener('keydown', handler, true);
};

window.resetShortcuts = () => {
    if(confirm("Reset all shortcuts?")) {
        userShortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
        localStorage.setItem('panda_shortcuts', JSON.stringify(userShortcuts));
        renderShortcutsTable();
    }
};

function handleGlobalKeydown(e) {
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
    
    for (const [action, sc] of Object.entries(userShortcuts)) {
        if (e.code === sc.code && !!e.ctrlKey === !!sc.ctrl && !!e.altKey === !!sc.alt && !!e.shiftKey === !!sc.shift) {
            if(isInput && !['navPrev', 'navNext', 'playSegment', 'playPause', 'undo'].includes(action)) continue; 
            e.preventDefault();
            executeAction(action);
            return;
        }
    }
}

function executeAction(action) {
    let index = focusedSubtitleIndex !== -1 ? focusedSubtitleIndex : findCurrentSubIndex(els.videoPreview.currentTime);
    
    switch(action) {
        case 'playSegment': if(index !== -1) window.playSingleSub(index); break;
        case 'playPause': if(els.videoPreview.paused) els.videoPreview.play(); else els.videoPreview.pause(); break;
        case 'navPrev': window.navSub(index !== -1 ? index : 0, -1); break;
        case 'navNext': window.navSub(index !== -1 ? index : -1, 1); break;
        case 'undo': window.undoAction(); break;
        case 'editStart':
            if(index !== -1) {
                if(!document.getElementById(`start-in-${index}`)) window.editTimecode(index);
                setTimeout(() => document.getElementById(`start-in-${index}`)?.focus(), 50);
            }
            break;
        case 'editEnd':
            if(index !== -1) {
                if(!document.getElementById(`end-in-${index}`)) window.editTimecode(index);
                setTimeout(() => document.getElementById(`end-in-${index}`)?.focus(), 50);
            }
            break;
        case 'nudgeStartM': if(index !== -1) window.nudge(index, -ONE_FRAME, 'start'); break;
        case 'nudgeStartP': if(index !== -1) window.nudge(index, ONE_FRAME, 'start'); break;
        case 'nudgeEndM': if(index !== -1) window.nudge(index, -ONE_FRAME, 'end'); break;
        case 'nudgeEndP': if(index !== -1) window.nudge(index, ONE_FRAME, 'end'); break;
    }
}

// ==========================================
// 4. FUNCIONES DE PROCESO
// ==========================================

function resetFile(keepFile = false) {
    cachedData = null;
    isTextCleared = false;
    textBackup = [];
    historyStack = [];
    
    if (!keepFile) {
        // RESET TOTAL
        audioData = null;
        audioDuration = 0;
        if(audioBlobUrl) { URL.revokeObjectURL(audioBlobUrl); audioBlobUrl = null; }
        if(els.fileInput) els.fileInput.value = '';
        
        // Restaurar zona de drop
        if(els.dropZone) {
            els.dropZone.classList.remove('hidden', 'border-0');
            Array.from(els.dropZone.children).forEach(child => child.classList.remove('hidden'));
            if(els.fileInfo) els.fileInfo.classList.add('hidden');
        }
        if(els.resetBtn) els.resetBtn.classList.add('hidden');
    } else {
        // SOFT RESET
        if(els.dropZone) {
            Array.from(els.dropZone.children).forEach(child => {
                if(child.id !== 'file-info' && child.tagName !== 'INPUT') {
                    child.classList.add('hidden');
                }
            });
            els.dropZone.classList.add('border-0'); 
            els.dropZone.classList.remove('hidden');
        }
        if(els.fileInfo) els.fileInfo.classList.remove('hidden');
        if(els.resetBtn) els.resetBtn.classList.remove('hidden');
    }

    // Gestionar Botón Start
    if(els.runBtn) {
        els.runBtn.disabled = !audioData;
        if (audioData) {
             els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-[#ffb81f] hover:bg-[#e0a01a] hover:scale-[1.02] cursor-pointer";
        } else {
             els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-gray-300 text-gray-500 cursor-not-allowed";
        }
        els.runBtn.querySelector('span').innerText = translations[currentLang].startBtn;
    }

    // Visibilidad de Secciones
    els.editorContainer.classList.add('hidden');
    els.configPanel.classList.remove('hidden');
    els.uploadSection.classList.remove('hidden'); 
    els.headerSection.classList.remove('hidden');
    els.progressCont.classList.add('hidden'); 
    
    if(els.resultsArea) els.resultsArea.classList.add('hidden');
    if(wavesurfer) { wavesurfer.destroy(); wavesurfer = null; }
    if(els.consoleOutput) els.consoleOutput.innerHTML = '<div class="opacity-50">> System ready...</div>';
}

async function handleFile(file) {
    // Esconder warning inicial
    if(els.warning) els.warning.classList.add('hidden');
    
    resetFile(false); 
    const t = translations[currentLang];
    rawFileName = file.name.split('.').slice(0, -1).join('.');
    if(els.fileName) els.fileName.innerText = file.name;
    if(els.fileInfo) els.fileInfo.classList.remove('hidden');
    if(els.resetBtn) els.resetBtn.classList.remove('hidden');
    
    // Warning de tamaño
    if (file.size > 500 * 1024 * 1024) {
        if(els.warning) els.warning.classList.remove('hidden');
    }
    
    audioBlobUrl = URL.createObjectURL(file);
    if(els.videoPreview) els.videoPreview.src = audioBlobUrl;

    if(els.progressCont) els.progressCont.classList.remove('hidden');
    try {
        logToConsole(`File loaded: ${file.name}`);
        logToConsole("Decoding audio... please wait.");
        
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer; 
        audioDuration = audioBuffer.duration;
        
        logToConsole(`Audio decoded. Duration: ${fmtDuration(audioDuration)}`);
        logToConsole(`Ready to start.`);
        
        // Habilitar botón Start
        if(els.runBtn) {
            els.runBtn.disabled = false;
            els.runBtn.className = "flex-1 py-4 rounded-xl font-black text-lg text-[#202020] shadow-lg transition-all transform flex justify-center items-center gap-2 bg-[#ffb81f] hover:bg-[#e0a01a] hover:scale-[1.02] cursor-pointer";
            els.runBtn.querySelector('span').innerText = t.startBtn;
        }
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

// ==========================================
// 5. FUNCIONES AUXILIARES Y UI
// ==========================================

function setLanguage(lang) {
    currentLang = lang; const t = translations[lang];
    if (els.langEn) els.langEn.classList.toggle('active', lang === 'en');
    if (els.langEs) els.langEs.classList.toggle('active', lang === 'es');
    
    document.querySelectorAll('[data-key]').forEach(el => {
        if(el.tagName === 'OPTION') { el.text = t[el.dataset.key] || el.text; } 
        else if(t[el.dataset.key]) el.innerHTML = t[el.dataset.key];
    });
    
    const btnText = cachedData ? t.updateBtn : t.startBtn;
    if (audioData && els.runBtn) els.runBtn.querySelector('span').innerText = btnText;
    
    // SAFE ACCESS
    if(els.dontBreakInput) els.dontBreakInput.value = t.dontBreakDefaults;
    
    const undoBtn = document.getElementById('undo-btn');
    if(undoBtn) undoBtn.innerHTML = `${ICON_UNDO} ${t.btnUndo}`;
    
    const btnQA = document.getElementById('btn-qa');
    if(btnQA) btnQA.innerHTML = `${ICON_GEAR} <span class="hidden sm:inline">${t.btnQA}</span>`;
    const btnSC = document.getElementById('btn-shortcuts');
    if(btnSC) btnSC.innerHTML = `${ICON_KEYBOARD} <span class="hidden sm:inline">${t.btnShortcuts}</span>`;

    updateClearButtonUI();
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

function processResultsV9(data) {
    const maxCPL = parseInt(document.getElementById('max-cpl').value);
    const maxLines = parseInt(document.getElementById('max-lines').value);
    const minDurVal = parseFloat(document.getElementById('min-duration').value) || 1.0;
    const maxDurVal = parseFloat(document.getElementById('max-duration').value) || 7.0;
    const minGapVal = parseFloat(document.getElementById('min-gap-val').value) || 0;
    const minGapUnit = document.getElementById('min-gap-unit').value;
    let minGapSeconds = minGapUnit === 'frames' ? minGapVal * 0.040 : minGapVal / 1000;
    
    // SAFE ACCESS
    let dontBreakList = [];
    if(els.dontBreakInput && els.dontBreakInput.value) {
        dontBreakList = [...els.dontBreakInput.value.split(','), "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "zero"].map(s => s.trim().toLowerCase()).filter(s => s);
    }
    
    let punctuationStr = ".?!:…";
    if (els.endPunctuationInput && els.endPunctuationInput.value) {
        punctuationStr = els.endPunctuationInput.value;
    }
    const strongPunct = punctuationStr.split('');

    let allWords = [];
    if (data.chunks) { data.chunks.forEach(chunk => { let start = chunk.timestamp[0]; let end = chunk.timestamp[1]; if (start !== null && end !== null) allWords.push({ word: chunk.text, start: start, end: end }); }); }
    
    let subs = createSmartSrt(allWords, maxCPL, maxLines, minDurVal, maxDurVal, dontBreakList, strongPunct);
    subs = applyTimeRules(subs, minDurVal, maxDurVal, minGapSeconds);
    const task = document.getElementById('task-select').value;
    if (task === 'spotting') subs.forEach(s => s.text = "");
    currentSubtitles = subs;
    isTextCleared = false; textBackup = []; 
    
    if(!document.getElementById('undo-btn')) injectUndoButton();
    updateClearButtonUI();
}

function createSmartSrt(words, maxCpl, maxLines, minDur, maxDur, dontBreakList, strongPunct) {
    const subtitles = []; let buffer = []; let startTime = null; const maxChars = maxCpl * maxLines;
    const endsSentence = (w) => strongPunct.includes(w.word.trim().slice(-1));
    for (let i = 0; i < words.length; i++) {
        const wObj = words[i]; if (!wObj.word.trim()) continue;
        if (startTime === null) startTime = wObj.start;
        buffer.push(wObj);
        const currentText = buffer.map(b => b.word.trim()).join(' ');
        const currentDur = wObj.end - startTime;
        let forceCut = false;
        if (currentText.length > maxChars) { const overflow = buffer.pop(); forceCut = true; i--; } 
        else if (endsSentence(wObj)) { if (currentDur >= minDur) forceCut = true; }
        else if (currentDur >= maxDur) { forceCut = true; }
        if (forceCut || i === words.length - 1) {
            if (buffer.length === 0) continue;
            const finalBlockText = buffer.map(b => b.word.trim()).join(' ');
            const endTime = buffer[buffer.length - 1].end;
            const lines = balancedSplitV9(finalBlockText, maxCpl, dontBreakList);
            subtitles.push({ start: startTime, end: endTime, text: lines.join('\n') });
            buffer = []; startTime = null;
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
        let current = subs[i]; let duration = current.end - current.start;
        if (duration < minDur) {
            let limit = Infinity; if (i < subs.length - 1) limit = subs[i+1].start - minGap;
            let desiredEnd = current.start + minDur;
            if (desiredEnd <= limit) current.end = desiredEnd; else current.end = limit;
        }
    }
    return subs;
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
function download(content, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type: 'text/plain'})); a.download = name; a.click(); }
setLanguage('en');
