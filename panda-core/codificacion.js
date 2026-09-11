/**
 * Con qué alfabeto está escrito el archivo.
 *
 * Un .srt son bytes, y los mismos bytes dicen cosas distintas según cómo se
 * lean. La herramienta los leía siempre como UTF-8, que es lo que usa casi todo
 * hoy; pero por ahí siguen circulando archivos hechos con programas de
 * subtitulado antiguos, que escriben en Windows-1252, y algunos que salen de
 * Windows en UTF-16. Leídos como UTF-8, «canción» llega convertida en
 * «canci�n» y no hay manera de recuperarla después: para cuando el texto está
 * en pantalla, el byte que faltaba ya se ha perdido.
 *
 * Aquí se mira el archivo antes de leerlo y se decide con qué alfabeto se lee.
 *
 * Lo que NO se hace es adivinar mucho: solo hay tres caminos, y el último es
 * una red de seguridad. Si los bytes son UTF-8 válido, es UTF-8 —un texto en
 * Windows-1252 con acentos casi nunca es UTF-8 válido por casualidad, porque
 * los acentos sueltos no forman secuencias válidas—. Si no lo son, se lee como
 * Windows-1252, que es lo que escribían esos programas y donde todo byte
 * significa algo.
 */

/** Las marcas con las que un archivo dice con qué alfabeto está escrito. */
const MARCAS = [
    { bytes: [0xef, 0xbb, 0xbf], codificacion: 'utf-8', largo: 3 },
    { bytes: [0xff, 0xfe], codificacion: 'utf-16le', largo: 2 },
    { bytes: [0xfe, 0xff], codificacion: 'utf-16be', largo: 2 },
];

/**
 * Lee los bytes de un archivo de subtítulos.
 *
 * @param {ArrayBuffer|Uint8Array} datos
 * @returns {{texto: string, codificacion: string, conBom: boolean}}
 *   `codificacion` es con la que se ha leído; `conBom`, si el archivo traía la
 *   marca del principio, para poder devolvérsela al guardar.
 */
export function leerSubtitulos(datos) {
    const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);

    for (const marca of MARCAS) {
        if (marca.bytes.every((byte, i) => bytes[i] === byte)) {
            return {
                // El decodificador se come la marca él solo; se le pasan los
                // bytes enteros para que sepa el orden en el caso de UTF-16.
                texto: new TextDecoder(marca.codificacion).decode(bytes),
                codificacion: marca.codificacion,
                conBom: true,
            };
        }
    }

    // Sin marca: UTF-8 si de verdad lo es. `fatal` es lo que hace que esto sea
    // una comprobación y no una suposición: sin él, un byte imposible se
    // convertiría calladamente en un rombo con una interrogación.
    try {
        return {
            texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
            codificacion: 'utf-8',
            conBom: false,
        };
    } catch {
        return {
            texto: new TextDecoder('windows-1252').decode(bytes),
            codificacion: 'windows-1252',
            conBom: false,
        };
    }
}

/**
 * Los bytes de un archivo de subtítulos, listos para guardar.
 *
 * Se escribe siempre en UTF-8, venga de donde venga el original. Es lo que
 * entiende todo lo de hoy y lo único que puede con cualquier idioma: devolver un
 * archivo en Windows-1252 obligaría a decidir qué hacer con cada carácter que no
 * cabe en él, y una traducción al polaco o al ruso se quedaría por el camino
 * letra a letra sin que nadie se enterara hasta verlo en pantalla.
 *
 * La marca del principio sí se conserva: es lo que espera de vuelta quien
 * trabaja con herramientas de Windows, y algún control de calidad de plataforma
 * la mira.
 *
 * @param {string} texto
 * @param {{conBom?: boolean}} [formato]
 * @returns {Blob}
 */
export function guardarSubtitulos(texto, { conBom = false } = {}) {
    const trozos = conBom ? ['﻿', texto] : [texto];
    return new Blob(trozos, { type: 'text/plain;charset=utf-8' });
}
