/**
 * El par de idiomas del proyecto: de qué idioma a qué idioma va este archivo.
 *
 * Es un dato del proyecto, no de la memoria ni del glosario. Un archivo se
 * traduce en una dirección, y esa dirección la necesitan cuatro cosas a la vez:
 * la memoria (para saber qué unidades le sirven), el glosario (para saber qué
 * columna es el término y cuál la traducción), el asistente de IA (para saber
 * qué se le está pidiendo) y quien traduce (para no equivocarse de variante a
 * las tres de la mañana). Antes se configuraba dos veces, en dos sitios, y se
 * podían contradecir.
 *
 * Se elige al abrir el archivo, ya relleno con lo que el propio archivo declare,
 * y queda guardado con el proyecto. Se puede cambiar después desde la barra.
 */
import { db } from './db.js';
import { listaDeIdiomas, nombreDeIdioma, normalizarIdioma } from './core/idiomas.js';
import { state } from './state.js';
import { translations } from './translations.js';

const t = (clave) => translations[state.currentLanguage]?.[clave] || '';
const $ = (id) => document.getElementById(id);

/** Dónde se recuerda el último par usado, para no volver a elegirlo cada vez. */
const RECUERDO = 'subpandatm_par_idiomas';

/**
 * El último par que se usó, para dejar el cuadro relleno con algo razonable.
 *
 * Quien traduce trabaja casi siempre en la misma dirección: proponerle la de la
 * vez anterior acierta la mayoría de las veces y le ahorra dos desplegables.
 *
 * @returns {{origen: string, destino: string}}
 */
export function ultimoParUsado() {
    try {
        const guardado = JSON.parse(localStorage.getItem(RECUERDO) || '{}');
        return {
            origen: normalizarIdioma(guardado.origen) || '',
            destino: normalizarIdioma(guardado.destino) || '',
        };
    } catch {
        return { origen: '', destino: '' };
    }
}

/** Recuerda el par para la próxima vez. */
function recordarPar(origen, destino) {
    try {
        localStorage.setItem(RECUERDO, JSON.stringify({ origen, destino }));
    } catch {
        // Un navegador con el almacenamiento capado sigue pudiendo traducir.
    }
}

/**
 * Pone el par en el estado, lo guarda en el proyecto y repinta lo que lo enseña.
 *
 * @param {{origen: string, destino: string}} par
 * @param {{guardar?: boolean}} [opciones] `guardar: false` cuando todavía no
 *   existe el proyecto al que pertenece el par. Al abrir un archivo nuevo,
 *   state.projectId sigue apuntando al proyecto anterior durante un instante, y
 *   guardar ahí metería el par del archivo nuevo en el proyecto de antes.
 * @returns {Promise<void>}
 */
export async function fijarIdiomas({ origen, destino }, { guardar = true } = {}) {
    state.sourceLang = normalizarIdioma(origen);
    state.targetLang = normalizarIdioma(destino);
    recordarPar(state.sourceLang, state.targetLang);
    // Los tres sitios donde se ve el par, aunque estén cerrados: si el panel del
    // glosario se quedó abierto de antes, tiene que decir lo mismo que la barra.
    pintarParDeIdiomas();
    pintarParDelProyecto('glosarioParIdiomas');
    pintarParDelProyecto('memoriaParIdiomas');

    if (!guardar || !state.projectId) return;
    try {
        await db.projects.update(state.projectId, {
            sourceLang: state.sourceLang,
            targetLang: state.targetLang,
            lastModified: Date.now(),
        });
    } catch (error) {
        // Que no se pueda guardar el par no debe impedir traducir.
        console.error('No se ha podido guardar el par de idiomas del proyecto:', error);
    }
}

/**
 * Deja el indicador de la barra al día.
 *
 * Está siempre a la vista, y no escondido en un menú, porque es el dato que más
 * caro sale equivocar: media jornada traduciendo al portugués de Portugal un
 * encargo que era para Brasil no se arregla con un buscar y reemplazar.
 */
export function pintarParDeIdiomas() {
    const boton = $('parIdiomasBtn');
    const valor = $('parIdiomasValor');
    if (!boton || !valor) return;

    const idioma = state.currentLanguage;

    // Solo se reescribe el valor, no el botón entero: el título ("Idiomas del
    // proyecto") lo pone el traductor de la interfaz y reescribir el botón se
    // lo llevaría por delante.
    if (!state.sourceLang && !state.targetLang) {
        valor.textContent = t('lang_pair_unset') || '— → —';
        boton.title = t('lang_pair_title') || '';
        return;
    }

    const corto = (codigo) => (codigo ? codigo : '—');
    valor.textContent = `${corto(state.sourceLang)} → ${corto(state.targetLang)}`;
    boton.title = `${nombreDeIdioma(state.sourceLang, idioma) || '—'} → ${
        nombreDeIdioma(state.targetLang, idioma) || '—'
    }`;
}

/**
 * Escribe el par del proyecto en uno de los botoncitos que lo enseñan dentro
 * del glosario y de la memoria.
 *
 * Ahí sale con el nombre entero ("Inglés → Español de México") y no con el
 * código: en la barra hace falta que ocupe poco, pero en un panel donde se está
 * decidiendo si un término encaja, el nombre se lee sin descifrar nada.
 *
 * @param {string} id
 */
export function pintarParDelProyecto(id) {
    // El texto va en su propio span: al lado hay un globo terráqueo que hace de
    // etiqueta, y reescribir el botón entero se lo llevaría por delante.
    const texto = document.getElementById(`${id}Texto`);
    if (!texto) return;

    const idioma = state.currentLanguage;
    if (!state.sourceLang || !state.targetLang) {
        texto.textContent = t('lang_pair_unset') || '— → —';
        return;
    }
    texto.textContent = `${nombreDeIdioma(state.sourceLang, idioma)} → ${nombreDeIdioma(
        state.targetLang,
        idioma,
    )}`;
}

/** Rellena un desplegable con todos los idiomas, dejando elegido el que se diga. */
function llenarDesplegable(select, elegido) {
    const idioma = state.currentLanguage;
    const codigo = normalizarIdioma(elegido);

    const opciones = listaDeIdiomas(idioma).map(
        (i) => `<option value="${i.codigo}">${i.etiqueta}</option>`,
    );

    // Un código que trae el archivo y no está en la lista se añade igualmente:
    // vale más ofrecer "de-CH-1996" tal cual que perderlo por no reconocerlo.
    if (codigo && !listaDeIdiomas(idioma).some((i) => i.codigo === codigo)) {
        opciones.unshift(`<option value="${codigo}">${codigo}</option>`);
    }

    select.innerHTML = `<option value=""></option>${opciones.join('')}`;
    select.value = codigo || '';
}

/**
 * Abre el cuadro de idiomas y espera a que se conteste.
 *
 * @param {{origen?: string, destino?: string, aviso?: string}} [propuesta]
 * @returns {Promise<{origen: string, destino: string}|null>} null si se cancela.
 */
export function pedirIdiomas({ origen = '', destino = '', aviso = '' } = {}) {
    return new Promise((resolve) => {
        const modal = $('idiomasModal');
        const selectOrigen = $('idiomaOrigen');
        const selectDestino = $('idiomaDestino');
        const aceptar = $('idiomasAceptarBtn');
        const cancelar = $('idiomasCancelarBtn');
        const error = $('idiomasError');
        if (!modal || !selectOrigen || !selectDestino || !aceptar || !cancelar) {
            resolve(null);
            return;
        }

        llenarDesplegable(selectOrigen, origen);
        llenarDesplegable(selectDestino, destino);

        const pista = $('idiomasAviso');
        if (pista) {
            pista.textContent = aviso;
            pista.classList.toggle('hidden', !aviso);
        }
        if (error) error.textContent = '';

        modal.classList.remove('hidden');
        selectOrigen.focus();

        const cerrar = (resultado) => {
            modal.classList.add('hidden');
            aceptar.removeEventListener('click', alAceptar);
            cancelar.removeEventListener('click', alCancelar);
            modal.removeEventListener('keydown', alPulsar);
            resolve(resultado);
        };

        const alAceptar = () => {
            const elegido = {
                origen: selectOrigen.value,
                destino: selectDestino.value,
            };
            // Los dos hacen falta: con uno solo, ni la memoria ni el asistente
            // saben qué se les está pidiendo.
            if (!elegido.origen || !elegido.destino) {
                if (error) error.textContent = t('lang_pair_required');
                return;
            }
            // Traducir de un idioma a sí mismo no es traducir. Casi siempre es
            // un despiste con los dos desplegables, y avisar cuesta menos que
            // descubrirlo con el archivo entregado.
            if (elegido.origen === elegido.destino) {
                if (error) error.textContent = t('lang_pair_same');
                return;
            }
            cerrar(elegido);
        };
        const alCancelar = () => cerrar(null);
        const alPulsar = (evento) => {
            if (evento.key === 'Enter') {
                evento.preventDefault();
                alAceptar();
            }
            if (evento.key === 'Escape') {
                evento.preventDefault();
                alCancelar();
            }
        };

        aceptar.addEventListener('click', alAceptar);
        cancelar.addEventListener('click', alCancelar);
        modal.addEventListener('keydown', alPulsar);
    });
}

/**
 * Pregunta el par al abrir un archivo, con el cuadro ya relleno.
 *
 * Un SRT no dice en qué idioma está por ninguna parte —no tiene cabecera, solo
 * números, tiempos y texto—, así que no hay nada que adivinar: se propone el
 * último par que se usó, que es la dirección en la que casi siempre se sigue
 * trabajando.
 *
 * Si se cancela, el par se queda como estaba: no se traduce a ciegas, pero
 * tampoco se impide abrir el archivo.
 *
 * @returns {Promise<boolean>} Si se ha llegado a fijar un par.
 */
export async function preguntarIdiomasAlAbrir() {
    const ultimo = ultimoParUsado();
    const elegido = await pedirIdiomas({ origen: ultimo.origen, destino: ultimo.destino });

    if (!elegido) {
        pintarParDeIdiomas();
        return false;
    }

    // Sin guardar: el proyecto de este archivo todavía no existe.
    await fijarIdiomas(elegido, { guardar: false });
    return true;
}

/**
 * Deja el par listo al abrir un proyecto de la lista de recientes.
 *
 * Los proyectos guardados antes de que el par existiera no lo traen; a esos se
 * les pregunta una vez y se les queda puesto.
 *
 * @param {{sourceLang?: string, targetLang?: string, fileName?: string}} proyecto
 * @returns {Promise<void>}
 */
export async function recuperarIdiomasDelProyecto(proyecto) {
    state.sourceLang = normalizarIdioma(proyecto?.sourceLang || '');
    state.targetLang = normalizarIdioma(proyecto?.targetLang || '');
    pintarParDeIdiomas();

    if (state.sourceLang && state.targetLang) return;

    const ultimo = ultimoParUsado();
    const elegido = await pedirIdiomas({
        origen: state.sourceLang || ultimo.origen,
        destino: state.targetLang || ultimo.destino,
        aviso: t('lang_pair_missing'),
    });

    if (elegido) await fijarIdiomas(elegido);
}

/**
 * Engancha el indicador de la barra.
 */
export function initIdiomasProyecto() {
    pintarParDeIdiomas();

    // Los tres sitios donde se ve el par llevan al mismo cuadro: el de la
    // barra, el del glosario y el de la memoria. Un dato, un sitio donde se
    // cambia.
    for (const id of ['parIdiomasBtn', 'glosarioParIdiomas', 'memoriaParIdiomas']) {
        $(id)?.addEventListener('click', cambiarParDeIdiomas);
    }
}

/** Abre el cuadro para cambiar el par del proyecto y lo aplica. */
export async function cambiarParDeIdiomas() {
    const elegido = await pedirIdiomas({
        origen: state.sourceLang,
        destino: state.targetLang,
    });
    if (elegido) await fijarIdiomas(elegido);
}
