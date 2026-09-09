/**
 * Lo que dio la última revisión de calidad, y qué se revisa.
 *
 * Se guarda aparte porque hay tres sitios que necesitan lo mismo y no se
 * conocen entre ellos: el panel que lista los avisos, el triángulo que sale
 * junto a cada segmento con problemas, y el filtro que deja en pantalla solo
 * esos segmentos. Si cada uno revisara por su cuenta, el archivo se recorrería
 * tres veces y —peor— podrían decir cosas distintas.
 *
 * Y se guarda AQUÍ, y no en el panel, por una razón muy concreta: el editor
 * necesita esto para pintar los triángulos y para filtrar, y el panel necesita
 * al editor para navegar. Si se lo pidieran el uno al otro, los dos módulos se
 * importarían en círculo. Con los datos en medio, cada uno mira aquí.
 *
 * Aquí no se revisa nada: solo se recuerda lo que salió y se responde a
 * preguntas sobre ello. La revisión la hace core/qa.js.
 */
import { COMPROBACIONES, POR_DEFECTO } from './core/qa.js';
import { state } from './state.js';
import { translations } from './translations.js';

const AJUSTES = 'poanda_qa_comprobaciones';

/** Qué comprobaciones están encendidas, según lo que se dejó la última vez. */
export function comprobacionesActivas() {
    try {
        const guardado = localStorage.getItem(AJUSTES);
        if (!guardado) return { ...POR_DEFECTO };
        return { ...POR_DEFECTO, ...JSON.parse(guardado) };
    } catch {
        return { ...POR_DEFECTO };
    }
}

/** @param {Object} cuales */
export function guardarComprobaciones(cuales) {
    try {
        localStorage.setItem(AJUSTES, JSON.stringify(cuales));
    } catch {
        // Un navegador con el almacenamiento capado sigue pudiendo revisar; lo
        // único que pasa es que empieza con todas encendidas cada vez.
    }
}

/** Cuántas comprobaciones hay encendidas ahora mismo. */
export function cuantasEncendidas() {
    const cuales = comprobacionesActivas();
    return COMPROBACIONES.filter((c) => cuales[c]).length;
}

/**
 * El texto de un aviso: qué comprobación es y qué ha encontrado.
 *
 * Lo usan la lista del panel y el tooltip del triángulo, y tienen que decir lo
 * mismo: si dijeran cosas distintas, la lista y el segmento parecerían hablar
 * de dos problemas.
 *
 * @param {{comprobacion: string, dato?: string}} aviso
 * @returns {string}
 */
export function textoDelAviso(aviso) {
    const nombre = translations[state.currentLanguage]?.[`qa_${aviso.comprobacion}`] || '';
    return aviso.dato ? `${nombre}: ${aviso.dato}` : nombre;
}

/**
 * Si hay que dejar en pantalla solo los segmentos con avisos.
 *
 * Vive aquí y no en la casilla porque lo pregunta el editor, que no tiene por
 * qué saber qué aspecto tiene el panel ni si está abierto.
 */
let soloConAvisos = false;

/** @param {boolean} valor */
export function filtrarPorAvisos(valor) {
    soloConAvisos = Boolean(valor);
}

export function soloSegmentosConAvisos() {
    return soloConAvisos && revisado;
}

/** @type {Array<object>} */
let avisos = [];

/** @type {Set<string>} */
let idsConProblemas = new Set();

/** @type {Map<string, object>} */
let segmentosPorId = new Map();

/**
 * Si se ha revisado al menos una vez.
 *
 * Importa distinguir "revisado y sin avisos" de "todavía no revisado": en el
 * primer caso el panel dice que está limpio, en el segundo no puede decir nada
 * y sería mentira enseñar un cero.
 */
let revisado = false;

export function seHaRevisado() {
    return revisado;
}

/**
 * @param {Array<object>} nuevos
 * @param {Array<object>} segmentos
 */
export function guardarRevision(nuevos = [], segmentos = []) {
    revisado = true;
    avisos = nuevos;
    idsConProblemas = new Set(nuevos.map((a) => a.id));
    segmentosPorId = new Map(segmentos.map((s) => [s.id, s]));
}

export function avisosDeLaRevision() {
    return avisos;
}

/** Los identificadores de segmento que tienen algún aviso. */
export function idsConAvisos() {
    return revisado ? idsConProblemas : new Set();
}

/** @param {string} id */
export function segmentoDeLaRevision(id) {
    return segmentosPorId.get(id);
}

/**
 * Los avisos de un segmento, contando solo las comprobaciones encendidas.
 *
 * @param {string} id
 * @param {Object} [cuales]
 * @returns {Array<object>}
 */
export function avisosDelSegmento(id, cuales) {
    if (!revisado) return [];
    return avisos.filter(
        (aviso) => aviso.id === id && cuales?.[aviso.comprobacion] !== false,
    );
}

/** Olvida la revisión. Se llama al abrir otro archivo. */
export function olvidarRevision() {
    revisado = false;
    soloConAvisos = false;
    avisos = [];
    idsConProblemas = new Set();
    segmentosPorId = new Map();
}
