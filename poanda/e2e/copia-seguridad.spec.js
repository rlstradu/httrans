/**
 * Copia de seguridad automática, probada en un navegador de verdad.
 *
 * Los tests de tests/copia-seguridad.test.js comprueban el almacén por dentro.
 * Estos comprueban lo que de verdad le importa a quien traduce: que si se cierra
 * el navegador a media faena, al volver le ofrezcan recuperar el trabajo y lo
 * recupere entero.
 *
 * Poanda guarda sola cada diez segundos, así que estos tests tardan un poco más
 * que el resto. Es tiempo bien gastado: es la red de seguridad de la herramienta.
 */
import { test, expect, cargarPo } from './apoyo.js';

/** Margen de espera para el guardado automático, que ocurre cada 10 segundos. */
const ESPERA_AUTOGUARDADO = 20_000;

test.describe('copia de seguridad automática', () => {
    test('guarda la sesión sola y ofrece recuperarla al volver', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);

        // El indicador de copia aparece cuando se ha guardado la primera vez.
        await expect(page.locator('#backupIndicator')).toBeVisible({
            timeout: ESPERA_AUTOGUARDADO,
        });

        // Cerrar y volver a abrir, como quien cierra el portátil.
        await page.reload();

        await expect(page.locator('#restoreBackupModal')).toBeVisible();
    });

    test('al recuperar, vuelven los segmentos y las traducciones', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);

        const campo = page.locator('textarea[id^="msgstr-"]').first();
        await campo.fill('Ajustes de prueba');
        await campo.blur();

        await expect(page.locator('#backupIndicator')).toBeVisible({
            timeout: ESPERA_AUTOGUARDADO,
        });
        await page.reload();

        await page.locator('#restoreBackupBtn').click();

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
        await expect(page.locator('textarea[id^="msgstr-"]').first()).toHaveValue(
            'Ajustes de prueba'
        );
    });

    test('descartar la copia deja el editor vacío', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);
        await expect(page.locator('#backupIndicator')).toBeVisible({
            timeout: ESPERA_AUTOGUARDADO,
        });

        await page.reload();
        await page.locator('#discardBackupBtn').click();

        await expect(page.locator('#restoreBackupModal')).toBeHidden();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(0);
    });

    test('sin nada cargado no se ofrece recuperar nada', async ({ page }) => {
        await page.reload();
        await expect(page.locator('#restoreBackupModal')).toBeHidden();
    });

    test('borrar la copia desde el menú la elimina de verdad', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);
        await expect(page.locator('#backupIndicator')).toBeVisible({
            timeout: ESPERA_AUTOGUARDADO,
        });

        await page.locator('#backupBtn').click();
        await expect(page.locator('#backupModal')).toBeVisible();
        await page.locator('#deleteLocalBackupBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        // El indicador desaparece y, al volver a entrar, no hay nada que recuperar.
        await expect(page.locator('#backupIndicator')).toBeHidden();
        await page.reload();
        await expect(page.locator('#restoreBackupModal')).toBeHidden();
    });
});
