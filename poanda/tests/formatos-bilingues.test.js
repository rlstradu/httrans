/**
 * Formatos bilingües: la familia XLIFF, DITA y el .mo compilado.
 *
 * Aquí la regla de devolver el archivo intacto no es una cuestión de pulcritud:
 * un .sdlxliff lleva dentro el estado de cada segmento, quién lo tocó, la
 * puntuación de la memoria y el esqueleto del documento original. Reescribir el
 * archivo con lo que uno ha entendido de él no es perder detalles, es devolver
 * un archivo que Trados ya no reconoce y un encargo que hay que rehacer.
 *
 * El .mo es la excepción a propósito, y se explica en su propio bloque.
 */
import { describe, it, expect } from 'vitest';
import { parseXliffContent, reconstructXliff } from '../src/js/core/xliff.js';
import { parseDitaContent, reconstructDita } from '../src/js/core/dita.js';
import { moComoPo } from '../src/js/core/mo-lectura.js';
import { compileMo, parsePoForMo } from '../src/js/core/mo.js';
import { parsePoContent, reconstructPo } from '../src/js/core/po.js';

/** Traduce el segmento indicado, como haría el editor. */
function traducir(entrada, texto) {
    entrada.sentenceSegments[0].translation = texto;
    return entrada;
}

describe('XLIFF 1.2', () => {
    const XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en-US" target-language="es-ES" datatype="plaintext" original="app.resx">
    <body>
      <trans-unit id="1">
        <source>Save the <g id="1">document</g></source>
        <target state="new"></target>
        <note>Es el botón de la barra</note>
      </trans-unit>
      <trans-unit id="2">
        <source>Cancel</source>
        <target>Cancelar</target>
      </trans-unit>
      <trans-unit id="3">
        <source>Delete</source>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    it('lee el original, el identificador y lo ya traducido', () => {
        const entradas = parseXliffContent(XLIFF);
        expect(entradas).toHaveLength(3);
        expect(entradas[0].msgctxt).toBe('1');
        expect(entradas[1].sentenceSegments[0].translation).toBe('Cancelar');
    });

    it('las etiquetas de dentro se ven en el segmento', () => {
        // Son el formato del documento original: quien traduce tiene que poder
        // copiarlas, así que se enseñan en vez de esconderlas.
        expect(parseXliffContent(XLIFF)[0].msgid).toBe('Save the <g id="1">document</g>');
    });

    it('la nota del archivo llega como comentario', () => {
        expect(parseXliffContent(XLIFF)[0].comments).toEqual(['#. Es el botón de la barra']);
    });

    it('lee los idiomas declarados en el archivo', () => {
        const [primera] = parseXliffContent(XLIFF);
        expect(primera.sourceLang).toBe('en-US');
        expect(primera.targetLang).toBe('es-ES');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructXliff(parseXliffContent(XLIFF), XLIFF)).toBe(XLIFF);
    });

    it('la traducción va dentro del target, con sus atributos intactos', () => {
        const entradas = parseXliffContent(XLIFF);
        traducir(entradas[0], 'Guardar el <g id="1">documento</g>');

        const salida = reconstructXliff(entradas, XLIFF);
        expect(salida).toContain(
            '<target state="new">Guardar el <g id="1">documento</g></target>'
        );
        // Y lo que rodea al segmento sigue exactamente igual.
        expect(salida).toContain('original="app.resx"');
    });

    it('si no había target, se pone uno', () => {
        const entradas = parseXliffContent(XLIFF);
        traducir(entradas[2], 'Eliminar');
        expect(reconstructXliff(entradas, XLIFF)).toContain(
            '<source>Delete</source><target>Eliminar</target>'
        );
    });

    it('un "&" escrito en la traducción no rompe el archivo', () => {
        const entradas = parseXliffContent(XLIFF);
        traducir(entradas[1], 'Ana & Luis');
        expect(reconstructXliff(entradas, XLIFF)).toContain('<target>Ana &amp; Luis</target>');
    });

    it('un "menor que" suelto se escapa y una etiqueta no', () => {
        const entradas = parseXliffContent(XLIFF);
        traducir(entradas[1], 'Menos de 5 < 10 y <g id="1">esto</g>');

        const salida = reconstructXliff(entradas, XLIFF);
        expect(salida).toContain('5 &lt; 10');
        expect(salida).toContain('<g id="1">esto</g>');
    });
});

describe('XLIFF 2.0', () => {
    const XLIFF2 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en" trgLang="es">
  <file id="f1">
    <unit id="u1">
      <segment>
        <source>Welcome</source>
        <target/>
      </segment>
    </unit>
  </file>
</xliff>`;

    it('lee los segmentos de la versión 2.0', () => {
        const entradas = parseXliffContent(XLIFF2);
        expect(entradas).toHaveLength(1);
        expect(entradas[0].msgid).toBe('Welcome');
        expect(entradas[0].sourceLang).toBe('en');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructXliff(parseXliffContent(XLIFF2), XLIFF2)).toBe(XLIFF2);
    });

    it('la etiqueta vacía se convierte en una con la traducción dentro', () => {
        const entradas = parseXliffContent(XLIFF2);
        traducir(entradas[0], 'Bienvenido');
        expect(reconstructXliff(entradas, XLIFF2)).toContain('<target>Bienvenido</target>');
    });
});

describe('archivos de Trados y memoQ', () => {
    // Recortado de un .sdlxliff de verdad: lo que importa aquí es todo lo que
    // rodea al texto, que es lo que hace que el archivo siga sirviendo.
    const SDLXLIFF = `<?xml version="1.0" encoding="utf-8"?>
<xliff version="1.2" xmlns:sdl="http://sdl.com/FileTypes/SdlXliff/1.0" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="manual.docx" source-language="en-US" target-language="es-ES" datatype="x-sdlfilterframework2">
    <header>
      <reference><internal-file form="base64">UEsDBBQ=</internal-file></reference>
      <sdl:filetype-info><sdl:filetype-id>Microsoft Word</sdl:filetype-id></sdl:filetype-info>
    </header>
    <body>
      <trans-unit id="d1f2" translate="yes">
        <source>The quick brown fox</source>
        <seg-source><mrk mtype="seg" mid="1">The quick brown fox</mrk></seg-source>
        <target><mrk mtype="seg" mid="1"></mrk></target>
        <sdl:seg-defs><sdl:seg id="1" conf="Draft" origin="tm" percent="85"/></sdl:seg-defs>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructXliff(parseXliffContent(SDLXLIFF), SDLXLIFF)).toBe(SDLXLIFF);
    });

    it('al traducir se conserva todo lo que Trados necesita', () => {
        const entradas = parseXliffContent(SDLXLIFF);
        expect(entradas).toHaveLength(1);
        traducir(entradas[0], 'El veloz zorro marrón');

        const salida = reconstructXliff(entradas, SDLXLIFF);
        // El esqueleto del documento original, el tipo de archivo y la
        // información de cada segmento siguen ahí.
        expect(salida).toContain('<internal-file form="base64">UEsDBBQ=</internal-file>');
        expect(salida).toContain('<sdl:filetype-id>Microsoft Word</sdl:filetype-id>');
        expect(salida).toContain('conf="Draft" origin="tm" percent="85"');
        // Y la traducción está puesta, dentro de la marca de segmento.
        expect(salida).toContain('El veloz zorro marrón');
    });
});

describe('archivos DITA', () => {
    const DITA = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="guardar">
  <title>Guardar el documento</title>
  <shortdesc>Cómo guardar lo que estás escribiendo.</shortdesc>
  <taskbody>
    <steps>
      <step><cmd>Pulsa <term>Guardar</term> en la barra.</cmd></step>
      <step><cmd>Elige una carpeta.</cmd></step>
    </steps>
    <example>
      <codeblock>guardar --forzar</codeblock>
    </example>
    <p>Puedes ver <image href="barra.png" alt="La barra de herramientas"/> aquí.</p>
  </taskbody>
</task>`;

    it('lee los elementos con texto', () => {
        const textos = parseDitaContent(DITA).map((e) => e.msgid);
        expect(textos).toContain('Guardar el documento');
        expect(textos).toContain('Cómo guardar lo que estás escribiendo.');
        expect(textos).toContain('Elige una carpeta.');
    });

    it('el elemento de dentro no se cuenta aparte', () => {
        // El <term> va dentro del paso: si fuera su propio segmento, quien
        // traduce vería "Guardar" suelto y la frase partida en dos.
        const textos = parseDitaContent(DITA).map((e) => e.msgid);
        expect(textos).toContain('Pulsa <term>Guardar</term> en la barra.');
        expect(textos).not.toContain('Guardar');
    });

    it('el código no se traduce', () => {
        expect(parseDitaContent(DITA).map((e) => e.msgid)).not.toContain('guardar --forzar');
    });

    it('el texto alternativo de una imagen sí se traduce', () => {
        expect(parseDitaContent(DITA).map((e) => e.msgid)).toContain('La barra de herramientas');
    });

    it('abrir y guardar sin traducir devuelve el archivo igual', () => {
        expect(reconstructDita(parseDitaContent(DITA), DITA)).toBe(DITA);
    });

    it('al traducir se conservan la estructura y el identificador', () => {
        const entradas = parseDitaContent(DITA);
        traducir(entradas[0], 'Saving the document');

        const salida = reconstructDita(entradas, DITA);
        expect(salida).toContain('<title>Saving the document</title>');
        expect(salida).toContain('<task id="guardar">');
        expect(salida).toContain('<!DOCTYPE task PUBLIC');
    });

    it('la traducción del texto alternativo se escapa como atributo', () => {
        const entradas = parseDitaContent(DITA);
        const alternativo = entradas.find((e) => e.msgctxt === 'alt');
        traducir(alternativo, 'The "toolbar"');
        expect(reconstructDita(entradas, DITA)).toContain('alt="The &quot;toolbar&quot;"');
    });
});

describe('archivos .mo compilados', () => {
    /** Compila un PO a .mo, que es lo que haría gettext. */
    function comoMo(po) {
        return compileMo(parsePoForMo(po));
    }

    const PO = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

msgctxt "menu"
msgid "Save"
msgstr "Guardar"

msgid "One file"
msgid_plural "%d files"
msgstr[0] "Un archivo"
msgstr[1] "%d archivos"
`;

    it('un .mo se abre con sus cadenas', () => {
        const entradas = parsePoContent(moComoPo(comoMo(PO)));
        const textos = entradas.filter((e) => !e.isHeader).map((e) => e.msgid);
        expect(textos).toContain('Save');
        expect(textos).toContain('One file');
    });

    it('el contexto vuelve como contexto y no pegado al original', () => {
        // Dentro del archivo van juntos, separados por un carácter de control:
        // leerlos mal daría un segmento con basura al principio.
        const entradas = parsePoContent(moComoPo(comoMo(PO)));
        const guardar = entradas.find((e) => e.msgid === 'Save');
        expect(guardar.msgctxt).toBe('menu');
        expect(guardar.msgstr).toBe('Guardar');
    });

    it('las formas de plural vuelven enteras', () => {
        const entradas = parsePoContent(moComoPo(comoMo(PO)));
        const archivo = entradas.find((e) => e.msgid === 'One file');
        expect(archivo.msgidPlural).toBe('%d files');
        expect(archivo.sentenceSegments.map((s) => s.translation)).toEqual([
            'Un archivo',
            '%d archivos',
        ]);
    });

    it('la cabecera del catálogo se conserva', () => {
        const entradas = parsePoContent(moComoPo(comoMo(PO)));
        expect(entradas[0].isHeader).toBe(true);
        expect(entradas[0].msgstr).toContain('Plural-Forms');
    });

    it('abrir un .mo y volver a compilarlo da el mismo catálogo', () => {
        // Un .mo es un archivo generado, así que lo que tiene que volver igual
        // no son sus bytes sino lo que contiene.
        const primero = comoMo(PO);
        const entradas = parsePoContent(moComoPo(primero));
        const segundo = compileMo(parsePoForMo(reconstructPo(entradas)));

        expect(moComoPo(segundo)).toBe(moComoPo(primero));
    });

    it('un archivo que no es un .mo se rechaza diciéndolo', () => {
        const cualquierCosa = new TextEncoder().encode('esto no es un mo, es texto').buffer;
        expect(() => moComoPo(cualquierCosa)).toThrow(/no parece un \.mo/);
    });
});
