import { test as base, expect } from '@playwright/test';

/**
 * Sustituto de Tailwind para los tests.
 *
 * Poanda carga Tailwind desde un CDN, y no es una hoja de estilos sino un script
 * que genera los estilos al vuelo. En los tests interceptamos esa petición y
 * devolvemos este script mínimo, que inyecta solo las reglas que deciden si algo
 * se ve o no. Así los tests no dependen de que haya internet, tardan menos y no
 * fallan porque el CDN esté caído. Los colores y márgenes no afectan a lo que
 * estos tests comprueban.
 */
const TAILWIND_MINIMO = `
    (function () {
        const css = \`
            .hidden { display: none !important; }
            .flex { display: flex; }
            .grid { display: grid; }
            .block { display: block; }
            .inline-block { display: inline-block; }
        \`;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    })();
`;

/** Archivo PO de ejemplo que usan los tests. */
export const PO_EJEMPLO = `msgid ""
msgstr ""
"Project-Id-Version: ejemplo 1.0\\n"
"Language: es\\n"

#: index.php:12
msgid "Settings"
msgstr "Ajustes"

#: index.php:20
msgid "Save changes"
msgstr ""

#: index.php:28
msgid "Delete"
msgstr ""
`;

/**
 * Test con la página ya abierta y las peticiones externas cortadas.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        await page.route(/^https:\/\/cdn\.tailwindcss\.com/, (ruta) =>
            ruta.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: TAILWIND_MINIMO,
            })
        );
        // El resto de recursos externos (fuentes y librerías del CDN) no influyen
        // en lo que comprueban estos tests.
        await page.route(/^https:\/\/(fonts\.|cdn\.jsdelivr|cdnjs\.)/, (ruta) => ruta.abort());

        await page.goto('./');
        await use(page);
    },
});

/** Carga el PO de ejemplo en la herramienta. */
export async function cargarPo(page, contenido = PO_EJEMPLO) {
    await page.setInputFiles('#poFile', {
        name: 'ejemplo.po',
        mimeType: 'text/x-gettext-translation',
        buffer: Buffer.from(contenido, 'utf8'),
    });
    await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
}

export { expect };
