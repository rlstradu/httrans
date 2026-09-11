/**
 * Los fallos de la IA, dichos en el idioma de quien los lee.
 *
 * El núcleo de la IA vive en core/ia/ y no sabe en qué idioma está la interfaz,
 * ni tiene por qué saberlo: es el mismo código que se puede probar sin navegador
 * y sin pantalla. Así que lanza sus errores con un mensaje en español y una
 * **clave**, que es el nombre del texto en la tabla de traducciones. Aquí se
 * cambia una cosa por la otra.
 *
 * Un error sin clave es uno cuyas palabras las pone el propio servicio —"Invalid
 * API key", lo que conteste OpenAI— y esas no hay forma de traducirlas: se
 * enseñan tal cual, que es mejor que esconderlas.
 */
import { state } from './state.js';
import { translations } from './translations.js';

/**
 * @param {Error|{clave?: string, mensaje?: string, message?: string, datos?: Object}} fallo
 * @returns {string} Lo que hay que enseñar.
 */
export function mensajeDeError(fallo) {
    if (!fallo) return '';

    const textos = translations[state.currentLanguage] || translations.en || {};
    const traducido = fallo.clave ? textos[fallo.clave] : '';
    const dicho = traducido || fallo.mensaje || fallo.message || '';

    // Los textos con hueco, como el del modelo que el servicio no conoce.
    return Object.entries(fallo.datos || {}).reduce(
        (texto, [nombre, valor]) => texto.replace(`{${nombre}}`, valor),
        dicho,
    );
}
