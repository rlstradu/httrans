/**
 * La columna de consulta: la memoria arriba y el glosario abajo.
 *
 * Antes eran dos ventanas flotantes que se abrían encima del editor. Tapaban
 * justo el texto que hay que mirar para decidir si una coincidencia sirve, se
 * podían solapar entre ellas, y había que apartarlas a mano cada vez. Ahora son
 * dos recuadros en una columna a la derecha, los dos a la vista mientras se
 * traduce, y lo que se mueve es el reparto entre ellos.
 *
 * Lo que este módulo gobierna:
 *
 * - El **ancho** de la columna y el **reparto** de alto entre los dos paneles,
 *   arrastrando sus tiradores. Los dos se recuerdan: hay días de mucho glosario
 *   y días de mucha memoria, y volver a colocarlo todo cada mañana cansa.
 * - **Plegar** un panel con la equis de su cabecera, que deja el título a la
 *   vista y da el alto entero al otro. Cerrarlo del todo no tendría sentido: la
 *   columna está siempre ahí mientras haya un archivo abierto.
 * - **Ocultar la columna entera**, para cuando lo que hace falta es ancho para
 *   traducir.
 */
import {
    anadirIconSVG,
    exportIconSVG,
    idiomaIconSVG,
    importIconSVG,
    lupaIconSVG,
    plegarIconSVG,
} from './icons.js';
import { state } from './state.js';

const $ = (id) => document.getElementById(id);

/**
 * Qué hacer cuando se escribe en el buscador.
 *
 * Lo pone main.js al arrancar: este módulo no conoce ni la memoria ni el
 * glosario, y no tiene por qué.
 * @type {(() => void)|null}
 */
let alBuscar = null;

/** @param {() => void} funcion */
export function alBuscarEnLosPaneles(funcion) {
    alBuscar = funcion;
}

const ANCHO = 'subpandatm_ancho_paneles';
/**
 * El ancho de la columna cuando lo que se ve es el PandaBot.
 *
 * Se recuerda aparte porque lo que pide es otra cosa: la memoria y el glosario
 * son fichas cortas y se leen bien en media columna, y una conversación en media
 * columna sale en renglones de cinco palabras. Con un solo ancho, ensanchar para
 * hablar con la IA dejaba media pantalla de tarjetas casi vacías al volver.
 */
const ANCHO_IA = 'subpandatm_ancho_paneles_ia';
const REPARTO = 'subpandatm_reparto_paneles';
const OCULTOS = 'subpandatm_paneles_ocultos';
/** Cuánto alto se lleva la lista de comprobaciones dentro de la pestaña de QA. */
const REPARTO_QA = 'subpandatm_reparto_qa';
const AVISO_CERRADO = 'subpandatm_aviso_paneles_cerrado';

/** Lo que se deja arrastrar el ancho de la columna, en píxeles. */
const ANCHO_MINIMO = 260;
const ANCHO_MAXIMO = 640;

/**
 * El reparto va de 0,3 a 1,7: es la fracción que se lleva la memoria de un
 * total de 2. En 1 están a partes iguales; en los extremos, uno de los dos se
 * queda con poco más que su cabecera y sus botones, que es hasta donde tiene
 * sentido llegar sin plegarlo del todo.
 */
const REPARTO_MINIMO = 0.3;
const REPARTO_MAXIMO = 1.7;

/**
 * Lo que se lleva la lista de comprobaciones de la pestaña de QA, en tanto por
 * ciento del alto de la pestaña.
 *
 * De partida se lleva menos de la mitad, porque lo que se mira mientras se
 * repasa es la lista de errores. Pero se puede subir hasta casi todo: las
 * diecinueve comprobaciones con su explicación no caben en un tercio de
 * columna, y encenderlas y apagarlas con dos a la vista es incómodo.
 */
const QA_MINIMO = 12;
const QA_MAXIMO = 80;
const QA_POR_DEFECTO = 45;

const leer = (clave, porDefecto) => {
    try {
        const valor = localStorage.getItem(clave);
        return valor === null ? porDefecto : valor;
    } catch {
        return porDefecto;
    }
};

const escribir = (clave, valor) => {
    try {
        localStorage.setItem(clave, String(valor));
    } catch {
        // Un navegador con el almacenamiento capado sigue pudiendo traducir;
        // lo único que pasa es que no recuerda dónde se dejaron las rayas.
    }
};

const entre = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/** Qué pestaña de la columna se está viendo, para saber qué ancho toca. */
let pestanaALaVista = 'paneles';

/** La clave del ancho de la pestaña que se esté viendo. */
const claveDelAncho = () => (pestanaALaVista === 'ia' ? ANCHO_IA : ANCHO);

/** El ancho de partida de cada pestaña, en píxeles. */
const anchoPorDefecto = () => (pestanaALaVista === 'ia' ? 440 : 340);

/** Deja el ancho y el reparto guardados aplicados a la columna. */
function aplicarMedidas() {
    const columna = $('panelesDerecha');
    if (!columna) return;

    const porDefecto = anchoPorDefecto();
    const ancho = entre(
        Number(leer(claveDelAncho(), porDefecto)) || porDefecto,
        ANCHO_MINIMO,
        ANCHO_MAXIMO,
    );
    const reparto = entre(Number(leer(REPARTO, 1)) || 1, REPARTO_MINIMO, REPARTO_MAXIMO);

    columna.style.setProperty('--ancho-paneles', `${ancho}px`);
    columna.style.setProperty('--reparto-paneles', String(reparto));

    const qa = entre(Number(leer(REPARTO_QA, QA_POR_DEFECTO)) || QA_POR_DEFECTO, QA_MINIMO, QA_MAXIMO);
    columna.style.setProperty('--reparto-qa', `${qa}%`);
}

/**
 * Engancha un tirador que se arrastra.
 *
 * Se escucha en el documento y no en el propio tirador porque el ratón se sale
 * de una raya de tres píxeles en cuanto uno se mueve un poco deprisa, y el
 * arrastre se quedaba a medias. `setPointerCapture` haría lo mismo, pero esto
 * funciona igual con ratón, dedo y lápiz sin casos especiales.
 *
 * @param {HTMLElement} tirador
 * @param {(evento: PointerEvent) => void} alMover
 */
function arrastrable(tirador, alMover) {
    if (!tirador) return;

    tirador.addEventListener('pointerdown', (inicio) => {
        inicio.preventDefault();
        document.body.classList.add('arrastrando-tirador');

        const mover = (evento) => alMover(evento);
        const soltar = () => {
            document.body.classList.remove('arrastrando-tirador');
            document.removeEventListener('pointermove', mover);
            document.removeEventListener('pointerup', soltar);
            document.removeEventListener('pointercancel', soltar);
        };

        document.addEventListener('pointermove', mover);
        document.addEventListener('pointerup', soltar);
        document.addEventListener('pointercancel', soltar);
    });
}

/** Pliega o despliega un panel, y recuerda cuál de las dos cosas. */
function plegar(panel) {
    if (!panel) return;
    panel.classList.toggle('panel-plegado');
    escribir(`subpandatm_plegado_${panel.id}`, panel.classList.contains('panel-plegado') ? '1' : '');
}

/** Vuelve a dejar plegado lo que estuviera plegado la última vez. */
function recuperarPlegados() {
    for (const id of ['translationMemorySidebar', 'terminologySidebar']) {
        const panel = $(id);
        if (panel && leer(`subpandatm_plegado_${id}`, '') === '1') {
            panel.classList.add('panel-plegado');
        }
    }
}

/**
 * Enseña el aviso de que la memoria y el glosario están vacíos.
 *
 * Uno para las dos cosas, y no uno por panel: decían casi lo mismo y ocupaban
 * dos franjas de una columna donde el sitio escasea. Se cierra con su equis y no
 * vuelve: quien ya sabe cómo funciona esto no necesita que se lo repitan.
 */
export function avisarSiEstanVacios() {
    const aviso = $('panelesAviso');
    if (!aviso) return;

    const vacios =
        (state.translationMemory || []).length === 0 && (state.glossary || []).length === 0;
    aviso.classList.toggle('hidden', !vacios || leer(AVISO_CERRADO, '') === '1');
}

/** Enseña u oculta la columna entera. */
export function alternarPaneles() {
    const ocultos = document.body.classList.toggle('paneles-ocultos');
    guardarSiEstanOcultos();
    return !ocultos;
}

/**
 * Recuerda si la columna está escondida.
 *
 * Lo llama app.js, que es quien la abre y la cierra desde los botones de la
 * barra: quien la deja cerrada al salir espera encontrarla cerrada al volver.
 */
export function guardarSiEstanOcultos() {
    escribir(OCULTOS, document.body.classList.contains('paneles-ocultos') ? '1' : '');
}

/**
 * Engancha la columna: los tiradores, las equis y los iconos.
 */
export function initPaneles() {
    const columna = $('panelesDerecha');
    if (!columna) return;

    aplicarMedidas();
    recuperarPlegados();
    if (leer(OCULTOS, '') === '1') document.body.classList.add('paneles-ocultos');

    // Los iconos se ponen desde aquí y no en el HTML para no repetir el mismo
    // trozo de SVG en cuatro sitios.
    const iconos = {
        importTmxBtn: importIconSVG,
        downloadTmxBtn: exportIconSVG,
        importTbxBtn: importIconSVG,
        downloadTbxBtn: exportIconSVG,
        closeTranslationMemorySidebarBtn: plegarIconSVG,
        closeTerminologySidebarBtn: plegarIconSVG,
        addTermToggleBtn: anadirIconSVG,
    };
    // Los que no son botones: la lupa del buscador y el globo del par de
    // idiomas, uno en cada panel.
    for (const clase of ['paneles-buscador-lupa', 'par-del-proyecto-icono']) {
        const svg = clase === 'paneles-buscador-lupa' ? lupaIconSVG : idiomaIconSVG;
        document.querySelectorAll(`.${clase}`).forEach((hueco) => {
            hueco.innerHTML = svg;
        });
    }
    for (const [id, svg] of Object.entries(iconos)) {
        const boton = $(id);
        // En el de importar la memoria el icono va delante del campo de archivo
        // oculto, que tiene que seguir dentro de la etiqueta para que funcione.
        if (boton) boton.insertAdjacentHTML('afterbegin', svg);
    }

    // Cambiar de pestaña cambia el ancho: cada una recuerda el suyo. Lo avisa
    // app.js, que es quien lleva las pestañas.
    document.addEventListener('subpanda:pestana', (evento) => {
        pestanaALaVista = evento.detail;
        aplicarMedidas();
    });

    // El aviso de vacío y su equis.
    avisarSiEstanVacios();
    $('panelesAvisoCerrar')?.addEventListener('click', () => {
        $('panelesAviso')?.classList.add('hidden');
        escribir(AVISO_CERRADO, '1');
    });

    // Un solo buscador para los dos paneles: filtra la memoria y el glosario a
    // la vez, que es lo que uno quiere cuando busca una palabra.
    $('buscarPaneles')?.addEventListener('input', () => {
        alBuscar?.();
    });

    // El ancho: se mide desde el borde derecho de la ventana, porque la columna
    // está pegada a él. Arrastrar hacia la izquierda la hace más ancha.
    arrastrable($('tiradorAncho'), (evento) => {
        const ancho = entre(
            window.innerWidth - evento.clientX,
            ANCHO_MINIMO,
            Math.min(ANCHO_MAXIMO, window.innerWidth * 0.6),
        );
        columna.style.setProperty('--ancho-paneles', `${ancho}px`);
        escribir(claveDelAncho(), Math.round(ancho));
    });

    // El reparto: dónde cae el ratón dentro del alto que se reparten los dos
    // paneles, convertido en la fracción que se lleva la memoria.
    //
    // Se mide del borde de arriba de la memoria al de abajo del glosario, y no
    // la columna entera, porque en la columna hay más cosas: el buscador arriba
    // y el aviso del panda abajo. Midiendo sobre el total, esas dos franjas
    // entraban en la cuenta sin ser repartibles, y la raya se movía bastante
    // menos que el ratón: arrastrabas 140 px y bajaba 40. Así la raya va donde
    // va el dedo, que es lo único que se le pide.
    arrastrable($('tiradorReparto'), (evento) => {
        const memoria = $('translationMemorySidebar')?.getBoundingClientRect();
        const glosario = $('terminologySidebar')?.getBoundingClientRect();
        if (!memoria || !glosario) return;

        const alto = glosario.bottom - memoria.top;
        if (alto <= 0) return;

        const fraccion = (evento.clientY - memoria.top) / alto;
        const reparto = entre(fraccion * 2, REPARTO_MINIMO, REPARTO_MAXIMO);
        columna.style.setProperty('--reparto-paneles', String(reparto));
        escribir(REPARTO, reparto.toFixed(2));
    });

    // La raya de la pestaña de QA: reparte el alto entre las comprobaciones y
    // la lista de errores. Se mide sobre la propia pestaña y no sobre la
    // columna, que encima lleva la barra de pestañas.
    arrastrable($('tiradorQa'), (evento) => {
        const pestana = $('qaContainer')?.getBoundingClientRect();
        if (!pestana || pestana.height <= 0) return;

        const arriba = $('qaResumen')?.getBoundingClientRect().top ?? pestana.top;
        const alto = pestana.bottom - arriba;
        if (alto <= 0) return;

        const porciento = entre(((evento.clientY - arriba) / alto) * 100, QA_MINIMO, QA_MAXIMO);
        columna.style.setProperty('--reparto-qa', `${porciento}%`);
        escribir(REPARTO_QA, porciento.toFixed(0));
    });

    $('closeTranslationMemorySidebarBtn')?.addEventListener('click', () =>
        plegar($('translationMemorySidebar')),
    );
    $('closeTerminologySidebarBtn')?.addEventListener('click', () =>
        plegar($('terminologySidebar')),
    );
}
