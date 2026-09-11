/**
 * subpandaTM.
 *
 * Este archivo es, de momento, todo el programa: es el contenido del <script>
 * que tenía subpandatm.html, movido tal cual para poder compilarlo con Vite.
 * Se irá troceando en módulos por temas, comprobando las pruebas después de
 * cada corte. Lo que había antes en el ámbito global (las variables sueltas,
 * las funciones) sigue estando en el ámbito de este módulo, así que el programa
 * se comporta igual, pero ya no ensucia window.
 */
import JSZip from 'jszip';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
// Los estilos de las etiquetas de las regiones, en texto: hay que meterlos
// dentro del shadow DOM de WaveSurfer, que es donde se dibujan.
import cssDeLasRegiones from '../css/region.css?inline';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';
import { conectarElEditor } from './editor-puente.js';
import { initAlineacion } from './alineacion.js';
import { guardarSubtitulos, leerSubtitulos } from '@core/codificacion.js';
import { cuantoSeVe, partirEnDos } from '@core/partir.js';
import { escaparHtml } from '@core/xml.js';
import { compararEtiquetas } from '@core/etiquetas.js';
import {
    EXTENSIONES,
    conLaExtensionDe,
    formatoDe,
    formatoPorId,
    sinExtension,
} from './core/formatos.js';
import {
    LIMITES_DE_FABRICA,
    REGLAS,
    cuantosDeCada,
    lasDeFabrica,
    revisar,
    soloLasEncendidas,
} from '@core/qa.js';
import { initRecientes } from './recientes.js';
import { initChangelog } from './changelog.js';
import { db } from './db.js';
import { errorMessages, translations } from './translations.js';
import {
    alCambiarElGlosario,
    alInsertarDesdeElGlosario,
    downloadTBX,
    loadTBX,
    processTBXContent,
    renderGlossary,
    resetGlossary,
    showGlossaryEditorSection,
} from './glossary.js';
import {
    addOrUpdateTMEntry,
    downloadTMX,
    processTMXContent,
    resetTM,
    showTMEditorSection,
    tmSearch,
} from './tm.js';
import {
    alBuscarEnLosPaneles,
    alternarPaneles,
    guardarSiEstanOcultos,
    avisarSiEstanVacios,
    initPaneles,
} from './paneles.js';
import { alInsertarTraduccion, initTerminoTarjeta } from './termino-tarjeta.js';
import { abrirFichaDeTermino, alGuardarUnTermino, initTerminoModal } from './termino-modal.js';
import {
    initIdiomasProyecto,
    pintarParDeIdiomas,
    preguntarIdiomasAlAbrir,
} from './idiomas-proyecto.js';
import {
    guardarRecursos,
    marcarRecursosCambiados,
    ponerRecursosDelProyecto,
    vaciarRecursos,
} from './recursos.js';
import { state } from './state.js';
// El asistente de IA. El núcleo (core/ia/) no sabe nada de pantallas y por eso
// se puede probar sin gastar una llamada; estos tres son la parte que se ve.
import { initAsistenteDeIA, ponerLimitesDeCalidad, retraducirSaludoDeIA } from './ia.js';
import { initAjustesDeIA } from './ia-ajustes-ui.js';
import { initPretraducir, ponerLimitesDePretraducir } from './pretraducir-ui.js';
import {
    calculateCPS,
    countCharactersWithoutTags,
    countWords,
    cuantoCuadranLosTiempos,
    detectarFormatoSrt,
    formatFrameTime,
    formatTime,
    parseFrameTime,
    limpiarParaSubtitulo,
    paraLaVistaPrevia,
    parseSrtContent,
    parseTime,
    reconstructOriginalSrt,
    reconstructSrt,
    textoVisible,
} from '@core/srt.js';

        // La base de datos vive en db.js, con su versión 2: la memoria y el
        // glosario tienen ahora sus propias tablas, atadas a cada proyecto.

        // Global variables
        let currentFileName = 'subtitles.srt';
        /**
         * Cómo estaba escrito por fuera el archivo que se abrió: sus saltos de
         * línea y si acababa en uno.
         *
         * Se recuerda para devolverlo igual. Un archivo hecho en Windows lleva
         * saltos de Windows, y devolverlo con saltos de Unix es devolver un
         * archivo distinto: pesa otra cosa y no coincide en un control de
         * versiones. Va con el proyecto, así que un encargo retomado mañana se
         * exporta como el archivo de partida y no como el que hizo la copia.
         */
        let formatoDelSrt = { saltoDeLinea: '\n', terminaConSalto: true };

        /**
         * En qué formato estaba el archivo, y todo lo suyo que no son
         * subtítulos.
         *
         * `documento` es lo que hace falta para devolver el archivo entero: la
         * cabecera, los comentarios, los estilos, las regiones y cualquier cosa
         * que el programa no supiera interpretar. Se reconstruye sobre lo que
         * vino en lugar de escribir un archivo nuevo, que es la diferencia entre
         * guardar y rehacer el archivo con lo que se ha entendido de él.
         */
        let formatoDelArchivo = formatoPorId('srt');
        let documentoDelArchivo = null;
        let videoFileName = null;
let wavesurfer = null;
let wsRegions = null;

/**
 * Lo estirado que va el dibujo de la onda a lo alto.
 *
 * No cambia el sonido ni los tiempos. En una grabación floja la onda sale casi
 * plana y no hay manera de ver dónde empieza a hablar alguien; subiéndola, los
 * picos se separan. En una fuerte pasa lo contrario, todo llega arriba y
 * también se pierde el detalle, así que hace falta poder bajarla.
 */
let alturaDeLaOnda = 1;
        // El idioma de la interfaz también es estado compartido: los cuadros
        // de término e idiomas y las tarjetas del glosario lo necesitan. El
        // valor de partida (inglés, como Poanda y el resto de PandaTools) está
        // en state.js.
        let findState = { query: '', replace: '', caseSensitive: false, useRegex: false, lastFound: null };
        let previewSource = 'translation';
let subtitleFontSize = 3; // Del 1 al 10; ver TAMANOS_DEL_SUBTITULO
let velocidadDeReproduccion = 1;
        /**
         * Los ajustes del control de calidad.
         *
         * `cpsLimit` y `charsPerLineLimit` se quedan donde estaban, con su
         * nombre de siempre: no son solo del QA, gobiernan también las cifras
         * que se encienden en rojo en cada tarjeta mientras se traduce, y hay
         * proyectos guardados que los traen escritos así.
         */
        const qaDeFabrica = () => ({
            cpsLimit: LIMITES_DE_FABRICA.cps,
            charsPerLineLimit: LIMITES_DE_FABRICA.porLinea,
            limites: { ...LIMITES_DE_FABRICA },
            encendidas: lasDeFabrica(),
        });
        let qaSettings = qaDeFabrica();

        /**
         * Si ya se ha pulsado "Revisar".
         *
         * La lista no se pinta sola al abrir la pestaña: en un archivo largo
         * son cientos de filas, y aparecer sin que nadie las pida es ruido. Una
         * vez pedida, se mantiene al día mientras se traduce.
         */
        let yaSeHaRevisado = false;

        /**
         * Lleva a la pestaña de QA. La rellena engancharPestanas(), que es
         * quien sabe abrir la columna.
         */
        let irAlQa = () => {};

        /**
         * Los ajustes tal y como los quiere el motor.
         *
         * El CPS y los caracteres por línea se leen de donde siempre han
         * estado, para que no haya dos sitios con el mismo número y uno de los
         * dos desactualizado.
         */
        function comoLosQuiereElMotor() {
            return {
                limites: {
                    ...LIMITES_DE_FABRICA,
                    ...(qaSettings.limites || {}),
                    cps: qaSettings.cpsLimit,
                    porLinea: qaSettings.charsPerLineLimit,
                },
                encendidas: { ...lasDeFabrica(), ...(qaSettings.encendidas || {}) },
                glosario: state.glossary,
            };
        }

        /**
         * Le pasa a la IA los límites del proyecto.
         *
         * Los guarda app.js junto al control de calidad, y la IA los necesita
         * para saber cuánto cabe en cada subtítulo. Se le dicen aquí, cada vez
         * que cambian, en lugar de que ella importe de app.js: si lo hiciera,
         * los dos módulos se importarían el uno al otro.
         */
        function avisarDeLosLimites() {
            ponerLimitesDeCalidad(qaSettings);
            ponerLimitesDePretraducir(qaSettings);
            pintarLimitesDeQa();
        }

        /**
         * Enciende los botones de la barra que llevan a una pestaña.
         *
         * Un botón está encendido cuando su pestaña es la que se ve Y la columna
         * está a la vista: encendido quiere decir "esto es lo que estás
         * mirando", y con la columna cerrada no se está mirando nada.
         *
         * Vive aquí arriba y no dentro de engancharPestanas() porque no solo
         * cambia al pulsar una pestaña: abrir o cerrar un archivo enseña y
         * esconde la columna entera, y los botones tienen que enterarse.
         */
        function pintarBotonesDePestanas() {
            const abierta =
                document.body.classList.contains('con-proyecto') &&
                !document.body.classList.contains('paneles-ocultos');
            const alaVista = document.querySelector('.panel-pestana.activa')?.dataset.pestana;

            for (const [pestana, id] of Object.entries({
                paneles: 'panelesBtn',
                ia: 'aiBtn',
                qa: 'qaBtn',
            })) {
                document
                    .getElementById(id)
                    ?.classList.toggle('active', abierta && alaVista === pestana);
            }
        }

        /**
         * Repinta la pestaña de QA con los ajustes que se estén aplicando.
         *
         * Hace falta porque los ajustes no solo se cambian ahí: vienen también
         * dentro de un proyecto abierto o de una copia restaurada, y la pestaña
         * tiene que decir lo que de verdad se está aplicando.
         */
        function pintarLimitesDeQa() {
            pintarElPanelDeQa();
        }
        // El glosario, la memoria, el par de idiomas y los términos del
        // subtítulo activo viven en state.js: los comparten app.js, glossary.js,
        // tm.js y los cuadros de término e idiomas.
        let timeUpdateListener = null;
let contextData = [];
let lastActiveSubtitleIndex = 0;
let afterSaveAction = null;
let messageTimeout = null;
let projectFPS = 25;
let useFrameTimecode = false;
let historyStack = [];
let redoStack = [];
let debounceTimeout = null;
let isApplyingState = false; 
let isWaveformLocked = false;
/**
 * El zoom de la onda, en tanto por ciento.
 *
 * Lo que el deslizador enseña es un porcentaje, no píxeles por segundo: el 100
 * es el punto de partida y de ahí se sube o se baja. Antes el número era
 * directamente los píxeles por segundo, así que el 100 de partida dejaba la onda
 * tan estirada que apenas cabían tres segundos en pantalla y había que bajarlo
 * al 40 cada vez que se abría un archivo.
 */
let currentWaveformZoom = 100;

/** A cuántos píxeles por segundo equivale el 100 %. */
const PIXELES_POR_SEGUNDO_AL_100 = 40;
let isFollowPlaybackActive = false;
let currentlyTrackedRegionId = null;
let currentlyTrackedEditorIndex = -1;
let lastFocusedEditorUnitIndex = -1;
        
        // DIFF_DELETE, DIFF_INSERT y DIFF_EQUAL vienen ahora del paquete
        // diff-match-patch, importado arriba. Antes se declaraban aquí a mano
        // porque la copia del CDN no las exponía.

        // DOM elements
        const srtFile = document.getElementById('srtFile');
        const translatedSrtFile = document.getElementById('translatedSrtFile');
        const saveSrtButton = document.getElementById('saveSrt');
        const backupIndicator = document.getElementById('backupIndicator');

        /**
         * Enciende o apaga las acciones que necesitan un archivo abierto.
         *
         * Son entradas de un menú, no botones sueltos, así que se apagan con una
         * clase: se ven pero no responden. Si desaparecieran, el menú cambiaría
         * de tamaño según lo que se puede hacer y cada entrada estaría en un
         * sitio distinto cada vez.
         */
        function apagarAcciones(apagadas) {
            saveSrtButton?.classList.toggle('disabled-link', apagadas);
            document.getElementById('saveProjectBtn')?.classList.toggle('disabled-link', apagadas);
        }
        const translationsContainer = document.getElementById('translationsContainer');
        const messageBox = document.getElementById('messageBox');
        const messageText = document.getElementById('messageText');
        const messageClose = document.getElementById('messageClose');
        const dropArea = document.querySelector('.main-app-content');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingMessage = document.getElementById('loadingMessage');
        const videoPlayerContainer = document.getElementById('videoPlayerContainer');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoFileInput = document.getElementById('videoFileInput');
        const subtitlePreviewText = document.getElementById('subtitlePreviewText');
        const subtitlePreviewOverlay = document.getElementById('subtitlePreviewOverlay');
const playPauseBtn = document.getElementById('playPauseBtn');
const fontSizeRange = document.getElementById('fontSizeRange');
const fontSizeDisplay = document.getElementById('fontSizeDisplay');
const videoPlayerWrapper = document.getElementById('videoPlayerWrapper');
// El bloque que se pone en pantalla completa: el reproductor y su botonera.
const videoBloque = document.getElementById('videoBloque');
const customFullscreenBtn = document.getElementById('customFullscreenBtn');
const fullscreenEnterChar = document.getElementById('fullscreen-enter-char');
const fullscreenExitChar = document.getElementById('fullscreen-exit-char');
                const statsContainer = document.getElementById('statsContainer');
        const segmentsProgress = document.getElementById('segmentsProgress');
        const wordsTranslated = document.getElementById('wordsTranslated');
        const wordsTotal = document.getElementById('wordsTotal');
        const wordsRemaining = document.getElementById('wordsRemaining');
        const qaErrorStats = document.getElementById('qaErrorStats');
        const statsAccordionHeader = document.getElementById('statsAccordionHeader');
        const statsAccordionContent = document.getElementById('statsAccordionContent');
        const statsAccordionIcon = statsAccordionHeader.querySelector('.accordion-icon');
        const shortcutsBtn = document.getElementById('shortcutsBtn');
        const shortcutsModal = document.getElementById('shortcutsModal');
        const shortcutsCloseBtn = document.getElementById('shortcutsCloseBtn');
        const findReplaceBtn = document.getElementById('findReplaceBtn');
        const findReplacePanel = document.getElementById('findReplacePanel');
        const closeFindReplacePanelBtn = document.getElementById('closeFindReplacePanelBtn');
        const findInput = document.getElementById('findInput');
        const replaceInput = document.getElementById('replaceInput');
        const caseSensitiveCheckbox = document.getElementById('caseSensitiveCheckbox');
        const regexCheckbox = document.getElementById('regexCheckbox');
        const findPrevBtn = document.getElementById('findPrevBtn');
        const findNextBtn = document.getElementById('findNextBtn');
        const replaceBtn = document.getElementById('replaceBtn');
        const replaceAllBtn = document.getElementById('replaceAllBtn');
        const findReplaceCloseBtn = document.getElementById('findReplaceCloseBtn');
        const saveSrtModal = document.getElementById('saveSrtModal');
        const fileNameInput = document.getElementById('fileNameInput');
        const confirmSaveBtn = document.getElementById('confirmSaveBtn');
        const cancelSaveBtn = document.getElementById('cancelSaveBtn');
        const backupBtn = document.getElementById('backupBtn');
        const backupModal = document.getElementById('backupModal');
        const backupFoundView = document.getElementById('backupFoundView');
        const noBackupFoundView = document.getElementById('noBackupFoundView');
        const backupFileName = document.getElementById('backupFileName');
        const backupLastModified = document.getElementById('backupLastModified');
        const closeBackupModalBtn = document.getElementById('closeBackupModalBtn');
        const exportSrtFromBackupBtn = document.getElementById('exportSrtFromBackupBtn');
        const deleteBackupBtn = document.getElementById('deleteBackupBtn');
        const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
        const backupSelect = document.getElementById('backupSelect');
        const backupSelectWrap = document.getElementById('backupSelectWrap');
        const confirmModal = document.getElementById('confirmModal');
        const confirmModalTitle = document.getElementById('confirmModalTitle');
        const confirmModalMessage = document.getElementById('confirmModalMessage');
        const confirmModalOkBtn = document.getElementById('confirmModalOkBtn');
        const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
        const qaBtn = document.getElementById('qaBtn');
        const qaErrorListContainer = document.getElementById('qaErrorListContainer');
        const terminologySidebar = document.getElementById('terminologySidebar');
        const closeTerminologySidebarBtn = document.getElementById('closeTerminologySidebarBtn');
        const terminologyLanguageConfigSection = document.getElementById('terminologyLanguageConfigSection');
        const terminologyEditorSection = document.getElementById('terminologyEditorSection');
        const configSrcLang = document.getElementById('configSrcLang');
        const configTgtLang = document.getElementById('configTgtLang');
        const displaySrcLang = document.getElementById('displaySrcLang');
        const displayTgtLang = document.getElementById('displayTgtLang');
        // Los campos sueltos del glosario (término, traducción, buscador, la
        // tabla, el acordeón de "añadir término") y los de configuración de
        // idiomas ya no existen: el glosario se rellena en su propia ficha
        // (#terminoModal), la lista son tarjetas y el par de idiomas lo pone el
        // proyecto. Lo que queda de ellos vive en glossary.js y tm.js.
        const tbxFileInput = document.getElementById('tbxFileInput');
        const translationMemorySidebar = document.getElementById('translationMemorySidebar');
        const closeTranslationMemorySidebarBtn = document.getElementById('closeTranslationMemorySidebarBtn');
        const tmFileInput = document.getElementById('tmFileInput');
        const tmEditorSection = document.getElementById('tmEditorSection');
        const langEsBtn = document.getElementById('langEsBtn');
        const langEnBtn = document.getElementById('langEnBtn');
        const shortcutsList = document.getElementById('shortcutsList');
        const exportShortcutsBtn = document.getElementById('exportShortcutsBtn');
        const importShortcutsInput = document.getElementById('importShortcutsInput');
        const restoreShortcutsBtn = document.getElementById('restoreShortcutsBtn');
        const saveTbxModal = document.getElementById('saveTbxModal');
        const fileNameInputTbx = document.getElementById('fileNameInputTbx');
        const confirmSaveTbxBtn = document.getElementById('confirmSaveTbxBtn');
        const cancelSaveTbxBtn = document.getElementById('cancelSaveTbxBtn');
        const saveTmxModal = document.getElementById('saveTmxModal');
        const fileNameInputTmx = document.getElementById('fileNameInputTmx');
        const confirmSaveTmxBtn = document.getElementById('confirmSaveTmxBtn');
        const cancelSaveTmxBtn = document.getElementById('cancelSaveTmxBtn');
        // Project elements
        const newProjectBtn = document.getElementById('newProjectBtn');
        const saveProjectBtn = document.getElementById('saveProjectBtn');
        const projectFile = document.getElementById('projectFile');
const resetAppBtn = document.getElementById('resetAppBtn');
        const reselectVideoModal = document.getElementById('reselectVideoModal');
        const reselectVideoInfo = document.getElementById('reselectVideoInfo');
        const reselectVideoInput = document.getElementById('reselectVideoInput');
        const skipReselectVideoBtn = document.getElementById('skipReselectVideoBtn');
        const confirmNewProjectModal = document.getElementById('confirmNewProjectModal');
        const cancelNewProjectBtn = document.getElementById('cancelNewProjectBtn');
        const continueWithoutSavingBtn = document.getElementById('continueWithoutSavingBtn');
        const saveAndContinueBtn = document.getElementById('saveAndContinueBtn');
        const saveProjectModal = document.getElementById('saveProjectModal');
const projectFileNameInput = document.getElementById('projectFileNameInput');
const confirmSaveProjectBtn = document.getElementById('confirmSaveProjectBtn');
const cancelSaveProjectBtn = document.getElementById('cancelSaveProjectBtn');
        const confirmResetGlossaryModal = document.getElementById('confirmResetGlossaryModal');
        const confirmResetGlossaryBtn = document.getElementById('confirmResetGlossaryBtn');
        const cancelResetGlossaryBtn = document.getElementById('cancelResetGlossaryBtn');
        const confirmResetTmModal = document.getElementById('confirmResetTmModal');
        const confirmResetTmBtn = document.getElementById('confirmResetTmBtn');
        const cancelResetTmBtn = document.getElementById('cancelResetTmBtn');

const goToSubtitleBtn = document.getElementById('goToSubtitleBtn');
const goToSubtitlePanel = document.getElementById('goToSubtitlePanel');
const closeGoToSubtitlePanelBtn = document.getElementById('closeGoToSubtitlePanelBtn');
const goToSubtitleInput = document.getElementById('goToSubtitleInput');
const goToSubtitleActionBtn = document.getElementById('goToSubtitleActionBtn');
const goToTimecodeInput = document.getElementById('goToTimecodeInput');
const goToTimecodeActionBtn = document.getElementById('goToTimecodeActionBtn');
// --- INICIO: Nuevos elementos DOM de la botonera ---
const waveformControls = document.getElementById('waveformControls');
const lockWaveformBtn = document.getElementById('lockWaveformBtn');
const zoomRange = document.getElementById('zoomRange');
const waveHeightRange = document.getElementById('waveHeightRange');
const lockIconOpen = document.querySelector('.lock-icon-open');
const lockIconClosed = document.querySelector('.lock-icon-closed');
const followPlaybackBtn = document.getElementById('followPlaybackBtn'); 
// --- FIN: Nuevos elementos DOM de la botonera ---

        // --- I18N & SHORTCUTS SETUP ---

        // Los textos de la interfaz viven ahora en translations.js: los
        // necesitan también el glosario, la memoria y sus cuadros.


 let shortcutProfiles = {}; // contendrá los perfiles 'windows' y 'mac'
        let activeProfile = 'windows'; // perfil por defecto
        let shortcuts = {}; // se rellenará con el perfil activo
     
   // List of common ISO 639-1 language codes for the datalist
        const isoLanguagesData = [
          { code: "en", name: "English" }, { code: "en-US", name: "English (United States)" }, { code: "en-GB", name: "English (United Kingdom)" },
          { code: "es", name: "Español" }, { code: "es-AR", name: "Español (Argentina)" }, { code: "es-ES", name: "Español (España)" }, { code: "es-MX", name: "Español (México)" },
          { code: "fr", name: "Français" }, { code: "de", name: "Deutsch" }, { code: "it", name: "Italiano" }, { code: "pt", name: "Português" },
          { code: "ja", name: "日本語 (Japanese)" }, { code: "zh", name: "中文 (Chinese)" }, { code: "ar", name: "العربية (Arabic)" },
          { code: "ru", name: "Русский (Russian)" }, { code: "ko", name: "한국어 (Korean)" }, { code: "nl", name: "Nederlands" },
          { code: "sv", name: "Svenska" }, { code: "da", name: "Dansk" }, { code: "no", name: "Norsk" }, { code: "fi", "name": "Suomi" },
          { code: "tr", name: "Türkçe" }, { code: "pl", name: "Polski" }, { code: "cs", name: "Čeština" }, { code: "hu", name: "Magyar" },
          { code: "el", name: "Ελληνικά (Greek)" }, { code: "he", name: "עברית (Hebrew)" }, { code: "th", name: "ไทย (Thai)" },
          { code: "vi", name: "Tiếng Việt (Vietnamese)" }, { code: "id", name: "Bahasa Indonesia" }, { code: "ms", name: "Bahasa Melayu" },
          { code: "ca", name: "Català" }, { code: "eu", name: "Euskara" }, { code: "gl", name: "Galego" }, { code: "ro", name: "Română" },
          { code: "uk", name: "Українська (Ukrainian)" }, { code: "bg", name: "Български (Bulgarian)" }, { code: "hr", name: "Hrvatski" },
          { code: "sr", name: "Srpski" }, { code: "sk", name: "Slovenčina" }, { code: "sl", name: "Slovenščina" }, { code: "lt", name: "Lietuvių" },
          { code: "lv", name: "Latviešu" }, { code: "et", name: "Eesti" }, { code: "is", name: "Íslenska" }, { code: "ga", name: "Gaeilge" },
          { code: "mt", name: "Malti" },
        ];


        // Leer y escribir SRT, contar palabras, caracteres y CPS, y convertir
        // entre milisegundos y códigos de tiempo: todo eso está ahora en
        // core/srt.js, que no toca la pantalla y se puede probar sin navegador.



// --- INICIO: Funciones de Bloqueo y Zoom de Onda ---

/**
 * Alterna el estado de bloqueo de la onda de sonido.
 * Evita que las regiones se puedan arrastrar o redimensionar.
 */
function toggleWaveformLock() {
    isWaveformLocked = !isWaveformLocked;
    const waveformEl = document.getElementById('waveform');
    
    // Alternar estado visual
    waveformEl.classList.toggle('is-locked', isWaveformLocked);
    lockIconOpen.classList.toggle('hidden', isWaveformLocked);
    lockIconClosed.classList.toggle('hidden', !isWaveformLocked);
lockWaveformBtn.classList.toggle('active', isWaveformLocked);
lockWaveformBtn.title = isWaveformLocked ? translations[state.currentLanguage]['unlock_waveform'] : translations[state.currentLanguage]['lock_waveform'];

    // Deshabilitar/Habilitar drag y resize en TODAS las regiones
    for (const region of regionesDeSubtitulos.values()) {
        region.setOptions({
            drag: !isWaveformLocked,
            resize: !isWaveformLocked,
        });
    }
}

/**
 * Pone la altura del dibujo de la onda.
 *
 * El zoom acerca en el tiempo, a lo ancho. Esto es lo otro: estira el dibujo a
 * lo alto. Una grabación floja sale como una raya casi plana y no hay manera de
 * ver dónde empieza a hablar alguien; una fuerte llega arriba todo el rato y
 * pasa lo mismo. No toca el sonido ni los tiempos, solo cómo se pinta.
 *
 * @param {number} altura Multiplicador, entre 0.2 y 4.
 */
function ponerAlturaDeOnda(altura) {
    alturaDeLaOnda = altura;
    wavesurfer?.setOptions({ barHeight: alturaDeLaOnda });
    const cifra = document.getElementById('waveHeightValor');
    if (cifra) cifra.textContent = `${alturaDeLaOnda.toFixed(1)}×`;
}

/**
 * Pone el zoom de la onda.
 * @param {number} porcentaje 100 es el punto de partida.
 */
function ponerZoomDeOnda(porcentaje) {
    currentWaveformZoom = porcentaje;
    wavesurfer?.zoom((porcentaje * PIXELES_POR_SEGUNDO_AL_100) / 100);
    const cifra = document.getElementById('zoomValor');
    if (cifra) cifra.textContent = `${Math.round(porcentaje)} %`;
}

/**
 * Los cuadritos que se abren desde las dos botoneras.
 *
 * Cada uno cuelga de su icono y se abre y se cierra como un control de volumen:
 * al pulsar fuera o con Escape. Los usan el zoom y la altura de la onda, y la
 * velocidad, el texto de la vista previa y el tamaño de la letra del
 * reproductor. Así todos los botones son cuadrados y del mismo tamaño, y la
 * fila no crece con lo que ponga dentro de cada control: era eso lo que la
 * descuadraba en una columna estrecha.
 */
function engancharDeslizadores() {
    const cajas = [...document.querySelectorAll('[data-deslizador]')];
    if (!cajas.length) return;

    const cerrarTodos = (menos) => {
        for (const caja of cajas) {
            if (caja === menos) continue;
            caja.querySelector('.deslizador-cuerpo')?.classList.add('hidden');
            caja.querySelector('button')?.setAttribute('aria-expanded', 'false');
        }
    };

    for (const caja of cajas) {
        const boton = caja.querySelector('button');
        const cuerpo = caja.querySelector('.deslizador-cuerpo');
        boton?.addEventListener('click', (evento) => {
            evento.stopPropagation();
            const abierto = !cuerpo.classList.contains('hidden');
            cerrarTodos(caja);
            cuerpo.classList.toggle('hidden', abierto);
            boton.setAttribute('aria-expanded', String(!abierto));
            if (!abierto) cuerpo.querySelector('input')?.focus();
        });
        // Mover el deslizador no puede contar como "pulsar fuera".
        cuerpo?.addEventListener('click', (evento) => evento.stopPropagation());
    }

    document.addEventListener('click', () => cerrarTodos(null));
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') cerrarTodos(null);
    });
}
// --- FIN: Funciones de Bloqueo y Zoom de Onda ---

// --- Funciones de Regiones de WaveSurfer (NUEVAS y MODIFICADAS) ---
        /**
         * Las regiones que hemos creado, por su identificador.
         *
         * No se puede confiar en wsRegions.getRegions() para saber qué se ha
         * dibujado ya. WaveSurfer 7 pinta cada región solo cuando entra en la
         * parte visible de la onda, y hasta entonces no la apunta en su lista:
         * si se le pregunta justo después de crearla, contesta que no hay
         * ninguna. El código anterior preguntaba, no encontraba nada, y volvía a
         * crearlas todas en cada repintado, así que se acumulaban regiones
         * duplicadas unas encima de otras sobre la onda; y al limpiarlas
         * recorría esa misma lista mientras la vaciaba, con lo que se saltaba
         * una de cada dos.
         *
         * Llevando la cuenta aquí sabemos siempre qué hemos creado, esté
         * dibujado o no.
         */
        const regionesDeSubtitulos = new Map();

        /** La región de un subtítulo, si ya se creó. */
        function regionDe(entry) {
            return entry?.regionId ? regionesDeSubtitulos.get(entry.regionId) : undefined;
        }

        /** Limpia todas las regiones de subtítulos de la onda. */
        function clearSubtitleRegions() {
            for (const region of regionesDeSubtitulos.values()) region.remove();
            regionesDeSubtitulos.clear();
        }

        /** Añade una región a WaveSurfer para un subtítulo específico. */
        function addSubtitleRegion(entry) {
            // No añade región si no hay plugin, los tiempos no son válidos o la duración es cero o negativa
            if (!wsRegions || entry.startTimeMs < 0 || entry.endTimeMs <= entry.startTimeMs) return;

            // Asegúrate de que el ID es único y estable
            if (!entry.regionId) {
                 entry.regionId = `sub-${entry.index}-${Date.now()}`; // Genera ID si no existe
            }

            // Evita añadir regiones duplicadas.
            if (regionesDeSubtitulos.has(entry.regionId)) return;

            try {
                const region = wsRegions.addRegion({
                    id: entry.regionId,
                    start: entry.startTimeMs / 1000, // Convertir ms a segundos
                    end: entry.endTimeMs / 1000,   // Convertir ms a segundos
                    color: 'rgba(7, 91, 162, 0.3)',
                    drag: !isWaveformLocked,
                    resize: !isWaveformLocked,
                    attributes: { // Añadir atributos para posible estilado o selección
                        'data-subtitle-index': entry.index
                    }
                });
                regionesDeSubtitulos.set(entry.regionId, region);

              // --- INICIO: NUEVO BLOQUE para el formato de 4 líneas ---
                const content = document.createElement('div');
                content.className = 'region-content';

                // Línea 1: Número de subtítulo
                const line1 = `#${entry.index}`;

                // Línea 2: Texto original (preview)
                const originalPreview = entry.original.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const line2 = originalPreview.substring(0, 40) + (originalPreview.length > 40 ? '...' : '');

                // Línea 3: Texto traducido (preview, o vacío)
                let line3 = '';
                if (entry.translation) {
                    const translationPreview = entry.translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                    line3 = translationPreview.split('\n').join(' ').substring(0, 40) + (translationPreview.length > 40 ? '...' : '');
                }

                // Línea 4: Estadísticas de la traducción
                let line4 = '---'; // Placeholder si no hay traducción
                if (entry.translation) {
                    const translationTextClean = entry.translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                    const transLines = translationTextClean.split('\n');
                    const transL1 = transLines[0] ? countCharactersWithoutTags(transLines[0]) : 0;
                    const transL2 = transLines.length > 1 && transLines[1] ? countCharactersWithoutTags(transLines[1]) : 0;
                    const transCPS = calculateCPS(translationTextClean.replace(/\n/g, ''), entry.durationMs);
                    line4 = `CPS: ${transCPS} | L1: ${transL1}${transLines.length > 1 ? ` / L2: ${transL2}` : ''}`;
                }

                content.innerHTML = `
                    <div class="region-line region-line1">${line1}</div>
                    <div class="region-line region-line2">${line2}</div>
                    <div class="region-line region-line3">${line3}&nbsp;</div> <div class="region-line region-line4">${line4}</div>
                `;
                // --- FIN: NUEVO BLOQUE ---
                // Pequeño timeout para asegurar que el elemento de la región se ha renderizado en el DOM
                setTimeout(() => {
                    const regionEl = region?.element; // Usa optional chaining por si region no está definida
                    if (regionEl && !regionEl.querySelector('.region-content')) { // Verifica que no se haya añadido ya
                        regionEl.appendChild(content);
                    }
                }, 50); // Un pequeño retardo podría ser necesario

            } catch (error) {
                console.error(`Error adding region for subtitle ${entry.index}:`, error, entry);
            }
        }

/** Actualiza una región existente si sus tiempos cambian en el editor. */
        function updateRegionIfNeeded(entryIndex) {
            if (!wsRegions) return;
            const entry = state.srtEntries[entryIndex];
            const region = regionDe(entry);

            if (region) {
                const newStart = entry.startTimeMs / 1000;
                const newEnd = entry.endTimeMs / 1000;

                if ((Math.abs(region.start - newStart) > 0.001 || Math.abs(region.end - newEnd) > 0.001) && newEnd > newStart) {
                    region.setOptions({ start: newStart, end: newEnd });

                    // Actualizar el contenido de la región también (CON LA NUEVA LÓGICA)
                    const content = region.element?.querySelector('.region-content');
                     if (content) {
                         // --- INICIO: NUEVO BLOQUE para el formato de 4 líneas ---
                         // Línea 1: Número de subtítulo
                         const line1 = `#${entry.index}`;

                         // Línea 2: Texto original (preview)
                         const originalPreview = entry.original.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                         const line2 = originalPreview.substring(0, 40) + (originalPreview.length > 40 ? '...' : '');

                         // Línea 3: Texto traducido (preview, o vacío)
                         let line3 = '';
                         if (entry.translation) {
                             const translationPreview = entry.translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                             line3 = translationPreview.split('\n').join(' ').substring(0, 40) + (translationPreview.length > 40 ? '...' : '');
                         }

                         // Línea 4: Estadísticas de la traducción
                         let line4 = '---'; // Placeholder si no hay traducción
                         if (entry.translation) {
                             const translationTextClean = entry.translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                             const transLines = translationTextClean.split('\n');
                             const transL1 = transLines[0] ? countCharactersWithoutTags(transLines[0]) : 0;
                             const transL2 = transLines.length > 1 && transLines[1] ? countCharactersWithoutTags(transLines[1]) : 0;
                             const transCPS = calculateCPS(translationTextClean.replace(/\n/g, ''), entry.durationMs);
                             line4 = `CPS: ${transCPS} | L1: ${transL1}${transLines.length > 1 ? ` / L2: ${transL2}` : ''}`;
                         }

                         content.innerHTML = `
                             <div class="region-line region-line1">${line1}</div>
                             <div class="region-line region-line2">${line2}</div>
                             <div class="region-line region-line3">${line3}&nbsp;</div> <div class="region-line region-line4">${line4}</div>
                         `;
                         // --- FIN: NUEVO BLOQUE ---
                     }
                } else if (newEnd <= newStart) {
                    region.remove();
                }
            } else if (entry.endTimeMs > entry.startTimeMs) {
                addSubtitleRegion(entry);
            }
        }

   // --- Funciones para Edición de Tiempos ---

        /**
         * Actualiza todos los datos y la interfaz de un subtítulo cuando su tiempo cambia.
         * @param {number} entryIndex - El índice del subtítulo a actualizar.
         */
        function updateEntryTimes(entryIndex) {
            const entry = state.srtEntries[entryIndex];

            // 1. Validar que el tiempo de fin no sea anterior al de inicio
            if (entry.endTimeMs < entry.startTimeMs) {
                entry.endTimeMs = entry.startTimeMs + 1; // Asegurar una duración mínima
            }

            // 2. Recalcular la duración
            entry.durationMs = entry.endTimeMs - entry.startTimeMs;

            // 3. Formatear las nuevas cadenas de tiempo
            let newStartTimeStr, newEndTimeStr;
if (useFrameTimecode) {
    newStartTimeStr = formatFrameTime(entry.startTimeMs, projectFPS);
    newEndTimeStr = formatFrameTime(entry.endTimeMs, projectFPS);
} else {
    newStartTimeStr = formatTime(entry.startTimeMs);
    newEndTimeStr = formatTime(entry.endTimeMs);
}

            // 4. Actualizar los elementos de la interfaz
            document.getElementById(`startTime-${entryIndex}`).value = newStartTimeStr;
            document.getElementById(`endTime-${entryIndex}`).value = newEndTimeStr;
            document.getElementById(`duration-${entryIndex}`).value = (entry.durationMs / 1000).toFixed(3) + 's';

            // 5. Recalcular y actualizar las estadísticas (CPS, etc.)
            const translationEditor = document.getElementById(`translation-${entryIndex}`);
            if (translationEditor) {
                updateSubtitleStats(translationEditor, entry.charCountOriginal, entry.durationMs);
            }
updateRegionIfNeeded(entryIndex);
        }

        /**
         * Maneja el cambio manual de un código de tiempo en un campo de input.
         * @param {number} entryIndex - El índice del subtítulo.
         * @param {boolean} isStartTime - True si es el campo de inicio, false si es el de fin.
         * @param {HTMLInputElement} inputElement - El propio campo de input.
         */
        function handleTimecodeChange(entryIndex, isStartTime, inputElement) {
    let newTimeMs;
    try {
        if (useFrameTimecode) {
            newTimeMs = parseFrameTime(inputElement.value, projectFPS);
        } else {
            newTimeMs = parseTime(inputElement.value);
        }
        const entry = state.srtEntries[entryIndex];

// --- INICIO: Guardar historial de tiempo ---
                const oldTimes = { startTimeMs: entry.startTimeMs, endTimeMs: entry.endTimeMs };
                const newTimes = { ...oldTimes };
                if (isStartTime) {
                    newTimes.startTimeMs = newTimeMs;
                } else {
                    newTimes.endTimeMs = newTimeMs;
                }
                saveTimeChange(entryIndex, oldTimes, newTimes);
                // --- FIN: Guardar historial de tiempo ---
                
                if (isStartTime) {
                    entry.startTimeMs = newTimeMs;
                } else {
                    entry.endTimeMs = newTimeMs;
                }
                
                updateEntryTimes(entryIndex);
           } catch (error) {
                // Si el formato es inválido, revertir al valor anterior
                console.error("Formato de tiempo inválido:", error);
                
                // --- INICIO DE LA VERSIÓN CORREGIDA ---
                const entry = state.srtEntries[entryIndex]; // Se declara solo UNA VEZ
                let oldTimeStr;
                
                if (useFrameTimecode) {
                    // Si estamos en modo frames, generamos el string de frames
                    oldTimeStr = isStartTime ? formatFrameTime(entry.startTimeMs, projectFPS) : formatFrameTime(entry.endTimeMs, projectFPS);
                } else {
                    // Si estamos en modo ms, usamos la lógica original
                    const [startTime, endTime] = entry.timecodes.split(' --> ');
                    oldTimeStr = isStartTime ? startTime : endTime;
                }
                
                inputElement.value = oldTimeStr; // Revertimos al valor correcto
                
                // Lógica para mostrar el mensaje de error (esto ya lo tenías bien)
                const errorKey = useFrameTimecode ? 'timecode_format_error' : 'time_format_error'; 
                const errorMsg = translations[state.currentLanguage][errorKey] || "Formato de tiempo inválido.";
                showMessage(errorMsg);
                // --- FIN DE LA VERSIÓN CORREGIDA ---
            }
        }

        /**
         * Ajusta el tiempo de entrada o salida en un fotograma (40ms).
         * @param {number} entryIndex - El índice del subtítulo.
         * @param {boolean} isStartTime - True si se ajusta el inicio, false si es el fin.
         * @param {number} direction - 1 para añadir tiempo, -1 para restar.
         */
        function nudgeTimecode(entryIndex, isStartTime, direction) {
            const entry = state.srtEntries[entryIndex];
const frameDurationMs = Math.round(1000 / projectFPS); // Duración de 1 frame

// --- INICIO: Guardar historial de tiempo ---
            const oldTimes = { startTimeMs: entry.startTimeMs, endTimeMs: entry.endTimeMs };
            const newTimes = { ...oldTimes };
            if (isStartTime) {
                newTimes.startTimeMs = oldTimes.startTimeMs + (direction * frameDurationMs);
            } else {
                newTimes.endTimeMs = oldTimes.endTimeMs + (direction * frameDurationMs);
            }
            saveTimeChange(entryIndex, oldTimes, newTimes);
            // --- FIN: Guardar historial de tiempo ---

            if (isStartTime) {
                entry.startTimeMs += direction * frameDurationMs;
            } else {
                entry.endTimeMs += direction * frameDurationMs;
            }

            updateEntryTimes(entryIndex);
        }

        /**
         * Avanza o retrocede el vídeo en un fotograma (40ms).
         * @param {number} direction - 1 para avanzar, -1 para retroceder.
         */
        function nudgeVideo(direction) {
            if (videoPlayer && videoPlayer.src) {
                const frameDurationSeconds = 0.040;
                videoPlayer.currentTime += direction * frameDurationSeconds;
            }
        }

/**
         * Reproduce el subtítulo actual en un bucle un número configurable de veces.
         * @param {number} entryIndex - El índice del subtítulo a reproducir.
         */
        function playSubtitleLoop(entryIndex) {
            if (!state.srtEntries[entryIndex] || !videoPlayer.src) return;

            const entry = state.srtEntries[entryIndex];
            const loopCount = shortcuts.playSegmentLoop.loopCount || 3;
            let currentLoop = 0;
            
            // Si ya hay un bucle en ejecución, lo cancelamos para empezar uno nuevo
            if (window.loopListener) {
                videoPlayer.removeEventListener('timeupdate', window.loopListener);
            }

            const playSegment = () => {
                if (currentLoop >= loopCount) {
                    videoPlayer.pause();
                    videoPlayer.removeEventListener('timeupdate', window.loopListener);
                    window.loopListener = null;
                    return;
                }
                
                currentLoop++;
                videoPlayer.currentTime = entry.startTimeMs / 1000;
                videoPlayer.play();
            };

            window.loopListener = () => {
                // Dejamos un pequeño margen para asegurar que no se salte el bucle
                if (videoPlayer.currentTime >= (entry.endTimeMs / 1000) - 0.1) {
                    playSegment();
                }
            };
            
            videoPlayer.addEventListener('timeupdate', window.loopListener);
            playSegment(); // Inicia el primer ciclo
        }

        /**
         * Actualiza el contador de bucles en el objeto de atajos y lo guarda.
         * @param {string} value - El nuevo valor del campo de entrada.
         */
        function updateLoopCount(value) {
            const count = parseInt(value, 10);
            if (count > 0) {
                shortcuts.playSegmentLoop.loopCount = count;
                saveShortcuts();
            }
        }

        /**
         * Adjusts the height of a textarea to fit its content.
         * If the translation textarea is empty, it matches the height of the original textarea.
         * @param {HTMLTextAreaElement} textarea The textarea element (translation).
         * @param {HTMLElement} [originalElement] The original element (original text pre) for height comparison.
         */
        function autoResizeTextarea(textarea, originalElement) {
            textarea.style.height = 'auto';
            if (textarea.innerHTML.trim() === '' && originalElement) {
                // If textarea is empty, set its height to match the original element's scroll height
                textarea.style.height = originalElement.scrollHeight + 'px';
            } else {
                // Otherwise, let it expand to its own content
                textarea.style.height = textarea.scrollHeight + 'px';
            }
        }

        /**
         * Updates the character count and CPS for a specific textarea, including QA checks.
         * @param {HTMLElement} editorDiv The contenteditable div element.
         * @param {number} originalLength The length of the original string segment.
         * @param {number} durationMs The duration of the subtitle in milliseconds.
         */
        /**
         * Escribe los recuentos de una columna: total, CPS y caracteres por línea.
         *
         * Es la misma forma para el original y para la traducción, y por eso se
         * hace en un solo sitio: puestos uno debajo del otro con la misma pinta,
         * se comparan de un vistazo, que es lo que hace falta para ver si la
         * traducción se ha ido de largo.
         *
         * @param {string} sufijo Los ids de los tres huecos, sin el índice.
         * @param {number} entryIndex
         * @param {string} texto El HTML del texto.
         * @param {number} durationMs
         */
        function pintarRecuentos({ cps, lineas, suma }, texto, durationMs) {
            const t = translations[state.currentLanguage];

            // El texto se parte por donde de verdad se va a partir en pantalla,
            // no por donde lo tenga guardado el editor.
            const partes = limpiarParaSubtitulo(texto).split('\n');

            if (cps) {
                const valor = calculateCPS(texto, durationMs);
                cps.textContent = `${valor}${t.cps}`;
                cps.classList.toggle('qa-error', valor > qaSettings.cpsLimit);
            }

            // Cada cifra al final de su línea, en el margen derecho del campo, y
            // el total debajo de la última con una raya encima: se lee como una
            // suma. Antes iban todas seguidas en el pie —"L1: 29, L2: 14"—, así
            // que para saber si la primera línea se pasaba había que contar por
            // cuál ibas.
            //
            // Para que cada cifra caiga a la altura de su línea hay que saber
            // dónde acaba cada una en pantalla, y una línea de subtítulo se da
            // la vuelta a menudo en una columna estrecha. La columna de cifras
            // lleva por eso una copia invisible del texto: al tener la misma
            // letra y el mismo ancho se parte por los mismos sitios, así que
            // cada bloque mide exactamente lo que mide su línea y la cifra cae
            // sola donde tiene que caer. Medir posiciones a mano sería lo mismo
            // pero volviéndolo a calcular cada vez que se teclea.
            if (lineas) {
                lineas.innerHTML = '';
                partes.forEach((linea, i) => {
                    const bloque = document.createElement('div');
                    bloque.className = 'segmento-linea';

                    // La copia invisible lleva el texto que se ve de verdad, sin
                    // las etiquetas: con ellas dentro medía de más y las cifras
                    // se descolgaban en cuanto una línea llevaba una cursiva.
                    const visible = textoVisible(linea);
                    const limite = qaSettings.charsPerLineLimit;

                    const eco = document.createElement('span');
                    eco.className = 'segmento-linea-eco';
                    eco.textContent = (visible.slice(0, limite) || ' ');
                    bloque.appendChild(eco);

                    // Y lo que se pasa del límite se enciende en rojo, ahí
                    // mismo: la cifra del margen dice cuánto sobra, pero no
                    // cuál es la parte que sobra. Como esta capa está encima
                    // del texto y mide exactamente lo mismo, el fondo cae justo
                    // detrás de esos caracteres.
                    if (visible.length > limite) {
                        const sobra = document.createElement('span');
                        sobra.className = 'segmento-linea-sobra';
                        sobra.textContent = visible.slice(limite);
                        bloque.appendChild(sobra);
                    }

                    const cuantos = countCharactersWithoutTags(linea);
                    const cifra = document.createElement('span');
                    cifra.className = 'segmento-linea-cuenta';
                    cifra.textContent = String(cuantos);
                    cifra.title = `${t.line_chars} ${i + 1}`;
                    if (cuantos > qaSettings.charsPerLineLimit) cifra.classList.add('qa-error');
                    bloque.appendChild(cifra);

                    lineas.appendChild(bloque);
                });
            }

            // El total va debajo de la última cifra y en su misma columna, con
            // una raya encima: se lee como la suma de lo de arriba. Va en el
            // pie y no en la capa de las cifras porque esa capa está
            // superpuesta al texto y una fila de más se le saldría por abajo.
            if (suma) {
                const partido = partes.length > 1;
                suma.textContent = partido ? String(countCharactersWithoutTags(texto)) : '';
                suma.title = t.total_chars;
                suma.classList.toggle('hidden', !partido);
            }
        }

        /**
         * Pinta una barra de velocidad de lectura.
         *
         * La usan las dos columnas: la del original y la de la traducción. Antes
         * solo la llevaba la traducción, y sin la de al lado no había con qué
         * comparar: la barra dice si se lee en el tiempo que está en pantalla,
         * y saber que el original ya iba justo cambia lo que se decide.
         *
         * @param {string} prefijo El id de los dos trozos de la barra.
         * @param {string} texto
         * @param {number} durationMs
         */
        function pintarBarraDeCps(prefijo, texto, durationMs) {
            const relleno = document.getElementById(`${prefijo}Fill`);
            const limite = document.getElementById(`${prefijo}Limit`);
            if (!relleno || !limite) return;

            const cps = calculateCPS(texto, durationMs);
            const tope = qaSettings.cpsLimit;

            // El 1,5 es para que el límite no caiga en el extremo derecho: con
            // la barra saturada no se ve cuánto se está pasando.
            relleno.style.width = `${Math.min((cps / (tope * 1.5)) * 100, 100)}%`;
            limite.style.left = `${Math.min((tope / (tope * 1.5)) * 100, 100)}%`;
            // Verde por debajo del límite y rojo por encima. El color va por
            // clase y no escrito aquí a mano: escrito aquí gana a cualquier hoja
            // de estilos, y en modo oscuro la barra se quedaba con los verdes y
            // los rojos del modo claro, que sobre fondo oscuro son dos luces.
            relleno.classList.toggle('cps-bar-alta', cps > tope);
        }

        /** Los recuentos del original, que no cambian mientras se traduce. */
        function pintarRecuentosDelOriginal(entryIndex) {
            const entry = state.srtEntries[entryIndex];
            if (!entry) return;
            pintarRecuentos(
                {
                    cps: document.getElementById(`origCps-${entryIndex}`),
                    lineas: document.getElementById(`origLineCounts-${entryIndex}`),
                    suma: document.getElementById(`origTotal-${entryIndex}`),
                },
                entry.original,
                entry.durationMs,
            );
            pintarBarraDeCps(`origCpsBar-${entryIndex}`, entry.original, entry.durationMs);
        }

        function updateSubtitleStats(editorDiv, originalLength, durationMs) {
            const entryIndex = parseInt(editorDiv.dataset.entryIndex);
            const cpsSpan = document.getElementById(`cps-${entryIndex}`);
            const lineCharCountsDiv = document.getElementById(`lineCharCounts-${entryIndex}`);
            const translationLength = countCharactersWithoutTags(editorDiv.innerHTML);
            const t = translations[state.currentLanguage];

            pintarRecuentos(
                { cps: cpsSpan, lineas: lineCharCountsDiv, suma: document.getElementById(`total-${entryIndex}`) },
                editorDiv.innerHTML,
                durationMs,
            );
            // Los del original solo hace falta escribirlos una vez, pero
            // rehacerlos aquí cuesta nada y así el cambio de idioma también los
            // alcanza.
            pintarRecuentosDelOriginal(entryIndex);
            pintarBarraDeCps(`cpsBar-${entryIndex}`, editorDiv.innerHTML, durationMs);
        }

        /**
         * Configures the editable state of a translation entry (editable/read-only).
         * @param {number} entryIndex The index of the SRT entry.
         * @param {boolean} isEditable True to make it editable, false for read-only.
         */
        function setTranslationEditableState(entryIndex, isEditable) {
            const translationEditor = document.getElementById(`translation-${entryIndex}`);
            const validateButton = document.getElementById(`validateBtn-${entryIndex}`);
            const translationUnit = document.getElementById(`translation-unit-${entryIndex}`);

            if (!translationEditor || !validateButton || !translationUnit) {
                console.error(`Elements not found for index ${entryIndex}`);
                return;
            }

            translationEditor.contentEditable = isEditable;
            if (!isEditable) {
                translationUnit.classList.remove('translation-unit-active'); // Remove active highlight on validate

                // Update translation status and words when segment is validated
                const entry = state.srtEntries[entryIndex];
                entry.isTranslated = translationEditor.innerText.trim() !== '';
                entry.wordCountTranslation = countWords(translationEditor.innerText);
                entry.charCountTranslation = countCharactersWithoutTags(translationEditor.innerHTML);
                entry.cpsTranslation = calculateCPS(translationEditor.innerHTML, entry.durationMs);

                updateStatsDisplay(); // Update stats
                addOrUpdateTMEntry(entry.original, entry.translation); // Add/Update TM
            } else {
                translationUnit.classList.add('translation-unit-active'); // Add active highlight on edit/focus
            }

            // Un solo botón que enciende y apaga, en vez de dos que se
            // turnaban el sitio: cada vez que uno se iba, el otro llegaba con
            // otro ancho y toda la fila se movía.
            validateButton.classList.toggle('validado', !isEditable);
            validateButton.setAttribute('aria-pressed', String(!isEditable));
            validateButton.title =
                translations[state.currentLanguage][isEditable ? 'validate' : 'edit'];

            if (isEditable) {
                translationEditor.focus();
            }
        }

        /**
         * Applies a style command (like 'bold' or 'italic') to the current selection.
         * @param {string} command The command to execute.
         */
        /**
         * Pone en cursiva lo que esté seleccionado.
         *
         * Antes se le pedía al navegador sin más, y según cómo estuviera
         * configurado escribía `<i>` o un `<span style="font-style: italic">`.
         * Lo segundo se ve igual en el editor y desaparece al exportar, así que
         * la cursiva se perdía sin avisar. Con styleWithCSS en false, el
         * navegador escribe la etiqueta.
         */
        function formatText(command, valor = null) {
            try {
                document.execCommand('styleWithCSS', false, false);
            } catch {
                // Algún navegador puede no admitirlo; limpiarParaSubtitulo
                // recoge de todas formas el <span> con estilo al exportar.
            }
            document.execCommand(command, false, valor);
        }

        /**
         * El selector de dónde va el subtítulo, solo con un ASS abierto.
         *
         * En ASS la posición es una marca dentro del texto —`{\an8}` es arriba
         * en el centro— y los números son los del teclado numérico. Saberse cuál
         * es cuál no es parte del oficio de traducir.
         *
         * @param {number} entryIndex
         * @returns {string} HTML, o cadena vacía si el formato no lo admite.
         */
        /**
         * Qué se puede hacer con el formato que está abierto.
         *
         * Si no lo dice, se da por hecho que se puede: un formato que todavía
         * no haya declarado su lista sigue funcionando como antes.
         *
         * @returns {Object<string, string>}
         */
        function loQuePuedeElFormato() {
            return formatoDelArchivo?.puede || {};
        }

        /**
         * Un botón de la fila, pintado según lo que admita el formato abierto.
         *
         * Lo que el formato no sabe hacer no se pinta. No es por ahorrar sitio:
         * es que un botón que no hace nada es peor que no tenerlo, porque se
         * pulsa, parece que ha pasado algo y el archivo sale igual.
         *
         * Lo que se usa mucho pero no está en ninguna norma —el color de un
         * SRT— sí se pinta, con una marca y un aviso al pasar el ratón: quitarlo
         * sería quitar algo que funciona en casi todos los reproductores.
         *
         * @param {string} cual La clave en la lista del formato.
         * @param {string} html El botón.
         * @returns {string}
         */
        function siElFormatoPuede(cual, html) {
            const puede = loQuePuedeElFormato()[cual];
            if (puede === 'no') return '';
            if (puede !== 'segun') return html;

            // El aviso se pone de dos maneras, y hacen falta las dos: escrito
            // aquí, para que esté desde que se pinta el botón, y apuntado en
            // `data-i18n-aviso`, para que siga estando al cambiar de idioma,
            // que es cuando el title se rehace desde su clave.
            //
            // Ojo con el `\s` de delante: sin él, esto encuentra primero el
            // `data-i18n-title`, que también acaba en «title="», y el aviso se
            // le pega a la clave en vez de al texto.
            const aviso = translations[state.currentLanguage].segun_el_reproductor;
            return html
                .replace(/class="segmento-icono/, 'class="segmento-icono segmento-icono-segun')
                .replace(
                    /\stitle="([^"]*)"/,
                    (entero, texto) =>
                        ` data-i18n-aviso="segun_el_reproductor" title="${texto} — ${aviso}"`,
                );
        }

        function posicionesDeAss(entryIndex) {
            if (loQuePuedeElFormato().posicion !== 'si') return '';

            // Dónde está puesto ahora, para que el selector lo enseñe. Sin
            // esto aparece siempre en blanco y no hay manera de saber si un
            // subtítulo lleva posición sin leerle las marcas o los ajustes.
            const puesto = formatoDelArchivo?.posicionDe?.(state.srtEntries[entryIndex]) || '';

            const t = translations[state.currentLanguage];
            const donde = [
                ['7', t.pos_arriba_izquierda],
                ['8', t.pos_arriba],
                ['9', t.pos_arriba_derecha],
                ['4', t.pos_medio_izquierda],
                ['5', t.pos_medio],
                ['6', t.pos_medio_derecha],
                ['1', t.pos_abajo_izquierda],
                ['2', t.pos_abajo],
                ['3', t.pos_abajo_derecha],
            ];

            // El desplegable va detrás y lo que se ve delante es un dibujo,
            // como en el selector de color. Un <select> enseña el texto de la
            // opción elegida, y en un recuadro de 24 píxeles "Arriba
            // izquierda" sale cortado por la mitad: el dibujo se entiende y
            // cabe, y el nombre entero sigue estando al desplegarlo.
            return `<label class="segmento-icono segmento-posicion${puesto ? ' segmento-posicion-puesta' : ''}" data-i18n-title="posicion_tooltip" title="${t.posicion_tooltip}">
                <svg aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path stroke-linecap="round" d="M7 13h10M9 17h6"/>
                </svg>
                <select data-posicion="${entryIndex}">
                    <option value=""${puesto ? '' : ' selected'}>${t.pos_ninguna}</option>
                    ${donde.map(([cual, nombre]) => `<option value="${cual}"${cual === puesto ? ' selected' : ''}>${nombre}</option>`).join('')}
                </select>
            </label>`;
        }

        /**
         * Qué había seleccionado antes de irse a un control de la barra.
         *
         * El selector de color del sistema es una ventana aparte: al abrirse, la
         * página pierde el foco y con él lo que hubiera seleccionado. Al volver,
         * pintar de amarillo no pintaba nada, porque ya no había nada que
         * pintar. Se apunta antes de salir y se recupera al volver.
         */
        let dondeEstabaElCursor = new Map();

        /** @param {number} entryIndex */
        function guardarDondeEstaElCursor(entryIndex) {
            const campo = document.getElementById(`translation-${entryIndex}`);
            const seleccion = window.getSelection();
            if (campo && seleccion?.rangeCount && campo.contains(seleccion.anchorNode)) {
                dondeEstabaElCursor.set(entryIndex, seleccion.getRangeAt(0).cloneRange());
            }
        }

        /**
         * Devuelve la selección a donde estaba.
         *
         * @param {number} entryIndex
         * @returns {boolean} Si había algo que devolver.
         */
        function recuperarDondeEstabaElCursor(entryIndex) {
            const campo = document.getElementById(`translation-${entryIndex}`);
            const guardado = dondeEstabaElCursor.get(entryIndex);
            if (!campo || !guardado) return false;

            // Un rango puede apuntar a un trozo de texto que ya no está en la
            // página: pasa en cuanto algo reescribe el campo. Restaurarlo deja
            // la selección en un sitio que no existe, y lo que se haga después
            // no se aplica a nada sin que nadie proteste.
            if (!campo.contains(guardado.commonAncestorContainer)) {
                dondeEstabaElCursor.delete(entryIndex);
                return false;
            }

            campo.focus();
            const seleccion = window.getSelection();
            seleccion.removeAllRanges();
            seleccion.addRange(guardado);
            return true;
        }

        /**
         * Pone la marca de posición al principio del subtítulo.
         *
         * Al principio y no donde esté el cursor: en ASS una marca de posición
         * vale para la línea entera, y escrita en medio confunde más que ayuda.
         * Si ya había una, se cambia en lugar de añadir otra.
         *
         * @param {number} entryIndex
         * @param {string} numero
         */
        function ponerLaPosicion(entryIndex, numero) {
            // Dónde sale un subtítulo no se escribe en el mismo sitio en todos
            // los formatos: en ASS es una marca dentro del texto y en WebVTT
            // son ajustes de la línea de tiempos. Si el formato sabe hacerlo a
            // su manera, que lo haga él; lo de abajo es la manera del ASS.
            const aSuManera = formatoDelArchivo?.ponerLaPosicion;
            if (aSuManera) {
                const entrada = state.srtEntries[entryIndex];
                if (!entrada) return;
                aSuManera(entrada, numero);
                // La tarjeta no cambia —los ajustes de la línea de tiempos no
                // se enseñan—, así que lo que se repinta es la vista previa,
                // que es donde se ve que el subtítulo se ha movido.
                updateSubtitlePreview();
                return;
            }

            const campo = document.getElementById(`translation-${entryIndex}`);
            if (!campo) return;

            // Sin número es quitar la posición y dejar la de siempre, que es
            // lo que hace la primera opción del selector.
            const marca = numero ? `{\\an${numero}}` : '';
            const yaHabia = /^\s*\{\\an\d\}/;
            const ahora = campo.innerHTML;

            campo.innerHTML = yaHabia.test(ahora)
                ? ahora.replace(yaHabia, marca)
                : marca + ahora;

            campo.dispatchEvent(new Event('input', { bubbles: true }));
            if (!recuperarDondeEstabaElCursor(entryIndex)) campo.focus();
        }

        /**
         * Escribe algo donde esté el cursor, sin tocar lo que ya hay.
         *
         * Para las marcas del ASS: `{\an8}`, que no es formato sino una orden
         * dentro del texto, así que no vale ninguno de los comandos del editor.
         *
         * @param {string} texto
         */
        function insertarTalCual(texto) {
            document.execCommand('insertText', false, texto);
        }

        /**
         * Applies glossary term highlighting to a given text segment.
         * Collects terms that were successfully highlighted.
         * @param {string} text The original text to highlight.
         * @returns {{html: string, foundTerms: Set<string>}} Object with HTML string and set of found terms.
         */
        /**
         * Cuántas líneas tiene un subtítulo.
         *
         * Sirve para que el campo de traducción vacío mida lo mismo que su
         * original: con un subtítulo de dos líneas al lado, un hueco de una sola
         * dejaba la tarjeta coja. Se cuentan los saltos escritos, no los que
         * salgan de que el texto dé la vuelta: dos líneas de subtítulo son dos
         * líneas de subtítulo, mida lo que mida la columna.
         *
         * @param {string} texto
         * @returns {number}
         */
        function lineasDe(texto) {
            const saltos = String(texto || '').split(/<br\s*\/?>|\n/).length;
            return Math.max(1, Math.min(saltos, 4));
        }

        /**
         * El original con la pinta que va a tener en pantalla.
         *
         * Cada formato escribe la cursiva a su manera y el navegador solo
         * entiende la suya. En TTML, por ejemplo, la cursiva es un atributo del
         * `<span>`: pintado tal cual sale texto normal y quien traduce no ve que
         * esa palabra va en cursiva. El formato dice cómo se enseña; lo que se
         * guarda no cambia.
         *
         * @param {string} texto
         * @returns {string} HTML.
         */
        function comoSeVe(texto) {
            const traer = formatoDelArchivo?.paraVer;
            // Se le pasa el documento porque hay formatos donde el color no
            // está en el texto sino declarado en la cabecera del archivo: en
            // WebVTT, un <c.grito> solo es rojo si el archivo dice que lo es.
            return traer ? traer(texto, documentoDelArchivo) : texto;
        }

        function applyGlossaryHighlightToText(text) {
            let highlightedHtml = comoSeVe(text);
            const currentFoundTerms = new Set(); // Terms found in *this specific* segment

            if (!state.sourceLang) {
                return { html: highlightedHtml, foundTerms: currentFoundTerms };
            }

            const sortedGlossary = [...state.glossary].sort((a, b) => b.srcTerm.length - a.srcTerm.length);

            sortedGlossary.forEach(glossaryEntry => {
                if (state.sourceLang && glossaryEntry.srcTerm) {
                    const term = glossaryEntry.srcTerm;
                    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'gi'); 

                    if (highlightedHtml.match(regex)) {
                        highlightedHtml = highlightedHtml.replace(regex, (match, p1) => {
                            currentFoundTerms.add(term);
                            return `<span class="glossary-highlight" data-termino="${term.replace(/"/g, '&quot;')}" tabindex="0">${p1}</span>`;
                        });
                    }
                }
            });
            return { html: highlightedHtml, foundTerms: currentFoundTerms };
        }

        /**
         * Repinta el panel del glosario con lo que hay en el subtítulo activo.
         */
        function updateGlossaryTableHighlights() {
            renderGlossary();
        }

        /**
         * Vuelve a pintar el original de todos los subtítulos.
         *
         * El amarillo del glosario está en todo el archivo, no solo en el
         * subtítulo en el que se está: añadir o quitar un término cambia lo que
         * se ve de arriba abajo. Se repintan solo los originales, y no la lista
         * entera, para no perder el cursor ni lo que se estuviera escribiendo.
         */
        function repintarTodosLosOriginales() {
            state.srtEntries.forEach((entry, entryIndex) => {
                const original = document.getElementById(`original-pre-${entryIndex}`);
                if (original) original.innerHTML = applyGlossaryHighlightToText(entry.original).html;
            });
        }

        /**
         * Vuelve a mirar qué términos del glosario hay en el subtítulo activo.
         *
         * El panel señala las coincidencias a partir de esa lista: sin
         * rehacerla, un término recién guardado no sale marcado hasta salir del
         * subtítulo y volver a entrar.
         */
        function recalcularTerminosDelSegmentoActivo() {
            state.termsFoundInActiveSegment.clear();
            const donde = getCurrentFocusedIndex();
            const entry = donde ? state.srtEntries[donde.entryIndex] : null;
            if (!entry || !state.sourceLang || state.glossary.length === 0) return;

            const marcado = applyGlossaryHighlightToText(entry.original);
            marcado.foundTerms.forEach((termino) => state.termsFoundInActiveSegment.add(termino));
            const original = document.getElementById(`original-pre-${donde.entryIndex}`);
            if (original) original.innerHTML = marcado.html;
        }

function renderTranslations(entries, activeIndexToPreserve = null, preserveScroll = false) {
            translationsContainer.innerHTML = '';
            state.termsFoundInActiveSegment.clear();
            const t = translations[state.currentLanguage];
            // El aviso de "Salto de línea = Shift + Enter" se ha ido con el
            // motivo que lo hacía falta: ahora basta con Enter.

clearSubtitleRegions();            

if (entries.length === 0) {
                translationsContainer.innerHTML = `
                    <div id="initialMessage" class="bienvenida">
                        <label id="zonaSoltar" class="bienvenida-bocadillo" for="srtFileBienvenida" tabindex="0">
                            <span class="bienvenida-texto" data-i18n="no_translations">${t.no_translations}</span>
                            <span class="bienvenida-soltar" data-i18n="drop_srt_here">${t.drop_srt_here || ''}</span>
                            <input type="file" id="srtFileBienvenida" accept="${[...EXTENSIONES, '.subpanda'].join(',')}" class="hidden">
                        </label>
                        <img class="bienvenida-panda" src="../images/panda-glasses.png" alt="" aria-hidden="true">
                    </div>`;
                engancharZonaDeSoltar();
                apagarAcciones(true);
                statsContainer.classList.add('hidden');
                return;
            }

            entries.forEach((entry, entryIndex) => {
                const translationUnit = document.createElement('div');
                translationUnit.id = `translation-unit-${entryIndex}`;
                // La marca de borrador de la IA: una barra naranja en la
                // columna del número. Sin ella no hay forma de distinguir en la
                // lista lo repasado de lo que escribió una máquina, y un
                // archivo donde no se distingue es un archivo del que no te
                // puedes fiar. Se quita en cuanto alguien toca el subtítulo.
                translationUnit.className = entry.borradorIA
                    ? 'segmento-fila borrador-ia'
                    : 'segmento-fila';
                if (entry.borradorIA) translationUnit.title = t.ai_borrador;

                let startTime, endTime;
if (useFrameTimecode) {
    startTime = formatFrameTime(entry.startTimeMs, projectFPS);
    endTime = formatFrameTime(entry.endTimeMs, projectFPS);
} else {
    [startTime, endTime] = entry.timecodes.split(' --> ');
}
                const durationInSeconds = (entry.durationMs / 1000).toFixed(3);

                translationUnit.innerHTML = `
                    <!-- El número, a la izquierda y en su columna, como en los
                         segmentos de Poanda: se recorre la lista de arriba abajo
                         leyendo solo esa columna. -->
                    <div class="segmento-numero">${entry.index}</div>

                    <div class="segmento-cuerpo">
                        <!-- Los tiempos, en una franja discreta encima de las
                             dos columnas. Son de este subtítulo y no del texto,
                             así que no compiten con él: antes ocupaban dos
                             renglones de botones y etiquetas por delante de lo
                             que hay que leer. -->
                        <div class="segmento-tiempos">
                          <!-- Los tiempos y el vídeo se desplazan si no caben;
                               las acciones del subtítulo se quedan quietas a la
                               derecha. Antes se desplazaba la franja entera y
                               los últimos botones se salían de la vista sin que
                               nada lo dijera. -->
                          <div class="segmento-tiempos-izq">
                            <input type="text" id="startTime-${entryIndex}" value="${startTime}" class="segmento-tiempo" data-tiempo="inicio" data-entry-index="${entryIndex}" data-i18n-title="entry_time" title="${t.entry_time}">
                            <button type="button" class="segmento-icono" data-nudge="inicio" data-entry-index="${entryIndex}" data-paso="1" title="+1">+</button>
                            <button type="button" class="segmento-icono" data-nudge="inicio" data-entry-index="${entryIndex}" data-paso="-1" title="−1">−</button>
                            <input type="text" id="endTime-${entryIndex}" value="${endTime}" class="segmento-tiempo" data-tiempo="fin" data-entry-index="${entryIndex}" data-i18n-title="exit_time" title="${t.exit_time}">
                            <button type="button" class="segmento-icono" data-nudge="fin" data-entry-index="${entryIndex}" data-paso="1" title="+1">+</button>
                            <button type="button" class="segmento-icono" data-nudge="fin" data-entry-index="${entryIndex}" data-paso="-1" title="−1">−</button>
                            <!-- La duración, en un campo como los de entrada y
                                 salida: es un dato del mismo rango que ellos y
                                 se lee en la misma línea sin cambiar de forma.
                                 No se escribe, se calcula. -->
                            <input type="text" id="duration-${entryIndex}" value="${durationInSeconds}s" class="segmento-tiempo segmento-duracion" readonly tabindex="-1" data-i18n-title="duration" title="${t.duration}">

                            <span class="segmento-tiempos-raya" aria-hidden="true"></span>
                            <button type="button" class="segmento-icono" data-video="atras" title="${t.rewind_frame_tooltip}">
                                <svg fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14.002V5.998a1 1 0 00-1.555-.832L3.62 9.168a1 1 0 000 1.664l4.825 4.001zM14.445 14.832A1 1 0 0016 14.002V5.998a1 1 0 00-1.555-.832L9.62 9.168a1 1 0 000 1.664l4.825 4.001z"></path></svg>
                            </button>
                            <button type="button" class="segmento-icono" data-reproducir="${entryIndex}" title="${t.play_segment_tooltip}">
                                <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.002v3.996a1 1 0 001.555.832l3.223-1.998a1 1 0 000-1.664L9.555 7.168z" clip-rule="evenodd"></path></svg>
                            </button>
                            <button type="button" class="segmento-icono" data-video="adelante" title="${t.forward_frame_tooltip}">
                                <svg fill="currentColor" viewBox="0 0 20 20"><path d="M5.555 5.168A1 1 0 004 5.998v8.004a1 1 0 001.555.832L10.38 10.832a1 1 0 000-1.664L5.555 5.168zM11.555 5.168A1 1 0 0010 5.998v8.004a1 1 0 001.555.832L16.38 10.832a1 1 0 000-1.664l-4.825-4.001z"></path></svg>
                            </button>
                          </div>

                          <div class="segmento-tiempos-der">
                            <button type="button" class="segmento-icono" data-unir="${entryIndex}" title="${t.merge_next_tooltip}">→←</button>
                            <button type="button" class="segmento-icono" data-partir="${entryIndex}" title="${t.split_tooltip}">←→</button>
                            <!-- Borrar, cursiva y validar hasta aquí: son
                                 acciones sobre el subtítulo, como partir y
                                 unir, así que van con ellas y no colgando del
                                 pie de la columna de la traducción, donde
                                 competían con los recuentos. -->
                            <span class="segmento-tiempos-raya" aria-hidden="true"></span>
                            <!-- La cursiva se usa mucho: lo que se oye fuera de
                                 plano, los títulos, los idiomas extranjeros. La
                                 negrita, el subrayado y el color se usan poco en
                                 un SRT y bastante en un ASS, donde además son la
                                 diferencia entre un cartel y un diálogo. Se
                                 escriben con la forma de cada formato: un <i>
                                 aquí acaba siendo {\i1} en un ASS y un
                                 tts:fontStyle en un TTML. -->
                            <!-- Cada uno se pinta solo si el formato abierto
                                 sabe hacerlo: la lista la lleva el formato, no
                                 esta fila (ver core/formatos.js). -->
                            ${siElFormatoPuede('cursiva', `<button type="button" class="segmento-icono" data-formato="italic" data-i18n-title="italic_tooltip" title="${t.italic_tooltip}"><i>I</i></button>`, t.segun_el_reproductor)}
                            ${siElFormatoPuede('negrita', `<button type="button" class="segmento-icono" data-formato="bold" data-i18n-title="bold_tooltip" title="${t.bold_tooltip}"><b>B</b></button>`, t.segun_el_reproductor)}
                            ${siElFormatoPuede('subrayado', `<button type="button" class="segmento-icono" data-formato="underline" data-i18n-title="underline_tooltip" title="${t.underline_tooltip}"><u>U</u></button>`, t.segun_el_reproductor)}
                            ${siElFormatoPuede('color', `<label class="segmento-icono segmento-color" data-i18n-title="color_tooltip" title="${t.color_tooltip}"><span aria-hidden="true">A</span><input type="color" data-color="${entryIndex}" value="#ffff00"></label>`, t.segun_el_reproductor)}${posicionesDeAss(entryIndex)}
                            <!-- Validar este y todos los anteriores ya no tiene
                                 botón: es una acción que se hace de vez en
                                 cuando y ocupaba sitio en una fila que se usa a
                                 cada subtítulo. Vive en los atajos de teclado,
                                 donde además se puede cambiar la tecla. -->
                            <button type="button" class="segmento-icono segmento-icono-peligro" data-borrar="${entryIndex}" title="${t.delete_tooltip}">
                                <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>
                            </button>
                          </div>
                        </div>

                        <!-- Original y traducción, uno al lado del otro y con la
                             misma letra y la misma interlínea: es lo que hace que
                             se lea como una tabla y no como un formulario. -->
                        <div class="segmento-columnas">
                            <div class="segmento-col segmento-origen">
                                <!-- Los caracteres de cada línea van al final de
                                     su propia línea, en el margen derecho del
                                     campo, y el total debajo con una raya
                                     encima: se lee como una suma. -->
                                <div class="segmento-texto-caja">
                                    <pre id="original-pre-${entryIndex}" class="segmento-texto">${applyGlossaryHighlightToText(entry.original).html}</pre>
                                    <div class="segmento-lineas" id="origLineCounts-${entryIndex}" aria-hidden="true"></div>
                                </div>
                                <!-- El original también lleva sus recuentos, y
                                     en el mismo sitio y con la misma forma que
                                     los de la traducción: puestos uno debajo
                                     del otro se comparan de un vistazo, que es
                                     lo que hace falta para decidir si la
                                     traducción se ha ido de largo. -->
                                <!-- La misma barra de velocidad de lectura que
                                     lleva la traducción. Sin la del original al
                                     lado no había con qué comparar: saber que el
                                     original ya iba justo cambia lo que se
                                     decide al recortar. -->
                                <div class="cps-bar-container">
                                    <div id="origCpsBar-${entryIndex}Fill" class="cps-bar-fill"></div>
                                    <div id="origCpsBar-${entryIndex}Limit" class="cps-bar-limit-marker"></div>
                                </div>
                                <!-- En el pie solo quedan los CPS: el total de
                                     caracteres es ahora la suma de la columna
                                     de cifras, y decirlo dos veces sobra. -->
                                <div class="segmento-pie">
                                    <span class="segmento-cuenta" id="origCps-${entryIndex}"></span>
                                    <span class="segmento-pie-hueco"></span>
                                    <span class="segmento-linea-suma hidden" id="origTotal-${entryIndex}"></span>
                                </div>
                            </div>
                            <div class="segmento-col segmento-destino">
                                <div class="segmento-texto-caja">
                                    <div id="translation-${entryIndex}" class="segmento-texto subtitle-editor" contenteditable="true" data-entry-index="${entryIndex}" data-placeholder="${t.translation_placeholder}" style="--lineas-original: ${lineasDe(entry.original)}" data-original-length="${entry.charCountOriginal}" data-duration-ms="${entry.durationMs}">${entry.translation}</div>
                                    <div class="segmento-lineas" id="lineCharCounts-${entryIndex}" aria-hidden="true"></div>
                                </div>
                                <!-- La barra de CPS, pegada al texto: dice de un
                                     vistazo si se puede leer en el tiempo que
                                     está en pantalla. -->
                                <div class="cps-bar-container">
                                    <div id="cpsBar-${entryIndex}Fill" class="cps-bar-fill"></div>
                                    <div id="cpsBar-${entryIndex}Limit" class="cps-bar-limit-marker"></div>
                                </div>
                                <div class="segmento-pie">
                                    <span class="segmento-cuenta" id="cps-${entryIndex}"></span>
                                    <span class="segmento-pie-hueco"></span>
                                    <span class="segmento-linea-suma hidden" id="total-${entryIndex}"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- El visto, a la derecha de la fila y centrado, como en
                         Poanda: un solo botón que enciende y apaga. Antes eran
                         dos ("Validar" y "Editar") que se turnaban el sitio, y
                         cada vez que uno se iba, el otro llegaba con otro ancho
                         y toda la fila se movía. -->
                    <div class="segmento-estado">
                        <!-- El aviso de que este subtítulo tiene algo que
                             mirar. Sin él hay que ir a la pestaña de QA para
                             saber cuáles están mal, y al volver ya no te
                             acuerdas de cuál era. Va arriba del todo de esta
                             columna, a la altura de la franja de tiempos, y el
                             visto se queda centrado abajo: la fila reserva el
                             hueco esté o no, así que nada se mueve al
                             aparecer. Lo pinta pintarLosAvisos(). -->
                        <span class="segmento-aviso hidden" id="avisoQa-${entryIndex}" role="img">
                            <svg fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
                            </svg>
                        </span>
                        <button type="button" id="validateBtn-${entryIndex}" class="segmento-check" data-entry-index="${entryIndex}" aria-pressed="false" data-i18n-title="validate" title="${t.validate}">
                            <svg id="checkIcon-${entryIndex}" class="check-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </button>
                    </div>
                `;
                
                const translationEditor = translationUnit.querySelector(`#translation-${entryIndex}`);
                const originalColPre = translationUnit.querySelector(`#original-pre-${entryIndex}`);
                const validateButton = translationUnit.querySelector(`#validateBtn-${entryIndex}`);

                // --- Los botones y los campos de la fila -------------------
                // Antes iban con onclick escrito en el HTML. Al pasar a
                // módulos, esos atributos buscan la función en el ámbito global
                // y ya no está ahí: dejan de funcionar sin dar ningún error
                // visible, que es la peor manera de romperse. De hecho los dos
                // campos de tiempo llevaban desde el refactor sin responder al
                // teclear una hora nueva.
                const alPulsar = (selector, hacer) =>
                    translationUnit.querySelectorAll(selector).forEach((boton) =>
                        boton.addEventListener('click', () => hacer(boton)),
                    );

                translationUnit.querySelectorAll('.segmento-tiempo').forEach((campo) => {
                    campo.addEventListener('change', () =>
                        handleTimecodeChange(entryIndex, campo.dataset.tiempo === 'inicio', campo),
                    );
                });
                alPulsar('[data-nudge]', (b) =>
                    nudgeTimecode(entryIndex, b.dataset.nudge === 'inicio', Number(b.dataset.paso)),
                );
                alPulsar('[data-video]', (b) => nudgeVideo(b.dataset.video === 'adelante' ? 1 : -1));
                alPulsar('[data-reproducir]', () => jumpToCurrentSubtitleTime(entryIndex));
                alPulsar('[data-unir]', () => mergeWithNext(entryIndex));
                alPulsar('[data-partir]', () => splitSubtitle(entryIndex));
                alPulsar('[data-borrar]', () => confirmDeleteSubtitle(entryIndex));
                // Los de negrita y cursiva sacarían el cursor del texto al
                // pulsarlos, y sin cursor no hay nada que poner en negrita.
                translationUnit.querySelectorAll('[data-formato]').forEach((boton) => {
                    boton.addEventListener('mousedown', (evento) => evento.preventDefault());
                    boton.addEventListener('click', () => formatText(boton.dataset.formato));
                });

                // El color. Se aplica según se mueve el selector, para verlo
                // mientras se elige y no después de aceptar.
                const elColor = translationUnit.querySelector('[data-color]');
                if (elColor) {
                    // Se apunta la selección antes de abrir el selector: el del
                    // sistema es una ventana aparte y se lleva el foco de la
                    // página, y con él lo que hubiera seleccionado.
                    elColor.closest('label')?.addEventListener('mousedown', (evento) => {
                        guardarDondeEstaElCursor(entryIndex);
                        if (evento.target === elColor) return;
                        evento.preventDefault();
                        elColor.click();
                    });
                    elColor.addEventListener('input', () => {
                        recuperarDondeEstabaElCursor(entryIndex);
                        formatText('foreColor', elColor.value);
                        // Y se vuelve a apuntar dónde está ahora. Aplicar un
                        // color envuelve el texto en un elemento nuevo, así que
                        // el sitio apuntado antes deja de existir: la primera
                        // pasada por el selector funcionaba y la segunda ya no,
                        // que es justo lo que se hace con un selector de color
                        // —ir probando tonos hasta dar con el bueno—.
                        guardarDondeEstaElCursor(entryIndex);
                    });
                }

                // Y dónde va el subtítulo, que en ASS es una marca dentro del
                // texto y hay que saberse el número del teclado numérico.
                const laPosicion = translationUnit.querySelector('[data-posicion]');
                if (laPosicion) {
                    laPosicion.addEventListener('mousedown', () => guardarDondeEstaElCursor(entryIndex));
                    laPosicion.addEventListener('change', () => {
                        // La primera opción, "⊞", es quitar la posición y
                        // dejar la de siempre. Antes no se podía deshacer una
                        // posición puesta por error.
                        ponerLaPosicion(entryIndex, laPosicion.value);
                    });
                }


                if (entry.isTranslated) {
                    translationEditor.contentEditable = false;
                    validateButton.classList.add('validado');
                    validateButton.setAttribute('aria-pressed', 'true');
                    validateButton.title = t.edit;
                }

        // ✅ INICIO DEL BLOQUE FINAL ✅

                let oldValue = entry.translation;

                translationEditor.addEventListener('input', (event) => {
                    if (isApplyingState) return;
                    // Tocarlo lo convierte en tuyo: deja de ser borrador de IA.
                    if (entry.borradorIA) {
                        delete entry.borradorIA;
                        translationUnit.classList.remove('borrador-ia');
                        translationUnit.removeAttribute('title');
                    }
                    clearTimeout(debounceTimeout);

                    const currentEntry = state.srtEntries[entryIndex];
                    currentEntry.translation = event.target.innerHTML;
                    currentEntry.wordCountTranslation = countWords(event.target.innerText);
                    currentEntry.charCountTranslation = countCharactersWithoutTags(event.target.innerHTML);
                    currentEntry.cpsTranslation = calculateCPS(event.target.innerHTML, currentEntry.durationMs);
                    autoResizeTextarea(event.target, originalColPre);
                    updateSubtitleStats(event.target, currentEntry.charCountOriginal, currentEntry.durationMs);
                    updateStatsDisplay();
                    updateSubtitlePreview();

// --- INICIO CÓDIGO AÑADIDO ---
                    // Actualizar el contenido de la región en tiempo real
                    if (wsRegions) {
                        const region = regionDe(currentEntry);
                        if (region) {
                            const content = region.element?.querySelector('.region-content');
                            if (content) {
                                // Reutilizamos la lógica para generar el contenido de 4 líneas
                                const line1 = `#${currentEntry.index}`;
                                const originalPreview = currentEntry.original.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                                const line2 = originalPreview.substring(0, 40) + (originalPreview.length > 40 ? '...' : '');
                                let line3 = '';
                                if (currentEntry.translation) {
                                    const translationPreview = currentEntry.translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                                    line3 = translationPreview.split('\n').join(' ').substring(0, 40) + (translationPreview.length > 40 ? '...' : '');
                                }
                                let line4 = '---';
                                if (currentEntry.translation) {
                                     const translationTextClean = currentEntry.translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
                                     const transLines = translationTextClean.split('\n');
                                     const transL1 = transLines[0] ? countCharactersWithoutTags(transLines[0]) : 0;
                                     const transL2 = transLines.length > 1 && transLines[1] ? countCharactersWithoutTags(transLines[1]) : 0;
                                     const transCPS = calculateCPS(translationTextClean.replace(/\n/g, ''), currentEntry.durationMs);
                                     line4 = `CPS: ${transCPS} | L1: ${transL1}${transLines.length > 1 ? ` / L2: ${transL2}` : ''}`;
                                }

                                content.innerHTML = `
                                    <div class="region-line region-line1">${line1}</div>
                                    <div class="region-line region-line2">${line2}</div>
                                    <div class="region-line region-line3">${line3}&nbsp;</div>
                                    <div class="region-line region-line4">${line4}</div>
                                `;
                            }
                        }
                    }
                    // --- FIN CÓDIGO AÑADIDO ---

                    debounceTimeout = setTimeout(() => {
                        const newValue = event.target.innerHTML;
                        saveState(entryIndex, oldValue, newValue);
                        oldValue = newValue;
                    }, 1000);
                });

translationEditor.addEventListener('keydown', (event) => {
                    if (event.isSimulated) {
                        return;
                    }

                    // Enter parte la línea, que es lo que hace falta aquí: en
                    // un subtítulo el salto de línea es parte del texto, y se
                    // decide dónde va casi tan a menudo como se escriben las
                    // palabras. Antes Enter saltaba al subtítulo siguiente y el
                    // salto de línea pedía Shift+Enter, que es al revés de lo
                    // que uno espera al escribir.
                    //
                    // Para pasar al siguiente está Ctrl+Enter, que además lo
                    // valida, que es lo que se quiere hacer al terminar uno.
                    if (event.key === 'Enter' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                        event.preventDefault();
                        // insertLineBreak, y no escribir un <br> a mano, porque
                        // es lo único que deja el cursor detrás del salto y
                        // respeta el deshacer del propio navegador.
                        document.execCommand('insertLineBreak');
                        event.currentTarget.dispatchEvent(new Event('input', { bubbles: true }));
                        return;
                    }

                    // --- Comprobación de atajos de EDICIÓN y NAVEGACIÓN ---
                    const triggeredAction = Object.keys(shortcuts).find(action => {
                        const localActions = [
                            'validateAndNext', 'validateAllPrevious', 'goToNext', 'goToPrevious', // Se añaden de nuevo aquí
                            'insertTM1', 'insertTM2', 'insertTM3', 'insertTM4', 'insertTM5', 
                            'insertGloss1', 'insertGloss2', 'insertGloss3', 'insertGloss4', 'insertGloss5', 
                            'bold', 'italic',
                            'jumpToTime',
                            'playSegment',
                            'playSegmentLoop',
                            'playPause',
                            'seekForward',
                            'seekBackward',
                            'seekForwardFast',
                            'seekBackwardFast'
                            
                        ];
                        if (!localActions.includes(action)) return false;

                        const shortcut = shortcuts[action];
                        const keyMatch = (shortcut.key === ' ' && event.code === 'Space') || (shortcut.key.toLowerCase() === event.key.toLowerCase());
                        return keyMatch &&
                               shortcut.ctrlKey === event.ctrlKey &&
                               shortcut.metaKey === event.metaKey &&
                               shortcut.altKey === event.altKey &&
                               shortcut.shiftKey === event.shiftKey;
                    });

                    if (triggeredAction) {
                        event.preventDefault();
                        switch (triggeredAction) {
                            case 'validateAndNext':
    setTranslationEditableState(entryIndex, false);
    goToNextTranslation(entryIndex, true);
    break;
                            case 'validateAllPrevious':
                                validateUpTo(entryIndex);
                                break;
                            // Se añaden los casos de navegación de nuevo
                            case 'goToNext':
                                goToNextTranslation(entryIndex);
                                break;
                            case 'goToPrevious':
                                goToPreviousTranslation(entryIndex);
                                break;
                            case 'bold':
                                formatText('bold');
                                break;
                            case 'italic':
                                formatText('italic');
                                break;
                            case 'jumpToTime':
                            case 'playSegment':
                                jumpToCurrentSubtitleTime(entryIndex);
                                break;
                            case 'playSegmentLoop':
                                playSubtitleLoop(entryIndex);
                                break;
                            case 'playPause':
                                if (videoPlayer.paused) videoPlayer.play();
                                else videoPlayer.pause();
                                break;
                            case 'seekForward':
                                videoPlayer.currentTime += 3;
                                break;
                            case 'seekBackward':
                                videoPlayer.currentTime -= 3;
                                break;
                            case 'seekForwardFast':
                                videoPlayer.currentTime += 5;
                                break;
                            case 'seekBackwardFast':
                                videoPlayer.currentTime -= 5;
                                break;
                            case 'insertTM1':
                                tmSearch();
                                if (state.currentTMLatestSearchResults.length > 0) document.execCommand('insertHTML', false, state.currentTMLatestSearchResults[0].tgtText);
                                break;
                            case 'insertTM2':
                                tmSearch();
                                if (state.currentTMLatestSearchResults.length > 1) document.execCommand('insertHTML', false, state.currentTMLatestSearchResults[1].tgtText);
                                break;
                            case 'insertTM3':
                                tmSearch();
                                if (state.currentTMLatestSearchResults.length > 2) document.execCommand('insertHTML', false, state.currentTMLatestSearchResults[2].tgtText);
                                break;
                            case 'insertTM4':
                                tmSearch();
                                if (state.currentTMLatestSearchResults.length > 3) document.execCommand('insertHTML', false, state.currentTMLatestSearchResults[3].tgtText);
                                break;
                            case 'insertTM5':
                                tmSearch();
                                if (state.currentTMLatestSearchResults.length > 4) document.execCommand('insertHTML', false, state.currentTMLatestSearchResults[4].tgtText);
                                break;
                           
                            default:
                                // El if de 'insertTM' ya no es necesario aquí, pero dejamos el de 'insertGloss'
                                if (triggeredAction.startsWith('insertGloss')) {
                                    const index = parseInt(triggeredAction.replace('insertGloss', '')) - 1;
                                    if (state.currentGlossaryLatestResults.length > index) {
                                        document.execCommand('insertHTML', false, state.currentGlossaryLatestResults[index].tgtTerm);
                                    }
                                }
                                break;
                        }
                        return;
                    }
                          
                    // --- Lógica para atajos de documentación ---
                    const triggeredDocAction = shortcuts.docResources.find(res => {
                        if (!res.shortcut) return false;
                        const sc = res.shortcut;
                        const keyMatch = (sc.key === ' ' && event.code === 'Space') || (sc.key.toLowerCase() === event.key.toLowerCase());
                        return keyMatch &&
                               sc.ctrlKey === event.ctrlKey &&
                               sc.metaKey === event.metaKey &&
                               sc.altKey === event.altKey &&
                               sc.shiftKey === event.shiftKey;
                    });

                    if (triggeredDocAction) {
                        event.preventDefault();
                        const selectedText = window.getSelection().toString().trim();
                        const resourceUrl = triggeredDocAction.url;

                        if (selectedText && resourceUrl && resourceUrl.includes('{word}')) {
                            const finalUrl = resourceUrl.replace('{word}', encodeURIComponent(selectedText));
                            window.open(finalUrl, '_blank');
                        }
                    }
                });

                translationEditor.addEventListener('focus', (event) => {
                    oldValue = translationEditor.innerHTML;
                    // Se apunta dónde estaba el cursor. La tarjeta que sale al
                    // pasar el ratón vive fuera del editor, así que al pulsar su
                    // botón de insertar el foco ya se ha ido: sin esta nota no
                    // habría dónde escribir y el botón no haría nada.
                    state.lastFocusedSegment = { entryIndex, segmentIndex: 0 };
                    document.querySelectorAll('.translation-unit-active').forEach(unit => unit.classList.remove('translation-unit-active'));
                    translationUnit.classList.add('translation-unit-active');
                    state.termsFoundInActiveSegment.clear();
                    if (state.sourceLang && state.glossary.length > 0) {
                        const highlightResult = applyGlossaryHighlightToText(entry.original);
                        originalColPre.innerHTML = highlightResult.html;
                        highlightResult.foundTerms.forEach(term => state.termsFoundInActiveSegment.add(term));
                    }

                    // El rótulo con los términos encontrados se ha quitado: lo
                    // dice el panel de terminología, y al pasar el ratón por una
                    // palabra marcada sale su ficha entera. Una tira de
                    // "término -> traducción" encima del campo de traducción es
                    // ruido justo donde se escribe.

                    updateGlossaryTableHighlights();
                    autoResizeTextarea(event.target, originalColPre);
                    event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    tmSearch();

                });

                // Aquí había un oyente de "blur" que, al salir del campo,
                // vaciaba los términos del segmento y volvía a buscar en la
                // memoria. Como fuera del campo no hay segmento, esa segunda
                // búsqueda no encontraba nada y dejaba el panel en blanco: bastaba
                // pulsar cualquier botón de la barra —el del tema oscuro, por
                // ejemplo— o cargar el vídeo para que las coincidencias y las
                // marcas del glosario desaparecieran, y volvían solas al pulsar
                // otra vez el subtítulo. Parecía que se perdía la memoria y lo
                // que se perdía era la pantalla.
                //
                // No hace falta limpiar nada al salir: lo consultado se queda a
                // la vista hasta que se entra en otro subtítulo, que es cuando
                // su oyente de "focus" lo recalcula todo. Y el texto original
                // lleva marcados los términos del glosario siempre, se esté
                // dentro o fuera, así que volver a pintarlo aquí tampoco hacía
                // nada.


                // ✅ FIN DEL BLOQUE FINAL ✅

                // El mismo botón valida y vuelve a abrir: si ya está validado,
                // pulsarlo lo devuelve a edición.
                validateButton.addEventListener('click', () => {
                    const validado = validateButton.classList.contains('validado');
                    setTranslationEditableState(entryIndex, validado);
                    if (!validado) goToNextTranslation(entryIndex);
                });

                translationsContainer.appendChild(translationUnit);
                updateSubtitleStats(translationEditor, entry.charCountOriginal, entry.durationMs);
addSubtitleRegion(entry);
            });
            
            apagarAcciones(false);
            statsContainer.classList.remove('hidden');
            updateStatsDisplay();
            setupIntersectionObserver();

            if (!preserveScroll) {
                if (activeIndexToPreserve !== null && activeIndexToPreserve < state.srtEntries.length) {
                    navigateToTranslation(activeIndexToPreserve);
                } else {
                    const firstEditableSegment = getFirstEditableSegment();
                    if (firstEditableSegment) {
                        navigateToTranslation(firstEditableSegment.entryIndex);
                    }
                }
            }
        }

 /**
         * Valida el subtítulo actual y todos los anteriores que no estén ya validados.
         * @param {number} entryIndex - El índice del subtítulo actual.
         */
        function validateUpTo(entryIndex) {
            showLoadingOverlay('Validando subtítulos...'); // Muestra un mensaje de carga
            
            // Usamos un timeout para que la interfaz de carga se muestre antes de empezar el proceso
            setTimeout(() => {
                for (let i = 0; i <= entryIndex; i++) {
                    // Solo validamos si no está ya validado para ser más eficientes
                    if (!state.srtEntries[i].isTranslated) {
                        setTranslationEditableState(i, false);
                    }
                }
                
                // Una vez terminado, salta al siguiente subtítulo pendiente
                goToNextTranslation(entryIndex, false);
                hideLoadingOverlay(); // Oculta el mensaje de carga
            }, 50); // Un pequeño retardo de 50ms es suficiente
        }


function updateTranslations() {
    // Primero, actualizamos la tabla del glosario para que muestre los nuevos términos.
    renderGlossary();

    // Luego, recorremos cada subtítulo para ver si necesita una actualización visual.
    state.srtEntries.forEach((entry, entryIndex) => {
        const originalColPre = document.getElementById(`original-pre-${entryIndex}`);
        if (!originalColPre) return; // Si el subtítulo no está en pantalla, no hacemos nada.

        // La principal razón para refrescar es aplicar el resaltado del nuevo
        // término del glosario en el subtítulo que esté activo.
        if (lastActiveSubtitleIndex === entryIndex) {
            const highlightResult = applyGlossaryHighlightToText(entry.original);
            originalColPre.innerHTML = highlightResult.html;
        }
    });

    // Finalmente, actualizamos las estadísticas generales (contador de palabras, etc.).
    updateStatsDisplay();
}


  /**
         * Updates the display of translation progress and word counts.
         */
        function updateStatsDisplay() {
            const t = translations[state.currentLanguage];
            let totalSegments = state.srtEntries.length;
            let translatedSegments = state.srtEntries.filter(e => e.isTranslated).length;
            let totalWordsOriginal = state.srtEntries.reduce((acc, e) => acc + e.wordCountOriginal, 0);
            let totalWordsTranslated = state.srtEntries.reduce((acc, e) => acc + e.wordCountTranslation, 0);

            const percentage = totalSegments > 0 ? ((translatedSegments / totalSegments) * 100).toFixed(0) : 0;
            
            segmentsProgress.textContent = t.segments_progress_text.replace('{0}', translatedSegments).replace('{1}', totalSegments).replace('{2}', percentage);
            wordsTranslated.textContent = t.words_translated_text.replace('{0}', totalWordsTranslated);
            wordsTotal.textContent = t.words_total_text.replace('{0}', totalWordsOriginal);
            wordsRemaining.textContent = t.words_remaining_text.replace('{0}', totalWordsOriginal - totalWordsTranslated);

            const qaErrors = calculateAllQaErrors();
            pintarElPanelDeQa();
            pintarLosAvisos();
            renderQaErrorList();
            if (qaErrors.length > 0) {
                qaErrorStats.textContent = t.qa_errors_found.replace('{0}', qaErrors.length);
                qaErrorStats.className = 'qa-error clickable';
            } else {
                qaErrorStats.textContent = t.qa_no_errors;
                qaErrorStats.className = 'qa-success';
            }

const statusBar = document.getElementById('statusBar');
            if (statusBar) {
                // Obtenemos el texto de cada span
                const progressText = segmentsProgress.textContent;
                const translatedText = wordsTranslated.textContent;
                const totalText = wordsTotal.textContent;
                const remainingText = wordsRemaining.textContent;
                const qaText = qaErrorStats.textContent;
                const isQaClickable = qaErrorStats.classList.contains('clickable'); // Verificamos si hay errores

                // Determinamos las clases CSS para el texto QA
                const qaClasses = isQaClickable ? 'qa-error' : 'qa-success'; // Usa las clases existentes

                // Creamos el HTML para el texto QA
                let qaHtml = '';
                if (isQaClickable) {
                    // Si hay errores (clickable), usa un span con ID y clases
                    qaHtml = `<span id="statusBarQaLink" class="cursor-pointer underline ${qaClasses}">${qaText}</span>`;
                } else {
                    // Si no hay errores, usa un span solo con las clases de estilo
                    qaHtml = `<span class="${qaClasses}">${qaText}</span>`;
                }

                // Combinamos todo en el innerHTML, añadiendo el espacio antes de qaHtml
                statusBar.innerHTML = `${progressText} | ${translatedText} / ${totalText} | ${remainingText} |&nbsp; ${qaHtml}`; //

                // Si añadimos el span clickable, le añadimos el listener AHORA
                if (isQaClickable) {
                    const statusBarQaLink = document.getElementById('statusBarQaLink');
                    // Lleva a la pestaña de QA, que es donde está la lista. Antes
                    // abría un cuadro flotante encima del editor: para tocar el
                    // subtítulo había que cerrarlo, y para ver el siguiente error
                    // volver a abrirlo.
                    statusBarQaLink?.addEventListener('click', irAlQa);
                }
            }
        }


        /**
         * Gets the index of the currently focused translation textarea.
         * @returns {{entryIndex: number} | null} The object with index, or null.
         */
        /**
         * Mete un texto en la traducción del subtítulo en el que se está.
         *
         * Con `sustituir`, cambia la traducción entera: es lo que hace falta con
         * una coincidencia de la memoria, que trae la frase completa. Sin él,
         * escribe donde esté el cursor, que es lo que hace falta con un término
         * del glosario.
         *
         * @param {string} texto
         * @param {{sustituir?: boolean}} [opciones]
         * @returns {boolean} Si se ha conseguido.
         */
        function insertarEnLaTraduccion(texto, { sustituir = false } = {}) {
            const donde = getCurrentFocusedIndex() || state.lastFocusedSegment;
            if (!donde) return false;

            const editor = document.getElementById(`translation-${donde.entryIndex}`);
            if (!editor || editor.contentEditable !== 'true') return false;

            editor.focus();
            if (sustituir) {
                editor.innerHTML = texto;
            } else {
                // execCommand está anticuado, pero es lo único que respeta el
                // deshacer del propio navegador dentro de un campo editable:
                // escribiendo a mano en el HTML, Ctrl+Z se salta lo insertado.
                document.execCommand('insertHTML', false, texto);
            }
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        function getCurrentFocusedIndex() {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.classList.contains('subtitle-editor')) {
                return {
                    entryIndex: parseInt(activeElement.dataset.entryIndex),
                    // Aquí un subtítulo es siempre un segmento entero. Se
                    // devuelve igualmente para que el glosario y la memoria sean
                    // el mismo código que en Poanda.
                    segmentIndex: 0,
                };
            }
            return null;
        }

        /**
         * Finds the first editable segment.
         * @returns {{entryIndex: number} | null} The object with index, or null.
         */
       function getFirstEditableSegment() {
    // Recorremos todos los subtítulos buscando el primero que no esté validado.
    for (let i = 0; i < state.srtEntries.length; i++) {
        // Si encontramos uno que NO está traducido (`isTranslated` es false)...
        if (!state.srtEntries[i].isTranslated) {
            // ...devolvemos su índice para que el programa salte directamente a él.
            return { entryIndex: i };
        }
    }

    // Si el bucle termina y no hemos encontrado ninguno sin traducir
    // (es decir, todos están validados), no devolvemos nada (null).
    return null;
}


        /**
         * Navigates to and focuses a specific translation field.
         * @param {number} entryIndex The index of the SRT entry.
         */
   function navigateToTranslation(entryIndex) {
    const targetEditor = document.getElementById(`translation-${entryIndex}`);
    if (targetEditor) {
        const currentlyFocusedEditor = document.activeElement;
        if (currentlyFocusedEditor && currentlyFocusedEditor.classList.contains('subtitle-editor') && currentlyFocusedEditor !== targetEditor) {
            currentlyFocusedEditor.blur();
        }
        setTranslationEditableState(entryIndex, true);
        targetEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
       
        // --- MODIFIED BLOCK ---
        if (videoPlayer.src && state.srtEntries[entryIndex]) {
            // Set the video time to the start of the focused subtitle, but DO NOT play.
            videoPlayer.currentTime = state.srtEntries[entryIndex].startTimeMs / 1000;
        }
        // --- END MODIFIED BLOCK ---
    }
}

        /**
         * Moves focus to the next translation field.
         * @param {number} currentEntryIndex The current index of the SRT entry.
         */
        function goToNextTranslation(currentEntryIndex, autoPlayNext = false) {
            if (state.srtEntries.length === 0) return;

            let nextEntryIndex = currentEntryIndex + 1;

            if (nextEntryIndex < state.srtEntries.length) {
                // Esto enfoca, hace scroll y ajusta el tiempo del vídeo
                navigateToTranslation(nextEntryIndex);
                
                // Si la orden fue "validar y seguir", reproducimos el segmento
                if (autoPlayNext) {
                    jumpToCurrentSubtitleTime(nextEntryIndex);
                }
            } else {
                showMessage(errorMessages[state.currentLanguage]['reached_last']);
            }
        }

        /**
         * Moves focus to the previous translation field.
         * @param {number} currentEntryIndex The current index of the SRT entry.
         */
        function goToPreviousTranslation(currentEntryIndex) {
            if (state.srtEntries.length === 0) return;

            let prevEntryIndex = currentEntryIndex - 1;

            if (prevEntryIndex >= 0) {
                navigateToTranslation(prevEntryIndex);
            } else {
                showMessage(errorMessages[state.currentLanguage]['reached_first']);
            }
        }

function setupIntersectionObserver() {
    const options = {
        root: document.getElementById('editorMainContent'),
        rootMargin: '-50% 0px -50% 0px', // Elige el elemento que está en el centro
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Cuando un subtítulo entra en el centro de la vista,
                // guardamos su índice como el último activo.
                lastActiveSubtitleIndex = parseInt(entry.target.querySelector('.subtitle-editor').dataset.entryIndex, 10);
            }
        });
    }, options);

    // Hacemos que el observador vigile cada uno de los subtítulos
    document.querySelectorAll('.translation-unit-bg').forEach(unit => {
        observer.observe(unit);
    });
}

// --- INICIO DEL CÓDIGO A AÑADIR ---

        // --- Undo/Redo Logic ---

        /**
         * Actualiza el estado de los botones Deshacer/Rehacer (activado/desactivado).
         */
        function updateUndoRedoButtons() {
            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');
            if (undoBtn && redoBtn) {
                undoBtn.classList.toggle('disabled-link', historyStack.length === 0);
                redoBtn.classList.toggle('disabled-link', redoStack.length === 0);
            }
        }

       /**
         * Guarda el estado de un cambio de texto en el historial. // <- Texto modificado
         * @param {number} entryIndex - El índice del subtítulo modificado.
         * @param {string} oldValue - El contenido ANTES del cambio.
         * @param {string} newValue - El contenido DESPUÉS del cambio.
         */
        function saveState(entryIndex, oldValue, newValue) {
            // AÑADIR ESTA LÍNEA ->
            if (isApplyingState) return; // No guardar estados mientras se deshace/rehace
            // Si el valor no ha cambiado, no guardamos nada.
            if (oldValue === newValue) return;

            // AÑADIR type: 'text' ->
            historyStack.push({ type: 'text', entryIndex, oldValue, newValue });
            redoStack = []; // Un nuevo cambio borra el historial de "rehacer"
            updateUndoRedoButtons();
        }

        // Aquí había una primera versión de undo() y redo(), escrita antes que
        // la definitiva. En JavaScript, de dos funciones con el mismo nombre en
        // el mismo ámbito solo cuenta la última, así que este par no llegaba a
        // ejecutarse nunca: quien lo leyera creería estar viendo lo que hace
        // Ctrl+Z, y no era así. Las que valen están más abajo, junto al
        // historial de cambios estructurales.

        // --- Event Handlers ---

// --- INICIO: LÓGICA PARA IMPORTAR SRT TRADUCIDO ---

translatedSrtFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Validar que ya existe un proyecto cargado con un original
    if (state.srtEntries.length === 0) {
        showMessage(translations[state.currentLanguage]['error_no_original_srt']);
        event.target.value = ''; // Resetear el input para permitir reintentar
        return;
    }

    showLoadingOverlay(translations[state.currentLanguage]['loading_file']);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const { texto } = leerSubtitulos(e.target.result);
            // Puede venir en otro formato que el original: lo que importa de él
            // es el texto y los tiempos, no cómo esté escrito.
            const translatedEntries = formatoDe(file.name, texto).leer(texto).entradas;
            
            mergeTranslatedEntries(translatedEntries);
            
        } catch (error) {
            console.error("Error importando traducción:", error);
            showMessage(`${errorMessages[state.currentLanguage]['error_reading_file']} ${error.message}`);
        } finally {
            hideLoadingOverlay();
            event.target.value = ''; // Resetear input
        }
    };
    reader.readAsArrayBuffer(file);
});

/**
 * Fusiona los subtítulos de un segundo archivo SRT en la columna de traducción.
 * Mantiene la sincronización por índice (1 con 1, 2 con 2, etc).
 */
function mergeTranslatedEntries(newEntries) {
    // 1. Guardar estado actual para el sistema de Deshacer (Undo)
    // Usamos JSON.parse/stringify para una copia profunda segura
    const oldState = JSON.parse(JSON.stringify(state.srtEntries));

    let mergedCount = 0;
    // Solo iteramos hasta el límite del archivo más corto para evitar errores
    const limit = Math.min(state.srtEntries.length, newEntries.length);

    // 2. Bucle de fusión
    for (let i = 0; i < limit; i++) {
        const originalEntry = state.srtEntries[i];
        const translatedEntry = newEntries[i];

        // IMPORTANTE: parseSrtContent pone el texto en .original.
        // Nosotros queremos coger ese texto y ponerlo en .translation del proyecto actual.
        const textToImport = translatedEntry.original.trim();

        if (textToImport) {
            originalEntry.translation = textToImport;
            
            // Actualizamos todas las estadísticas asociadas
            originalEntry.isTranslated = true;
            originalEntry.wordCountTranslation = countWords(textToImport);
            originalEntry.charCountTranslation = countCharactersWithoutTags(textToImport);
            originalEntry.cpsTranslation = calculateCPS(textToImport, originalEntry.durationMs);
            
            mergedCount++;
        }
    }

    // 3. Guardar en el historial de deshacer usando tu función existente
    const newState = JSON.parse(JSON.stringify(state.srtEntries));
    saveStructuralState(oldState, newState);

    // 4. Renderizar la interfaz actualizada
    renderTranslations(state.srtEntries, 0, true); // true = mantener scroll si es posible
    updateStatsDisplay();

    // 5. Mensajes de feedback al usuario.
    //
    // Antes del recuento va la comprobación que de verdad salva un encargo: que
    // los tiempos cuadren. Con el mismo número de subtítulos y tiempos
    // distintos, el emparejamiento por posición mete cada línea donde no le
    // toca, y eso no se ve al revisar —cada subtítulo es correcto por sí solo—
    // hasta que alguien pone el vídeo.
    const cuadran = cuantoCuadranLosTiempos(state.srtEntries, newEntries);
    if (cuadran < 0.9) {
        showMessage(
            (translations[state.currentLanguage]['translation_times_warning'] || '').replace(
                '{0}',
                Math.round(cuadran * 100),
            ),
        );
    } else if (state.srtEntries.length !== newEntries.length) {
        const warningMsg = translations[state.currentLanguage]['translation_mismatch_warning']
            .replace('{0}', newEntries.length)
            .replace('{1}', state.srtEntries.length);
        showMessage(warningMsg);
    } else {
        showMessage(translations[state.currentLanguage]['translation_imported_success'].replace('{0}', mergedCount));
    }
}
// --- FIN: LÓGICA PARA IMPORTAR SRT TRADUCIDO ---

        srtFile.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                await processFile(file);
            }
        });

        saveSrtButton.addEventListener('click', () => {
            if (state.srtEntries.length === 0) {
                showMessage(errorMessages[state.currentLanguage]['no_translations_to_save']);
                return;
            }
            // El recorte lo hace la tabla de formatos, que es quien conoce
            // todas las extensiones. Escrito a mano aquí se quedó en .srt y
            // .vtt, y un "pelicula.ass" salía como "pelicula.ass_trad.ass".
            fileNameInput.value = conLaExtensionDe(
                sinExtension(currentFileName) + '_trad',
                formatoDelArchivo,
            );
            saveSrtModal.classList.remove('hidden');
            fileNameInput.focus();
        });

        cancelSaveBtn.addEventListener('click', () => {
            saveSrtModal.classList.add('hidden');
        });

        confirmSaveBtn.addEventListener('click', () => {
            const filename = fileNameInput.value;
            if (!filename) {
                showMessage(errorMessages[state.currentLanguage]['please_enter_filename']);
                return;
            }
            showLoadingOverlay(errorMessages[state.currentLanguage]['saving_file']);
            try {
                const updatedSrtContent = formatoDelArchivo.escribir(
                    state.srtEntries,
                    documentoDelArchivo,
                    formatoDelSrt,
                );
                const blob = guardarSubtitulos(updatedSrtContent, formatoDelSrt);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = conLaExtensionDe(filename, formatoDelArchivo);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showMessage(errorMessages[state.currentLanguage]['file_saved_successfully']);
            } catch (error) {
                showMessage(`${errorMessages[state.currentLanguage]['error_saving_file']} ${error.message}`);
                console.error("Error saving file:", error);
            } finally {
                hideLoadingOverlay();
                saveSrtModal.classList.add('hidden');
            }
        });

        /**
         * Abre un .srt.
         *
         * Antes de enseñar nada se pregunta el par de idiomas del encargo. Es lo
         * primero que hay que decidir y de lo que dependen las dos herramientas
         * de la columna: la memoria solo propone unidades de ese par, y el
         * glosario necesita saber cuál de las dos columnas es el término y cuál
         * la traducción. Antes se preguntaba dos veces, una en cada panel, y se
         * podían contradecir.
         */
        async function processFile(file) {
            const hayPar = await preguntarIdiomasAlAbrir();
            if (!hayPar) return;

            // Abrir un archivo es empezar un encargo: la memoria y el glosario
            // arrancan vacíos. Antes se quedaba puesta la memoria del proyecto
            // anterior, y con dos clientes que traducen "file" de maneras
            // distintas la herramienta proponía la del otro con toda su
            // confianza. Para llevarse trabajo de un encargo a otro están la
            // exportación y la importación de TMX y TBX.
            state.projectId = null;
            vaciarRecursos();
            showGlossaryEditorSection();
            showTMEditorSection();

            currentFileName = file.name;
            videoFileName = null; // Reset video file name when a new SRT is loaded
            showLoadingOverlay(errorMessages[state.currentLanguage]['loading_file']);

           
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        // Los bytes, no el texto: la codificación se mira antes
                        // de leer. Un .srt en Windows-1252 leído como UTF-8
                        // llega con los acentos rotos, y rotos se quedan.
                        const { texto, codificacion, conBom } = leerSubtitulos(e.target.result);
                        formatoDelSrt = { ...detectarFormatoSrt(texto), conBom, codificacion };
                        avisarSiNoEraUtf8(codificacion, file.name);

                        // Qué formato es lo dice el contenido, no la extensión.
                        formatoDelArchivo = formatoDe(file.name, texto);
                        const leido = formatoDelArchivo.leer(texto);
                        state.srtEntries = leido.entradas;
                        documentoDelArchivo = leido.documento;
                        historyStack = [];
                        redoStack = [];
                        updateUndoRedoButtons();
                        document.body.classList.add('con-proyecto');
                        pintarBotonesDePestanas();
                        renderTranslations(state.srtEntries);
                        runFullQaCheck();
                        updateStatsDisplay();
                        showGlossaryEditorSection();
                        showTMEditorSection();
                        resolve();
                    } catch (error) {
                        showMessage(`${errorMessages[state.currentLanguage]['error_reading_file']} ${error.message}`);
                        console.error("Error parsing file:", error);
                        translationsContainer.innerHTML = `<div class="text-center text-red-500 p-4 border border-red-300 rounded-md">${errorMessages[state.currentLanguage]['file_processing_error']}</div>`;
                        apagarAcciones(true);
                        statsContainer.classList.add('hidden');
                        resolve();
                    } finally {
                        hideLoadingOverlay();
                    }
                };
                reader.onerror = () => {
                    showMessage(errorMessages[state.currentLanguage]['error_reading_file'] + (file.name || ''));
                    apagarAcciones(true);
                    statsContainer.classList.add('hidden');
                    hideLoadingOverlay();
                    resolve();
                };
                reader.readAsArrayBuffer(file);
            });
        }

        /**
         * Dice de dónde venía el archivo cuando no venía en UTF-8.
         *
         * No es un error —se ha leído bien, que es lo que importa—, pero al
         * guardar sale en UTF-8, y quien tenga que devolvérselo a un cliente que
         * trabaja con herramientas antiguas merece saberlo antes y no cuando se
         * lo devuelvan.
         *
         * @param {string} codificacion
         * @param {string} nombre
         */
        function avisarSiNoEraUtf8(codificacion, nombre) {
            if (codificacion === 'utf-8') return;
            showMessage(
                (translations[state.currentLanguage]['srt_codificacion_aviso'] || '')
                    .replace('{0}', nombre || '')
                    .replace('{1}', codificacion),
            );
        }

        
      /**
       * Pregunta sí o no con el cuadro de la propia herramienta.
       *
       * El confirm() del navegador bloquea la página entera, se ve distinto en
       * cada sistema y no se puede traducir ni acompañar de un título. Además
       * la herramienta ya tenía cuadros propios para otras preguntas, así que
       * la mitad de las confirmaciones se veían de una manera y la otra mitad
       * de otra.
       *
       * @param {string} mensaje - Lo que se pregunta.
       * @param {{titulo?: string, peligro?: boolean}} [opciones]
       * @returns {Promise<boolean>} true si se ha pulsado Continuar.
       */
      function pedirConfirmacion(mensaje, opciones = {}) {
          const t = translations[state.currentLanguage] || {};
          confirmModalTitle.textContent = opciones.titulo || t['confirm_title'] || '';
          confirmModalMessage.textContent = mensaje;
          confirmModalOkBtn.className = opciones.peligro ? 'btn btn-destructive' : 'btn btn-primary';
          confirmModal.classList.remove('hidden');
          confirmModalOkBtn.focus();

          return new Promise((resolver) => {
              function cerrar(respuesta) {
                  confirmModal.classList.add('hidden');
                  confirmModalOkBtn.removeEventListener('click', alAceptar);
                  confirmModalCancelBtn.removeEventListener('click', alCancelar);
                  document.removeEventListener('keydown', alTeclado);
                  resolver(respuesta);
              }
              const alAceptar = () => cerrar(true);
              const alCancelar = () => cerrar(false);
              // Escape cancela, como en cualquier cuadro de diálogo.
              const alTeclado = (e) => { if (e.key === 'Escape') cerrar(false); };

              confirmModalOkBtn.addEventListener('click', alAceptar);
              confirmModalCancelBtn.addEventListener('click', alCancelar);
              document.addEventListener('keydown', alTeclado);
          });
      }

      function showMessage(msg) {
            // Limpia cualquier temporizador anterior
            clearTimeout(messageTimeout);
            
            messageText.textContent = msg;

            // ❗ CORRECCIÓN: Quitamos la clase 'hidden' para que el contenedor exista
            messageBox.classList.remove('hidden'); 
            
            // Hacemos visible el mensaje, iniciando la transición de "fade in"
            setTimeout(() => {
                messageBox.classList.add('is-visible');
            }, 10); // Un pequeño retardo para asegurar que la animación se ejecute

            // Configuramos un nuevo temporizador para ocultarlo
            messageTimeout = setTimeout(() => {
                // Quitamos la clase, iniciando la transición de "fade out"
                messageBox.classList.remove('is-visible');
                 // Esperamos a que la animación de salida termine para volver a ocultarlo
                setTimeout(() => {
                    messageBox.classList.add('hidden');
                }, 300); // Coincide con la duración de la transición en CSS
            }, 3000); // El mensaje estará visible por 3 segundos
        }

        // --- Keyboard Shortcuts Modal ---
        shortcutsBtn.addEventListener('click', () => {
            renderShortcutsModal();
            shortcutsModal.classList.remove('hidden');
        });

        shortcutsCloseBtn.addEventListener('click', () => {
            window.removeEventListener('keydown', recordShortcutHandler, true); // Use correct handler
            recordingAction = null;
            shortcutsModal.classList.add('hidden');
        });

        function formatShortcut(shortcut) {
            let parts = [];
            if (shortcut.ctrlKey) parts.push('Ctrl');
            if (shortcut.metaKey) parts.push('Cmd');

            
            if (shortcut.altKey) {
                // Si el perfil es 'mac', usa "Option". Si no, usa "Alt".
                const altKeyName = activeProfile === 'mac' ? 'Option' : 'Alt';
                parts.push(altKeyName);
            }
            

            if (shortcut.shiftKey) parts.push('Shift');
            
            let keyName = shortcut.key;
            if (keyName === ' ') keyName = 'Space';
            
            parts.push(keyName.charAt(0).toUpperCase() + keyName.slice(1));
            return parts.join(' + ');
        }

      function renderShortcutsModal() {
            shortcutsList.innerHTML = '';
            const t = translations[state.currentLanguage];
            const activeShortcuts = shortcutProfiles[activeProfile];

            for (const action in activeShortcuts) {
                if (action === 'docResources') continue;

                const shortcut = activeShortcuts[action];
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center p-2 border-b';
                
                const description = t[shortcut.descriptionKey] || shortcut.descriptionKey;
                
                let shortcutControlsHTML = `
                    <span id="shortcut-display-${action}" class="shortcut-input font-mono">${formatShortcut(shortcut)}</span>
                    <button class="btn btn-secondary text-sm" data-action="${action}" data-i18n="edit_shortcut_btn">${t.edit_shortcut_btn}</button>
                `;

                if (action === 'playSegmentLoop') {
                    shortcutControlsHTML = `
                        <input type="number" min="1" value="${shortcut.loopCount || 3}" onchange="updateLoopCount(this.value)" class="w-16 p-1 border border-gray-300 rounded-md text-center">
                        ${shortcutControlsHTML}
                    `;
                }

                row.innerHTML = `
                    <span>${description}</span>
                    <div class="flex items-center gap-2">
                        ${shortcutControlsHTML}
                    </div>
                `;
                shortcutsList.appendChild(row);
            }

            // ... (El código para la sección "Productive Documentation" no cambia, por lo que se omite por brevedad) ...
            const docSection = document.createElement('div');
            docSection.className = 'mt-6 pt-4 border-t';
            docSection.innerHTML = `<h3 class="text-lg font-bold mb-3" data-i18n="productive_documentation">${t.productive_documentation}</h3>`;
            activeShortcuts.docResources.forEach((resource, index) => {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center p-2 gap-4';
                const urlInput = document.createElement('input');
                urlInput.type = 'text';
                urlInput.className = 'w-full border border-gray-300 rounded-md shadow-sm p-2 text-black bg-white';
                urlInput.placeholder = t.doc_resource_placeholder;
                urlInput.value = resource.url;
                urlInput.oninput = (e) => {
                    shortcutProfiles[activeProfile].docResources[index].url = e.target.value;
                    saveShortcuts();
                };
                const shortcutContainer = document.createElement('div');
                shortcutContainer.className = 'flex items-center gap-2';
                const shortcutDisplay = document.createElement('span');
                shortcutDisplay.id = `shortcut-display-doc_${index}`;
                shortcutDisplay.className = 'shortcut-input font-mono';
                shortcutDisplay.textContent = resource.shortcut ? formatShortcut(resource.shortcut) : '...';
                const editButton = document.createElement('button');
                editButton.className = 'btn btn-secondary text-sm';
                editButton.dataset.action = `doc_${index}`;
                editButton.textContent = t.edit_shortcut_btn;
                shortcutContainer.appendChild(shortcutDisplay);
                shortcutContainer.appendChild(editButton);
                row.appendChild(urlInput);
                row.appendChild(shortcutContainer);
                docSection.appendChild(row);
            });
            shortcutsList.appendChild(docSection);

            shortcutsList.querySelectorAll('button[data-action]').forEach(button => {
                button.addEventListener('click', () => startRecording(button.dataset.action));
            });

            // Lógica para el selector de perfil
            const profileSelector = document.getElementById('shortcutProfileSelector');
            profileSelector.value = activeProfile;
            profileSelector.onchange = (e) => {
                activeProfile = e.target.value;
                localStorage.setItem('shortcutProfile', activeProfile); // Guardar preferencia
                shortcuts = { ...shortcutProfiles[activeProfile] }; // Actualizar atajos activos
                renderShortcutsModal(); // Volver a renderizar el modal con el nuevo perfil
            };
        }
        let recordingAction = null;
        const recordShortcutHandler = (e) => {
            if (!recordingAction) return;
        
            e.preventDefault();
            e.stopPropagation();
        
            const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta'];
            if (modifierKeys.includes(e.key)) {
                return; 
            }
        
            window.removeEventListener('keydown', recordShortcutHandler, true);
        
            const newShortcut = {
                key: e.key === ' ' ? ' ' : e.key.toLowerCase(),
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
metaKey: e.metaKey
            };
        
            // Check for conflicts
            let conflict = Object.keys(shortcuts).some(action => {
                if (action === 'docResources' || action === recordingAction) return false;
                const sc = shortcuts[action];
                return sc.key === newShortcut.key && sc.ctrlKey === newShortcut.ctrlKey && sc.altKey === newShortcut.altKey && sc.shiftKey === newShortcut.shiftKey;
            });

            if (!conflict) {
                conflict = shortcuts.docResources.some((res, i) => {
                    const actionId = `doc_${i}`;
                    if (!res.shortcut || actionId === recordingAction) return false;
                    const sc = res.shortcut;
                    return sc.key === newShortcut.key && sc.ctrlKey === newShortcut.ctrlKey && sc.altKey === newShortcut.altKey && sc.shiftKey === newShortcut.shiftKey;
                });
            }

            if (conflict) {
                showMessage(errorMessages[state.currentLanguage].shortcut_conflict);
            } else {
                if (recordingAction.startsWith('doc_')) {
                    // It's a documentation shortcut
                    const index = parseInt(recordingAction.split('_')[1]);
                    shortcuts.docResources[index].shortcut = newShortcut;
                } else {
                    // It's a regular application shortcut
                   shortcutProfiles[activeProfile][recordingAction] = { ...shortcutProfiles[activeProfile][recordingAction], ...newShortcut };
                }
                saveShortcuts();
            }
        
            recordingAction = null;
            renderShortcutsModal();
        };

        function startRecording(action) {
            // Clear any previous recording state
            window.removeEventListener('keydown', recordShortcutHandler, true);
            document.querySelectorAll('.shortcut-input.recording').forEach(el => {
                const prevAction = el.id.replace('shortcut-display-', '');
                let shortcutToFormat;
                if (prevAction.startsWith('doc_')) {
                    const index = parseInt(prevAction.split('_')[1]);
                    shortcutToFormat = shortcuts.docResources[index].shortcut;
                } else {
                    shortcutToFormat = shortcuts[prevAction];
                }
                el.textContent = shortcutToFormat ? formatShortcut(shortcutToFormat) : '...';
            });

            recordingAction = action;
            const displayEl = document.getElementById(`shortcut-display-${action}`);
            displayEl.classList.add('recording');
            displayEl.textContent = translations[state.currentLanguage].recording_shortcut_text;
            
            window.addEventListener('keydown', recordShortcutHandler, true);
        }

        async function saveShortcuts() {
            try {
                await db.settings.put({ key: 'shortcutProfiles', value: shortcutProfiles });
            } catch (error) {
                console.error("Failed to save shortcuts:", error);
            }
        }

async function loadShortcuts() {
            // 1. Define el perfil base de Windows/Linux
            const windowsProfile = {
                validateAndNext: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'enter', descriptionKey: 'shortcut_desc_validateAndNext' },
                validateAllPrevious: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: 'enter', descriptionKey: 'shortcut_desc_validateAllPrevious' },
                goToNext: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'arrowdown', descriptionKey: 'shortcut_desc_goToNext' },
                goToPrevious: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'arrowup', descriptionKey: 'shortcut_desc_goToPrevious' },
                 insertTM1: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, key: '1', descriptionKey: 'shortcut_desc_insertTM1' },
                insertTM2: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, key: '2', descriptionKey: 'shortcut_desc_insertTM2' },
                insertTM3: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, key: '3', descriptionKey: 'shortcut_desc_insertTM3' },
                insertTM4: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, key: '4', descriptionKey: 'shortcut_desc_insertTM4' },
                insertTM5: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: false, key: '5', descriptionKey: 'shortcut_desc_insertTM5' },
                insertGloss1: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: '1', descriptionKey: 'shortcut_desc_insertGloss1' },
                insertGloss2: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: '2', descriptionKey: 'shortcut_desc_insertGloss2' },
                insertGloss3: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: '3', descriptionKey: 'shortcut_desc_insertGloss3' },
                insertGloss4: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: '4', descriptionKey: 'shortcut_desc_insertGloss4' },
                insertGloss5: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: '5', descriptionKey: 'shortcut_desc_insertGloss5' },
                jumpToTime: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'j', descriptionKey: 'shortcut_desc_jumpToTime' },
                playSegment: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: ' ', descriptionKey: 'shortcut_desc_playSegment' },
                playPause: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: '0', descriptionKey: 'shortcut_desc_playPause' },
                playSegmentLoop: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'l', descriptionKey: 'shortcut_desc_playSegmentLoop', loopCount: 3 },
                seekForward: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: true, key: 'arrowright', descriptionKey: 'shortcut_desc_seekForward' },
                seekBackward: { ctrlKey: false, metaKey: false, altKey: true, shiftKey: true, key: 'arrowleft', descriptionKey: 'shortcut_desc_seekBackward' },
                seekForwardFast: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: 'arrowright', descriptionKey: 'shortcut_desc_seekForwardFast' },
                seekBackwardFast: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: 'arrowleft', descriptionKey: 'shortcut_desc_seekBackwardFast' },
                bold: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'b', descriptionKey: 'shortcut_desc_bold' },
                italic: { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'i', descriptionKey: 'shortcut_desc_italic' },
        docResources: Array.from({ length: 5 }, () => ({ url: '', shortcut: null }))
            };

 // 2. Crea el perfil de Mac a partir del de Windows
            // Esta copia asegura que el perfil de Mac tenga todos los atajos definidos
            const macProfile = JSON.parse(JSON.stringify(windowsProfile));

            // 3. Carga los perfiles guardados si existen.
            //
            // Se mezclan con los de fábrica en vez de sustituirlos: quien ya
            // tenía atajos guardados de una versión anterior no llegaría a ver
            // nunca los que se añaden después, porque su perfil guardado no los
            // trae. Lo guardado manda sobre lo de fábrica, así que las teclas
            // que uno haya cambiado siguen como las dejó.
            const conLosNuevos = (guardado, base) => {
                if (!guardado) return base;
                const mezcla = { ...base, ...guardado };
                // docResources es una lista, no un atajo: se respeta la guardada
                // si la hay, y si no la de fábrica (cinco huecos vacíos).
                mezcla.docResources = guardado.docResources || base.docResources;
                return mezcla;
            };
            try {
                const savedProfiles = await db.settings.get('shortcutProfiles');
                shortcutProfiles.windows = conLosNuevos(savedProfiles?.value?.windows, windowsProfile);
                shortcutProfiles.mac = conLosNuevos(savedProfiles?.value?.mac, macProfile);
            } catch (e) {
                console.error("No se pudieron cargar los perfiles de atajos, usando valores por defecto.", e);
                shortcutProfiles.windows = windowsProfile;
                shortcutProfiles.mac = macProfile;
            }

            // 4. Carga y activa el perfil preferido del usuario
            activeProfile = localStorage.getItem('shortcutProfile') || (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'mac' : 'windows');
            shortcuts = { ...shortcutProfiles[activeProfile] };
        }
        
        restoreShortcutsBtn.addEventListener('click', async () => {
            shortcuts = JSON.parse(JSON.stringify(defaultShortcuts)); // Deep copy
            // Re-initialize docResources
            shortcuts.docResources = [];
            for (let i = 0; i < 5; i++) {
                shortcuts.docResources.push({ url: '', shortcut: null });
            }
            await saveShortcuts();
            renderShortcutsModal();
        });

        exportShortcutsBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(shortcuts, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "subpanda_shortcuts.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });

        importShortcutsInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedShortcuts = JSON.parse(e.target.result);
                    if (typeof importedShortcuts === 'object' && importedShortcuts !== null) {
                        shortcuts = { ...defaultShortcuts, ...importedShortcuts };
                        await loadShortcuts(); // Re-run load to ensure docResources is validated
                        await saveShortcuts();
                        renderShortcutsModal();
                    } else {
                        throw new Error("Invalid format");
                    }
                } catch (err) {
                    showMessage(errorMessages[state.currentLanguage].shortcut_import_error);
                }
            };
            reader.readAsText(file);
            event.target.value = ''; // Reset input
        });

  setupPanel('findReplacePanel', 'findReplaceBtn', () => {
            findInput.focus();
        });
        

        findNextBtn.addEventListener('click', () => findAndNavigate(true));
        findPrevBtn.addEventListener('click', () => findAndNavigate(false));
        replaceBtn.addEventListener('click', replaceCurrentMatch);
        replaceAllBtn.addEventListener('click', replaceAllMatches);

        function findAndNavigate(forward = true) {
            const query = findInput.value;
            if (!query) {
                showMessage(errorMessages[state.currentLanguage]['no_find_query']);
                return;
            }

            findState.query = query;
            findState.caseSensitive = caseSensitiveCheckbox.checked;
            findState.useRegex = regexCheckbox.checked;

            let regex;
            try {
                regex = findState.useRegex ? new RegExp(findState.query, findState.caseSensitive ? '' : 'i') : null;
            } catch (e) {
                showMessage(`Error de expresión regular: ${e.message}`);
                return;
            }

            let startEntryIndex = 0;
            let startMatchIndex = 0;

            if (findState.lastFound) {
                startEntryIndex = findState.lastFound.entryIndex;
                startMatchIndex = forward ? findState.lastFound.matchEnd : findState.lastFound.matchStart - 1;
            } else {
                if (!forward) {
                    startEntryIndex = state.srtEntries.length - 1;
                    startMatchIndex = Infinity;
                }
            }

            let found = false;
            let currentEntryIndex = startEntryIndex;
            const totalEntries = state.srtEntries.length;

            for (let i = 0; i < totalEntries; i++) {
                const entry = state.srtEntries[currentEntryIndex];
                const text = entry.translation;
                let match;

                if (findState.useRegex) {
                    regex.lastIndex = 0;
                    if (forward) {
                        let searchFrom = (currentEntryIndex === startEntryIndex) ? startMatchIndex : 0;
                        const subText = text.substring(searchFrom);
                        match = regex.exec(subText);
                        if (match) {
                            match.index += searchFrom;
                        }
                    } else {
                        let allMatches = [];
                        let tempRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
                        let tempMatch;
                        while((tempMatch = tempRegex.exec(text)) !== null) {
                            allMatches.push(tempMatch);
                        }
                        let searchUntil = (currentEntryIndex === startEntryIndex) ? startMatchIndex : text.length;
                        match = allMatches.reverse().find(m => m.index < searchUntil);
                    }
                } else {
                    const searchText = findState.caseSensitive ? text : text.toLowerCase();
                    const queryLower = findState.caseSensitive ? findState.query : findState.query.toLowerCase();

                    if (forward) {
                        let searchFrom = (currentEntryIndex === startEntryIndex) ? startMatchIndex : 0;
                        const foundIndex = searchText.indexOf(queryLower, searchFrom);
                        if (foundIndex !== -1) {
                            match = { index: foundIndex, 0: text.substring(foundIndex, foundIndex + queryLower.length) };
                        }
                    } else {
                        let searchUntil = (currentEntryIndex === startEntryIndex) ? startMatchIndex : text.length;
                        const foundIndex = searchText.lastIndexOf(queryLower, searchUntil);
                        if (foundIndex !== -1) {
                            match = { index: foundIndex, 0: text.substring(foundIndex, foundIndex + queryLower.length) };
                        }
                    }
                }

                if (match) {
                    findState.lastFound = {
                        entryIndex: currentEntryIndex,
                        matchStart: match.index,
                        matchEnd: match.index + match[0].length,
                    };
                    navigateToTranslation(currentEntryIndex);
                    const targetEditor = document.getElementById(`translation-${currentEntryIndex}`);
                    if (targetEditor) {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.setStart(targetEditor.firstChild, findState.lastFound.matchStart);
                        range.setEnd(targetEditor.firstChild, findState.lastFound.matchEnd);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                    found = true;
                    return;
                }

                currentEntryIndex = (currentEntryIndex + (forward ? 1 : -1) + totalEntries) % totalEntries;
            }

            if (!found) {
                showMessage(errorMessages[state.currentLanguage]['no_match_found']);
                findState.lastFound = null;
            }
        }


    function replaceCurrentMatch() {
            const replaceWith = replaceInput.value; // <-- LÍNEA AÑADIDA: Ahora sí lee el texto de reemplazo

            if (!findState.lastFound || !findState.query) {
                showMessage(errorMessages[state.currentLanguage]['no_match_found']);
                return;
            }

            const { entryIndex, matchStart, matchEnd } = findState.lastFound;
            const entry = state.srtEntries[entryIndex];
            const targetEditor = document.getElementById(`translation-${entryIndex}`);

            if (!entry || !targetEditor) return; // Comprobación de seguridad

            let originalText = entry.translation;
            let replacedText;

            // Esta lógica ahora usa 'replaceWith' para construir el nuevo texto
            if (findState.useRegex) {
                const regex = new RegExp(findState.query, findState.caseSensitive ? '' : 'i');
                replacedText = originalText.substring(0, matchStart) +
                               originalText.substring(matchStart, matchEnd).replace(regex, replaceWith) +
                               originalText.substring(matchEnd);
            } else {
                replacedText = originalText.substring(0, matchStart) +
                               replaceWith +
                               originalText.substring(matchEnd);
            }

            // MEJORA: Actualizamos los datos y la interfaz directamente sin recargar toda la lista
            entry.translation = replacedText;
            targetEditor.innerHTML = replacedText;
            targetEditor.dispatchEvent(new Event('input', { bubbles: true })); // Esto recalcula las estadísticas (CPS, etc.)

            // Buscamos automáticamente la siguiente coincidencia
            findAndNavigate(true);
        }

        function replaceAllMatches() {
            const query = findInput.value;
            const replaceWith = replaceInput.value;
            if (!query) {
                showMessage(errorMessages[state.currentLanguage]['no_find_query']);
                return;
            }

            let replacedCount = 0;
            let regex;
            
            // ❗ CORRECCIÓN: Se ha arreglado la creación de la expresión regular
            try {
                if (regexCheckbox.checked) {
                    // Si el usuario escribe una expresión regular, la usamos tal cual
                    regex = new RegExp(query, (caseSensitiveCheckbox.checked ? 'g' : 'ig'));
                } else {
                    // Si es texto normal, escapamos caracteres especiales para que no den error
                    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    regex = new RegExp(escapedQuery, (caseSensitiveCheckbox.checked ? 'g' : 'ig'));
                }
            } catch (e) {
                showMessage(`Error de expresión regular: ${e.message}`);
                return;
            }

            state.srtEntries.forEach(entry => {
                let originalTranslation = entry.translation;
                
                // Contamos las coincidencias antes de reemplazar
                const matches = originalTranslation.match(regex);
                if (matches) {
                    replacedCount += matches.length;
                }

                // Realizamos el reemplazo
                const newTranslation = originalTranslation.replace(regex, replaceWith);

                if (originalTranslation !== newTranslation) {
                    entry.translation = newTranslation;
                }
            });

            if (replacedCount > 0) {
                // MEJORA: Actualizamos la interfaz de forma más eficiente
                const scrollPosition = document.getElementById('editorMainContent').scrollTop;
                const activeIndex = getCurrentFocusedIndex()?.entryIndex ?? 0;
                renderTranslations(state.srtEntries, activeIndex, true);
                document.getElementById('editorMainContent').scrollTop = scrollPosition;
                updateStatsDisplay();
                showMessage(translations[state.currentLanguage]['replacements_made'].replace('{0}', replacedCount));
            } else {
                showMessage(errorMessages[state.currentLanguage]['no_match_found']);
            }

            findState.lastFound = null;
        }

        /**
         * Pone en el botón del tema el nombre del modo al que lleva.
         *
         * No se puede traducir con data-i18n porque el texto depende de dos
         * cosas a la vez: del idioma y de en qué modo se está. Se llama al
         * arrancar, al cambiar de modo y al cambiar de idioma.
         */
        function actualizarBotonTema() {
            const boton = document.getElementById('themeToggleBtn');
            if (!boton) return;
            const textos = translations[state.currentLanguage] || translations.en;
            const oscuro = document.documentElement.classList.contains('dark');
            boton.textContent = textos[oscuro ? 'light_mode_btn' : 'dark_mode_btn'];
        }

       function setLanguage(lang) {

    state.currentLanguage = lang;
    
    // El selector es un desplegable: en el botón se lee el idioma que está
    // puesto y dentro se marca con una palomita el activo. Cada nombre va
    // escrito en su propio idioma, como es costumbre: así lo reconoce quien no
    // entiende el idioma en el que está la página ahora mismo.
    const NOMBRES_DE_IDIOMA = { en: 'English', es: 'Español' };
    langEnBtn?.classList.toggle('active-lang', lang === 'en');
    langEsBtn?.classList.toggle('active-lang', lang !== 'en');
    const langActual = document.getElementById('langActual');
    if (langActual) langActual.textContent = NOMBRES_DE_IDIOMA[lang] || NOMBRES_DE_IDIOMA.en;

    
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (!t[key]) return;
        // Algunos botones llevan además un aviso: lo que se usa mucho pero no
        // está en la norma del formato, como el color de un SRT. Se añade aquí
        // y no al pintar el botón, para que siga estando al cambiar de idioma.
        const aviso = el.getAttribute('data-i18n-aviso');
        el.title = aviso && t[aviso] ? `${t[key]} — ${t[aviso]}` : t[key];
    });
    
    if (state.srtEntries.length > 0) {
        const activeIndex = getCurrentFocusedIndex()?.entryIndex ?? lastActiveSubtitleIndex;
        renderTranslations(state.srtEntries, activeIndex, true);
    }
    // El texto de bienvenida lo traduce el recorrido general de [data-i18n]:
    // escribirlo aquí sobre #initialMessage borraría el panda, que es un
    // hermano del párrafo dentro del mismo bloque.
    renderGlossary();
    tmSearch();
    retraducirSaludoDeIA();


// Actualizar títulos de botones dinámicamente
    document.getElementById('zoomBtn').title = t['zoom_in'];
    // Actualiza el título del botón de bloqueo según su estado actual
    lockWaveformBtn.title = isWaveformLocked ? t['unlock_waveform'] : t['lock_waveform'];
followPlaybackBtn.title = isFollowPlaybackActive ? t['follow_playback_off'] : t['follow_playback_on'];
}


        // --- Terminology Sidebar Logic ---
        function setupPanel(panelId, buttonId, openCallback) {
            const panel = document.getElementById(panelId);
            const button = document.getElementById(buttonId);
            const closeButton = panel.querySelector('button[id^="close"]');
            const resetButton = panel.querySelector('.reset-panel-btn');

            button.addEventListener('click', () => {
                openFloatingPanel(panel, button, openCallback);
            });

            closeButton.addEventListener('click', () => {
                closeFloatingPanel(panel, button);
            });
            
            resetButton.addEventListener('click', (e) => {
                e.stopPropagation();
                resetPanelPosition(panel);
            });
        }

        // El desplegable de idiomas lo llena ahora core/idiomas.js, que es la
        // misma lista que usa Poanda. La que había aquí rellenaba un <datalist>
        // para los campos de texto de la configuración de idiomas, que ya no
        // existen: el par se elige una vez, en su cuadro, y es del proyecto.

        // El glosario y la memoria de traducción viven ahora en sus propios
        // módulos, traídos de Poanda: glossary.js, tm.js, termino-tarjeta.js,
        // termino-modal.js y paneles.js, con la lógica pura en core/.
        //
        // Lo que había aquí eran unas 700 líneas con la versión anterior de lo
        // mismo: los paneles flotantes, la configuración de idiomas por
        // duplicado (una para el glosario y otra para la memoria), la tabla de
        // tres columnas de las coincidencias y un cálculo de parecido que
        // recorría la memoria entera en cada cambio de subtítulo.

        function showLoadingOverlay(message) {
            if (loadingMessage && loadingOverlay) {
                loadingMessage.textContent = message;
                loadingOverlay.classList.remove('hidden');
            }
        }

        function hideLoadingOverlay() {
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }

        /**
         * Le dice al selector de archivos qué se puede abrir.
         *
         * Sale de la tabla de formatos y no de una lista escrita a mano en el
         * HTML: así, añadir un formato a la tabla lo añade también al selector,
         * y no puede quedarse un formato que se abre arrastrándolo pero que el
         * selector no deja elegir.
         */
        function ponerLoQueSePuedeAbrir() {
            const soloSubtitulos = EXTENSIONES.join(',');
            const conProyectos = [...EXTENSIONES, '.subpanda'].join(',');

            for (const [id, lista] of [
                ['srtFile', soloSubtitulos],
                ['translatedSrtFile', soloSubtitulos],
                ['srtFileBienvenida', conProyectos],
            ]) {
                const campo = document.getElementById(id);
                if (campo) campo.setAttribute('accept', lista);
            }
        }

        /**
         * Abre el archivo que se acaba de soltar o elegir.
         *
         * Vale un archivo de subtítulos (empezar de cero) o un .subpanda
         * (seguir un proyecto).
         *
         * @param {FileList|File[]} archivos
         */
        async function abrirArchivoSoltado(archivos) {
            const admitidas = [...EXTENSIONES, '.subpanda'];
            const archivo = Array.from(archivos || []).find((f) =>
                admitidas.some((ext) => f.name.toLowerCase().endsWith(ext)),
            );
            if (!archivo) {
                showMessage(errorMessages[state.currentLanguage]['drop_wrong_file']);
                return;
            }
            if (!archivo.name.toLowerCase().endsWith('.subpanda')) await processFile(archivo);
            else await loadProject({ target: { files: [archivo] } });
        }

        /**
         * Engancha el bocadillo de la bienvenida como zona de arrastre.
         *
         * Se llama cada vez que se pinta la bienvenida, porque el bocadillo se
         * crea de nuevo: enganchar el de la primera vez sería enganchar algo
         * que ya no existe.
         */
        /**
         * Las pestañas de la columna de consulta.
         *
         * Una sola a la vista cada vez. La memoria y el glosario son lo que se
         * consulta mientras se traduce; el planificador se mira una vez al
         * empezar el encargo, así que no tiene por qué estar quitando sitio
         * todo el rato.
         */
        function engancharPestanas() {
            const pestanas = document.querySelectorAll('.panel-pestana');
            const cuerpos = {
                paneles: 'pestanaPaneles',
                ia: 'aiSidebar',
                qa: 'qaContainer',
                planificador: 'plannerContainer',
            };

            /** Qué botón de la barra corresponde a cada pestaña. */
            const botones = { paneles: 'panelesBtn', ia: 'aiBtn', qa: 'qaBtn' };

            /** La pestaña que se está viendo, aunque la columna esté escondida. */
            const laQueSeVe = () =>
                document.querySelector('.panel-pestana.activa')?.dataset.pestana;

            const enseñar = (cual) => {
                pestanas.forEach((p) => {
                    const suya = p.dataset.pestana === cual;
                    p.classList.toggle('activa', suya);
                    p.setAttribute('aria-selected', String(suya));
                });
                for (const [nombre, id] of Object.entries(cuerpos)) {
                    document.getElementById(id)?.classList.toggle('hidden', nombre !== cual);
                }
                // Cada pestaña recuerda su propio ancho de columna: una
                // conversación necesita más que una ficha de glosario. Lo hace
                // paneles.js, que es de quien es el ancho.
                document.dispatchEvent(
                    new CustomEvent('subpanda:pestana', { detail: cual }),
                );
                pintarBotonesDePestanas();
            };

            pestanas.forEach((p) => p.addEventListener('click', () => enseñar(p.dataset.pestana)));

            // Desde fuera: el recuento de la cabecera y el de la barra de
            // estado llevan aquí, que es donde está la lista de errores.
            irAlQa = () => {
                irA('qa');
                yaSeHaRevisado = true;
                renderQaErrorList();
            };

            /** Enseña la columna en una pestaña, sacándola de su escondite. */
            const irA = (cual) => {
                document.body.classList.remove('paneles-ocultos');
                guardarSiEstanOcultos();
                enseñar(cual);
            };

            /** Cierra la columna entera y apaga los botones. */
            const cerrarColumna = () => {
                document.body.classList.add('paneles-ocultos');
                guardarSiEstanOcultos();
                pintarBotonesDePestanas();
            };

            /**
             * Lo que hace un botón de la barra: llevar a su pestaña, y cerrar la
             * columna si ya estabas en ella.
             *
             * Es como se portaba el de la memoria y el glosario, que abría y
             * cerraba; los otros dos solo abrían, así que para quitarlos de en
             * medio había que ir a buscar un tercer botón.
             */
            const alternarPestana = (cual) => {
                const abierta =
                    document.body.classList.contains('con-proyecto') &&
                    !document.body.classList.contains('paneles-ocultos');
                if (abierta && laQueSeVe() === cual) cerrarColumna();
                else irA(cual);
            };

            for (const [pestana, id] of Object.entries(botones)) {
                document
                    .getElementById(id)
                    ?.addEventListener('click', () => alternarPestana(pestana));
            }

            // El planificador se mira una vez al empezar, así que vive en el
            // menú de Herramientas y no en la barra: desde ahí solo se abre.
            document.getElementById('plannerBtn')?.addEventListener('click', () => irA('planificador'));

            // La equis de la propia columna, para quitarla de en medio sin tener
            // que acordarse de con qué botón se abrió.
            document.getElementById('cerrarPanelesBtn')?.addEventListener('click', cerrarColumna);

            // Y desde dentro del propio asistente, que se abre solo cuando se le
            // pide una traducción con el botón rápido. Lo pide por un evento
            // porque ia.js no puede importar de aquí sin cerrar un círculo.
            document.addEventListener('subpanda:abrir-pestana', (evento) => {
                if (cuerpos[evento.detail]) irA(evento.detail);
            });

            pintarBotonesDePestanas();
        }

        /**
         * Convierte un bocadillo del panda en zona de arrastre.
         *
         * Sirve para los dos: el de la bienvenida, que recibe el .srt, y el del
         * reproductor, que pide el vídeo. Lo que cambia entre ellos es qué se
         * hace con el archivo, y eso llega en `recibir`.
         *
         * @param {HTMLElement} zona La etiqueta que se pulsa y sobre la que se suelta.
         * @param {HTMLInputElement} campo El selector de archivos que abre.
         * @param {(archivos: FileList) => void|Promise<void>} recibir
         * @param {{escucharElCampo?: boolean}} opciones El campo del vídeo ya
         *   tiene quien lo escuche; ponerle otro cargaría el archivo dos veces.
         */
        function hacerZonaDeSoltar(zona, campo, recibir, { escucharElCampo = true } = {}) {
            if (!zona || !campo || zona.dataset.enganchada) return;
            zona.dataset.enganchada = 'sí';

            if (escucharElCampo) {
                campo.addEventListener('change', async (evento) => {
                    await recibir(evento.target.files);
                    evento.target.value = '';
                });
            }

            // La etiqueta abre el selector al pulsarla; con el teclado hay que
            // decirlo, que Enter sobre un <label> no hace nada por su cuenta.
            zona.addEventListener('keydown', (evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    campo.click();
                }
            });

            for (const nombre of ['dragenter', 'dragover']) {
                zona.addEventListener(nombre, (evento) => {
                    evento.preventDefault();
                    evento.stopPropagation();
                    zona.classList.add('bienvenida-encima');
                });
            }
            for (const nombre of ['dragleave', 'dragend']) {
                zona.addEventListener(nombre, () => zona.classList.remove('bienvenida-encima'));
            }
            zona.addEventListener('drop', async (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                zona.classList.remove('bienvenida-encima');
                await recibir(evento.dataTransfer.files);
            });
        }

        /**
         * Engancha el bocadillo de la bienvenida.
         *
         * Se llama cada vez que se pinta la bienvenida, porque el bocadillo se
         * crea de nuevo: enganchar el de la primera vez sería enganchar algo
         * que ya no existe.
         */
        function engancharZonaDeSoltar() {
            hacerZonaDeSoltar(
                document.getElementById('zonaSoltar'),
                document.getElementById('srtFileBienvenida'),
                abrirArchivoSoltado,
            );
        }

        /** El panda del reproductor, que pide el vídeo del encargo. */
        hacerZonaDeSoltar(
            document.getElementById('videoLogoPlaceholder'),
            videoFileInput,
            (archivos) => {
                const archivo = Array.from(archivos || []).find((f) =>
                    f.type.startsWith('video/') || f.type.startsWith('audio/'),
                );
                if (!archivo) {
                    showMessage(errorMessages[state.currentLanguage]['video_load_error']);
                    return;
                }
                cargarVideo({ target: { files: [archivo] } });
            },
            { escucharElCampo: false },
        );

        if (dropArea) {
            dropArea.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dropArea.classList.add('border-blue-500');
            });
            dropArea.addEventListener('dragleave', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dropArea.classList.remove('border-blue-500');
            });
            dropArea.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                dropArea.classList.remove('border-blue-500');
                // Soltar en cualquier parte de la ventana sigue valiendo, no
                // solo en el bocadillo: es lo que ya hacía y no estorba.
                await abrirArchivoSoltado(event.dataTransfer.files);
            });
        }

        // El acordeón de "añadir término" ya no existe: la ficha de un
        // término se rellena en su propio cuadro, que es donde caben sus cinco
        // campos sin comerse la lista de términos.

        if (statsAccordionHeader && statsAccordionContent && statsAccordionIcon) {
            statsAccordionHeader.addEventListener('click', () => {
                const isCollapsed = statsAccordionContent.classList.contains('collapsed');
                if (isCollapsed) {
                    statsAccordionContent.classList.remove('collapsed');
                    statsAccordionContent.classList.add('expanded');
                    statsAccordionIcon.classList.remove('rotated');
                } else {
                    statsAccordionContent.classList.remove('expanded');
                    statsAccordionContent.classList.add('collapsed');
                    statsAccordionIcon.classList.add('rotated');
                }
            });
        }

        /**
         * Dice en el recuadro de la onda qué está pasando.
         *
         * Este aviso estaba escrito y comentado, así que cuando la onda no se
         * podía dibujar no se decía nada: quedaba un recuadro en blanco y a
         * quien lo mirara le tocaba adivinar si el archivo tardaba, si estaba
         * roto o si la herramienta se había colgado. Un fallo que no se cuenta
         * es peor que el fallo.
         *
         * Va en el propio recuadro y no en un mensaje que pasa, porque es donde
         * se está mirando y porque tiene que seguir ahí mientras el problema
         * siga.
         *
         * @param {string} texto Vacío para quitarlo.
         * @param {boolean} [esFallo]
         */
        function laOndaDice(texto, esFallo = false) {
            const donde = document.getElementById('ondaDice');
            if (!donde) return;
            donde.textContent = texto || '';
            donde.classList.toggle('hidden', !texto);
            donde.classList.toggle('onda-dice-fallo', Boolean(esFallo));
        }

        /**
         * Traduce el fallo de la onda a algo que se pueda leer y hacer algo con
         * ello.
         *
         * El reproductor sabe más que WaveSurfer sobre por qué no ha podido: su
         * `error.code` distingue "no sé leer este formato" de "se ha cortado la
         * descarga", y son dos problemas con dos soluciones distintas.
         *
         * @param {Error} fallo
         */
        function loQueLePasaALaOnda(fallo) {
            const t = translations[state.currentLanguage];
            const codigo = videoPlayer.error?.code;

            // 3 es que no puede descodificarlo y 4 que no reconoce el formato:
            // en los dos casos es el audio lo que no sabe leer.
            let porQue = '';
            if (codigo === 3 || codigo === 4) porQue = t.onda_error_formato;
            // "Failed to fetch" es que no ha podido leer el archivo del disco:
            // pasa con los que están en iCloud sin descargar o en una unidad de
            // red. El vídeo puede verse igual y la onda no.
            else if (codigo === 2 || /fetch/i.test(fallo?.message || '')) porQue = t.onda_error_red;
            else if (fallo?.message) porQue = t.onda_error_motivo.replace('{motivo}', fallo.message);

            laOndaDice([t.onda_error, porQue].filter(Boolean).join(' '), true);
        }

        /**
         * Carga un vídeo, venga de donde venga.
         *
         * Hay dos sitios desde donde se puede: el botón que sale al pasar el
         * ratón por el reproductor y la entrada del menú Archivo. Es la misma
         * acción, así que es la misma función.
         */
        function cargarVideo(event) {
            const file = event.target.files[0];
            if (file) {
                videoFileName = file.name; // Store video file name
                const videoURL = URL.createObjectURL(file);
                videoPlayer.src = videoURL;
                // Un episodio de cuarenta minutos tarda en leerse, y sin
                // decir nada el recuadro vacío parece que se ha colgado.
                laOndaDice(translations[state.currentLanguage].onda_leyendo);

                // loadBlob y no load(url): con la URL, WaveSurfer se descarga
                // otra vez el archivo entero con fetch —los mismos bytes que el
                // reproductor acaba de coger— y esa segunda lectura falla con
                // "Failed to fetch" cuando el archivo no está del todo en el
                // disco: en iCloud sin descargar, en un disco en red, o si el
                // sistema lo mueve mientras tanto. El vídeo se ve, porque el
                // reproductor ya lo tenía, y la onda se queda en blanco.
                //
                // Con el propio archivo no hay descarga que falle ni bytes que
                // pasen dos veces por la memoria.
                wavesurfer.loadBlob(file).catch(loQueLePasaALaOnda);
                document.getElementById('ondaBloque').classList.remove('hidden');
                videoPlayer.controls = true;
                videoPlayer.load();
                     
                document.getElementById('videoLogoPlaceholder').classList.add('hidden');
        
                const loadVideoBtnSpan = document.querySelector('#loadVideoBtn span');
                if (loadVideoBtnSpan) {
                    loadVideoBtnSpan.textContent = translations[state.currentLanguage]['change_video'];
                }
            } else {
                showMessage(errorMessages[state.currentLanguage]['video_load_error']);
            }
        }

        videoFileInput.addEventListener('change', cargarVideo);
        // La misma acción desde el menú Archivo, para quien no sepa que el
        // botón está escondido encima del reproductor.
        document.getElementById('videoFileMenuInput')?.addEventListener('change', cargarVideo);

        /**
         * Jumps the video player to the start time of the specified subtitle and plays until the end time.
         * @param {number} entryIndex The index of the SRT entry to play.
         */
        /**
         * Cuánto antes del final para la reproducción del subtítulo.
         *
         * Se para un poco antes de que el subtítulo se vaya de la pantalla, y no
         * justo al final: parando al final, el vídeo se queda congelado en el
         * primer fotograma en el que ya no hay subtítulo, y lo que se estaba
         * yendo a mirar —cómo queda el texto sobre la imagen— ya no está. Así se
         * puede seguir escribiendo en la caja con el subtítulo delante.
         *
         * Un cuarto de segundo: lo justo para no comerse la última palabra de un
         * subtítulo corto.
         */
        const ANTES_DEL_FINAL_MS = 250;

        function jumpToCurrentSubtitleTime(entryIndex) {
            if (state.srtEntries[entryIndex] && videoPlayer.src) {
                const entry = state.srtEntries[entryIndex];
                // En un subtítulo muy corto no se recorta más de un tercio: es
                // mejor perder la vista previa que no llegar a oír la frase.
                const margen = Math.min(ANTES_DEL_FINAL_MS, entry.durationMs / 3);
                const stopTime = (entry.endTimeMs - margen) / 1000;
                videoPlayer.currentTime = entry.startTimeMs / 1000;
                videoPlayer.play();

                if (timeUpdateListener) {
                    videoPlayer.removeEventListener('timeupdate', timeUpdateListener);
                }

                timeUpdateListener = () => {
                    // CORRECCIÓN: El listener ahora también se detiene si el vídeo se pausa
                    // por cualquier otro motivo (ej. el usuario le da a la pausa).
                    if (videoPlayer.currentTime >= stopTime || videoPlayer.paused) {
                        videoPlayer.pause(); // Pausa
                        videoPlayer.removeEventListener('timeupdate', timeUpdateListener);
                        timeUpdateListener = null;
                    }
                };
                
                videoPlayer.addEventListener('timeupdate', timeUpdateListener);

// Centra la vista de la onda en la región (AÑADIDO)
                 if (wsRegions) {
                     const region = regionDe(entry);
                     if (region) {
                         // Centrar la región en la vista de la onda
                         const duration = wavesurfer.getDuration();
                         const regionCenter = (region.start + region.end) / 2;
                         // Opcional: un pequeño zoom si es necesario
                         // wavesurfer.zoom(Number(document.getElementById('zoom-slider')?.value || 100));
         }
                 }
             }
        } // Fin de jumpToCurrentSubtitleTime
       
/**
 * Gestiona el resaltado y scroll automático durante la reproducción si el seguimiento está activo.
 */
function handlePlaybackTracking() {
    if (!isFollowPlaybackActive || !videoPlayer.src || state.srtEntries.length === 0 || !wsRegions) {
        // Si la función está desactivada o no hay nada que seguir, limpiamos resaltados
        clearPlaybackHighlights();
        return;
    }

    const currentTime = videoPlayer.currentTime;
    let activeEntryIndex = -1;
    let activeEntry = null;

    // Encuentra el subtítulo activo (igual que en updateSubtitlePreview)
    for (let i = 0; i < state.srtEntries.length; i++) {
        const entry = state.srtEntries[i];
        const startTime = entry.startTimeMs / 1000;
        const endTime = entry.endTimeMs / 1000;
        if (currentTime >= startTime && currentTime < endTime) { // Usamos < endTime para evitar solapamientos
            activeEntryIndex = i;
            activeEntry = entry;
            break;
        }
    }

    // Si NO encontramos un subtítulo activo
    if (activeEntryIndex === -1) {
        clearPlaybackHighlights();
        currentlyTrackedRegionId = null;
        currentlyTrackedEditorIndex = -1;
// --- INICIO CÓDIGO AÑADIDO ---
        // Limpiar la clase activa si no hay ningún subtítulo en reproducción
        if (lastFocusedEditorUnitIndex !== -1) {
            const prevUnit = document.getElementById(`translation-unit-${lastFocusedEditorUnitIndex}`);
            if (prevUnit) prevUnit.classList.remove('translation-unit-active');
            lastFocusedEditorUnitIndex = -1;
        }
        // --- FIN CÓDIGO AÑADIDO ---
        return;
    }

    // Si el subtítulo activo es el MISMO que ya estábamos siguiendo, no hacemos nada más
    if (currentlyTrackedEditorIndex === activeEntryIndex) {
        return;
    }

    // --- HEMOS ENCONTRADO UN NUEVO SUBTÍTULO ACTIVO ---

    // 1. Limpia los resaltados anteriores
    clearPlaybackHighlights();

    // 2. Resalta la nueva región en la onda
    const activeRegion = regionDe(activeEntry);
    if (activeRegion && activeRegion.element) {
        activeRegion.element.classList.add('region-playback-active');
        currentlyTrackedRegionId = activeEntry.regionId; // Guarda el ID actual
    }

    // 3. Haz scroll y activa el foco en el editor
        const editorUnit = document.getElementById(`translation-unit-${activeEntryIndex}`);
        if (editorUnit) {
            // --- INICIO CÓDIGO AÑADIDO ---
            // Busca el div editable DENTRO de la unidad del subtítulo
            const editorDiv = editorUnit.querySelector(`div[contenteditable="true"][data-entry-index="${activeEntryIndex}"]`);
            // --- FIN CÓDIGO AÑADIDO ---

            // Solo hacemos scroll si el elemento no está ya visible en el centro
            const rect = editorUnit.getBoundingClientRect();
            // CORRECCIÓN: Asegúrate de que parentElement.parentElement existe
            const parentContainer = document.getElementById('editorMainContent'); // Usar ID es más seguro
            const parentRect = parentContainer ? parentContainer.getBoundingClientRect() : null;
            const isVisible = parentRect && rect.top >= parentRect.top && rect.bottom <= parentRect.bottom;


            if (!isVisible) {
                 editorUnit.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 // --- CÓDIGO AÑADIDO (Focus después del scroll) ---
                 // Añadimos un pequeño retardo para asegurar que el scroll ha terminado
                 // antes de intentar poner el foco, especialmente con 'smooth' scroll.
                 if (editorDiv) {
// --- INICIO CÓDIGO AÑADIDO ---
                // Limpiar la clase del anterior subtítulo con foco si existe
                if (lastFocusedEditorUnitIndex !== -1 && lastFocusedEditorUnitIndex !== activeEntryIndex) {
                    const prevUnit = document.getElementById(`translation-unit-${lastFocusedEditorUnitIndex}`);
                    if (prevUnit) prevUnit.classList.remove('translation-unit-active');
                }
                // Añadir la clase al actual
                if (editorUnit) editorUnit.classList.add('translation-unit-active');
                lastFocusedEditorUnitIndex = activeEntryIndex; // Actualizar
                // --- FIN CÓDIGO AÑADIDO ---
                    setTimeout(() => editorDiv.focus(), 300); // 300ms de retardo
                 }
                 // --- FIN CÓDIGO AÑADIDO ---
            } else {
                // --- CÓDIGO AÑADIDO (Focus si ya es visible) ---
                 // Si ya estaba visible, ponemos el foco directamente
                 if (editorDiv && document.activeElement !== editorDiv) {
// --- INICIO CÓDIGO AÑADIDO ---
                // Limpiar la clase del anterior subtítulo con foco si existe
                if (lastFocusedEditorUnitIndex !== -1 && lastFocusedEditorUnitIndex !== activeEntryIndex) {
                    const prevUnit = document.getElementById(`translation-unit-${lastFocusedEditorUnitIndex}`);
                    if (prevUnit) prevUnit.classList.remove('translation-unit-active');
                }
                // Añadir la clase al actual
                if (editorUnit) editorUnit.classList.add('translation-unit-active');
                lastFocusedEditorUnitIndex = activeEntryIndex; // Actualizar
                // --- FIN CÓDIGO AÑADIDO ---
                     editorDiv.focus();
                 }
                 // --- FIN CÓDIGO AÑADIDO ---
            }

            currentlyTrackedEditorIndex = activeEntryIndex; // Guarda el índice actual
        }
    }

/**
 * Limpia los resaltados visuales aplicados por handlePlaybackTracking.
 */
function clearPlaybackHighlights() {
    // Limpiar región de la onda
    if (currentlyTrackedRegionId && wsRegions) {
        const previousRegion = regionesDeSubtitulos.get(currentlyTrackedRegionId);
        if (previousRegion && previousRegion.element) {
            previousRegion.element.classList.remove('region-playback-active');
        }
    }
}
 
        /**
         * Pinta encima del vídeo los subtítulos que estén sonando ahora.
         *
         * Los que estén, en plural: en un ASS es de lo más normal que haya dos a
         * la vez —un cartel arriba y el diálogo abajo—, y eso no es un caso raro
         * del formato, es para lo que se hizo. Se enseñaba solo el primero, así
         * que al revisar un archivo con carteles faltaba justo la mitad de lo
         * que había que mirar.
         */
        function updateSubtitlePreview() {
            if (!videoPlayer.src || state.srtEntries.length === 0) {
                vaciarLaVistaPrevia();
                return;
            }

            const ahora = videoPlayer.currentTime;
            const sonando = state.srtEntries.filter(
                (entrada) =>
                    ahora >= entrada.startTimeMs / 1000 && ahora <= entrada.endTimeMs / 1000,
            );

            if (sonando.length === 0) {
                vaciarLaVistaPrevia();
                return;
            }

            pintarLaVistaPrevia(sonando);
        }

        /** Deja la vista previa sin nada. */
        function vaciarLaVistaPrevia() {
            subtitlePreviewText.innerHTML = '';
        }

        /**
         * Ata la vista previa al vídeo y no al hueco que lo contiene.
         *
         * El hueco tiene una altura mínima para que quepa el panda que pide el
         * vídeo, así que con un vídeo bajito sobra negro por abajo. El subtítulo
         * se colocaba respecto al hueco y acababa en esa banda negra, fuera de
         * la imagen: donde no va a estar cuando alguien vea el vídeo de verdad.
         */
        function ajustarLaVistaPrevia() {
            if (!subtitlePreviewOverlay || !videoPlayer) return;
            const alto = videoPlayer.clientHeight;
            subtitlePreviewOverlay.style.height = alto > 0 ? `${alto}px` : '';
        }

        /**
         * Pinta los subtítulos que estén sonando, cada uno como se va a ver.
         *
         * Con un SRT esto es el texto con su cursiva. Con un ASS es algo más: el
         * color, el cuerpo y la esquina en la que sale cada línea no están en el
         * texto, están en el estilo que tiene asignada esa línea, en la cabecera
         * del archivo. Un archivo con cuatro estilos son cuatro cosas distintas
         * en pantalla.
         *
         * La pantalla se reparte en tres franjas —arriba, en medio y abajo— y
         * cada subtítulo va a la suya. Así dos a la vez se ven los dos y en su
         * sitio, en lugar de uno encima del otro.
         *
         * @param {Array<Object>} sonando
         */
        function pintarLaVistaPrevia(sonando) {
            const franjas = { arriba: [], medio: [], abajo: [] };

            for (const entrada of sonando) {
                const texto =
                    previewSource === 'translation'
                        ? entrada.translation.trim() || entrada.original
                        : entrada.original;

                franjas[dondeVa(texto, entrada)].push(unSubtitulo(texto, entrada));
            }

            subtitlePreviewText.innerHTML = ['arriba', 'medio', 'abajo']
                .map((cual) => `<span class="previa-franja previa-${cual}">${franjas[cual].join('')}</span>`)
                .join('');
        }

        /** En qué franja de la pantalla va este subtítulo. */
        function dondeVa(texto, entrada) {
            const comoEnElVideo = formatoDelArchivo?.paraElVideo;
            if (!comoEnElVideo) return 'abajo';
            return comoEnElVideo(texto, entrada, documentoDelArchivo).vertical || 'abajo';
        }

        /**
         * Un subtítulo, listo para pintarlo.
         *
         * @param {string} texto
         * @param {Object} entrada
         * @returns {string} HTML.
         */
        function unSubtitulo(texto, entrada) {
            const comoEnElVideo = formatoDelArchivo?.paraElVideo;

            if (!comoEnElVideo) {
                // Lo mismo que se va a escribir en el archivo, con los saltos
                // convertidos para que el navegador los pinte: así lo que se ve
                // encima del vídeo es lo que sale en el archivo, y una cursiva
                // que aquí se vea es una cursiva que allí estará.
                const visto = comoSeVe(paraLaVistaPrevia(texto, formatoDelArchivo.etiquetas));
                return `<span class="previa-linea">${visto}</span>`;
            }

            const visto = comoEnElVideo(texto, entrada, documentoDelArchivo);
            const estilo = Object.entries(visto.css || {})
                .map(([propiedad, valor]) => `${enCss(propiedad)}: ${valor}`)
                .join('; ');
            const alineado =
                visto.horizontal && visto.horizontal !== 'centro'
                    ? `text-align: ${visto.horizontal === 'izquierda' ? 'left' : 'right'}`
                    : '';

            const todo = [estilo, alineado].filter(Boolean).join('; ');
            const html = String(visto.html || '').replace(/\n/g, '<br>');

            return `<span class="previa-linea" style="${escaparHtml(todo)}">${html}</span>`;
        }

        /** "fontStyle" a "font-style", que es como lo quiere un atributo style. */
        const enCss = (propiedad) => propiedad.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);

/**
 * Los diez tamaños del subtítulo de la vista previa, en píxeles.
 *
 * El control iba en píxeles y subía y bajaba de dos en dos desde 10 hasta 60.
 * La cifra en píxeles no dice nada sin ver el vídeo —depende de lo grande que
 * esté el reproductor—, y el mínimo de 10 seguía siendo grande. Ahora es una
 * escala del 1 al 10: el 1 es de verdad pequeño y se entra por el 4.
 */
const TAMANOS_DEL_SUBTITULO = [9, 12, 15, 19, 23, 28, 34, 41, 49, 58];
const TAMANO_POR_DEFECTO = 3;

/**
 * Pone el tamaño del subtítulo de la vista previa.
 * @param {number} paso Del 1 al 10.
 */
function updateFontSize(paso) {
    if (paso < 1 || paso > TAMANOS_DEL_SUBTITULO.length) return;

    subtitleFontSize = paso;
    const pixeles = TAMANOS_DEL_SUBTITULO[paso - 1];
    if (fontSizeDisplay) fontSizeDisplay.textContent = String(paso);
    if (fontSizeRange && Number(fontSizeRange.value) !== paso) fontSizeRange.value = String(paso);
    document.documentElement.style.setProperty('--user-font-size', `${pixeles}px`);

    // En pantalla completa el vídeo es mucho más grande, así que el subtítulo
    // también tiene que serlo: se guarda la proporción en vez de sumar píxeles.
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (isFullscreen) {
        subtitlePreviewText.style.fontSize = `${Math.round(pixeles * 2.2)}px`;
    }
}

/**
 * Establece la fuente de texto para la vista previa (original o traducción).
 * @param {string} source - Puede ser 'original' o 'translation'.
 */
function setPreviewSource(source) {
    previewSource = source;
    for (const opcion of document.querySelectorAll('.eleccion-opcion[data-fuente]')) {
        opcion.classList.toggle('activa', opcion.dataset.fuente === source);
    }
    updateSubtitlePreview();
}

/** Las velocidades que se pueden elegir, en el orden del deslizador. */
const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Pone la velocidad de reproducción.
 * @param {number} escalon Índice dentro de VELOCIDADES.
 */
function ponerVelocidad(escalon) {
    velocidadDeReproduccion = VELOCIDADES[escalon] ?? 1;
    videoPlayer.playbackRate = velocidadDeReproduccion;
    const cifra = document.getElementById('playbackRateValor');
    if (cifra) cifra.textContent = `${velocidadDeReproduccion}×`;
}

/**
 * Mueve el vídeo un segundo, hacia atrás o hacia delante.
 * @param {number} segundos Negativo para atrás.
 */
function saltarSegundos(segundos) {
    if (!videoPlayer.src || !Number.isFinite(videoPlayer.duration)) return;
    videoPlayer.currentTime = Math.min(
        Math.max(0, videoPlayer.currentTime + segundos),
        videoPlayer.duration,
    );
}

/** Reproduce o pausa el vídeo, y pone el icono que toca. */
function alternarReproduccion() {
    if (!videoPlayer.src) return;
    if (videoPlayer.paused) videoPlayer.play();
    else videoPlayer.pause();
}

/** Enseña el triángulo o las dos barras, según esté. */
function pintarBotonDeReproduccion() {
    const sonando = !videoPlayer.paused && !videoPlayer.ended;
    playPauseBtn?.querySelector('.icono-play')?.classList.toggle('hidden', sonando);
    playPauseBtn?.querySelector('.icono-pausa')?.classList.toggle('hidden', !sonando);
}

function toggleFullscreen() {
    // Comprueba si ya estamos en modo pantalla completa
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        // Si no lo estamos, solicita la pantalla completa para el CONTENEDOR
        if (videoBloque.requestFullscreen) {
            videoBloque.requestFullscreen();
        } else if (videoBloque.webkitRequestFullscreen) { /* Safari */
            videoBloque.webkitRequestFullscreen();
        } else if (videoBloque.msRequestFullscreen) { /* IE11 */
            videoBloque.msRequestFullscreen();
        }
    } else {
        // Si ya estamos en pantalla completa, salimos
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
    }
}

function goToSubtitleByNumber() {
    if (state.srtEntries.length === 0) return;
    const targetIndex = parseInt(goToSubtitleInput.value, 10);
    if (isNaN(targetIndex) || targetIndex < 1 || targetIndex > state.srtEntries.length) {
        showMessage(`Por favor, introduce un número entre 1 y ${state.srtEntries.length}.`);
        return;
    }
    // El usuario introduce el índice 1, pero en el array es el 0.
    navigateToTranslation(targetIndex - 1);
}

/**
 * Navega al subtítulo más cercano a un timecode específico.
 */
function goToSubtitleByTimecode() {
    if (state.srtEntries.length === 0 || !videoPlayer.src) return;
    try {
        let targetTimeMs;
if (useFrameTimecode) {
    targetTimeMs = parseFrameTime(goToTimecodeInput.value, projectFPS);
} else {
    targetTimeMs = parseTime(goToTimecodeInput.value);
}
        videoPlayer.currentTime = targetTimeMs / 1000;

        // Buscamos el subtítulo cuyo inicio es más cercano (pero no posterior) al tiempo introducido.
        let foundIndex = 0;
        for (let i = 0; i < state.srtEntries.length; i++) {
            if (state.srtEntries[i].startTimeMs <= targetTimeMs) {
                foundIndex = i;
            } else {
                break;
            }
        }
        navigateToTranslation(foundIndex);
    } catch (error) {
        showMessage("El formato del timecode no es válido. Usa HH:MM:SS,ms");
    }
}

// --- START: Subtitle Structural Editing & Undo/Redo Logic ---

        function saveStructuralState(oldState, newState) {
            // AÑADIR ESTA LÍNEA ->
            if (isApplyingState) return;
            historyStack.push({ type: 'structural', oldState, newState });
            redoStack = []; // Un nuevo cambio borra el historial de "rehacer"
            updateUndoRedoButtons();
        }



        /** <- AÑADIR ESTE BLOQUE COMPLETO ->
         * Guarda el estado de un cambio de tiempo en el historial.
         * @param {number} entryIndex - El índice del subtítulo modificado.
         * @param {object} oldValue - {startTimeMs, endTimeMs} ANTES del cambio.
         * @param {object} newValue - {startTimeMs, endTimeMs} DESPUÉS del cambio.
         */
        function saveTimeChange(entryIndex, oldValue, newValue) {
            if (isApplyingState) return;
            // No guardar si los tiempos no han cambiado realmente
            if (oldValue.startTimeMs === newValue.startTimeMs && oldValue.endTimeMs === newValue.endTimeMs) return;

            historyStack.push({ type: 'timeChange', entryIndex, oldValue, newValue });
            redoStack = [];
            updateUndoRedoButtons();
        }
        // <- FIN DEL BLOQUE AÑADIDO ->

        
        /**
         * Deshace la última acción del historial (textual o estructural).
         */
        function undo() {
            if (historyStack.length === 0) return;

            isApplyingState = true;
            const lastAction = historyStack.pop();
            redoStack.push(lastAction); // Guardamos la acción en la pila de "rehacer"

            if (lastAction.type === 'structural') {
                // Si es un cambio estructural, restauramos toda la lista de subtítulos
                state.srtEntries = JSON.parse(JSON.stringify(lastAction.oldState));
                renderTranslations(state.srtEntries, 0, true);
           } else if (lastAction.type === 'timeChange') { // <-- CORREGIDO
            // --- NUEVO: Manejar deshacer cambio de tiempo ---
            const { entryIndex, oldValue } = lastAction; // <-- CORREGIDO
            const entry = state.srtEntries[entryIndex];
            if (entry) {
                entry.startTimeMs = oldValue.startTimeMs;
                entry.endTimeMs = oldValue.endTimeMs;
                updateEntryTimes(entryIndex); // Actualiza UI y región de la onda
            }
        } else {
            // Cambio de texto. Aquí había dos erratas juntas: se leía
            // 'lastUndo', que es la variable de redo() y en esta función no
            // existe (así que deshacer una traducción lanzaba un error), y se
            // aplicaba 'newValue', que es justo lo que hay que quitar.
            const { entryIndex, oldValue } = lastAction;
            const entry = state.srtEntries[entryIndex];
            const editor = document.getElementById(`translation-${entryIndex}`);
                if (entry && editor) {
                    entry.translation = oldValue;
                    editor.innerHTML = oldValue;
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            updateUndoRedoButtons();
            isApplyingState = false;
        }

        /**
         * Rehace la última acción deshecha (textual o estructural).
         */
        function redo() {
            if (redoStack.length === 0) return;
            isApplyingState = true;
            const lastUndo = redoStack.pop();
            historyStack.push(lastUndo); // Devolvemos la acción al historial principal

            if (lastUndo.type === 'structural') {
                // Si es un cambio estructural, aplicamos el nuevo estado
                state.srtEntries = JSON.parse(JSON.stringify(lastUndo.newState));
                renderTranslations(state.srtEntries, 0, true);
            } else {
                // Si es un cambio de texto, aplicamos el nuevo texto
                const { entryIndex, newValue } = lastUndo;
                const entry = state.srtEntries[entryIndex];
                const editor = document.getElementById(`translation-${entryIndex}`);
                if (entry && editor) {
                    entry.translation = newValue;
                    editor.innerHTML = newValue;
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            updateUndoRedoButtons();
            isApplyingState = false;
        }


        /**
         * Vuelve a numerar los índices de los subtítulos después de una modificación (añadir/eliminar).
         * @param {number} startIndex - El índice del array a partir del cual empezar a renumerar.
         */
        function renumberSubtitles(startIndex = 0) {
            for (let i = startIndex; i < state.srtEntries.length; i++) {
                state.srtEntries[i].index = i + 1;
            }
        }

        /**
         * Fusiona un subtítulo con el siguiente.
         * @param {number} entryIndex - El índice del subtítulo actual.
         */
        function mergeWithNext(entryIndex) {
            if (entryIndex >= state.srtEntries.length - 1) return; // No se puede fusionar el último

            const oldState = JSON.parse(JSON.stringify(state.srtEntries)); // Guardar estado PREVIO

            const currentEntry = state.srtEntries[entryIndex];
            const nextEntry = state.srtEntries[entryIndex + 1];

            currentEntry.original += `\n${nextEntry.original}`;
            currentEntry.translation += `<br>${nextEntry.translation}`;
            currentEntry.endTimeMs = nextEntry.endTimeMs;
            currentEntry.durationMs = currentEntry.endTimeMs - currentEntry.startTimeMs;
            currentEntry.timecodes = `${formatTime(currentEntry.startTimeMs)} --> ${formatTime(currentEntry.endTimeMs)}`;

            state.srtEntries.splice(entryIndex + 1, 1);
            renumberSubtitles(entryIndex + 1);
            
            const newState = JSON.parse(JSON.stringify(state.srtEntries)); // Guardar estado POSTERIOR
            saveStructuralState(oldState, newState); // Registrar en el historial

            renderTranslations(state.srtEntries, entryIndex, true);
        }

        /**
         * Dónde está el cursor dentro del campo, contando desde el principio.
         *
         * `range.startOffset` cuenta desde el principio del trozo de texto en el
         * que está el cursor, no del campo: con una cursiva en medio, el campo
         * tiene varios trozos y ese número se queda corto. Se mide el texto que
         * hay desde el principio hasta el cursor y ya está.
         *
         * @param {HTMLElement} campo
         * @param {Range} donde
         * @returns {number}
         */
        function cuantoHayAntesDelCursor(campo, donde) {
            const hasta = donde.cloneRange();
            hasta.selectNodeContents(campo);
            hasta.setEnd(donde.startContainer, donde.startOffset);
            return hasta.toString().length;
        }

        /**
         * Separa un subtítulo en dos por donde esté el cursor.
         *
         * El corte se hace por caracteres de los que se ven, y las etiquetas que
         * queden abiertas se cierran y se vuelven a abrir en el segundo trozo
         * (ver core/partir.js). Cortando por número de caracteres a secas, un
         * `<span>` de una plataforma se partía por la mitad y el archivo salía
         * sin poder abrirse.
         *
         * @param {number} entryIndex - El índice del subtítulo a separar.
         */
        function splitSubtitle(entryIndex) {
            const editor = document.getElementById(`translation-${entryIndex}`);
            const selection = window.getSelection();
            if (!editor) return;

            const currentEntry = state.srtEntries[entryIndex];
            const hayTraduccion = Boolean(editor.innerText.trim());

            // Sin traducción todavía no hay cursor que valga, y partir antes de
            // traducir es de lo más normal al ajustar: se parte el original por
            // su sitio natural, que es su salto de línea si lo tiene.
            let splitRatio = 0.5;
            let firstPartTranslation = '';
            let secondPartTranslation = '';

            if (hayTraduccion) {
                if (!selection.rangeCount) return;

                const range = selection.getRangeAt(0);
                const splitPoint = cuantoHayAntesDelCursor(editor, range);
                const textContent = editor.innerText;

                if (splitPoint === 0 || splitPoint === textContent.length) {
                    showMessage(errorMessages[state.currentLanguage]['split_needs_cursor']);
                    return;
                }

                [firstPartTranslation, secondPartTranslation] = partirEnDos(
                    editor.innerHTML,
                    splitPoint,
                );
                splitRatio = splitPoint / textContent.length;
            }

            const oldState = JSON.parse(JSON.stringify(state.srtEntries)); // Guardar estado PREVIO

            // --- INICIO DE LA MODIFICACIÓN ---

            // 1. Calculamos el hueco de 2 fotogramas
            const frameDurationMs = Math.round(1000 / projectFPS);
            const gapMs = frameDurationMs * 2;

            const [firstPartOriginal, secondPartOriginal] = partirEnDos(
                currentEntry.original,
                cuantoSeVe(currentEntry.original) * splitRatio,
            );

            // 2. Calculamos los nuevos tiempos
            const midPointTimeMs = currentEntry.startTimeMs + Math.round(currentEntry.durationMs * splitRatio);
            
            // El primer subtítulo termina en el punto de corte.
            //
            // Va con let y no con const porque más abajo se corrige cuando el
            // subtítulo es tan corto que el hueco de dos fotogramas no cabe.
            // Estaba declarado const, así que en ese caso —un subtítulo de
            // menos de cinco fotogramas— partirlo lanzaba un error y no partía
            // nada. Nunca dio la cara porque el navegador solo se queja al
            // llegar a esa línea, y a esa línea solo se llega con subtítulos
            // muy cortos.
            let firstPartEndTimeMs = midPointTimeMs;
            
            // El segundo subtítulo empieza DESPUÉS del hueco
            let secondPartStartTimeMs = midPointTimeMs + gapMs;

            // Guardamos el tiempo final original
            const originalEndTimeMs = currentEntry.endTimeMs;

            // 3. Comprobación de seguridad:
            // Si el hueco de 2 fotogramas es tan grande que "come" todo el segundo subtítulo...
            if (secondPartStartTimeMs >= originalEndTimeMs) {
                // ...lo forzamos a tener una duración mínima (ej. 1 fotograma)
                secondPartStartTimeMs = originalEndTimeMs - frameDurationMs;
                // Y nos aseguramos de que el primero no se solape
                if (firstPartEndTimeMs >= secondPartStartTimeMs) {
                    firstPartEndTimeMs = secondPartStartTimeMs - 1; // Dejamos 1ms de separación
                }
            }

            // 4. Creamos y actualizamos los subtítulos con los tiempos corregidos

            const newEntry = { 
                ...currentEntry, 
                index: currentEntry.index + 1, 
                original: secondPartOriginal, 
                translation: secondPartTranslation, 
                startTimeMs: secondPartStartTimeMs,         // <--- MODIFICADO
                endTimeMs: originalEndTimeMs,               // <--- MODIFICADO (usa el final original)
                durationMs: originalEndTimeMs - secondPartStartTimeMs, // <--- MODIFICADO
                timecodes: `${formatTime(secondPartStartTimeMs)} --> ${formatTime(originalEndTimeMs)}` // <--- MODIFICADO
            };
            
            delete newEntry.regionId; // (Esto es de tu corrección anterior, y está perfecto)

            currentEntry.original = firstPartOriginal;
            currentEntry.translation = firstPartTranslation;
            currentEntry.endTimeMs = firstPartEndTimeMs;        // <--- MODIFICADO
            currentEntry.durationMs = currentEntry.endTimeMs - currentEntry.startTimeMs;
            currentEntry.timecodes = `${formatTime(currentEntry.startTimeMs)} --> ${formatTime(firstPartEndTimeMs)}`; // <--- MODIFICADO
            
            // --- FIN DE LA MODIFICACIÓN ---

            state.srtEntries.splice(entryIndex + 1, 0, newEntry);
            renumberSubtitles(entryIndex + 1);
            
            const newState = JSON.parse(JSON.stringify(state.srtEntries)); // Guardar estado POSTERIOR
            saveStructuralState(oldState, newState); // Registrar en el historial

            renderTranslations(state.srtEntries, entryIndex + 1, true);
        }

        /**
         * Muestra un diálogo de confirmación antes de eliminar un subtítulo.
         * @param {number} entryIndex - El índice del subtítulo a eliminar.
         */
        function confirmDeleteSubtitle(entryIndex) {
            // Usamos la clave del objeto de traducciones para el mensaje
            pedirConfirmacion(translations[state.currentLanguage]['delete_subtitle_confirm'], {
                peligro: true,
            }).then((sigue) => {
                if (sigue) deleteSubtitle(entryIndex);
            });
        }
        
        /**
         * Elimina un subtítulo del proyecto.
         * @param {number} entryIndex - El índice del subtítulo a eliminar.
         */
        function deleteSubtitle(entryIndex) {
            const oldState = JSON.parse(JSON.stringify(state.srtEntries)); // Guardar estado PREVIO
            
            state.srtEntries.splice(entryIndex, 1);
            renumberSubtitles(entryIndex);
            
            const newState = JSON.parse(JSON.stringify(state.srtEntries)); // Guardar estado POSTERIOR
            saveStructuralState(oldState, newState); // Registrar en el historial
            
            const newIndexToFocus = Math.min(entryIndex, state.srtEntries.length - 1);
            renderTranslations(state.srtEntries, newIndexToFocus, true);
        }
        
        // --- END: Subtitle Structural Editing & Undo/Redo Logic ---
        // --- Backup and Restore Functions ---
        /**
         * Lo que se guarda del proyecto abierto.
         *
         * La memoria y el glosario ya no van aquí dentro: tienen sus propias
         * tablas, una fila por unidad y por término, atadas al proyecto. Antes
         * el bloque entero se reescribía en cada guardado, y con una memoria de
         * miles de unidades eso se notaba.
         */
        function getProjectState() {
            if (state.srtEntries.length === 0) return null;
            return {
                fileName: currentFileName,
                formatoDelSrt,
                formatoId: formatoDelArchivo.id,
                documentoDelArchivo,
                srtEntries: state.srtEntries,
                sourceLang: state.sourceLang,
                targetLang: state.targetLang,
                qaSettings,
                sessionPlan,
                lastModified: new Date(),
            };
        }

        /** Cuántas copias se guardan. Más allá de esto, las viejas estorban. */
        const MAXIMO_COPIAS = 10;

        /** Las copias guardadas, de la más reciente a la más antigua. */
        async function listarCopias() {
            const copias = await db.projects.toArray();
            return copias.sort(
                (a, b) => new Date(b.lastModified) - new Date(a.lastModified),
            );
        }

        /** Deja solo las MAXIMO_COPIAS más recientes. */
        async function podarCopias() {
            const sobran = (await listarCopias()).slice(MAXIMO_COPIAS);
            if (sobran.length > 0) await db.projects.bulkDelete(sobran.map((c) => c.id));
        }

        /** La copia elegida en el desplegable; si no hay elección, la más reciente. */
        async function copiaElegida() {
            const copias = await listarCopias();
            if (copias.length === 0) return null;
            const elegida = Number(backupSelect.value);
            return copias.find((c) => c.id === elegida) || copias[0];
        }

        async function saveBackup() {
            const projectState = getProjectState();
            if (!projectState) {
                backupIndicator?.classList.remove('hay-copia');
                return;
            }
            try {
                // Una copia por archivo. Antes todas se guardaban en la misma
                // fila (id: 1), así que abrir un segundo archivo borraba la
                // copia del primero sin avisar: lo contrario de lo que promete
                // un botón que se llama "copia de seguridad".
                const anterior = await db.projects
                    .where('fileName')
                    .equals(projectState.fileName)
                    .first();
                if (anterior) {
                    state.projectId = anterior.id;
                    await db.projects.put({ ...anterior, ...projectState });
                } else {
                    state.projectId = await db.projects.add(projectState);
                }
                // La memoria y el glosario, a sus tablas, atados a este
                // proyecto: cada encargo tiene los suyos.
                await guardarRecursos();
                await podarCopias();
                backupIndicator?.classList.add('hay-copia');
            } catch (error) {
                console.error('Error saving backup to IndexedDB:', error);
            }
        }
        
        async function restoreProject(backupData) {
            currentFileName = backupData.fileName;
            formatoDelSrt = backupData.formatoDelSrt || { saltoDeLinea: '\n', terminaConSalto: true };
            formatoDelArchivo = formatoPorId(backupData.formatoId);
            documentoDelArchivo = backupData.documentoDelArchivo || null;
            state.projectId = backupData.id ?? null;
            state.srtEntries = backupData.srtEntries;
            // Una copia antigua traía la memoria y el glosario dentro, y el par
            // de idiomas repetido en los dos. Las nuevas los tienen en sus
            // tablas y el par una sola vez, en el proyecto.
            state.sourceLang = backupData.sourceLang || backupData.glossary?.sourceLang || '';
            state.targetLang = backupData.targetLang || backupData.glossary?.targetLang || '';
            qaSettings = { ...qaDeFabrica(), ...(backupData.qaSettings || {}) };
            avisarDeLosLimites();

            if (backupData.glossary?.data || backupData.translationMemory?.data) {
                state.glossary = backupData.glossary?.data || [];
                state.translationMemory = backupData.translationMemory?.data || [];
                marcarRecursosCambiados();
            } else if (state.projectId) {
                await ponerRecursosDelProyecto(state.projectId);
            }

            document.body.classList.add('con-proyecto');
            pintarBotonesDePestanas();
            renderTranslations(state.srtEntries);
            showGlossaryEditorSection();
            showTMEditorSection();

            showMessage(errorMessages[state.currentLanguage]['project_restored_message']);
        }

        /**
         * Lo que la ventana de proyectos recientes necesita del editor.
         *
         * Se le pasan tres funciones y no el editor entero: esa ventana no tiene
         * por qué saber cómo está montado esto, y así se lee de un tirón.
         */
        function puenteDeRecientes() {
            return {
                /** El cuadro de sí o no de la herramienta, que vive aquí. */
                confirmar: (mensaje, opciones) => pedirConfirmacion(mensaje, opciones),

                /** Los guardados, del más reciente al más antiguo, con su avance. */
                async listar() {
                    // Se guarda lo de ahora antes de mirar la lista: si no, el
                    // avance que se enseña del proyecto abierto es el de hace
                    // diez segundos, y el archivo recién abierto no sale.
                    if (state.srtEntries.length > 0) await saveBackup();

                    const guardados = await listarCopias();
                    return guardados.map((proyecto) => {
                        const entradas = proyecto.srtEntries || [];
                        return {
                            id: proyecto.id,
                            fileName: proyecto.fileName || '—',
                            sourceLang: proyecto.sourceLang || '',
                            targetLang: proyecto.targetLang || '',
                            lastModified: proyecto.lastModified,
                            progreso: {
                                total: entradas.length,
                                traducidos: entradas.filter((e) =>
                                    String(e.translation || '').trim(),
                                ).length,
                            },
                        };
                    });
                },

                /** Abre uno, guardando antes lo que hubiera a medias. */
                async abrir(projectId) {
                    // Lo de ahora se guarda antes de irse: cambiar de proyecto
                    // no puede costar los últimos minutos de trabajo.
                    if (state.srtEntries.length > 0) await saveBackup();

                    const proyecto = await db.projects.get(projectId);
                    if (!proyecto) return;
                    await restoreProject(proyecto);
                },

                /** Lo quita del navegador. El .srt del ordenador no se toca. */
                async borrar(projectId) {
                    await db.projects.delete(projectId);
                    if (state.projectId === projectId) state.projectId = null;
                },
            };
        }

        // --- QA Functions ---
        function runFullQaCheck() {
            state.srtEntries.forEach((entry, index) => {
                const editorDiv = document.getElementById(`translation-${index}`);
                if (editorDiv) {
                    updateSubtitleStats(editorDiv, entry.charCountOriginal, entry.durationMs);
                }
            });
            updateStatsDisplay();
        }

        /**
         * Todo lo que hay que mirar en el encargo.
         *
         * La lista de comprobaciones vive en core/qa.js, no aquí: añadir una es
         * añadir una entrada a esa tabla, y los filtros y los ajustes de esta
         * pestaña se pintan solos recorriéndola.
         *
         * @returns {Array<Object>}
         */
        function calculateAllQaErrors() {
            const ajustes = comoLosQuiereElMotor();
            return soloLasEncendidas(revisar(state.srtEntries, ajustes), ajustes.encendidas);
        }

        /**
         * Todo lo que se ha mirado, encendido o no.
         *
         * Es lo que necesita el contador de cada filtro: un número al lado de
         * un filtro apagado tiene que decir cuántos verías si lo encendieras.
         *
         * @returns {Array<Object>}
         */
        function todoLoRevisado() {
            return revisar(state.srtEntries, comoLosQuiereElMotor());
        }

        /**
         * Lo que salta, dicho con palabras y en el idioma que toque.
         *
         * El motor no escribe mensajes: dice qué regla ha saltado y con qué
         * números. Escribirlos ahí dentro obligaría a elegir un idioma dentro
         * del motor, y entonces media herramienta estaría traducida y la otra
         * media no.
         *
         * @param {Object} uno Lo que devuelve `revisar` para un subtítulo.
         * @returns {string}
         */
        function loQueDice(uno) {
            const t = translations[state.currentLanguage];
            const plantilla = t[`qa_dice_${uno.regla}`] || uno.regla;

            return Object.entries(uno.datos || {}).reduce((texto, [clave, valor]) => {
                const escrito = Array.isArray(valor) ? valor.join(', ') : valor;
                return texto.replace(`{${clave}}`, escrito);
            }, plantilla);
        }

        /** Cómo se llama una regla de cara a quien traduce. */
        function comoSeLlamaLaRegla(id) {
            return translations[state.currentLanguage][`qa_regla_${id}`] || id;
        }

        /**
         * Qué formato le falta o le sobra a la traducción, dicho con palabras.
         *
         * "Tags" en la lista de errores no le dice a nadie qué tiene que
         * arreglar; "falta la cursiva" sí.
         *
         * @param {{faltan: string[], sobran: string[]}} [etiquetas]
         * @returns {string} HTML, o cadena vacía si no hay nada que decir.
         */
        function detalleDeEtiquetas(etiquetas) {
            if (!etiquetas) return '';
            const t = translations[state.currentLanguage];
            const nombre = (estilo) => t[`estilo_${estilo}`] || estilo;

            const lineas = [];
            if (etiquetas.faltan.length) {
                lineas.push(t.qa_tags_missing.replace('{0}', etiquetas.faltan.map(nombre).join(', ')));
            }
            if (etiquetas.sobran.length) {
                lineas.push(t.qa_tags_extra.replace('{0}', etiquetas.sobran.map(nombre).join(', ')));
            }

            return lineas.length
                ? `<div class="qa-error-etiquetas">${lineas.join('<br>')}</div>`
                : '';
        }

        /**
         * La lista de errores, agrupada por subtítulo.
         *
         * Un subtítulo puede saltar por cuatro reglas a la vez, y cuatro filas
         * seguidas con el mismo número obligan a leerlas todas para ver que
         * hablan del mismo sitio. Una fila por subtítulo con sus motivos
         * debajo se repasa de un vistazo.
         *
         * @param {Array<string>} [soloEstas] Los filtros encendidos.
         */
        function renderQaErrorList() {
            const t = translations[state.currentLanguage];
            qaErrorListContainer.innerHTML = '';

            // En un archivo largo son cientos de filas: aparecer sin que nadie
            // las haya pedido es ruido, y además tarda.
            // El panda explica los límites: es lo que hay que entender antes
            // de revisar nada. Una vez pulsado "Revisar" se quita, y con él la
            // raya del reparto: lo que se mira a partir de ahí es la lista, y
            // el bocadillo se estaría comiendo un tercio del alto para repetir
            // algo ya leído.
            document.getElementById('qaPandaAviso')?.classList.toggle('hidden', yaSeHaRevisado);
            document.getElementById('qaContainer')?.classList.toggle('qa-sin-errores', !yaSeHaRevisado);

            if (!yaSeHaRevisado) {
                qaErrorListContainer.textContent = t.qa_revisar_pista;
                return;
            }

            const loQueSeVe = calculateAllQaErrors();
            if (loQueSeVe.length === 0) {
                qaErrorListContainer.textContent = t.qa_no_errors;
                return;
            }

            const porSubtitulo = new Map();
            for (const uno of loQueSeVe) {
                if (!porSubtitulo.has(uno.indice)) porSubtitulo.set(uno.indice, []);
                porSubtitulo.get(uno.indice).push(uno);
            }

            for (const [indice, suyos] of porSubtitulo) {
                const entrada = state.srtEntries[indice];
                const item = document.createElement('div');
                item.className = 'qa-error-item';
                item.dataset.entryIndex = indice;

                const hayError = suyos.some((uno) => uno.gravedad === 'error');
                const motivos = suyos
                    .map((uno) => {
                        const clase = uno.gravedad === 'error' ? 'qa-motivo-error' : 'qa-motivo-aviso';
                        // El formato tiene su propio detalle —"falta la
                        // cursiva"— y ese sustituye al mensaje de la regla, no
                        // se le suma: "el formato no coincide" y debajo "falta
                        // la cursiva" son la misma frase dicha dos veces, y una
                        // lista que se repite deja de leerse.
                        const detalle =
                            uno.regla === 'etiquetas' ? detalleDeEtiquetas(uno.datos.etiquetas) : '';
                        const dice = detalle || escaparHtml(loQueDice(uno));
                        return `<div class="qa-motivo ${clase}">${dice}</div>`;
                    })
                    .join('');

                const texto = textoVisible(String(entrada?.translation || entrada?.original || ''))
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 60);

                item.innerHTML = `
                    <div class="qa-error-cabeza">
                        <span class="qa-error-numero">#${entrada?.index ?? indice + 1}</span>
                        <span class="${hayError ? 'qa-error' : 'qa-aviso'}">${suyos.length}</span>
                    </div>
                    <div class="qa-error-texto">${escaparHtml(texto)}</div>
                    ${motivos}
                `;
                qaErrorListContainer.appendChild(item);
            }
        }

        /**
         * El panel de la pestaña de QA: qué se revisa, y cuánto hay de cada cosa.
         *
         * Una sola lista, no dos. En otras herramientas están separadas —unos
         * ajustes para elegir qué reglas se aplican y unos filtros para elegir
         * qué se enseña— y entonces hay dos sitios que dicen cosas parecidas y
         * uno se pregunta por qué apagar el filtro no quita el error. Aquí la
         * casilla significa una cosa sola: esto se revisa o no se revisa.
         *
         * El número de al lado es cuántos han salido. Un límite solo se enseña
         * si su regla está encendida: un "duración mínima (ms)" con la regla
         * apagada es un número que no hace nada.
         */
        function pintarElPanelDeQa() {
            const donde = document.getElementById('qaResumen');
            if (!donde) return;

            const t = translations[state.currentLanguage];
            const ajustes = comoLosQuiereElMotor();
            const encendidas = ajustes.encendidas;
            const cuantos = cuantosDeCada(todoLoRevisado());

            const filas = REGLAS.map((regla) => {
                const cuenta = cuantos[regla.id] || 0;
                return `
                    <div class="qa-regla${encendidas[regla.id] ? '' : ' qa-regla-apagada'}">
                        <input type="checkbox" id="qaRegla-${regla.id}" data-qa-regla="${regla.id}" ${encendidas[regla.id] ? 'checked' : ''}>
                        <label class="qa-regla-nombre" for="qaRegla-${regla.id}">
                            ${escaparHtml(comoSeLlamaLaRegla(regla.id))}
                        </label>
                        ${elLimiteDe(regla, ajustes.limites, encendidas[regla.id])}
                        <span class="qa-regla-cuenta${cuenta ? (regla.gravedad === 'error' ? ' qa-error' : ' qa-aviso') : ''}">${cuenta}</span>
                        <p class="qa-regla-desc">${escaparHtml(t[`qa_desc_${regla.id}`] || '')}</p>
                    </div>`;
            }).join('');

            donde.innerHTML = `
                <div class="qa-filtros-cabeza">
                    <h4 class="qa-apartado">${escaparHtml(t.qa_filtros_titulo)}</h4>
                    <div class="qa-filtros-botones">
                        <button type="button" class="ia-enlace-accion" data-qa-todas="si">${escaparHtml(t.qa_filtros_todos)}</button>
                        <button type="button" class="ia-enlace-accion" data-qa-todas="no">${escaparHtml(t.qa_filtros_ninguno)}</button>
                    </div>
                </div>
                ${filas}`;
        }

        /**
         * El campo del límite de una regla, si tiene.
         *
         * Los que son tiempo se escriben en fotogramas y enseñan al lado a
         * cuántos milisegundos equivalen. Un subtitulador piensa en fotogramas
         * —"que no baje de veinte"— y los archivos se escriben en milisegundos;
         * teniendo los dos delante no hay que hacer la cuenta de cabeza ni
         * acordarse de a cuántos fotogramas va este encargo.
         *
         * @param {Object} regla
         * @param {Object} limites
         * @param {boolean} encendida
         * @returns {string} HTML.
         */
        function elLimiteDe(regla, limites, encendida) {
            if (!regla.limite) return '';

            const t = translations[state.currentLanguage];
            // El CPS y los caracteres por línea conservan su id de siempre: no
            // son solo del QA, y hay cosas que los buscan por ahí.
            const suId = { cps: 'qaCpsLimit', porLinea: 'qaCharsPerLineLimit' }[regla.limite];
            const enMs = regla.limite.endsWith('Ms');
            const valor = limites[regla.limite];
            const enPantalla = enMs ? Math.round((valor * projectFPS) / 1000) : valor;

            return `
                <span class="qa-regla-limite">
                    <input type="number" class="paneles-campo qa-numero" min="1"
                           ${suId ? `id="${suId}"` : ''}
                           data-qa-limite="${regla.limite}"
                           ${enMs ? 'data-qa-fotogramas="si"' : ''}
                           value="${enPantalla}"
                           title="${escaparHtml(t[`qa_limite_${regla.limite}`] || '')}"
                           ${encendida ? '' : 'hidden'}>
                    ${enMs && encendida ? `<span class="qa-regla-equivale">${t.qa_en_fotogramas} · ${valor} ms</span>` : ''}
                </span>`;
        }

        /**
         * Engancha el panel de QA. Se llama una vez.
         *
         * Los eventos van en el contenedor y no en cada casilla: el panel se
         * repinta entero cada vez que cambia algo, y enganchar de nuevo
         * diecinueve casillas en cada repintado deja escuchas viejos por detrás.
         */
        function engancharElPanelDeQa() {
            const donde = document.getElementById('qaResumen');
            if (!donde) return;

            donde.addEventListener('change', (evento) => {
                const casilla = evento.target.closest('[data-qa-regla]');
                if (casilla) {
                    qaSettings.encendidas = {
                        ...comoLosQuiereElMotor().encendidas,
                        [casilla.dataset.qaRegla]: casilla.checked,
                    };
                    trasCambiarElQa();
                    return;
                }

            });

            // Los límites, al escribirlos. Aquí no se repinta el panel entero:
            // hacerlo mientras se teclea saca el cursor del campo y hay que
            // volver a pulsar en él para escribir la segunda cifra. Se cambian
            // solo los números de la derecha, que es lo único que se mueve.
            donde.addEventListener('input', (evento) => {
                const campo = evento.target.closest('[data-qa-limite]');
                if (!campo) return;
                const escrito = parseInt(campo.value, 10);
                if (!escrito || escrito < 1) return;
                const cual = campo.dataset.qaLimite;

                // Los de tiempo se escriben en fotogramas y se guardan en
                // milisegundos, que es lo que entiende el motor y lo que dura
                // un subtítulo de verdad.
                const valor = campo.dataset.qaFotogramas
                    ? Math.round((escrito * 1000) / projectFPS)
                    : escrito;

                // El CPS y los caracteres por línea siguen viviendo donde
                // siempre: son también los que encienden en rojo las cifras de
                // cada tarjeta, y tenerlos en dos sitios es tenerlos distintos.
                if (cual === 'cps') qaSettings.cpsLimit = valor;
                else if (cual === 'porLinea') qaSettings.charsPerLineLimit = valor;
                else qaSettings.limites = { ...comoLosQuiereElMotor().limites, [cual]: valor };

                avisarDeLosLimites();
                runFullQaCheck();
                refrescarLosContadores();
                // La equivalencia de al lado, al día mientras se escribe.
                const equivale = campo.closest('.qa-regla-limite')?.querySelector('.qa-regla-equivale');
                if (equivale) {
                    equivale.textContent = `${translations[state.currentLanguage].qa_en_fotogramas} · ${valor} ms`;
                }
                if (yaSeHaRevisado) renderQaErrorList();
            });

            donde.addEventListener('click', (evento) => {
                const boton = evento.target.closest('[data-qa-todas]');
                if (!boton) return;
                const si = boton.dataset.qaTodas === 'si';
                qaSettings.encendidas = Object.fromEntries(REGLAS.map((r) => [r.id, si]));
                trasCambiarElQa();
            });
        }

        /** Lo que hay que repintar cuando cambia cualquier cosa del QA. */
        function trasCambiarElQa() {
            // avisarDeLosLimites() ya repinta el panel; repintarlo otra vez aquí
            // solo haría el trabajo dos veces.
            avisarDeLosLimites();
            runFullQaCheck();
            if (yaSeHaRevisado) renderQaErrorList();
        }

        /**
         * Qué subtítulos llevan aviso, para no repintar los que no cambian.
         *
         * @type {Set<number>}
         */
        let losQueTienenAviso = new Set();

        /**
         * Pone o quita el aviso de cada subtítulo con algo que mirar.
         *
         * Sin esto hay que ir a la pestaña de QA para saber cuáles están mal, y
         * al volver a la lista ya no te acuerdas de cuál era. El aviso dice por
         * qué al pasar el ratón, así que para los casos sueltos no hace falta
         * ni abrir la pestaña.
         *
         * Solo se tocan los que han cambiado de estado: en un archivo de dos
         * mil subtítulos, reescribir dos mil avisos en cada tecla se nota al
         * escribir.
         */
        function pintarLosAvisos() {
            const t = translations[state.currentLanguage];
            const porSubtitulo = new Map();
            for (const uno of calculateAllQaErrors()) {
                if (!porSubtitulo.has(uno.indice)) porSubtitulo.set(uno.indice, []);
                porSubtitulo.get(uno.indice).push(uno);
            }

            const ahora = new Set(porSubtitulo.keys());

            for (const indice of losQueTienenAviso) {
                if (ahora.has(indice)) continue;
                const aviso = document.getElementById(`avisoQa-${indice}`);
                if (!aviso) continue;
                aviso.classList.add('hidden');
                // Y se le quita lo que decía: un aviso escondido con el texto
                // de antes vuelve a salir diciendo algo que ya se arregló.
                aviso.title = '';
                aviso.classList.remove('segmento-aviso-error');
            }

            for (const [indice, suyos] of porSubtitulo) {
                const aviso = document.getElementById(`avisoQa-${indice}`);
                if (!aviso) continue;
                aviso.classList.remove('hidden');
                aviso.classList.toggle(
                    'segmento-aviso-error',
                    suyos.some((uno) => uno.gravedad === 'error'),
                );
                // Uno por línea, que es como se lee una lista de cosas que
                // arreglar. El title del navegador respeta los saltos.
                aviso.title = suyos
                    .map((uno) =>
                        uno.regla === 'etiquetas'
                            ? `${comoSeLlamaLaRegla(uno.regla)}: ${(uno.datos.etiquetas.faltan || [])
                                  .concat(uno.datos.etiquetas.sobran || [])
                                  .map((e) => t[`estilo_${e}`] || e)
                                  .join(', ')}`
                            : loQueDice(uno),
                    )
                    .join('\n');
            }

            losQueTienenAviso = ahora;
        }

        /**
         * Cambia solo los números de la derecha de cada comprobación.
         *
         * Lo de al lado —las casillas, los campos de los límites— se queda
         * exactamente donde estaba, con su cursor dentro si lo tenía.
         */
        function refrescarLosContadores() {
            const cuantos = cuantosDeCada(todoLoRevisado());
            for (const regla of REGLAS) {
                const donde = document.querySelector(
                    `#qaResumen [data-qa-regla="${regla.id}"]`,
                )?.closest('.qa-regla')?.querySelector('.qa-regla-cuenta');
                if (!donde) continue;
                const cuenta = cuantos[regla.id] || 0;
                donde.textContent = cuenta;
                donde.className = `qa-regla-cuenta${cuenta ? (regla.gravedad === 'error' ? ' qa-error' : ' qa-aviso') : ''}`;
            }
        }



        // --- Project Save/Load Functions ---
async function saveProject(filename) {
            if (state.srtEntries.length === 0) {
                showMessage(errorMessages[state.currentLanguage]['no_project_to_save']);
                return;
            }
            showLoadingOverlay(translations[state.currentLanguage]['saving_file']);

            const projectData = {
                // Sube a 2.0 porque el par de idiomas ya no está por duplicado:
                // era el mismo dato en dos sitios (glosario y memoria) y se
                // podían contradecir. Los .subpanda de la versión 1 se siguen
                // abriendo: restoreProjectState entiende las dos formas.
                version: '2.0',
                formatoDelSrt,
                formatoId: formatoDelArchivo.id,
                documentoDelArchivo,
                srtEntries: state.srtEntries,
                glossary: state.glossary,
                translationMemory: state.translationMemory,
                sourceLang: state.sourceLang,
                targetLang: state.targetLang,
                qaSettings,
                videoFileName,
                sessionPlan,
                currentLanguage: state.currentLanguage,
            };

            try {
                const zip = new JSZip();
                zip.file("project.json", JSON.stringify(projectData, null, 2));

                const content = await zip.generateAsync({ type: "blob" });
                
                const a = document.createElement("a");
                const url = URL.createObjectURL(content);
                a.href = url;
                a.download = filename.endsWith('.subpanda') ? filename : filename + '.subpanda'; // <-- LÍNEA MODIFICADA
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                a.remove();
                
                showMessage('Proyecto guardado con éxito.');
                
                // --- LÓGICA AÑADIDA ---
                if (typeof afterSaveAction === 'function') {
                    afterSaveAction();
                    afterSaveAction = null; // Resetea la acción
                }
                // --- FIN DE LÓGICA AÑADIDA ---

            } catch (error) {
                console.error("Error saving project:", error);
                showMessage('Error al guardar el proyecto.');
                afterSaveAction = null; // Resetea también en caso de error
            } finally {
                hideLoadingOverlay();
            }
        }
        async function loadProject(event) {
            const file = event.target.files[0];
            if (!file) return;

            showLoadingOverlay(translations[state.currentLanguage]['loading_file']);
            try {
                const zip = await JSZip.loadAsync(file);
                const projectJsonFile = zip.file("project.json");

                if (!projectJsonFile) {
                    throw new Error("Archivo de proyecto inválido: no se encontró project.json.");
                }

                const projectData = JSON.parse(await projectJsonFile.async("string"));
                
currentFileName = file.name;

 historyStack = [];
                    redoStack = [];
                    updateUndoRedoButtons();

                restoreProjectState(projectData);

                showMessage(errorMessages[state.currentLanguage]['project_loaded_success']);
                
                if (projectData.videoFileName) {
                    reselectVideoInfo.textContent = translations[state.currentLanguage]['reselect_video_prompt'].replace('{0}', projectData.videoFileName);
                    reselectVideoModal.classList.remove('hidden');
                }

            } catch (error) {
                console.error("Error loading project:", error);
                showMessage(`${errorMessages[state.currentLanguage]['error_loading_project']}: ${error.message}`);
            } finally {
                hideLoadingOverlay();
                event.target.value = ''; // Reset file input
            }
        }

        function restoreProjectState(data) {
            formatoDelSrt = data.formatoDelSrt || { saltoDeLinea: '\n', terminaConSalto: true };
            formatoDelArchivo = formatoPorId(data.formatoId);
            documentoDelArchivo = data.documentoDelArchivo || null;
            state.srtEntries = data.srtEntries || [];
            state.glossary = data.glossary || [];
            state.translationMemory = data.translationMemory || [];
            // Un .subpanda de la versión 1 traía el par por duplicado, uno del
            // glosario y otro de la memoria. Se toma el del proyecto si viene, y
            // si no el del glosario, que es el que solía estar puesto.
            state.sourceLang = data.sourceLang || data.glossarySourceLanguage || data.tmSourceLanguage || '';
            state.targetLang = data.targetLang || data.glossaryTargetLanguage || data.tmTargetLanguage || '';
            // Con los de fábrica debajo: un proyecto guardado antes de que
            // existiera una regla no la trae, y sin esto se quedaría apagada
            // para siempre sin que nadie supiera por qué.
            qaSettings = { ...qaDeFabrica(), ...(data.qaSettings || {}) };
            avisarDeLosLimites();
            videoFileName = data.videoFileName || null;
sessionPlan = data.sessionPlan || [];

            setLanguage(data.currentLanguage || 'es');
            
            renderTranslations(state.srtEntries);

renderPlanner();
            
            // El par de idiomas es del proyecto, así que ni el glosario ni la
            // memoria vuelven a preguntarlo: los dos paneles se enseñan sin más.
            showGlossaryEditorSection();
            showTMEditorSection();
        }

        function resetApplicationState() {
            // Sin archivo abierto no hay columna de consulta: no hay nada que
            // consultar, y solo le quitaría sitio a la bienvenida.
            document.body.classList.remove('con-proyecto');
            pintarBotonesDePestanas();
            state.projectId = null;
            vaciarRecursos();
            state.srtEntries = [];
            currentFileName = 'subtitles.srt';
            videoFileName = null;
            
historyStack = [];
            redoStack = [];
            updateUndoRedoButtons();

            resetGlossary();
            resetTM();
            
            videoPlayer.pause();
            // Poner src a '' no vacía el reproductor: deja el atributo puesto y
            // el navegador entiende que tiene que cargar la propia página como
            // si fuera un vídeo. De ahí el 404 y el error de WaveSurfer nada
            // más arrancar. Lo que vacía de verdad es quitar el atributo.
            videoPlayer.removeAttribute('src');
            videoPlayer.load();
if (wavesurfer) {
                wavesurfer.empty();
clearSubtitleRegions();
                document.getElementById('ondaBloque').classList.add('hidden');
            }
sessionPlan = []; // <-- AÑADIR ESTA LÍNEA
// El planificador se queda donde está —es una pestaña—, pero sus resultados
// hablaban del archivo anterior.
const resultadosDelPlan = document.getElementById('sessionResults');
if (resultadosDelPlan) resultadosDelPlan.innerHTML = '';
            document.getElementById('videoLogoPlaceholder').classList.remove('hidden');
            const loadVideoBtnSpan = document.querySelector('#loadVideoBtn span');
            if (loadVideoBtnSpan) {
                loadVideoBtnSpan.textContent = translations[state.currentLanguage]['load_video'];
            }
            
            renderTranslations([]);
            updateStatsDisplay();
            
            confirmNewProjectModal.classList.add('hidden');
        }

/**
 * Borra todos los datos de la aplicación (LocalStorage e IndexedDB)
 * y recarga la página para empezar desde cero.
 */
async function resetApplicationCache() {
    const t = translations[state.currentLanguage];
    const confirmation = await pedirConfirmacion(t['reset_app_confirm'], { peligro: true });

    if (confirmation) {
        try {
            // Borra todo el LocalStorage (ajustes de IA, atajos, etc.)
            localStorage.clear();

            // Borra la base de datos IndexedDB (proyectos y backups)
            db.delete().then(() => {
                showMessage(t['reset_app_success']);
                // Espera un segundo para que el usuario vea el mensaje y recarga la página.
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }).catch(err => {
                console.error("Error al borrar la base de datos:", err);
                showMessage(t['reset_db_error']);
            });

        } catch (error) {
            console.error("Error al resetear el almacenamiento:", error);
            showMessage(t['reset_storage_error']);
        }
    }
}

// --- START: PLANNER LOGIC ---

let sessionPlan = [];
let activeSessionIndex = -1;
let timerInterval = null;
let sessionStartTime = 0;

function calculateSessions() {
    const t = translations[state.currentLanguage]; // Obtenemos el diccionario del idioma actual

    if (state.srtEntries.length === 0) {
        showMessage(t['planner_load_srt_warning']); // Usamos la traducción
        return;
    }

    const numSessions = parseInt(document.getElementById('sessionCount').value, 10);
    const method = document.getElementById('divisionMethod').value;

    sessionPlan = [];
    activeSessionIndex = -1;
    clearInterval(timerInterval);

    const totalSubs = state.srtEntries.length;
    const totalDuration = state.srtEntries[totalSubs - 1].endTimeMs;
    const totalWords = state.srtEntries.reduce((sum, entry) => sum + entry.wordCountOriginal, 0);

    let lastIndex = 0;

    for (let i = 1; i <= numSessions; i++) {
        let session = {
            id: i,
            startSub: 0,
            endSub: 0,
            text: '',
            isCompleted: false,
            elapsedTime: 0
        };

        session.startSub = lastIndex + 1;

        if (method === 'subtitles') {
            const subsPerSession = Math.ceil(totalSubs / numSessions);
            session.endSub = Math.min(i * subsPerSession, totalSubs);
            session.text = t['planner_session_subs'].replace('{0}', session.startSub).replace('{1}', session.endSub);
        } 
        else if (method === 'time') {
            const timePerSession = totalDuration / numSessions;
            const sessionEndTime = i * timePerSession;
            const endEntry = state.srtEntries.find(entry => entry.startTimeMs >= sessionEndTime) || state.srtEntries[totalSubs - 1];
            session.endSub = endEntry.index;
            if (i === numSessions) session.endSub = totalSubs;

            const startTimeMs = Math.round((i - 1) * timePerSession);
            const endTimeMs = Math.round(sessionEndTime);
            const startTimeStr = formatTime(startTimeMs);
            const endTimeStr = formatTime(endTimeMs);
            session.text = t['planner_session_time'].replace('{0}', startTimeStr).replace('{1}', endTimeStr).replace('{2}', session.endSub);
        }
        else if (method === 'words') {
            const wordsPerSession = totalWords / numSessions;
            let currentWords = 0;
            let endSubIndex = lastIndex;
            for (let j = lastIndex; j < totalSubs; j++) {
                currentWords += state.srtEntries[j].wordCountOriginal;
                if ((j > lastIndex && currentWords > (wordsPerSession * 0.8)) || j === totalSubs - 1) {
                     endSubIndex = j;
                     if (i === numSessions) {
                         endSubIndex = totalSubs -1;
                     }
                     break;
                }
            }
             session.endSub = endSubIndex + 1;
             if (i === numSessions) session.endSub = totalSubs;
             const approxWords = Math.round(wordsPerSession);
             session.text = t['planner_session_words'].replace('{0}', session.startSub).replace('{1}', session.endSub).replace('{2}', approxWords);
        }

        lastIndex = session.endSub;
        sessionPlan.push(session);
    }

// --- INICIO DEL BLOQUE A AÑADIR ---
// Añadimos el ítem fijo de Revisión / QA al final del plan
sessionPlan.push({
    id: numSessions + 1,
    startSub: null, // No tiene subtítulo de inicio
    endSub: null,
    text: t['planner_session_qa'],
    isCompleted: false,
    elapsedTime: 0
});
// --- FIN DEL BLOQUE A AÑADIR ---

    renderPlanner();
}

function renderPlanner() {
    const resultsContainer = document.getElementById('sessionResults');
    resultsContainer.innerHTML = '';

    sessionPlan.forEach((session, index) => {
        const row = document.createElement('div');
        row.className = 'session-row';
        if (session.isCompleted) row.classList.add('completed');
        if (index === activeSessionIndex) row.classList.add('active');

        row.innerHTML = `
            <input type="checkbox" class="session-checkbox form-checkbox h-5 w-5 text-blue-600" data-index="${index}" ${session.isCompleted ? 'checked' : ''}>
            <div class="session-text">${session.text}</div>
            <div class="session-time" id="time-${index}">${formatElapsedTime(session.elapsedTime)}</div>
            <button class="btn btn-secondary text-xs" id="timer-btn-${index}" data-index="${index}">▶</button>
            <button class="btn btn-secondary text-xs" id="reset-btn-${index}" data-index="${index}">↻</button>
        `;
        resultsContainer.appendChild(row);
    });

    // Add event listeners
    resultsContainer.querySelectorAll('.session-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            sessionPlan[index].isCompleted = e.target.checked;
            if (e.target.checked) pauseTimer();
            renderPlanner();
        });
    });

    resultsContainer.querySelectorAll('.session-row').forEach(row => {
    row.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
            const index = parseInt(e.target.closest('.session-row').querySelector('.session-checkbox').dataset.index, 10);

            // Solo navegamos si la sesión tiene un subtítulo de inicio definido
            if (sessionPlan[index] && sessionPlan[index].startSub) {
                navigateToTranslation(sessionPlan[index].startSub - 1);
            }
        } // <-- ESTA ES LA LLAVE QUE SE HA MOVIDO A SU SITIO CORRECTO
    });
});

     resultsContainer.querySelectorAll('[id^=timer-btn-]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index, 10);

            if (activeSessionIndex === index && timerInterval) {
                pauseTimer();
            } else {
                startTimer(index);
            }
        });
    });

    resultsContainer.querySelectorAll('[id^=reset-btn-]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index, 10);
            resetTimer(index);
        });
    });
}

function startTimer(index) {
    clearInterval(timerInterval);
    activeSessionIndex = index;
    sessionStartTime = Date.now() - sessionPlan[index].elapsedTime;

    timerInterval = setInterval(updateTimerDisplay, 1000);
    renderPlanner(); // Re-render to show active state and button text change
    document.getElementById(`timer-btn-${index}`).textContent = '❚❚';
}

function pauseTimer() {
    if (activeSessionIndex === -1) return;
    clearInterval(timerInterval);
    timerInterval = null;
    sessionPlan[activeSessionIndex].elapsedTime = Date.now() - sessionStartTime;
    document.getElementById(`timer-btn-${activeSessionIndex}`).textContent = '▶';
}

function resetTimer(index) {
    if(activeSessionIndex === index) pauseTimer();
    sessionPlan[index].elapsedTime = 0;
    document.getElementById(`time-${index}`).textContent = '00:00:00';
}

function updateTimerDisplay() {
    const elapsedTime = Date.now() - sessionStartTime;
    document.getElementById(`time-${activeSessionIndex}`).textContent = formatElapsedTime(elapsedTime);
}

function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- END: PLANNER LOGIC ---

        // --- START: Floating Panel Logic (Drag, Resize, and Close) ---
        function closeFloatingPanel(panel, triggerButton) {
            panel.classList.remove('is-visible');
             if (triggerButton) {
                triggerButton.classList.remove('btn-active');
            }
        }

        function openFloatingPanel(panelToOpen, triggerButton, callback) {
            if (panelToOpen.classList.contains('is-visible')) {
                closeFloatingPanel(panelToOpen, triggerButton);
                return;
            }
            
            panelToOpen.classList.add('is-visible');
            
                 if (triggerButton) {
                triggerButton.classList.add('btn-active');
            }

            if (callback) {
                callback();
            }
        }
        
        function resetPanelPosition(panel) {
            // Remove inline styles set by dragging/resizing
            panel.style.left = '';
            panel.style.top = '';
            panel.style.width = '';
            panel.style.height = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.transform = '';
            
            // Remove the moved data attribute
            delete panel.dataset.moved;
            
            // Re-apply visibility to ensure it's positioned correctly by CSS
            panel.classList.remove('is-visible');
            setTimeout(() => panel.classList.add('is-visible'), 10);
        }

        function makePanelDraggable(panel) {
            const header = panel.querySelector('.sidebar-header');
            let isDragging = false;
            let offsetX, offsetY;

            header.addEventListener('mousedown', (e) => {
                // Ignore clicks on buttons inside the header
                if (e.target.closest('button')) return;
                
                isDragging = true;
                panel.dataset.moved = 'true'; // Mark as moved
                
                const rect = panel.getBoundingClientRect();
                panel.style.left = `${rect.left}px`;
                panel.style.top = `${rect.top}px`;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                
                panel.style.transition = 'none';
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'move';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                let newX = e.clientX - offsetX;
                let newY = e.clientY - offsetY;

                panel.style.left = `${newX}px`;
                panel.style.top = `${newY}px`;
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    panel.style.transition = ''; // Restore transitions
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                }
            });
        }
        
        function makePanelResizable(panel) {
            const resizers = document.createElement('div');
            resizers.innerHTML = `
                <div class="panel-resizer top-left"></div> <div class="panel-resizer top"></div> <div class="panel-resizer top-right"></div>
                <div class="panel-resizer left"></div>                                       <div class="panel-resizer right"></div>
                <div class="panel-resizer bottom-left"></div> <div class="panel-resizer bottom"></div> <div class="panel-resizer bottom-right"></div>
            `;
            panel.appendChild(resizers);
            
            let originalWidth, originalHeight, originalX, originalY, originalMouseX, originalMouseY;

            resizers.querySelectorAll('.panel-resizer').forEach(resizer => {
                resizer.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    panel.dataset.moved = 'true';
                    originalWidth = panel.offsetWidth;
                    originalHeight = panel.offsetHeight;
                    originalX = panel.offsetLeft;
                    originalY = panel.offsetTop;
                    originalMouseX = e.pageX;
                    originalMouseY = e.pageY;

                    const mouseMoveHandler = (e) => {
                        const dx = e.pageX - originalMouseX;
                        const dy = e.pageY - originalMouseY;

                        if (resizer.classList.contains('right')) {
                            panel.style.width = `${originalWidth + dx}px`;
                        } else if (resizer.classList.contains('left')) {
                            panel.style.width = `${originalWidth - dx}px`;
                            panel.style.left = `${originalX + dx}px`;
                        }

                        if (resizer.classList.contains('bottom')) {
                            panel.style.height = `${originalHeight + dy}px`;
                        } else if (resizer.classList.contains('top')) {
                            panel.style.height = `${originalHeight - dy}px`;
                            panel.style.top = `${originalY + dy}px`;
                        }
                        
                        // Handle corners
                        if (resizer.classList.contains('bottom-right')) {
                           panel.style.width = `${originalWidth + dx}px`;
                           panel.style.height = `${originalHeight + dy}px`;
                        } else if (resizer.classList.contains('bottom-left')) {
                           panel.style.width = `${originalWidth - dx}px`;
                           panel.style.left = `${originalX + dx}px`;
                           panel.style.height = `${originalHeight + dy}px`;
                        } else if (resizer.classList.contains('top-right')) {
                           panel.style.width = `${originalWidth + dx}px`;
                           panel.style.height = `${originalHeight - dy}px`;
                           panel.style.top = `${originalY + dy}px`;
                        } else if (resizer.classList.contains('top-left')) {
                           panel.style.width = `${originalWidth - dx}px`;
                           panel.style.left = `${originalX + dx}px`;
                           panel.style.height = `${originalHeight - dy}px`;
                           panel.style.top = `${originalY + dy}px`;
                        }
                    };

                    const mouseUpHandler = () => {
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);
                    };

                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                });
            });
        }
        // --- END: Floating Panel Logic ---


        // --- Initialization on page load ---
        document.addEventListener('DOMContentLoaded', async () => {
            await loadShortcuts();
            avisarDeLosLimites();
            initAsistenteDeIA();
            initAjustesDeIA({ confirmar: pedirConfirmacion });
            initPretraducir();
            setLanguage(state.currentLanguage);
            resetApplicationState();

            // ---------------- La columna de consulta -----------------------
            // La memoria y el glosario ya no son ventanas flotantes que se
            // arrastran por encima del editor: son dos recuadros fijos en una
            // columna a la derecha, como en Poanda.
            //
            // app.js le dice al puente cómo se hacen las cuatro cosas del
            // editor que el glosario y la memoria necesitan. Así ellos no saben
            // nada del editor y el editor no sabe nada de ellos.
            conectarElEditor({
                dondeEstaElCursor: getCurrentFocusedIndex,
                insertarEnElSegmento: insertarEnLaTraduccion,
                repintarTodo: () => renderTranslations(state.srtEntries),
                repintarOriginales: repintarTodosLosOriginales,
                recalcularTerminos: recalcularTerminosDelSegmentoActivo,
            });

            ponerLoQueSePuedeAbrir();
            engancharZonaDeSoltar();
            engancharPestanas();
            initChangelog();
            initPaneles();
            initAlineacion();
            initRecientes(puenteDeRecientes());

            // Los tres botones de la barra que llevan a una pestaña —memoria,
            // PandaBot y QA— los engancha engancharPestanas(): cada uno lleva a
            // la suya, se enciende mientras es la que se ve, y vuelto a pulsar
            // cierra la columna.
            initTerminoTarjeta();
            initTerminoModal();
            initIdiomasProyecto();

            // Insertar desde una tarjeta del glosario y desde la tarjeta que
            // sale al pasar el ratón: es la misma acción, así que es la misma
            // función.
            alInsertarDesdeElGlosario((texto) => insertarEnLaTraduccion(texto));
            alInsertarTraduccion((texto) => insertarEnLaTraduccion(texto));
            // Guardar o borrar un término en su ficha repinta el glosario, los
            // originales del editor y la lista del panel.
            alGuardarUnTermino(alCambiarElGlosario);
            // Un solo buscador para los dos paneles.
            alBuscarEnLosPaneles(() => {
                renderGlossary();
                tmSearch();
            });

            document.getElementById('addTermToggleBtn')?.addEventListener('click', () => {
                abrirFichaDeTermino(null);
            });
            document.getElementById('importTbxBtn')?.addEventListener('click', loadTBX);
            document.getElementById('downloadTbxBtn')?.addEventListener('click', downloadTBX);
            document.getElementById('downloadTmxBtn')?.addEventListener('click', downloadTMX);
            document.getElementById('tmFileInput')?.addEventListener('change', async (evento) => {
                const archivo = evento.target.files[0];
                if (!archivo) return;
                processTMXContent(await archivo.text());
                evento.target.value = '';
            });

makePanelDraggable(goToSubtitlePanel);
makePanelResizable(goToSubtitlePanel);
           makePanelDraggable(findReplacePanel);
            makePanelResizable(findReplacePanel);

// --- INICIO: Inicialización de WaveSurfer ---
            const waveformContainer = document.getElementById('waveform');
            const videoPlayer = document.getElementById('videoPlayer'); // Ya tienes esta variable
            
           // La onda ya no se dibuja a barritas. Una barra de 3 píxeles con 2 de
           // hueco resume 5 píxeles de sonido en uno: al ajustar la entrada de
           // un subtítulo, el principio de la palabra podía caer en el hueco y
           // no verse. Ahora es una onda continua, cada píxel es sonido.
           //
           // El dibujo se estira hasta llenar el recuadro, que a su vez llega
           // hasta abajo de la columna. Cuanto más alto, más separados quedan
           // los picos y más fácil es ver dónde empieza a hablar alguien.
           //
           // El alto se calcula aquí y no se deja en 'auto' porque debajo de la
           // onda va la regla de segundos, y las dos comparten recuadro: en
           // 'auto' la onda se lo quedaba entero y la regla se salía por abajo,
           // donde no se ve.
           /** Alto de la regla de segundos, en píxeles. */
           const ALTO_REGLA = 18;
           /** El alto que le toca a la onda dentro de su recuadro. */
           const altoDeLaOnda = () => {
               const relleno = 16; // El padding del recuadro, arriba y abajo.
               return Math.max(60, waveformContainer.clientHeight - relleno - ALTO_REGLA);
           };

           wavesurfer = WaveSurfer.create({
                container: waveformContainer,
                media: videoPlayer,
                waveColor: '#94a3b8',
                progressColor: '#075BA2',
                cursorColor: '#f59e0b',
                cursorWidth: 2,
                height: altoDeLaOnda(),
                barHeight: alturaDeLaOnda,
                responsive: true,
                minPxPerSec: (currentWaveformZoom * PIXELES_POR_SEGUNDO_AL_100) / 100,
                plugins: [
                    RegionsPlugin.create(),
                    // La regla de segundos, debajo de la onda. Sin ella la onda
                    // es un dibujo sin escala: se ve dónde suena algo pero no
                    // en qué segundo, y para saberlo había que pinchar y mirar
                    // el reproductor.
                    TimelinePlugin.create({
                        height: ALTO_REGLA,
                        timeInterval: 1,          // Una marca por segundo
                        primaryLabelInterval: 5,  // Y la cifra cada cinco
                        secondaryLabelInterval: 1,
                        secondaryLabelOpacity: 0.45,
                        style: { fontSize: '10px', color: '#6b7280' },
                        formatTimeCallback: (segundos) => {
                            const minutos = Math.floor(segundos / 60);
                            const resto = Math.floor(segundos % 60);
                            return `${minutos}:${String(resto).padStart(2, '0')}`;
                        },
                    }),
                ]
            });

            wsRegions = wavesurfer.plugins[0];

            // Al cambiar el alto de la ventana o el ancho de la columna, el
            // recuadro cambia de tamaño y la onda tiene que volver a repartirse
            // el sitio con la regla.
            if (typeof ResizeObserver !== 'undefined') {
                let ultimoAlto = altoDeLaOnda();
                new ResizeObserver(() => {
                    const nuevo = altoDeLaOnda();
                    if (nuevo === ultimoAlto) return;
                    ultimoAlto = nuevo;
                    wavesurfer.setOptions({ height: nuevo });
                }).observe(waveformContainer);
            }

            /**
             * Mete los estilos de las etiquetas dentro de la onda.
             *
             * WaveSurfer 7 dibuja dentro de un shadow DOM y la hoja de estilos
             * de la página no entra ahí. Desde que se actualizó la librería,
             * las etiquetas de las regiones salían sin fondo y a tamaño normal,
             * escritas en blanco encima de la onda.
             */
            function vestirLasRegiones() {
                const raiz = waveformContainer.querySelector('div')?.shadowRoot;
                if (!raiz || raiz.querySelector('style[data-subpanda]')) return;
                const estilo = document.createElement('style');
                estilo.dataset.subpanda = 'regiones';
                estilo.textContent = cssDeLasRegiones;
                raiz.appendChild(estilo);
            }
            vestirLasRegiones();
            wavesurfer.on('ready', vestirLasRegiones);
            wavesurfer.on('ready', () => laOndaDice(''));

             wavesurfer.on('ready', () => {
                 document.getElementById('ondaBloque').classList.remove('hidden');
waveformControls.classList.remove('hidden');
                 // AÑADIDO: Solo renderiza si hay subtítulos cargados
                 if (state.srtEntries && state.srtEntries.length > 0) {
                     renderTranslations(state.srtEntries, lastActiveSubtitleIndex, true); // Renderiza subtítulos Y regiones
                 }
             });
            wavesurfer.on('error', (err) => {
                 // Sin vídeo cargado no hay onda que dibujar: WaveSurfer intenta
                 // leer el reproductor vacío y avisa nada más arrancar. No es un
                 // fallo, es que todavía no hay archivo.
                 if (!videoPlayer.src) return;
                 console.error('WaveSurfer error:', err);
                 loQueLePasaALaOnda(err);
             });
              // Listener para cuando una región se mueve o redimensiona
             // Si una región desaparece por cualquier vía, se quita también del
            // registro: si no, quedaría apuntada una que ya no existe y su
            // subtítulo no podría volver a dibujarse nunca.
            wsRegions.on('region-removed', (region) => {
                regionesDeSubtitulos.delete(region.id);
            });

            wsRegions.on('region-updated', (region) => {
                 const entryIndex = state.srtEntries.findIndex(e => e.regionId === region.id);
                 if (entryIndex !== -1) {
                     const entry = state.srtEntries[entryIndex];
                     const newStartTimeMs = Math.round(region.start * 1000);
                     const newEndTimeMs = Math.round(region.end * 1000);

                     // Comprueba si los tiempos realmente cambiaron para evitar bucles infinitos
                     if (entry.startTimeMs !== newStartTimeMs || entry.endTimeMs !== newEndTimeMs) {
                         // Guarda el estado ANTES de modificar los datos
if (!isApplyingState) { // Solo guarda si no estamos deshaciendo/rehaciendo
                        const oldTimes = { startTimeMs: entry.startTimeMs, endTimeMs: entry.endTimeMs };
                        const newTimes = { startTimeMs: newStartTimeMs, endTimeMs: newEndTimeMs };
                        saveTimeChange(entryIndex, oldTimes, newTimes);
                    }
                         entry.startTimeMs = newStartTimeMs;
                         entry.endTimeMs = newEndTimeMs;
                         updateEntryTimes(entryIndex); // Actualiza la tabla y la propia región
                     }
                 }
             });
              // Listener para clic en una región
             wsRegions.on('region-clicked', (region, e) => {
                 e.stopPropagation(); // Evita que el clic se propague al contenedor de la onda
                 const entryIndex = state.srtEntries.findIndex(e => e.regionId === region.id);
                 if (entryIndex !== -1) {
                      wavesurfer.setTime(region.start); // Va al inicio de la región
                      navigateToTranslation(entryIndex); // Activa el subtítulo en la lista
                 }
             });

            // El planificador ya no es un acordeón que se pliega dentro de la
            // columna del vídeo: es una pestaña de la columna de consulta, así
            // que lo único que queda por enganchar es su botón de calcular.
            document.getElementById('calculateSessionsBtn')
                ?.addEventListener('click', calculateSessions);

            const undoBtn = document.getElementById('undoBtn');
            const redoBtn = document.getElementById('redoBtn');
            undoBtn.addEventListener('click', undo);
            redoBtn.addEventListener('click', redo);
            
            // Setup panel buttons
            // La memoria y el glosario ya no se abren y se cierran cada uno
            // por su lado: están siempre a la vista en la columna de la
            // derecha, como en Poanda. Lo que queda es esconder esa columna
            // cuando hace falta ancho para traducir.
setupPanel('goToSubtitlePanel', 'goToSubtitleBtn');
goToSubtitleActionBtn.addEventListener('click', goToSubtitleByNumber);
goToTimecodeActionBtn.addEventListener('click', goToSubtitleByTimecode);

            apagarAcciones(true);
            if (statsContainer) statsContainer.classList.add('hidden');
            if (statsAccordionContent) statsAccordionContent.classList.add('collapsed');
            
videoPlayer.addEventListener('timeupdate', () => {
    updateSubtitlePreview(); // Actualiza el texto de vista previa
    handlePlaybackTracking(); // Gestiona el resaltado/scroll automático
});

            // Inicializa los nuevos controles del reproductor
updateFontSize(TAMANO_POR_DEFECTO);
setPreviewSource('translation'); // Establece el estado inicial

// Event listeners para los nuevos botones
for (const opcion of document.querySelectorAll('.eleccion-opcion[data-fuente]')) {
    opcion.addEventListener('click', () => setPreviewSource(opcion.dataset.fuente));
}
fontSizeRange?.addEventListener('input', (e) => updateFontSize(Number(e.target.value)));

playPauseBtn?.addEventListener('click', alternarReproduccion);
document.getElementById('seekBackBtn')?.addEventListener('click', () => saltarSegundos(-1));
document.getElementById('seekForwardBtn')?.addEventListener('click', () => saltarSegundos(1));
videoPlayer.addEventListener('play', pintarBotonDeReproduccion);
videoPlayer.addEventListener('pause', pintarBotonDeReproduccion);
videoPlayer.addEventListener('ended', pintarBotonDeReproduccion);
document.getElementById('playbackRateRange')
    ?.addEventListener('input', (e) => ponerVelocidad(Number(e.target.value)));
// La velocidad se pierde cada vez que el reproductor carga un archivo.
videoPlayer.addEventListener('loadedmetadata', () => {
    videoPlayer.playbackRate = velocidadDeReproduccion;
    ajustarLaVistaPrevia();
});

// El vídeo cambia de tamaño al mover el separador de las columnas, al girar un
// portátil y al entrar en pantalla completa; la vista previa tiene que seguirlo.
if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => ajustarLaVistaPrevia()).observe(videoPlayer);
}

// Event listener para nuestro botón de pantalla completa
customFullscreenBtn.addEventListener('click', toggleFullscreen);

// Detecta cualquier cambio en el estado de la pantalla completa
document.addEventListener('fullscreenchange', handleFullscreenClass);
document.addEventListener('webkitfullscreenchange', handleFullscreenClass);
document.addEventListener('mozfullscreenchange', handleFullscreenClass);
document.addEventListener('MSFullscreenChange', handleFullscreenClass);

function handleFullscreenClass() {
    // Comprueba si hay algún elemento en pantalla completa
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    
    // Añade o quita la clase .is-fullscreen del contenedor del vídeo
    videoBloque.classList.toggle('is-fullscreen', isFullscreen);
}

// Event listener para cambiar el icono cuando cambia el estado de la pantalla completa
function handleFullscreenChange() {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

    fullscreenEnterChar.classList.toggle('hidden', isFullscreen);
    fullscreenExitChar.classList.toggle('hidden', !isFullscreen);

    if (isFullscreen) {
        // El vídeo pasa a ocupar la pantalla entera, así que el subtítulo tiene
        // que crecer con él: se guarda la proporción, no se suman píxeles.
        const pixeles = TAMANOS_DEL_SUBTITULO[subtitleFontSize - 1];
        subtitlePreviewText.style.fontSize = `${Math.round(pixeles * 2.2)}px`;
    } else {
        // Al salir, limpiamos el estilo para que vuelva a usar la regla normal.
        subtitlePreviewText.style.fontSize = ''; 
    }
}
// 2. "Escuchamos" todas las versiones del evento que usan los navegadores.
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);          
            // Language switcher events
            langEsBtn.addEventListener('click', () => setLanguage('es'));
            langEnBtn.addEventListener('click', () => setLanguage('en'));

            // Resizer logic
            const horizontalResizer = document.getElementById('horizontal-resizer');
            const videoSection = document.querySelector('.video-player-section');
            let isHorizontalResizing = false;
            horizontalResizer.addEventListener('mousedown', () => { isHorizontalResizing = true; document.body.style.cursor = 'col-resize'; });
            document.addEventListener('mousemove', (e) => { if (isHorizontalResizing) { const container = document.querySelector('.main-app-content'); const newVideoWidthPercent = ((e.clientX - container.getBoundingClientRect().left) / container.offsetWidth) * 100; if (newVideoWidthPercent > 20 && newVideoWidthPercent < 80) videoSection.style.flexBasis = `${newVideoWidthPercent}%`; } });
            document.addEventListener('mouseup', () => { isHorizontalResizing = false; document.body.style.cursor = ''; });
            
            // Backup Initialization
            try {
                if ((await db.projects.count()) > 0) {
                    backupIndicator?.classList.add('hay-copia');
                }
            } catch (error) {
                console.error('Error checking initial backup:', error);
            }
            // Cada diez segundos, como en Poanda. Eran cinco minutos, y cinco
            // minutos de subtítulos perdidos por un cuelgue del navegador son
            // muchos. Guardar es barato: solo se escribe si hay algo abierto, y
            // la memoria y el glosario solo si han cambiado.
            setInterval(saveBackup, 10_000);

            /** Escribe en el cuadro los datos de la copia que esté elegida. */
            async function pintarCopiaElegida() {
                const copia = await copiaElegida();
                if (!copia) return;
                backupFileName.textContent = copia.fileName;
                backupLastModified.textContent = new Date(copia.lastModified).toLocaleString();
            }

            backupBtn.addEventListener('click', async () => {
                const copias = await listarCopias();
                if (copias.length > 0) {
                    // El desplegable solo aparece cuando de verdad hay que
                    // elegir: con una sola copia sobra.
                    backupSelect.innerHTML = '';
                    for (const copia of copias) {
                        const opcion = document.createElement('option');
                        opcion.value = copia.id;
                        opcion.textContent = `${copia.fileName} — ${new Date(copia.lastModified).toLocaleString()}`;
                        backupSelect.appendChild(opcion);
                    }
                    backupSelectWrap.classList.toggle('hidden', copias.length < 2);
                    await pintarCopiaElegida();
                    backupFoundView.classList.remove('hidden');
                    noBackupFoundView.classList.add('hidden');
                } else {
                    backupFoundView.classList.add('hidden');
                    noBackupFoundView.classList.remove('hidden');
                }
                backupModal.classList.remove('hidden');
            });

            backupSelect.addEventListener('change', pintarCopiaElegida);
            closeBackupModalBtn.addEventListener('click', () => backupModal.classList.add('hidden'));

            confirmRestoreBtn.addEventListener('click', async () => {
                const sigue = await pedirConfirmacion(
                    translations[state.currentLanguage]['confirm_restore_message'],
                );
                if (!sigue) return;
                const copia = await copiaElegida();
                if (copia) {
                    await restoreProject(copia);
                    backupModal.classList.add('hidden');
                }
            });
      
            deleteBackupBtn.addEventListener('click', async () => {
                const copia = await copiaElegida();
                if (!copia) return;
                const sigue = await pedirConfirmacion(
                    errorMessages[state.currentLanguage]['backup_deleted_confirmation'],
                    { peligro: true },
                );
                if (!sigue) return;
                // Se borra la copia elegida, no todas: las demás siguen siendo
                // la red de seguridad de los otros archivos.
                await db.projects.delete(copia.id);
                if ((await db.projects.count()) === 0) {
                    backupIndicator?.classList.remove('hay-copia');
                }
                backupModal.classList.add('hidden');
                showMessage(errorMessages[state.currentLanguage]['backup_deleted_message']);
            });
            exportSrtFromBackupBtn.addEventListener('click', async () => {
                const backup = await copiaElegida();
                if (!backup) { showMessage(errorMessages[state.currentLanguage]['no_backup_to_export']); return; }
                try {
                    // La copia recuerda en qué formato estaba el archivo, así
                    // que sale como entró y no siempre como SRT.
                    const suFormato = formatoPorId(backup.formatoId);
                    const srtContent = suFormato.escribir(
                        backup.srtEntries,
                        backup.documentoDelArchivo,
                        backup.formatoDelSrt,
                    );
                    // Igual que al exportar: el recorte lo hace la tabla de
                    // formatos, que las conoce todas.
                    const newFileName = conLaExtensionDe(
                        `${sinExtension(backup.fileName)}_recuperado_${new Date().toISOString().slice(0, 10)}`,
                        suFormato,
                    );
                    const blob = guardarSubtitulos(srtContent, backup.formatoDelSrt || {});
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = newFileName;
                    a.click();
                    URL.revokeObjectURL(a.href);
                    showMessage(`${errorMessages[state.currentLanguage]['backup_export_success']}: "${newFileName}"`);
                } catch (error) {
                    showMessage(`${errorMessages[state.currentLanguage]['backup_export_error']}${error.message}`);
                }
            });

            // Los límites de calidad, en su pestaña. Eran un cuadro encima de
            // todo con dos campos y un botón de guardar: se abría, se cambiaba
            // un número y se cerraba, y para volver a mirar cuál era el límite
            // había que abrirlo otra vez. Aquí están a la vista mientras se
            // traduce, que es cuando importan.
            pintarLimitesDeQa();

            // Las comprobaciones, con su límite al lado y cuántas han
            // saltado. Los límites se aplican al escribirlos, sin botón de
            // guardar: se ven aplicados al momento en la propia lista, y un
            // botón de guardar solo añade una manera de dejárselo sin aplicar.
            engancharElPanelDeQa();
            pintarElPanelDeQa();
            renderQaErrorList();

            // El recuento de la cabecera también lleva a la pestaña de QA.
            qaErrorStats.addEventListener('click', irAlQa);

            document.getElementById('qaRevisarBtn')?.addEventListener('click', () => {
                yaSeHaRevisado = true;
                renderQaErrorList();
            });

            // Pulsar un error lleva a su subtítulo, y la lista se queda donde
            // está: repasar veinte errores no debería costar cuarenta clics.
            qaErrorListContainer.addEventListener('click', (event) => {
                const cual = event.target.closest('.qa-error-item');
                if (cual) navigateToTranslation(parseInt(cual.dataset.entryIndex, 10));
            });

            // Event listeners for TBX/TMX modals
            cancelSaveTbxBtn.addEventListener('click', () => {
                saveTbxModal.classList.add('hidden');
            });

            confirmSaveTbxBtn.addEventListener('click', () => {
                const filename = fileNameInputTbx.value;
                if (!filename) {
                    showMessage(errorMessages[state.currentLanguage]['please_enter_filename']);
                    return;
                }
                showLoadingOverlay(errorMessages[state.currentLanguage]['saving_file']);
                try {
                    const tbxContent = generateTBX();
                    const blob = new Blob([tbxContent], { type: "application/xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename.endsWith('.tbx') ? filename : filename + '.tbx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showMessage(errorMessages[state.currentLanguage]['file_saved_successfully_tbx']);
                } catch (error) {
                    showMessage(`${errorMessages[state.currentLanguage]['error_saving_file']} ${error.message}`);
                    console.error("Error downloading TBX:", error);
                } finally {
                    hideLoadingOverlay();
                    saveTbxModal.classList.add('hidden');
                }
            });

            cancelSaveTmxBtn.addEventListener('click', () => {
                saveTmxModal.classList.add('hidden');
            });

            confirmSaveTmxBtn.addEventListener('click', () => {
                const filename = fileNameInputTmx.value;
                if (!filename) {
                    showMessage(errorMessages[state.currentLanguage]['please_enter_filename']);
                    return;
                }
                showLoadingOverlay(errorMessages[state.currentLanguage]['saving_file']);
                try {
                    const tmxContent = generateTMX();
                    if (!tmxContent) return;
                    const blob = new Blob([tmxContent], { type: "application/xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename.endsWith('.tmx') ? filename : filename + '.tmx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showMessage(errorMessages[state.currentLanguage]['file_saved_successfully_tmx']);
                } catch (error) {
                    showMessage(`${errorMessages[state.currentLanguage]['error_saving_file']} ${error.message}`);
                    console.error("Error downloading TMX:", error);
                } finally {
                    hideLoadingOverlay();
                    saveTmxModal.classList.add('hidden');
                }
            });

            // Project Save/Load Listeners
            newProjectBtn.addEventListener('click', () => {
                if (state.srtEntries.length > 0) {
                    confirmNewProjectModal.classList.remove('hidden');
                } else {
                    resetApplicationState();
                }
            });

// --- Timecode Modal Listeners ---
            const timecodeModal = document.getElementById('timecodeModal');
            const timecodeSettingsBtn = document.getElementById('settingsBtn');
            const closeTimecodeModalBtn = document.getElementById('closeTimecodeModalBtn');
            const saveTimecodeSettingsBtn = document.getElementById('saveTimecodeSettingsBtn');
            const projectFpsInput = document.getElementById('projectFpsInput');
            const useFrameTimecodeToggle = document.getElementById('useFrameTimecodeToggle');

            timecodeSettingsBtn.addEventListener('click', () => {
                // Cargar valores actuales en el modal
                projectFpsInput.value = projectFPS;
                useFrameTimecodeToggle.checked = useFrameTimecode;
                timecodeModal.classList.remove('hidden');
            });

            closeTimecodeModalBtn.addEventListener('click', () => {
                timecodeModal.classList.add('hidden');
            });
            document
                .getElementById('ajustesCerrarBtn')
                ?.addEventListener('click', () => timecodeModal.classList.add('hidden'));

            saveTimecodeSettingsBtn.addEventListener('click', () => {
                // Guardar nuevos valores
                const newFPS = parseFloat(projectFpsInput.value);
                projectFPS = isNaN(newFPS) || newFPS <= 0 ? 25 : newFPS;
                useFrameTimecode = useFrameTimecodeToggle.checked;

                // Actualizar el placeholder del panel "Ir a..."
                if (useFrameTimecode) {
                    goToTimecodeInput.value = formatFrameTime(0, projectFPS);
                } else {
                    goToTimecodeInput.value = formatTime(0);
                }
                
                // Refrescar la lista de traducción para mostrar el nuevo formato
                renderTranslations(state.srtEntries, lastActiveSubtitleIndex, true);
                
                timecodeModal.classList.add('hidden');
            });


    saveProjectBtn.addEventListener('click', () => {
                if (state.srtEntries.length === 0) {
                    showMessage(errorMessages[state.currentLanguage]['no_project_to_save']);
                    return;
                }
                // Sugiere un nombre de archivo basado en el SRT actual
                projectFileNameInput.value = currentFileName.replace(/\.[^/.]+$/, '');
                saveProjectModal.classList.remove('hidden');
                projectFileNameInput.focus();
            });

 confirmSaveProjectBtn.addEventListener('click', () => {
                const filename = projectFileNameInput.value.trim();
                if (!filename) {
                    showMessage(errorMessages[state.currentLanguage]['please_enter_filename']);
                    return;
                }
                saveProject(filename); // Llama a la función de guardado con el nuevo nombre
                saveProjectModal.classList.add('hidden');
            });

            cancelSaveProjectBtn.addEventListener('click', () => {
                saveProjectModal.classList.add('hidden');
                afterSaveAction = null; // Cancela cualquier acción pendiente
            });

            projectFile.addEventListener('change', loadProject);
resetAppBtn.addEventListener('click', resetApplicationCache);            

            // El campo de importar TMX tenía aquí un segundo oyente, de antes de
            // traer la memoria de Poanda, que llamaba a una función que ya no
            // existe. Se dispararon los dos: primero el bueno y después este,
            // que reventaba. El error salía por la consola —donde nadie mira— y
            // dejaba a medias lo que viniera detrás.

            // New Project Confirmation Modal Listeners
            cancelNewProjectBtn.addEventListener('click', () => {
                confirmNewProjectModal.classList.add('hidden');
            });
            continueWithoutSavingBtn.addEventListener('click', () => {
                resetApplicationState();
            });
saveAndContinueBtn.addEventListener('click', () => {
                confirmNewProjectModal.classList.add('hidden');
                // Define la acción a ejecutar después de guardar
                afterSaveAction = resetApplicationState;
                // Dispara el clic en el botón de guardar para abrir el modal
                saveProjectBtn.click();
            });



      reselectVideoInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
              if (file) {
        videoFileName = file.name;
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        // Igual que al cargarlo la primera vez: el archivo, no su URL.
        laOndaDice(translations[state.currentLanguage].onda_leyendo);
        wavesurfer.loadBlob(file).catch(loQueLePasaALaOnda);
        document.getElementById('ondaBloque').classList.remove('hidden');
        videoPlayer.controls = true;
                    videoPlayer.load();
                                
                    document.getElementById('videoLogoPlaceholder').classList.add('hidden');
            
                    const loadVideoBtnSpan = document.querySelector('#loadVideoBtn span');
                    if (loadVideoBtnSpan) {
                        loadVideoBtnSpan.textContent = translations[state.currentLanguage]['change_video'];
                    }
                    reselectVideoModal.classList.add('hidden');
                }
            });

            skipReselectVideoBtn.addEventListener('click', () => {
                reselectVideoModal.classList.add('hidden');
            });

          // --- CORRECCIÓN: Lógica completa de modales y botones de Nuevo Glosario/TM ---

            // 1. Conectar botones de apertura (Nuevo Glosario / Nueva TM)
            const newGlossaryBtn = document.getElementById('newGlossaryBtn');
            if (newGlossaryBtn) {
                newGlossaryBtn.addEventListener('click', showConfirmResetGlossary);
            }

            const newTmBtn = document.getElementById('newTmBtn');
            if (newTmBtn) {
                newTmBtn.addEventListener('click', showConfirmResetTm);
            }

            // 2. Conectar botones de "Continuar" en los modales (Acción de borrado)
            // Usamos .onclick para garantizar que la función se ejecute sin duplicar listeners
            if (confirmResetGlossaryBtn) {
                confirmResetGlossaryBtn.onclick = function() {
                    resetGlossary();
                    confirmResetGlossaryModal.classList.add('hidden');
                };
            }

            if (confirmResetTmBtn) {
                confirmResetTmBtn.onclick = function() {
                    resetTM();
                    confirmResetTmModal.classList.add('hidden');
                };
            }

            // 3. Conectar botones de "Cancelar"
            if (cancelResetGlossaryBtn) {
                cancelResetGlossaryBtn.addEventListener('click', () => {
                    confirmResetGlossaryModal.classList.add('hidden');
                });
            }

            if (cancelResetTmBtn) {
                cancelResetTmBtn.addEventListener('click', () => {
                    confirmResetTmModal.classList.add('hidden');
                });
            }
            // ---------------------------------------------------------------------

        // Funciones para mostrar los modales de confirmación
        function showConfirmResetGlossary() {
            if (state.glossary.length === 0) {
                resetGlossary();
                return;
            }
            confirmResetGlossaryModal.classList.remove('hidden');
        }

       function showConfirmResetTm() {
            if (state.translationMemory.length === 0) {
                resetTM();
                return;
            }
            confirmResetTmModal.classList.remove('hidden');
        }



// --- INICIO: Listeners para la botonera de la onda ---
        lockWaveformBtn.addEventListener('click', toggleWaveformLock);
        // Los dos deslizadores: mientras se arrastra se ve el resultado, sin
        // esperar a soltar.
        zoomRange?.addEventListener('input', (e) => ponerZoomDeOnda(Number(e.target.value)));
        waveHeightRange?.addEventListener('input', (e) => ponerAlturaDeOnda(Number(e.target.value)));
        engancharDeslizadores();
        // --- FIN: Listeners para la botonera de la onda ---

// --- INICIO: Listener para botón de seguimiento ---
followPlaybackBtn.addEventListener('click', () => {
    isFollowPlaybackActive = !isFollowPlaybackActive;
    followPlaybackBtn.classList.toggle('active', isFollowPlaybackActive); // Usa la clase 'active' genérica
    followPlaybackBtn.title = isFollowPlaybackActive
        ? translations[state.currentLanguage]['follow_playback_off']
        : translations[state.currentLanguage]['follow_playback_on'];

    // Si se acaba de desactivar, limpia los resaltados
    if (!isFollowPlaybackActive) {
        clearPlaybackHighlights();
        currentlyTrackedRegionId = null;
        currentlyTrackedEditorIndex = -1;
    } else {
         handlePlaybackTracking(); // Intenta resaltar inmediatamente si se activa
    }
});
// --- FIN: Listener para botón de seguimiento ---

const statusBar = document.getElementById('statusBar');
    const toggleStatusBarBtn = document.getElementById('toggleStatusBarBtn');

// --- INICIO: MODIFICAR ESTE BLOQUE (Lógica de la Barra de Estado) ---
        if (statusBar && toggleStatusBarBtn) {
            // Comprueba el estado guardado al cargar la página
            const savedState = localStorage.getItem('statusBarVisible') === 'true';
            let textKey = 'show_status_bar_btn'; // Texto por defecto

            if (savedState) {
                statusBar.classList.add('is-visible');
                document.body.classList.add('status-bar-visible'); // Mantenemos esto por si acaso, aunque no afecte visualmente ahora
                textKey = 'hide_status_bar_btn'; // Texto si está visible
            }
            // Establecemos el atributo i18n para que se actualice con el idioma
            const buttonSpan = toggleStatusBarBtn.querySelector('span'); // Guardamos el span en una variable
            if (buttonSpan) { // Comprobamos si el span existe
                 buttonSpan.setAttribute('data-i18n', textKey);
                 // Añadimos esta línea para asegurar que el texto se actualice al cargar
                 buttonSpan.textContent = translations[state.currentLanguage][textKey];
            }


            // Listener del botón
            toggleStatusBarBtn.addEventListener('click', () => {
                const isVisible = statusBar.classList.toggle('is-visible');
                document.body.classList.toggle('status-bar-visible', isVisible);

                // Actualiza el texto del botón y el atributo i18n
                const newTextKey = isVisible ? 'hide_status_bar_btn' : 'show_status_bar_btn';
                if (buttonSpan) { // Usamos la variable guardada
                    buttonSpan.textContent = translations[state.currentLanguage][newTextKey];
                    buttonSpan.setAttribute('data-i18n', newTextKey);
                }

                // Guardar el estado en el navegador
                localStorage.setItem('statusBarVisible', isVisible);
            });
        }

// --- INICIO: NUEVO ESCUCHA GLOBAL DE ATAJOS DE TECLADO ---
document.addEventListener('keydown', (event) => {
    const activeElement = document.activeElement;
    const isTypingInInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;

    // --- Lógica para Atajos de Documentación ---
    const triggeredDocAction = shortcuts.docResources.find(res => {
        if (!res.shortcut) return false;
        const sc = res.shortcut;
        const keyMatch = (sc.key === ' ' && event.code === 'Space') || (sc.key.toLowerCase() === event.key.toLowerCase());
        return keyMatch &&
               sc.ctrlKey === event.ctrlKey &&
               sc.metaKey === event.metaKey &&
               sc.altKey === event.altKey &&
               sc.shiftKey === event.shiftKey;
    });

    if (triggeredDocAction) {
        event.preventDefault();
        const selectedText = window.getSelection().toString().trim();
        const resourceUrl = triggeredDocAction.url;
        if (selectedText && resourceUrl && resourceUrl.includes('{word}')) {
            const finalUrl = resourceUrl.replace('{word}', encodeURIComponent(selectedText));
            window.open(finalUrl, '_blank');
        }
        return;
    }
    
    if (isTypingInInput) {
        return;
    }

    // --- Lógica para Atajos Globales (SOLO VÍDEO) ---
    const globalActions = [
        'jumpToTime', 'playSegment', 'playSegmentLoop', 'playPause', 
        'seekForward', 'seekBackward', 'seekForwardFast', 'seekBackwardFast'
    ];
    
    const triggeredGlobalAction = Object.keys(shortcuts).find(action => {
        if (!globalActions.includes(action)) return false;
        const shortcut = shortcuts[action];
        const keyMatch = (shortcut.key === ' ' && event.code === 'Space') || (shortcut.key.toLowerCase() === event.key.toLowerCase());
        return keyMatch &&
               shortcut.ctrlKey === event.ctrlKey &&
               shortcut.metaKey === event.metaKey &&
               shortcut.altKey === event.altKey &&
               shortcut.shiftKey === event.shiftKey;
    });

    if (triggeredGlobalAction) {
        event.preventDefault();
        switch (triggeredGlobalAction) {
            case 'jumpToTime':
            case 'playSegment':
                jumpToCurrentSubtitleTime(lastActiveSubtitleIndex);
                break;
            case 'playSegmentLoop':
                playSubtitleLoop(lastActiveSubtitleIndex);
                break;
            case 'playPause':
                if (videoPlayer.paused) videoPlayer.play();
                else videoPlayer.pause();
                break;
            case 'seekForward':
                videoPlayer.currentTime += 3;
                break;
            case 'seekBackward':
                videoPlayer.currentTime -= 3;
                break;
            case 'seekForwardFast':
                videoPlayer.currentTime += 5;
                break;
            case 'seekBackwardFast':
                videoPlayer.currentTime -= 5;
                break;
        }
    }
});
// --- FIN: NUEVO ESCUCHA GLOBAL DE ATAJOS DE TECLADO ---
   
followPlaybackBtn.title = translations[state.currentLanguage]['follow_playback_on'];
    });
   

// --- Modo claro / oscuro ---
// El botón lleva texto, no un icono: un sol y una luna se parecen demasiado a
// primera vista y nunca queda claro si dicen en qué modo estás o a cuál vas.
// Dice a cuál vas, como en Poanda.
const themeToggleBtn = document.getElementById('themeToggleBtn');

const enOscuro = () => document.documentElement.classList.contains('dark');

function aplicarModo(oscuro) {
    document.documentElement.classList.toggle('dark', oscuro);
    localStorage.setItem('theme', oscuro ? 'dark' : 'light');
    actualizarBotonTema();
}

aplicarModo(
    localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) &&
            window.matchMedia('(prefers-color-scheme: dark)').matches),
);

themeToggleBtn?.addEventListener('click', () => aplicarModo(!enOscuro()));

// ---------------------------------------------------------------------------
// Puente temporal para los atributos onclick que quedan en el HTML.
//
// Antes todo el programa vivía en el ámbito global de la página, así que un
// onclick="addTerm()" escrito en el HTML encontraba la función sin más. Al
// pasar a módulos ese ámbito desaparece, y esos botones dejarían de funcionar
// sin dar ningún error visible: simplemente no harían nada.
//
// Esta lista es, por tanto, la lista de lo que queda por convertir a
// addEventListener. Cada vez que se convierte uno, se quita de aquí. Cuando
// esté vacía, este bloque se borra entero.
// ---------------------------------------------------------------------------
Object.assign(window, {
    updateLoopCount,
});
