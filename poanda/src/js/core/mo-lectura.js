/**
 * Abrir archivos .mo, la versión compilada de un PO.
 *
 * Un .mo no es texto: es el mismo catálogo de traducciones guardado en binario
 * para que el programa lo lea rápido. Por dentro son dos tablas, una con los
 * originales y otra con las traducciones, y unos números que dicen dónde empieza
 * y cuánto ocupa cada cadena. El contexto va pegado al original con un carácter
 * de control (el EOT) y las formas de plural separadas por un cero.
 *
 * Poanda ya sabía escribir .mo (el "Convertir a .mo" del menú); lo que faltaba
 * era abrirlos, que es lo que hace falta cuando de un proyecto solo queda el
 * archivo compilado y se ha perdido el .po.
 *
 * Aquí no vale la regla de devolver el archivo byte a byte, y a propósito: un
 * .mo es un archivo generado, no uno escrito a mano. No lleva comentarios ni
 * orden propio que conservar (las cadenas van ordenadas alfabéticamente porque
 * el formato lo exige), así que al guardar se compila de nuevo. Lo que sí se
 * conserva es todo lo que el archivo contenía: cabecera, contextos y plurales.
 */

/** Carácter que separa el contexto del original dentro de la misma cadena. */
const SEPARADOR_DE_CONTEXTO = '\u0004';

/** Carácter que separa las formas de plural. */
const SEPARADOR_DE_PLURAL = '\u0000';

/** Los dos órdenes de byte con los que se puede haber escrito el archivo. */
const MAGICO_NORMAL = 0x950412de;
const MAGICO_AL_REVES = 0xde120495;

/**
 * Convierte un .mo en el texto de un .po equivalente.
 *
 * Se pasa por PO en lugar de construir las entradas a mano para que un .mo
 * abierto se comporte exactamente igual que el .po del que salió: los mismos
 * plurales, los mismos contextos y el mismo lector, que ya está probado.
 *
 * @param {ArrayBuffer} datos Contenido del archivo.
 * @returns {string} Texto en formato PO.
 */
export function moComoPo(datos) {
    const vista = new DataView(datos);
    if (vista.byteLength < 20) throw new Error('El archivo .mo está incompleto.');

    const magico = vista.getUint32(0, true);
    if (magico !== MAGICO_NORMAL && magico !== MAGICO_AL_REVES) {
        throw new Error('El archivo no parece un .mo de gettext.');
    }
    // Si el número mágico sale del revés, el archivo se escribió en un ordenador
    // con el otro orden de bytes y hay que leerlo entero al revés.
    const pequeno = magico === MAGICO_NORMAL;

    const cuantas = vista.getUint32(8, pequeno);
    const tablaOriginales = vista.getUint32(12, pequeno);
    const tablaTraducciones = vista.getUint32(16, pequeno);

    const decodificador = new TextDecoder('utf-8');
    const leerCadena = (tabla, i) => {
        const largo = vista.getUint32(tabla + i * 8, pequeno);
        const desde = vista.getUint32(tabla + i * 8 + 4, pequeno);
        return decodificador.decode(new Uint8Array(datos, desde, largo));
    };

    const bloques = [];

    for (let i = 0; i < cuantas; i++) {
        const original = leerCadena(tablaOriginales, i);
        const traduccion = leerCadena(tablaTraducciones, i);

        // La cabecera del catálogo es la entrada con el original vacío.
        if (original === '') {
            bloques.unshift(`msgid ""\nmsgstr ${comoPo(traduccion)}`);
            continue;
        }

        const [conContexto, contexto] = partirContexto(original);
        const [singular, plural] = conContexto.split(SEPARADOR_DE_PLURAL);
        const traducciones = traduccion.split(SEPARADOR_DE_PLURAL);

        const lineas = [];
        if (contexto) lineas.push(`msgctxt ${comoPo(contexto)}`);
        lineas.push(`msgid ${comoPo(singular)}`);

        if (plural !== undefined) {
            lineas.push(`msgid_plural ${comoPo(plural)}`);
            traducciones.forEach((texto, n) => lineas.push(`msgstr[${n}] ${comoPo(texto)}`));
        } else {
            lineas.push(`msgstr ${comoPo(traducciones[0] || '')}`);
        }

        bloques.push(lineas.join('\n'));
    }

    return `${bloques.join('\n\n')}\n`;
}

/**
 * Separa el contexto del original, que van pegados con un carácter de control.
 *
 * @param {string} original
 * @returns {[string, string]} El original y el contexto (vacío si no tiene).
 */
function partirContexto(original) {
    const separador = original.indexOf(SEPARADOR_DE_CONTEXTO);
    if (separador === -1) return [original, ''];
    return [original.slice(separador + 1), original.slice(0, separador)];
}

/**
 * Escribe una cadena como la escribe un archivo PO: entre comillas, con los
 * saltos de línea escapados y, si tiene varias líneas, repartida en varias.
 *
 * @param {string} texto
 * @returns {string}
 */
function comoPo(texto) {
    const escapado = String(texto ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');

    if (!escapado.includes('\n')) return `"${escapado}"`;

    // Varias líneas: la primera va vacía y cada línea del texto en la suya, que
    // es como lo escribe gettext y como lo espera el lector de PO.
    const partes = escapado.split('\n');
    const lineas = partes
        .map((parte, i) => (i < partes.length - 1 ? `"${parte}\\n"` : parte && `"${parte}"`))
        .filter(Boolean);

    return `""\n${lineas.join('\n')}`;
}
