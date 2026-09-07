/**
 * Archivos .properties, los de las aplicaciones Java.
 *
 * Son pares de clave y valor, uno por línea: `boton.guardar=Guardar`. Se
 * traduce el valor; la clave es el identificador que usa el programa y no se
 * toca. Separan la clave del valor con "=" o con ":", los comentarios empiezan
 * por "#" o por "!", y un valor puede continuar en la línea siguiente si la
 * anterior acaba en barra invertida.
 *
 * Al guardar se reconstruye sobre el archivo original: los comentarios, las
 * líneas en blanco, el orden y el separador que usara cada línea vuelven tal y
 * como estaban. La versión de Locversia reescribe el archivo entero como
 * `clave=valor`, lo que se lleva por delante los comentarios; aquí no, porque
 * el archivo vuelve a quien lo mandó y no es cosa nuestra quitarle nada.
 *
 * Además, los comentarios que hay justo encima de una cadena se le enganchan
 * como contexto y salen en la etiqueta gris del segmento, igual que las
 * referencias de un PO. En estos archivos suelen ser las notas del programador
 * ("máximo 20 caracteres", "es un botón"), y de nada sirve conservarlas en el
 * archivo si quien traduce no las ve.
 *
 * Adaptado del lector de Locversia.
 */
import { countWords } from './text.js';

/** Comentario o línea vacía: no lleva nada que traducir. */
const SIN_CONTENIDO = /^\s*([#!].*)?$/;

/**
 * Deshace los escapes de un valor.
 *
 * @param {string} valor
 * @returns {string}
 */
function desescapar(valor) {
    return valor.replace(/\\([nrt\\])/g, (_, letra) => {
        if (letra === 'n') return '\n';
        if (letra === 'r') return '\r';
        if (letra === 't') return '\t';
        return '\\';
    });
}

/**
 * Vuelve a poner los escapes que exige el formato.
 *
 * @param {string} valor
 * @returns {string}
 */
function escapar(valor) {
    return String(valor)
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Busca dónde acaba la clave: en el primer "=" o ":" que no esté escapado.
 *
 * @param {string} linea
 * @returns {number} Posición del separador, o -1 si no hay.
 */
function posicionDelSeparador(linea) {
    for (let i = 0; i < linea.length; i++) {
        if (linea[i] === '\\') {
            i++; // lo siguiente va escapado, sea lo que sea
            continue;
        }
        if (linea[i] === '=' || linea[i] === ':') return i;
    }
    return -1;
}

/**
 * Lee un archivo .properties.
 *
 * @param {string} contenido
 * @returns {Array<Object>} Entradas para el editor.
 */
export function parsePropertiesContent(contenido) {
    const entradas = [];
    const lineas = String(contenido ?? '').split('\n');

    // Los comentarios se van acumulando y se le entregan a la cadena que venga
    // justo después. Una línea en blanco los descarta: un encabezado de archivo
    // separado por un hueco no es una nota sobre la primera cadena, y colgárselo
    // solo ensucia su etiqueta de contexto.
    let comentariosPendientes = [];

    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];

        if (SIN_CONTENIDO.test(linea)) {
            if (linea.trim() === '') comentariosPendientes = [];
            else comentariosPendientes.push(linea.trim());
            continue;
        }

        const separador = posicionDelSeparador(linea);
        if (separador === -1) continue;

        const clave = linea.slice(0, separador).trim();
        let valor = linea.slice(separador + 1).trim();

        // Valor repartido en varias líneas: cada una acaba en barra invertida.
        const primeraLinea = i;
        while (valor.endsWith('\\') && !valor.endsWith('\\\\') && i + 1 < lineas.length) {
            valor = valor.slice(0, -1) + lineas[i + 1].trim();
            i++;
        }

        const texto = desescapar(valor);

        entradas.push({
            msgid: texto,
            msgstr: '',
            msgctxt: clave,
            comments: comentariosPendientes,
            isHeader: false,
            lineaOriginal: primeraLinea,
            // Cuántas líneas del archivo ocupaba, para poder sustituirlas todas.
            lineasOcupadas: i - primeraLinea + 1,
            sentenceSegments: [
                {
                    original: texto,
                    translation: '',
                    wordCountOriginal: countWords(texto),
                    wordCountTranslation: 0,
                    isTranslated: false,
                },
            ],
        });
        comentariosPendientes = [];
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
export function reconstructProperties(entradas, original) {
    const lineas = String(original ?? '').split('\n');

    const porLinea = new Map();
    (entradas || []).forEach((entrada) => {
        if (entrada.lineaOriginal !== undefined) porLinea.set(entrada.lineaOriginal, entrada);
    });

    const salida = [];
    for (let i = 0; i < lineas.length; i++) {
        const entrada = porLinea.get(i);
        if (!entrada) {
            salida.push(lineas[i]);
            continue;
        }

        const ocupadas = entrada.lineasOcupadas || 1;
        const traduccion = (entrada.sentenceSegments || [])
            .map((s) => s.translation || '')
            .join('');

        if (!traduccion) {
            // Sin traducir: la entrada vuelve tal cual, con sus continuaciones.
            for (let j = 0; j < ocupadas; j++) salida.push(lineas[i + j]);
        } else {
            // Traducida: se conserva tal cual todo lo que hay antes del valor
            // —la clave, el separador y los espacios que lo rodearan— y solo
            // cambia el valor. El valor pasa a una sola línea aunque viniera
            // partido en varias.
            const linea = lineas[i];
            const separador = posicionDelSeparador(linea);
            const empiezaElValor = linea.slice(separador + 1).search(/\S|$/) + separador + 1;
            salida.push(linea.slice(0, empiezaElValor) + escapar(traduccion));
        }

        i += ocupadas - 1;
    }

    return salida.join('\n');
}
