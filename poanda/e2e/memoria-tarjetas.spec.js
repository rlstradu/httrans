/**
 * Cómo se ven las coincidencias de la memoria.
 *
 * Esto era una tabla de tres columnas —porcentaje, original, traducción— metida
 * en un panel de unos 300 píxeles. Cada celda partía la frase cada dos palabras,
 * el original venía marcado carácter a carácter, y encima se enseñaban TODAS las
 * unidades de la memoria por poco que se parecieran: una coincidencia del 12 %
 * entre dos frases sin nada en común se veía como confeti rojo y verde.
 *
 * Ahora cada coincidencia es una tarjeta: porcentaje y botón de insertar arriba,
 * original debajo y traducción al final. Lo que se comprueba aquí es que la
 * tarjeta dice las tres cosas que hacen falta para decidir (cuánto se parece, en
 * qué se diferencia y qué se puso), que se puede insertar, y que las
 * coincidencias que no sirven no llegan a la lista.
 */
import { test, expect, cargarPo } from './apoyo.js';

/**
 * Un archivo con dos frases casi iguales y una que no tiene nada que ver.
 *
 * Traduciendo la primera, la memoria debe proponerla al llegar a la segunda
 * (cambia una palabra), y no debe proponerla en la tercera.
 */
const PO_PARECIDAS = `msgid ""
msgstr ""
"Project-Id-Version: ejemplo 1.0\\n"
"Language: es\\n"

#: a.php:1
msgid "Save the current file before closing"
msgstr ""

#: a.php:2
msgid "Save the current project before closing"
msgstr ""

#: a.php:3
msgid "Colours"
msgstr ""
`;

/** Traduce un segmento y lo valida, que es lo que lo guarda en la memoria. */
async function traducirYValidar(page, id, texto) {
    await page.locator(`#msgstr-${id}`).fill(texto);
    await page.locator(`#validateBtn-${id}`).click();
}

const tarjetas = (page) => page.locator('#tmResultadosLista .tm-tarjeta');

test.describe('las tarjetas de la memoria', () => {
    test('una coincidencia se ve como una tarjeta, no como una fila de tabla', async ({ page }) => {
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');

        // Al entrar en la frase parecida, la memoria propone la de antes.
        await page.locator('#msgstr-2-0').click();
        await expect(tarjetas(page)).toHaveCount(1);

        const tarjeta = tarjetas(page).first();
        await expect(tarjeta.locator('.tm-insignia')).toBeVisible();
        await expect(tarjeta.locator('.tm-tarjeta-origen')).toContainText('Save the current file');
        await expect(tarjeta.locator('.tm-tarjeta-destino')).toHaveText(
            'Guarda el archivo actual antes de cerrar'
        );
        await expect(tarjeta.locator('.tm-insertar')).toBeVisible();

        // La tabla que había antes ya no existe en ningún sitio.
        await expect(page.locator('#tmSearchResultsTableBody')).toHaveCount(0);
    });

    test('la insignia dice el porcentaje y la banda por su color', async ({ page }) => {
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');
        await page.locator('#msgstr-2-0').click();

        const tarjeta = tarjetas(page).first();
        await expect(tarjeta.locator('.tm-insignia')).toHaveText(/^\d{2,3}%$/);
        // Cambia una palabra de siete: eso no es ni exacta ni lejana.
        await expect(tarjeta).toHaveClass(/tm-banda-(alta|media)/);

        // La etiqueta en palabras va en el title, no ocupando la línea: en una
        // columna estrecha dejaría al botón de insertar sin sitio.
        const explicacion = await tarjeta.locator('.tm-insignia').getAttribute('title');
        expect(explicacion.length).toBeGreaterThan(10);
    });

    test('se ve en qué se diferencia, marcado por palabras y no por letras', async ({ page }) => {
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');
        await page.locator('#msgstr-2-0').click();

        const origen = tarjetas(page).first().locator('.tm-tarjeta-origen');
        // "file" sobra y "project" falta: dos palabras enteras, no letras sueltas.
        await expect(origen.locator('.tm-diff-menos')).toContainText('file');
        await expect(origen.locator('.tm-diff-mas')).toContainText('project');

        // Lo que no cambia no se marca: si cada palabra llevara marca, la
        // comparación no diría nada.
        const marcadas = await origen.locator('.tm-diff-mas, .tm-diff-menos').count();
        expect(marcadas).toBeLessThanOrEqual(4);
    });

    test('el botón de insertar pone la traducción en el segmento', async ({ page }) => {
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');

        await page.locator('#msgstr-2-0').click();
        await tarjetas(page).first().locator('.tm-insertar').click();

        await expect(page.locator('#msgstr-2-0')).toHaveValue(
            'Guarda el archivo actual antes de cerrar'
        );
    });

    test('una coincidencia que no se parece a nada no se enseña', async ({ page }) => {
        // Este es el caso de la captura: un 12 % entre dos frases que no tienen
        // nada en común salvo que ambas usan la letra "a".
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');

        // "Colours" no tiene nada que ver con "Save the current file...".
        await page.locator('#msgstr-3-0').click();
        await expect(tarjetas(page)).toHaveCount(0);
    });

    test('buscando en la memoria, la insignia no finge un porcentaje', async ({ page }) => {
        // Buscar una palabra dentro de una frase larga da un parecido bajísimo
        // que no significa nada: es una búsqueda, no una comparación.
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');

        await page.locator('#buscarPaneles').fill('closing');
        await expect(tarjetas(page)).toHaveCount(1);

        const tarjeta = tarjetas(page).first();
        await expect(tarjeta.locator('.tm-insignia')).not.toHaveText(/%/);
        // Y se ve dónde está lo buscado.
        await expect(tarjeta.locator('.tm-tarjeta-origen .tm-encontrado')).toHaveText('closing');
    });

    test('el texto de la tarjeta se lee sobre su fondo', async ({ page }) => {
        // El fallo que ya se ha colado dos veces en este proyecto: usar como
        // color de letra un gris que en realidad es un gris de borde.
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');
        await page.locator('#msgstr-2-0').click();

        const colores = await tarjetas(page)
            .first()
            .evaluate((tarjeta) => {
                const de = (sel) => getComputedStyle(tarjeta.querySelector(sel)).color;
                return {
                    fondo: getComputedStyle(tarjeta).backgroundColor,
                    origen: de('.tm-tarjeta-origen'),
                    destino: de('.tm-tarjeta-destino'),
                };
            });

        expect(colores.origen).not.toBe(colores.fondo);
        expect(colores.destino).not.toBe(colores.fondo);
        // Y el original no puede ser casi blanco, que es lo que pasa al usar
        // --color-medium-gray (#e5e7eb) como color de letra.
        const claridad = (c) =>
            (c.match(/\d+/g) || [0, 0, 0]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
        expect(claridad(colores.origen)).toBeLessThan(200);
    });

    test('las tarjetas ocupan el ancho del panel, no tres columnas', async ({ page }) => {
        await cargarPo(page, PO_PARECIDAS);
        await traducirYValidar(page, '1-0', 'Guarda el archivo actual antes de cerrar');
        await page.locator('#msgstr-2-0').click();

        const anchos = await tarjetas(page)
            .first()
            .evaluate((tarjeta) => ({
                tarjeta: tarjeta.getBoundingClientRect().width,
                origen: tarjeta.querySelector('.tm-tarjeta-origen').getBoundingClientRect().width,
            }));

        // El original usa toda la tarjeta: antes se quedaba en media columna.
        expect(anchos.origen).toBeGreaterThan(anchos.tarjeta * 0.8);
    });
});
