/**
 * La lista de idiomas que se puede elegir en Poanda.
 *
 * Aquí solo viven los **códigos**. Los nombres los pone el navegador con
 * Intl.DisplayNames, y por eso salen en el idioma de la interfaz: "Alemán" con
 * Poanda en español y "German" con Poanda en inglés, sin mantener dos listas de
 * nombres a mano ni dejar media lista sin traducir.
 *
 * Van las lenguas de la lista ISO 639-1 y, además, las variantes regionales que
 * de verdad se encargan por separado en este oficio: no es lo mismo un texto
 * para España que para México, ni un portugués de Brasil que uno de Portugal.
 * Una variante que nadie encarga por separado solo alarga el desplegable.
 *
 * El orden lo pone Intl.Collator, que ordena "Ñ" y "Ø" donde una persona
 * esperaría encontrarlas y no donde caen por número de carácter.
 */

/**
 * Las lenguas, en código ISO 639-1 (dos letras) salvo donde hace falta otra
 * cosa: fil para el filipino, nb y nn para las dos formas escritas del noruego.
 */
const LENGUAS = [
    'ab', 'aa', 'af', 'ak', 'sq', 'am', 'ar', 'an', 'hy', 'as', 'av', 'ae', 'ay', 'az',
    'bm', 'ba', 'eu', 'be', 'bn', 'bi', 'bs', 'br', 'bg', 'my',
    'ca', 'ch', 'ce', 'ny', 'zh', 'cv', 'kw', 'co', 'cr', 'hr', 'cs',
    'da', 'dv', 'nl', 'dz', 'en', 'eo', 'et', 'ee',
    'fo', 'fj', 'fi', 'fil', 'fr', 'ff', 'gl', 'ka', 'de', 'el', 'gn', 'gu',
    'ht', 'ha', 'he', 'hz', 'hi', 'ho', 'hu',
    'ia', 'id', 'ie', 'ga', 'ig', 'ik', 'io', 'is', 'it', 'iu',
    'ja', 'jv', 'kl', 'kn', 'kr', 'ks', 'kk', 'km', 'ki', 'rw', 'ky', 'kv', 'kg',
    'ko', 'ku', 'kj', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
    'gv', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mh', 'mn',
    'na', 'nv', 'nd', 'ne', 'ng', 'nb', 'nn', 'no', 'ii', 'nr',
    'oc', 'oj', 'cu', 'om', 'or', 'os',
    'pa', 'pi', 'fa', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru',
    'sa', 'sc', 'sd', 'se', 'sm', 'sg', 'sr', 'gd', 'sn', 'si', 'sk', 'sl',
    'so', 'st', 'es', 'su', 'sw', 'ss', 'sv',
    'ta', 'te', 'tg', 'th', 'ti', 'bo', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
    'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'cy', 'wo', 'fy', 'xh', 'yi', 'yo', 'za', 'zu',
];

/**
 * Las variantes que se encargan por separado. Cada una lleva su lengua base
 * delante para que en el desplegable caigan juntas.
 */
const VARIANTES = [
    'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IE', 'en-IN', 'en-NZ', 'en-ZA',
    'es-ES', 'es-419', 'es-MX', 'es-AR', 'es-CL', 'es-CO', 'es-US',
    'pt-BR', 'pt-PT',
    'fr-FR', 'fr-BE', 'fr-CA', 'fr-CH',
    'de-DE', 'de-AT', 'de-CH',
    'it-IT', 'it-CH',
    'nl-NL', 'nl-BE',
    'zh-Hans', 'zh-Hant', 'zh-CN', 'zh-TW', 'zh-HK',
    'ar-SA', 'ar-EG', 'ar-MA',
    'sr-Cyrl', 'sr-Latn',
];

/** Todos los códigos, sin repetir. */
export const CODIGOS_DE_IDIOMA = [...new Set([...LENGUAS, ...VARIANTES])];

/**
 * El nombre de un idioma en el idioma que se le pida.
 *
 * Si el navegador no conoce el código —uno inventado, o una etiqueta rara que
 * traía el archivo— se devuelve el código tal cual: enseñar "de-CH-1996" es
 * mucho mejor que enseñar un hueco o tragarse el dato.
 *
 * @param {string} codigo
 * @param {string} [idiomaDeLaInterfaz] 'es' o 'en'.
 * @returns {string}
 */
export function nombreDeIdioma(codigo, idiomaDeLaInterfaz = 'en') {
    const limpio = String(codigo || '').trim();
    if (!limpio) return '';

    try {
        const nombres = new Intl.DisplayNames([idiomaDeLaInterfaz], {
            type: 'language',
            fallback: 'none',
        });
        const nombre = nombres.of(limpio);
        if (!nombre) return limpio;
        // Intl los devuelve en minúscula en español ("alemán"); en una lista
        // desplegable quedan mejor con mayúscula inicial.
        return nombre.charAt(0).toLocaleUpperCase(idiomaDeLaInterfaz) + nombre.slice(1);
    } catch {
        return limpio;
    }
}

/**
 * La lista entera, lista para pintar un desplegable: cada idioma con su nombre
 * y su código, ordenados por nombre.
 *
 * El código va a la vista y no solo por dentro porque en este oficio se encarga
 * por código: quien pide "pt-BR" quiere ver "pt-BR", no adivinar si "Portugués
 * de Brasil" es esa etiqueta o alguna otra.
 *
 * @param {string} [idiomaDeLaInterfaz] 'es' o 'en'.
 * @returns {Array<{codigo: string, nombre: string, etiqueta: string}>}
 */
export function listaDeIdiomas(idiomaDeLaInterfaz = 'en') {
    const comparar = new Intl.Collator(idiomaDeLaInterfaz).compare;

    return CODIGOS_DE_IDIOMA.map((codigo) => {
        const nombre = nombreDeIdioma(codigo, idiomaDeLaInterfaz);
        return { codigo, nombre, etiqueta: `${nombre} (${codigo})` };
    })
        .sort((a, b) => comparar(a.nombre, b.nombre) || comparar(a.codigo, b.codigo));
}

/**
 * Normaliza una etiqueta de idioma venida de un archivo.
 *
 * Los archivos traen de todo: "es_ES" con guion bajo (lo normal en gettext),
 * "PT-br" con las mayúsculas al revés, "en_US.UTF-8" con la codificación
 * pegada detrás. Todas quieren decir lo mismo, y sin normalizarlas el par de
 * idiomas del proyecto no coincidiría nunca con lo que hay en el desplegable.
 *
 * @param {string} etiqueta
 * @returns {string} El código normalizado, o cadena vacía si no vale.
 */
export function normalizarIdioma(etiqueta) {
    const bruto = String(etiqueta || '')
        .trim()
        // La codificación y la variante de gettext van detrás de un punto o una
        // arroba: es_ES.UTF-8, ca_ES@valencia.
        .split(/[.@]/)[0]
        .replace(/_/g, '-');

    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(bruto)) return '';

    const trozos = bruto.split('-');
    const lengua = trozos[0].toLowerCase();
    const resto = trozos.slice(1).map((trozo) => {
        // Los alfabetos van en capicúa (Hans, Latn) y las regiones en mayúscula
        // (ES, BR); los números de región (419) se quedan como están.
        if (trozo.length === 4) return trozo.charAt(0).toUpperCase() + trozo.slice(1).toLowerCase();
        return trozo.toUpperCase();
    });

    return [lengua, ...resto].join('-');
}

/**
 * La lengua sin la región: "pt-BR" y "pt-PT" son los dos "pt".
 *
 * @param {string} codigo
 * @returns {string}
 */
export function baseDe(codigo) {
    return normalizarIdioma(codigo).split('-')[0];
}

/**
 * ¿Estos dos códigos hablan de la misma lengua?
 *
 * Se compara por la lengua, no por la etiqueta entera, y es a propósito. Una
 * memoria exportada de otra herramienta viene marcada "en-US" y el proyecto
 * puede estar puesto en "en"; exigir que coincidan letra por letra dejaría la
 * memoria entera sin usar y nadie entendería por qué. Un inglés americano y uno
 * británico se parecen lo bastante para proponerlos como coincidencia: quien
 * traduce decide, que para eso lo ve.
 *
 * @param {string} uno
 * @param {string} otro
 * @returns {boolean}
 */
export function mismoIdioma(uno, otro) {
    const a = baseDe(uno);
    const b = baseDe(otro);
    return Boolean(a) && a === b;
}
