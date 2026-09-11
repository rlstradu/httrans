/**
 * La ficha de un término del glosario, en su propio cuadro.
 *
 * Un término ya no es un par de palabras: lleva categoría gramatical,
 * definición y notas, que es lo que distingue un glosario de una lista de
 * equivalencias. Esos cinco campos no caben en media columna sin comerse la
 * lista de términos, así que se rellenan aquí.
 *
 * El mismo cuadro crea y corrige. Antes, para arreglar una errata en un término
 * había que borrarlo y volver a escribirlo entero.
 */
import { CATEGORIAS, normalizarTermino } from './core/tbx.js';
import { state } from './state.js';
import { translations } from './translations.js';

/** Lo que se está editando: el índice en el glosario, o null si es nuevo. */
let editando = null;

/** Lo que hay que hacer cuando el glosario cambia (lo pone glossary.js). */
let alCambiar = () => {};

const $ = (id) => document.getElementById(id);

/** Dice qué hacer después de guardar o borrar un término. */
export function alGuardarUnTermino(funcion) {
    alCambiar = funcion;
}

/** Rellena el desplegable de categorías en el idioma de la interfaz. */
function pintarCategorias(valor) {
    const select = $('terminoCategoria');
    if (!select) return;
    const t = translations[state.currentLanguage] || {};
    const opciones = [['', t.pos_none || '(not set)']].concat(
        CATEGORIAS.map((c) => [c, t[`pos_${c}`] || c]),
    );
    select.innerHTML = opciones
        .map(([v, nombre]) => `<option value="${v}">${nombre}</option>`)
        .join('');
    select.value = opciones.some(([v]) => v === valor) ? valor : '';
}

function pintarError(clave) {
    const hueco = $('terminoError');
    if (!hueco) return;
    hueco.textContent = clave ? translations[state.currentLanguage][clave] || clave : '';
}

/**
 * Abre la ficha.
 *
 * @param {number|null} indice Posición en el glosario, o null para uno nuevo.
 * @param {{origen?: string}} [previo] Texto con el que llegar rellenado.
 */
export function abrirFichaDeTermino(indice = null, previo = {}) {
    const modal = $('terminoModal');
    if (!modal) return;

    editando = Number.isInteger(indice) ? indice : null;
    const t = translations[state.currentLanguage] || {};
    const datos =
        editando === null
            ? normalizarTermino({ srcTerm: previo.origen || '' })
            : normalizarTermino(state.glossary[editando]);

    $('terminoModalTitulo').textContent =
        editando === null ? t.add_term_title || 'Add Term' : t.edit_term_title || 'Edit Term';
    $('terminoOrigen').value = datos.srcTerm;
    $('terminoDestino').value = datos.tgtTerm;
    pintarCategorias(datos.srcPartOfSpeech);
    $('terminoDefinicion').value = datos.definition;
    $('terminoNotas').value = datos.notes;
    pintarError('');
    // Borrar solo tiene sentido sobre algo que ya existe.
    $('terminoBorrarBtn')?.classList.toggle('hidden', editando === null);

    modal.classList.remove('hidden');
    // Al crear, el cursor va al primer campo vacío: si el término ya viene
    // puesto (se abrió desde una palabra del texto), lo que falta es la
    // traducción.
    const primero = editando === null && datos.srcTerm ? 'terminoDestino' : 'terminoOrigen';
    $(primero)?.focus();
    $(primero)?.select();
}

export function cerrarFichaDeTermino() {
    $('terminoModal')?.classList.add('hidden');
    editando = null;
}

/** ¿Está abierta? Lo pregunta el guardián de los atajos de teclado. */
export function fichaDeTerminoAbierta() {
    return !$('terminoModal')?.classList.contains('hidden');
}

function guardar() {
    const origen = $('terminoOrigen').value.trim();
    const destino = $('terminoDestino').value.trim();
    if (!origen || !destino) {
        pintarError('both_terms_required');
        $(origen ? 'terminoDestino' : 'terminoOrigen')?.focus();
        return;
    }

    const ficha = normalizarTermino({
        // Los idiomas los pone el proyecto, igual que en la memoria: aquí no se
        // vuelve a preguntar algo que ya se decidió al abrir el archivo.
        srcLang: state.sourceLang,
        tgtLang: state.targetLang,
        srcTerm: origen,
        tgtTerm: destino,
        srcPartOfSpeech: $('terminoCategoria').value,
        // Lo que traía el término y esta ficha no edita (la categoría del lado
        // traducido, que llega de archivos de otras herramientas) se conserva.
        tgtPartOfSpeech:
            editando === null ? '' : state.glossary[editando]?.tgtPartOfSpeech || '',
        definition: $('terminoDefinicion').value,
        notes: $('terminoNotas').value,
    });

    if (editando === null) state.glossary.push(ficha);
    else state.glossary[editando] = ficha;

    cerrarFichaDeTermino();
    alCambiar();
}

function borrar() {
    if (editando === null) return;
    state.glossary.splice(editando, 1);
    cerrarFichaDeTermino();
    alCambiar();
}

export function initTerminoModal() {
    $('terminoGuardarBtn')?.addEventListener('click', guardar);
    $('terminoBorrarBtn')?.addEventListener('click', borrar);
    $('terminoCancelarBtn')?.addEventListener('click', cerrarFichaDeTermino);

    // Enter guarda desde cualquiera de los dos campos de una línea; en las
    // notas y la definición no, que ahí un salto de línea es texto.
    ['terminoOrigen', 'terminoDestino'].forEach((id) => {
        $(id)?.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') {
                evento.preventDefault();
                guardar();
            }
        });
    });

    $('terminoModal')?.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') {
            evento.preventDefault();
            cerrarFichaDeTermino();
        }
    });
}
