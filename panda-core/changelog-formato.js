/**
 * Da forma al changelog para la ventana de una herramienta.
 *
 * Entiende dos formatos, porque ahora mismo conviven (AGENTS.md §8.3):
 *
 * - **El nuevo**, Markdown de verdad: un `#` con el nombre de la herramienta,
 *   un `##` por versión, la fecha en cursiva, `###` por apartado y puntos con
 *   `-`. La estructura está dicha en el archivo, no se adivina.
 * - **El de siempre**, texto plano pensado para leerse en un editor: rayas de
 *   iguales para separar versiones, una palabra suelta como título de apartado
 *   y párrafos corridos debajo. Ahí la estructura se deduce de la forma del
 *   texto —y no de una lista de palabras fijas, para que siga funcionando
 *   cuando aparezca un apartado nuevo—. Se podrá retirar cuando no quede
 *   ningún `.txt`.
 *
 * En los dos casos el resultado es el mismo HTML: cada versión con su título y
 * su fecha, cada apartado con su encabezado y cada novedad como un punto de una
 * lista. El archivo no cambia; lo único que cambia es cómo se presenta.
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
 * Escapa y marca lo poco que se marca: `esto` es código, **esto** va en negrita
 * y *esto* en cursiva. Sin esto los asteriscos y las comillas se leían tal cual
 * en medio de la frase.
 *
 * El orden importa: primero el código, que dentro puede llevar asteriscos que
 * no son marcas; después la negrita, que se come sus dos asteriscos; y solo al
 * final la cursiva, que ya no se encuentra con los de la negrita.
 */
function comoHtml(texto) {
    return escapar(texto)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

/**
 * ¿Es uno de los changelogs nuevos, escritos en Markdown de verdad?
 *
 * Se mira la primera línea con algo escrito: los nuevos empiezan por un `#` con
 * el nombre de la herramienta y los viejos por una raya de iguales. No vale con
 * buscar un `##` en cualquier parte, porque alguna entrada antigua ya traía uno
 * suelto en medio.
 *
 * @param {string} texto
 * @returns {boolean}
 */
function esMarkdown(texto) {
    const primera = texto.split('\n').find((l) => l.trim());
    return Boolean(primera && /^#\s+\S/.test(primera.trim()));
}

/**
 * Une los renglones que son continuación del anterior.
 *
 * Los archivos se escriben con las líneas cortadas a unas ochenta columnas para
 * poder leerlos en un editor, pero un punto de la lista es un punto aunque
 * ocupe tres renglones. Lo que nunca se une: lo que empieza por `#` o por `-`,
 * que ahí empieza algo nuevo.
 *
 * @param {string[]} lineas
 * @returns {string[]}
 */
function unirLosRenglonesPartidos(lineas) {
    const EMPIEZA_ALGO = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```)/;
    const salida = [];

    for (const cruda of lineas) {
        const linea = cruda.trim();
        const anterior = salida.length ? salida[salida.length - 1] : null;

        const continua =
            anterior !== null &&
            anterior.trim() !== '' &&
            linea !== '' &&
            // Lo que empieza por marca no continúa nada: abre algo nuevo.
            !EMPIEZA_ALGO.test(linea) &&
            // Y un título ocupa su renglón entero: nada se le pega detrás.
            !/^#{1,6}\s/.test(anterior.trim());

        if (continua) {
            salida[salida.length - 1] = `${anterior.replace(/\s+$/, '')} ${linea}`;
        } else {
            salida.push(cruda);
        }
    }

    return salida;
}

/**
 * Da forma a un changelog escrito en Markdown.
 *
 * Se admite lo justo, que es lo que dice AGENTS.md §8.2 que se escribe: un `#`
 * con el nombre de la herramienta, un `##` por versión, la fecha en cursiva,
 * `###` por apartado y puntos con `-`. Ni enlaces, ni imágenes, ni tablas: un
 * changelog que necesita una tabla es un changelog mal escrito.
 *
 * @param {string} texto
 * @returns {string} HTML
 */
function formatearMarkdown(texto) {
    const lineas = unirLosRenglonesPartidos(texto.split('\n'));
    const partes = [];
    let listaAbierta = false;

    const cerrarLista = () => {
        if (listaAbierta) {
            partes.push('</ul>');
            listaAbierta = false;
        }
    };

    for (const cruda of lineas) {
        const linea = cruda.trim();
        if (!linea) continue;

        const titulo = linea.match(/^(#{1,6})\s+(.*)$/);
        if (titulo) {
            cerrarLista();
            const nivel = titulo[1].length;
            // El `#` de arriba es el nombre de la herramienta. En la ventana
            // sobra: ya lo dice el botón que la ha abierto.
            if (nivel === 1) continue;
            const clase = nivel === 2 ? 'cl-version' : 'cl-seccion';
            const etiqueta = nivel === 2 ? 'h3' : 'h4';
            partes.push(`<${etiqueta} class="${clase}">${comoHtml(titulo[2])}</${etiqueta}>`);
            continue;
        }

        // Una línea entera en cursiva es la fecha de la versión.
        const fecha = linea.match(/^\*([^*]+)\*$/);
        if (fecha) {
            cerrarLista();
            partes.push(`<p class="cl-fecha">${comoHtml(fecha[1])}</p>`);
            continue;
        }

        // Los puntos, con guion o numerados. Los numerados se pintan como los
        // demás: la ventana los enseña con su propia viñeta, y el número sirve
        // sobre todo al leer el archivo en GitHub.
        const punto = linea.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
        if (punto) {
            if (!listaAbierta) {
                partes.push('<ul class="cl-lista">');
                listaAbierta = true;
            }
            partes.push(`<li>${comoHtml(punto[1])}</li>`);
            continue;
        }

        cerrarLista();
        partes.push(`<p class="cl-entradilla">${comoHtml(linea)}</p>`);
    }

    cerrarLista();
    return partes.join('\n');
}

/**
 * Convierte el texto del changelog en HTML con títulos, secciones y listas.
 *
 * Entiende los dos: el Markdown de los changelogs nuevos y el texto plano con
 * rayas de los de siempre. Lo segundo se podrá retirar cuando no quede ningún
 * `.txt` (ver AGENTS.md §8.3).
 *
 * @param {string} texto Contenido del changelog.
 * @returns {string} HTML listo para meter en la ventana.
 */
export function formatearChangelog(texto) {
    if (!texto || !texto.trim()) return '';
    if (esMarkdown(texto)) return formatearMarkdown(texto);

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
