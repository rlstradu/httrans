/**
 * Qué queda en pantalla después de "Nuevo proyecto".
 *
 * Nuevo proyecto vacía el editor y devuelve la pantalla de bienvenida. Lo que
 * no hacía era recoger las columnas laterales: el asistente se quedaba abierto
 * a la derecha, estrechando el recuadro de soltar archivos, y el botón de la
 * barra seguía encendido como si la columna de consulta estuviera a la vista
 * cuando ya no estaba.
 *
 * La regla es sencilla: después de Nuevo proyecto, la pantalla está como al
 * abrir Poanda por primera vez, y los botones de la barra dicen la verdad.
 */
import { test, expect, cargarPo } from './apoyo.js';

/** Vacía el proyecto por el mismo camino que una persona. */
async function nuevoProyecto(page) {
    await page.locator('#projectBtn').click();
    await page.locator('#newProjectBtn').click();
    await page.locator('#confirmModalOkBtn').click();
    await expect(page.locator('#confirmModal')).toBeHidden();
}

test.describe('nuevo proyecto recoge las columnas', () => {
    test('el asistente se cierra', async ({ page }) => {
        await cargarPo(page);
        await page.locator('#aiBtn').click();
        await expect(page.locator('#aiSidebar')).toBeVisible();

        await nuevoProyecto(page);

        // Se quedaba abierto encima de la pantalla de bienvenida, comiéndose
        // el ancho del recuadro de soltar archivos.
        await expect(page.locator('#aiSidebar')).toBeHidden();
    });

    test('la columna de consulta se va con el proyecto', async ({ page }) => {
        await cargarPo(page);
        await expect(page.locator('#panelesDerecha')).toBeVisible();

        await nuevoProyecto(page);

        await expect(page.locator('#panelesDerecha')).toBeHidden();
    });

    test('los botones de la barra no siguen encendidos', async ({ page }) => {
        // Encendido significa "esto está a la vista". Sin proyecto no hay ni
        // columna ni asistente, así que los dos tienen que estar apagados: un
        // botón encendido que no corresponde a nada hace dudar de todos.
        await cargarPo(page);
        await page.locator('#aiBtn').click();
        await expect(page.locator('#panelesBtn')).toHaveClass(/utility-btn-active/);
        await expect(page.locator('#aiBtn')).toHaveClass(/utility-btn-active/);

        await nuevoProyecto(page);

        await expect(page.locator('#panelesBtn')).not.toHaveClass(/utility-btn-active/);
        await expect(page.locator('#aiBtn')).not.toHaveClass(/utility-btn-active/);
    });

    test('el siguiente archivo vuelve a traer sus paneles', async ({ page }) => {
        // Cerrarlas al vaciar el proyecto no puede convertirse en dejarlas
        // cerradas para siempre: la columna sale sola con cada archivo, que fue
        // el motivo de sacarla de las ventanas flotantes.
        await cargarPo(page);
        await page.locator('#aiBtn').click();
        await nuevoProyecto(page);

        await cargarPo(page);

        await expect(page.locator('#panelesDerecha')).toBeVisible();
        await expect(page.locator('#panelesBtn')).toHaveClass(/utility-btn-active/);
        // El asistente no: ese se abre cuando se pide, no con el archivo.
        await expect(page.locator('#aiSidebar')).toBeHidden();
    });
});
