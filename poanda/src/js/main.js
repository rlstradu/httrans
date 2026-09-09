import { handleAiSend, prepararPanelDeIA, triggerQuickAI } from './ai.js';
import { initAjustesDeIA, pintarAjustesDeIA } from './ia-ajustes-ui.js';
import { initPretraducir } from './pretraducir-ui.js';
import {
    checkForBackup,
    clearBackup,
    loadBackup,
    restoreSession,
    saveBackup,
    updateBackupStatusUI,
} from './backup.js';
import { compileMo, parsePoForMo } from './core/mo.js';
import { reconstructPo } from './core/po.js';
import { hideLoadingOverlay, showConfirm, showLoadingOverlay, showMessage } from './dialogs.js';
import {
    aiBtn,
    aiConfigPanel,
    aiConfigToggleBtn,
    aiSendBtn,
    aiSidebar,
    aiUserInput,
    backupBtn,
    backupCloseBtn,
    backupModal,
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
    importShortcutsBtn,
    importShortcutsInput,
    loadBackupFromFileInput,
    loadLocalBackupBtn,
    messageBox,
    messageClose,
    moConverterActionBtn,
    moConverterCloseBtn,
    newProjectBtn,
    openProjectBtn,
    poSearchContainer,
    poSearchInput,
    projectFileInput,
    replaceAllBtn,
    replaceBtn,
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
    shortcutsBtn,
    shortcutsCloseBtn,
    shortcutsModal,
    statsBtn,
    statsContainer,
    panelesBtn,
    terminologySidebar,
    tmFileInput,
    translationMemorySidebar,
    translationsContainer,
} from './dom.js';
import {
    filterPOEntries,
    getCurrentFocusedIndex,
    initEtiquetas,
    insertarEnLaTraduccionActiva,
    navigateToTranslation,
    renderTranslations,
} from './editor.js';
import {
    abrirArchivo,
    elegirYAbrirArchivo,
    guardarArchivoActual,
    hayUnPoAbierto,
    processFile,
    processPoContent,
    saveHtmlFile,
    saveJsonFile,
    updateSaveButtonsState,
} from './files.js';
import {
    alCambiarElGlosario,
    alInsertarDesdeElGlosario,
    downloadTBX,
    loadTBX,
    renderGlossary,
    resetGlossary,
    showGlossaryEditorSection,
} from './glossary.js';
import { initIdiomasProyecto } from './idiomas-proyecto.js';
import { alBuscarEnLosPaneles, alternarPaneles, initPaneles } from './paneles.js';
import {
    abrirFichaDeTermino,
    alGuardarUnTermino,
    fichaDeTerminoAbierta,
    initTerminoModal,
} from './termino-modal.js';
import { alInsertarTraduccion, initTerminoTarjeta } from './termino-tarjeta.js';
import { setLanguage, updateMainContentOffset } from './i18n.js';
import { makeModalDraggable } from './modals.js';
import { executeSaveProject, newProject, openProject, showSaveProjectModal } from './project.js';
import {
    findAndNavigate,
    navigateToSearchResult,
    replaceAllMatches,
    replaceCurrentMatch,
} from './search.js';
import {
    defaultShortcutConfig,
    handleShortcutAction,
    loadShortcuts,
    renderShortcutsUI,
} from './shortcuts.js';
import { initChangelog } from './changelog.js';
import { initQa, olvidarControlDeCalidad, repasarSiEstaAbierto } from './qa-ui.js';
import { initZonaSoltar } from './dropzone.js';
import { initRecientes } from './recents.js';
import { haySinGuardar, sincronizarCambios } from './persistencia.js';
import { guardarRecursos, hayRecursosSinGuardar } from './recursos.js';
import { marcadoZonaSoltar } from './dropzone.js';
import { state } from './state.js';
import { initTheme } from './theme.js';
import { updateStatsDisplay, updateUtilityButtonStates } from './stats.js';
import {
    downloadTMX,
    processTMXContent,
    resetTM,
    showTMEditorSection,
    tmSearch,
} from './tm.js';
import { translations } from './translations.js';

document.getElementById('undoBtn').addEventListener('click', () => {
    if (state.undoStack.length > 0) {
        state.poEntries = state.undoStack.pop();
        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState();
        showMessage(translations[state.currentLanguage]['undo_success']);
    } else {
        showMessage(translations[state.currentLanguage]['undo_empty']);
    }
});

document.addEventListener('keydown', (event) => {
    // Ignore keydown events if a modal is open or if the event originates from an input field not part of the main translation flow
    const activeElement = document.activeElement;
    const isModalOpen =
        !shortcutsModal.classList.contains('hidden') ||
        !findReplaceModal.classList.contains('hidden') ||
        !messageBox.classList.contains('hidden') ||
        !saveProjectModal.classList.contains('hidden') ||
        !backupModal.classList.contains('hidden') ||
        !restoreBackupModal.classList.contains('hidden') ||
        // El cuadro de idiomas sale nada más soltar un archivo, que es justo
        // cuando alguien puede tener todavía la mano en el teclado.
        !document.getElementById('idiomasModal').classList.contains('hidden') ||
        // La ficha de un término: se escribe dentro, así que los atajos del
        // editor no pueden estar escuchando.
        fichaDeTerminoAbierta();

    if (isModalOpen && activeElement.id !== 'findInput' && activeElement.id !== 'replaceInput') {
        // Exception for find/replace inputs inside their modal
        if (
            activeElement.closest('.modal') &&
            !activeElement.classList.contains('shortcut-input')
        ) {
            return;
        }
    }

    // Check if the event matches any configured shortcut
    for (const action in state.shortcutConfig) {
        const config = state.shortcutConfig[action];

        if (
            event.ctrlKey === config.ctrlKey &&
            event.altKey === config.altKey &&
            event.shiftKey === config.shiftKey &&
            event.key.toLowerCase() === config.key.toLowerCase()
        ) {
            event.preventDefault();
            handleShortcutAction(action, event.key);
            return;
        }
    }
});

messageClose.addEventListener('click', () => {
    messageBox.classList.add('hidden');
});

shortcutsBtn.addEventListener('click', () => {
    state.tempShortcutConfig = JSON.parse(JSON.stringify(state.shortcutConfig)); // Create a deep copy for editing
    renderShortcutsUI();
    shortcutsModal.classList.remove('hidden');
});

shortcutsCloseBtn.addEventListener('click', () => {
    shortcutsModal.classList.add('hidden');
});

findReplaceBtn.addEventListener('click', () => {
    findReplaceModal.classList.remove('hidden');
    findInput.focus();
});

findReplaceCloseBtn.addEventListener('click', () => {
    findReplaceModal.classList.add('hidden');
    state.findState.lastFound = null;
    const currentFocused = getCurrentFocusedIndex();
    if (currentFocused) {
        const targetTextarea = document.getElementById(
            `msgstr-${currentFocused.entryIndex}-${currentFocused.segmentIndex}`,
        );
        if (targetTextarea) {
            targetTextarea.setSelectionRange(
                targetTextarea.value.length,
                targetTextarea.value.length,
            );
        }
    }
});

findNextBtn.addEventListener('click', () => findAndNavigate(true));

findPrevBtn.addEventListener('click', () => findAndNavigate(false));

replaceBtn.addEventListener('click', replaceCurrentMatch);

replaceAllBtn.addEventListener('click', replaceAllMatches);

saveShortcutsBtn.addEventListener('click', () => {
    state.shortcutConfig = JSON.parse(JSON.stringify(state.tempShortcutConfig));
    localStorage.setItem('poandaShortcutConfig', JSON.stringify(state.shortcutConfig));
    showMessage(translations[state.currentLanguage]['shortcuts_saved']);
    shortcutsModal.classList.add('hidden');
});

resetShortcutsBtn.addEventListener('click', () => {
    state.tempShortcutConfig = JSON.parse(JSON.stringify(defaultShortcutConfig));
    renderShortcutsUI();
    showMessage(translations[state.currentLanguage]['shortcuts_reset']);
});

exportShortcutsBtn.addEventListener('click', () => {
    const jsonString = JSON.stringify(state.shortcutConfig, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poanda_shortcuts.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

importShortcutsBtn.addEventListener('click', () => {
    importShortcutsInput.click();
});

importShortcutsInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedConfig = JSON.parse(e.target.result);
            // Basic validation
            if (typeof importedConfig === 'object' && importedConfig.validateAndNext) {
                state.tempShortcutConfig = { ...defaultShortcutConfig, ...importedConfig };
                renderShortcutsUI();
                showMessage(translations[state.currentLanguage]['shortcuts_loaded']);
            } else {
                throw new Error('Invalid format');
            }
        } catch (error) {
            showMessage(translations[state.currentLanguage]['error_loading_shortcuts']);
            console.error('Error importing shortcuts:', error);
        } finally {
            importShortcutsInput.value = ''; // Reset file input
        }
    };
    reader.readAsText(file);
});

// La memoria y el glosario ya no se abren y se cierran cada uno por su lado:
// viven en la columna de la derecha, siempre a la vista mientras haya un archivo
// abierto. Lo único que queda en la barra es esconder la columna entera cuando
// hace falta ancho para traducir.
panelesBtn?.addEventListener('click', () => {
    alternarPaneles();
    updateUtilityButtonStates();
});

tmFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const content = await file.text();
        processTMXContent(content);
    }
});

if (dropArea) {
    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropArea.classList.add('border-red-500');
    });

    dropArea.addEventListener('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropArea.classList.remove('border-red-500');
    });

    dropArea.addEventListener('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropArea.classList.remove('border-red-500');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            // Un único camino de entrada para todos los formatos: el mismo que
            // usa el menú Archivo.
            await abrirArchivo(files[0]);
        }
    });
}

// Añadir un término abre su ficha, un cuadro propio con los cinco campos.
// Antes era un formulario metido en el panel: dos campos donde ahora hay cinco,
// y esos cinco no caben en media columna sin comerse la lista de términos.
document.getElementById('addTermToggleBtn')?.addEventListener('click', () => {
    abrirFichaDeTermino(null);
});

document.addEventListener('DOMContentLoaded', async () => {
    loadShortcuts(); // Load saved or default shortcuts

    // El par de idiomas del proyecto: el indicador de la barra y los tres
    // sitios desde los que se puede cambiar.
    initIdiomasProyecto();

    // La columna de consulta: tiradores, plegado y los iconos de sus paneles.
    // El buscador es uno solo y filtra las dos cosas a la vez.
    alBuscarEnLosPaneles(() => {
        tmSearch();
        renderGlossary();
    });
    initPaneles();

    // La ficha de un término y la tarjeta que la enseña al pasar el ratón por
    // una palabra resaltada del original.
    alGuardarUnTermino(alCambiarElGlosario);
    initTerminoModal();
    alInsertarTraduccion(insertarEnLaTraduccionActiva);
    alInsertarDesdeElGlosario(insertarEnLaTraduccionActiva);
    initTerminoTarjeta();
    initQa();

    document.getElementById('langEnBtn').addEventListener('click', () => setLanguage('en'));
    document.getElementById('langEsBtn').addEventListener('click', () => setLanguage('es'));

    newProjectBtn.addEventListener('click', newProject);
    saveProjectBtn.addEventListener('click', showSaveProjectModal);
    openProjectBtn.addEventListener('click', () => projectFileInput.click());
    projectFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        openProject(file);
    });

    saveProjectConfirmBtn.addEventListener('click', executeSaveProject);
    saveProjectCancelBtn.addEventListener('click', () => {
        saveProjectModal.classList.add('hidden');
    });

    restoreBackupBtn.addEventListener('click', () => restoreSession());
    discardBackupBtn.addEventListener('click', () => {
        clearBackup();
        restoreBackupModal.classList.add('hidden');
    });

    backupBtn.addEventListener('click', () => {
        updateBackupStatusUI();
        backupModal.classList.remove('hidden');
    });

    backupCloseBtn.addEventListener('click', () => {
        backupModal.classList.add('hidden');
    });

    loadLocalBackupBtn.addEventListener('click', () => {
        restoreSession();
        backupModal.classList.add('hidden');
    });

    deleteLocalBackupBtn.addEventListener('click', async () => {
        if (
            await showConfirm(
                translations[state.currentLanguage]['delete_local_backup_btn_confirm'],
            )
        ) {
            await clearBackup();
            showMessage(translations[state.currentLanguage]['backup_deleted']);
        }
    });

    saveBackupToDiskBtn.addEventListener('click', async () => {
        const backup = await loadBackup();
        if (backup) {
            const jsonString = JSON.stringify(backup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `poanda_backup_${new Date().toISOString().slice(0, 10)}.poanda-backup`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    loadBackupFromFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.id === 'currentSession' && data.poEntries) {
                    await restoreSession(data);
                    await saveBackup();
                    showMessage(translations[state.currentLanguage]['backup_loaded_from_file']);
                    backupModal.classList.add('hidden');
                } else {
                    throw new Error('Invalid backup file format.');
                }
            } catch (error) {
                showMessage(translations[state.currentLanguage]['error_loading_backup_file']);
                console.error('Error processing backup file:', error);
            } finally {
                loadBackupFromFileInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    // ADD LISTENERS FOR NEW FILE MENU ITEMS
    // --- MENÚ ARCHIVO ---
    // Una sola entrada para cargar (reparte por extensión) y otra para guardar
    // (en el formato en el que se cargó). Convertir a .mo solo se ve con un PO.
    const cargarArchivo = document.getElementById('loadFileBtn');
    const guardarArchivo = document.getElementById('saveFileBtn');
    const convertirAMo = document.getElementById('convertFileMoBtn');

    cargarArchivo?.addEventListener('click', (e) => {
        e.preventDefault();
        elegirYAbrirArchivo();
    });

    guardarArchivo?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!guardarArchivo.classList.contains('disabled-link')) {
            guardarArchivoActual();
        }
    });

    convertirAMo?.addEventListener('click', (e) => {
        e.preventDefault();
        // La misma pregunta que decide si la entrada se ve. Aquí se vuelve a
        // hacer porque esconder algo no es impedirlo: compilar un .txt como si
        // fuera un PO produce un .mo con basura dentro.
        if (hayUnPoAbierto()) {
            convertToMoModal.classList.remove('hidden');
        } else if (state.poEntries.length > 0) {
            showMessage(translations[state.currentLanguage]['convert_mo_solo_po']);
        } else {
            showMessage(translations[state.currentLanguage]['no_file_to_convert']);
        }
    });

    moConverterCloseBtn.addEventListener('click', () => {
        convertToMoModal.classList.add('hidden');
    });

    moConverterActionBtn.addEventListener('click', () => {
        try {
            const poContent = reconstructPo(state.poEntries);
            const messages = parsePoForMo(poContent);
            const moArrayBuffer = compileMo(messages);

            const blob = new Blob([moArrayBuffer], { type: 'application/octet-stream' });
            const outputFileName = state.currentFileName.replace(/\.po$/, '.mo');
            const link = document.createElement('a');

            link.href = URL.createObjectURL(blob);
            link.download = outputFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            showMessage(translations[state.currentLanguage]['mo_conversion_success']);
        } catch (error) {
            showMessage(translations[state.currentLanguage]['mo_conversion_error']);
            console.error('Error converting PO to MO:', error);
        } finally {
            convertToMoModal.classList.add('hidden');
        }
    });


    // Add event listeners for the new PO search bar
    poSearchInput.addEventListener('input', filterPOEntries);
    searchInOriginalCheckbox.addEventListener('change', filterPOEntries);
    searchInTranslationCheckbox.addEventListener('change', filterPOEntries);
    searchNextBtn.addEventListener('click', () => navigateToSearchResult(1));
    searchPrevBtn.addEventListener('click', () => navigateToSearchResult(-1));

    setLanguage(state.currentLanguage);

    resetGlossary();
    resetTM();

    statsBtn.addEventListener('click', () => {
        statsContainer.classList.toggle('show');
        updateUtilityButtonStates();
    });

    if (translationsContainer) {
        translationsContainer.innerHTML = marcadoZonaSoltar();
    }
    updateSaveButtonsState();
    if (poSearchContainer) poSearchContainer.classList.add('hidden');
    if (statsContainer) statsContainer.classList.remove('show');
    updateUtilityButtonStates();

    if (translationMemorySidebar) translationMemorySidebar.classList.remove('show-sidebar');

    updateMainContentOffset();
    updateSaveButtonsState();
    await checkForBackup();

    makeModalDraggable(document.getElementById('findReplaceModal'));
    makeModalDraggable(document.getElementById('changelogModal'));

    // --- BOTONES QUE ANTES USABAN onclick EN EL HTML ---
    // Con módulos ES las funciones ya no son globales, así que el HTML no
    // puede llamarlas por su nombre: hay que engancharlas desde aquí.
    const enganchar = (id, evento, accion) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(evento, accion);
    };

    enganchar('importTbxBtn', 'click', loadTBX);
    enganchar('downloadTbxBtn', 'click', downloadTBX);

    enganchar('downloadTmxBtn', 'click', downloadTMX);

    document.querySelectorAll('.ai-quick-btn[data-ai-action]').forEach((btn) => {
        btn.addEventListener('click', () => triggerQuickAI(btn.dataset.aiAction));
    });

    initZonaSoltar(elegirYAbrirArchivo);

    initEtiquetas();

    initRecientes();

    initChangelog();

    initTheme();

    // El saludo del asistente, en el idioma que toque y diciendo lo que toca:
    // si todavía no hay servicio ni clave, el panel de ajustes se abre solo.
    prepararPanelDeIA();

    // Cada diez segundos se guardan las dos cosas: los segmentos que hayan
    // cambiado en el proyecto (escritura pequeña) y la copia de seguridad
    // completa de la sesión. La segunda sigue ahí a propósito mientras el
    // modelo de proyectos se termina de asentar: es la red por si algo falla.
    setInterval(() => {
        sincronizarCambios();
        guardarRecursos();
        saveBackup();
    }, 10000);

    // AVISO AL CERRAR
    //
    // El guardado va cada diez segundos, así que cerrar la pestaña sin querer
    // se llevaba por delante lo último escrito sin decir absolutamente nada.
    // Ahora el navegador pregunta, y solo cuando hay algo que perder de verdad.
    //
    // Dos cuidados: aquí no se puede esperar a nada (el navegador no da tiempo
    // a una escritura asíncrona), por eso haySinGuardar() compara en memoria; y
    // el texto del aviso lo pone el navegador, no nosotros — desde 2016 ninguno
    // enseña el mensaje de la página, así que basta con decir que sí hay algo.
    window.addEventListener('beforeunload', (evento) => {
        if (!haySinGuardar() && !hayRecursosSinGuardar()) return;
        // Se intenta guardar igualmente: en la mayoría de los casos da tiempo,
        // y si el usuario decide salir, al menos queda escrito.
        sincronizarCambios();
        guardarRecursos();
        saveBackup();
        evento.preventDefault();
        // Firefox y los navegadores antiguos piden esto además de preventDefault.
        evento.returnValue = '';
        return '';
    });
});

if (aiBtn) {
    aiBtn.addEventListener('click', () => {
        const isOpening = !aiSidebar.classList.contains('show-sidebar');

        if (isOpening) {
            aiSidebar.classList.add('show-sidebar');
            // Cerrar TM si está abierta
            if (translationMemorySidebar) translationMemorySidebar.classList.remove('show-sidebar');

            // Sin servicio ni clave no hay asistente que valga: se abre el panel
            // de ajustes y se pinta con lo que haya guardado (que puede haber
            // cambiado desde otra pestaña), en vez de dejar un cuadro de chat
            // que solo va a contestar con un error.
            const faltaConfigurar = prepararPanelDeIA();
            if (faltaConfigurar) pintarAjustesDeIA();

            // FOCO AL CHAT (Pequeño retardo para dar tiempo a la animación CSS)
            setTimeout(() => {
                if (faltaConfigurar) document.getElementById('aiProveedor')?.focus();
                else if (aiUserInput) aiUserInput.focus();
            }, 50);
        } else {
            aiSidebar.classList.remove('show-sidebar');

            // FOCO DE VUELTA AL SEGMENTO
            if (state.lastFocusedSegment) {
                navigateToTranslation(
                    state.lastFocusedSegment.entryIndex,
                    state.lastFocusedSegment.segmentIndex,
                );
            }
        }
        updateMainContentOffset();
        updateUtilityButtonStates();
    });
}

if (closeAiSidebarBtn) {
    closeAiSidebarBtn.addEventListener('click', () => {
        aiSidebar.classList.remove('show-sidebar');
        updateMainContentOffset();
        updateUtilityButtonStates();
    });
}

if (aiConfigToggleBtn) {
    aiConfigToggleBtn.addEventListener('click', () => {
        aiConfigPanel.classList.toggle('hidden');
        // Se vuelve a pintar cada vez que se abre: la clave y el modelo pueden
        // haber cambiado desde otra pestaña.
        pintarAjustesDeIA();
    });
}

// El panel de ajustes (servicio, clave, modelo y probar la conexión) se
// gobierna desde su propio módulo; ver ia-ajustes-ui.js.
initAjustesDeIA();

// Pretraducir el archivo entero, desde el menú Herramientas.
initPretraducir();

if (aiSendBtn) aiSendBtn.addEventListener('click', handleAiSend);

if (aiUserInput)
    aiUserInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAiSend();
        }
    });
