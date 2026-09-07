/**
 * Etiquetas y códigos en el editor.
 *
 * El módulo core/etiquetas.js ya tiene sus tests de reconocimiento. Estos
 * comprueban lo que ve y hace quien traduce: que las etiquetas se distingan del
 * texto, que se puedan poner sin teclearlas y que avise cuando no cuadran.
 */
import { test, expect, cargarPo } from './apoyo.js';

/** PO con marcadores y HTML dentro, que es lo normal en un proyecto de verdad. */
const PO_CON_ETIQUETAS = `msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello %s, you have %d new messages"
msgstr ""

msgid "Read the <a href=\\"/help\\">help page</a> first"
msgstr ""

msgid "Plain sentence with nothing special"
msgstr ""
`;

/** Primer cuadro de traducción de la lista. */
const campo = (page, n = 0) => page.locator('textarea[id^="msgstr-"]').nth(n);

test.describe('ver las etiquetas', () => {
    test('los marcadores del original salen marcados aparte', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const marcas = page.locator('#msgid-pre-1-0 .etiqueta');
        await expect(marcas).toHaveCount(2);
        await expect(marcas.nth(0)).toHaveText('%s');
        await expect(marcas.nth(1)).toHaveText('%d');
    });

    test('el HTML del original se ve tal cual, no aplicado', async ({ page }) => {
        // Antes el texto se metía como HTML sin escapar: un <a href> del original
        // se convertía en un enlace de verdad, justo lo contrario de lo que
        // necesita quien tiene que copiar esa etiqueta.
        await cargarPo(page, PO_CON_ETIQUETAS);

        const original = page.locator('#msgid-pre-2-0');
        await expect(original).toContainText('<a href="/help">');
        await expect(original.locator('a')).toHaveCount(0);
        await expect(original.locator('.etiqueta')).toHaveCount(2);
    });

    test('un segmento sin etiquetas no marca nada', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);
        await expect(page.locator('#msgid-pre-3-0 .etiqueta')).toHaveCount(0);
    });
});

test.describe('poner las etiquetas', () => {
    test('pulsar una etiqueta la mete en la traducción', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        await campo(page, 0).click();
        await page.locator('#msgid-pre-1-0 .etiqueta').first().click();

        await expect(campo(page, 0)).toHaveValue('%s');
    });

    test('se mete donde está el cursor, no al final', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola , qué tal');
        // Cursor justo antes de la coma.
        await traduccion.evaluate((el) => el.setSelectionRange(5, 5));

        await page.locator('#msgid-pre-1-0 .etiqueta').first().click();
        await expect(traduccion).toHaveValue('Hola %s, qué tal');
    });

    test('el atajo pone la siguiente que falte, en orden', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.click();

        await page.keyboard.press('Control+Shift+T');
        await expect(traduccion).toHaveValue('%s');

        await page.keyboard.press('Control+Shift+T');
        await expect(traduccion).toHaveValue('%s%d');
    });

    test('el atajo avisa cuando ya están todas', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola %s, tienes %d mensajes');
        await traduccion.click();

        await page.keyboard.press('Control+Shift+T');
        await expect(page.locator('#messageBox')).toBeVisible();
    });

    test('el recuento de caracteres cuenta la etiqueta recién puesta', async ({ page }) => {
        // La inserción tiene que enterar a todo lo demás como si se hubiera
        // tecleado; si no, el recuento y el guardado se quedan atrás.
        await cargarPo(page, PO_CON_ETIQUETAS);

        await campo(page, 0).click();
        await page.locator('#msgid-pre-1-0 .etiqueta').first().click();

        await expect(page.locator('#charCount-1-0')).toHaveText('2');
    });
});

test.describe('avisar cuando no cuadran', () => {
    test('sin traducir no hay aviso', async ({ page }) => {
        // Un archivo recién abierto está entero sin traducir: si avisara, saldría
        // una marca roja en cada segmento y no se miraría ninguna.
        await cargarPo(page, PO_CON_ETIQUETAS);
        await expect(page.locator('.segmento-aviso:visible')).toHaveCount(0);
    });

    test('avisa cuando falta una etiqueta', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        await campo(page, 0).fill('Hola %s, tienes mensajes');

        const aviso = page.locator('#avisoEtiquetas-1-0');
        await expect(aviso).toBeVisible();
        await expect(aviso).toHaveAttribute('title', /%d/);
    });

    test('el aviso se apaga al poner la que faltaba', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola %s, tienes mensajes');
        await expect(page.locator('#avisoEtiquetas-1-0')).toBeVisible();

        await traduccion.fill('Hola %s, tienes %d mensajes');
        await expect(page.locator('#avisoEtiquetas-1-0')).toBeHidden();
    });

    test('avisa cuando sobra una etiqueta', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);
        await campo(page, 2).fill('Frase normal con un %s de más');

        await expect(page.locator('#avisoEtiquetas-3-0')).toBeVisible();
    });

    test('la fila entera se marca, para verlo bajando por la lista', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);
        await campo(page, 0).fill('Hola, tienes mensajes');

        const fila = page.locator('.segmento-fila').first();
        await expect(fila).toHaveClass(/etiquetas-mal/);
    });
});

test.describe('las etiquetas en la traducción', () => {
    test('se ven en amarillo, igual que en el original', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);
        await campo(page, 0).fill('Hola %s, tienes %d mensajes');

        const recuadros = page.locator('#msgstr-1-0').locator('xpath=..').locator('.etiqueta-fondo');
        await expect(recuadros).toHaveCount(2);
        await expect(recuadros.nth(0)).toHaveText('%s');
    });

    test('la capa de color y el texto miden exactamente igual', async ({ page }) => {
        // Si no coinciden, los recuadros salen desplazados respecto a las
        // palabras y el efecto se nota enseguida.
        await cargarPo(page, PO_CON_ETIQUETAS);
        await campo(page, 0).fill('Hola %s, tienes %d mensajes');

        const medidas = await page.locator('#msgstr-1-0').evaluate((ta) => {
            const capa = ta.parentElement.querySelector('.capa-etiquetas');
            const leer = (el) => {
                const e = getComputedStyle(el);
                return [e.fontSize, e.fontFamily, e.lineHeight, e.letterSpacing, e.whiteSpace,
                        e.wordBreak, e.paddingLeft, e.paddingTop].join('|');
            };
            return {
                iguales: leer(ta) === leer(capa),
                anchoIgual: Math.abs(ta.clientWidth - capa.clientWidth) < 1,
            };
        });

        expect(medidas.iguales).toBe(true);
        expect(medidas.anchoIgual).toBe(true);
    });

    test('el color se actualiza al escribir', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);
        const traduccion = campo(page, 0);
        const recuadros = page.locator('#msgstr-1-0').locator('xpath=..').locator('.etiqueta-fondo');

        await traduccion.fill('Sin nada');
        await expect(recuadros).toHaveCount(0);

        await traduccion.fill('Con %s');
        await expect(recuadros).toHaveCount(1);
    });
});

test.describe('etiquetas indivisibles', () => {
    test('el retroceso se lleva la etiqueta entera', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola %s');
        await traduccion.click();
        await page.keyboard.press('End');
        await page.keyboard.press('Backspace');

        // Y no "Hola %", que es lo que dejaría un borrado carácter a carácter.
        await expect(traduccion).toHaveValue('Hola ');
    });

    test('suprimir también', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('%s hola');
        await traduccion.evaluate((el) => el.setSelectionRange(0, 0));
        await page.keyboard.press('Delete');

        await expect(traduccion).toHaveValue(' hola');
    });

    test('no se puede escribir dentro de una etiqueta', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 1);
        await traduccion.fill('Lee la <a href="/help">ayuda</a>');
        // Cursor en medio de la etiqueta de apertura.
        await traduccion.evaluate((el) => el.setSelectionRange(10, 10));
        await page.keyboard.type('X');

        // La etiqueta sigue entera y la letra ha caído detrás de ella.
        await expect(traduccion).toHaveValue('Lee la <a href="/help">Xayuda</a>');
    });

    test('borrar una selección que parte una etiqueta se la lleva entera', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola %s adiós');
        // Se selecciona "la %" — la mitad de la etiqueta.
        await traduccion.evaluate((el) => el.setSelectionRange(2, 6));
        await page.keyboard.press('Backspace');

        await expect(traduccion).toHaveValue('Ho adiós');
    });

    test('el deshacer del navegador sigue funcionando', async ({ page }) => {
        // Es lo que se pierde en cuanto uno falsifica la edición a mano en
        // lugar de dejar que borre el navegador.
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola %s');
        await traduccion.click();
        await page.keyboard.press('End');
        await page.keyboard.press('Backspace');
        await expect(traduccion).toHaveValue('Hola ');

        await page.keyboard.press('ControlOrMeta+z');
        await expect(traduccion).toHaveValue('Hola %s');
    });

    test('en el texto normal se borra letra a letra, como siempre', async ({ page }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.fill('Hola');
        await traduccion.click();
        await page.keyboard.press('End');
        await page.keyboard.press('Backspace');

        await expect(traduccion).toHaveValue('Hol');
    });

    test('las tildes se escriben con normalidad', async ({ page }) => {
        // El guardián no interviene durante una composición: es justo lo que
        // rompe la é en los editores que reconstruyen el campo al vuelo.
        await cargarPo(page, PO_CON_ETIQUETAS);

        const traduccion = campo(page, 0);
        await traduccion.click();
        await page.keyboard.type('canción y %s más');

        await expect(traduccion).toHaveValue('canción y %s más');
    });
});

test.describe('convivencia con lo que ya había', () => {
    test('buscar en el original no borra el color de las etiquetas', async ({ page }) => {
        // El buscador y el glosario escriben en el mismo elemento que las
        // etiquetas: antes el último en pasar se llevaba por delante lo de los
        // otros.
        await cargarPo(page, PO_CON_ETIQUETAS);

        await page.locator('#poSearchInput').fill('messages');
        await expect(page.locator('#msgid-pre-1-0 .search-highlight')).toHaveCount(1);
        await expect(page.locator('#msgid-pre-1-0 .etiqueta')).toHaveCount(2);

        // Y al vaciar la búsqueda, las etiquetas siguen ahí.
        await page.locator('#poSearchInput').fill('');
        await expect(page.locator('#msgid-pre-1-0 .etiqueta')).toHaveCount(2);
    });

    test('las etiquetas siguen puestas después de entrar y salir del segmento', async ({
        page,
    }) => {
        await cargarPo(page, PO_CON_ETIQUETAS);

        await campo(page, 0).click();
        await campo(page, 1).click();

        await expect(page.locator('#msgid-pre-1-0 .etiqueta')).toHaveCount(2);
    });
});
