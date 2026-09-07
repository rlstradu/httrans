import { state } from '../state.js';

/**
 * Genera el XML de un archivo TBX con el glosario que hay en memoria.
 *
 * TBX es el formato estándar de intercambio de glosarios, así que el resultado
 * se puede importar en otras herramientas de traducción.
 *
 * @returns {string} Contenido XML del archivo TBX.
 */
function generateTBX() {
    const xml = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<martif type="TBX" xml:lang="${state.sourceLang}">`,
        `  <text>`,
        `    <body>`,
    ];

    state.glossary.forEach((entry) => {
        xml.push(`      <termEntry>`);
        xml.push(`        <LangSet xml:lang="${entry.srcLang}">`);
        xml.push(`          <tig><term>${entry.srcTerm}</term></tig>`);
        xml.push(`        </LangSet>`);
        xml.push(`        <LangSet xml:lang="${entry.tgtLang}">`);
        xml.push(`          <tig><term>${entry.tgtTerm}</term></tig>`);
        xml.push(`        </LangSet>`);
        xml.push(`      </termEntry>`);
    });

    xml.push(`    </body>`, `  </text>`, `</martif>`);
    return xml.join('\n');
}

export { generateTBX };
