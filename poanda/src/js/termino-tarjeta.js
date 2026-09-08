/**
 * La tarjeta que sale al pasar el ratón por un término del glosario.
 *
 * En el texto original, las palabras que están en el glosario salen marcadas en
 * amarillo. Ese amarillo dice "de esto hay algo decidido", pero no dice el qué:
 * para verlo había que ir a buscarlo a la lista del panel. La tarjeta lo trae
 * al sitio donde se está mirando —la traducción, la categoría, la definición y
 * las notas— y trae también el botón para meter la traducción en el segmento,
 * que es lo que se acaba haciendo con ella.
 *
 * Vive suelta al final de la página, no dentro del segmento: dentro se la
 * comería el recorte del texto original en cuanto asomara por el borde.
 */
import { escaparHtml } from './core/xml.js';
import { state } from './state.js';
import { translations } from './translations.js';

/** Cuánto se espera antes de esconderla, para poder llegar hasta ella. */
const MARGEN_PARA_LLEGAR = 180;

let tarjeta = null;
let temporizador = null;
let terminoALaVista = null;
/** Lo que hay que hacer al pulsar "Insertar traducción" (lo pone main.js). */
let alInsertar = () => false;

export function alInsertarTraduccion(funcion) {
    alInsertar = funcion;
}

/** Todas las fichas del glosario para una palabra: puede haber más de una. */
function fichasDe(termino) {
    const buscado = termino.toLowerCase();
    return state.glossary.filter((e) => (e.srcTerm || '').toLowerCase() === buscado);
}

function pintar(fichas) {
    const t = translations[state.currentLanguage] || {};
    const linea = (etiqueta, valor) =>
        valor
            ? `<p class="termino-tarjeta-dato"><span>${escaparHtml(etiqueta)}</span> ${escaparHtml(valor)}</p>`
            : '';

    return fichas
        .map((ficha) => {
            const categoria = ficha.srcPartOfSpeech
                ? `<span class="termino-tarjeta-categoria">${escaparHtml(
                      t[`pos_${ficha.srcPartOfSpeech}`] || ficha.srcPartOfSpeech,
                  )}</span>`
                : '';
            return `
                <div class="termino-tarjeta-ficha">
                    <p class="termino-tarjeta-traduccion">
                        <span>${escaparHtml(ficha.tgtTerm || '')}</span>${categoria}
                    </p>
                    ${linea(t.definition || 'Definition:', ficha.definition)}
                    ${linea(t.notes || 'Notes:', ficha.notes)}
                    <button type="button" class="termino-tarjeta-insertar"
                            data-insertar="${escaparHtml(ficha.tgtTerm || '')}"
                            title="${escaparHtml(t.term_card_insert_hint || '')}">
                        ${escaparHtml(t.term_card_insert || 'Insert translation')}
                    </button>
                </div>`;
        })
        .join('');
}

/** La coloca junto a la palabra, sin salirse de la ventana. */
function colocar(sobre) {
    const palabra = sobre.getBoundingClientRect();
    const suya = tarjeta.getBoundingClientRect();
    const margen = 8;

    let izquierda = palabra.left;
    if (izquierda + suya.width > window.innerWidth - margen) {
        izquierda = window.innerWidth - suya.width - margen;
    }
    if (izquierda < margen) izquierda = margen;

    // Debajo de la palabra; si abajo no cabe, encima.
    let arriba = palabra.bottom + 6;
    if (arriba + suya.height > window.innerHeight - margen) {
        arriba = palabra.top - suya.height - 6;
    }
    if (arriba < margen) arriba = margen;

    tarjeta.style.left = `${Math.round(izquierda)}px`;
    tarjeta.style.top = `${Math.round(arriba)}px`;
}

export function mostrarTarjeta(marca) {
    if (!tarjeta) return;
    const termino = marca.dataset.termino;
    if (!termino) return;

    const fichas = fichasDe(termino);
    if (fichas.length === 0) return;

    clearTimeout(temporizador);
    terminoALaVista = termino;
    tarjeta.innerHTML = pintar(fichas);
    tarjeta.classList.remove('hidden');
    tarjeta.setAttribute('aria-hidden', 'false');
    colocar(marca);
}

export function esconderTarjeta({ enseguida = false } = {}) {
    if (!tarjeta) return;
    clearTimeout(temporizador);
    const apagar = () => {
        tarjeta.classList.add('hidden');
        tarjeta.setAttribute('aria-hidden', 'true');
        terminoALaVista = null;
    };
    if (enseguida) apagar();
    // Se espera un momento: entre la palabra y la tarjeta hay un hueco, y si
    // desapareciera al salir de la palabra no habría manera de llegar al botón.
    else temporizador = setTimeout(apagar, MARGEN_PARA_LLEGAR);
}

/** ¿De qué término es la tarjeta que está a la vista? (para los tests) */
export function terminoDeLaTarjeta() {
    return terminoALaVista;
}

export function initTerminoTarjeta() {
    tarjeta = document.getElementById('terminoTarjeta');
    if (!tarjeta) return;

    // Un solo oyente para todo el editor: los resaltados se crean y se
    // destruyen cada vez que se repinta un segmento, así que engancharse a cada
    // uno sería engancharse a algo que ya no existe.
    const editor = document.getElementById('translationsContainer') || document;

    editor.addEventListener('mouseover', (evento) => {
        const marca = evento.target.closest?.('.glossary-highlight');
        if (marca) mostrarTarjeta(marca);
    });
    editor.addEventListener('mouseout', (evento) => {
        if (evento.target.closest?.('.glossary-highlight')) esconderTarjeta();
    });
    // Con el teclado: al llegar a la palabra tabulando también se ve la ficha.
    editor.addEventListener('focusin', (evento) => {
        const marca = evento.target.closest?.('.glossary-highlight');
        if (marca) mostrarTarjeta(marca);
    });
    editor.addEventListener('focusout', (evento) => {
        if (evento.target.closest?.('.glossary-highlight')) esconderTarjeta();
    });

    // Mientras el ratón esté sobre la tarjeta, la tarjeta se queda.
    tarjeta.addEventListener('mouseenter', () => clearTimeout(temporizador));
    tarjeta.addEventListener('mouseleave', () => esconderTarjeta());

    tarjeta.addEventListener('click', (evento) => {
        const boton = evento.target.closest('.termino-tarjeta-insertar');
        if (!boton) return;
        alInsertar(boton.dataset.insertar || '');
        esconderTarjeta({ enseguida: true });
    });

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') esconderTarjeta({ enseguida: true });
    });
    // Al mover la página, la tarjeta se quedaría flotando donde ya no hay nada.
    window.addEventListener('scroll', () => esconderTarjeta({ enseguida: true }), true);
}
