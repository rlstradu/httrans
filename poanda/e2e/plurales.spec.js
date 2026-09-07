/**
 * Formas de plural en el editor.
 *
 * Los tests de tests/po.test.js comprueban que se leen y se escriben bien. Estos
 * comprueban que se pueden traducir: que cada forma tiene su fila, que se ve de
 * quién es cada una, y que lo que se escribe llega al archivo guardado.
 */
import { readFileSync } from 'node:fs';
import { test, expect, cargarPo } from './apoyo.js';

/**
 * Guarda el archivo desde el menú Archivo y devuelve lo que se ha descargado.
 *
 * Se pasa por el camino de verdad —el mismo botón que pulsa quien traduce— en
 * lugar de llamar al reconstructor por dentro: lo que hay que comprobar es que
 * el archivo que llega al disco es el bueno.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function guardarYLeer(page) {
    const descarga = page.waitForEvent('download');
    await page.locator('#fileBtn').click();
    await page.locator('#saveFileBtn').click();
    const archivo = await descarga;
    return readFileSync(await archivo.path(), 'utf8');
}

/**
 * Espera a que el editor haya pasado a memoria lo recién escrito.
 *
 * No actualiza su modelo en cada pulsación: espera 300 ms desde la última tecla.
 */
async function esperarAlEditor(page) {
    await page.waitForTimeout(500);
}

const PO_CON_PLURALES = `msgid ""
msgstr ""
"Language: es\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#: app.py:10
msgid "One file"
msgid_plural "%d files"
msgstr[0] "Un archivo"
msgstr[1] "%d archivos"

msgid "Cat"
msgstr "Gato"
`;

test.describe('traducir plurales', () => {
    test('cada forma tiene su fila', async ({ page }) => {
        await cargarPo(page, PO_CON_PLURALES);

        // Dos formas de la entrada con plural, más la entrada normal.
        await expect(page.locator('.segmento-fila')).toHaveCount(3);
    });

    test('la primera forma enseña el singular y la segunda el plural', async ({ page }) => {
        // Es lo que hay que tener delante para traducir cada una.
        await cargarPo(page, PO_CON_PLURALES);

        await expect(page.locator('#msgid-pre-1-0')).toContainText('One file');
        await expect(page.locator('#msgid-pre-1-1')).toContainText('%d files');
    });

    test('cada fila dice qué forma de plural es', async ({ page }) => {
        await cargarPo(page, PO_CON_PLURALES);

        const marcas = page.locator('.segmento-plural');
        await expect(marcas).toHaveCount(2);
        await expect(marcas.nth(0)).toHaveText('[0]');
        await expect(marcas.nth(1)).toHaveText('[1]');
    });

    test('la entrada sin plural no lleva marca', async ({ page }) => {
        await cargarPo(page, PO_CON_PLURALES);

        const fila = page.locator('.segmento-fila').nth(2);
        await expect(fila.locator('.segmento-plural')).toHaveCount(0);
    });

    test('las traducciones que ya venían salen en su sitio', async ({ page }) => {
        await cargarPo(page, PO_CON_PLURALES);

        await expect(page.locator('#msgstr-1-0')).toHaveValue('Un archivo');
        await expect(page.locator('#msgstr-1-1')).toHaveValue('%d archivos');
    });

    test('el aviso de etiquetas funciona en cada forma por separado', async ({ page }) => {
        // La segunda forma lleva %d y la primera no: cada fila se revisa con el
        // original que le toca.
        await cargarPo(page, PO_CON_PLURALES);

        await page.locator('#msgstr-1-1').fill('archivos');
        await expect(page.locator('#avisoEtiquetas-1-1')).toBeVisible();
        await expect(page.locator('#avisoEtiquetas-1-0')).toBeHidden();
    });

    test('lo que se traduce llega al archivo guardado', async ({ page }) => {
        await cargarPo(page, PO_CON_PLURALES);

        await page.locator('#msgstr-1-0').fill('Un fichero');
        await page.locator('#msgstr-1-1').fill('%d ficheros');
        await page.locator('#msgstr-1-1').blur();
        await esperarAlEditor(page);

        const guardado = await guardarYLeer(page);

        expect(guardado).toContain('msgid_plural "%d files"');
        expect(guardado).toContain('msgstr[0] "Un fichero"');
        expect(guardado).toContain('msgstr[1] "%d ficheros"');
    });

    test('abrir y guardar sin tocar nada devuelve el archivo igual', async ({ page }) => {
        // La prueba que de verdad importa: antes, este mismo paso se llevaba por
        // delante el msgid_plural y las dos traducciones ya hechas, y quedaba un
        // msgstr vacío. Se guardaba trabajo perdido sin avisar de nada.
        await cargarPo(page, PO_CON_PLURALES);

        expect(await guardarYLeer(page)).toBe(PO_CON_PLURALES);
    });
});
