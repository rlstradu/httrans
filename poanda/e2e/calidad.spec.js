/**
 * El control de calidad, de punta a punta.
 *
 * La lógica de qué se señala está probada aparte, sin navegador (tests/qa.js).
 * Lo que se comprueba aquí es que funcione como un modo de trabajo y no como un
 * informe: que el panel se queda abierto mientras se corrige, que el aviso sale
 * también junto a su segmento, que se puede dejar en pantalla solo lo que tiene
 * avisos, y que al corregir un segmento su aviso desaparece solo.
 *
 * Esa última parte es la que distingue una herramienta de una lista: si hay que
 * pulsar un botón para que el panel se entere de lo que acabas de arreglar, se
 * deja de pulsar a la tercera vez.
 */
import { test, expect, anadirTermino, cargarPo } from './apoyo.js';

/** Un archivo con un fallo de cada clase, a propósito. */
const PO_CON_FALLOS = `msgid ""
msgstr ""
"Language: es\\n"

#: a.php:1
msgid "Save 5 files"
msgstr ""

#: a.php:2
msgid "Delete 3 items"
msgstr "Eliminar 4 elementos"

#: a.php:3
msgid "Open the file"
msgstr "Abre  el documento"

#: a.php:4
msgid "Close the window."
msgstr "Cierra la ventana"

#: a.php:5
msgid "Print"
msgstr "Imprimir"
`;

/** Un archivo impecable. */
const PO_LIMPIO = `msgid ""
msgstr ""
"Language: es\\n"

#: a.php:1
msgid "Save changes"
msgstr "Guardar cambios"

#: a.php:2
msgid "Delete"
msgstr "Eliminar"
`;

/** Abre el panel. No revisa: eso se pide aparte, como en la herramienta. */
async function abrirCalidad(page) {
    await page.locator('#qaBtn').click();
    await expect(page.locator('#qaPanel')).toBeVisible();
}

async function revisar(page) {
    await page.locator('#qaRevisarBtn').click();
    await expect(page.locator('#qaResumen')).not.toHaveClass(/qa-resumen-espera/);
}

/** Cuántos avisos hay de una comprobación, según su pastilla del resumen. */
async function cuantosDe(page, comprobacion) {
    const pastilla = page.locator(`.qa-pastilla[data-comprobacion="${comprobacion}"]`);
    if ((await pastilla.count()) === 0) return 0;
    const texto = await pastilla.textContent();
    return Number(texto.split(':').pop().trim());
}

const grupo = (page, comprobacion) =>
    page.locator(`.qa-grupo[data-comprobacion="${comprobacion}"]`);

const casilla = (page, comprobacion) =>
    page.locator(`.qa-interruptor[data-comprobacion="${comprobacion}"] input`);

test.describe('el control de calidad', () => {
    test('antes de revisar no dice que esté todo bien', async ({ page }) => {
        // "Sin avisos" y "sin revisar" no son lo mismo, y enseñar un cero
        // cuando no se ha mirado nada sería mentir.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);

        await expect(page.locator('#qaResumen')).toHaveClass(/qa-resumen-espera/);
        await expect(page.locator('.qa-aviso')).toHaveCount(0);
        await expect(page.locator('.segmento-aviso-calidad:visible')).toHaveCount(0);
    });

    test('un archivo impecable lo dice y no inventa avisos', async ({ page }) => {
        // Es la mitad del trabajo: una lista que siempre trae algo no sirve
        // para decidir si se puede entregar.
        await cargarPo(page, PO_LIMPIO);
        await abrirCalidad(page);
        await revisar(page);

        await expect(page.locator('#qaResumen')).toHaveClass(/qa-resumen-limpio/);
        await expect(page.locator('.qa-aviso')).toHaveCount(0);
    });

    test('encuentra cada clase de fallo', async ({ page }) => {
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);

        expect(await cuantosDe(page, 'sin_traducir')).toBe(1);
        expect(await cuantosDe(page, 'numeros')).toBe(1);
        expect(await cuantosDe(page, 'espacios_dobles')).toBe(1);
        expect(await cuantosDe(page, 'puntuacion_final')).toBe(1);
    });

    test('el panel se queda abierto al ir a un segmento', async ({ page }) => {
        // Es la diferencia entre un panel y una ventana: se corrige con la
        // lista delante, no cerrándola cada vez.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);

        await grupo(page, 'numeros').locator('.qa-aviso').first().click();

        await expect(page.locator('#qaPanel')).toBeVisible();
        await expect(page.locator('#msgstr-2-0')).toBeFocused();
    });

    test('el aviso sale también junto a su segmento', async ({ page }) => {
        // La lista dice cuántos hay; el triángulo dice cuál es este, y sale
        // donde se está trabajando.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);

        await expect(page.locator('#avisoCalidad-2-0')).toBeVisible();
        // Y dice lo que ha encontrado, sin abrir nada.
        expect(await page.locator('#avisoCalidad-2-0').getAttribute('title')).toContain('3');
        // El segmento que está bien no lleva triángulo.
        await expect(page.locator('#avisoCalidad-5-0')).toBeHidden();
    });

    test('corregir un segmento le quita el aviso, sin pulsar nada', async ({ page }) => {
        // Si hubiera que volver a pulsar Revisar para ver el efecto de cada
        // corrección, se dejaría de pulsar a la tercera.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);
        await expect(page.locator('#avisoCalidad-2-0')).toBeVisible();

        await page.locator('#msgstr-2-0').fill('Eliminar 3 elementos');
        await page.locator('#msgstr-2-0').blur();

        await expect(page.locator('#avisoCalidad-2-0')).toBeHidden({ timeout: 10_000 });
    });

    test('deja en pantalla solo los segmentos con avisos', async ({ page }) => {
        // Esto es lo que convierte la lista en una tanda de trabajo.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);

        await page.locator('#qaSoloConAvisosCheck').check();

        // El quinto no tiene nada que corregir y se va de la pantalla.
        await expect(page.locator('#translation-unit-5')).toBeHidden();
        await expect(page.locator('#translation-unit-2')).toBeVisible();

        // Y al quitar el filtro vuelve todo.
        await page.locator('#qaSoloConAvisosCheck').uncheck();
        await expect(page.locator('#translation-unit-5')).toBeVisible();
    });

    test('cerrar el panel devuelve el archivo entero', async ({ page }) => {
        // Quedarse con medio archivo escondido y sin el panel que lo explica es
        // la mejor manera de creer que faltan segmentos.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);
        await page.locator('#qaSoloConAvisosCheck').check();
        await expect(page.locator('#translation-unit-5')).toBeHidden();

        await page.locator('#qaCloseBtn').click();

        await expect(page.locator('#qaPanel')).toBeHidden();
        await expect(page.locator('#translation-unit-5')).toBeVisible();
    });

    test('avisa del término del glosario que no se ha usado', async ({ page }) => {
        await cargarPo(page, PO_CON_FALLOS);
        await anadirTermino(page, 'file', 'archivo');

        await abrirCalidad(page);
        await revisar(page);

        // "Open the file" está traducido como "Abre el documento".
        expect(await cuantosDe(page, 'glosario')).toBe(1);
    });

    test('avisa de la misma frase traducida de dos maneras', async ({ page }) => {
        const repetido = `msgid ""
msgstr ""
"Language: es\\n"

#: a.php:1
msgid "Save"
msgstr "Guardar"

#: a.php:2
msgid "Save"
msgstr "Almacenar"
`;
        await cargarPo(page, repetido);
        await abrirCalidad(page);
        await revisar(page);

        // Se señalan las dos, para poder ir a comparar.
        expect(await cuantosDe(page, 'inconsistencia')).toBe(2);
    });

    test('apagar una comprobación la quita de la lista y del segmento', async ({ page }) => {
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);
        await expect(grupo(page, 'puntuacion_final')).toBeVisible();

        // Al revisar por primera vez, las comprobaciones se pliegan: se miran
        // una vez para ajustarlas y a partir de ahí lo que interesa es la lista.
        await page.locator('#qaComprobacionesToggle').click();
        await casilla(page, 'puntuacion_final').uncheck();

        await expect(grupo(page, 'puntuacion_final')).toHaveCount(0);
        // Y el triángulo del segmento que solo tenía ese aviso se va con ella.
        await expect(page.locator('#avisoCalidad-4-0')).toBeHidden();
    });

    test('lo apagado sigue apagado al volver', async ({ page }) => {
        // Traduciendo una interfaz, avisar del punto final en cada botón es
        // ruido; volver a apagarlo cada mañana es cansino.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await casilla(page, 'puntuacion_final').uncheck();

        await page.reload();
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);

        await expect(casilla(page, 'puntuacion_final')).not.toBeChecked();
    });

    test('tiene su propio botón en la barra, aparte de los paneles', async ({ page }) => {
        // El control de calidad no tiene nada que ver con la memoria ni con el
        // glosario: aquéllos son lo que se consulta mientras se traduce, esto
        // es lo que se mira al terminar.
        await cargarPo(page, PO_LIMPIO);

        await expect(page.locator('#qaBtn')).toBeVisible();
        // Y no está escondido dentro del menú de herramientas.
        await expect(page.locator('.dropdown-content #qaBtn')).toHaveCount(0);
    });

    test('el botón enciende y apaga el panel, y lo dice', async ({ page }) => {
        await cargarPo(page, PO_LIMPIO);
        await expect(page.locator('#qaBtn')).not.toHaveClass(/utility-btn-active/);

        await page.locator('#qaBtn').click();
        await expect(page.locator('#qaPanel')).toBeVisible();
        await expect(page.locator('#qaBtn')).toHaveClass(/utility-btn-active/);

        await page.locator('#qaBtn').click();
        await expect(page.locator('#qaPanel')).toBeHidden();
        await expect(page.locator('#qaBtn')).not.toHaveClass(/utility-btn-active/);
    });

    test('nuevo proyecto recoge el panel', async ({ page }) => {
        // Igual que el asistente: una revisión del archivo que ya no está no
        // dice nada, y el botón encendido señalaría a un panel que no se ve.
        await cargarPo(page, PO_CON_FALLOS);
        await abrirCalidad(page);
        await revisar(page);

        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        await expect(page.locator('#qaPanel')).toBeHidden();
        await expect(page.locator('#qaBtn')).not.toHaveClass(/utility-btn-active/);
    });

    test('el panel está en los dos idiomas', async ({ page }) => {
        await cargarPo(page, PO_LIMPIO);
        await abrirCalidad(page);
        await expect(page.locator('#qaPanel h3')).not.toBeEmpty();

        const textos = await page.locator('.qa-interruptor span').first().textContent();
        expect(textos.trim().length).toBeGreaterThan(0);
    });
});
