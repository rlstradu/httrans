/**
 * El glosario como glosario, no como lista de equivalencias.
 *
 * La regla que se comprueba aquí es que **lo que se decidió sobre un término
 * esté donde se traduce**. Un glosario sirve para no volver a pensar lo mismo
 * dos veces, y eso solo funciona si al llegar a la palabra se ve lo que se
 * decidió: la traducción, por qué es esa y qué no hay que hacer. Antes el
 * glosario era un par de palabras en una lista lateral; ahora cada término
 * lleva su ficha, el original se marca en amarillo de arriba abajo, y la ficha
 * sale al pasar el ratón por encima.
 */
import { readFileSync } from 'node:fs';
import { test, expect, anadirTermino, cargarPo, PO_EJEMPLO } from './apoyo.js';

/** Un PO con la misma palabra en varios segmentos. */
const PO_CON_FILE = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Open file"
msgstr ""

msgid "Save the file now"
msgstr ""

msgid "Nothing to see"
msgstr ""
`;

test.describe('la ficha de un término', () => {
    test('se rellena en su propio cuadro, no dentro del panel', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        // El formulario ya no vive en el panel de terminología.
        await expect(page.locator('#terminologySidebar #srcTerm')).toHaveCount(0);

        await page.locator('#addTermToggleBtn').click();
        const modal = page.locator('#terminoModal');
        await expect(modal).toBeVisible();
        // Y sale por delante del editor, no metido en media columna.
        await expect(modal.locator('#terminoOrigen')).toBeFocused();
    });

    test('tiene los cinco campos de PandaTerm', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#addTermToggleBtn').click();

        for (const campo of [
            '#terminoOrigen',
            '#terminoDestino',
            '#terminoCategoria',
            '#terminoDefinicion',
            '#terminoNotas',
        ]) {
            await expect(page.locator(campo)).toBeVisible();
        }

        // Las categorías son las mismas cuatro, más "sin especificar".
        const opciones = await page
            .locator('#terminoCategoria option')
            .evaluateAll((os) => os.map((o) => o.value));
        expect(opciones).toEqual(['', 'noun', 'verb', 'adj', 'adv']);
    });

    test('no deja guardar un término a medias', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#addTermToggleBtn').click();

        await page.locator('#terminoOrigen').fill('file');
        await page.locator('#terminoGuardarBtn').click();

        // Sigue abierto, con el aviso puesto: no se pierde lo escrito.
        await expect(page.locator('#terminoModal')).toBeVisible();
        await expect(page.locator('#terminoError')).not.toBeEmpty();
        await expect(page.locator('#terminoOrigen')).toHaveValue('file');
    });

    test('cancelar no añade nada', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#addTermToggleBtn').click();
        await page.locator('#terminoOrigen').fill('file');
        await page.locator('#terminoDestino').fill('archivo');
        await page.locator('#terminoCancelarBtn').click();

        await expect(page.locator('#terminoModal')).toBeHidden();
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });

    test('lo escrito en la ficha se guarda entero', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await anadirTermino(page, 'file', 'archivo', {
            categoria: 'noun',
            definicion: 'Un conjunto de datos con nombre.',
            notas: 'No traducir como "fichero".',
        });

        await page.locator('#glosarioLista .glosario-tarjeta').first().click();
        await expect(page.locator('#terminoOrigen')).toHaveValue('file');
        await expect(page.locator('#terminoDestino')).toHaveValue('archivo');
        await expect(page.locator('#terminoCategoria')).toHaveValue('noun');
        await expect(page.locator('#terminoDefinicion')).toHaveValue(
            'Un conjunto de datos con nombre.',
        );
        await expect(page.locator('#terminoNotas')).toHaveValue('No traducir como "fichero".');
    });
});

test.describe('corregir un término ya guardado', () => {
    test('pulsar su fila abre la ficha con lo que tiene dentro', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await anadirTermino(page, 'file', 'archivo', { notas: 'ojo con esto' });

        await page.locator('#glosarioLista .glosario-tarjeta').first().click();

        await expect(page.locator('#terminoModal')).toBeVisible();
        await expect(page.locator('#terminoOrigen')).toHaveValue('file');
        await expect(page.locator('#terminoNotas')).toHaveValue('ojo con esto');
        // Y aparece el botón de borrar, que al crear no está.
        await expect(page.locator('#terminoBorrarBtn')).toBeVisible();
    });

    test('la corrección sustituye al término, no añade otro', async ({ page }) => {
        // Antes, arreglar una errata obligaba a borrar y volver a escribirlo.
        await cargarPo(page, PO_EJEMPLO);
        await anadirTermino(page, 'fiel', 'archivo');

        await page.locator('#glosarioLista .glosario-tarjeta').first().click();
        await page.locator('#terminoOrigen').fill('file');
        await page.locator('#terminoGuardarBtn').click();

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
        await expect(page.locator('#glosarioLista')).toContainText('file');
        await expect(page.locator('#glosarioLista')).not.toContainText('fiel');
    });

    test('se puede borrar desde la propia ficha', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await anadirTermino(page, 'file', 'archivo');

        await page.locator('#glosarioLista .glosario-tarjeta').first().click();
        await page.locator('#terminoBorrarBtn').click();

        await expect(page.locator('#terminoModal')).toBeHidden();
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });

    test('el botón de borrar de la fila no abre la ficha', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await anadirTermino(page, 'file', 'archivo');

        await page.locator('.glossary-delete-btn').first().click();

        await expect(page.locator('#terminoModal')).toBeHidden();
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });

    test('un punto marca los términos que llevan ficha', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await anadirTermino(page, 'file', 'archivo', { definicion: 'algo' });
        await anadirTermino(page, 'save', 'guardar');

        await expect(page.locator('#glosarioLista .glosario-ficha')).toHaveCount(1);
    });
});

test.describe('el amarillo del glosario', () => {
    test('marca el término en todos los segmentos, sin tocar nada', async ({ page }) => {
        // Antes solo se marcaba el segmento en el que se estaba escribiendo, así
        // que no había manera de ver qué partes del archivo tienen terminología
        // decidida sin ir entrando una por una.
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo');

        await expect(page.locator('.segmento-origen .glossary-highlight')).toHaveCount(2);
    });

    test('quitar el término apaga el amarillo', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo');
        await expect(page.locator('.glossary-highlight')).toHaveCount(2);

        await page.locator('.glossary-delete-btn').first().click();
        await expect(page.locator('.glossary-highlight')).toHaveCount(0);
    });

    test('no se lleva por delante lo que se está traduciendo', async ({ page }) => {
        // El original se repinta entero al tocar el glosario. Si eso rehiciera
        // el editor, se perdería lo escrito a medias en el segmento activo.
        await cargarPo(page, PO_CON_FILE);
        await page.locator('#msgstr-1-0').fill('Abrir archivo');

        await anadirTermino(page, 'file', 'archivo');

        await expect(page.locator('#msgstr-1-0')).toHaveValue('Abrir archivo');
    });

    test('marca la palabra entera, no un trozo de otra', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'to', 'a');

        // "Nothing to see" lleva un "to" suelto; "Nothing" no debería contar.
        const marcados = await page
            .locator('.glossary-highlight')
            .evaluateAll((ns) => ns.map((n) => n.textContent));
        expect(marcados).toEqual(['to']);
    });
});

test.describe('la tarjeta del término', () => {
    test('sale al pasar el ratón y trae la ficha entera', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo', {
            categoria: 'noun',
            definicion: 'Un conjunto de datos con nombre.',
            notas: 'No traducir como "fichero".',
        });

        const tarjeta = page.locator('#terminoTarjeta');
        await expect(tarjeta).toBeHidden();

        await page.locator('.glossary-highlight').first().hover();

        await expect(tarjeta).toBeVisible();
        await expect(tarjeta).toContainText('archivo');
        await expect(tarjeta).toContainText('Un conjunto de datos con nombre.');
        await expect(tarjeta).toContainText('No traducir como "fichero".');
    });

    test('cabe dentro de la ventana', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo', { definicion: 'x'.repeat(200) });

        await page.locator('.glossary-highlight').first().hover();
        const caja = await page.locator('#terminoTarjeta').boundingBox();
        const ventana = page.viewportSize();

        expect(caja.x).toBeGreaterThanOrEqual(0);
        expect(caja.y).toBeGreaterThanOrEqual(0);
        expect(caja.x + caja.width).toBeLessThanOrEqual(ventana.width + 1);
        expect(caja.y + caja.height).toBeLessThanOrEqual(ventana.height + 1);
    });

    test('su botón mete la traducción donde está el cursor', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo');

        await page.locator('#msgstr-1-0').click();
        await page.locator('#msgstr-1-0').fill('Abrir ');
        await page.locator('.glossary-highlight').first().hover();
        await page.locator('.termino-tarjeta-insertar').first().click();

        await expect(page.locator('#msgstr-1-0')).toHaveValue('Abrir archivo');
        // Y se quita de en medio en cuanto ha hecho su trabajo.
        await expect(page.locator('#terminoTarjeta')).toBeHidden();
    });

    test('una palabra con dos fichas las enseña las dos', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo', { notas: 'en informática' });
        await anadirTermino(page, 'file', 'lima', { notas: 'la herramienta' });

        await page.locator('.glossary-highlight').first().hover();

        const tarjeta = page.locator('#terminoTarjeta');
        await expect(tarjeta.locator('.termino-tarjeta-ficha')).toHaveCount(2);
        await expect(tarjeta).toContainText('archivo');
        await expect(tarjeta).toContainText('lima');
    });

    test('la tecla Escape la cierra', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo');

        await page.locator('.glossary-highlight').first().hover();
        await expect(page.locator('#terminoTarjeta')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('#terminoTarjeta')).toBeHidden();
    });
});

test.describe('ida y vuelta con PandaTerm', () => {
    test('un glosario de PandaTerm entra con toda su ficha', async ({ page }) => {
        // El fallo de antes: Poanda leía <LangSet> con ele mayúscula y PandaTerm
        // exporta <langSet>, que es lo que dice el estándar. El archivo entraba
        // VACÍO y sin dar ningún error.
        await cargarPo(page, PO_CON_FILE);

        const tbx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE martif SYSTEM "TBXcoreStructV02.dtd">
<martif type="TBX" xml:lang="en">
  <martifHeader><fileDesc><sourceDesc><p>PandaTerm</p></sourceDesc></fileDesc></martifHeader>
  <text><body>
    <termEntry id="c1">
      <langSet xml:lang="en"><tig><term>file</term><termNote type="partOfSpeech">noun</termNote></tig></langSet>
      <langSet xml:lang="es"><tig>
        <term>archivo</term>
        <termNote type="comment">Nota que viene de PandaTerm.</termNote>
        <descrip type="definition">Definicion que viene de PandaTerm.</descrip>
      </tig></langSet>
    </termEntry>
  </body></text>
</martif>`;
        const seleccion = page.waitForEvent('filechooser');
        await page.locator('#importTbxBtn').click();
        await (await seleccion).setFiles({
            name: 'pandaterm.tbx',
            mimeType: 'application/xml',
            buffer: Buffer.from(tbx, 'utf8'),
        });

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
        await expect(page.locator('#glosarioLista')).toContainText('archivo');

        // Y la ficha llegó entera, no solo el par de palabras.
        await page.locator('#glosarioLista .glosario-tarjeta').first().click();
        await expect(page.locator('#terminoCategoria')).toHaveValue('noun');
        await expect(page.locator('#terminoDefinicion')).toHaveValue(
            'Definicion que viene de PandaTerm.',
        );
        await expect(page.locator('#terminoNotas')).toHaveValue('Nota que viene de PandaTerm.');
    });

    test('lo que exporta Poanda lleva langSet en minúscula', async ({ page }) => {
        await cargarPo(page, PO_CON_FILE);
        await anadirTermino(page, 'file', 'archivo', { definicion: 'algo' });

        const descarga = page.waitForEvent('download');
        await page.locator('#downloadTbxBtn').click();
        const tbx = readFileSync(await (await descarga).path(), 'utf8');

        expect(tbx).toContain('<langSet');
        expect(tbx).not.toContain('<LangSet');
        expect(tbx).toContain('<descrip type="definition">algo</descrip>');
    });
});
