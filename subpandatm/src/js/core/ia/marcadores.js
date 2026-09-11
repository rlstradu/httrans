/**
 * Proteger las etiquetas antes de mandarle un texto a una IA.
 *
 * Este es el problema serio de traducir con IA, y no se arregla pidiéndoselo
 * por favor. A un modelo le mandas:
 *
 *     Pulsa %s para guardar <b>ahora</b>
 *
 * y te devuelve, tarde o temprano, `%S`, `% s`, `<B>` o directamente se deja el
 * cierre. Cualquiera de esas cuatro cosas rompe el archivo, y algunas no se ven
 * al leer la traducción: se ven cuando el programa ya está publicado.
 *
 * La solución que usan las herramientas serias, y la que se hace aquí: las
 * etiquetas no se le enseñan al modelo. Se sustituyen por marcas propias antes
 * de mandar el texto y se devuelven a su sitio al recibir la respuesta:
 *
 *     ⟦0⟧Vámonos⟦1⟧, dijo, y se fue
 *
 * Las marcas usan unos corchetes matemáticos (U+27E6 y U+27E7) que no aparecen
 * en un texto normal, así que no hay forma de confundirlos con contenido. Al
 * volver se comprueba que estén todas, una sola vez cada una y sin inventar
 * ninguna; si algo no cuadra, la traducción se descarta. **Es mejor un subtítulo
 * sin traducir que uno con la cursiva rota**, porque el primero se ve en la
 * lista y el segundo solo en el vídeo terminado.
 */
import { extraerEtiquetas } from './etiquetas.js';

/** Los corchetes de las marcas. Ver arriba por qué estos. */
const ABRE = '⟦';
const CIERRA = '⟧';

/**
 * Reconoce una marca ya puesta.
 *
 * Van dos expresiones, una con la bandera global y otra sin ella, y no es un
 * descuido: una expresión global recuerda por dónde iba entre llamadas, así que
 * usar la misma para buscar y para sustituir hace que la segunda vez conteste
 * cualquier cosa. Cuesta dar con ello porque el primer segmento sale bien y el
 * siguiente no.
 */
const MARCAS = new RegExp(`${ABRE}(\\d+)${CIERRA}`, 'g');
const HAY_MARCA = new RegExp(`${ABRE}\\d+${CIERRA}`);

/**
 * Cambia las etiquetas del texto por marcas.
 *
 * @param {string} texto
 * @returns {{texto: string, etiquetas: string[]}} El texto con marcas y qué
 *   había en cada una, por orden.
 */
export function ponerMarcas(texto) {
    const cadena = String(texto ?? '');
    const etiquetas = extraerEtiquetas(cadena);
    if (etiquetas.length === 0) return { texto: cadena, etiquetas: [] };

    let salida = '';
    let cursor = 0;
    const guardadas = [];

    for (const etiqueta of etiquetas) {
        salida += cadena.slice(cursor, etiqueta.inicio);
        salida += `${ABRE}${guardadas.length}${CIERRA}`;
        guardadas.push(etiqueta.texto);
        cursor = etiqueta.fin;
    }

    return { texto: salida + cadena.slice(cursor), etiquetas: guardadas };
}

/**
 * Devuelve las etiquetas a su sitio en la respuesta del modelo.
 *
 * @param {string} texto Lo que ha contestado el modelo.
 * @param {string[]} etiquetas Las que se guardaron al poner las marcas.
 * @returns {{bien: boolean, texto: string, problema: string}} Cuando algo no
 *   cuadra, `bien` es false y `problema` dice qué, para poder reintentar o
 *   dejar el segmento en paz.
 */
export function quitarMarcas(texto, etiquetas) {
    const cadena = String(texto ?? '');
    if (etiquetas.length === 0) {
        // Sin etiquetas que devolver, lo único que puede fallar es que el
        // modelo se haya inventado una marca.
        return HAY_MARCA.test(cadena)
            ? { bien: false, texto: cadena, problema: 'marca inventada' }
            : { bien: true, texto: cadena, problema: '' };
    }

    const vistas = new Set();
    let repetida = false;
    let desconocida = false;

    const devuelto = cadena.replace(MARCAS, (_, numero) => {
        const i = Number(numero);
        if (!Number.isInteger(i) || i < 0 || i >= etiquetas.length) {
            desconocida = true;
            return '';
        }
        if (vistas.has(i)) repetida = true;
        vistas.add(i);
        return etiquetas[i];
    });

    if (desconocida) return { bien: false, texto: devuelto, problema: 'marca inventada' };
    if (repetida) return { bien: false, texto: devuelto, problema: 'marca repetida' };
    if (vistas.size !== etiquetas.length) {
        return { bien: false, texto: devuelto, problema: 'faltan marcas' };
    }
    // Una marca a medias ("⟦0", "⟦⟧") no la caza la expresión de arriba, así que
    // se mira aparte: dejarla pasar metería basura en el archivo.
    if (devuelto.includes(ABRE) || devuelto.includes(CIERRA)) {
        return { bien: false, texto: devuelto, problema: 'marca rota' };
    }

    return { bien: true, texto: devuelto, problema: '' };
}
