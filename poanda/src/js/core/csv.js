/**
 * Archivos .csv, la hoja de cálculo guardada como texto.
 *
 * Un CSV de traducción suele tener una columna con el identificador, otra con
 * el original y otra con la traducción:
 *
 *   key,source,target
 *   boton.guardar,Save,
 *
 * Poanda mira la primera fila para saber qué columna es cuál. Reconoce los
 * nombres habituales (key/id/msgctxt, source/original/msgid,
 * target/translation/msgstr) en mayúsculas o minúsculas. Si la primera fila no
 * lleva ninguno de esos nombres, es que el archivo no tiene encabezado: entonces
 * la primera columna es el original, la segunda la traducción, y la primera fila
 * se traduce como una más en lugar de tirarla.
 *
 * Al guardar se sustituye solo la celda de la traducción. Las demás columnas
 * (que pueden ser el contexto, un comentario, la longitud máxima o cualquier
 * cosa que use el cliente), el separador que usara el archivo, las comillas y
 * los saltos de línea de Windows vuelven tal cual.
 */
import { countWords } from './text.js';
import { sustituirTramos } from './tramos.js';

/** Cómo se puede llamar cada columna en el encabezado. */
const NOMBRES = {
    clave: ['key', 'id', 'msgctxt', 'context', 'clave'],
    original: ['source', 'original', 'msgid', 'source text', 'texto original'],
    traduccion: ['target', 'translation', 'msgstr', 'target text', 'traduccion', 'traducción'],
};

/** Separadores que se prueban, en orden de cuánto se usan. */
const SEPARADORES = [',', ';', '\t'];

/**
 * Adivina el separador contando cuál aparece más veces fuera de las comillas.
 *
 * @param {string} texto
 * @returns {string}
 */
function adivinarSeparador(texto) {
    const primeraLinea = texto.split('\n')[0] || '';
    let mejor = ',';
    let masVeces = 0;

    for (const separador of SEPARADORES) {
        const veces = contarFuera(primeraLinea, separador);
        if (veces > masVeces) {
            masVeces = veces;
            mejor = separador;
        }
    }

    return mejor;
}

/**
 * Cuenta cuántas veces aparece un carácter fuera de las comillas.
 *
 * @param {string} linea
 * @param {string} caracter
 * @returns {number}
 */
function contarFuera(linea, caracter) {
    let veces = 0;
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
        if (linea[i] === '"') entreComillas = !entreComillas;
        else if (linea[i] === caracter && !entreComillas) veces++;
    }
    return veces;
}

/**
 * Parte el archivo en filas y celdas, anotando dónde está cada celda.
 *
 * Se hace de una pasada por el texto entero, y no partiendo por líneas, porque
 * una celda entre comillas puede llevar dentro un salto de línea: partir por
 * líneas convertiría una fila en dos.
 *
 * @param {string} texto
 * @param {string} separador
 * @returns {Array<Array<{valor: string, inicio: number, fin: number}>>}
 */
function partirEnCeldas(texto, separador) {
    const filas = [];
    let fila = [];
    let inicioCelda = 0;
    let crudo = '';
    let entreComillas = false;

    const cerrarCelda = (fin) => {
        fila.push({ valor: desentrecomillar(crudo), inicio: inicioCelda, fin });
        crudo = '';
    };

    for (let i = 0; i < texto.length; i++) {
        const caracter = texto[i];

        if (caracter === '"') {
            entreComillas = !entreComillas;
            crudo += caracter;
            continue;
        }

        if (!entreComillas && caracter === separador) {
            cerrarCelda(i);
            inicioCelda = i + 1;
            continue;
        }

        if (!entreComillas && caracter === '\n') {
            // El retorno de carro de Windows es del salto de línea, no de la
            // celda: dejarlo dentro metería un carácter invisible al final de
            // cada traducción.
            const finCelda = crudo.endsWith('\r') ? i - 1 : i;
            crudo = crudo.replace(/\r$/, '');
            cerrarCelda(finCelda);
            filas.push(fila);
            fila = [];
            inicioCelda = i + 1;
            continue;
        }

        crudo += caracter;
    }

    if (crudo !== '' || fila.length > 0) {
        cerrarCelda(texto.length);
        filas.push(fila);
    }

    return filas;
}

/**
 * Quita las comillas de fuera y deshace las dobles de dentro.
 *
 * @param {string} crudo
 * @returns {string}
 */
function desentrecomillar(crudo) {
    const texto = crudo.trim();
    if (texto.length >= 2 && texto.startsWith('"') && texto.endsWith('"')) {
        return texto.slice(1, -1).replace(/""/g, '"');
    }
    return texto;
}

/**
 * Pone comillas si el texto las necesita.
 *
 * @param {string} valor
 * @param {string} separador
 * @returns {string}
 */
function entrecomillar(valor, separador) {
    const texto = String(valor ?? '');
    if (texto.includes('"') || texto.includes('\n') || texto.includes('\r') || texto.includes(separador)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
}

/**
 * Decide qué columna es cuál mirando la primera fila.
 *
 * @param {Array<{valor: string}>} primeraFila
 * @returns {{clave: number, original: number, traduccion: number, hayEncabezado: boolean}}
 */
function repartirColumnas(primeraFila) {
    const columnas = { clave: -1, original: -1, traduccion: -1 };

    primeraFila.forEach((celda, i) => {
        const nombre = celda.valor.trim().toLowerCase();
        for (const [papel, posibles] of Object.entries(NOMBRES)) {
            if (columnas[papel] === -1 && posibles.includes(nombre)) columnas[papel] = i;
        }
    });

    const hayEncabezado =
        columnas.original !== -1 || columnas.traduccion !== -1 || columnas.clave !== -1;

    if (!hayEncabezado) {
        // Sin encabezado: la primera columna es el original y la segunda la
        // traducción, que es como viene el CSV de dos columnas de toda la vida.
        return { clave: -1, original: 0, traduccion: 1, hayEncabezado: false };
    }

    if (columnas.original === -1) columnas.original = columnas.clave === 0 ? 1 : 0;
    if (columnas.traduccion === -1) columnas.traduccion = columnas.original + 1;

    return { ...columnas, hayEncabezado: true };
}

/**
 * Lee un archivo .csv.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parseCsvContent(contenido) {
    const texto = String(contenido ?? '');
    if (!texto.trim()) return [];

    const separador = adivinarSeparador(texto);
    const filas = partirEnCeldas(texto, separador);
    if (filas.length === 0) return [];

    const columnas = repartirColumnas(filas[0]);
    const primeraDeDatos = columnas.hayEncabezado ? 1 : 0;
    const entradas = [];

    for (let i = primeraDeDatos; i < filas.length; i++) {
        const fila = filas[i];
        const celdaOriginal = fila[columnas.original];
        if (!celdaOriginal || !celdaOriginal.valor) continue;

        const celdaTraduccion = fila[columnas.traduccion];
        const yaTraducido = celdaTraduccion ? celdaTraduccion.valor : '';
        const clave = columnas.clave >= 0 && fila[columnas.clave] ? fila[columnas.clave].valor : '';

        entradas.push({
            msgid: celdaOriginal.valor,
            msgstr: yaTraducido,
            msgctxt: clave || undefined,
            comments: [],
            isHeader: false,
            separador,
            // Si la fila no llega a la columna de la traducción, se apunta el
            // final de la fila: al guardar habrá que añadir la celda que falta.
            valorInicio: celdaTraduccion ? celdaTraduccion.inicio : fila[fila.length - 1].fin,
            valorFin: celdaTraduccion ? celdaTraduccion.fin : fila[fila.length - 1].fin,
            celdasQueFaltan: celdaTraduccion ? 0 : columnas.traduccion - (fila.length - 1),
            sentenceSegments: [
                {
                    original: celdaOriginal.valor,
                    translation: yaTraducido,
                    wordCountOriginal: countWords(celdaOriginal.valor),
                    wordCountTranslation: countWords(yaTraducido),
                    isTranslated: yaTraducido !== '',
                },
            ],
        });
    }

    return entradas;
}

/**
 * Vuelve a escribir el archivo con las traducciones puestas.
 *
 * @param {Array<Object>} entradas
 * @param {string} original Contenido con el que se abrió el archivo.
 * @returns {string}
 */
export function reconstructCsv(entradas, original) {
    const tramos = [];

    for (const entrada of entradas || []) {
        if (entrada.valorInicio === undefined) continue;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');
        if (!traduccion) continue;

        const separador = entrada.separador || ',';
        const faltan = entrada.celdasQueFaltan || 0;
        // Cuando la fila se quedaba corta, se completan con separadores las
        // celdas vacías que haya por medio antes de escribir la traducción.
        const relleno = faltan > 0 ? separador.repeat(faltan) : '';

        tramos.push({
            inicio: entrada.valorInicio,
            fin: entrada.valorFin,
            texto: relleno + entrecomillar(traduccion, separador),
        });
    }

    return sustituirTramos(original, tramos);
}
