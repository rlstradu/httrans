/**
 * Los proyectos recientes.
 *
 * La misma ventana que Poanda. subpandaTM ya guardaba cada archivo abierto en
 * el navegador —una fila por archivo, con sus subtítulos, sus idiomas y sus
 * ajustes de QA—, pero lo único que se veía de todo eso era el desplegable del
 * cuadro de copia de seguridad, que hay que saber que está ahí y que se llama
 * como si fuera un rescate de emergencia. Volver al encargo de ayer no es un
 * rescate, es lo que se hace cada mañana.
 *
 * Lo que se lista sale de la base de datos del navegador, no de la sesión: se
 * puede cerrar el navegador y volver mañana. Y borrar de aquí borra la copia
 * guardada, nunca el archivo .srt del ordenador de quien traduce.
 *
 * Este módulo no sabe abrir un proyecto ni contar subtítulos: eso vive en
 * app.js, junto al editor, y llega por `initRecientes` en forma de funciones.
 * Así la ventana se puede leer entera sin saber cómo está montado el editor.
 */
import { state } from './state.js';
import { translations } from './translations.js';

const t = (clave) => translations[state.currentLanguage][clave] || clave;
const $ = (id) => document.getElementById(id);

/**
 * Lo que pone app.js al arrancar.
 *
 * `confirmar` también viene de allí: el cuadro de sí o no de la herramienta se
 * monta en app.js, y AGENTS.md §5 prohíbe el confirm() del navegador.
 * @type {{listar: Function, abrir: Function, borrar: Function, confirmar: Function}|null}
 */
let puente = null;

/**
 * Escribe una fecha en el formato del idioma que esté puesto.
 *
 * @param {number|Date} marca
 * @returns {string}
 */
function fecha(marca) {
    if (!marca) return '';
    const cuando = marca instanceof Date ? marca : new Date(marca);
    if (Number.isNaN(cuando.getTime())) return '';
    return cuando.toLocaleString(state.currentLanguage === 'es' ? 'es-ES' : 'en-GB');
}

/** Dibuja la lista. */
async function pintar() {
    const lista = $('recentProjectsList');
    const vacio = $('recentProjectsEmpty');
    if (!lista || !vacio || !puente) return;

    lista.innerHTML = '';
    const proyectos = await puente.listar();

    vacio.classList.toggle('hidden', proyectos.length > 0);

    for (const proyecto of proyectos) {
        const { total, traducidos } = proyecto.progreso;
        const porcentaje = total > 0 ? Math.round((traducidos / total) * 100) : 0;
        // El que está abierto se enseña igual, pero sin el botón de abrir: verlo
        // en la lista es lo que dice dónde estás.
        const esElAbierto = proyecto.id === state.projectId;

        const fila = document.createElement('div');
        fila.className = 'reciente';
        fila.dataset.projectId = String(proyecto.id);

        const info = document.createElement('div');
        info.className = 'reciente-info';

        const nombre = document.createElement('div');
        nombre.className = 'reciente-nombre';
        // textContent y no innerHTML: el nombre lo pone el archivo de un
        // cliente, y un archivo no debería poder escribir en la página.
        nombre.textContent = proyecto.fileName;
        info.appendChild(nombre);

        const meta = document.createElement('div');
        meta.className = 'reciente-meta';
        const par = [proyecto.sourceLang, proyecto.targetLang].filter(Boolean).join(' → ');
        for (const dato of [
            par,
            `${traducidos}/${total} ${t('recent_projects_progress')} (${porcentaje}%)`,
            fecha(proyecto.lastModified),
        ]) {
            if (!dato) continue;
            const trozo = document.createElement('span');
            trozo.textContent = dato;
            meta.appendChild(trozo);
        }
        info.appendChild(meta);
        fila.appendChild(info);

        const acciones = document.createElement('div');
        acciones.className = 'reciente-acciones';

        const abrir = document.createElement('button');
        abrir.type = 'button';
        abrir.className = 'segmento-boton segmento-boton-principal';
        abrir.textContent = esElAbierto ? t('recent_projects_current') : t('recent_projects_open');
        abrir.disabled = esElAbierto;
        abrir.addEventListener('click', () => abrirUno(proyecto.id));
        acciones.appendChild(abrir);

        const borrar = document.createElement('button');
        borrar.type = 'button';
        borrar.className = 'segmento-boton';
        borrar.textContent = t('recent_projects_delete');
        borrar.addEventListener('click', () => quitarUno(proyecto.id));
        acciones.appendChild(borrar);

        fila.appendChild(acciones);
        lista.appendChild(fila);
    }
}

/**
 * Abre uno de la lista.
 *
 * Se pregunta antes si ya hay otro abierto: cambiar de proyecto deja fuera lo
 * que se estuviera haciendo, y eso no se hace de un clic sin avisar.
 *
 * @param {number} projectId
 */
async function abrirUno(projectId) {
    if (state.projectId && state.projectId !== projectId) {
        if (!(await puente.confirmar(t('recent_projects_switch_confirm')))) return;
    }

    await puente.abrir(projectId);
    cerrar();
}

/**
 * Quita uno de la lista.
 *
 * Borra lo guardado en el navegador. El .srt del ordenador no se toca: esta
 * herramienta no ha tenido nunca permiso para escribir ahí.
 *
 * @param {number} projectId
 */
async function quitarUno(projectId) {
    if (!(await puente.confirmar(t('recent_projects_delete_confirm'), { peligro: true }))) return;

    await puente.borrar(projectId);
    await pintar();
}

/** Cierra la ventana. */
function cerrar() {
    $('recentProjectsModal')?.classList.add('hidden');
}

/** Abre la ventana con la lista al día. */
export async function abrirRecientes() {
    if (!puente) return;
    await pintar();
    $('recentProjectsModal')?.classList.remove('hidden');
}

/**
 * Engancha la ventana.
 *
 * @param {{listar: Function, abrir: Function, borrar: Function, confirmar: Function}} funciones
 */
export function initRecientes(funciones) {
    puente = funciones;

    $('recentProjectsBtn')?.addEventListener('click', (evento) => {
        evento.preventDefault();
        abrirRecientes();
    });
    $('recentProjectsCloseBtn')?.addEventListener('click', cerrar);
}
