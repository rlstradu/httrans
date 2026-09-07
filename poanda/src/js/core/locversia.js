/**
 * Proyectos de Locversia (.locversia).
 *
 * Es la copia de un proyecto entero: el archivo original ya troceado en
 * segmentos, con lo traducido hasta el momento y las notas de cada segmento. Por
 * dentro es un zip con un project.json (en algunas exportaciones, el .json a
 * secas).
 *
 * Abrirlo en Poanda sirve para seguir en Poanda un trabajo empezado en
 * Locversia, y al guardar se devuelve el mismo proyecto con las traducciones
 * puestas, así que se puede volver a abrir allí. Lo que Poanda no entiende
 * —preferencias, revisiones, lo que cada versión guarde de más— se devuelve tal
 * y como vino en lugar de descartarlo.
 *
 * Los segmentos vienen ya partidos por frases y agrupados en bloques: un bloque
 * es un párrafo del documento y cada frase suya, un segmento. Aquí se respeta
 * ese reparto, que es el que hizo Locversia al abrir el documento original: si
 * se volviera a partir por nuestra cuenta, lo traducido dejaría de encajar.
 */
import { countWords } from './text.js';
import { abrirZip, cerrarZip, escribirTexto, leerTexto, rutasQueCumplen } from './zip.js';

const decodificador = new TextDecoder('utf-8');
const codificador = new TextEncoder();

/** Los dos primeros bytes de un zip. */
const ES_ZIP = (bytes) => bytes.length > 1 && bytes[0] === 0x50 && bytes[1] === 0x4b;

/**
 * Saca el project.json del archivo, venga comprimido o suelto.
 *
 * @param {ArrayBuffer} datos
 * @returns {{proyecto: Object, ruta: string|null, archivos: Object|null}}
 */
function abrirPaquete(datos) {
    const bytes = new Uint8Array(datos);

    if (!ES_ZIP(bytes)) {
        return { proyecto: JSON.parse(decodificador.decode(bytes)), ruta: null, archivos: null };
    }

    const archivos = abrirZip(bytes);
    const ruta =
        rutasQueCumplen(archivos, (r) => r === 'project.json')[0] ||
        rutasQueCumplen(archivos, (r) => r.endsWith('.json'))[0];
    if (!ruta) throw new Error('El proyecto no lleva dentro ningún project.json.');

    return { proyecto: JSON.parse(leerTexto(archivos, ruta)), ruta, archivos };
}

/**
 * Lee un proyecto de Locversia.
 *
 * @param {ArrayBuffer} datos
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseLocversiaContent(datos) {
    const { proyecto } = abrirPaquete(datos);
    const segmentos = Array.isArray(proyecto?.segments) ? proyecto.segments : [];

    // Los segmentos vienen sueltos, con el número de bloque al que pertenecen;
    // se vuelven a juntar por bloque para que una frase y la siguiente del
    // mismo párrafo salgan juntas, como estaban en el documento.
    const bloques = new Map();

    for (const segmento of segmentos) {
        const clave = segmento.blockId ?? bloques.size;
        if (!bloques.has(clave)) bloques.set(clave, []);
        bloques.get(clave).push(segmento);
    }

    const entradas = [];

    for (const [clave, trozos] of bloques) {
        trozos.sort((a, b) => (a.sentenceIndex ?? 0) - (b.sentenceIndex ?? 0));

        const notas = trozos
            .map((t) => String(t.note || '').trim())
            .filter(Boolean)
            .map((nota) => `#. ${nota}`);

        entradas.push({
            msgid: trozos.map((t) => t.source ?? '').join(' '),
            msgstr: trozos.map((t) => t.target ?? '').join(' '),
            msgctxt: trozos[0].contextLabel || undefined,
            comments: notas,
            isHeader: false,
            bloqueDeLocversia: clave,
            sentenceSegments: trozos.map((trozo) => ({
                original: trozo.source ?? '',
                translation: trozo.target ?? '',
                wordCountOriginal: countWords(trozo.source ?? ''),
                wordCountTranslation: countWords(trozo.target ?? ''),
                isTranslated: Boolean((trozo.target ?? '').trim()),
            })),
        });
    }

    return entradas;
}

/**
 * Vuelve a escribir el proyecto con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {ArrayBuffer} original
 * @returns {ArrayBuffer}
 */
export function reconstructLocversia(entradas, original) {
    const { proyecto, ruta, archivos } = abrirPaquete(original);

    // Se busca cada segmento por bloque y posición, en lugar de fiarse del orden
    // en que venían: así, si el archivo trae segmentos que Poanda no ha
    // enseñado, siguen donde estaban.
    const traducciones = new Map();
    for (const entrada of entradas || []) {
        (entrada.sentenceSegments || []).forEach((segmento, i) => {
            traducciones.set(`${entrada.bloqueDeLocversia}:${i}`, segmento.translation || '');
        });
    }

    proyecto.segments = (proyecto.segments || []).map((segmento) => {
        const clave = `${segmento.blockId}:${segmento.sentenceIndex ?? 0}`;
        if (!traducciones.has(clave)) return segmento;
        const traduccion = traducciones.get(clave);
        return {
            ...segmento,
            target: traduccion,
            // Un segmento traducido aquí llega a Locversia sin validar: quien
            // revise allí decide, que para eso es su proyecto.
            validated: traduccion ? Boolean(segmento.validated) : false,
        };
    });

    const json = `${JSON.stringify(proyecto, null, 2)}\n`;

    if (!archivos || !ruta) return codificador.encode(json).buffer;

    escribirTexto(archivos, ruta, json);
    return cerrarZip(archivos);
}
