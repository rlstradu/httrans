/**
 * Los idiomas que el propio archivo declara.
 *
 * Muchos formatos ya dicen de qué idioma a qué idioma van, y preguntárselo a
 * quien traduce cuando el archivo ya lo lleva escrito es hacerle teclear un
 * dato que está a la vista. Lo que se saca de aquí no se aplica a la callada:
 * se usa para dejar el cuadro relleno, y ahí se confirma o se corrige. Una
 * cabecera equivocada es de las cosas más frecuentes que trae un archivo, y
 * enterarse al abrirlo cuesta un segundo mientras que enterarse al entregarlo
 * cuesta el encargo.
 *
 * Lo que no declara nada —un .docx, un .json, un .csv— devuelve dos cadenas
 * vacías y no pasa nada: el cuadro se rellena con el último par usado.
 */
import { normalizarIdioma } from './idiomas.js';

/** Solo hace falta mirar el principio del archivo: la cabecera va arriba. */
const ASOMARSE = 4000;

/** El primer grupo de la primera expresión que case, normalizado. */
function primero(texto, expresiones) {
    for (const expresion of expresiones) {
        const encontrado = texto.match(expresion);
        if (encontrado && encontrado[1]) {
            const codigo = normalizarIdioma(encontrado[1]);
            if (codigo) return codigo;
        }
    }
    return '';
}

const LECTORES = {
    // gettext declara el idioma de destino en la cabecera. El de origen casi
    // nunca está, así que se deja en blanco en lugar de dar por hecho inglés:
    // un .po de un proyecto español traducido al catalán existe, y suponerle
    // inglés sería meterle un dato falso al proyecto.
    po: (texto) => ({
        origen: primero(texto, [/"X-Source-Language:\s*([^\\"\s]+)/i]),
        destino: primero(texto, [/"Language:\s*([^\\"\s]+)/i]),
    }),

    // XLIFF 1.2 usa source-language/target-language; XLIFF 2.0, srcLang/trgLang.
    // Los sabores de las herramientas comerciales (sdlxliff, mxliff, mqxliff)
    // son XLIFF por dentro y declaran igual.
    xliff: (texto) => ({
        origen: primero(texto, [
            /\bsource-language\s*=\s*"([^"]*)"/i,
            /\bsrcLang\s*=\s*"([^"]*)"/i,
        ]),
        destino: primero(texto, [
            /\btarget-language\s*=\s*"([^"]*)"/i,
            /\btrgLang\s*=\s*"([^"]*)"/i,
        ]),
    }),

    // Qt lo pone en la etiqueta <TS>.
    qtts: (texto) => ({
        origen: primero(texto, [/\bsourcelanguage\s*=\s*"([^"]*)"/i]),
        destino: primero(texto, [/<TS\b[^>]*\blanguage\s*=\s*"([^"]*)"/i]),
    }),

    // Los .arb de Flutter llevan el destino en @@locale.
    arb: (texto) => ({
        origen: '',
        destino: primero(texto, [/"@@locale"\s*:\s*"([^"]*)"/]),
    }),

    // Los .resx localizados llevan el idioma en el nombre del archivo
    // (Strings.es-ES.resx), no dentro; eso lo mira idiomasDelNombre.
};

LECTORES.sdlxliff = LECTORES.xliff;
LECTORES.mxliff = LECTORES.xliff;
LECTORES.mqxliff = LECTORES.xliff;

/**
 * Lee los idiomas declarados dentro del archivo.
 *
 * @param {string} formato Identificador de core/formatos.js.
 * @param {string|ArrayBuffer} contenido Lo que se leyó del archivo.
 * @returns {{origen: string, destino: string}}
 */
export function idiomasDeclarados(formato, contenido) {
    const lector = LECTORES[String(formato || '').toLowerCase()];
    if (!lector || typeof contenido !== 'string') return { origen: '', destino: '' };

    return lector(contenido.slice(0, ASOMARSE));
}

/**
 * Lee el idioma que va en el nombre del archivo.
 *
 * Es la costumbre de medio sector: Strings.es-ES.resx, mensajes.fr.properties,
 * app_pt_BR.arb, es.json. Cuando el archivo no declara nada por dentro, esto
 * suele acertar, y equivocarse solo cuesta corregir un desplegable.
 *
 * @param {string} nombre Nombre del archivo, con extensión.
 * @returns {string} El código, o cadena vacía.
 */
export function idiomaDelNombre(nombre) {
    const sinExtension = String(nombre || '').replace(/\.[^.]+$/, '');
    // Se mira solo el último trozo separado por punto, guion o guion bajo: en
    // "app_pt_BR" el trozo útil es "pt_BR", y en "Strings.es-ES", "es-ES".
    const trozos = sinExtension.split(/[._-]/);

    for (let i = trozos.length; i > 0; i -= 1) {
        // Se prueba primero con dos trozos ("pt", "BR") y luego con uno, para
        // que un "pt_BR" no se quede en un "pt" a medias.
        for (const cuantos of [2, 1]) {
            if (i - cuantos < 0) continue;
            const candidato = trozos.slice(i - cuantos, i).join('-');
            // Una sola letra o una palabra normal no son un idioma; se exige la
            // forma de una etiqueta y que el navegador la reconozca.
            const codigo = normalizarIdioma(candidato);
            if (!codigo || !esIdiomaConocido(codigo)) continue;
            // Solo códigos de dos letras. Los de tres son idiomas de verdad
            // ("min" es el minangkabáu), pero en el nombre de un archivo son
            // casi siempre otra cosa —bundle.min.js, api.json, src.resx— y
            // colar un idioma equivocado es peor que no adivinar ninguno.
            if (codigo.split('-')[0].length !== 2) continue;
            return codigo;
        }
    }

    return '';
}

/**
 * ¿El navegador reconoce este código como un idioma de verdad?
 *
 * Sirve para no confundir un trozo cualquiera del nombre del archivo con una
 * etiqueta de idioma: "app", "min" o "new" tienen forma de código y no lo son.
 *
 * @param {string} codigo
 * @returns {boolean}
 */
export function esIdiomaConocido(codigo) {
    try {
        const nombres = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
        const nombre = nombres.of(codigo);
        // Cuando Intl no lo conoce devuelve undefined con fallback 'none'. Y
        // cuando lo conoce a medias devuelve el propio código, que tampoco
        // sirve como confirmación.
        return Boolean(nombre) && nombre !== codigo;
    } catch {
        return false;
    }
}

/**
 * Lo mejor que se puede saber de un archivo antes de preguntar.
 *
 * @param {{formato: string, nombre: string, contenido: string|ArrayBuffer}} archivo
 * @returns {{origen: string, destino: string}}
 */
export function adivinarIdiomas({ formato, nombre, contenido }) {
    const declarados = idiomasDeclarados(formato, contenido);
    return {
        origen: declarados.origen,
        destino: declarados.destino || idiomaDelNombre(nombre),
    };
}
