/**
 * Lista de proyectos recientes.
 *
 * Poanda guarda en el navegador los últimos archivos abiertos, con sus
 * traducciones. Esta ventana permite volver a cualquiera de ellos sin tener que
 * buscar el archivo original ni empezar de cero.
 *
 * Lo que se ve aquí sale de la base de datos, no de la sesión en curso: aunque
 * cierres el navegador y vuelvas mañana, tus proyectos siguen estando.
 */
import { showConfirm, showLoadingOverlay, hideLoadingOverlay, showMessage } from './dialogs.js';
import { renderTranslations } from './editor.js';
import { updateSaveButtonsState } from './files.js';
import { showGlossaryEditorSection } from './glossary.js';
import { adoptarProyecto, sincronizarCambios } from './persistencia.js';
import { abrirProyecto, borrarProyecto, listarRecientes, progresoDe } from './projects.js';
import { guardarRecursos, ponerRecursosDelProyecto } from './recursos.js';
import { recuperarIdiomasDelProyecto } from './idiomas-proyecto.js';
import { state } from './state.js';
import { updateStatsDisplay } from './stats.js';
import { showTMEditorSection } from './tm.js';
import { translations } from './translations.js';

const t = (clave) => translations[state.currentLanguage][clave] || clave;

/**
 * Escribe una fecha en el formato del idioma activo.
 * @param {number} marca Milisegundos.
 * @returns {string}
 */
function fecha(marca) {
    if (!marca) return '';
    return new Date(marca).toLocaleString(state.currentLanguage === 'es' ? 'es-ES' : 'en-GB');
}

/**
 * Dibuja la lista de proyectos recientes dentro de la ventana.
 * @returns {Promise<void>}
 */
export async function renderRecientes() {
    const lista = document.getElementById('recentProjectsList');
    const vacio = document.getElementById('recentProjectsEmpty');
    if (!lista || !vacio) return;

    lista.innerHTML = '';
    const proyectos = await listarRecientes();

    if (proyectos.length === 0) {
        vacio.classList.remove('hidden');
        return;
    }
    vacio.classList.add('hidden');

    for (const proyecto of proyectos) {
        const { total, traducidos } = await progresoDe(proyecto.id);
        const porcentaje = total > 0 ? Math.round((traducidos / total) * 100) : 0;
        const esElAbierto = proyecto.id === state.projectId;

        const fila = document.createElement('div');
        fila.className = 'recent-project';
        fila.dataset.projectId = String(proyecto.id);
        fila.innerHTML = `
            <div class="recent-project-info">
                <div class="recent-project-name">${proyecto.fileName}</div>
                <div class="recent-project-meta">
                    <span class="recent-project-format">${(proyecto.format || '').toUpperCase()}</span>
                    <span>${traducidos}/${total} ${t('recent_projects_progress')} (${porcentaje}%)</span>
                    <span>${fecha(proyecto.lastModified)}</span>
                </div>
            </div>
            <div class="recent-project-actions">
                <button class="recent-project-open btn-modal-primary" ${esElAbierto ? 'disabled' : ''}>
                    ${t('recent_projects_open')}
                </button>
                <button class="recent-project-delete btn-modal-neutral">
                    ${t('recent_projects_delete')}
                </button>
            </div>
        `;

        fila.querySelector('.recent-project-open').addEventListener('click', () =>
            abrirDesdeRecientes(proyecto.id),
        );
        fila.querySelector('.recent-project-delete').addEventListener('click', () =>
            quitarDeRecientes(proyecto.id),
        );

        lista.appendChild(fila);
    }
}

/**
 * Carga en el editor un proyecto de la lista.
 *
 * Antes de cambiar, guarda lo que haya pendiente del proyecto actual: si no,
 * los últimos segundos de trabajo se perderían al saltar de uno a otro.
 *
 * @param {number} projectId
 * @returns {Promise<void>}
 */
export async function abrirDesdeRecientes(projectId) {
    if (state.projectId && state.projectId !== projectId) {
        if (!(await showConfirm(t('recent_projects_switch_confirm')))) return;
        await sincronizarCambios();
        await guardarRecursos();
    }

    showLoadingOverlay(t('loading_project'));
    try {
        const proyecto = await abrirProyecto(projectId);
        if (!proyecto) {
            showMessage(t('recent_projects_empty'));
            return;
        }

        state.currentFileName = proyecto.fileName;
        state.currentFileType = proyecto.format || 'po';
        state.currentRawHtml = proyecto.rawHtml || '';
        state.contenidoOriginal = proyecto.contenidoOriginal || proyecto.rawHtml || '';

        state.poEntries = proyecto.entradas;
        adoptarProyecto(projectId);
        // La memoria y el glosario de ESTE proyecto, no los del anterior.
        await ponerRecursosDelProyecto(projectId);

        renderTranslations(state.poEntries);
        updateStatsDisplay();
        updateSaveButtonsState();

        // El par de idiomas del proyecto. A los proyectos guardados antes de
        // que el par existiera se les pregunta una vez y se les queda puesto.
        await recuperarIdiomasDelProyecto(proyecto);
        showGlossaryEditorSection();
        showTMEditorSection();

        cerrarVentana();
    } catch (error) {
        console.error('No se ha podido abrir el proyecto:', error);
        showMessage(t('error_loading_project') || 'Error');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Quita un proyecto de la lista y borra sus datos del navegador.
 *
 * No toca el archivo original del ordenador de quien traduce.
 *
 * @param {number} projectId
 * @returns {Promise<void>}
 */
export async function quitarDeRecientes(projectId) {
    if (!(await showConfirm(t('recent_projects_delete_confirm')))) return;

    await borrarProyecto(projectId);
    if (state.projectId === projectId) state.projectId = null;
    await renderRecientes();
}

/** Cierra la ventana de proyectos recientes. */
function cerrarVentana() {
    document.getElementById('recentProjectsModal')?.classList.add('hidden');
}

/** Engancha la entrada del menú Proyecto y el botón de cerrar. */
export function initRecientes() {
    const abrir = document.getElementById('recentProjectsBtn');
    const cerrar = document.getElementById('recentProjectsCloseBtn');
    const modal = document.getElementById('recentProjectsModal');
    if (!abrir || !modal) return;

    abrir.addEventListener('click', async (evento) => {
        evento.preventDefault();
        // Se guarda lo pendiente antes de mirar la lista, para que el avance
        // que se muestra sea el de verdad y no el de hace diez segundos. Y con
        // él la memoria y el glosario: desde esta ventana se cambia de
        // proyecto, y lo que no esté escrito al salir ya no vuelve.
        await sincronizarCambios();
        await guardarRecursos();
        await renderRecientes();
        modal.classList.remove('hidden');
    });

    cerrar?.addEventListener('click', cerrarVentana);
}
