/**
 * Los formatos que por dentro son un zip: Word, Excel, LibreOffice, los libros
 * electrónicos, InDesign y el bilingüe comprimido de memoQ.
 *
 * Lo que se comprueba, además de que el texto se lea bien:
 *
 * 1. Que al guardar vuelvan **todos** los archivos que había dentro. Un .docx
 *    tiene veinte archivos y solo uno lleva texto; si al recomprimir se pierde
 *    cualquiera de los otros, Word abre el documento con un aviso de contenido
 *    ilegible, o no lo abre.
 * 2. Que lo que no se ha traducido no se toque.
 * 3. Que un párrafo partido en trozos por el formato se enseñe como una sola
 *    frase, que es lo que hace que se pueda traducir.
 */
import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync } from 'fflate';
import {
    parseDocxContent,
    reconstructDocx,
    parseXlsxContent,
    reconstructXlsx,
    parsePptxContent,
    reconstructPptx,
} from '../src/js/core/ooxml.js';
import { parseOdfContent, reconstructOdf } from '../src/js/core/odf.js';
import { parseEpubContent, reconstructEpub } from '../src/js/core/epub.js';
import { parseIdmlContent, reconstructIdml } from '../src/js/core/idml.js';
import { parseMqxlzContent, reconstructMqxlz } from '../src/js/core/mqxlz.js';
import { parseLocversiaContent, reconstructLocversia } from '../src/js/core/locversia.js';

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

/** Monta un zip con los archivos indicados. */
function comprimir(archivos) {
    const crudos = {};
    for (const [ruta, texto] of Object.entries(archivos)) crudos[ruta] = codificador.encode(texto);
    const bytes = zipSync(crudos);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** Devuelve el contenido de un archivo de dentro del zip. */
function leerDe(datos, ruta) {
    return decodificador.decode(unzipSync(new Uint8Array(datos))[ruta]);
}

/** Lista lo que hay dentro del zip. */
function rutasDe(datos) {
    return Object.keys(unzipSync(new Uint8Array(datos))).sort();
}

function traducir(entrada, texto) {
    entrada.sentenceSegments[0].translation = texto;
    return entrada;
}

describe('documentos de Word', () => {
    const DOCUMENTO = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>The Quick Report</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Press </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Save</w:t></w:r><w:r><w:t xml:space="preserve"> to finish.</w:t></w:r></w:p>
<w:p><w:r><w:t></w:t></w:r></w:p>
</w:body></w:document>`;

    const DOCX = () =>
        comprimir({
            '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
            '_rels/.rels': '<?xml version="1.0"?><Relationships/>',
            'word/document.xml': DOCUMENTO,
            'word/styles.xml': '<?xml version="1.0"?><w:styles/>',
            'word/media/imagen.png': 'PNG-FALSO',
        });

    it('cada párrafo es un segmento', () => {
        const entradas = parseDocxContent(DOCX());
        expect(entradas).toHaveLength(2);
        expect(entradas[0].msgid).toBe('The Quick Report');
    });

    it('un párrafo partido por el formato se enseña entero, con el formato como etiqueta', () => {
        // Word guarda "Press **Save** to finish." en tres trozos. Enseñarlos
        // sueltos obligaría a traducir "Press" sin saber qué viene detrás; y
        // juntarlos sin más perdería la negrita. La negrita viaja como etiqueta.
        expect(parseDocxContent(DOCX())[1].msgid).toBe('Press <b1>Save</b1> to finish.');
    });

    it('el texto sin formato no lleva etiquetas que estorben', () => {
        expect(parseDocxContent(DOCX())[0].msgid).toBe('The Quick Report');
    });

    it('los párrafos vacíos no son segmentos', () => {
        expect(parseDocxContent(DOCX()).some((e) => e.msgid.trim() === '')).toBe(false);
    });

    it('al guardar vuelven todos los archivos del documento', () => {
        const original = DOCX();
        const entradas = parseDocxContent(original);
        traducir(entradas[0], 'El informe rápido');

        expect(rutasDe(reconstructDocx(entradas, original))).toEqual(rutasDe(original));
    });

    it('la traducción se escribe en el documento y el resto no se toca', () => {
        const original = DOCX();
        const entradas = parseDocxContent(original);
        traducir(entradas[0], 'El informe rápido');

        const guardado = reconstructDocx(entradas, original);
        const xml = leerDe(guardado, 'word/document.xml');
        expect(xml).toContain('<w:t>El informe rápido</w:t>');
        // El estilo del párrafo sigue en su sitio.
        expect(xml).toContain('<w:pStyle w:val="Title"/>');
        // Y el párrafo que no se ha traducido está igual que estaba.
        expect(xml).toContain('<w:t>Save</w:t>');
    });

    it('cada trozo de la traducción vuelve con su formato', () => {
        const original = DOCX();
        const entradas = parseDocxContent(original);
        traducir(entradas[1], 'Pulsa <b1>Guardar</b1> para terminar.');

        const xml = leerDe(reconstructDocx(entradas, original), 'word/document.xml');
        expect(xml).toContain('<w:t xml:space="preserve">Pulsa </w:t>');
        // "Guardar" va al trozo que lleva la negrita, que sigue siendo el suyo.
        expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t>Guardar</w:t>');
        expect(xml).toContain('<w:t xml:space="preserve"> para terminar.</w:t>');
    });

    it('mover la etiqueta mueve el formato', () => {
        // Es para lo que sirve: en otro idioma la palabra en negrita puede caer
        // en otro sitio de la frase.
        const original = DOCX();
        const entradas = parseDocxContent(original);
        traducir(entradas[1], '<b1>Guarda</b1> para terminar.');

        const xml = leerDe(reconstructDocx(entradas, original), 'word/document.xml');
        expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t>Guarda</w:t>');
        expect(xml).toContain('<w:t xml:space="preserve"> para terminar.</w:t>');
    });

    it('si se borra la etiqueta se pierde el formato, pero no el texto', () => {
        const original = DOCX();
        const entradas = parseDocxContent(original);
        traducir(entradas[1], 'Pulsa Guardar para terminar.');

        const xml = leerDe(reconstructDocx(entradas, original), 'word/document.xml');
        expect(xml).toContain('Pulsa Guardar para terminar.');
        // El trozo que llevaba la negrita se queda vacío en lugar de conservar
        // el texto en inglés al lado de la traducción.
        expect(xml).not.toContain('<w:t>Save</w:t>');
    });

    it('las marcas internas de Word no se convierten en etiquetas', () => {
        // El idioma del corrector o la sugerencia de fuente no cambian cómo se
        // ve el texto: si contaran, saldría una etiqueta en cada palabra.
        const conRuido = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://x"><w:body>
<w:p><w:r><w:rPr><w:lang w:val="en-US"/><w:rFonts w:hint="eastAsia"/></w:rPr><w:t>Plain sentence</w:t></w:r></w:p>
</w:body></w:document>`;
        const zip = comprimir({ 'word/document.xml': conRuido });
        expect(parseDocxContent(zip)[0].msgid).toBe('Plain sentence');
    });

    it('abrir y guardar sin traducir deja el documento igual', () => {
        const original = DOCX();
        const guardado = reconstructDocx(parseDocxContent(original), original);
        expect(leerDe(guardado, 'word/document.xml')).toBe(DOCUMENTO);
    });

    it('una traducción con signos raros se escapa', () => {
        const original = DOCX();
        const entradas = parseDocxContent(original);
        traducir(entradas[0], 'Informe de I+D & ventas <2026>');

        const xml = leerDe(reconstructDocx(entradas, original), 'word/document.xml');
        expect(xml).toContain('I+D &amp; ventas &lt;2026&gt;');
    });
});

describe('libros de Excel', () => {
    const CADENAS = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
<si><t>Total sales</t></si>
<si><r><t xml:space="preserve">Net </t></r><r><t>profit</t></r></si>
</sst>`;

    const XLSX = () =>
        comprimir({
            '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
            'xl/workbook.xml': '<?xml version="1.0"?><workbook/>',
            'xl/sharedStrings.xml': CADENAS,
            'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet><f>SUM(A1:A9)</f></worksheet>',
        });

    it('cada cadena de la tabla es un segmento', () => {
        const entradas = parseXlsxContent(XLSX());
        expect(entradas.map((e) => e.msgid)).toEqual(['Total sales', 'Net profit']);
    });

    it('al traducir no se tocan las fórmulas ni el resto del libro', () => {
        const original = XLSX();
        const entradas = parseXlsxContent(original);
        traducir(entradas[0], 'Ventas totales');

        const guardado = reconstructXlsx(entradas, original);
        expect(leerDe(guardado, 'xl/sharedStrings.xml')).toContain('<t>Ventas totales</t>');
        expect(leerDe(guardado, 'xl/worksheets/sheet1.xml')).toContain('<f>SUM(A1:A9)</f>');
    });
});

describe('documentos de LibreOffice', () => {
    const CONTENIDO = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
<office:body><office:text>
<text:h text:outline-level="1">The Quick Report</text:h>
<text:p text:style-name="Standard">Press <text:span text:style-name="Bold">Save</text:span> to finish.</text:p>
<text:p/>
</office:text></office:body></office:document-content>`;

    const ODT = () =>
        comprimir({
            mimetype: 'application/vnd.oasis.opendocument.text',
            'META-INF/manifest.xml': '<?xml version="1.0"?><manifest/>',
            'content.xml': CONTENIDO,
            'styles.xml': '<?xml version="1.0"?><office:document-styles/>',
        });

    it('el título y el párrafo son segmentos', () => {
        const entradas = parseOdfContent(ODT());
        expect(entradas).toHaveLength(2);
        expect(entradas[0].msgid).toBe('The Quick Report');
    });

    it('el formato de dentro se queda dentro del segmento', () => {
        // Aquí sí se puede: LibreOffice guarda el párrafo entero, con la
        // negrita marcada por dentro, así que quien traduce la coloca donde
        // corresponda en su idioma.
        expect(parseOdfContent(ODT())[1].msgid).toBe(
            'Press <text:span text:style-name="Bold">Save</text:span> to finish.'
        );
    });

    it('al guardar vuelven todos los archivos', () => {
        const original = ODT();
        const entradas = parseOdfContent(original);
        traducir(entradas[0], 'El informe rápido');
        expect(rutasDe(reconstructOdf(entradas, original))).toEqual(rutasDe(original));
    });

    it('la traducción conserva el estilo del párrafo', () => {
        const original = ODT();
        const entradas = parseOdfContent(original);
        traducir(entradas[1], 'Pulsa <text:span text:style-name="Bold">Guardar</text:span> para terminar.');

        const xml = leerDe(reconstructOdf(entradas, original), 'content.xml');
        expect(xml).toContain('text:style-name="Standard"');
        expect(xml).toContain('<text:span text:style-name="Bold">Guardar</text:span>');
    });

    it('abrir y guardar sin traducir deja el contenido igual', () => {
        const original = ODT();
        expect(leerDe(reconstructOdf(parseOdfContent(original), original), 'content.xml')).toBe(
            CONTENIDO
        );
    });
});

describe('libros electrónicos', () => {
    const CAPITULO = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter One</title><style>p { margin: 0 }</style></head>
<body>
<h1>Chapter One</h1>
<p>It was a <em>bright</em> cold day.</p>
<pre>no traducir esto</pre>
</body></html>`;

    const EPUB = () =>
        comprimir({
            mimetype: 'application/epub+zip',
            'META-INF/container.xml': '<?xml version="1.0"?><container/>',
            'OEBPS/content.opf': `<?xml version="1.0"?><package><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">The Book</dc:title></metadata></package>`,
            'OEBPS/chapter1.xhtml': CAPITULO,
            'OEBPS/styles.css': 'body { font-family: serif }',
        });

    it('el título del libro y el texto de los capítulos son segmentos', () => {
        const textos = parseEpubContent(EPUB()).map((e) => e.msgid);
        expect(textos).toContain('The Book');
        expect(textos).toContain('Chapter One');
        expect(textos).toContain('It was a <em>bright</em> cold day.');
    });

    it('el código y los estilos no se traducen', () => {
        const textos = parseEpubContent(EPUB()).map((e) => e.msgid);
        expect(textos).not.toContain('no traducir esto');
        expect(textos.some((t) => t.includes('margin'))).toBe(false);
    });

    it('el contexto dice de qué capítulo sale cada segmento', () => {
        const entradas = parseEpubContent(EPUB());
        expect(entradas.find((e) => e.msgid === 'Chapter One').msgctxt).toBe('chapter1.xhtml');
    });

    it('al guardar vuelven todos los archivos y la traducción está puesta', () => {
        const original = EPUB();
        const entradas = parseEpubContent(original);
        traducir(
            entradas.find((e) => e.msgid.startsWith('It was')),
            'Era un día <em>luminoso</em> y frío.'
        );

        const guardado = reconstructEpub(entradas, original);
        expect(rutasDe(guardado)).toEqual(rutasDe(original));
        expect(leerDe(guardado, 'OEBPS/chapter1.xhtml')).toContain(
            '<p>Era un día <em>luminoso</em> y frío.</p>'
        );
    });
});

describe('documentos de InDesign', () => {
    const HISTORIA = `<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
<Story Self="u1">
<ParagraphStyleRange AppliedParagraphStyle="Titular"><CharacterStyleRange><Content>Big News Today</Content></CharacterStyleRange></ParagraphStyleRange>
<ParagraphStyleRange><CharacterStyleRange><Content>The city council met.</Content></CharacterStyleRange></ParagraphStyleRange>
</Story></idPkg:Story>`;

    const IDML = () =>
        comprimir({
            mimetype: 'application/vnd.adobe.indesign-idml-package',
            designmap: '<?xml version="1.0"?><Document/>',
            'Stories/Story_u1.xml': HISTORIA,
            'Resources/Graphic.xml': '<?xml version="1.0"?><idPkg:Graphic/>',
        });

    it('cada trozo de texto de la historia es un segmento', () => {
        const entradas = parseIdmlContent(IDML());
        expect(entradas.map((e) => e.msgid)).toEqual(['Big News Today', 'The city council met.']);
    });

    it('al traducir se conservan los estilos de la maqueta', () => {
        const original = IDML();
        const entradas = parseIdmlContent(original);
        traducir(entradas[0], 'Gran noticia de hoy');

        const guardado = reconstructIdml(entradas, original);
        const xml = leerDe(guardado, 'Stories/Story_u1.xml');
        expect(xml).toContain('<Content>Gran noticia de hoy</Content>');
        expect(xml).toContain('AppliedParagraphStyle="Titular"');
        expect(rutasDe(guardado)).toEqual(rutasDe(original));
    });
});

describe('bilingües comprimidos de memoQ', () => {
    const BILINGUE = `<?xml version="1.0" encoding="utf-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="es"><body>
    <trans-unit id="1"><source>Save</source><target></target></trans-unit>
  </body></file>
</xliff>`;

    const MQXLZ = () =>
        comprimir({
            'document.mqxliff': BILINGUE,
            'skeleton.xml': '<?xml version="1.0"?><skeleton/>',
        });

    it('se abre el bilingüe de dentro', () => {
        const entradas = parseMqxlzContent(MQXLZ());
        expect(entradas).toHaveLength(1);
        expect(entradas[0].msgid).toBe('Save');
    });

    it('al guardar se conserva el esqueleto que memoQ necesita', () => {
        const original = MQXLZ();
        const entradas = parseMqxlzContent(original);
        traducir(entradas[0], 'Guardar');

        const guardado = reconstructMqxlz(entradas, original);
        expect(leerDe(guardado, 'document.mqxliff')).toContain('<target>Guardar</target>');
        expect(rutasDe(guardado)).toEqual(['document.mqxliff', 'skeleton.xml']);
    });
});

describe('proyectos de Locversia', () => {
    const PROYECTO = {
        version: 3,
        project: { name: 'Manual', fileName: 'manual.docx', sourceLang: 'en', targetLang: 'es' },
        segments: [
            { blockId: 1, sentenceIndex: 0, contextLabel: 'Título', source: 'Big News', target: '', note: 'Titular de portada' },
            { blockId: 2, sentenceIndex: 0, contextLabel: 'Cuerpo', source: 'It rained.', target: 'Llovió.' },
            { blockId: 2, sentenceIndex: 1, contextLabel: 'Cuerpo', source: 'Then it stopped.', target: '' },
        ],
        aiPreferences: { provider: 'ninguno' },
    };

    const LOCVERSIA = () => comprimir({ 'project.json': JSON.stringify(PROYECTO, null, 2) });

    it('las frases de un mismo párrafo salen juntas', () => {
        // Locversia ya partió el documento; volver a partirlo por nuestra cuenta
        // haría que lo traducido dejara de encajar donde estaba.
        const entradas = parseLocversiaContent(LOCVERSIA());
        expect(entradas).toHaveLength(2);
        expect(entradas[1].sentenceSegments).toHaveLength(2);
        expect(entradas[1].sentenceSegments[0].translation).toBe('Llovió.');
    });

    it('la nota del segmento llega al icono de comentarios', () => {
        expect(parseLocversiaContent(LOCVERSIA())[0].comments).toEqual([
            '#. Titular de portada',
        ]);
    });

    it('al guardar se devuelve el proyecto con las traducciones puestas', () => {
        const original = LOCVERSIA();
        const entradas = parseLocversiaContent(original);
        entradas[0].sentenceSegments[0].translation = 'Gran noticia';
        entradas[1].sentenceSegments[1].translation = 'Luego paró.';

        const proyecto = JSON.parse(leerDe(reconstructLocversia(entradas, original), 'project.json'));
        expect(proyecto.segments[0].target).toBe('Gran noticia');
        expect(proyecto.segments[2].target).toBe('Luego paró.');
        // Y lo que Poanda no entiende vuelve tal cual.
        expect(proyecto.aiPreferences).toEqual({ provider: 'ninguno' });
        expect(proyecto.version).toBe(3);
    });

    it('también se abre si viene como .json suelto', () => {
        const suelto = codificador.encode(JSON.stringify(PROYECTO)).buffer;
        expect(parseLocversiaContent(suelto)).toHaveLength(2);
    });
});

describe('presentaciones de PowerPoint', () => {
    const DIAPOSITIVA = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://ppt" xmlns:a="http://draw"><p:cSld><p:spTree>
<p:sp><p:txBody>
<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Quarterly Results</a:t></a:r></a:p>
<a:p><a:r><a:rPr lang="en-US"/><a:t xml:space="preserve">Sales are </a:t></a:r><a:r><a:rPr lang="en-US" b="1"/><a:t>up</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t> this quarter.</a:t></a:r></a:p>
</p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

    const NOTAS = `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:p="http://ppt" xmlns:a="http://draw"><p:cSld><p:spTree>
<p:sp><p:txBody><a:p><a:r><a:rPr lang="en-US"/><a:t>Remember to mention the discount.</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:notes>`;

    const PPTX = () =>
        comprimir({
            '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
            'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>',
            'ppt/slides/slide1.xml': DIAPOSITIVA,
            'ppt/notesSlides/notesSlide1.xml': NOTAS,
            'ppt/media/logo.png': 'PNG-FALSO',
        });

    it('cada párrafo de la diapositiva es un segmento, y las notas también', () => {
        const textos = parsePptxContent(PPTX()).map((e) => e.msgid);
        expect(textos).toContain('Quarterly Results');
        expect(textos).toContain('Remember to mention the discount.');
    });

    it('el idioma y las marcas de revisión no cuentan como formato', () => {
        // En PowerPoint casi todos los trozos llevan lang y dirty; si contaran,
        // no habría diapositiva sin etiquetas por todas partes.
        expect(parsePptxContent(PPTX())[0].msgid).toBe('Quarterly Results');
    });

    it('la negrita sí es formato y viaja como etiqueta', () => {
        const conNegrita = parsePptxContent(PPTX()).find((e) => e.msgid.includes('Sales'));
        expect(conNegrita.msgid).toBe('Sales are <b1>up</b1> this quarter.');
    });

    it('al guardar vuelven todos los archivos y la traducción está puesta', () => {
        const original = PPTX();
        const entradas = parsePptxContent(original);
        traducir(entradas[0], 'Resultados del trimestre');

        const guardado = reconstructPptx(entradas, original);
        expect(rutasDe(guardado)).toEqual(rutasDe(original));
        expect(leerDe(guardado, 'ppt/slides/slide1.xml')).toContain(
            '<a:t>Resultados del trimestre</a:t>'
        );
    });

    it('la negrita traducida vuelve al trozo que la llevaba', () => {
        const original = PPTX();
        const entradas = parsePptxContent(original);
        const conNegrita = entradas.find((e) => e.msgid.includes('Sales'));
        traducir(conNegrita, 'Las ventas <b1>suben</b1> este trimestre.');

        const xml = leerDe(reconstructPptx(entradas, original), 'ppt/slides/slide1.xml');
        expect(xml).toContain('<a:rPr lang="en-US" b="1"/><a:t>suben</a:t>');
        expect(xml).toContain('<a:t xml:space="preserve">Las ventas </a:t>');
    });
});
