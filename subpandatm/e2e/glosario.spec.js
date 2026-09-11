/**
 * El glosario, tal y como funciona en Poanda.
 *
 * Lo que cambia respecto a lo que había: era un panel flotante que se abría
 * encima del editor, con su propia configuración de idiomas y una tabla de tres
 * columnas donde cada celda daba para cuatro palabras. Ahora es un recuadro
 * fijo en la columna de la derecha, los términos son tarjetas con su definición
 * y sus notas, el par de idiomas lo pone el proyecto, y al pasar el ratón por
 * una palabra marcada en el texto sale su ficha entera.
 */
import { test, expect, cargarSrt, SRT_EJEMPLO } from './apoyo.js';

const SRT_CON_TERMINO = `1
00:00:01,000 --> 00:00:03,000
Save the file to your computer

2
00:00:04,000 --> 00:00:06,500
Open the folder
`;

/** Añade un término con su ficha, como haría cualquiera. */
async function anadirTermino(page, origen, destino, extras = {}) {
    await page.locator('#addTermToggleBtn').click();
    await expect(page.locator('#terminoModal')).toBeVisible();
    await page.locator('#terminoOrigen').fill(origen);
    await page.locator('#terminoDestino').fill(destino);
    if (extras.definicion) await page.locator('#terminoDefinicion').fill(extras.definicion);
    if (extras.notas) await page.locator('#terminoNotas').fill(extras.notas);
    await page.locator('#terminoGuardarBtn').click();
    await expect(page.locator('#terminoModal')).toBeHidden();
}

test.describe('el glosario', () => {
    test.beforeEach(async ({ page }) => {
        await cargarSrt(page, SRT_CON_TERMINO);
    });

    test('está a la vista en cuanto hay un archivo abierto', async ({ page }) => {
        // Ya no es una ventana que haya que abrir y colocar: es una parte de la
        // pantalla de trabajo.
        await expect(page.locator('#terminologySidebar')).toBeVisible();
        await expect(page.locator('#translationMemorySidebar')).toBeVisible();
    });

    test('no vuelve a preguntar los idiomas: los toma del proyecto', async ({ page }) => {
        // Antes se configuraban dos veces, una aquí y otra en la memoria, y se
        // podían contradecir.
        await expect(page.locator('#glosarioParIdiomasTexto')).toContainText('English');
        await expect(page.locator('#glosarioParIdiomasTexto')).toContainText('Spanish');
        await expect(page.locator('#memoriaParIdiomasTexto')).toContainText('English');
    });

    test('un término añadido sale como tarjeta, con su definición', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo', {
            definicion: 'Conjunto de datos guardado con un nombre.',
        });

        const tarjeta = page.locator('#glosarioLista .glosario-tarjeta');
        await expect(tarjeta).toHaveCount(1);
        await expect(tarjeta).toContainText('file');
        await expect(tarjeta).toContainText('archivo');
        // La definición y las notas son lo que distingue un glosario de una
        // lista de equivalencias, y en la tabla de antes no salían.
        await expect(tarjeta).toContainText('Conjunto de datos');
    });

    test('el término queda marcado en el texto original', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo');

        const marca = page.locator('#original-pre-0 .glossary-highlight');
        await expect(marca).toHaveCount(1);
        await expect(marca).toHaveText('file');
    });

    test('un término recién añadido se marca sin salir del subtítulo', async ({ page }) => {
        // Si hubiera que salir y volver a entrar para verlo, se dejaría de
        // añadir términos sobre la marcha, que es cuando se añaden.
        await page.locator('#translation-0').click();
        await anadirTermino(page, 'computer', 'ordenador');

        await expect(page.locator('#original-pre-0 .glossary-highlight')).toHaveText('computer');
    });

    test('al pasar el ratón por la palabra sale su ficha', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo', { definicion: 'Datos con nombre.' });
        await page.locator('#translation-0').click();

        await page.locator('#original-pre-0 .glossary-highlight').hover();

        const tarjeta = page.locator('#terminoTarjeta');
        await expect(tarjeta).toBeVisible();
        await expect(tarjeta).toContainText('archivo');
        await expect(tarjeta).toContainText('Datos con nombre.');
    });

    test('desde la ficha se inserta la traducción en el subtítulo', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#translation-0').click();
        await page.locator('#original-pre-0 .glossary-highlight').hover();

        await page.locator('#terminoTarjeta .termino-tarjeta-insertar').click();

        await expect(page.locator('#translation-0')).toContainText('archivo');
    });

    test('el botón Insertar de la tarjeta del panel también escribe', async ({ page }) => {
        // Con el ratón, pulsar un botón saca el cursor del campo antes de que
        // llegue el clic. Si no se evita, el botón no hace nada.
        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#translation-0').click();

        await page.locator('#glosarioLista .glosario-insertar').first().click();

        await expect(page.locator('#translation-0')).toContainText('archivo');
    });

    test('las coincidencias del subtítulo salen primero', async ({ page }) => {
        await anadirTermino(page, 'folder', 'carpeta');
        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#translation-0').click();

        // "file" está en el primer subtítulo; "folder", no.
        const primera = page.locator('#glosarioLista .glosario-tarjeta').first();
        await expect(primera).toContainText('file');
        await expect(primera).toHaveClass(/glosario-tarjeta-coincidencia/);
    });

    test('pulsar una tarjeta abre su ficha para corregirla', async ({ page }) => {
        // Antes, arreglar una errata obligaba a borrar el término y volver a
        // escribirlo entero.
        await anadirTermino(page, 'fille', 'archivo');

        await page.locator('#glosarioLista .glosario-tarjeta').first().click();

        await expect(page.locator('#terminoModal')).toBeVisible();
        await expect(page.locator('#terminoOrigen')).toHaveValue('fille');
        await page.locator('#terminoOrigen').fill('file');
        await page.locator('#terminoGuardarBtn').click();

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toContainText('file');
    });

    test('el buscador filtra los términos', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo');
        await anadirTermino(page, 'folder', 'carpeta');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(2);

        await page.locator('#buscarPaneles').fill('carp');

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
        await expect(page.locator('#glosarioLista')).toContainText('folder');
    });

    test('borrar un término lo quita de la lista y del texto', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo');
        await expect(page.locator('#original-pre-0 .glossary-highlight')).toHaveCount(1);

        await page.locator('#glosarioLista .glossary-delete-btn').first().click();

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
        await expect(page.locator('#original-pre-0 .glossary-highlight')).toHaveCount(0);
    });

    test('un término sin traducción no se guarda', async ({ page }) => {
        await page.locator('#addTermToggleBtn').click();
        await page.locator('#terminoOrigen').fill('file');
        await page.locator('#terminoGuardarBtn').click();

        await expect(page.locator('#terminoModal')).toBeVisible();
        await expect(page.locator('#terminoError')).not.toBeEmpty();
    });
});

test.describe('el aviso de los paneles vacíos', () => {
    test('lo dice el panda, y solo mientras están los dos vacíos', async ({ page }) => {
        await cargarSrt(page, SRT_EJEMPLO);

        await expect(page.locator('#panelesAviso')).toBeVisible();
        await expect(page.locator('#panelesAviso .paneles-aviso-panda')).toBeVisible();

        await page.locator('#addTermToggleBtn').click();
        await page.locator('#terminoOrigen').fill('file');
        await page.locator('#terminoDestino').fill('archivo');
        await page.locator('#terminoGuardarBtn').click();

        await expect(page.locator('#panelesAviso')).toBeHidden();
    });
});
