// js/dom.js
// Every cached DOM element reference the app uses, in one place — moved
// out of the original single inline <script> block verbatim (same ids,
// same variable names). This file's top-level `const` assignments run the
// moment the browser parses this <script> tag, so — just like the
// original — it MUST be loaded after all the markup it refers to already
// exists in the document (i.e. this whole js/ block stays at the very end
// of <body>, same placement the original inline <script> had).

const tmxFileInput = document.getElementById('tmxFileInput');
const importCodeBtn = document.getElementById('importCodeBtn');
const downloadTmxBtn = document.getElementById('downloadTmxBtn');
const newTmxBtn = document.getElementById('newTmxBtn');
const alignBtn = document.getElementById('alignBtn');
const themeToggleButton = document.getElementById('themeToggleButton');
const languageConfigSection = document.getElementById('languageConfigSection');
const editorSection = document.getElementById('editorSection');
const alignmentSection = document.getElementById('alignmentSection');
const configSrcLangInput = document.getElementById('configSrcLang');
const configTgtLangInput = document.getElementById('configTgtLang');
const confirmLanguagesBtn = document.getElementById('confirmLanguagesBtn');
const displaySrcLangSpan = document.getElementById('displaySrcLang');
const displayTgtLangSpan = document.getElementById('displayTgtLang');
const searchTermInput = document.getElementById('searchTerm');
const tmTableBody = document.getElementById('tmTableBody');
const addEntryBtn = document.getElementById('addEntryBtn');
const noResultsMessage = document.getElementById('noResultsMessage');
const undoBtn = document.getElementById('undoBtn');
const alignSrcLang = document.getElementById('alignSrcLang');
const alignTgtLang = document.getElementById('alignTgtLang');
const sourceFileInput = document.getElementById('sourceFileInput');
const targetFileInput = document.getElementById('targetFileInput');
const sourceFileName = document.getElementById('sourceFileName');
const targetFileName = document.getElementById('targetFileName');
const sourceTextArea = document.getElementById('sourceTextArea');
const targetTextArea = document.getElementById('targetTextArea');
const startAlignmentBtn = document.getElementById('startAlignmentBtn');
const isoLanguagesDatalist = document.getElementById('isoLanguages');
const langEnBtn = document.getElementById('langEnBtn');
const langEsBtn = document.getElementById('langEsBtn');

// Modales
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const messageCloseBtn = document.getElementById('messageCloseBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmProceedBtn = document.getElementById('confirmProceedBtn');
const restoreModal = document.getElementById('restoreModal');
const restoreTitle = document.getElementById('restoreTitle');
const restoreText = document.getElementById('restoreText');
const restoreDiscardBtn = document.getElementById('restoreDiscardBtn');
const restoreProceedBtn = document.getElementById('restoreProceedBtn');

// Modal de Importación de Código
const importCodeModal = document.getElementById('importCodeModal');
const codeImportArea = document.getElementById('codeImportArea');
const codeValidationStatus = document.getElementById('codeValidationStatus');
const cancelImportCodeBtn = document.getElementById('cancelImportCodeBtn');
const processImportCodeBtn = document.getElementById('processImportCodeBtn');

// Asistente de Alineación
const alignmentWizardModal = document.getElementById('alignmentWizardModal');
const wizardSourceColumn = document.getElementById('wizardSourceColumn');
const wizardActionsColumn = document.getElementById('wizardActionsColumn');
const wizardTargetColumn = document.getElementById('wizardTargetColumn');
const wizardCancelBtn = document.getElementById('wizardCancelBtn');
const wizardConfirmBtn = document.getElementById('wizardConfirmBtn');

// Botón de versión y modal de novedades
const versionBtn = document.getElementById('versionBtn');
const changelogModal = document.getElementById('changelogModal');
const changelogText = document.getElementById('changelogText');
const changelogCloseBtn = document.getElementById('changelogCloseBtn');
const changelogLink = document.getElementById('changelogLink');
