/**
 * El icono de comentarios del segmento y su cajita.
 *
 * Dos reglas se comprueban aquí. La primera, el reparto: **la referencia
 * identifica el segmento y se queda en la etiqueta gris; la nota dice cómo
 * traducirlo y se va al icono**. Antes iban las dos juntas a la etiqueta, y las
 * notas largas del programador se quedaban cortadas en una línea de letra
 * pequeña que no invita a leerse.
 *
 * La segunda, dónde se escribe: **debajo del segmento del que habla**, no en un
 * cuadro de diálogo. Un diálogo tapa el texto justo cuando hace falta mirarlo.
 */
import { test, expect, cargarPo } from './apoyo.js';

const PO_CON_NOTAS = `msgid ""
msgstr ""
"Language: es\\n"

#. Es el botón de la barra principal. Máximo 20 caracteres.
#: admin/menu.php:120
msgid "Save"
msgstr ""

#: admin/menu.php:245
msgid "Delete"
msgstr ""
`;

test('la nota del programador enciende el icono y la referencia se queda arriba', async ({
    page,
}) => {
    await cargarPo(page, PO_CON_NOTAS);

    const primero = page.locator('#translation-unit-1');
    const etiqueta = primero.locator('.segmento-contexto-etiqueta');

    // Arriba, solo la referencia: dónde vive la cadena.
    await expect(etiqueta).toHaveText('admin/menu.php:120');
    await expect(etiqueta).not.toContainText('Máximo 20 caracteres');

    // La nota, en el icono encendido.
    const icono = primero.locator('.segmento-comentario');
    await expect(icono).toHaveClass(/con-nota/);
    await expect(icono).toBeEnabled();
    await expect(icono).toHaveAttribute(
        'title',
        'Es el botón de la barra principal. Máximo 20 caracteres.'
    );
});

test('el segmento sin notas deja el icono apagado pero en su sitio', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    const icono = page.locator('#translation-unit-2 .segmento-comentario');
    // Sigue ahí: si apareciera y desapareciera, el pie bailaría de fila a fila.
    await expect(icono).toBeVisible();
    await expect(icono).not.toHaveClass(/con-nota/);
});

test('la cajita se abre debajo de la fila del segmento, no en un diálogo', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    await page.locator('#translation-unit-1 .segmento-comentario').click();

    const caja = page.locator('#comentarioCaja-1-0');
    await expect(caja).toBeVisible();

    // Pegada al segmento del que habla: es el hermano siguiente de su fila.
    const vaJustoDebajo = await caja.evaluate((el) =>
        Boolean(el.previousElementSibling?.classList.contains('segmento-fila'))
    );
    expect(vaJustoDebajo).toBe(true);
});

test('al pulsar el icono se lee la nota del archivo entera', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    await page.locator('#translation-unit-1 .segmento-comentario').click();
    await expect(page.locator('#comentarioCaja-1-0 .comentario-archivo')).toContainText(
        'Máximo 20 caracteres'
    );
    // Y lo del archivo no se puede editar desde aquí: no es nuestro.
    await expect(page.locator('#comentarioTexto-1-0')).toHaveValue('');
});

test('se puede escribir un comentario propio y queda guardado', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    const icono = page.locator('#translation-unit-2 .segmento-comentario');
    await icono.click();
    await page.locator('#comentarioTexto-2-0').fill('Preguntar al cliente si es "Borrar"');
    await page.locator('#comentarioCaja-2-0 .comentario-guardar').click();

    // Al guardar, la cajita se cierra: la nota ya está en su icono.
    await expect(page.locator('#comentarioCaja-2-0')).toHaveCount(0);
    await expect(icono).toHaveClass(/con-nota/);
    await expect(icono).toHaveAttribute('title', /Preguntar al cliente/);

    // Y al volver a abrirla sigue ahí, lista para seguir escribiendo.
    await icono.click();
    await expect(page.locator('#comentarioTexto-2-0')).toHaveValue(
        'Preguntar al cliente si es "Borrar"'
    );
});

test('el segmento con nota del archivo enseña las dos cosas por separado', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    const icono = page.locator('#translation-unit-1 .segmento-comentario');
    await icono.click();
    await page.locator('#comentarioTexto-1-0').fill('Lo dejo corto: "Guardar"');
    await page.locator('#comentarioCaja-1-0 .comentario-guardar').click();

    await icono.click();
    // Lo del archivo arriba, lo mío abajo: son dos cosas distintas y no se
    // mezclan, ni al leerlas ni al guardarlas.
    await expect(page.locator('#comentarioCaja-1-0 .comentario-archivo')).toContainText(
        'Máximo 20 caracteres'
    );
    await expect(page.locator('#comentarioTexto-1-0')).toHaveValue('Lo dejo corto: "Guardar"');
});

test('cancelar no guarda lo escrito', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    const icono = page.locator('#translation-unit-2 .segmento-comentario');
    await icono.click();
    await page.locator('#comentarioTexto-2-0').fill('Esto no debería quedarse');
    await page.locator('#comentarioCaja-2-0 .comentario-cancelar').click();

    await expect(page.locator('#comentarioCaja-2-0')).toHaveCount(0);
    await expect(icono).not.toHaveClass(/con-nota/);
    await icono.click();
    await expect(page.locator('#comentarioTexto-2-0')).toHaveValue('');
});

test('eliminar borra la nota y solo sale cuando hay algo que borrar', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    const icono = page.locator('#translation-unit-2 .segmento-comentario');

    // Sin nota, no hay botón de eliminar: encendido sobre una nota que no
    // existe solo sirve para dar un susto.
    await icono.click();
    await expect(page.locator('#comentarioCaja-2-0 .comentario-eliminar')).toHaveCount(0);

    await page.locator('#comentarioTexto-2-0').fill('Nota que se va a ir');
    await page.locator('#comentarioCaja-2-0 .comentario-guardar').click();
    await expect(icono).toHaveClass(/con-nota/);

    await icono.click();
    await page.locator('#comentarioCaja-2-0 .comentario-eliminar').click();

    await expect(page.locator('#comentarioCaja-2-0')).toHaveCount(0);
    await expect(icono).not.toHaveClass(/con-nota/);
});

test('solo hay una cajita abierta a la vez', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    await page.locator('#translation-unit-1 .segmento-comentario').click();
    await page.locator('#translation-unit-2 .segmento-comentario').click();

    await expect(page.locator('.comentario-caja')).toHaveCount(1);
    await expect(page.locator('#comentarioCaja-2-0')).toBeVisible();

    // Y el mismo icono la cierra: enciende y apaga.
    await page.locator('#translation-unit-2 .segmento-comentario').click();
    await expect(page.locator('.comentario-caja')).toHaveCount(0);
});

test('el icono está junto al de copiar el original', async ({ page }) => {
    await cargarPo(page, PO_CON_NOTAS);

    const pie = page.locator('#translation-unit-1 .segmento-destino .segmento-pie');
    const clases = await pie.evaluate((el) =>
        Array.from(el.children).map((hijo) => hijo.className)
    );

    expect(clases[0]).toContain('segmento-comentario');
    expect(clases[1]).toContain('copy-original-button');
});
