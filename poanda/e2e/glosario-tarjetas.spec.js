/**
 * Cómo se ven los términos del glosario.
 *
 * Eran filas de una tabla de tres columnas —origen, destino, borrar— dentro de
 * un panel de unos 300 píxeles. La definición y las notas, que son lo que
 * explica por qué esa traducción y no otra, no salían en ninguna parte: había
 * que abrir la ficha de cada término para verlas.
 *
 * Ahora cada término es una tarjeta, como en Locversia, y las que están en el
 * segmento que se tiene delante van primero y marcadas. Lo que se comprueba
 * aquí es que la tarjeta trae lo que hace falta para decidir, que se puede
 * insertar y borrar desde ella, y sobre todo que **un término recién añadido
 * sale marcado como coincidencia sin tener que salir del segmento y volver**,
 * que era el fallo que hacía dudar de si el glosario estaba funcionando.
 */
import { test, expect, anadirTermino, cargarPo } from './apoyo.js';

const PO_GLOSARIO = `msgid ""
msgstr ""
"Language: es\\n"

#: a.php:1
msgid "Save the current file before closing"
msgstr ""

#: a.php:2
msgid "Choose a colour"
msgstr ""
`;

const tarjetas = (page) => page.locator('#glosarioLista .glosario-tarjeta');

test.describe('las tarjetas del glosario', () => {
    test('un término recién añadido sale marcado como coincidencia', async ({ page }) => {
        // El fallo: la lista de términos del segmento se hacía solo al entrar
        // en él. Añadir uno estando dentro no la tocaba, así que el panel no
        // señalaba la palabra recién guardada hasta salir y volver a entrar —
        // que es justo cuando uno mira si ha funcionado.
        await cargarPo(page, PO_GLOSARIO);
        await page.locator('#msgstr-1-0').click();

        await anadirTermino(page, 'file', 'archivo');

        await expect(tarjetas(page).first()).toHaveClass(/glosario-tarjeta-coincidencia/);
    });

    test('la palabra queda marcada en el original', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await page.locator('#msgstr-1-0').click();

        await anadirTermino(page, 'file', 'archivo');

        await expect(page.locator('#msgid-pre-1-0 .glossary-highlight')).toHaveText('file');
    });

    test('la tarjeta trae el término, la traducción y su ficha', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'file', 'archivo', {
            categoria: 'noun',
            definicion: 'Un conjunto de datos guardado con un nombre',
            notas: 'No traducir como fichero',
        });

        const tarjeta = tarjetas(page).first();
        await expect(tarjeta.locator('.glosario-tarjeta-origen')).toContainText('file');
        await expect(tarjeta.locator('.glosario-tarjeta-destino')).toHaveText('archivo');
        // La definición y las notas antes no salían en el panel: había que
        // abrir la ficha de cada término para leerlas.
        await expect(tarjeta.locator('.glosario-tarjeta-definicion')).toContainText('conjunto');
        await expect(tarjeta.locator('.glosario-tarjeta-notas')).toContainText('fichero');
        await expect(tarjeta.locator('.glosario-categoria')).not.toBeEmpty();

        // Y la tabla que había antes ya no existe.
        await expect(page.locator('#glossaryTableBody')).toHaveCount(0);
    });

    test('un término sin ficha no enseña líneas vacías', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'file', 'archivo');

        const tarjeta = tarjetas(page).first();
        await expect(tarjeta.locator('.glosario-tarjeta-definicion')).toHaveCount(0);
        await expect(tarjeta.locator('.glosario-tarjeta-notas')).toHaveCount(0);
    });

    test('el botón de insertar pone la traducción en el segmento', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await page.locator('#msgstr-1-0').click();
        await anadirTermino(page, 'file', 'archivo');

        await page.locator('#msgstr-1-0').click();
        await tarjetas(page).first().locator('.glosario-insertar').click();

        await expect(page.locator('#msgstr-1-0')).toHaveValue('archivo');
    });

    test('insertar no abre la ficha del término', async ({ page }) => {
        // La tarjeta entera abre la ficha; el botón de dentro no puede
        // arrastrar ese clic consigo, o insertar abriría un cuadro encima.
        await cargarPo(page, PO_GLOSARIO);
        await page.locator('#msgstr-1-0').click();
        await anadirTermino(page, 'file', 'archivo');

        await page.locator('#msgstr-1-0').click();
        await tarjetas(page).first().locator('.glosario-insertar').click();

        await expect(page.locator('#terminoModal')).toBeHidden();
    });

    test('la tarjeta abre la ficha del término, y la equis lo borra', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'file', 'archivo');

        await tarjetas(page).first().click();
        await expect(page.locator('#terminoModal')).toBeVisible();
        await expect(page.locator('#terminoOrigen')).toHaveValue('file');
        await page.locator('#terminoCancelarBtn').click();

        await tarjetas(page).first().locator('.glossary-delete-btn').click();
        await expect(tarjetas(page)).toHaveCount(0);
    });

    test('las del segmento van primero, y el resto debajo', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'colour', 'color');
        await anadirTermino(page, 'file', 'archivo');

        // En el primer segmento está "file", no "colour".
        await page.locator('#msgstr-1-0').click();

        await expect(tarjetas(page).first()).toHaveClass(/glosario-tarjeta-coincidencia/);
        await expect(tarjetas(page).first().locator('.glosario-tarjeta-destino')).toHaveText(
            'archivo',
        );
        await expect(tarjetas(page).nth(1)).not.toHaveClass(/glosario-tarjeta-coincidencia/);
        // Con dos grupos hay dos rótulos que los separan.
        await expect(page.locator('#glosarioLista .glosario-grupo')).toHaveCount(2);
    });

    test('con un solo grupo no salen rótulos que no separan nada', async ({ page }) => {
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#msgstr-1-0').click();

        await expect(tarjetas(page)).toHaveCount(1);
        await expect(page.locator('#glosarioLista .glosario-grupo')).toHaveCount(0);
    });

    test('el texto de la tarjeta se lee sobre su fondo', async ({ page }) => {
        // El fallo que ya se ha colado dos veces en este proyecto: usar como
        // color de letra un gris que en realidad es un gris de borde.
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'file', 'archivo', { definicion: 'Datos con un nombre' });

        const colores = await tarjetas(page)
            .first()
            .evaluate((tarjeta) => {
                const de = (sel) => getComputedStyle(tarjeta.querySelector(sel)).color;
                return {
                    fondo: getComputedStyle(tarjeta).backgroundColor,
                    origen: de('.glosario-tarjeta-origen'),
                    destino: de('.glosario-tarjeta-destino'),
                    definicion: de('.glosario-tarjeta-definicion'),
                };
            });

        const claridad = (c) =>
            (c.match(/\d+/g) || [0, 0, 0]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
        for (const parte of ['origen', 'destino', 'definicion']) {
            expect(colores[parte], parte).not.toBe(colores.fondo);
            expect(claridad(colores[parte]), parte).toBeLessThan(200);
        }
    });

    test('la tarjeta del ratón dice a qué palabra corresponde', async ({ page }) => {
        // Con dos términos marcados seguidos en la misma frase, una tarjeta que
        // solo enseña la traducción no dice de cuál de los dos habla.
        await cargarPo(page, PO_GLOSARIO);
        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#msgstr-1-0').click();

        await page.locator('#msgid-pre-1-0 .glossary-highlight').hover();

        const tarjeta = page.locator('#terminoTarjeta');
        await expect(tarjeta).toBeVisible();
        await expect(tarjeta.locator('.termino-tarjeta-encontrado')).toContainText('file');
        await expect(tarjeta.locator('.termino-tarjeta-traduccion')).toContainText('archivo');
    });
});
