import { test, expect, cargarPo } from './apoyo.js';

test.describe('arranque', () => {
    test('la página carga sin errores de JavaScript', async ({ page }) => {
        const errores = [];
        page.on('pageerror', (e) => errores.push(e.message));
        await page.reload();
        await expect(page.locator('#versionToggle')).toBeVisible();
        expect(errores).toEqual([]);
    });

    test('muestra el mensaje inicial y el botón de versión', async ({ page }) => {
        await expect(page.locator('#initialMessage')).toBeVisible();
        await expect(page.locator('#versionToggle')).toHaveText(/^v\d+\.\d+\.\d+$/);
    });

    test('los módulos ES se cargan (main.js ha enganchado los botones)', async ({ page }) => {
        // Si los módulos no cargaran, este botón no abriría nada.
        await page.locator('#toolsBtn').click(); // los atajos están en el menú "Herramientas"
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsModal')).toBeVisible();
    });
});

test.describe('edición de archivos PO', () => {
    test('carga un PO y muestra sus segmentos', async ({ page }) => {
        await cargarPo(page);
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
        await expect(page.locator('body')).toContainText('Settings');
        await expect(page.locator('body')).toContainText('Save changes');
    });

    test('la cabecera del archivo no se muestra como segmento editable', async ({ page }) => {
        await cargarPo(page);
        // 3 segmentos reales, la cabecera queda fuera del editor
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
    });

    test('escribir una traducción actualiza el contador de caracteres', async ({ page }) => {
        await cargarPo(page);

        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        const contador = page.locator('[id^="charCount-"]').nth(1);
        await expect(contador).toContainText('Translation: 0');

        await campo.fill('Guardar cambios');
        await expect(contador).toContainText('Translation: 15');
    });

    test('el panel de estadísticas muestra el recuento del archivo', async ({ page }) => {
        // Se abre antes de cargar nada: con el editor lleno, el menú desplegable
        // queda por debajo del contenido y no se puede pulsar.
        await page.locator('#toolsBtn').click();
        await page.locator('#statsBtn').click();
        await expect(page.locator('#statsContainer')).toBeVisible();

        await cargarPo(page);
        // 3 segmentos: "Settings" (1 palabra), "Save changes" (2), "Delete" (1)
        await expect(page.locator('#wordsTotal')).toHaveText('4');
        await expect(page.locator('#segmentsProgress')).toContainText('3');
    });

    test('el buscador filtra los segmentos', async ({ page }) => {
        await cargarPo(page);
        await page.locator('#poSearchInput').fill('Delete');
        await expect(page.locator('#searchResultCounter')).toContainText('1');
    });
});

test.describe('idioma e interfaz', () => {
    test('cambia entre español e inglés', async ({ page }) => {
        await page.locator('#langEsBtn').click();
        await expect(page.locator('#loadBtnText')).toContainText(/Cargar|archivo/i);

        await page.locator('#langEnBtn').click();
        await expect(page.locator('#loadBtnText')).toContainText(/Load|file/i);
    });

    test('el modo oscuro se activa y se recuerda al recargar', async ({ page }) => {
        await page.locator('#darkModeToggle').click();
        await expect(page.locator('body')).toHaveClass(/dark-mode/);

        await page.reload();
        await expect(page.locator('body')).toHaveClass(/dark-mode/);

        await page.locator('#darkModeToggle').click();
        await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
    });

    test('el botón de versión abre el changelog y lo carga', async ({ page }) => {
        await page.locator('#versionToggle').click();
        await expect(page.locator('#changelogModal')).toBeVisible();
        await expect(page.locator('#changelogContent')).toContainText('Poanda v');
        await page.locator('#changelogCloseBtn').click();
        await expect(page.locator('#changelogModal')).toBeHidden();
    });
});
