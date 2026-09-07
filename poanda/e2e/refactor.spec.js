/**
 * Estos tests cubren exactamente lo que cambió el refactor a módulos ES:
 * los botones que antes llamaban a una función global desde el atributo
 * onclick del HTML, y los diálogos propios que sustituyen a confirm() y
 * prompt() del navegador.
 *
 * Son los que más valor tienen: si el refactor rompiera algo, sería aquí.
 */
import { test, expect, cargarPo, PO_EJEMPLO } from './apoyo.js';

test.describe('glosario (botones que antes eran onclick)', () => {
    test.beforeEach(async ({ page }) => {
        // El glosario ya no pregunta idiomas: los toma del proyecto, así que se
        // abre directamente el editor. Antes había que pasar por una pantalla
        // de configuración que pedía por segunda vez un dato que el proyecto ya
        // tiene.
        await page.locator('#terminologyBtn').click();
        await expect(page.locator('#terminologySidebar')).toBeVisible();
        await expect(page.locator('#terminologyEditorSection')).toBeVisible();
    });

    test('añadir un término lo muestra en la tabla', async ({ page }) => {
        await page.locator('#srcTerm').fill('file');
        await page.locator('#tgtTerm').fill('archivo');
        await page.locator('#addTermBtn').click();

        await expect(page.locator('#glossaryTableBody')).toContainText('file');
        await expect(page.locator('#glossaryTableBody')).toContainText('archivo');
    });

    test('borrar un término lo quita de la tabla', async ({ page }) => {
        await page.locator('#srcTerm').fill('file');
        await page.locator('#tgtTerm').fill('archivo');
        await page.locator('#addTermBtn').click();
        await expect(page.locator('#glossaryTableBody tr')).toHaveCount(1);

        // Este botón se crea desde JavaScript: antes llevaba onclick incrustado
        // y ahora se engancha con addEventListener al pintar la tabla.
        await page.locator('.glossary-delete-btn').first().click();
        await expect(page.locator('#glossaryTableBody tr')).toHaveCount(0);
    });

    test('el buscador del glosario filtra los términos', async ({ page }) => {
        for (const [src, tgt] of [
            ['file', 'archivo'],
            ['string', 'cadena'],
        ]) {
            await page.locator('#srcTerm').fill(src);
            await page.locator('#tgtTerm').fill(tgt);
            await page.locator('#addTermBtn').click();
        }
        await expect(page.locator('#glossaryTableBody tr')).toHaveCount(2);

        // El campo de búsqueda usaba oninput="renderGlossary()"
        await page.locator('#searchTerm').fill('string');
        await expect(page.locator('#glossaryTableBody tr')).toHaveCount(1);
        await expect(page.locator('#glossaryTableBody')).toContainText('cadena');
    });
});

test.describe('lo que dicen los paneles cuando están vacíos', () => {
    test('la memoria dice que está vacía y que se puede importar una', async ({ page }) => {
        // Antes decía "crea una memoria nueva o importa un TMX", que mandaba a
        // buscar un botón que no hace falta pulsar: la memoria existe desde que
        // se abre el archivo.
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#tmBtn').click();

        const aviso = page.locator('#memoriaVacia');
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText(/empty/i);
        await expect(aviso).toContainText(/\.tmx/);
        await expect(aviso).not.toContainText(/create a new/i);

        // Y no se repite el "no se encontraron coincidencias": es el mismo
        // hecho contado dos veces.
        await expect(page.locator('#tmNoMatchFoundMessage')).toBeHidden();
    });

    test('el aviso de la memoria se va al validar el primer segmento', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#tmBtn').click();
        await expect(page.locator('#memoriaVacia')).toBeVisible();

        // Validar un segmento traducido es lo que mete la unidad en la memoria.
        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        await page.locator('#validateBtn-2-0').click();

        await expect(page.locator('#memoriaVacia')).toBeHidden();
    });

    test('el glosario dice lo mismo, a su manera', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#terminologyBtn').click();

        const aviso = page.locator('#glosarioVacio');
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText(/empty/i);
        await expect(aviso).toContainText(/\.tbx/);
    });

    test('el aviso del glosario se va al añadir el primer término', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#terminologyBtn').click();
        await expect(page.locator('#glosarioVacio')).toBeVisible();

        await page.locator('#srcTerm').fill('file');
        await page.locator('#tgtTerm').fill('archivo');
        await page.locator('#addTermBtn').click();

        await expect(page.locator('#glosarioVacio')).toBeHidden();
    });
});

test.describe('el par de idiomas manda en el glosario y en la memoria', () => {
    test('los dos paneles enseñan el par del proyecto, sin preguntarlo', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'en-US', destino: 'es-ES' });

        await page.locator('#terminologyBtn').click();
        await expect(page.locator('#glosarioParIdiomas')).toHaveText(
            'American English → European Spanish'
        );

        await page.locator('#tmBtn').click();
        await expect(page.locator('#memoriaParIdiomas')).toContainText('American English');
    });

    test('cambiarlo desde la barra lo cambia en los dos paneles a la vez', async ({ page }) => {
        // Eran el mismo dato escrito en dos sitios que se podían contradecir.
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });
        await page.locator('#terminologyBtn').click();

        await page.locator('#parIdiomasBtn').click();
        await page.locator('#idiomaDestino').selectOption('pt-BR');
        await page.locator('#idiomasAceptarBtn').click();

        await expect(page.locator('#parIdiomasValor')).toHaveText('en → pt-BR');
        await expect(page.locator('#glosarioParIdiomas')).toContainText('Brazilian Portuguese');
    });
});

test.describe('memoria de traducción (botones que antes eran onclick)', () => {
    test('la memoria se abre directamente, sin pedir idiomas', async ({ page }) => {
        await page.locator('#tmBtn').click();
        await expect(page.locator('#translationMemorySidebar')).toBeVisible();
        await expect(page.locator('#tmEditorSection')).toBeVisible();
    });

    test('el buscador de la memoria responde al escribir', async ({ page }) => {
        // Con algo dentro: con la memoria vacía, el aviso de "sin resultados"
        // se calla a propósito y no serviría de prueba de que esto funciona.
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        await page.locator('#validateBtn-2-0').click();
        await page.locator('#tmBtn').click();

        // Usaba oninput="tmSearch()": si no estuviera enganchado, esto lanzaría
        // un error de JavaScript en vez de mostrar el mensaje de "sin resultados".
        const errores = [];
        page.on('pageerror', (e) => errores.push(e.message));
        await page.locator('#tmSearchInput').fill('algo que no está');
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
