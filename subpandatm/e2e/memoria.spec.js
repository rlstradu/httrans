/**
 * La memoria de traducción, tal y como funciona en Poanda.
 *
 * Lo que cambia respecto a lo que había: era una tabla de tres columnas
 * (porcentaje, original, traducción) dentro de un panel estrecho, donde cada
 * celda partía el texto en líneas de dos palabras y el original venía marcado
 * carácter a carácter, así que una coincidencia mala se veía como confeti rojo
 * y verde entre letras sueltas. Y se enseñaban todas: con una memoria de
 * trabajo salían coincidencias del 12 %, dos frases que no tienen nada que ver
 * salvo que ambas usan la letra "a".
 *
 * Ahora cada coincidencia es una tarjeta con su insignia, su original y su
 * traducción, solo salen las que llegan al 50 % y como mucho cinco.
 */
import { test, expect, cargarSrt } from './apoyo.js';

const SRT = `1
00:00:01,000 --> 00:00:03,000
Save the file to your computer

2
00:00:04,000 --> 00:00:06,500
Save the file to your desktop

3
00:00:07,000 --> 00:00:09,000
Nothing whatsoever in common
`;

/** Un TMX de ejemplo con dos unidades. */
const TMX = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header srclang="en" datatype="plaintext" segtype="sentence" creationtool="prueba" creationtoolversion="1" adminlang="en" o-tmf="none"></header>
  <body>
    <tu>
      <tuv xml:lang="en"><seg>Save the file to your computer</seg></tuv>
      <tuv xml:lang="es"><seg>Guarda el archivo en tu ordenador</seg></tuv>
    </tu>
    <tu>
      <tuv xml:lang="en"><seg>Delete the file</seg></tuv>
      <tuv xml:lang="es"><seg>Elimina el archivo</seg></tuv>
    </tu>
  </body>
</tmx>`;

/** Importa un TMX por el botón del panel. */
async function importarTmx(page, contenido = TMX) {
    await page.locator('#tmFileInput').setInputFiles({
        name: 'memoria.tmx',
        mimeType: 'application/xml',
        buffer: Buffer.from(contenido),
    });
}

test.describe('la memoria de traducción', () => {
    test.beforeEach(async ({ page }) => {
        await cargarSrt(page, SRT);
    });

    test('una coincidencia exacta sale como tarjeta al entrar en el subtítulo', async ({ page }) => {
        await importarTmx(page);
        await page.locator('#translation-0').click();

        const tarjeta = page.locator('#tmResultadosLista .tm-tarjeta').first();
        await expect(tarjeta).toBeVisible();
        await expect(tarjeta).toContainText('Guarda el archivo en tu ordenador');
        await expect(tarjeta).toContainText('100%');
        await expect(tarjeta).toHaveClass(/tm-banda-exacta/);
    });

    test('una coincidencia parecida sale con su porcentaje, no como exacta', async ({ page }) => {
        await importarTmx(page);
        await page.locator('#translation-1').click();

        const tarjeta = page.locator('#tmResultadosLista .tm-tarjeta').first();
        await expect(tarjeta).toBeVisible();
        await expect(tarjeta).not.toHaveClass(/tm-banda-exacta/);
        // Y se marca lo que cambia respecto al subtítulo en el que se está: lo
        // tachado sobra y lo subrayado falta.
        await expect(tarjeta.locator('del, ins').first()).toBeVisible();
    });

    test('no se enseñan coincidencias que no sirven de nada', async ({ page }) => {
        // El tercer subtítulo no se parece a nada de la memoria. Antes salían
        // igualmente, con un 12 % y un diff que era confeti.
        await importarTmx(page);
        await page.locator('#translation-2').click();

        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(0);
    });

    test('validar un subtítulo guarda la unidad en la memoria', async ({ page }) => {
        // Es lo que hace que la memoria valga para algo: se llena sola mientras
        // se trabaja.
        await page.locator('#translation-0').click();
        await page.keyboard.insertText('Guarda el archivo en tu ordenador');
        await page.locator('#translation-0').blur();
        await page.locator('#validateBtn-0').click();

        // El segundo subtítulo se parece al primero: ahora tiene coincidencia.
        await page.locator('#translation-1').click();
        await expect(page.locator('#tmResultadosLista .tm-tarjeta').first()).toContainText(
            'Guarda el archivo en tu ordenador',
        );
    });

    test('cambiar de tema no borra lo que hay consultado', async ({ page }) => {
        // Parecía que al pasar a oscuro se perdía la memoria. No se perdía: al
        // salir del campo de traducción se volvía a buscar, y fuera del campo
        // no hay subtítulo en el que buscar, así que el panel se quedaba en
        // blanco. Pulsar cualquier botón de la barra lo vaciaba, y también
        // cargar el vídeo. Volvía solo al pulsar otra vez el subtítulo, que es
        // lo que hacía que pareciera un misterio y no un fallo.
        await importarTmx(page);
        await page.locator('#translation-0').click();
        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(1);

        await page.locator('#themeToggleBtn').click();

        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(1);
    });

    test('el botón Insertar mete la traducción en el subtítulo', async ({ page }) => {
        // Con el ratón, pulsar un botón saca el cursor del campo antes de que
        // llegue el clic. Si no se evita, el botón no hace nada.
        await importarTmx(page);
        await page.locator('#translation-0').click();

        await page.locator('#tmResultadosLista .tm-insertar').first().click();

        await expect(page.locator('#translation-0')).toContainText(
            'Guarda el archivo en tu ordenador',
        );
    });

    test('el buscador encuentra unidades por una palabra suelta', async ({ page }) => {
        await importarTmx(page);

        await page.locator('#buscarPaneles').fill('Delete');

        const tarjeta = page.locator('#tmResultadosLista .tm-tarjeta').first();
        await expect(tarjeta).toContainText('Elimina el archivo');
        // Buscando no hay porcentaje que valga: se compara lo escrito con la
        // unidad entera, y ese número no dice nada.
        await expect(tarjeta.locator('.tm-insignia')).toContainText('Concordance');
        await expect(tarjeta.locator('mark')).toBeVisible();
    });

    test('la memoria es de cada proyecto, no de toda la herramienta', async ({ page }) => {
        // Abrir el encargo de otro cliente te dejaba puesta la memoria del
        // anterior. Con dos clientes que traducen "file" de maneras distintas,
        // la herramienta proponía la del otro con toda su confianza, y ese
        // error no se ve al revisar porque parece una decisión propia.
        await importarTmx(page);
        await page.locator('#translation-0').click();
        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).not.toHaveCount(0);

        await cargarSrt(page, SRT, 'otro-encargo.srt');
        await page.locator('#translation-0').click();

        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(0);
    });
});
