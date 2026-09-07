/**
 * Estos tests cubren exactamente lo que cambió el refactor a módulos ES:
 * los botones que antes llamaban a una función global desde el atributo
 * onclick del HTML, y los diálogos propios que sustituyen a confirm() y
 * prompt() del navegador.
 *
 * Son los que más valor tienen: si el refactor rompiera algo, sería aquí.
 */
import { test, expect, cargarPo } from './apoyo.js';

test.describe('glosario (botones que antes eran onclick)', () => {
    test.beforeEach(async ({ page }) => {
        await page.locator('#terminologyBtn').click();
        await expect(page.locator('#terminologySidebar')).toBeVisible();
    });

    test('confirmar idiomas abre el editor del glosario', async ({ page }) => {
        await page.locator('#configSrcLang').fill('en');
        await page.locator('#configTgtLang').fill('es');
        await page.locator('#confirmLanguagesBtn').click();

        await expect(page.locator('#terminologyEditorSection')).toBeVisible();
        await expect(page.locator('#displaySrcLang')).toHaveValue('en');
        await expect(page.locator('#displayTgtLang')).toHaveValue('es');
    });

    test('añadir un término lo muestra en la tabla', async ({ page }) => {
        await page.locator('#configSrcLang').fill('en');
        await page.locator('#configTgtLang').fill('es');
        await page.locator('#confirmLanguagesBtn').click();

        await page.locator('#srcTerm').fill('file');
        await page.locator('#tgtTerm').fill('archivo');
        await page.locator('#addTermBtn').click();

        await expect(page.locator('#glossaryTableBody')).toContainText('file');
        await expect(page.locator('#glossaryTableBody')).toContainText('archivo');
    });

    test('borrar un término lo quita de la tabla', async ({ page }) => {
        await page.locator('#configSrcLang').fill('en');
        await page.locator('#configTgtLang').fill('es');
        await page.locator('#confirmLanguagesBtn').click();

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
        await page.locator('#configSrcLang').fill('en');
        await page.locator('#configTgtLang').fill('es');
        await page.locator('#confirmLanguagesBtn').click();

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

test.describe('memoria de traducción (botones que antes eran onclick)', () => {
    test('confirmar idiomas abre el editor de la memoria', async ({ page }) => {
        await page.locator('#tmBtn').click();
        await expect(page.locator('#translationMemorySidebar')).toBeVisible();

        await page.locator('#tmConfigSrcLang').fill('en');
        await page.locator('#tmConfigTgtLang').fill('es');
        await page.locator('#tmConfirmLanguagesBtn').click();

        await expect(page.locator('#tmEditorSection')).toBeVisible();
        await expect(page.locator('#displayTmSrcLang')).toHaveValue('en');
    });

    test('el buscador de la memoria responde al escribir', async ({ page }) => {
        await page.locator('#tmBtn').click();
        await page.locator('#tmConfigSrcLang').fill('en');
        await page.locator('#tmConfigTgtLang').fill('es');
        await page.locator('#tmConfirmLanguagesBtn').click();

        // Usaba oninput="tmSearch()": si no estuviera enganchado, esto lanzaría
        // un error de JavaScript en vez de mostrar el mensaje de "sin resultados".
        const errores = [];
        page.on('pageerror', (e) => errores.push(e.message));
        await page.locator('#tmSearchInput').fill('cualquier cosa');
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
