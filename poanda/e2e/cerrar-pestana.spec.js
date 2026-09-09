/**
 * El aviso al cerrar la pestaña.
 *
 * Poanda guarda cada diez segundos. Cerrar la pestaña sin querer se llevaba por
 * delante lo último escrito sin decir nada: ni un aviso, ni una pregunta. Es la
 * peor forma de perder trabajo, porque ni siquiera te enteras de que lo has
 * perdido hasta que vuelves a abrir el archivo.
 *
 * Lo que se comprueba aquí es que el navegador pregunta cuando hay algo que
 * perder, y **solo** cuando lo hay: un aviso que sale siempre se aprende a
 * ignorar en dos días, y entonces vuelve a no servir para nada.
 */
import { test, expect, cargarPo, PO_EJEMPLO } from './apoyo.js';

/**
 * ¿Pediría el navegador confirmación ahora mismo?
 *
 * Se lanza el evento a mano en vez de cerrar la pestaña de verdad: lo que hay
 * que comprobar es la decisión de Poanda, y el cuadro del navegador no se puede
 * mirar desde dentro de la página.
 */
async function preguntariaAlCerrar(page) {
    return page.evaluate(() => {
        const evento = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(evento);
        return evento.defaultPrevented || evento.returnValue === '';
    });
}

test.describe('cerrar la pestaña con trabajo sin guardar', () => {
    test('sin archivo abierto no pregunta nada', async ({ page }) => {
        expect(await preguntariaAlCerrar(page)).toBe(false);
    });

    test('con un archivo abierto y sin tocar tampoco pregunta', async ({ page }) => {
        // Abrir para mirar y cerrar es lo más normal del mundo.
        await cargarPo(page, PO_EJEMPLO);

        expect(await preguntariaAlCerrar(page)).toBe(false);
    });

    test('pregunta en cuanto se escribe una traducción', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        // El editor lleva lo escrito al modelo con 300 ms de retardo.
        await page.waitForTimeout(500);

        expect(await preguntariaAlCerrar(page)).toBe(true);
    });

    test('deja de preguntar cuando lo escrito ya está guardado', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        await page.waitForTimeout(500);

        // El guardado automático va cada diez segundos.
        await expect
            .poll(() => preguntariaAlCerrar(page), { timeout: 20_000, intervals: [1000] })
            .toBe(false);
    });
});
