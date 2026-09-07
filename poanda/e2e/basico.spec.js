import { test, expect, cambiarIdioma, cargarPo } from './apoyo.js';

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

    test('el logo y el favicon se cargan de verdad', async ({ page }) => {
        // Al compilar con Vite, el HTML pide las imágenes como /images/... desde
        // la raíz del sitio. Si esa ruta se rompiera, la página seguiría
        // funcionando pero saldría sin logo, así que conviene comprobarlo.
        const logo = page.locator('img[alt="Poanda Logo"]');
        await expect(logo).toBeVisible();
        await expect
            .poll(() => logo.evaluate((img) => img.naturalWidth))
            .toBeGreaterThan(0);

        const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
        const respuesta = await page.request.get(new URL(favicon, page.url()).href);
        expect(respuesta.status()).toBe(200);
    });

    test('la página compilada no pide nada que no exista', async ({ page }) => {
        const fallos = [];
        page.on('response', (r) => {
            if (r.status() >= 400 && !r.url().startsWith('https://')) fallos.push(`${r.status()} ${r.url()}`);
        });
        await page.reload();
        await page.locator('#versionToggle').click();
        await expect(page.locator('#changelogContent')).toContainText('Poanda v');
        expect(fallos).toEqual([]);
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

        // El recuento vive dentro de la columna de la traducción y enseña solo
        // el número: la explicación está en el título emergente.
        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        const contador = page.locator('[id^="charCount-"]').nth(1);
        await expect(contador).toHaveText('0');

        await campo.fill('Guardar cambios');
        await expect(contador).toHaveText('15');
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
        await cambiarIdioma(page, 'es');
        await expect(page.locator('.zona-soltar-titulo')).toContainText(/Suelta|traducir/i);

        await cambiarIdioma(page, 'en');
        await expect(page.locator('.zona-soltar-titulo')).toContainText(/Drop|translating/i);
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

    test('el changelog se ve ordenado, no como un muro de texto', async ({ page }) => {
        await page.locator('#versionToggle').click();
        const ventana = page.locator('#changelogContent');

        // Título de versión, fecha aparte, secciones y novedades en lista.
        await expect(ventana.locator('h3.cl-version').first()).toContainText('Poanda v');
        await expect(ventana.locator('p.cl-fecha').first()).toContainText(/\d{4}/);
        await expect(ventana.locator('h4.cl-seccion').first()).toBeVisible();
        expect(await ventana.locator('li').count()).toBeGreaterThan(5);

        // Y las rayas de iguales del archivo no llegan a verse.
        await expect(ventana).not.toContainText('=====');
    });
});
