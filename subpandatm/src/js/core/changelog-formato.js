/**
 * Da forma al changelog para la ventana de Poanda.
 *
 * El CHANGELOG.md es un archivo de texto plano pensado para leerse en un editor:
 * rayas de iguales para separar versiones, una palabra suelta como título de
 * sección ("New", "Fixed") y párrafos corridos debajo. Puesto tal cual en una
 * ventana pequeña es un muro de texto donde no se distingue el título de la
 * versión del cuerpo, ni una novedad de la siguiente.
 *
 * Aquí se reconoce esa estructura y se convierte en HTML: cada versión con su
 * título y su fecha, cada sección con su encabezado y cada novedad como un punto
 * de una lista. El archivo no cambia; lo único que cambia es cómo se presenta.
 *
 * La estructura se deduce de la forma del texto, no de una lista de palabras
 * fijas, para que siga funcionando cuando aparezca una sección nueva.
 */
import { desenvolverParrafos } from './text.js';

/** Una línea de tres o más iguales, guiones o guiones bajos. */
const LINEA_DE_SEPARACION = /^[=\-_*]{3,}\s*$/;

/** "Release Date: September 7, 2026" y su equivalente en español. */
const LINEA_DE_FECHA = /^(Release Date|Fecha)\s*:\s*(.+)$/i;

/**
 * Un encabezado de sección: corto, sin punto final y sin ser una frase.
 * "New", "Under the Hood", "New Features".
 */
function esEncabezado(linea) {
    const t = linea.trim();
    if (!t || t.length > 40) return false;
    // Un encabezado no termina en punto ni lleva comas: no es una frase.
    if (/[.:;,]$/.test(t) || t.includes(',')) return false;
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(t)) return false;
    // Y es un puñado de palabras, no un renglón: "New", "Under the Hood".
    return t.split(/\s+/).length <= 4;
}

/**
 * Parte "Nombre de la novedad: lo que hace" en sus dos mitades.
 *
 * Muchas entradas del changelog vienen con ese nombre delante, y destacarlo
 * permite recorrer la lista leyendo solo los nombres. Se exige que el nombre
 * sea corto y sin puntos para no partir por los dos puntos de mitad de frase.
 *
 * @returns {{titulo: string, resto: string}|null}
 */
function partirEnNombreYTexto(parrafo) {
    const corte = parrafo.indexOf(': ');
    if (corte < 0 || corte > 40) return null;

    const titulo = parrafo.slice(0, corte);
    if (/[.,;]/.test(titulo)) return null;
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(titulo)) return null;

    return { titulo, resto: parrafo.slice(corte + 2) };
}

/** Escapa lo que vaya a salir como HTML. */
function escapar(texto) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Escapa y marca lo poco que se marca: `esto` es código y **esto** va en
 * negrita. Son las dos que aparecen en el changelog escrito a mano, y sin
 * esto los asteriscos se leían tal cual en medio de la frase.
 */
function comoHtml(texto) {
    return escapar(texto)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Convierte el texto del changelog en HTML con títulos, secciones y listas.
 *
 * @param {string} texto Contenido del CHANGELOG.md.
 * @returns {string} HTML listo para meter en la ventana.
 */
export function formatearChangelog(texto) {
    if (!texto || !texto.trim()) return '';

    const lineas = desenvolverParrafos(texto).split('\n');
    const partes = [];

    // Estado del recorrido: si hay una lista abierta y si ya se ha visto un
    // encabezado de sección dentro de la versión actual (lo de antes del primer
    // encabezado es la entradilla, que se lee mejor como párrafo que como punto).
    let listaAbierta = false;
    let enSeccion = false;

    const cerrarLista = () => {
        if (listaAbierta) {
            partes.push('</ul>');
            listaAbierta = false;
        }
    };

    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i].trim();

        if (!linea) continue;

        // Las rayas de iguales enmarcan el título de la versión: se salta la
        // raya y se toma la línea siguiente como título.
        if (LINEA_DE_SEPARACION.test(linea)) {
            const siguiente = (lineas[i + 1] || '').trim();
            if (siguiente && !LINEA_DE_SEPARACION.test(siguiente)) {
                cerrarLista();
                enSeccion = false;
                partes.push(`<h3 class="cl-version">${comoHtml(siguiente)}</h3>`);
                i += 1;
            }
            continue;
        }

        const fecha = linea.match(LINEA_DE_FECHA);
        if (fecha) {
            cerrarLista();
            partes.push(`<p class="cl-fecha">${comoHtml(fecha[2])}</p>`);
            continue;
        }

        if (esEncabezado(linea)) {
            cerrarLista();
            enSeccion = true;
            partes.push(`<h4 class="cl-seccion">${comoHtml(linea)}</h4>`);
            continue;
        }

        // Entradilla de la versión: el párrafo que resume de qué va, antes de
        // que empiecen las secciones.
        if (!enSeccion) {
            cerrarLista();
            partes.push(`<p class="cl-entradilla">${comoHtml(linea)}</p>`);
            continue;
        }

        if (!listaAbierta) {
            partes.push('<ul class="cl-lista">');
            listaAbierta = true;
        }

        // Las listas que ya venían escritas con "*" o "1." en el archivo pierden
        // la marca: aquí ya son puntos de una lista de verdad.
        const sinMarca = linea.replace(/^([*\-•+]|\d+[.)])\s+/, '');
        const partido = partirEnNombreYTexto(sinMarca);

        partes.push(
            partido
                ? `<li><strong>${comoHtml(partido.titulo)}</strong> ${comoHtml(partido.resto)}</li>`
                : `<li>${comoHtml(sinMarca)}</li>`,
        );
    }

    cerrarLista();
    return partes.join('\n');
}
