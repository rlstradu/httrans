/**
 * Las copias de seguridad y la memoria de cada proyecto.
 *
 * Dos cosas que hasta ahora no estaban guardadas donde tenían que estar:
 *
 * - Todas las copias se escribían en la misma fila de la base de datos, así que
 *   abrir un segundo archivo borraba la copia del primero sin avisar. Quien
 *   traduce dos encargos en el mismo día perdía la red de seguridad del
 *   primero.
 * - La memoria y el glosario no se guardaban en ningún sitio propio. Las tablas
 *   existían en la base de datos, con su columna de proyecto y todo, y no las
 *   escribía nadie.
 */
import { test, expect, cargarSrt, desdeElMenuArchivo, elegirIdiomas } from './apoyo.js';

const SRT_A = `1
00:00:01,000 --> 00:00:03,000
Save the file
`;

const SRT_B = `1
00:00:01,000 --> 00:00:03,000
Open the folder
`;

/** Guarda sin esperar a que salte el guardado automático. */
async function guardarCopia(page) {
    await page.waitForTimeout(11_000);
}

/** Añade un término al glosario. */
async function anadirTermino(page, origen, destino) {
    await page.locator('#addTermToggleBtn').click();
    await page.locator('#terminoOrigen').fill(origen);
    await page.locator('#terminoDestino').fill(destino);
    await page.locator('#terminoGuardarBtn').click();
    await expect(page.locator('#terminoModal')).toBeHidden();
}

/** Abre el cuadro de copias y devuelve cuántas hay en el desplegable. */
async function cuantasCopias(page) {
    await desdeElMenuArchivo(page, 'backupBtn');
    await expect(page.locator('#backupModal')).toBeVisible();
    const hay = await page.locator('#backupFoundView').isVisible();
    const cuantas = hay ? await page.locator('#backupSelect option').count() : 0;
    await page.locator('#closeBackupModalBtn').click();
    return cuantas;
}

test.describe('las copias de seguridad', () => {
    test('abrir un segundo archivo no borra la copia del primero', async ({ page }) => {
        test.setTimeout(90_000);
        await cargarSrt(page, SRT_A, 'primero.srt');
        await guardarCopia(page);

        await page.locator('#srtFile').setInputFiles({
            name: 'segundo.srt',
            mimeType: 'text/plain',
            buffer: Buffer.from(SRT_B),
        });
        await elegirIdiomas(page);
        await guardarCopia(page);

        expect(await cuantasCopias(page)).toBe(2);
    });

    test('la copia guardada se puede recuperar entera', async ({ page }) => {
        test.setTimeout(90_000);
        await cargarSrt(page, SRT_A, 'primero.srt');
        await page.locator('#translation-0').click();
        await page.keyboard.insertText('Guarda el archivo');
        await page.locator('#translation-0').blur();
        await anadirTermino(page, 'file', 'archivo');
        await guardarCopia(page);

        await page.reload();
        await desdeElMenuArchivo(page, 'backupBtn');
        await page.locator('#confirmRestoreBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        // Vuelven los subtítulos, la traducción y el glosario.
        await expect(page.locator('#translation-0')).toContainText('Guarda el archivo');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toContainText('archivo');
    });

    test('el glosario de un encargo no se cuela en el siguiente', async ({ page }) => {
        // Con dos clientes que traducen "file" de maneras distintas, la
        // herramienta proponía la del otro con toda su confianza, y esa clase
        // de error no se ve al revisar porque parece una decisión propia.
        test.setTimeout(90_000);
        await cargarSrt(page, SRT_A, 'cliente-a.srt');
        await anadirTermino(page, 'file', 'archivo');
        await guardarCopia(page);

        await page.locator('#srtFile').setInputFiles({
            name: 'cliente-b.srt',
            mimeType: 'text/plain',
            buffer: Buffer.from(SRT_B),
        });
        await elegirIdiomas(page);

        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
    });
});
