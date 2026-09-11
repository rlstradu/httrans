import { state } from '../state.js';

/**
 * Escribe la memoria de traducción como un archivo TMX.
 *
 * TMX es el formato estándar para llevarse una memoria de una herramienta a
 * otra. Aquí es además el camino para pasar trabajo de un encargo a otro, ahora
 * que cada proyecto tiene su propia memoria.
 *
 * @returns {string|null} El XML, o null si la memoria está vacía.
 */
export function generateTMX() {
    if (state.translationMemory.length === 0) return null;

    const cabecera = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header creationtool="subpandaTM" creationtoolversion="1.0"
          datatype="unknown" segtype="sentence" changeid="subpandaTMUser"
          srclang="${state.sourceLang || 'en-US'}" o-tmf="subpandaTM"
          adminlang="en-US" `;

    const destino = state.targetLang ? `targetlang="${state.targetLang}"` : '';

    const xml = [
        cabecera +
            destino +
            `>
  </header>
  <body>`,
    ];

    state.translationMemory.forEach((unidad) => {
        xml.push(`    <tu>
      <tuv xml:lang="${unidad.srcLang}"><seg>${unidad.srcText}</seg></tuv>
      <tuv xml:lang="${unidad.tgtLang}"><seg>${unidad.tgtText}</seg></tuv>
    </tu>`);
    });

    xml.push(`  </body>
</tmx>`);
    return xml.join('\n');
}
