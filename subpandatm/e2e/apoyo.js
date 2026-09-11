/**
 * Lo común a todos los tests de navegador de subpandaTM.
 *
 * Los tests se ejecutan contra el archivo compilado. Las librerías van dentro
 * del paquete, así que aquí solo hay que cortar lo que de verdad sale a
 * internet: Tailwind y las fuentes.
 */
import { test as base, expect } from '@playwright/test';

/**
 * Sustituto de Tailwind para los tests.
 *
 * Tailwind no es una hoja de estilos sino un script que genera los estilos al
 * vuelo desde un CDN. Aquí se intercepta esa petición y se devuelven las reglas
 * de las que depende la estructura de la página: qué se ve y qué no, y cómo se
 * colocan los bloques. Los colores y los márgenes no afectan a lo que estos
 * tests comprueban.
 */
const TAILWIND_MINIMO = `
    (function () {
        const css = \`
            .hidden { display: none !important; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .justify-center { justify-content: center; }
            .justify-end { justify-content: flex-end; }
            .w-full { width: 100%; }
            .h-auto { height: auto; }
            .relative { position: relative; }
            .absolute { position: absolute; }
            .fixed { position: fixed; }
            .block { display: block; }
            .inline-block { display: inline-block; }
            .grid { display: grid; }
        \`;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        window.tailwind = { config: {} };
    })();
`;

export const test = base.extend({
    page: async ({ page }, use) => {
        await page.route(/^https:\/\/cdn\.tailwindcss\.com/, (ruta) =>
            ruta.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: TAILWIND_MINIMO,
            }),
        );
        // Las fuentes no influyen en nada de lo que se comprueba, pero cortarlas
        // a secas deja un error en la consola y entonces "carga sin errores" ya
        // no se podría comprobar de verdad. Se responden en blanco.
        await page.route(/^https:\/\/fonts\./, (ruta) =>
            ruta.fulfill({ status: 200, contentType: 'text/css', body: '' }),
        );

        await page.goto('./');
        await use(page);
    },
});

/** Un SRT de ejemplo, con lo justo para que haya algo que traducir. */
export const SRT_EJEMPLO = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,500
This is a subtitle
with two lines

3
00:00:07,000 --> 00:00:09,000
Goodbye
`;

/**
 * Abre una entrada del menú Archivo.
 *
 * Los menús se despliegan al pasar el ratón, con CSS y sin JavaScript, así que
 * hay que ponerse encima del botón antes de poder pulsar lo de dentro.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 */
export async function desdeElMenuArchivo(page, id) {
    await page.locator('#fileBtn').hover();
    await page.locator(`#${id}`).click();
}

/**
 * Elige el par de idiomas del proyecto, que es lo primero que se pregunta.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} origen Código ISO, por ejemplo 'en'.
 * @param {string} destino
 */
export async function elegirIdiomas(page, origen = 'en', destino = 'es') {
    await expect(page.locator('#idiomasModal')).toBeVisible();
    await page.locator('#idiomaOrigen').selectOption(origen);
    await page.locator('#idiomaDestino').selectOption(destino);
    await page.locator('#idiomasAceptarBtn').click();
    await expect(page.locator('#idiomasModal')).toBeHidden();
}

/**
 * Carga un SRT y contesta al cuadro de idiomas, como haría cualquiera.
 *
 * Abrir un archivo pregunta siempre de qué idioma a qué idioma va el encargo:
 * es de lo que dependen la memoria y el glosario.
 */
export async function cargarSrt(page, contenido = SRT_EJEMPLO, nombre = 'ejemplo.srt') {
    await page.locator('#srtFile').setInputFiles({
        name: nombre,
        mimeType: 'text/plain',
        buffer: Buffer.from(contenido),
    });
    await elegirIdiomas(page);
    await expect(page.locator('#translationsContainer')).not.toBeEmpty();
}

/** Escribe una traducción en el subtítulo indicado, como quien la teclea. */
export async function traducir(page, indice, texto) {
    const editor = page.locator(`#translation-${indice}`);
    await editor.click();
    await page.keyboard.insertText(texto);
    await editor.blur();
}

export { expect };
