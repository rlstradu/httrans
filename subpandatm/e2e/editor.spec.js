/**
 * El campo de traducción.
 *
 * En un subtítulo, el salto de línea es parte del texto: se decide dónde va
 * casi tan a menudo como se escriben las palabras, porque de eso depende que se
 * pueda leer en el tiempo que está en pantalla. Hasta ahora Enter saltaba al
 * subtítulo siguiente y el salto de línea pedía Shift+Enter, que es al revés de
 * lo que uno espera al escribir.
 */
import { test, expect, cargarSrt } from './apoyo.js';

test.describe('los recuentos del subtítulo', () => {
    const DOS_LINEAS = `1
00:00:01,000 --> 00:00:04,000
Save the file to your desktop right now
and then close every open window
`;

    test('cada línea lleva su cifra, y el total va debajo como una suma', async ({ page }) => {
        // Iban todas seguidas en el pie —"L1: 29, L2: 14"—, así que para saber
        // si la primera línea se pasaba había que ir contando por cuál ibas.
        await cargarSrt(page, DOS_LINEAS, 'dos.srt');

        const cifras = page.locator('#origLineCounts-0 .segmento-linea-cuenta');
        await expect(cifras).toHaveCount(2);
        await expect(cifras.nth(0)).toHaveText('39');
        await expect(cifras.nth(1)).toHaveText('32');
        // Y la suma, en el pie: 39 + 32.
        await expect(page.locator('#origTotal-0')).toHaveText('71');
    });

    test('cada cifra cae a la altura de su línea aunque la línea se doble', async ({ page }) => {
        // En una columna estrecha una línea de subtítulo se da la vuelta casi
        // siempre, y con la cifra puesta a interlínea fija se descolocaba: la
        // segunda salía a la altura de la vuelta de la primera.
        await cargarSrt(page, DOS_LINEAS, 'dos.srt');

        const alturas = await page.evaluate(() => {
            const pre = document.getElementById('original-pre-0');
            const capa = document.getElementById('origLineCounts-0');
            // Dónde empieza cada línea lógica del texto de verdad.
            const nodo = pre.firstChild;
            const corte = pre.textContent.indexOf('\n') + 1;
            const rango = document.createRange();
            const arriba = (desde) => {
                rango.setStart(nodo, desde);
                rango.setEnd(nodo, desde + 1);
                return Math.round(rango.getBoundingClientRect().top);
            };
            const cifras = [...capa.querySelectorAll('.segmento-linea-cuenta')];
            return {
                texto: [arriba(0), arriba(corte)],
                cifras: cifras.map((c) => Math.round(c.getBoundingClientRect().top)),
            };
        });

        expect(Math.abs(alturas.cifras[0] - alturas.texto[0])).toBeLessThan(4);
        expect(Math.abs(alturas.cifras[1] - alturas.texto[1])).toBeLessThan(4);
    });

    test('el subtítulo de una sola línea no lleva suma', async ({ page }) => {
        // Una suma de un solo sumando no dice nada y repite la cifra de arriba.
        await cargarSrt(page);

        await expect(page.locator('#origLineCounts-0 .segmento-linea-cuenta')).toHaveCount(1);
        await expect(page.locator('#origTotal-0')).toBeHidden();
    });
});

test.describe('los botones de la fila', () => {
    test('borrar, cursiva y partir están arriba y se ven', async ({ page }) => {
        // Colgaban del pie de la columna de la traducción, compitiendo con los
        // recuentos. Son acciones sobre el subtítulo, como partir y unir, así
        // que van con ellas.
        await cargarSrt(page);

        const grupo = page.locator('#translation-unit-0 .segmento-tiempos-der');
        await expect(grupo.locator('[data-partir]')).toBeVisible();
        await expect(grupo.locator('[data-formato="italic"]')).toBeVisible();
        await expect(grupo.locator('[data-borrar]')).toBeVisible();

        // Validar este y todos los anteriores ya no tiene botón: se hace de
        // tarde en tarde y ocupaba sitio en una fila que se usa a cada
        // subtítulo. Ahora vive solo en los atajos de teclado.
        await expect(grupo.locator('[data-validar-hasta]')).toHaveCount(0);

        // El grupo no se desplaza con la franja: por muy estrecha que sea la
        // columna, estos cuatro se ven siempre.
        const caja = await grupo.boundingBox();
        const franja = await page.locator('#translation-unit-0 .segmento-tiempos').boundingBox();
        expect(caja.x + caja.width).toBeLessThanOrEqual(franja.x + franja.width + 2);
    });

    test('la duración va en un campo, como la entrada y la salida', async ({ page }) => {
        await cargarSrt(page);
        await expect(page.locator('#duration-0')).toHaveValue('2.000s');
    });
});

test.describe('el subtítulo en el que se está', () => {
    /** El grosor del borde por cada lado, y la barra de dentro. */
    const marcaDe = (page) =>
        page.locator('#translation-unit-0').evaluate((el) => {
            const c = getComputedStyle(el);
            return {
                lados: [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth],
                color: c.borderTopColor,
                dentro: c.boxShadow,
            };
        });

    test('el borde azul es igual por los cuatro lados y más grueso a la izquierda', async ({
        page,
    }) => {
        // Quedaba una regla del diseño anterior que ponía dos píxeles de borde
        // donde la fila tiene uno, más un cerco de tres: las dos se sumaban y
        // el azul salía de distinto grosor según el lado.
        await cargarSrt(page);
        await page.locator('#translation-0').click();

        const marca = await marcaDe(page);
        expect(new Set(marca.lados).size).toBe(1);
        expect(marca.color).toBe('rgb(7, 91, 162)');
        // Y la barra de la izquierda va por dentro, para que el contenido no se
        // mueva al entrar y salir del subtítulo.
        expect(marca.dentro).toContain('inset');
    });

    test('en oscuro el borde sigue siendo azul', async ({ page }) => {
        // Había una regla de modo oscuro que le ponía el borde gris con
        // !important: el subtítulo en el que estabas se marcaba en gris sobre
        // gris, o sea que no se marcaba.
        await cargarSrt(page);
        await page.locator('#themeToggleBtn').click();
        await page.locator('#translation-0').click();

        const marca = await marcaDe(page);
        expect(marca.color).toBe('rgb(37, 99, 235)'); // El azul del modo oscuro
    });
});

test.describe('el visto de validar', () => {
    test('se ve, y se enciende al pulsarlo', async ({ page }) => {
        // El visto heredó una regla de estilo del diseño anterior que lo dejaba
        // en display:none: el botón estaba ahí, ocupaba su sitio y no se veía
        // nada. Un botón invisible no es un botón.
        await cargarSrt(page);

        const visto = page.locator('#validateBtn-0');
        await expect(visto).toBeVisible();
        await expect(page.locator('#checkIcon-0')).toBeVisible();

        await visto.click();
        await expect(visto).toHaveClass(/validado/);
    });

    test('Ctrl+Shift+Enter valida este y todos los anteriores', async ({ page }) => {
        // Esto tenía botón propio en cada tarjeta. Se hace de tarde en tarde
        // —al volver de una pausa, al dar por buena una tanda— y ocupaba sitio
        // en la fila que se usa a cada subtítulo, así que ahora es solo atajo.
        await cargarSrt(page);

        await page.locator('#translation-2').click();
        await page.keyboard.press('Control+Shift+Enter');

        await expect(page.locator('#validateBtn-0')).toHaveClass(/validado/);
        await expect(page.locator('#validateBtn-1')).toHaveClass(/validado/);
        await expect(page.locator('#validateBtn-2')).toHaveClass(/validado/);
    });

    test('el atajo de validar los anteriores sale en la lista de atajos', async ({ page }) => {
        // Si la única forma de hacerlo es una tecla, esa tecla tiene que estar
        // escrita en algún sitio donde se pueda leer y cambiar.
        await page.locator('#toolsBtn').hover();
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsModal')).toBeVisible();
        await expect(page.locator('#shortcut-display-validateAllPrevious')).toHaveText(
            /Ctrl.*Shift.*Enter/i,
        );
    });
});

test.describe('el campo de traducción', () => {
    test.beforeEach(async ({ page }) => {
        await cargarSrt(page);
    });

    test('Enter parte la línea, sin salir del subtítulo', async ({ page }) => {
        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.insertText('Primera línea');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText('Segunda línea');

        // Sigue escribiéndose en el mismo subtítulo.
        await expect(editor).toBeFocused();
        await expect(editor).toContainText('Primera línea');
        await expect(editor).toContainText('Segunda línea');

        // Y el salto es un salto de verdad, no dos palabras pegadas.
        const conSalto = await editor.evaluate((el) => /<br|<div|\n/i.test(el.innerHTML));
        expect(conSalto).toBe(true);
    });

    test('el salto se exporta como salto de línea del SRT', async ({ page }) => {
        // Es lo que de verdad importa: que el reproductor lo parta donde se
        // decidió partirlo.
        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.insertText('Primera línea');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText('Segunda línea');
        await editor.blur();

        const srt = await page.evaluate(() => {
            const div = document.getElementById('translation-0');
            let texto = div.innerHTML;
            texto = texto.replace(/<\/div>\s*<div>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
            return texto.replace(/<(?!(\/?b|\/?i))[^>]+>/gi, '').trim();
        });
        expect(srt).toBe('Primera línea\nSegunda línea');
    });

    test('ya no hace falta el aviso de Shift + Enter', async ({ page }) => {
        // Estaba en cada subtítulo, ocupando sitio para explicar una rareza que
        // ya no existe.
        await expect(page.locator('.line-break-tooltip')).toHaveCount(0);
    });
});
