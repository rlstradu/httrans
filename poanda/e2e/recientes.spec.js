/**
 * Lista de proyectos recientes, en el menú Proyecto.
 *
 * Es la parte visible de todo el trabajo con Dexie: poder cerrar el navegador,
 * volver al día siguiente y seguir donde lo dejaste sin buscar el archivo.
 */
import { test, expect, cambiarIdioma, cargarArchivo, cargarPo, PO_EJEMPLO } from './apoyo.js';

/** Espera de sobra para que el autoguardado (cada 10 s) haya pasado. */
const ESPERA_AUTOGUARDADO = 20_000;

/**
 * Espera a que el editor haya pasado a memoria el texto recién escrito.
 *
 * El editor no actualiza su modelo en cada pulsación: espera 300 ms desde la
 * última tecla para no recalcular estadísticas mientras se escribe (ver el
 * temporizador de editor.js). El contador de caracteres, en cambio, sí se
 * actualiza al instante, así que NO sirve como señal: mirarlo era lo que hacía
 * que estos tests fallasen de vez en cuando.
 */
async function esperarAlEditor(page) {
    await page.waitForTimeout(500);
}

/** Abre el menú Proyecto y entra en la lista de recientes. */
async function abrirRecientes(page) {
    await page.locator('#projectBtn').click();
    await page.locator('#recentProjectsBtn').click();
    await expect(page.locator('#recentProjectsModal')).toBeVisible();
}

/**
 * Borra la copia de seguridad de sesión sin tocar los proyectos.
 *
 * Esa copia se guarda sola cada diez segundos, así que puede aparecer o no
 * según lo que tarde el test. Quitándola de en medio, estos tests comprueban
 * solo lo suyo: recuperar desde la lista de proyectos.
 */
async function olvidarCopiaDeSesion(page) {
    await page.evaluate(
        () =>
            new Promise((resolve) => {
                const peticion = indexedDB.open('PoandaBackup');
                peticion.onsuccess = () => {
                    const base = peticion.result;
                    if (!base.objectStoreNames.contains('session')) {
                        base.close();
                        return resolve();
                    }
                    const transaccion = base.transaction(['session'], 'readwrite');
                    transaccion.objectStore('session').clear();
                    transaccion.oncomplete = () => {
                        base.close();
                        resolve();
                    };
                    transaccion.onerror = () => {
                        base.close();
                        resolve();
                    };
                };
                peticion.onerror = () => resolve();
            })
    );
}

test.describe('proyectos recientes', () => {
    test('sin nada abierto, avisa de que la lista está vacía', async ({ page }) => {
        await abrirRecientes(page);
        await expect(page.locator('#recentProjectsEmpty')).toBeVisible();
        await expect(page.locator('.recent-project')).toHaveCount(0);
    });

    test('el archivo abierto aparece en la lista con su avance', async ({ page }) => {
        await cargarPo(page);
        await abrirRecientes(page);

        await expect(page.locator('.recent-project')).toHaveCount(1);
        await expect(page.locator('.recent-project-name')).toContainText('.po');
        await expect(page.locator('.recent-project-format')).toHaveText('PO');
        // Tres cadenas traducibles (la cabecera del archivo no cuenta), una ya
        // traducida en el archivo de ejemplo.
        await expect(page.locator('.recent-project-meta')).toContainText('1/3');
    });

    test('el avance se actualiza al traducir', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page);

        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        await campo.fill('Guardar cambios');
        await campo.blur();

        await esperarAlEditor(page);

        // Al abrir la lista se guarda lo pendiente, así que el avance ya es el bueno.
        await abrirRecientes(page);
        await expect(page.locator('.recent-project-meta')).toContainText('2/3');
    });

    test('el proyecto que está abierto no se puede volver a abrir', async ({ page }) => {
        await cargarPo(page);
        await abrirRecientes(page);
        await expect(page.locator('.recent-project-open')).toBeDisabled();
    });

    test('se puede volver a un proyecto tras recargar la página', async ({ page }) => {
        test.setTimeout(90_000);
        await cargarPo(page);

        const campo = page.locator('textarea[id^="msgstr-"]').nth(1);
        await campo.fill('Traducción que debe volver');
        await campo.blur();
        await esperarAlEditor(page);

        await abrirRecientes(page); // fuerza el guardado
        await page.locator('#recentProjectsCloseBtn').click();

        // Se cierra y se vuelve a entrar, como quien apaga el ordenador.
        await olvidarCopiaDeSesion(page);
        await page.reload();

        await expect(page.locator('#restoreBackupModal')).toBeHidden();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(0);

        await abrirRecientes(page);
        await page.locator('.recent-project-open').first().click();

        await expect(page.locator('#recentProjectsModal')).toBeHidden();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
        await expect(page.locator('textarea[id^="msgstr-"]').nth(1)).toHaveValue(
            'Traducción que debe volver'
        );
    });

    test('quitar un proyecto lo saca de la lista', async ({ page }) => {
        await cargarPo(page);
        await abrirRecientes(page);
        await expect(page.locator('.recent-project')).toHaveCount(1);

        await page.locator('.recent-project-delete').click();
        await page.locator('#confirmModalOkBtn').click();

        await expect(page.locator('.recent-project')).toHaveCount(0);
        await expect(page.locator('#recentProjectsEmpty')).toBeVisible();
    });

    test('cancelar el borrado no quita nada', async ({ page }) => {
        await cargarPo(page);
        await abrirRecientes(page);

        await page.locator('.recent-project-delete').click();
        await page.locator('#confirmModalCancelBtn').click();

        await expect(page.locator('.recent-project')).toHaveCount(1);
    });

    test('guarda varios proyectos y los ordena por el más reciente', async ({ page }) => {
        test.setTimeout(60_000);
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        await cargarArchivo(page, {
            nombre: 'segundo.po',
            contenido: 'msgid "Cat"\nmsgstr "Gato"\n',
            tipo: 'text/x-gettext-translation',
        });
        await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();

        await abrirRecientes(page);
        await expect(page.locator('.recent-project')).toHaveCount(2);
        await expect(page.locator('.recent-project-name').first()).toContainText('segundo.po');
    });

    test('la lista está traducida a los dos idiomas', async ({ page }) => {
        await cambiarIdioma(page, 'es');
        await abrirRecientes(page);
        await expect(page.locator('#recentProjectsModal')).toContainText('recientes');

        await page.locator('#recentProjectsCloseBtn').click();
        await cambiarIdioma(page, 'en');
        await abrirRecientes(page);
        await expect(page.locator('#recentProjectsModal')).toContainText('Recent');
    });
});
