/**
 * Etiquetas indivisibles dentro del cuadro de traducción.
 *
 * En Trados y en memoQ una etiqueta es una pieza: pulsas retroceso encima y
 * desaparece entera. No hay forma de dejarse un "<a hre=" a medias, y eso vale
 * más de lo que parece, porque media etiqueta rompe el archivo igual que una
 * etiqueta ausente pero no se ve al leer la traducción.
 *
 * CÓMO SE CONSIGUE SIN CAMBIAR EL CUADRO DE TEXTO
 *
 * Lo normal en una herramienta TAO es hacer el campo `contenteditable` y meter
 * las etiquetas como elementos indivisibles. Es lo que hace Locversia, y su
 * propia documentación lo llama "the most failure-prone part of the editor": el
 * problema no son las fichas, es el cursor dentro de un campo que tiene
 * elementos indivisibles. Entre otras cosas, reconstruir ese campo mientras se
 * está componiendo una tilde congela el acento y escribe ´ en lugar de é.
 * Escribir en español, vamos.
 *
 * Aquí se hace de otra manera. El cuadro sigue siendo un <textarea> normal y lo
 * único que se hace es, cuando una tecla iba a partir una etiqueta, **ampliar la
 * selección** para que abarque la etiqueta entera antes de que el navegador
 * haga su trabajo. La edición la sigue haciendo él, así que:
 *
 * - El deshacer de siempre sigue funcionando (no se falsifica ninguna edición).
 * - Las tildes y los métodos de entrada asiáticos no se enteran de nada, porque
 *   durante una composición este módulo no interviene.
 *
 * Este archivo solo decide qué trozo hay que seleccionar. Quien mueve la
 * selección de verdad es ui/etiquetas-campo.js.
 */
import { extraerEtiquetas } from './etiquetas.js';

/** Teclas que borran hacia atrás y hacia delante. */
const RETROCESO = 'Backspace';
const SUPRIMIR = 'Delete';

/** Cualquier tecla que escriba un carácter llega aquí como 'texto'. */
const TEXTO = 'texto';

/**
 * Decide qué hay que seleccionar antes de dejar que el navegador edite.
 *
 * @param {object} opciones
 * @param {string} opciones.texto Contenido actual del cuadro.
 * @param {number} opciones.inicio Principio de la selección (o del cursor).
 * @param {number} opciones.fin Final de la selección (igual al principio si no
 *   hay nada seleccionado).
 * @param {string} opciones.tecla 'Backspace', 'Delete' o 'texto'.
 * @param {{id: string, familias: string[]}} opciones.perfil Perfil del formato.
 * @returns {{inicio: number, fin: number}|null} La selección que hay que poner,
 *   o null si no hay que tocar nada.
 */
export function ajusteDeSeleccion({ texto, inicio, fin, tecla, perfil }) {
    if (tecla !== RETROCESO && tecla !== SUPRIMIR && tecla !== TEXTO) return null;

    const cadena = String(texto ?? '');
    if (!cadena) return null;

    const etiquetas = extraerEtiquetas(cadena, perfil);
    if (etiquetas.length === 0) return null;

    // Con algo seleccionado, lo que importa es que la selección no corte
    // ninguna etiqueta por la mitad: da igual si se va a borrar o a sustituir
    // escribiendo encima, el resultado sería el mismo trozo de etiqueta suelto.
    if (inicio !== fin) {
        return ampliarHastaAbarcar(etiquetas, inicio, fin);
    }

    const posicion = inicio;
    const dentro = etiquetas.find((e) => e.inicio < posicion && posicion < e.fin);

    if (tecla === TEXTO) {
        // Escribir dentro de una etiqueta la convertiría en otra cosa. En lugar
        // de tragarse la tecla, se saca el cursor al final de la etiqueta y la
        // letra se escribe ahí: se pierde menos que bloqueando sin más.
        return dentro ? { inicio: dentro.fin, fin: dentro.fin } : null;
    }

    if (dentro) return { inicio: dentro.inicio, fin: dentro.fin };

    // Pegado por fuera: el retroceso mira la etiqueta que acaba de terminar y
    // suprimir la que va a empezar. Pegado por el otro lado no se hace nada, que
    // ahí lo que hay que borrar es el carácter de al lado.
    const pegada =
        tecla === RETROCESO
            ? etiquetas.find((e) => e.fin === posicion)
            : etiquetas.find((e) => e.inicio === posicion);

    return pegada ? { inicio: pegada.inicio, fin: pegada.fin } : null;
}

/**
 * Estira la selección hasta que no corte ninguna etiqueta por la mitad.
 *
 * @param {Array} etiquetas
 * @param {number} inicio
 * @param {number} fin
 * @returns {{inicio: number, fin: number}|null} null si ya estaba bien.
 */
function ampliarHastaAbarcar(etiquetas, inicio, fin) {
    let nuevoInicio = inicio;
    let nuevoFin = fin;

    for (const etiqueta of etiquetas) {
        // Se solapan pero la etiqueta no cabe entera dentro de la selección.
        const seSolapan = etiqueta.inicio < nuevoFin && etiqueta.fin > nuevoInicio;
        if (!seSolapan) continue;

        nuevoInicio = Math.min(nuevoInicio, etiqueta.inicio);
        nuevoFin = Math.max(nuevoFin, etiqueta.fin);
    }

    if (nuevoInicio === inicio && nuevoFin === fin) return null;
    return { inicio: nuevoInicio, fin: nuevoFin };
}
