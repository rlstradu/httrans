/**
 * Prueba de humo: que subpandaASS sigue en pie.
 *
 * No comprueba funciones concretas, es una red de seguridad para el refactor.
 * Lo que mira es lo mínimo que tiene que ser cierto para que la herramienta
 * sirva de algo: que carga sin errores, que un ASS y un SRT entran y se ven, y
 * que el texto se puede editar.
 *
 * Al partir un archivo único en módulos, un error de importación deja la página
 * en blanco sin decir nada. Esto es lo que lo caza.
 */
import { test, expect, abrir, ASS_EJEMPLO, SRT_EJEMPLO } from './apoyo.js';

test.describe('subpandaASS arranca', () => {
    test('la página carga sin errores de JavaScript', async ({ page }) => {
        const errores = [];
        page.on('pageerror', (e) => errores.push(e.message));
        page.on('console', (m) => {
            if (m.type() !== 'error') return;
            // El navegador pide el icono de la pestaña por su cuenta y no pasa
            // por las rutas interceptadas. No dice nada de la herramienta.
            if (m.location().url.endsWith('/favicon.ico')) return;
            errores.push(m.text());
        });

        await page.reload();
        await page.waitForTimeout(1500);

        expect(errores).toEqual([]);
    });

    test('la herramienta se monta entera', async ({ page }) => {
        // Si el JavaScript no llega a ejecutarse, la marcación sigue ahí y la
        // página parece correcta. Lo que no estaría es la tabla con sus
        // cabeceras traducidas ni los menús respondiendo.
        await expect(page.locator('#subtitle-body')).toBeAttached();
        await expect(page.locator('#ass-loader')).toBeAttached();
    });

    test('un ASS entra y se ve', async ({ page }) => {
        await abrir(page);

        await expect(page.locator('#subtitle-body tr')).toHaveCount(3);
        await expect(page.locator('#subtitle-body')).toContainText('Hello world');
        await expect(page.locator('#subtitle-body')).toContainText('Last line');
    });

    test('el texto del ASS se enseña tal cual, con sus llaves', async ({ page }) => {
        // Hoy la tabla enseña el texto del ASS sin tocar: `{\i1}…{\i0}` se lee
        // ahí mismo. No es un descuido que este refactor deba arreglar, es lo
        // que la herramienta hace, y esta prueba está para que siga haciéndolo
        // hasta que se decida otra cosa. (subpandaTM sí lo convierte en cursiva
        // de verdad; cuando se unifiquen las dos interfaces hay que elegir.)
        await abrir(page);

        await expect(page.locator('#subtitle-body tr').nth(1)).toContainText('{\\i1}');
    });

    test('un SRT también entra', async ({ page }) => {
        await abrir(page, SRT_EJEMPLO, 'encargo.srt');

        await expect(page.locator('#subtitle-body tr')).toHaveCount(2);
        await expect(page.locator('#subtitle-body')).toContainText('Goodbye');
    });

    test('los tiempos salen con su formato, no en crudo', async ({ page }) => {
        await abrir(page, ASS_EJEMPLO);

        await expect(page.locator('#subtitle-body tr').first()).toContainText('0:00:01');
    });

    test('el ASS de ejemplo no se ha quedado a medias', async ({ page }) => {
        // Comprobación del propio apoyo: si el ejemplo tuviera la cabecera mal,
        // las demás pruebas fallarían por la razón equivocada.
        expect(ASS_EJEMPLO).toContain('[Events]');
        expect(ASS_EJEMPLO.match(/^Dialogue:/gm)).toHaveLength(3);
    });
});
