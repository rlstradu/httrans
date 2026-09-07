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
import {
    test,
    expect,
    abrirCopiasDeSeguridad,
    cargarPo,
    esperarAvisoDeCopia,
} from './apoyo.js';

/** Margen de espera para el guardado automático, que ocurre cada 10 segundos. */
const ESPERA_AUTOGUARDADO = 20_000;

test.describe('copia de seguridad automática', () => {
    test('guarda la sesión sola y ofrece recuperarla al volver', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);

        // El indicador de copia aparece cuando se ha guardado la primera vez.
        await esperarAvisoDeCopia(page);

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

        await esperarAvisoDeCopia(page);
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
        await esperarAvisoDeCopia(page);

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
        await esperarAvisoDeCopia(page);

        await abrirCopiasDeSeguridad(page);
        await expect(page.locator('#backupModal')).toBeVisible();
        await page.locator('#deleteLocalBackupBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        // El indicador desaparece y, al volver a entrar, no hay nada que recuperar.
        await esperarAvisoDeCopia(page, false);
        await page.reload();
        await expect(page.locator('#restoreBackupModal')).toBeHidden();
    });
});

/** Lee las tablas del navegador sin pasar por la interfaz. */
async function leerBaseDeDatos(page) {
    return page.evaluate(async () => {
        const base = await new Promise((resolve, reject) => {
            const peticion = indexedDB.open('PoandaBackup');
            peticion.onsuccess = () => resolve(peticion.result);
            peticion.onerror = () => reject(peticion.error);
        });

        const leerTabla = (nombre) =>
            new Promise((resolve) => {
                if (!base.objectStoreNames.contains(nombre)) return resolve([]);
                const peticion = base.transaction([nombre], 'readonly').objectStore(nombre).getAll();
                peticion.onsuccess = () => resolve(peticion.result);
                peticion.onerror = () => resolve([]);
            });

        const [proyectos, segmentos] = await Promise.all([
            leerTabla('projects'),
            leerTabla('segments'),
        ]);
        base.close();
        return { proyectos, segmentos, version: base.version };
    });
}

test.describe('modelo de proyectos', () => {
    test('abrir un archivo crea su proyecto y sus segmentos', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);

        await expect
            .poll(async () => (await leerBaseDeDatos(page)).proyectos.length, {
                timeout: ESPERA_AUTOGUARDADO,
            })
            .toBe(1);

        const { proyectos, segmentos, version } = await leerBaseDeDatos(page);
        // Dexie numera sus versiones de diez en diez por dentro, para dejar
        // hueco a versiones intermedias: su versión 2 es la 20 de IndexedDB.
        expect(version).toBe(20);
        expect(proyectos[0].fileName).toContain('.po');
        expect(proyectos[0].format).toBe('po');
        // Tres cadenas traducibles más la cabecera: cuatro filas en total.
        // La cabecera se guarda igual, pero queda fuera del recuento de avance.
        expect(segmentos.length).toBe(4);
    });

    test('al traducir se guarda solo ese segmento', async ({ page }) => {
        test.setTimeout(90_000);
        await cargarPo(page);
        await expect
            .poll(async () => (await leerBaseDeDatos(page)).proyectos.length, {
                timeout: ESPERA_AUTOGUARDADO,
            })
            .toBe(1);

        const antes = (await leerBaseDeDatos(page)).segmentos;

        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        await campo.fill('Guardar cambios');
        await campo.blur();

        await expect
            .poll(
                async () =>
                    (await leerBaseDeDatos(page)).segmentos.filter(
                        (s) => s.translation === 'Guardar cambios'
                    ).length,
                { timeout: ESPERA_AUTOGUARDADO }
            )
            .toBe(1);

        const despues = (await leerBaseDeDatos(page)).segmentos;

        // Solo ha cambiado uno; el resto sigue exactamente igual.
        const distintos = despues.filter((s, i) => JSON.stringify(s) !== JSON.stringify(antes[i]));
        expect(distintos).toHaveLength(1);
        expect(distintos[0].isTranslated).toBe(1);
    });

    test('la copia de seguridad de sesión sigue funcionando en paralelo', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);
        await esperarAvisoDeCopia(page);

        await page.reload();
        await expect(page.locator('#restoreBackupModal')).toBeVisible();
    });
});
