/**
 * Abrir y guardar los formatos nuevos desde la herramienta.
 *
 * Los tests de tests/formatos-nuevos.js comprueban los lectores por dentro.
 * Estos comprueban el camino entero: soltar el archivo, verlo en el editor,
 * traducir y que lo que se descarga sea lo que tiene que ser.
 */
import { readFileSync } from 'node:fs';
import { test, expect, responderIdiomas } from './apoyo.js';

/**
 * Carga un archivo cualquiera en la herramienta.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} nombre
 * @param {string} contenido
 */
async function cargarArchivo(page, nombre, contenido) {
    // Se suelta sobre el panel, que es el camino por el que pasan todos los
    // formatos. El campo oculto del menú solo escucha mientras el diálogo del
    // sistema está abierto, así que ponerle un archivo a mano no dispara nada.
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

const TXT = `Primera línea
Segunda línea

Tercera línea`;

const PROPS = `# Textos de la interfaz

# Máximo 20 caracteres
boton.guardar=Save
boton.cancelar=Cancel`;

test.describe('archivos de texto plano', () => {
    test('se abren y cada línea es un segmento', async ({ page }) => {
        await cargarArchivo(page, 'notas.txt', TXT);

        await expect(page.locator('.segmento-fila')).toHaveCount(3);
        await expect(page.locator('#msgid-pre-0-0')).toContainText('Primera línea');
    });

    test('abrir y guardar sin traducir devuelve el archivo igual', async ({ page }) => {
        await cargarArchivo(page, 'notas.txt', TXT);
        expect(await guardarYLeer(page)).toBe(TXT);
    });

    test('lo traducido llega al archivo y lo demás se queda como estaba', async ({ page }) => {
        await cargarArchivo(page, 'notas.txt', TXT);

        await page.locator('#msgstr-0-0').fill('First line');
        await page.locator('#msgstr-0-0').blur();
        await page.waitForTimeout(500);

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('First line');
        expect(guardado).toContain('Segunda línea');
        // Y la línea en blanco sigue en su sitio.
        expect(guardado.split('\n')).toHaveLength(4);
    });
});

test.describe('archivos .properties', () => {
    test('se abren y el contexto es la clave', async ({ page }) => {
        await cargarArchivo(page, 'mensajes.properties', PROPS);

        await expect(page.locator('.segmento-fila')).toHaveCount(2);
        await expect(page.locator('.segmento-contexto-etiqueta').first()).toContainText(
            'boton.guardar'
        );
    });

    test('la nota del programador llega al icono de comentarios', async ({ page }) => {
        // Conservarla en el archivo no basta: si quien traduce no la ve, una
        // nota como "máximo 20 caracteres" no sirve de nada. Va al icono y no a
        // la etiqueta gris, que es para lo que identifica el segmento (aquí, la
        // clave).
        await cargarArchivo(page, 'mensajes.properties', PROPS);

        const icono = page.locator('.segmento-comentario').first();
        await expect(icono).toHaveClass(/con-nota/);
        await expect(icono).toHaveAttribute('title', /Máximo 20 caracteres/);
        // Y el encabezado del archivo, separado por una línea en blanco, no se
        // le cuelga a la primera cadena.
        await expect(icono).not.toHaveAttribute('title', /Textos de la interfaz/);
    });

    test('abrir y guardar sin traducir devuelve el archivo igual', async ({ page }) => {
        await cargarArchivo(page, 'mensajes.properties', PROPS);
        expect(await guardarYLeer(page)).toBe(PROPS);
    });

    test('al traducir se conservan el comentario y las claves', async ({ page }) => {
        await cargarArchivo(page, 'mensajes.properties', PROPS);

        await page.locator('#msgstr-0-0').fill('Guardar');
        await page.locator('#msgstr-0-0').blur();
        await page.waitForTimeout(500);

        const guardado = await guardarYLeer(page);
        expect(guardado).toContain('# Textos de la interfaz');
        expect(guardado).toContain('boton.guardar=Guardar');
        expect(guardado).toContain('boton.cancelar=Cancel');
    });
});

test.describe('el menú se adapta al formato', () => {
    test('convertir a .mo solo aparece con un archivo PO', async ({ page }) => {
        await cargarArchivo(page, 'notas.txt', TXT);
        await page.locator('#fileBtn').click();

        await expect(page.locator('#convertFileMoBtn')).toBeHidden();
        await expect(page.locator('#saveFileBtn')).not.toHaveClass(/disabled-link/);
    });

    test('un formato que no se conoce se rechaza diciendo cuáles valen', async ({ page }) => {
        await page.evaluate(() => {
            const datos = new DataTransfer();
            // Un .psd de Photoshop: un formato que Poanda no abre ni pretende abrir.
            datos.items.add(new File(['cualquier cosa'], 'portada.psd'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await expect(page.locator('#messageBox')).toBeVisible();
        await expect(page.locator('#messageText')).toContainText('.txt');
    });

    test('el diálogo de abrir ofrece todos los formatos, no solo los tres antiguos', async ({
        page,
    }) => {
        // Escrita a mano en el HTML, esta lista se quedaba atrás en cuanto se
        // añadía un formato: el archivo salía en gris en el explorador aunque
        // Poanda supiera abrirlo.
        const seleccion = page.waitForEvent('filechooser');
        await page.locator('#initialMessage').click();
        await seleccion;

        const admitidos = await page.locator('#anyFile').getAttribute('accept');
        expect(admitidos).toContain('.txt');
        expect(admitidos).toContain('.properties');
        expect(admitidos).toContain('.po');
    });
});
