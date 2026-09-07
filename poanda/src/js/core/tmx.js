import { state } from '../state.js';

/**
 * Genera el XML de un archivo TMX con la memoria de traducción que hay en memoria.
 *
 * TMX es el formato estándar de intercambio de memorias de traducción.
 *
 * @returns {string} Contenido XML del archivo TMX.
 */
function generateTMX() {
    if (state.translationMemory.length === 0) {
        return null;
    }

    const header = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header creationtool="Poanda" creationtoolversion="1.0"
          datatype="unknown" segtype="sentence" changeid="PoandaUser"
          srclang="${state.tmSourceLanguage || 'en-US'}" o-tmf="Poanda"
          adminlang="en-US" `;

    const targetLangAttr = state.tmTargetLanguage ? `targetlang="${state.tmTargetLanguage}"` : '';

    const xml = [
        header +
            targetLangAttr +
            `>
  </header>
  <body>`,
    ];

    state.translationMemory.forEach((entry) => {
        xml.push(`    <tu>
      <tuv xml:lang="${entry.srcLang}"><seg>${entry.srcText}</seg></tuv>
      <tuv xml:lang="${entry.tgtLang}"><seg>${entry.tgtText}</seg></tuv>
    </tu>`);
    });

    xml.push(`  </body>
</tmx>`);
    return xml.join('\n');
}

export { generateTMX };
