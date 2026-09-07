/**
 * La vista compacta del editor.
 *
 * Cada segmento es una fila de una sola pieza: número, original, traducción y
 * el visto de validar, con los recuentos metidos en la esquina de su columna.
 * Antes cada segmento era un bloque con dos títulos, dos cuadros enmarcados,
 * una línea de recuento y tres botones; en una pantalla de portátil cabían tres
 * segmentos. Estos tests fijan lo que hace que quepan más: que todo esté en una
 * fila, que sea pequeño y que no haya dos segmentos de distinta altura.
 */
import { test, expect, cargarPo } from './apoyo.js';

/** PO con contexto y referencias, para comprobar la cabecera del segmento. */
const PO_CON_CONTEXTO = `msgid ""
msgstr ""
"Language: es\\n"

#: templates/home.html:42
msgctxt "img_attr_alt_1"
msgid "Radiokit Logo"
msgstr ""

msgid "Sin contexto ninguno"
msgstr ""
`;

test.describe('fila de segmento', () => {
    test('el original y la traducción van uno al lado del otro en la misma fila', async ({
        page,
    }) => {
        await cargarPo(page);

        const fila = page.locator('.segmento-fila').first();
        const original = await fila.locator('.segmento-origen').boundingBox();
        const destino = await fila.locator('.segmento-destino').boundingBox();

        // A la derecha, no debajo.
        expect(destino.x).toBeGreaterThan(original.x + original.width - 2);
        expect(Math.abs(destino.y - original.y)).toBeLessThan(4);
    });

    test('cada fila lleva su número a la izquierda, correlativo', async ({ page }) => {
        await cargarPo(page);

        const numeros = page.locator('.segmento-numero');
        await expect(numeros).toHaveCount(3);
        await expect(numeros.nth(0)).toHaveText('1');
        await expect(numeros.nth(2)).toHaveText('3');

        const fila = await page.locator('.segmento-fila').first().boundingBox();
        const numero = await numeros.first().boundingBox();
        expect(numero.x - fila.x).toBeLessThan(4);
    });

    test('el recuento de cada texto va dentro de su columna, no debajo del bloque', async ({
        page,
    }) => {
        await cargarPo(page);

        const fila = page.locator('.segmento-fila').first();
        const columnaOrigen = await fila.locator('.segmento-origen').boundingBox();
        const cuentaOrigen = await fila.locator('[id^="charCountOriginal-"]').boundingBox();
        const columnaDestino = await fila.locator('.segmento-destino').boundingBox();
        const cuentaDestino = await fila.locator('[id^="charCount-"]').boundingBox();

        const dentro = (caja, columna) =>
            caja.x >= columna.x - 1 && caja.x + caja.width <= columna.x + columna.width + 1;

        expect(dentro(cuentaOrigen, columnaOrigen), 'el recuento del original se sale').toBe(true);
        expect(dentro(cuentaDestino, columnaDestino), 'el recuento de la traducción se sale').toBe(
            true
        );
    });

    test('el recuento del original es el número de caracteres del original', async ({ page }) => {
        await cargarPo(page);
        // "Settings" son 8 caracteres.
        await expect(page.locator('[id^="charCountOriginal-"]').first()).toHaveText('8');
    });

    test('el visto de validar está a la derecha del todo', async ({ page }) => {
        await cargarPo(page);

        const fila = await page.locator('.segmento-fila').first().boundingBox();
        const destino = await page
            .locator('.segmento-fila')
            .first()
            .locator('.segmento-destino')
            .boundingBox();
        const check = await page.locator('[id^="validateBtn-"]').first().boundingBox();

        expect(check.x).toBeGreaterThan(destino.x + destino.width - 2);
        expect(fila.x + fila.width - (check.x + check.width)).toBeLessThan(20);
    });

    test('ya no hay botones de texto "Validate" y "Edit" en cada segmento', async ({ page }) => {
        await cargarPo(page);
        await expect(page.locator('[id^="editBtn-"]')).toHaveCount(0);
        await expect(page.locator('[id^="validateBtn-"]').first()).toHaveText('');
    });
});

test.describe('validar con el visto', () => {
    test('pulsar el visto lo enciende y bloquea la traducción', async ({ page }) => {
        await cargarPo(page);

        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        await campo.fill('Guardar cambios');

        const check = page.locator('[id^="validateBtn-"]').nth(1);
        await check.click();

        await expect(check).toHaveClass(/validado/);
        await expect(campo).toHaveAttribute('readonly', '');
    });

    test('volver a pulsarlo lo apaga y devuelve la edición', async ({ page }) => {
        await cargarPo(page);

        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        await campo.fill('Guardar cambios');

        const check = page.locator('[id^="validateBtn-"]').nth(1);
        await check.click();
        await expect(check).toHaveClass(/validado/);

        await check.click();
        await expect(check).not.toHaveClass(/validado/);
        await expect(campo).not.toHaveAttribute('readonly', '');
    });
});

test.describe('contexto del segmento', () => {
    test('el contexto y la referencia salen arriba, en una etiqueta', async ({ page }) => {
        await cargarPo(page, PO_CON_CONTEXTO);

        const etiqueta = page.locator('.segmento-contexto-etiqueta').first();
        await expect(etiqueta).toContainText('img_attr_alt_1');
        await expect(etiqueta).toContainText('templates/home.html:42');

        // Sin la marca "#:" del formato: es sintaxis del archivo, no información.
        await expect(etiqueta).not.toContainText('#:');
    });

    test('la etiqueta va encima de su fila y no dentro', async ({ page }) => {
        await cargarPo(page, PO_CON_CONTEXTO);

        const etiqueta = await page.locator('.segmento-contexto-etiqueta').first().boundingBox();
        const fila = await page.locator('.segmento-fila').first().boundingBox();
        expect(etiqueta.y).toBeLessThan(fila.y);
    });

    test('sin contexto no se deja una línea vacía', async ({ page }) => {
        await cargarPo(page, PO_CON_CONTEXTO);

        // Dos segmentos, pero solo el primero trae contexto.
        await expect(page.locator('.segmento-fila')).toHaveCount(2);
        await expect(page.locator('.segmento-contexto')).toHaveCount(1);
    });
});

test.describe('aprovechar la pantalla', () => {
    test('las filas son bajas y todas iguales', async ({ page }) => {
        await cargarPo(page);

        const alturas = await page
            .locator('.segmento-fila')
            .evaluateAll((filas) => filas.map((f) => f.getBoundingClientRect().height));

        // Uniformes: los tres segmentos de ejemplo son de una línea.
        expect(Math.max(...alturas) - Math.min(...alturas)).toBeLessThan(4);
        // Y bajas: antes cada bloque pasaba de 200 px.
        expect(Math.max(...alturas)).toBeLessThan(80);
    });

    test('el texto del editor es más pequeño que el del resto de la página', async ({ page }) => {
        await cargarPo(page);

        const tamano = await page
            .locator('textarea[id^="msgstr-"]')
            .first()
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

        expect(tamano).toBeLessThanOrEqual(14);
    });

    test('el campo de buscar ocupa casi toda la barra', async ({ page }) => {
        // Lo que se redujo del buscador fue la letra y el alto, no el sitio
        // para escribir. Lo único que le quita ancho es el par de idiomas del
        // proyecto, que ocupa lo que ocupan dos códigos.
        await cargarPo(page);

        const barra = await page.locator('#poSearchContainer').boundingBox();
        const campo = await page.locator('#poSearchInput').boundingBox();

        // Casi toda la barra: el par de idiomas reserva lo suyo y nada más.
        expect(campo.width).toBeGreaterThan(barra.width * 0.6);
        expect(campo.width).toBeLessThan(barra.width);

        const tamano = await page
            .locator('#poSearchInput')
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(tamano).toBeLessThanOrEqual(14);
    });

    test('la barra de búsqueda sí cruza el panel de lado a lado', async ({ page }) => {
        // Lo estrecho es el campo de escribir, no la barra: una barra a medias
        // parece un recuadro suelto en vez de la herramienta que es.
        await cargarPo(page);

        // Se compara con las filas del editor, que es lo que tiene debajo: las
        // dos cosas cuelgan de la misma columna y deben empezar y acabar igual.
        const fila = await page.locator('.segmento-fila').first().boundingBox();
        const barra = await page.locator('#poSearchContainer').boundingBox();

        expect(Math.abs(barra.x - fila.x)).toBeLessThan(12);
        expect(Math.abs(barra.width - fila.width)).toBeLessThan(24);
    });

    test('la lista de segmentos llega hasta abajo, sin franja vacía', async ({ page }) => {
        // Tenía un tope fijo de 70vh menos 50 px, así que por debajo quedaba
        // siempre una banda blanca de unos 140 px hubiera tres segmentos o tres
        // mil, y el editor usaba dos tercios de la pantalla justo después de
        // haber reducido las filas para que cupieran más.
        let po = 'msgid ""\nmsgstr ""\n"Language: es\\n"\n\n';
        for (let i = 1; i <= 40; i++) po += `msgid "String ${i}"\nmsgstr "Cadena ${i}"\n\n`;

        await page.setViewportSize({ width: 1100, height: 700 });
        await cargarPo(page, po);

        const medidas = await page.evaluate(() => {
            const lista = document.querySelector('.translations-container-scrolling');
            const caja = lista.getBoundingClientRect();
            return {
                huecoDebajo: window.innerHeight - caja.bottom,
                desplazaDentro: lista.scrollHeight > lista.clientHeight,
                laPaginaNoSeMueve: document.documentElement.scrollHeight <= window.innerHeight,
            };
        });

        expect(medidas.huecoDebajo).toBeLessThan(8);
        // Y lo que se desplaza es la lista, no la página: así la barra de
        // botones y el buscador se quedan quietos mientras se traduce.
        expect(medidas.desplazaDentro).toBe(true);
        expect(medidas.laPaginaNoSeMueve).toBe(true);
    });

    test('con pocos segmentos tampoco sobra pantalla por debajo', async ({ page }) => {
        await page.setViewportSize({ width: 1100, height: 700 });
        await cargarPo(page);

        const huecoDebajo = await page.evaluate(() => {
            const lista = document.querySelector('.translations-container-scrolling');
            return window.innerHeight - lista.getBoundingClientRect().bottom;
        });

        expect(huecoDebajo).toBeLessThan(8);
    });

    test('el original y la traducción se ven con la misma letra', async ({ page }) => {
        // Es lo que hace que la vista parezca una tabla: si cada columna usa un
        // tamaño distinto, las dos mitades de la fila no casan.
        await cargarPo(page);

        const medidas = await page.locator('.segmento-fila').first().evaluate((fila) => {
            const leer = (sel) => {
                const estilo = getComputedStyle(fila.querySelector(sel));
                return `${estilo.fontSize}/${estilo.lineHeight}`;
            };
            return [leer('.segmento-origen .segmento-texto'), leer('textarea.segmento-texto')];
        });

        expect(medidas[0]).toBe(medidas[1]);
    });
});
