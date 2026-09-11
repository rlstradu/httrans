/**
 * El control de calidad: qué se revisa antes de entregar.
 *
 * Un encargo de subtitulado no se entrega leyéndolo entero otra vez. Se
 * entrega pasándole una lista de comprobaciones y mirando lo que salte, y esa
 * lista es casi siempre la misma: que no se lea demasiado rápido, que las
 * líneas no se pasen de largo, que no se solapen dos subtítulos, que no se haya
 * quedado uno sin traducir. Lo que aquí se hace es tener esa lista escrita en
 * un solo sitio.
 *
 * CADA REGLA ES UNA FUNCIÓN Y ESTÁN TODAS EN UNA TABLA
 *
 * No un `if` detrás de otro dentro de un bucle. La diferencia importa: con la
 * tabla, añadir una comprobación es añadir una entrada, y la interfaz puede
 * recorrerla para pintar los filtros y los ajustes sin que nadie tenga que
 * acordarse de tocar tres listas paralelas. Cada regla dice cómo se llama, si
 * es error o aviso, qué límite usa y qué mira; lo demás lo pone el motor.
 *
 * LOS MENSAJES NO ESTÁN AQUÍ
 *
 * Una regla no devuelve "20,4 CPS (máximo 20)". Devuelve qué regla ha saltado y
 * con qué números, y el texto lo pone quien sabe en qué idioma está la
 * herramienta. Escribir el mensaje dentro del motor obliga a elegir un idioma
 * aquí dentro, y entonces la mitad de la interfaz está traducida y la otra
 * mitad no.
 *
 * QUÉ MIRA CADA REGLA
 *
 * Casi todas miran la traducción, que es lo que se entrega. Unas pocas
 * comparan la traducción con el original —los números, el glosario, el
 * formato—, y esas no dicen nada mientras no haya traducción: un subtítulo sin
 * traducir todavía no es un subtítulo mal traducido, y ya lo cuenta
 * `sin_traducir`.
 */
import { calculateCPS, countCharactersWithoutTags, countWords, textoVisible } from './srt.js';
import { compararEtiquetas } from './etiquetas.js';

/**
 * Los límites de fábrica.
 *
 * Los dos primeros son los de siempre y ya estaban en los ajustes. El resto
 * salen de lo que piden habitualmente las plataformas y las cadenas; cada
 * cliente tiene los suyos, y por eso se pueden cambiar.
 */
export const LIMITES_DE_FABRICA = {
    cps: 20,
    porLinea: 42,
    lineas: 2,
    duracionMinimaMs: 833,
    duracionMaximaMs: 7000,
    huecoMaximoMs: 2000,
    // Dos fotogramas a 25: es lo que se pide en casi cualquier encargo para
    // que el ojo note que ha cambiado el subtítulo y no lo lea como uno solo.
    huecoMinimoMs: 80,
    palabrasPorMinuto: 180,
};

/**
 * El texto tal y como se ve, en líneas.
 *
 * Lo que hay guardado es lo que deja el campo del editor: `<br>`, `<i>`, y en
 * un ASS las marcas entre llaves. Nada de eso se lee en pantalla, así que nada
 * de eso cuenta para revisar el texto.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function enLineas(texto) {
    return textoVisible(String(texto ?? '').replace(/<br\s*\/?>/gi, '\n')).split('\n');
}

/** Lo mismo, pero de una pieza. */
function comoSeLee(texto) {
    return enLineas(texto).join('\n');
}

/** Escapa lo que vaya a ir dentro de una expresión regular. */
function escapar(cadena) {
    return String(cadena).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Las comprobaciones, en el orden en el que se enseñan.
 *
 * Cada una:
 *
 * - `id`: cómo se llama. Es lo que se guarda en los ajustes y lo que busca la
 *   traducción del mensaje, así que no se cambia una vez publicado.
 * - `gravedad`: `error` es algo que no se puede entregar así —dos subtítulos
 *   encima, un paréntesis sin cerrar—; `aviso` es algo que hay que mirar.
 * - `deFabrica`: si viene encendida. Están encendidas las que se revisan en
 *   cualquier encargo. Las demás existen para quien las quiera: encenderlas
 *   todas de salida llena la lista de avisos el primer día y entonces no se
 *   mira ninguno.
 * - `limite`: el nombre del límite que usa, si usa alguno.
 * - `mira`: `'siguiente'` si necesita el subtítulo de al lado, `'original'` si
 *   compara con el original, y nada si le basta con la traducción.
 * - `comprueba`: devuelve `null` si está bien, o los datos que hacen falta para
 *   escribir el mensaje.
 */
export const REGLAS = [
    {
        id: 'cps',
        gravedad: 'error',
        deFabrica: true,
        limite: 'cps',
        comprueba: ({ entrada, limites }) => {
            // El CPS se cuenta sobre lo que se lee: las etiquetas y los saltos
            // de línea no se leen, así que no cuentan.
            const cps = Number(calculateCPS(entrada.translation, entrada.durationMs));
            return cps > limites.cps ? { cps: cps.toFixed(1), limite: limites.cps } : null;
        },
    },
    {
        id: 'largo_de_linea',
        gravedad: 'aviso',
        deFabrica: true,
        limite: 'porLinea',
        comprueba: ({ entrada, limites }) => {
            const largos = enLineas(entrada.translation).map((linea) =>
                countCharactersWithoutTags(linea),
            );
            const mayor = Math.max(0, ...largos);
            return mayor > limites.porLinea
                ? { cuantos: mayor, limite: limites.porLinea }
                : null;
        },
    },
    {
        id: 'lineas',
        gravedad: 'aviso',
        deFabrica: false,
        limite: 'lineas',
        comprueba: ({ entrada, limites }) => {
            const cuantas = enLineas(entrada.translation).filter((l) => l.trim()).length;
            return cuantas > limites.lineas ? { cuantas, limite: limites.lineas } : null;
        },
    },
    {
        id: 'etiquetas',
        gravedad: 'aviso',
        deFabrica: true,
        mira: 'original',
        comprueba: ({ entrada }) => {
            // Se compara lo que las etiquetas significan, no cómo están
            // escritas: un `<i>` del editor y un `{\i1}` de un ASS son la misma
            // cursiva, y compararlas por su nombre daría un aviso falso en cada
            // subtítulo de un ASS o de un TTML.
            const etiquetas = compararEtiquetas(entrada.original, entrada.translation);
            return etiquetas.faltan.length || etiquetas.sobran.length ? { etiquetas } : null;
        },
    },
    {
        id: 'solapamiento',
        gravedad: 'error',
        deFabrica: true,
        mira: 'siguiente',
        comprueba: ({ entrada, siguiente }) =>
            siguiente.startTimeMs < entrada.endTimeMs
                ? { cuanto: entrada.endTimeMs - siguiente.startTimeMs }
                : null,
    },
    {
        id: 'hueco',
        gravedad: 'aviso',
        deFabrica: false,
        limite: 'huecoMaximoMs',
        mira: 'siguiente',
        comprueba: ({ entrada, siguiente, limites }) => {
            const hueco = siguiente.startTimeMs - entrada.endTimeMs;
            return hueco > limites.huecoMaximoMs
                ? { cuanto: hueco, limite: limites.huecoMaximoMs }
                : null;
        },
    },
    {
        id: 'hueco_minimo',
        gravedad: 'error',
        deFabrica: false,
        limite: 'huecoMinimoMs',
        mira: 'siguiente',
        comprueba: ({ entrada, siguiente, limites }) => {
            const hueco = siguiente.startTimeMs - entrada.endTimeMs;
            // Si se solapan no es que estén demasiado juntos: es otra cosa, y
            // ya lo cuenta `solapamiento`. Decirlo dos veces con dos nombres
            // distintos es lo que hace que se deje de leer la lista.
            if (hueco < 0) return null;
            return hueco < limites.huecoMinimoMs
                ? { cuanto: hueco, limite: limites.huecoMinimoMs }
                : null;
        },
    },
    {
        id: 'duracion_minima',
        gravedad: 'error',
        deFabrica: true,
        limite: 'duracionMinimaMs',
        comprueba: ({ entrada, limites }) =>
            entrada.durationMs < limites.duracionMinimaMs
                ? { cuanto: entrada.durationMs, limite: limites.duracionMinimaMs }
                : null,
    },
    {
        id: 'duracion_maxima',
        gravedad: 'aviso',
        deFabrica: false,
        limite: 'duracionMaximaMs',
        comprueba: ({ entrada, limites }) =>
            entrada.durationMs > limites.duracionMaximaMs
                ? { cuanto: entrada.durationMs, limite: limites.duracionMaximaMs }
                : null,
    },
    {
        id: 'velocidad',
        gravedad: 'aviso',
        deFabrica: false,
        limite: 'palabrasPorMinuto',
        comprueba: ({ entrada, limites }) => {
            const palabras = countWords(comoSeLee(entrada.translation));
            const segundos = entrada.durationMs / 1000;
            if (!palabras || segundos <= 0) return null;
            const ppm = Math.round((palabras / segundos) * 60);
            return ppm > limites.palabrasPorMinuto
                ? { ppm, limite: limites.palabrasPorMinuto }
                : null;
        },
    },
    {
        id: 'sin_traducir',
        gravedad: 'aviso',
        deFabrica: true,
        comprueba: ({ entrada }) => {
            // Solo si el original tenía algo que traducir: un subtítulo vacío
            // en los dos lados está vacío a propósito.
            const hayOriginal = comoSeLee(entrada.original).trim().length > 0;
            const hayTraduccion = comoSeLee(entrada.translation).trim().length > 0;
            return hayOriginal && !hayTraduccion ? {} : null;
        },
    },
    {
        id: 'repetido',
        gravedad: 'aviso',
        deFabrica: false,
        mira: 'anterior',
        comprueba: ({ entrada, anterior }) => {
            const suyo = comoSeLee(entrada.translation).trim();
            if (!suyo) return null;
            return suyo === comoSeLee(anterior.translation).trim()
                ? { numero: anterior.index }
                : null;
        },
    },
    {
        id: 'espacios',
        gravedad: 'aviso',
        deFabrica: false,
        comprueba: ({ entrada }) => {
            const texto = comoSeLee(entrada.translation);
            if (!texto) return null;
            // Por línea, no del subtítulo entero: un espacio al final de la
            // primera línea no se ve y sí cuenta para el recuento.
            const sobra = enLineas(entrada.translation).some(
                (linea) => linea && linea !== linea.trim(),
            );
            return sobra ? {} : null;
        },
    },
    {
        id: 'espacios_dobles',
        gravedad: 'aviso',
        deFabrica: false,
        comprueba: ({ entrada }) => (/ {2,}/.test(comoSeLee(entrada.translation)) ? {} : null),
    },
    {
        id: 'puntos_suspensivos',
        gravedad: 'aviso',
        deFabrica: false,
        comprueba: ({ entrada }) => {
            const texto = comoSeLee(entrada.translation);
            // Los dos en el mismo encargo es lo que hay que cazar: o todos con
            // el carácter de puntos suspensivos o todos con tres puntos, pero no
            // mezclados, que es lo que pasa cuando lo escriben dos personas.
            return /\.{3,}/.test(texto) && texto.includes('…') ? {} : null;
        },
    },
    {
        id: 'mayusculas',
        gravedad: 'aviso',
        deFabrica: false,
        comprueba: ({ entrada }) => {
            const texto = comoSeLee(entrada.translation);
            // Con las letras de verdad, no solo las de la A a la Z: en español
            // "ÑOÑO" y "ÁGUILA" son mayúsculas, y mirando solo el alfabeto
            // inglés se cuentan mal o no se cuentan.
            const letras = texto.match(/\p{L}/gu) || [];
            if (letras.length < 4) return null;
            const enAlta = letras.filter((l) => l !== l.toLowerCase()).length;
            const parte = enAlta / letras.length;
            return parte > 0.8 ? { porciento: Math.round(parte * 100) } : null;
        },
    },
    {
        id: 'parentesis',
        gravedad: 'error',
        deFabrica: false,
        comprueba: ({ entrada }) => {
            const texto = comoSeLee(entrada.translation);
            for (const [abre, cierra] of [['(', ')'], ['[', ']'], ['{', '}'], ['¿', '?'], ['¡', '!']]) {
                const cuantosAbren = texto.split(abre).length - 1;
                const cuantosCierran = texto.split(cierra).length - 1;
                // Los signos de apertura del español solo se comprueban si hay
                // alguno: una frase en inglés sin "¿" no es un error.
                if (['¿', '¡'].includes(abre) && cuantosAbren === 0) continue;
                if (cuantosAbren !== cuantosCierran) return { abre, cierra };
            }
            return null;
        },
    },
    {
        id: 'numeros',
        gravedad: 'aviso',
        deFabrica: false,
        mira: 'original',
        comprueba: ({ entrada }) => {
            const enElOriginal = comoSeLee(entrada.original).match(/\d+/g) || [];
            if (!enElOriginal.length) return null;
            const cifrasTraducidas = comoSeLee(entrada.translation).replace(/\D/g, '');
            const faltan = [...new Set(enElOriginal.filter((n) => !cifrasTraducidas.includes(n)))];
            return faltan.length ? { faltan } : null;
        },
    },
    {
        id: 'espacios_en_los_bordes',
        gravedad: 'aviso',
        deFabrica: false,
        mira: 'original',
        comprueba: ({ entrada }) => {
            // Un subtítulo que continúa en el siguiente a veces lleva un espacio
            // a propósito al principio o al final. Si el original lo lleva y la
            // traducción no, o al revés, las dos frases se pegan al juntarse.
            const original = comoSeLee(entrada.original);
            const traduccion = comoSeLee(entrada.translation);
            if (!original) return null;
            const empieza = /^\s/.test(original) !== /^\s/.test(traduccion);
            const acaba = /\s$/.test(original) !== /\s$/.test(traduccion);
            return empieza || acaba ? {} : null;
        },
    },
    {
        id: 'glosario',
        gravedad: 'aviso',
        deFabrica: false,
        mira: 'original',
        comprueba: ({ entrada, glosario }) => {
            if (!glosario?.length) return null;
            const original = comoSeLee(entrada.original);
            const traduccion = comoSeLee(entrada.translation);
            if (!original.trim()) return null;

            const faltan = [];
            for (const termino of glosario) {
                if (!termino?.srcTerm || !termino?.tgtTerm) continue;
                const estaEnElOriginal = new RegExp(`\\b${escapar(termino.srcTerm)}\\b`, 'iu');
                if (!estaEnElOriginal.test(original)) continue;
                const estaEnLaTraduccion = new RegExp(`\\b${escapar(termino.tgtTerm)}\\b`, 'iu');
                if (!estaEnLaTraduccion.test(traduccion)) faltan.push(termino.tgtTerm);
            }
            return faltan.length ? { faltan } : null;
        },
    },
];

/** Las reglas por su id, para no recorrer la lista cada vez. */
const PORSUID = Object.fromEntries(REGLAS.map((r) => [r.id, r]));

/** @param {string} id @returns {Object|undefined} */
export const reglaPorId = (id) => PORSUID[id];

/** Las que vienen encendidas de fábrica. */
export function lasDeFabrica() {
    return Object.fromEntries(REGLAS.map((r) => [r.id, Boolean(r.deFabrica)]));
}

/**
 * Revisa todos los subtítulos.
 *
 * @param {Array<Object>} entradas
 * Se pasan **todas** las reglas, también las que estén apagadas. Apagar una es
 * decir "esto no me lo enseñes", no "esto no lo mires": el número que va al
 * lado de un filtro apagado tiene que decir cuántos verías si lo encendieras, y
 * si no se hubiera mirado diría cero siempre. Un cero que no significa nada es
 * peor que ningún número, porque nadie enciende un filtro que dice cero.
 *
 * Quedarse con las encendidas es cosa de `soloLasEncendidas`.
 *
 * @param {Object} [opciones]
 * @param {Object} [opciones.limites] Los de `LIMITES_DE_FABRICA`, cambiados.
 * @param {Array<{srcTerm: string, tgtTerm: string}>} [opciones.glosario]
 * @returns {Array<{indice: number, numero: number, regla: string, gravedad: string, datos: Object}>}
 *   Uno por cada cosa que haya que mirar, en el orden de los subtítulos. El
 *   mensaje no va aquí: van los datos, y el texto lo pone la interfaz en el
 *   idioma que toque.
 */
export function revisar(entradas, opciones = {}) {
    const limites = { ...LIMITES_DE_FABRICA, ...(opciones.limites || {}) };
    const glosario = opciones.glosario || null;
    const lista = Array.isArray(entradas) ? entradas : [];

    const salen = [];

    lista.forEach((entrada, indice) => {
        const siguiente = lista[indice + 1];
        const anterior = lista[indice - 1];

        for (const regla of REGLAS) {
            if (regla.mira === 'siguiente' && !siguiente) continue;
            if (regla.mira === 'anterior' && !anterior) continue;

            // Las que comparan con el original callan mientras no haya
            // traducción: eso ya lo cuenta `sin_traducir`, y repetirlo llena la
            // lista de avisos que dicen todos lo mismo.
            if (regla.mira === 'original' && !comoSeLee(entrada.translation).trim()) continue;

            const datos = regla.comprueba({ entrada, siguiente, anterior, limites, glosario });
            if (!datos) continue;

            salen.push({
                indice,
                numero: entrada.index ?? indice + 1,
                regla: regla.id,
                gravedad: regla.gravedad,
                datos,
            });
        }
    });

    return salen;
}

/**
 * Se queda con lo que hay que enseñar.
 *
 * @param {Array<Object>} loQueSale Todo lo que ha devuelto `revisar`.
 * @param {Object<string, boolean>} [encendidas]
 * @returns {Array<Object>}
 */
export function soloLasEncendidas(loQueSale, encendidas) {
    const cuales = { ...lasDeFabrica(), ...(encendidas || {}) };
    return (loQueSale || []).filter((uno) => cuales[uno.regla]);
}

/**
 * Cuántos hay de cada regla, para el contador de cada filtro.
 *
 * Se cuentan sobre todo lo que ha salido, no sobre lo que se está enseñando:
 * el número de al lado de un filtro apagado tiene que decir cuántos verías si
 * lo encendieras.
 *
 * @param {Array<Object>} loQueSale
 * @returns {Object<string, number>}
 */
export function cuantosDeCada(loQueSale) {
    const cuenta = {};
    for (const uno of loQueSale || []) {
        cuenta[uno.regla] = (cuenta[uno.regla] || 0) + 1;
    }
    return cuenta;
}
