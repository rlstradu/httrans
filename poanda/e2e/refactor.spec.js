/**
 * Estos tests cubren exactamente lo que cambió el refactor a módulos ES:
 * los botones que antes llamaban a una función global desde el atributo
 * onclick del HTML, y los diálogos propios que sustituyen a confirm() y
 * prompt() del navegador.
 *
 * Son los que más valor tienen: si el refactor rompiera algo, sería aquí.
 */
import { test, expect, anadirTermino, cargarPo, PO_EJEMPLO } from './apoyo.js';

test.describe('glosario (botones que antes eran onclick)', () => {
    test.beforeEach(async ({ page }) => {
        // El glosario está a la vista en cuanto hay un archivo abierto: ni se
        // abre con un botón ni pregunta idiomas, que los toma del proyecto.
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('#terminologySidebar')).toBeVisible();
        await expect(page.locator('#terminologyEditorSection')).toBeVisible();
    });

    test('añadir un término lo muestra en la lista', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo');

        await expect(page.locator('#glosarioLista')).toContainText('file');
        await expect(page.locator('#glosarioLista')).toContainText('archivo');
    });

    test('borrar un término lo quita de la lista', async ({ page }) => {
        await anadirTermino(page, 'file', 'archivo');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);

        // Este botón se crea desde JavaScript: antes llevaba onclick incrustado
        // y ahora se engancha con addEventListener al pintar la lista.
        //
        // Hay que bajar hasta él a propósito: el panel ya no ocupa la pantalla
        // entera, comparte columna con la memoria, y su contenido se desplaza
        // por dentro. Es lo que haría cualquiera con el ratón.
        const borrar = page.locator('.glossary-delete-btn').first();
        await borrar.scrollIntoViewIfNeeded();
        await borrar.click();
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });

    test('el buscador del glosario filtra los términos', async ({ page }) => {
        for (const [src, tgt] of [
            ['file', 'archivo'],
            ['string', 'cadena'],
        ]) {
            await anadirTermino(page, src, tgt);
        }
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(2);

        // El campo de búsqueda usaba oninput="renderGlossary()"; ahora es el
        // buscador único de la columna, que filtra las dos cosas a la vez.
        await page.locator('#buscarPaneles').fill('string');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
        await expect(page.locator('#glosarioLista')).toContainText('cadena');
    });
});

test.describe('los paneles responden al primer clic', () => {
    test('borrar un término funciona con un segmento en el foco', async ({ page }) => {
        // Con el foco dentro de un segmento —el estado normal mientras se
        // traduce—, pulsar un botón del glosario lo blanqueaba: al salir del
        // segmento se repintaba la lista entera, el botón desaparecía entre el
        // mousedown y el mouseup, y el navegador no llegaba a emitir el clic.
        // Se pulsaba y no pasaba nada; había que pulsar dos veces.
        await cargarPo(page, PO_EJEMPLO);

        await anadirTermino(page, 'file', 'archivo');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);

        // El foco, dentro de un segmento, como cuando se está traduciendo.
        await page.locator('#msgstr-1-0').click();

        const borrar = page.locator('.glossary-delete-btn').first();
        await borrar.scrollIntoViewIfNeeded();
        await borrar.click();

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });
});

test.describe('el par de idiomas manda en el glosario y en la memoria', () => {
    test('los dos paneles enseñan el par del proyecto, sin preguntarlo', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'en-US', destino: 'es-ES' });
        await expect(page.locator('#glosarioParIdiomas')).toHaveText(
            'American English → European Spanish'
        );
        await expect(page.locator('#memoriaParIdiomas')).toContainText('American English');
    });

    test('cambiarlo desde la barra lo cambia en los dos paneles a la vez', async ({ page }) => {
        // Eran el mismo dato escrito en dos sitios que se podían contradecir.
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        await page.locator('#parIdiomasBtn').click();
        await page.locator('#idiomaDestino').selectOption('pt-BR');
        await page.locator('#idiomasAceptarBtn').click();

        await expect(page.locator('#parIdiomasValor')).toHaveText('en → pt-BR');
        await expect(page.locator('#glosarioParIdiomas')).toContainText('Brazilian Portuguese');
    });
});

test.describe('memoria de traducción (botones que antes eran onclick)', () => {
    test('la memoria está a la vista, sin pedir idiomas ni abrirse', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('#translationMemorySidebar')).toBeVisible();
        await expect(page.locator('#tmEditorSection')).toBeVisible();
    });

    test('el buscador de la memoria responde al escribir', async ({ page }) => {
        // Con algo dentro: con la memoria vacía, el aviso de "sin resultados"
        // se calla a propósito y no serviría de prueba de que esto funciona.
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        await page.locator('#validateBtn-2-0').click();

        // Usaba oninput="tmSearch()": si no estuviera enganchado, esto lanzaría
        // un error de JavaScript en vez de mostrar el mensaje de "sin resultados".
        const errores = [];
        page.on('pageerror', (e) => errores.push(e.message));
        await page.locator('#buscarPaneles').fill('algo que no está');
        await expect(page.locator('#tmNoMatchFoundMessage')).toBeVisible();
        expect(errores).toEqual([]);
    });
});

test.describe('diálogos propios en lugar de los del navegador', () => {
    test('"Nuevo proyecto" pide confirmación con el diálogo de Poanda', async ({ page }) => {
        await cargarPo(page);

        // Si saliera el confirm() nativo, este diálogo no existiría y además
        // Playwright lo descartaría automáticamente.
        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();

        await expect(page.locator('#confirmModal')).toBeVisible();
        await expect(page.locator('#confirmModalText')).not.toBeEmpty();
    });

    test('cancelar la confirmación no borra el trabajo', async ({ page }) => {
        await cargarPo(page);
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);

        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalCancelBtn').click();

        await expect(page.locator('#confirmModal')).toBeHidden();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
    });

    test('aceptar la confirmación vacía el editor', async ({ page }) => {
        await cargarPo(page);

        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        await expect(page.locator('#confirmModal')).toBeHidden();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(0);
    });

    test('la tecla Escape cancela la confirmación', async ({ page }) => {
        await cargarPo(page);

        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await expect(page.locator('#confirmModal')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('#confirmModal')).toBeHidden();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
    });
});
