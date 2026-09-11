/**
 * Cuenta las palabras de un texto.
 *
 * Cuenta separando por espacios en blanco, que es el criterio habitual en las
 * herramientas de traducción para dar el volumen de un archivo.
 *
 * @param {string} text Texto a contar.
 * @returns {number} Número de palabras; 0 si el texto está vacío.
 */
function countWords(text) {
    if (!text) return 0;
    // Trim leading/trailing whitespace and split by one or more whitespace characters
    const words = text.trim().split(/\s+/);
    // Filter out empty strings that might result from multiple spaces
    return words.filter((word) => word.length > 0).length;
}

/**
 * Parte un texto en frases, conservando los signos de puntuación finales.
 *
 * @param {string} text Texto a partir.
 * @returns {string[]} Lista de frases. Para un texto vacío devuelve [''].
 */
function splitTextIntoSentences(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return [''];
    }
    // Use a regex that keeps the delimiters to re-assemble them correctly
    const sentenceDelimiters = /([.?!]+[\s\r\n]*)/g;
    const parts = text.split(sentenceDelimiters);

    const sentences = [];
    let currentSentence = '';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === null || part === undefined) continue;

        if (part.match(sentenceDelimiters)) {
            // If it's a delimiter
            if (currentSentence.trim() !== '') {
                sentences.push(currentSentence.trim() + part);
                currentSentence = '';
            } else if (part.trim() !== '') {
                // Handle cases where a delimiter might start a segment
                sentences.push(part.trim());
            }
        } else {
            // If it's a sentence part
            currentSentence += part;
        }
    }
    if (currentSentence.trim() !== '') {
        sentences.push(currentSentence.trim());
    }

    return sentences.filter((s) => s.length > 0 || text === '');
}

/**
 * Distancia de Levenshtein entre dos cadenas: cuántas letras hay que insertar,
 * borrar o cambiar para convertir una en la otra.
 *
 * Es la base del cálculo de coincidencias parciales de la memoria de traducción.
 *
 * @param {string} a Primera cadena.
 * @param {string} b Segunda cadena.
 * @returns {number} Número de operaciones necesarias.
 */
function levenshteinDistance(a, b) {
    return distanciaAcotada(a, b, Infinity);
}

/**
 * Las letras que se cuentan para el descarte rápido, y dónde va cada una.
 *
 * Son las más frecuentes en inglés y español juntos, más el espacio, que dice
 * mucho: dos frases con seis espacios de diferencia tienen seis palabras de
 * diferencia. No hacen falta más; con nueve ya se descarta casi todo lo que hay
 * que descartar, y cada letra añadida cuesta memoria en el recuento.
 */
const LETRAS_DEL_DESCARTE = ' eaonsrit';

/** charCode -> posición en el recuento; -1 si esa letra no se cuenta. */
const POSICION_DE_LETRA = (() => {
    const tabla = new Int8Array(128).fill(-1);
    for (let i = 0; i < LETRAS_DEL_DESCARTE.length; i++) {
        tabla[LETRAS_DEL_DESCARTE.charCodeAt(i)] = i;
    }
    return tabla;
})();

const recuentoA = new Int32Array(LETRAS_DEL_DESCARTE.length);
const recuentoB = new Int32Array(LETRAS_DEL_DESCARTE.length);

/** Cuenta en `recuento` las letras de `texto` que entran en el descarte. */
function contar(texto, recuento) {
    recuento.fill(0);
    for (let i = 0; i < texto.length; i++) {
        const bruto = texto.charCodeAt(i);
        const codigo = bruto >= 65 && bruto <= 90 ? bruto + 32 : bruto;
        if (codigo < 128) {
            const donde = POSICION_DE_LETRA[codigo];
            if (donde >= 0) recuento[donde]++;
        }
    }
}

/**
 * Un mínimo de operaciones necesarias, contando letras en vez de comparándolas.
 *
 * La idea: cada operación (insertar, borrar o cambiar una letra) puede corregir
 * como mucho **una** unidad de desequilibrio en el recuento de una letra. Si el
 * primer texto tiene siete espacios más que el segundo, hacen falta al menos
 * siete operaciones, se parezcan en lo que se parezcan las demás letras.
 *
 * Eso da un mínimo seguro, y calcularlo es recorrer las dos cadenas una vez.
 * Cuesta unas cien operaciones baratas frente a las varias miles de la matriz,
 * y sobre una memoria grande la mayoría de las unidades caen aquí sin llegar a
 * entrar en el cálculo de verdad.
 *
 * Es solo un mínimo: que lo pase no significa que se parezcan. Por eso nunca
 * decide un resultado, solo evita cuentas que ya se sabe que no valen.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Un número que la distancia real no puede bajar.
 */
function cotaPorLetras(a, b) {
    // Mayúsculas y minúsculas cuentan como la misma letra, y las que llevan
    // tilde no se cuentan. Las dos cosas hacen el mínimo más pequeño de lo que
    // podría ser, nunca más grande: se descarta de menos, nunca de más, que es
    // el único error que aquí no se puede cometer.
    contar(a, recuentoA);
    contar(b, recuentoB);

    // Lo que le sobra a uno y lo que le sobra al otro son dos mínimos distintos,
    // y vale el mayor de los dos.
    let sobraEnA = 0;
    let sobraEnB = 0;
    for (let i = 0; i < recuentoA.length; i++) {
        const diferencia = recuentoA[i] - recuentoB[i];
        if (diferencia > 0) sobraEnA += diferencia;
        else sobraEnB -= diferencia;
    }

    return sobraEnA > sobraEnB ? sobraEnA : sobraEnB;
}

/**
 * Distancia de Levenshtein, pero con un techo: si se pasa, no se sigue.
 *
 * Es el mismo cálculo de siempre con dos cambios, y ninguno de los dos altera
 * el resultado mientras la distancia quepa bajo el techo:
 *
 * 1. **Dos filas en vez de la matriz entera.** Para calcular una fila solo hace
 *    falta la anterior. La matriz completa de dos frases de 200 letras son
 *    40.000 casillas que se tiran a la basura enseguida.
 * 2. **Se abandona en cuanto ya no puede llegar.** Si toda la fila actual está
 *    por encima del techo, el resultado final también lo estará —las filas
 *    nunca bajan—, así que no hay nada que ganar terminando.
 *
 * Y antes de empezar hay un descarte que sale gratis: la distancia nunca es
 * menor que la diferencia de longitudes, porque solo para igualar los largos ya
 * hacen falta esas operaciones. Dos textos que difieren en 40 letras no pueden
 * estar a distancia 10 por mucho que se parezcan las que tienen.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} maximo Techo. Con Infinity se calcula entera.
 * @returns {number} La distancia exacta si no pasa del techo; si pasa, un
 *   número mayor que el techo (no promete cuál).
 */
function distanciaAcotada(a, b, maximo) {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;

    // Los dos descartes baratos, por orden de coste.
    if (Math.abs(an - bn) > maximo) return maximo + 1;
    if (maximo !== Infinity && cotaPorLetras(a, b) > maximo) return maximo + 1;

    // La fila se recorre sobre la cadena más corta: menos casillas por fila.
    const [corta, larga] = an <= bn ? [a, b] : [b, a];
    const cn = corta.length;

    let anterior = new Array(cn + 1);
    let actual = new Array(cn + 1);
    for (let j = 0; j <= cn; j++) anterior[j] = j;

    for (let i = 1; i <= larga.length; i++) {
        actual[0] = i;
        let menorDeLaFila = i;
        const letraLarga = larga[i - 1];

        for (let j = 1; j <= cn; j++) {
            const coste = corta[j - 1] === letraLarga ? 0 : 1;
            const valor = Math.min(
                anterior[j] + 1, // borrar
                actual[j - 1] + 1, // insertar
                anterior[j - 1] + coste, // sustituir
            );
            actual[j] = valor;
            if (valor < menorDeLaFila) menorDeLaFila = valor;
        }

        if (menorDeLaFila > maximo) return maximo + 1;

        const cambio = anterior;
        anterior = actual;
        actual = cambio;
    }

    return anterior[cn];
}

/**
 * Porcentaje de parecido entre dos textos, del 0 al 100.
 *
 * Es lo que se muestra como "coincidencia" en la memoria de traducción: 100
 * significa idénticos, 0 que no se parecen en nada.
 *
 * @param {string} s1 Primer texto.
 * @param {string} s2 Segundo texto.
 * @returns {number} Porcentaje entre 0 y 100; 0 si falta alguno de los dos.
 */
function calculateSimilarity(s1, s2) {
    return parecidoAlMenos(s1, s2, 0);
}

/**
 * Parecido entre dos textos, calculando solo lo que hace falta.
 *
 * Es lo mismo que `calculateSimilarity`, pero diciendo de antemano a partir de
 * qué porcentaje interesa la respuesta. Si el parecido no llega a ese mínimo
 * devuelve 0 sin terminar la cuenta; si llega, devuelve el porcentaje exacto,
 * el mismo que daría el cálculo completo.
 *
 * De dónde sale el techo: para que el parecido llegue al mínimo M, hace falta
 * que (L - d) / L * 100 >= M, siendo L la longitud del más largo y d la
 * distancia. Despejando, d <= L * (1 - M/100). Con M = 50 y frases de 60
 * letras, cualquier unidad de la memoria que esté a más de 30 operaciones queda
 * descartada, y la mayoría lo están.
 *
 * Quien la llama puede subir el mínimo sobre la marcha: buscando la mejor
 * coincidencia, en cuanto se encuentra una del 88 % las que no pasen de ahí ya
 * no sirven, y el techo se estrecha con cada hallazgo.
 *
 * @param {string} s1
 * @param {string} s2
 * @param {number} [minimo] Porcentaje por debajo del cual da igual el valor.
 * @returns {number} El parecido exacto si llega al mínimo; 0 si no.
 */
function parecidoAlMenos(s1, s2, minimo = 0) {
    if (!s1 || !s2) return 0;
    const larga = Math.max(s1.length, s2.length);
    if (larga === 0) return 100;

    // d es un número entero de operaciones, así que el techo se redondea hacia
    // abajo: con L = 10 y M = 95, d <= 0,5 significa d <= 0.
    const techo = minimo > 0 ? Math.floor(larga * (1 - minimo / 100)) : Infinity;
    if (techo < 0) return 0;

    const distancia = distanciaAcotada(s1, s2, techo);
    if (distancia > techo) return 0;

    return ((larga - distancia) / larga) * 100;
}

/**
 * Longitud a partir de la cual se da por hecho que una línea se cortó sola.
 *
 * El CHANGELOG.md está escrito a unas 78 columnas. Una línea que llega cerca de
 * ese ancho se cortó porque no cabía la palabra siguiente, así que el párrafo
 * continúa. Una línea claramente más corta es un título o el final del párrafo.
 */
const ANCHO_LINEA_LLENA = 60;

/** Marcas de lista: nunca se pegan al párrafo anterior. */
const INICIO_DE_LISTA = /^\s*([*\-•+]|\d+[.)])\s/;

/**
 * Quita los saltos de línea que solo daban forma al archivo.
 *
 * El changelog se escribe con saltos duros para poder leerlo en un editor de
 * texto. Al enseñarlo en una ventana más estrecha, el navegador vuelve a partir
 * esas líneas y el resultado son renglones sueltos de una o dos palabras. Aquí
 * se unen las líneas de cada párrafo y se deja que sea el navegador quien
 * decida dónde cortar, que para eso sabe lo ancha que es la ventana.
 *
 * Se conservan los saltos que sí significan algo: líneas en blanco, líneas de
 * guiones o iguales, títulos de sección, listas y líneas sangradas.
 *
 * @param {string} texto Texto tal cual viene del archivo.
 * @returns {string} El mismo texto con los párrafos en una sola línea.
 */
function desenvolverParrafos(texto) {
    if (!texto) return '';

    const lineas = texto.split('\n');
    const salida = [];

    for (const linea of lineas) {
        const anterior = salida.length > 0 ? salida[salida.length - 1] : null;

        if (anterior !== null && continuaElParrafo(anterior, linea)) {
            salida[salida.length - 1] = `${anterior.replace(/\s+$/, '')} ${linea.trim()}`;
        } else {
            salida.push(linea);
        }
    }

    return salida.join('\n');
}

/**
 * ¿La segunda línea es continuación de la primera, o empieza algo nuevo?
 *
 * @param {string} anterior
 * @param {string} actual
 * @returns {boolean}
 */
function continuaElParrafo(anterior, actual) {
    // Nada que unir si alguna de las dos está vacía: ahí hay un párrafo aparte.
    if (!anterior.trim() || !actual.trim()) return false;

    // Las líneas de guiones o iguales enmarcan los títulos de versión.
    if (/^[=\-_*]{3,}\s*$/.test(anterior) || /^[=\-_*]{3,}\s*$/.test(actual)) return false;

    // Una línea sangrada o con marca de lista empieza algo por su cuenta.
    if (/^\s/.test(actual) || INICIO_DE_LISTA.test(actual)) return false;
    if (INICIO_DE_LISTA.test(anterior)) return false;

    // "New Features:" es un encabezado, no el principio de la frase siguiente.
    if (/:\s*$/.test(anterior)) return false;

    // Y ahora lo de siempre: si la línea anterior venía llena, se cortó sola.
    if (anterior.trim().length >= ANCHO_LINEA_LLENA) return true;

    // Si venía corta, todavía puede ser continuación: se nota en que la
    // siguiente empieza en minúscula o por un signo de puntuación, cosa que no
    // hace nunca un título.
    return /^[a-záéíóúüñ(),;:"'»–—-]/.test(actual);
}

export {
    calculateSimilarity,
    countWords,
    desenvolverParrafos,
    distanciaAcotada,
    levenshteinDistance,
    parecidoAlMenos,
    splitTextIntoSentences,
};
