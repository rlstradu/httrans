/**
 * Cada proyecto, su memoria y su glosario.
 *
 * El fallo no se veía trabajando: se veía semanas después. Había una sola
 * memoria y un solo glosario para todo —las tablas de la base de datos existían
 * con su columna de proyecto y no las escribía nadie—, así que al abrir el
 * encargo de otro cliente te llevabas puestos los del anterior.
 *
 * Con dos clientes que traducen "file" de maneras distintas, la herramienta
 * proponía la del otro con toda naturalidad, y al revisar parecía una decisión
 * propia. Esa es la peor clase de error: el que no se ve.
 */
import { test, expect, anadirTermino, cargarPo } from './apoyo.js';

const PO_CLIENTE = (palabra) => `msgid ""
msgstr ""
"Language: es\\n"

#: a.php:1
msgid "Open the ${palabra} from the menu"
msgstr ""

#: a.php:2
msgid "Close the window"
msgstr ""
`;

/** Traduce el primer segmento y lo valida, que es lo que llena la memoria. */
async function traducirYValidar(page, texto) {
    await page.locator('#msgstr-1-0').fill(texto);
    await page.locator('#validateBtn-1-0').click();
}

/**
 * Abre de la lista de recientes el proyecto que ocupa esa posición.
 *
 * Abrir la lista guarda lo pendiente —incluidos la memoria y el glosario—, así
 * que estos tests no tienen que esperar al ciclo de diez segundos.
 */
async function abrirReciente(page, posicion) {
    await page.locator('#projectBtn').click();
    await page.locator('#recentProjectsBtn').click();
    await expect(page.locator('#recentProjectsModal')).toBeVisible();
    await page.locator('.recent-project-open').nth(posicion).click();

    const confirmar = page.locator('#confirmModalOkBtn');
    if (await confirmar.isVisible().catch(() => false)) await confirmar.click();
    await expect(page.locator('#recentProjectsModal')).toBeHidden();
    await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
}

test.describe('la memoria y el glosario van con su proyecto', () => {
    test('abrir otro archivo no arrastra la memoria del anterior', async ({ page }) => {
        await cargarPo(page, PO_CLIENTE('file'));
        await traducirYValidar(page, 'Abre el archivo desde el menú');
        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(0);

        // Segundo encargo, otro cliente.
        await cargarPo(page, PO_CLIENTE('document'));
        await page.locator('#msgstr-1-0').click();

        // La memoria empieza vacía: lo del cliente anterior no está aquí.
        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(0);
    });

    test('abrir otro archivo no arrastra el glosario del anterior', async ({ page }) => {
        await cargarPo(page, PO_CLIENTE('file'));
        await anadirTermino(page, 'file', 'archivo');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);

        await cargarPo(page, PO_CLIENTE('document'));

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });

    test('volver a un proyecto trae su memoria y su glosario', async ({ page }) => {
        // Lo contrario del fallo anterior, y hace falta comprobarlo: vaciar al
        // abrir un archivo es fácil; lo difícil es que al volver esté todo.
        await cargarPo(page, PO_CLIENTE('file'));
        await anadirTermino(page, 'file', 'archivo');
        await traducirYValidar(page, 'Abre el archivo desde el menú');

        // Abrir y cerrar la lista fuerza el guardado.
        await page.locator('#projectBtn').click();
        await page.locator('#recentProjectsBtn').click();
        await page.locator('#recentProjectsCloseBtn').click();

        await cargarPo(page, PO_CLIENTE('document'));
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);

        // El de antes es el segundo de la lista: el primero es el que acabo de
        // abrir, y ese no se puede volver a abrir.
        await abrirReciente(page, 1);

        // Su término vuelve, y su unidad de memoria también.
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
        await expect(page.locator('#glosarioLista .glosario-tarjeta-destino')).toHaveText(
            'archivo',
        );
        await page.locator('#msgstr-1-0').click();
        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(1);
    });

    test('cada cliente se queda con su traducción del mismo término', async ({ page }) => {
        // El fallo entero en un test: "file" es archivo para uno y fichero para
        // el otro, y ninguno de los dos puede ver la del otro.
        await cargarPo(page, PO_CLIENTE('file'));
        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#projectBtn').click();
        await page.locator('#recentProjectsBtn').click();
        await page.locator('#recentProjectsCloseBtn').click();

        await cargarPo(page, PO_CLIENTE('file'));
        await anadirTermino(page, 'file', 'fichero');

        await abrirReciente(page, 1);

        // Sea cual sea el que se abra, enseña un solo término, el suyo.
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
    });
});
