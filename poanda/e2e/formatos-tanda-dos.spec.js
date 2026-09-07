/**
 * Los formatos de la segunda tanda, abiertos y guardados desde la herramienta.
 *
 * Los tests de tests/formatos-tanda-dos.test.js comprueban los lectores por
 * dentro; estos comprueban el camino entero: soltar el archivo, verlo en el
 * editor, traducir y que lo que se descarga sea lo que tiene que ser.
 */
import { readFileSync } from 'node:fs';
import { test, expect, responderIdiomas } from './apoyo.js';
import { compileMo, parsePoForMo } from '../src/js/core/mo.js';

/** PO de partida para fabricar un .mo en los tests. */
const PO_PARA_MO = `msgid ""
msgstr "Content-Type: text/plain; charset=UTF-8\\n"

msgid "Save"
msgstr "Guardar"
`;

/** Suelta un archivo sobre el panel, que es por donde entran todos. */
async function cargarArchivo(page, nombre, contenido) {
    await page.evaluate(
        ({ nombre, contenido }) => {
            const datos = new DataTransfer();
            datos.items.add(new File([contenido], nombre, { type: 'text/plain' }));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        },
        { nombre, contenido }
    );
    await responderIdiomas(page);
    await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
}

/** Guarda desde el menú Archivo y devuelve lo descargado. */
async function guardarYLeer(page) {
    const descarga = page.waitForEvent('download');
    await page.locator('#fileBtn').click();
    await page.locator('#saveFileBtn').click();
    return readFileSync(await (await descarga).path(), 'utf8');
}

/** Escribe una traducción y espera a que el editor la recoja. */
async function traducir(page, campo, texto) {
    await page.locator(campo).fill(texto);
    await page.locator(campo).blur();
    await page.waitForTimeout(500);
}

const CSV = `key,source,target,max_length
boton.guardar,Save,,20
boton.cancelar,Cancel,,20`;

const MD = `# Guía rápida

Un párrafo de ejemplo.

- Un punto de la lista

\`\`\`bash
npm install
\`\`\``;

const RESX = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <xsd:schema id="root" />
  <data name="boton.guardar" xml:space="preserve">
    <value>Save</value>
    <comment>Máximo 20 caracteres</comment>
  </data>
</root>`;

const ARB = `{
  "@@locale": "en",
  "saveButton": "Save",
  "@saveButton": {
    "description": "Botón de la barra principal",
    "placeholders": {}
  }
}`;

const QT = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE TS>
<TS version="2.1" language="es_ES">
<context>
    <name>MainWindow</name>
    <message>
        <location filename="mainwindow.cpp" line="42"/>
        <source>Save</source>
        <translation type="unfinished"></translation>
    </message>
</context>
</TS>`;

const WXL = `<?xml version="1.0" encoding="utf-8"?>
<WixLocalization Culture="en-us">
  <String Id="WelcomeTitle" Overridable="yes">Welcome</String>
</WixLocalization>`;

test.describe('archivos .csv', () => {
    test('se abren con la clave como contexto', async ({ page }) => {
        await cargarArchivo(page, 'textos.csv', CSV);

        await expect(page.locator('.segmento-fila')).toHaveCount(2);
        await expect(page.locator('.segmento-contexto-etiqueta').first()).toContainText(
            'boton.guardar'
        );
    });

    test('al traducir se conservan las columnas que Poanda no usa', async ({ page }) => {
        await cargarArchivo(page, 'textos.csv', CSV);
        await traducir(page, '#msgstr-0-0', 'Guardar');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('boton.guardar,Save,Guardar,20');
        expect(guardado).toContain('max_length');
    });
});

test.describe('documentos Markdown', () => {
    test('el título, el párrafo y la lista son segmentos, el código no', async ({ page }) => {
        await cargarArchivo(page, 'README.md', MD);

        await expect(page.locator('.segmento-fila')).toHaveCount(3);
        await expect(page.locator('#msgid-pre-0-0')).toContainText('Guía rápida');
    });

    test('al traducir se conservan las almohadillas y los guiones', async ({ page }) => {
        await cargarArchivo(page, 'README.md', MD);
        await traducir(page, '#msgstr-0-0', 'Quick start');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('# Quick start');
        expect(guardado).toContain('npm install');
    });
});

test.describe('archivos .resx', () => {
    test('el comentario del programador llega al icono', async ({ page }) => {
        await cargarArchivo(page, 'Resources.resx', RESX);

        const icono = page.locator('.segmento-comentario').first();
        await expect(icono).toHaveClass(/con-nota/);
        await expect(icono).toHaveAttribute('title', /Máximo 20 caracteres/);
    });

    test('al traducir se conserva el esquema del archivo', async ({ page }) => {
        await cargarArchivo(page, 'Resources.resx', RESX);
        await traducir(page, '#msgstr-0-0', 'Guardar');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('<value>Guardar</value>');
        expect(guardado).toContain('<xsd:schema');
    });
});

test.describe('archivos .arb de Flutter', () => {
    test('al traducir se conservan los bloques de arroba', async ({ page }) => {
        await cargarArchivo(page, 'app_en.arb', ARB);
        await traducir(page, '#msgstr-0-0', 'Guardar');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('"saveButton": "Guardar"');
        expect(guardado).toContain('"placeholders": {}');
    });
});

test.describe('archivos .ts de Qt', () => {
    test('al traducir desaparece la marca de "sin terminar"', async ({ page }) => {
        await cargarArchivo(page, 'app_es.ts', QT);
        await traducir(page, '#msgstr-0-0', 'Guardar');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('<translation>Guardar</translation>');
        expect(guardado).toContain('<location filename="mainwindow.cpp" line="42"/>');
    });

    test('un .ts de TypeScript se rechaza en vez de abrirse vacío', async ({ page }) => {
        await page.evaluate(() => {
            const datos = new DataTransfer();
            datos.items.add(new File(['export const saludo = "hola";'], 'app.ts'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await expect(page.locator('#messageBox')).toBeVisible();
        await expect(page.locator('#messageText')).toContainText('TypeScript');
    });
});

test.describe('archivos .wxl de instaladores', () => {
    test('al traducir se conservan los atributos de la cadena', async ({ page }) => {
        await cargarArchivo(page, 'es-es.wxl', WXL);
        await traducir(page, '#msgstr-0-0', 'Bienvenido');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('<String Id="WelcomeTitle" Overridable="yes">Bienvenido</String>');
    });
});

test('el diálogo de abrir ofrece también los formatos nuevos', async ({ page }) => {
    const seleccion = page.waitForEvent('filechooser');
    await page.locator('#initialMessage').click();
    await seleccion;

    const admitidos = await page.locator('#anyFile').getAttribute('accept');
    for (const extension of ['.csv', '.md', '.resx', '.arb', '.ts', '.wxl']) {
        expect(admitidos).toContain(extension);
    }
});

/**
 * Tercera tanda: los formatos bilingües.
 *
 * Se comprueba el camino entero, que en el .mo tiene una particularidad: no es
 * texto, así que hay que leerlo y descargarlo en binario.
 */
const XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en-US" target-language="es-ES" datatype="plaintext" original="app.resx">
    <body>
      <trans-unit id="1">
        <source>Save</source>
        <target state="new"></target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

const DITA = `<?xml version="1.0" encoding="UTF-8"?>
<task id="guardar">
  <title>Save the document</title>
  <taskbody>
    <steps><step><cmd>Click Save.</cmd></step></steps>
  </taskbody>
</task>`;

test.describe('formatos bilingües', () => {
    test('un .sdlxliff se abre y conserva lo que Trados necesita', async ({ page }) => {
        await cargarArchivo(page, 'manual.sdlxliff', XLIFF);
        await traducir(page, '#msgstr-0-0', 'Guardar');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('<target state="new">Guardar</target>');
        expect(guardado).toContain('original="app.resx"');
    });

    test('un .dita se abre por elementos y conserva la estructura', async ({ page }) => {
        await cargarArchivo(page, 'guardar.dita', DITA);

        await expect(page.locator('.segmento-fila')).toHaveCount(2);
        await traducir(page, '#msgstr-0-0', 'Guardar el documento');

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('<title>Guardar el documento</title>');
        expect(guardado).toContain('<task id="guardar">');
    });

    test('un .mo se abre con sus cadenas y se descarga compilado', async ({ page }) => {
        // El .mo es binario: se compila aquí a partir de un PO, que es lo que
        // haría gettext, y se suelta en la página como el archivo que es.
        const enBase64 = Buffer.from(compileMo(parsePoForMo(PO_PARA_MO))).toString('base64');
        await page.evaluate((base64) => {
            const binario = atob(base64);
            const bytes = new Uint8Array(binario.length);
            for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
            const datos = new DataTransfer();
            datos.items.add(new File([bytes], 'es.mo'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        }, enBase64);

        await responderIdiomas(page);
        await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
        await expect(page.locator('.segmento-fila')).toHaveCount(1);
        await expect(page.locator('#msgstr-1-0')).toHaveValue('Guardar');

        const descarga = page.waitForEvent('download');
        await page.locator('#fileBtn').click();
        await page.locator('#saveFileBtn').click();
        const ruta = await (await descarga).path();
        const bytes = readFileSync(ruta);
        // Los cuatro primeros bytes son el número mágico de gettext.
        expect(bytes.readUInt32LE(0)).toBe(0x950412de);
    });
});

/**
 * Cuarta tanda: los formatos que por dentro son un zip.
 *
 * Aquí lo que hay que comprobar en el navegador es que el camino entero
 * funciona con archivos binarios: que se leen como bytes y no como texto (leer
 * un zip como texto lo destroza) y que lo que se descarga sigue siendo un
 * archivo válido con todo lo que tenía dentro.
 */
import { zipSync, unzipSync } from 'fflate';

const DOCUMENTO_WORD = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>The Quick Report</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Press </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Save</w:t></w:r><w:r><w:t xml:space="preserve"> to finish.</w:t></w:r></w:p>
</w:body></w:document>`;

/** Monta un .docx de mentira, con lo justo para que sea un zip como el de Word. */
function docxDePrueba() {
    const codificador = new TextEncoder();
    return zipSync({
        '[Content_Types].xml': codificador.encode('<?xml version="1.0"?><Types/>'),
        'word/document.xml': codificador.encode(DOCUMENTO_WORD),
        'word/styles.xml': codificador.encode('<?xml version="1.0"?><w:styles/>'),
    });
}

test.describe('formatos comprimidos', () => {
    test('un .docx se abre por párrafos y se descarga entero', async ({ page }) => {
        const enBase64 = Buffer.from(docxDePrueba()).toString('base64');

        await page.evaluate((base64) => {
            const binario = atob(base64);
            const bytes = new Uint8Array(binario.length);
            for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
            const datos = new DataTransfer();
            datos.items.add(new File([bytes], 'informe.docx'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        }, enBase64);

        await responderIdiomas(page);
        await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
        await expect(page.locator('#msgid-pre-0-0')).toContainText('The Quick Report');

        await traducir(page, '#msgstr-0-0', 'El informe rápido');

        const descarga = page.waitForEvent('download');
        await page.locator('#fileBtn').click();
        await page.locator('#saveFileBtn').click();
        const bytes = readFileSync(await (await descarga).path());

        const dentro = unzipSync(new Uint8Array(bytes));
        // Siguen estando los tres archivos, y la traducción está puesta.
        expect(Object.keys(dentro).sort()).toEqual([
            '[Content_Types].xml',
            'word/document.xml',
            'word/styles.xml',
        ]);
        expect(new TextDecoder().decode(dentro['word/document.xml'])).toContain(
            '<w:t>El informe rápido</w:t>'
        );
    });

    test('el diálogo de abrir ofrece también los formatos comprimidos', async ({ page }) => {
        const seleccion = page.waitForEvent('filechooser');
        await page.locator('#initialMessage').click();
        await seleccion;

        const admitidos = await page.locator('#anyFile').getAttribute('accept');
        for (const extension of ['.docx', '.xlsx', '.odt', '.ods', '.odp', '.epub', '.idml']) {
            expect(admitidos).toContain(extension);
        }
    });
});

test.describe('el formato de Word como etiquetas', () => {
    /** Suelta el .docx de prueba en la página. */
    async function cargarDocx(page) {
        const enBase64 = Buffer.from(docxDePrueba()).toString('base64');
        await page.evaluate((base64) => {
            const binario = atob(base64);
            const bytes = new Uint8Array(binario.length);
            for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
            const datos = new DataTransfer();
            datos.items.add(new File([bytes], 'informe.docx'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        }, enBase64);
        await responderIdiomas(page);
        await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
    }

    test('la negrita se ve como una etiqueta amarilla en el original', async ({ page }) => {
        await cargarDocx(page);

        // El segundo párrafo lleva una palabra en negrita. Las etiquetas se
        // pintan igual que las de un %s o un <b> de un archivo PO.
        const marcas = page.locator('#msgid-pre-1-0 .etiqueta');
        await expect(marcas).toHaveCount(2);
        await expect(marcas.nth(0)).toHaveText('<b1>');
        await expect(marcas.nth(1)).toHaveText('</b1>');
    });

    test('avisa si la traducción se deja una etiqueta a medias', async ({ page }) => {
        await cargarDocx(page);
        await page.locator('#msgstr-1-0').fill('Pulsa <b1>Guardar para terminar.');

        await expect(page.locator('#avisoEtiquetas-1-0')).toBeVisible();
    });

    test('la traducción con la etiqueta movida devuelve el formato a su sitio', async ({
        page,
    }) => {
        await cargarDocx(page);
        await traducir(page, '#msgstr-1-0', 'Para terminar, pulsa <b1>Guardar</b1>.');

        const descarga = page.waitForEvent('download');
        await page.locator('#fileBtn').click();
        await page.locator('#saveFileBtn').click();
        const bytes = readFileSync(await (await descarga).path());

        const xml = new TextDecoder().decode(unzipSync(new Uint8Array(bytes))['word/document.xml']);
        expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t>Guardar</w:t>');
        expect(xml).toContain('<w:t xml:space="preserve">Para terminar, pulsa </w:t>');
    });
});
