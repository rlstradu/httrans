const aiSidebar = document.getElementById('aiSidebar');

const aiChatContainer = document.getElementById('aiChatContainer');

const translationsContainer = document.getElementById('translationsContainer');

const messageBox = document.getElementById('messageBox');

const messageText = document.getElementById('messageText');

const messageClose = document.getElementById('messageClose');

const poandaLogo = document.querySelector('.max-w-xs');

const dropArea = document.getElementById('dropArea');

const loadingOverlay = document.getElementById('loadingOverlay');

const loadingMessage = document.getElementById('loadingMessage');

const mainEditorLayout = document.getElementById('mainEditorLayout');

const poSearchContainer = document.getElementById('poSearchContainer');

const poSearchInput = document.getElementById('poSearchInput');

const searchInOriginalCheckbox = document.getElementById('searchInOriginalCheckbox');

const searchInTranslationCheckbox = document.getElementById('searchInTranslationCheckbox');

const searchPrevBtn = document.getElementById('searchPrevBtn');

const searchNextBtn = document.getElementById('searchNextBtn');

const searchResultCounter = document.getElementById('searchResultCounter');

const projectFileInput = document.getElementById('projectFile');

const newProjectBtn = document.getElementById('newProjectBtn');

const openProjectBtn = document.getElementById('openProjectBtn');

const saveProjectBtn = document.getElementById('saveProjectBtn');

const saveProjectModal = document.getElementById('saveProjectModal');

const projectFilenameInput = document.getElementById('projectFilenameInput');

const saveProjectConfirmBtn = document.getElementById('saveProjectConfirmBtn');

const saveProjectCancelBtn = document.getElementById('saveProjectCancelBtn');

const restoreBackupModal = document.getElementById('restoreBackupModal');

const restoreBackupBtn = document.getElementById('restoreBackupBtn');

const discardBackupBtn = document.getElementById('discardBackupBtn');

const backupBtn = document.getElementById('backupBtn');

const backupIndicator = document.getElementById('backupIndicator');

const backupModal = document.getElementById('backupModal');

const lastBackupTime = document.getElementById('lastBackupTime');

const loadLocalBackupBtn = document.getElementById('loadLocalBackupBtn');

const saveBackupToDiskBtn = document.getElementById('saveBackupToDiskBtn');

const loadBackupFromFileInput = document.getElementById('loadBackupFromFileInput');

const deleteLocalBackupBtn = document.getElementById('deleteLocalBackupBtn');

const backupCloseBtn = document.getElementById('backupCloseBtn');

const backupFileInput = document.getElementById('backupFile');

const statsBtn = document.getElementById('statsBtn');

const statsContainer = document.getElementById('statsContainer');

const segmentsProgress = document.getElementById('segmentsProgress');

const wordsTranslated = document.getElementById('wordsTranslated');

const wordsTotal = document.getElementById('wordsTotal');

const wordsRemaining = document.getElementById('wordsRemaining');

const shortcutsBtn = document.getElementById('shortcutsBtn');

const shortcutsModal = document.getElementById('shortcutsModal');

const shortcutsCloseBtn = document.getElementById('shortcutsCloseBtn');

const findReplaceBtn = document.getElementById('findReplaceBtn');

const findReplaceModal = document.getElementById('findReplaceModal');

const findInput = document.getElementById('findInput');

const replaceInput = document.getElementById('replaceInput');

const caseSensitiveCheckbox = document.getElementById('caseSensitiveCheckbox');

const regexCheckbox = document.getElementById('regexCheckbox');

const findPrevBtn = document.getElementById('findPrevBtn');

const findNextBtn = document.getElementById('findNextBtn');

const replaceBtn = document.getElementById('replaceBtn');

const replaceAllBtn = document.getElementById('replaceAllBtn');

const findReplaceCloseBtn = document.getElementById('findReplaceCloseBtn');

const shortcutsEditor = document.getElementById('shortcutsEditor');

const saveShortcutsBtn = document.getElementById('saveShortcutsBtn');

const importShortcutsBtn = document.getElementById('importShortcutsBtn');

const importShortcutsInput = document.getElementById('importShortcutsInput');

const exportShortcutsBtn = document.getElementById('exportShortcutsBtn');

const resetShortcutsBtn = document.getElementById('resetShortcutsBtn');

const panelesBtn = document.getElementById('panelesBtn');

const terminologySidebar = document.getElementById('terminologySidebar');

const closeTerminologySidebarBtn = document.getElementById('closeTerminologySidebarBtn');

const terminologyEditorSection = document.getElementById('terminologyEditorSection');



/**
 * El buscador de la columna de consulta: uno solo para la memoria y el
 * glosario. Antes había uno en cada panel, buscando lo mismo con dos campos y
 * dos títulos, que en media columna son dos franjas de sitio.
 */
const buscarPaneles = document.getElementById('buscarPaneles');

const glosarioLista = document.getElementById('glosarioLista');

const tbxFileInput = document.getElementById('tbxFileInput');

const importTbxBtn = document.getElementById('importTbxBtn');

const translationMemorySidebar = document.getElementById('translationMemorySidebar');

const closeTranslationMemorySidebarBtn = document.getElementById(
    'closeTranslationMemorySidebarBtn',
);

const tmFileInput = document.getElementById('tmFileInput');

const tmResultadosLista = document.getElementById('tmResultadosLista');

const tmNoMatchFoundMessage = document.getElementById('tmNoMatchFoundMessage');

const tmEditorSection = document.getElementById('tmEditorSection');

const tmInternalMessage = document.getElementById('tmInternalMessage');

const centralColumn = document.getElementById('central-column');

const convertToMoModal = document.getElementById('convertToMoModal');

const moConverterCloseBtn = document.getElementById('moConverterCloseBtn');

const moConverterActionBtn = document.getElementById('moConverterActionBtn');

const aiBtn = document.getElementById('aiBtn');

const closeAiSidebarBtn = document.getElementById('closeAiSidebarBtn');

const aiConfigToggleBtn = document.getElementById('aiConfigToggleBtn');

const aiConfigPanel = document.getElementById('aiConfigPanel');


const aiUserInput = document.getElementById('aiUserInput');

const aiSendBtn = document.getElementById('aiSendBtn');

export {
    aiBtn,
    aiChatContainer,
    aiConfigPanel,
    aiConfigToggleBtn,
    aiSendBtn,
    aiSidebar,
    aiUserInput,
    backupBtn,
    backupCloseBtn,
    backupIndicator,
    backupModal,
    caseSensitiveCheckbox,
    centralColumn,
    closeAiSidebarBtn,
    closeTerminologySidebarBtn,
    closeTranslationMemorySidebarBtn,
    convertToMoModal,
    deleteLocalBackupBtn,
    discardBackupBtn,
    dropArea,
    exportShortcutsBtn,
    findInput,
    findNextBtn,
    findPrevBtn,
    findReplaceBtn,
    findReplaceCloseBtn,
    findReplaceModal,
    glosarioLista,
    importShortcutsBtn,
    importShortcutsInput,
    lastBackupTime,
    loadBackupFromFileInput,
    loadLocalBackupBtn,
    loadingMessage,
    loadingOverlay,
    messageBox,
    messageClose,
    messageText,
    moConverterActionBtn,
    moConverterCloseBtn,
    newProjectBtn,
    openProjectBtn,
    poSearchContainer,
    poSearchInput,
    projectFileInput,
    projectFilenameInput,
    regexCheckbox,
    replaceAllBtn,
    replaceBtn,
    replaceInput,
    resetShortcutsBtn,
    restoreBackupBtn,
    restoreBackupModal,
    saveBackupToDiskBtn,
    saveProjectBtn,
    saveProjectCancelBtn,
    saveProjectConfirmBtn,
    saveProjectModal,
    saveShortcutsBtn,
    searchInOriginalCheckbox,
    searchInTranslationCheckbox,
    searchNextBtn,
    searchPrevBtn,
    searchResultCounter,
    buscarPaneles,
    segmentsProgress,
    shortcutsBtn,
    shortcutsCloseBtn,
    shortcutsEditor,
    shortcutsModal,
    statsBtn,
    statsContainer,
    tbxFileInput,
    panelesBtn,
    terminologyEditorSection,
    terminologySidebar,
    tmEditorSection,
    tmFileInput,
    tmInternalMessage,
    tmNoMatchFoundMessage,
    tmResultadosLista,
    translationMemorySidebar,
    translationsContainer,
    wordsRemaining,
    wordsTotal,
    wordsTranslated,
};
