/**
 * El par de idiomas del proyecto.
 *
 * La regla que se comprueba aquí es que **un archivo se traduce en una
 * dirección, y esa dirección es del proyecto**: se elige al abrirlo, se ve
 * siempre, se guarda con el proyecto y de ahí tiran la memoria, el glosario y
 * el asistente. Antes había dos pares, uno del glosario y otro de la memoria,
 * cada uno con su pantalla de configuración, y se podían contradecir.
 */
import { test, expect, cargarArchivo, cargarPo, responderIdiomas, PO_EJEMPLO } from './apoyo.js';

const PO_BRASILENO = `msgid ""
msgstr ""
"Language: pt_BR\\n"

msgid "Save"
msgstr ""
`;

const XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2"><file source-language="de" target-language="fr" datatype="plaintext" original="x">
<body><trans-unit id="1"><source>Speichern</source><target></target></trans-unit></body>
</file></xliff>`;

test.describe('elegir los idiomas al abrir', () => {
    test('el cuadro sale al soltar un archivo, antes de traducir nada', async ({ page }) => {
        await page.evaluate(() => {
            const datos = new DataTransfer();
            datos.items.add(new File(['msgid "Cat"\nmsgstr ""\n'], 'gatos.po'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await expect(page.locator('#idiomasModal')).toBeVisible();
        // Y con la lista entera de idiomas, no con un campo donde teclear a ciegas.
        const cuantos = await page.locator('#idiomaOrigen option').count();
        expect(cuantos).toBeGreaterThan(180);
    });

    test('los idiomas se ven con su nombre y su código', async ({ page }) => {
        await page.evaluate(() => {
            const datos = new DataTransfer();
            datos.items.add(new File(['msgid "Cat"\nmsgstr ""\n'], 'gatos.po'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        // En este oficio se encarga por código: quien pide "pt-BR" quiere ver
        // "pt-BR" y no adivinar si "Portugués de Brasil" es esa etiqueta.
        const opcion = page.locator('#idiomaOrigen option[value="pt-BR"]');
        await expect(opcion).toHaveText('Brazilian Portuguese (pt-BR)');
    });

    test('el cuadro viene relleno con lo que declara el archivo', async ({ page }) => {
        // La cabecera de un .po dice el idioma de destino; enterarse de que está
        // mal al abrirlo cuesta un clic, y al entregarlo cuesta el encargo.
        await page.evaluate(() => {
            const contenido = 'msgid ""\nmsgstr ""\n"Language: pt_BR\\n"\n\nmsgid "Save"\nmsgstr ""\n';
            const datos = new DataTransfer();
            datos.items.add(new File([contenido], 'traducciones.po'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await expect(page.locator('#idiomaDestino')).toHaveValue('pt-BR');
        await expect(page.locator('#idiomasAviso')).toBeVisible();
    });

    test('de un XLIFF se sacan los dos idiomas', async ({ page }) => {
        await page.evaluate((contenido) => {
            const datos = new DataTransfer();
            datos.items.add(new File([contenido], 'manual.xliff'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        }, XLIFF);

        await expect(page.locator('#idiomaOrigen')).toHaveValue('de');
        await expect(page.locator('#idiomaDestino')).toHaveValue('fr');
    });

    test('no deja elegir el mismo idioma en los dos lados', async ({ page }) => {
        await page.evaluate(() => {
            const datos = new DataTransfer();
            datos.items.add(new File(['msgid "Cat"\nmsgstr ""\n'], 'gatos.po'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await page.locator('#idiomaOrigen').selectOption('es');
        await page.locator('#idiomaDestino').selectOption('es');
        await page.locator('#idiomasAceptarBtn').click();

        await expect(page.locator('#idiomasError')).toContainText(/same language/i);
        await expect(page.locator('#idiomasModal')).toBeVisible();
    });

    test('hacen falta los dos', async ({ page }) => {
        await page.evaluate(() => {
            const datos = new DataTransfer();
            datos.items.add(new File(['msgid "Cat"\nmsgstr ""\n'], 'gatos.po'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await page.locator('#idiomaOrigen').selectOption('en');
        await page.locator('#idiomaDestino').selectOption('');
        await page.locator('#idiomasAceptarBtn').click();

        await expect(page.locator('#idiomasError')).toContainText(/both/i);
    });
});

test.describe('dónde vive el indicador', () => {
    test('va al final de la barra de búsqueda, no entre los menús de arriba', async ({ page }) => {
        // Entre los menús se leía como un botón más de la aplicación; aquí es
        // lo que es: un dato del archivo que se está traduciendo.
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        const dentroDeLaBusqueda = await page
            .locator('#parIdiomasBtn')
            .evaluate((el) => Boolean(el.closest('#poSearchContainer')));
        expect(dentroDeLaBusqueda).toBe(true);

        const arriba = await page
            .locator('#parIdiomasBtn')
            .evaluate((el) => Boolean(el.closest('.top-utility-buttons-container')));
        expect(arriba).toBe(false);
    });

    test('va detrás de una raya y con su propio título', async ({ page }) => {
        // Sin nada en medio se leía como el final de la barra de búsqueda. La
        // raya lo separa y el título dice de qué es el dato y que se puede
        // tocar; el borde permanente es lo que lo hace parecer un botón.
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        await expect(page.locator('#poSearchContainer .separador-barra')).toBeVisible();
        await expect(page.locator('.par-idiomas-titulo')).toHaveText(/Project languages/i);

        // La raya va justo antes del par, no en cualquier sitio de la fila.
        const justoAntes = await page
            .locator('#parIdiomasBtn')
            .evaluate((el) =>
                Boolean(el.previousElementSibling?.classList.contains('separador-barra'))
            );
        expect(justoAntes).toBe(true);

        const borde = await page
            .locator('#parIdiomasBtn')
            .evaluate((el) => getComputedStyle(el).borderTopStyle);
        expect(borde).toBe('solid');
    });

    test('queda al final de la barra, sin robarle ancho al campo de buscar', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        const campo = await page.locator('#poSearchInput').boundingBox();
        const par = await page.locator('#parIdiomasBtn').boundingBox();
        const barra = await page.locator('#poSearchContainer').boundingBox();

        expect(par.x).toBeGreaterThan(campo.x + campo.width);
        // Pegado al final de la barra.
        const margen = barra.x + barra.width - (par.x + par.width);
        expect(margen).toBeLessThan(40);
        // Y reservando lo justo: dos códigos y poco más.
        expect(par.width).toBeLessThan(barra.width * 0.3);
    });

    test('se lee: ni el par ni las etiquetas del cuadro son grises de borde', async ({ page }) => {
        // --color-medium-gray es el gris de los bordes (#e5e7eb en modo claro),
        // casi blanco: como color de texto sobre fondo blanco no se ve. Aquí se
        // comprueba que ninguno de los dos lo use.
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        const colorDelPar = await page
            .locator('#parIdiomasBtn')
            .evaluate((el) => getComputedStyle(el).color);
        const colorDelTitulo = await page
            .locator('#idiomasModal h2')
            .evaluate((el) => getComputedStyle(el).color);

        expect(colorDelPar).toBe(colorDelTitulo);

        await page.locator('#parIdiomasBtn').click();
        const colorDeLaEtiqueta = await page
            .locator('label[for="idiomaOrigen"]')
            .evaluate((el) => getComputedStyle(el).color);

        // Las etiquetas del cuadro, del mismo color que su título.
        expect(colorDeLaEtiqueta).toBe(colorDelTitulo);
    });
});

test.describe('el indicador de la barra', () => {
    test('enseña el par elegido, en códigos', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'en-US', destino: 'pt-BR' });

        await expect(page.locator('#parIdiomasValor')).toHaveText('en-US → pt-BR');
        // El nombre entero, en el title, para quien no se sepa los códigos.
        await expect(page.locator('#parIdiomasBtn')).toHaveAttribute(
            'title',
            'American English → Brazilian Portuguese'
        );
    });

    test('sin archivo abierto no promete nada', async ({ page }) => {
        await expect(page.locator('#parIdiomasValor')).toHaveText('— → —');
    });

    test('al pulsarlo se puede cambiar el par', async ({ page }) => {
        // Equivocarse al abrir pasa; obligar a volver a abrir el archivo para
        // arreglarlo sería una penitencia que no arregla nada.
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        await page.locator('#parIdiomasBtn').click();
        await expect(page.locator('#idiomaOrigen')).toHaveValue('en');
        await page.locator('#idiomaDestino').selectOption('es-MX');
        await page.locator('#idiomasAceptarBtn').click();

        await expect(page.locator('#parIdiomasValor')).toHaveText('en → es-MX');
    });

    test('cancelar el cambio deja el par como estaba', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'en', destino: 'es' });

        await page.locator('#parIdiomasBtn').click();
        await page.locator('#idiomaDestino').selectOption('fr');
        await page.locator('#idiomasCancelarBtn').click();

        await expect(page.locator('#parIdiomasValor')).toHaveText('en → es');
    });
});

test.describe('el par se queda guardado con el proyecto', () => {
    test('al volver al proyecto desde recientes, el par sigue ahí', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'en-GB', destino: 'es-ES' });

        // Proyecto nuevo para soltar el que hay abierto, y luego se vuelve.
        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalOkBtn').click();
        await expect(page.locator('#parIdiomasValor')).toHaveText('— → —');

        await page.locator('#projectBtn').click();
        await page.locator('#recentProjectsBtn').click();
        await page.locator('.recent-project-open').first().click();
        await expect(page.locator('#recentProjectsModal')).toBeHidden();

        await expect(page.locator('#parIdiomasValor')).toHaveText('en-GB → es-ES');
        // Y no se vuelve a preguntar: el proyecto ya lo sabe.
        await expect(page.locator('#idiomasModal')).toBeHidden();
    });

    test('el par propuesto es el último que se usó', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO, { origen: 'de', destino: 'it' });

        await cargarArchivo(page, {
            nombre: 'otro.txt',
            contenido: 'Una línea suelta\n',
            idiomas: { origen: 'de', destino: 'it' },
        });

        await page.locator('#parIdiomasBtn').click();
        await expect(page.locator('#idiomaOrigen')).toHaveValue('de');
        await expect(page.locator('#idiomaDestino')).toHaveValue('it');
    });
});

test.describe('el par manda en lo que depende de él', () => {
    test('el archivo se abre con el par elegido aunque la cabecera diga otra cosa', async ({
        page,
    }) => {
        // La cabecera propone; quien traduce decide. Un .po reutilizado de otro
        // encargo trae la cabecera del encargo anterior más veces de las que
        // sería razonable.
        await page.evaluate((contenido) => {
            const datos = new DataTransfer();
            datos.items.add(new File([contenido], 'traducciones.po'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        }, PO_BRASILENO);

        await responderIdiomas(page, { origen: 'en', destino: 'pt-PT' });

        await expect(page.locator('#parIdiomasValor')).toHaveText('en → pt-PT');
    });
});
