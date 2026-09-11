/**
 * TBX: el formato estándar de intercambio de glosarios.
 *
 * Aquí se escribe y se lee el mismo TBX que PandaTerm, que es la otra
 * herramienta del proyecto que edita glosarios. Un glosario hecho allí tiene
 * que abrirse aquí con todo lo que lleva dentro, y al revés; por eso este
 * módulo copia sus decisiones de formato, que están razonadas en su README:
 *
 * - `langSet` en minúscula. Es lo que dice el estándar y lo que leen las demás
 *   herramientas. Poanda escribía `LangSet` con ele mayúscula, y como en XML
 *   las mayúsculas cuentan, un glosario exportado desde aquí entraba vacío en
 *   PandaTerm, sin dar ningún error. Al leer se aceptan las dos formas, para no
 *   dejar tirados los archivos que ya se exportaron mal.
 * - Texto escapado. Un término con "&" o "<" rompía el archivo entero.
 * - `martifHeader`, que es la cabecera que espera la definición del formato.
 * - Dentro de `<tig>`, los `termNote` van antes que los `descrip`. Lo pide la
 *   DTD, y hay importadores estrictos (el de Trados, sin ir más lejos) que
 *   rechazan la entrada si el orden es el otro.
 *
 * No se usa el analizador del navegador: así esto se puede probar sin abrir un
 * navegador, y el resto de formatos del proyecto ya se leen igual (core/xml.js).
 */
import { atributo, buscarElementos, desescaparXml, escaparXml } from '@core/xml.js';

/** Categorías gramaticales que ofrece la ficha, las mismas que PandaTerm. */
export const CATEGORIAS = ['noun', 'verb', 'adj', 'adv'];

/**
 * Deja un término con todos sus campos, sean cuales sean los que traiga.
 *
 * El glosario venía guardando solo el término y su traducción. Al añadir la
 * ficha completa, los términos viejos siguen ahí sin los campos nuevos, y el
 * resto del programa no tiene por qué enterarse.
 *
 * @param {object} entrada
 * @returns {{srcLang: string, srcTerm: string, srcPartOfSpeech: string,
 *   tgtLang: string, tgtTerm: string, tgtPartOfSpeech: string,
 *   definition: string, notes: string}}
 */
export function normalizarTermino(entrada = {}) {
    const texto = (valor) => String(valor ?? '').trim();
    return {
        srcLang: texto(entrada.srcLang),
        srcTerm: texto(entrada.srcTerm),
        srcPartOfSpeech: texto(entrada.srcPartOfSpeech),
        tgtLang: texto(entrada.tgtLang),
        tgtTerm: texto(entrada.tgtTerm),
        tgtPartOfSpeech: texto(entrada.tgtPartOfSpeech),
        definition: texto(entrada.definition),
        notes: texto(entrada.notes),
    };
}

/** ¿Este término lleva algo más que el par de palabras? */
export function tieneFicha(entrada) {
    const t = normalizarTermino(entrada);
    return Boolean(t.definition || t.notes || t.srcPartOfSpeech || t.tgtPartOfSpeech);
}

/**
 * Escribe el glosario como un archivo TBX.
 *
 * @param {Array<object>} glosario
 * @param {{origen?: string, destino?: string, fecha?: string}} [par]
 * @returns {string} El XML entero.
 */
export function generarTBX(glosario = [], { origen = '', destino = '', fecha } = {}) {
    const cuando = fecha || new Date().toISOString();
    const xml = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<!DOCTYPE martif SYSTEM "TBXcoreStructV02.dtd">`,
        `<martif type="TBX" xml:lang="${escaparXml(origen)}">`,
        `  <martifHeader>`,
        `    <fileDesc>`,
        `      <sourceDesc>`,
        `        <p>Glossary exported from Poanda on ${escaparXml(cuando)}</p>`,
        `      </sourceDesc>`,
        `    </fileDesc>`,
        `  </martifHeader>`,
        `  <text>`,
        `    <body>`,
    ];

    glosario.forEach((bruto, i) => {
        const t = normalizarTermino(bruto);
        xml.push(`      <termEntry id="c${i + 1}">`);

        xml.push(`        <langSet xml:lang="${escaparXml(t.srcLang || origen)}">`);
        xml.push(`          <tig>`);
        xml.push(`            <term>${escaparXml(t.srcTerm)}</term>`);
        if (t.srcPartOfSpeech) {
            xml.push(
                `            <termNote type="partOfSpeech">${escaparXml(t.srcPartOfSpeech)}</termNote>`,
            );
        }
        xml.push(`          </tig>`);
        xml.push(`        </langSet>`);

        xml.push(`        <langSet xml:lang="${escaparXml(t.tgtLang || destino)}">`);
        xml.push(`          <tig>`);
        xml.push(`            <term>${escaparXml(t.tgtTerm)}</term>`);
        // Primero los termNote y después los descrip: lo exige la DTD del
        // formato, y hay importadores que rechazan la entrada si van al revés.
        if (t.tgtPartOfSpeech) {
            xml.push(
                `            <termNote type="partOfSpeech">${escaparXml(t.tgtPartOfSpeech)}</termNote>`,
            );
        }
        if (t.notes) {
            xml.push(`            <termNote type="comment">${escaparXml(t.notes)}</termNote>`);
        }
        if (t.definition) {
            xml.push(
                `            <descrip type="definition">${escaparXml(t.definition)}</descrip>`,
            );
        }
        xml.push(`          </tig>`);
        xml.push(`        </langSet>`);

        xml.push(`      </termEntry>`);
    });

    xml.push(`    </body>`, `  </text>`, `</martif>`);
    return xml.join('\n');
}

/** El primer elemento con ese nombre dentro de un trozo, o null. */
function primero(texto, nombre) {
    return buscarElementos(texto, nombre)[0] || null;
}

/** El texto de `<nombre type="tipo">…</nombre>`, buscando por ese tipo. */
function porTipo(texto, nombre, tipo) {
    for (const elemento of buscarElementos(texto, nombre)) {
        if (atributo(elemento.atributos, 'type') === tipo) {
            return desescaparXml(elemento.contenido).trim();
        }
    }
    return '';
}

/** Lee el término, su idioma y su categoría de un bloque de idioma. */
function ladoDe(bloqueIdioma, nombreDelGrupo) {
    const idioma = atributo(bloqueIdioma.atributos, 'xml:lang') || '';
    const grupo = primero(bloqueIdioma.contenido, nombreDelGrupo);
    if (!grupo) return { idioma, termino: '', categoria: '', contenido: '' };

    const termino = primero(grupo.contenido, 'term');
    return {
        idioma,
        termino: termino ? desescaparXml(termino.contenido).trim() : '',
        // La categoría gramatical se escribe de dos maneras según la
        // herramienta: como termNote o como un elemento propio del espacio de
        // nombres "min". Se aceptan las dos.
        categoria:
            porTipo(grupo.contenido, 'termNote', 'partOfSpeech') ||
            (primero(grupo.contenido, 'partOfSpeech')
                ? desescaparXml(primero(grupo.contenido, 'partOfSpeech').contenido).trim()
                : ''),
        contenido: grupo.contenido,
    };
}

/**
 * Lee un archivo TBX y devuelve sus términos.
 *
 * Entiende los dos dialectos que hay por ahí: el de siempre
 * (`martif`/`langSet`/`tig`) y el nuevo (`tbx`/`langSec`/`termSec`).
 *
 * @param {string} texto Contenido del archivo.
 * @returns {{terminos: Array<object>, dialecto: string|null}}
 */
export function leerTBX(texto) {
    const cadena = String(texto ?? '');

    let nombreEntrada, nombreIdioma, nombreGrupo, dialecto;
    if (/<martif[\s>]/.test(cadena)) {
        dialecto = 'martif';
        nombreEntrada = 'termEntry';
        // Minúscula si la hay; si no, la mayúscula que escribían las versiones
        // viejas de Poanda y de PandaTerm.
        nombreIdioma = /<langSet[\s>]/.test(cadena) ? 'langSet' : 'LangSet';
        nombreGrupo = 'tig';
    } else if (/<tbx[\s>]/.test(cadena)) {
        dialecto = 'tbx';
        nombreEntrada = 'conceptEntry';
        nombreIdioma = 'langSec';
        nombreGrupo = 'termSec';
    } else {
        return { terminos: [], dialecto: null };
    }

    const terminos = [];

    for (const entrada of buscarElementos(cadena, nombreEntrada)) {
        const bloques = buscarElementos(entrada.contenido, nombreIdioma);
        if (bloques.length < 2) continue;

        const origen = ladoDe(bloques[0], nombreGrupo);
        const destino = ladoDe(bloques[1], nombreGrupo);
        if (!origen.termino && !destino.termino) continue;

        // La definición y las notas pueden venir colgando del concepto entero o
        // del lado de destino. Manda lo más concreto: si el término traducido
        // trae su propia definición, esa es la que vale.
        const definicionDelConcepto =
            porTipo(entrada.contenido, 'descrip', 'definition') ||
            porTipo(entrada.contenido, 'descrip', 'context');
        const notasDelConcepto = primero(entrada.contenido, 'note')
            ? desescaparXml(primero(entrada.contenido, 'note').contenido).trim()
            : '';

        terminos.push(
            normalizarTermino({
                srcLang: origen.idioma,
                srcTerm: origen.termino,
                srcPartOfSpeech: origen.categoria,
                tgtLang: destino.idioma,
                tgtTerm: destino.termino,
                tgtPartOfSpeech: destino.categoria,
                definition:
                    porTipo(destino.contenido, 'descrip', 'definition') ||
                    porTipo(destino.contenido, 'descrip', 'context') ||
                    definicionDelConcepto,
                notes: porTipo(destino.contenido, 'termNote', 'comment') || notasDelConcepto,
            }),
        );
    }

    return { terminos, dialecto };
}

/**
 * Endereza un glosario recién leído para que todos los términos vayan en el
 * mismo sentido.
 *
 * Un TBX no promete que el idioma de origen sea siempre el primero: puede traer
 * entradas al revés. Se toma como origen el idioma que más veces aparece en
 * primer lugar y se le da la vuelta a las que no coincidan; si no, media lista
 * se quedaría sin resaltar en el editor.
 *
 * @param {Array<object>} terminos
 * @returns {Array<object>}
 */
export function enderezarGlosario(terminos = []) {
    const cuenta = {};
    for (const t of terminos) {
        if (t.srcLang) cuenta[t.srcLang] = (cuenta[t.srcLang] || 0) + 1;
    }
    const idiomas = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
    if (idiomas.length < 2) return terminos.map((t) => normalizarTermino(t));

    const origen = idiomas[0];
    return terminos.map((bruto) => {
        const t = normalizarTermino(bruto);
        if (t.srcLang !== origen && t.tgtLang === origen) {
            return normalizarTermino({
                ...t,
                srcLang: t.tgtLang,
                srcTerm: t.tgtTerm,
                srcPartOfSpeech: t.tgtPartOfSpeech,
                tgtLang: t.srcLang,
                tgtTerm: t.srcTerm,
                tgtPartOfSpeech: t.srcPartOfSpeech,
            });
        }
        return t;
    });
}
