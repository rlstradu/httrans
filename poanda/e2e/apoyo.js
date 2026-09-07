import { test as base, expect } from '@playwright/test';

/**
 * Sustituto de Tailwind para los tests.
 *
 * Poanda carga Tailwind desde un CDN, y no es una hoja de estilos sino un script
 * que genera los estilos al vuelo. En los tests interceptamos esa petición y
 * devolvemos este script mínimo, que inyecta las reglas de las que depende la
 * estructura de la página: qué se ve y qué no, y cómo se colocan los bloques. Así los tests no dependen de que haya internet, tardan menos y no
 * fallan porque el CDN esté caído. Los colores y márgenes no afectan a lo que
 * estos tests comprueban.
 */
const TAILWIND_MINIMO = `
    (function () {
        const css = \`
            .hidden { display: none !important; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .justify-start { justify-content: flex-start; }
            .justify-center { justify-content: center; }
            .w-full { width: 100%; }
            .min-h-screen { min-height: 100vh; }
            .relative { position: relative; }
            /* La barra de estadísticas va fija abajo del todo: sin esto se
               quedaba en el flujo y falseaba las medidas de alto de la página. */
            .fixed { position: fixed; }
            .bottom-0 { bottom: 0; }
            .left-0 { left: 0; }
            .right-0 { right: 0; }
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

/**
 * Cambia el idioma de la interfaz.
 *
 * El selector es un desplegable que se abre al pasar el ratón por encima (con
 * CSS, sin JavaScript), así que hay que pulsar antes el botón: las opciones
 * están ocultas hasta entonces y Playwright no puede pulsar lo que no se ve.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'en'|'es'} idioma
 */
export async function cambiarIdioma(page, idioma) {
    await page.locator('#langBtn').click();
    await page.locator(idioma === 'es' ? '#langEsBtn' : '#langEnBtn').click();
}

/**
 * Abre la ventana de copias de seguridad, que vive en el menú Archivo.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function abrirCopiasDeSeguridad(page) {
    await page.locator('#fileBtn').click();
    await page.locator('#backupBtn').click();
}

/**
 * Espera a que aparezca el punto verde de "hay copia guardada".
 *
 * El punto vive dentro del menú Archivo, así que está escondido mientras el
 * menú esté cerrado: preguntar si "se ve" diría siempre que no. Lo que se mira
 * es si está encendido, que es lo que decide backup.js.
 *
 * @param {import('@playwright/test').Page} page
 * @param {boolean} encendido Qué se espera: encendido (true) o apagado (false).
 */
export async function esperarAvisoDeCopia(page, encendido = true) {
    const display = () =>
        page.locator('#backupIndicator').evaluate((el) => getComputedStyle(el).display);

    if (encendido) {
        await expect.poll(display, { timeout: 20_000 }).not.toBe('none');
    } else {
        await expect.poll(display, { timeout: 20_000 }).toBe('none');
    }
}

/**
 * Contesta el cuadro de idiomas que sale al abrir un archivo.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{origen?: string, destino?: string}} [par]
 */
export async function responderIdiomas(page, { origen = 'en', destino = 'es' } = {}) {
    const modal = page.locator('#idiomasModal');
    await expect(modal).toBeVisible();
    await page.locator('#idiomaOrigen').selectOption(origen);
    await page.locator('#idiomaDestino').selectOption(destino);
    await page.locator('#idiomasAceptarBtn').click();
    await expect(modal).toBeHidden();
}

/**
 * Carga un archivo por el mismo camino que una persona.
 *
 * Se suelta sobre el panel, que es por donde entran todos los formatos. El
 * campo oculto del menú solo escucha mientras el diálogo del sistema está
 * abierto, así que ponerle un archivo a mano no dispara nada.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{nombre: string, contenido: string, tipo?: string, idiomas?: Object}} archivo
 */
export async function cargarArchivo(page, { nombre, contenido, tipo = 'text/plain', idiomas }) {
    await page.evaluate(
        ({ nombre, contenido, tipo }) => {
            const datos = new DataTransfer();
            datos.items.add(new File([contenido], nombre, { type: tipo }));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        },
        { nombre, contenido, tipo }
    );
    await responderIdiomas(page, idiomas);
}

/** Carga el PO de ejemplo en la herramienta. */
export async function cargarPo(page, contenido = PO_EJEMPLO, idiomas) {
    await cargarArchivo(page, {
        nombre: 'ejemplo.po',
        contenido,
        tipo: 'text/x-gettext-translation',
        idiomas,
    });
    await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
}

export { expect };
