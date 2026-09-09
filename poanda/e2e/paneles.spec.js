/**
 * La columna de consulta: memoria arriba, glosario abajo.
 *
 * La regla que se comprueba aquí es que **lo que se consulta mientras se traduce
 * no tapa lo que se está traduciendo**. Antes eran dos ventanas flotantes que se
 * abrían encima del editor, se podían solapar entre ellas y había que apartarlas
 * a mano; ahora son dos recuadros en una columna que empuja al editor en lugar
 * de cubrirlo.
 */
import { test, expect, anadirTermino, cargarPo, PO_EJEMPLO } from './apoyo.js';

/** Los cuatro rectángulos que interesan, de una vez. */
async function cajas(page) {
    return page.evaluate(() => {
        const caja = (s) => {
            const el = document.querySelector(s);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
                izq: Math.round(r.left),
                der: Math.round(r.right),
                arriba: Math.round(r.top),
                abajo: Math.round(r.bottom),
                ancho: Math.round(r.width),
                alto: Math.round(r.height),
            };
        };
        return {
            editor: caja('#central-column'),
            columna: caja('#panelesDerecha'),
            memoria: caja('.translation-memory-sidebar'),
            glosario: caja('.terminology-sidebar'),
            asistente: caja('.ai-sidebar'),
            estadisticas: caja('#statsContainer'),
        };
    });
}

test.describe('la columna de consulta', () => {
    test('sin archivo abierto no hay columna', async ({ page }) => {
        // Sin nada que traducir no hay nada que consultar, y una columna vacía
        // se comería el ancho de la portada.
        await expect(page.locator('#panelesDerecha')).toBeHidden();
    });

    test('con un archivo abierto sale sola, sin pulsar nada', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        await expect(page.locator('#panelesDerecha')).toBeVisible();
        await expect(page.locator('.translation-memory-sidebar')).toBeVisible();
        await expect(page.locator('.terminology-sidebar')).toBeVisible();
    });

    test('está a la derecha del editor y no encima', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const { editor, columna } = await cajas(page);

        expect(columna.izq).toBeGreaterThanOrEqual(editor.der);
    });

    test('la memoria va arriba y el glosario abajo, sin solaparse', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const { memoria, glosario, columna } = await cajas(page);

        expect(memoria.abajo).toBeLessThanOrEqual(glosario.arriba);
        expect(memoria.izq).toBe(glosario.izq);
        expect(memoria.der).toBe(columna.der);
    });

    test('los paneles no quedan debajo de la barra de estadísticas', async ({ page }) => {
        // La barra va fija abajo del todo y se pone por encima de lo que tenga
        // debajo: la última franja de los paneles se veía pero no se podía
        // pulsar, que es la peor clase de fallo.
        await cargarPo(page, PO_EJEMPLO);
        const { glosario, estadisticas } = await cajas(page);

        expect(glosario.abajo).toBeLessThanOrEqual(estadisticas.arriba);
    });

    test('el asistente es otra columna, entre el editor y la de consulta', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const antes = await cajas(page);

        await page.locator('#aiBtn').click();
        const despues = await cajas(page);

        // Ni tapa el editor ni tapa la consulta: se mete en medio y el editor
        // se estrecha.
        expect(despues.asistente.izq).toBeGreaterThanOrEqual(despues.editor.der);
        expect(despues.asistente.der).toBeLessThanOrEqual(despues.columna.izq);
        expect(despues.editor.ancho).toBeLessThan(antes.editor.ancho);
    });
});

test.describe('ajustar la columna', () => {
    test('el botón de la barra la esconde y la devuelve', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const conColumna = (await cajas(page)).editor.ancho;

        await page.locator('#panelesBtn').click();
        await expect(page.locator('#panelesDerecha')).toBeHidden();
        expect((await cajas(page)).editor.ancho).toBeGreaterThan(conColumna);

        await page.locator('#panelesBtn').click();
        await expect(page.locator('#panelesDerecha')).toBeVisible();
    });

    test('la raya de en medio reparte el alto, y se recuerda', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const antes = (await cajas(page)).memoria.alto;

        const raya = await page.locator('#tiradorReparto').boundingBox();
        await page.mouse.move(raya.x + raya.width / 2, raya.y + 5);
        await page.mouse.down();
        await page.mouse.move(raya.x + raya.width / 2, raya.y + 140, { steps: 8 });
        await page.mouse.up();

        expect((await cajas(page)).memoria.alto).toBeGreaterThan(antes + 60);
        const guardado = await page.evaluate(() =>
            localStorage.getItem('poanda_reparto_paneles'),
        );
        expect(Number(guardado)).toBeGreaterThan(1);
    });

    test('el borde izquierdo cambia el ancho, y se recuerda', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const antes = (await cajas(page)).columna.ancho;

        const tirador = await page.locator('#tiradorAncho').boundingBox();
        await page.mouse.move(tirador.x + 3, tirador.y + 100);
        await page.mouse.down();
        await page.mouse.move(tirador.x - 100, tirador.y + 100, { steps: 8 });
        await page.mouse.up();

        expect((await cajas(page)).columna.ancho).toBeGreaterThan(antes + 60);
        const guardado = await page.evaluate(() => localStorage.getItem('poanda_ancho_paneles'));
        expect(Number(guardado)).toBeGreaterThan(antes);
    });

    test('lo que se ajusta sigue ahí al volver', async ({ page }) => {
        // Volver a colocarlo todo cada mañana cansa.
        await page.evaluate(() => {
            localStorage.setItem('poanda_ancho_paneles', '480');
            localStorage.setItem('poanda_reparto_paneles', '1.5');
        });
        await page.reload();
        await cargarPo(page, PO_EJEMPLO);

        const { columna, memoria, glosario } = await cajas(page);
        expect(columna.ancho).toBe(480);
        expect(memoria.alto).toBeGreaterThan(glosario.alto);
    });

    test('la equis pliega el panel y le da el alto al otro', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        const antes = (await cajas(page)).glosario.alto;

        await page.locator('#closeTranslationMemorySidebarBtn').click();

        // El título de la memoria sigue a la vista: es lo que permite volver.
        await expect(page.locator('#tmSidebarTitle')).toBeVisible();
        await expect(page.locator('.translation-memory-sidebar .sidebar-content')).toBeHidden();
        expect((await cajas(page)).glosario.alto).toBeGreaterThan(antes);

        await page.locator('#closeTranslationMemorySidebarBtn').click();
        await expect(page.locator('.translation-memory-sidebar .sidebar-content')).toBeVisible();
    });
});

test.describe('los botones de cada panel', () => {
    test('importar y exportar son iconos con el nombre en el tooltip', async ({ page }) => {
        // Eran botones anchos que ocupaban una franja del alto del panel para
        // algo que se hace una vez al empezar y otra al acabar.
        await cargarPo(page, PO_EJEMPLO);

        // Y van en la misma fila que el título, no debajo.
        for (const id of ['importTmxBtn', 'downloadTmxBtn']) {
            const enLaCabecera = await page
                .locator(`#${id}`)
                .evaluate((el) => Boolean(el.closest('.sidebar-header')));
            expect(enLaCabecera).toBe(true);
        }

        for (const [id, titulo] of [
            ['importTmxBtn', /import/i],
            ['downloadTmxBtn', /download/i],
            ['importTbxBtn', /import/i],
            ['downloadTbxBtn', /download/i],
        ]) {
            const boton = page.locator(`#${id}`);
            await expect(boton).toBeVisible();
            await expect(boton).toHaveAttribute('title', titulo);
            // Un icono, no una palabra.
            await expect(boton).toHaveText('');
            await expect(boton.locator('svg')).toHaveCount(1);

            const caja = await boton.boundingBox();
            expect(caja.width).toBeLessThan(40);
        }
    });

    test('ya no hay "New TM" ni "New glossary"', async ({ page }) => {
        // La memoria y el glosario existen desde que se abre el archivo: lo que
        // hacían esos botones era vaciarlos, con nombre de crearlos.
        await cargarPo(page, PO_EJEMPLO);

        await expect(page.locator('#newTmBtn')).toHaveCount(0);
        await expect(page.locator('#newGlossaryBtn')).toHaveCount(0);
    });

    test('ya no está el botón de recolocar el panel', async ({ page }) => {
        // Recolocaba una ventana que se podía arrastrar. Ya no se arrastra nada.
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('.reset-panel-btn')).toHaveCount(0);
    });

    test('cada panel tiene una sola equis, no dos', async ({ page }) => {
        // El botón de plegar traía su equis en el HTML y encima se le inyectaba
        // otra al arrancar: salían las dos, una al lado de la otra.
        await cargarPo(page, PO_EJEMPLO);

        for (const id of ['closeTranslationMemorySidebarBtn', 'closeTerminologySidebarBtn']) {
            await expect(page.locator(`#${id} svg`)).toHaveCount(1);
        }
    });

    test('el título del panel no se come un renglón entero', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        const tamano = await page
            .locator('#tmSidebarTitle')
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(tamano).toBeLessThanOrEqual(14);

        // Título y botones caben en la misma fila.
        const cabecera = await page
            .locator('#translationMemorySidebar .sidebar-header')
            .boundingBox();
        expect(cabecera.height).toBeLessThan(40);
    });

    test('los iconos llevan borde, como los botones de la barra de arriba', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        const estilo = await page.locator('#downloadTmxBtn').evaluate((el) => {
            const c = getComputedStyle(el);
            return { borde: c.borderTopStyle, ancho: c.borderTopWidth };
        });
        expect(estilo.borde).toBe('solid');
        expect(parseFloat(estilo.ancho)).toBeGreaterThan(0);
    });
});

test.describe('un solo buscador para los dos paneles', () => {
    test('ya no hay un campo de búsqueda en cada panel', async ({ page }) => {
        // Eran dos campos con sus dos títulos buscando lo mismo: cuatro franjas
        // de una columna donde el sitio escasea.
        await cargarPo(page, PO_EJEMPLO);

        await expect(page.locator('#tmSearchInput')).toHaveCount(0);
        await expect(page.locator('#searchTerm')).toHaveCount(0);
        await expect(page.locator('#buscarPaneles')).toBeVisible();
    });

    test('filtra el glosario y la memoria a la vez', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        await anadirTermino(page, 'file', 'archivo');
        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        await page.locator('#validateBtn-2-0').click();

        // Una palabra que no está en ninguno de los dos.
        await page.locator('#buscarPaneles').fill('zzzz');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(0);
        await expect(page.locator('#tmResultadosLista .tm-tarjeta')).toHaveCount(0);

        // Y una que está en el glosario.
        await page.locator('#buscarPaneles').fill('file');
        await expect(page.locator('#glosarioLista .glosario-tarjeta')).toHaveCount(1);
    });

    test('el buscador va encima de los dos paneles', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        const buscador = await page.locator('#buscarPaneles').boundingBox();
        const memoria = await page.locator('.translation-memory-sidebar').boundingBox();
        expect(buscador.y + buscador.height).toBeLessThanOrEqual(memoria.y + 1);
    });
});

test.describe('el aviso de que están vacíos', () => {
    test('es uno solo para las dos cosas, y las nombra a las dos', async ({ page }) => {
        // Decía "los dos empiezan vacíos", y para saber de qué dos hablaba
        // había que deducirlo. Nombra la memoria y el glosario, y dice de cada
        // uno con qué se llena: quien abre Poanda por primera vez no tiene por
        // qué saber qué es una memoria de traducción.
        await cargarPo(page, PO_EJEMPLO);

        const aviso = page.locator('#panelesAviso');
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText(/translation memory/i);
        await expect(aviso).toContainText(/glossary/i);
        await expect(aviso).toContainText(/validate/i);
        await expect(aviso).not.toContainText(/^both/i);

        // Y los dos de antes, uno por panel, ya no están.
        await expect(page.locator('#memoriaVacia')).toHaveCount(0);
        await expect(page.locator('#glosarioVacio')).toHaveCount(0);
    });

    test('lo dice el panda desde el pie de la columna', async ({ page }) => {
        // Estaba arriba, entre el buscador y la memoria: justo donde se mira
        // para trabajar. Abajo no le quita el sitio a nada.
        await cargarPo(page, PO_EJEMPLO);

        const [aviso, memoria, glosario, columna] = await Promise.all([
            page.locator('#panelesAviso').boundingBox(),
            page.locator('.translation-memory-sidebar').boundingBox(),
            page.locator('.terminology-sidebar').boundingBox(),
            page.locator('#panelesDerecha').boundingBox(),
        ]);

        expect(aviso.y).toBeGreaterThan(memoria.y + memoria.height - 1);
        expect(aviso.y).toBeGreaterThan(glosario.y);
        // Dentro de la columna, no colgando por fuera.
        expect(aviso.x).toBeGreaterThanOrEqual(columna.x - 1);

        // Y va con su panda.
        const panda = page.locator('.paneles-aviso-panda');
        await expect(panda).toBeVisible();
        const dibujo = await panda.boundingBox();
        expect(dibujo.y).toBeGreaterThan(aviso.y);
        expect(dibujo.width).toBeGreaterThan(0);
    });

    test('va debajo de los paneles, no dentro de ninguno', async ({ page }) => {
        // Ni encima del glosario ni metido en él: es un aviso de las dos cosas,
        // así que su sitio es al pie de la columna, después de las dos.
        await cargarPo(page, PO_EJEMPLO);

        const [aviso, glosario] = await Promise.all([
            page.locator('#panelesAviso').boundingBox(),
            page.locator('.terminology-sidebar').boundingBox(),
        ]);
        expect(aviso.y).toBeGreaterThanOrEqual(glosario.y + glosario.height - 1);

        // Y al cerrarlo, el sitio que ocupaba se lo quedan los paneles.
        const antes = (await cajas(page)).glosario.alto;
        await page.locator('#panelesAvisoCerrar').click();
        await expect(page.locator('#panelesAviso')).toBeHidden();
        expect((await cajas(page)).glosario.alto).toBeGreaterThan(antes);
    });

    test('el panda es pequeño y va a la izquierda del bocadillo', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        const [panda, bocadillo] = await Promise.all([
            page.locator('.paneles-aviso-panda').boundingBox(),
            page.locator('.paneles-aviso-bocadillo').boundingBox(),
        ]);

        expect(panda.x + panda.width).toBeLessThanOrEqual(bocadillo.x + 1);
        // Pequeño: es un adorno, no la mitad de la franja.
        expect(panda.width).toBeLessThan(70);
    });

    test('el texto se lee: no es el gris de los bordes', async ({ page }) => {
        // El fallo de antes: el aviso usaba --color-medium-gray como color de
        // letra, que en modo claro es #e5e7eb —un gris de bordes, casi blanco—
        // sobre un fondo claro. Se comprueba contra el color de un texto que
        // sí se lee, no contra un valor escrito a mano.
        await cargarPo(page, PO_EJEMPLO);

        const [aviso, referencia] = await Promise.all([
            page
                .locator('#panelesAviso p')
                .evaluate((el) => getComputedStyle(el).color),
            page.locator('#tmSidebarTitle').evaluate((el) => getComputedStyle(el).color),
        ]);
        expect(aviso).toBe(referencia);
    });

    test('se puede cerrar y no vuelve', async ({ page }) => {
        // Quien ya sabe cómo funciona esto no necesita que se lo repitan
        // ocupando sitio.
        await cargarPo(page, PO_EJEMPLO);
        await page.locator('#panelesAvisoCerrar').click();
        await expect(page.locator('#panelesAviso')).toBeHidden();

        await page.reload();
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('#panelesAviso')).toBeHidden();
    });

    test('se va solo en cuanto hay algo en el glosario', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('#panelesAviso')).toBeVisible();

        await anadirTermino(page, 'file', 'archivo');

        await expect(page.locator('#panelesAviso')).toBeHidden();
    });
});

test.describe('las listas solo salen cuando tienen algo que enseñar', () => {
    test('la de la memoria está fuera hasta que hay coincidencias o se busca', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('#tmResultados')).toBeHidden();

        // Buscar algo la saca, aunque sea para decir que no hay nada.
        await page.locator('#msgstr-2-0').fill('Guardar cambios');
        await page.locator('#validateBtn-2-0').click();
        await page.locator('#buscarPaneles').fill('cambios');

        await expect(page.locator('#tmResultados')).toBeVisible();
    });

    test('la del glosario está fuera hasta que hay términos', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);
        await expect(page.locator('#glosarioResultados')).toBeHidden();

        await anadirTermino(page, 'file', 'archivo');

        await expect(page.locator('#glosarioResultados')).toBeVisible();
    });
});

test.describe('iconos en vez de rótulos', () => {
    test('el buscador lleva una lupa dentro, sin robarle sitio al texto', async ({
        page,
    }) => {
        await cargarPo(page, PO_EJEMPLO);

        const lupa = page.locator('.paneles-buscador-lupa svg');
        await expect(lupa).toBeVisible();

        // Dentro del campo, no al lado: la lupa cae sobre el hueco que deja el
        // relleno de la izquierda.
        const [campo, dibujo] = await Promise.all([
            page.locator('#buscarPaneles').boundingBox(),
            lupa.boundingBox(),
        ]);
        expect(dibujo.x).toBeGreaterThan(campo.x);
        expect(dibujo.x + dibujo.width).toBeLessThan(campo.x + campo.width);

        // Y no se come lo que se escribe: el texto empieza después de la lupa.
        const relleno = await page
            .locator('#buscarPaneles')
            .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
        expect(campo.x + relleno).toBeGreaterThanOrEqual(dibujo.x + dibujo.width - 1);
    });

    test('la lupa no se traga los clics del campo', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        // Pulsar donde está el dibujo tiene que caer en el campo: la lupa es un
        // adorno, y un adorno que se come el clic hace que el campo parezca
        // roto justo por donde más se pulsa.
        const dibujo = await page.locator('.paneles-buscador-lupa').boundingBox();
        await page.mouse.click(dibujo.x + dibujo.width / 2, dibujo.y + dibujo.height / 2);
        await expect(page.locator('#buscarPaneles')).toBeFocused();
    });

    test('el par de idiomas es un globo, no la frase entera', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        for (const id of ['memoriaParIdiomas', 'glosarioParIdiomas']) {
            const boton = page.locator(`#${id}`);
            await expect(boton.locator('.par-del-proyecto-icono svg')).toBeVisible();
            // El rótulo "Idiomas de este proyecto:" se fue al tooltip.
            await expect(boton).not.toContainText(/Languages of this project:/i);
            await expect(boton).toHaveAttribute('title', /languages of this project/i);
            // El dato sigue estando.
            await expect(boton.locator('.par-del-proyecto-texto')).toContainText(/English/i);
        }
    });

    test('pulsar el globo abre el cuadro de idiomas', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        await page.locator('#memoriaParIdiomas').click();
        await expect(page.locator('#idiomasModal')).toBeVisible();
    });
});

test.describe('añadir un término solo cuando hace falta', () => {
    test('el panel no gasta sitio en un formulario que se usa a ratos', async ({ page }) => {
        // La ficha de un término tiene cinco campos y se rellena en su propio
        // cuadro (e2e/glosario.spec.js). Lo que se comprueba aquí es que el
        // panel no guarda hueco para ella: en media columna, ese hueco son
        // términos que dejan de verse.
        await cargarPo(page, PO_EJEMPLO);

        await expect(page.locator('#terminoModal')).toBeHidden();
        await expect(page.locator('#terminologySidebar input[type="text"]')).toHaveCount(0);

        await page.locator('#addTermToggleBtn').click();
        await expect(page.locator('#terminoModal')).toBeVisible();
    });

    test('su botón está con los de importar y exportar', async ({ page }) => {
        await cargarPo(page, PO_EJEMPLO);

        await expect(
            page.locator('#terminologySidebar .panel-acciones #addTermToggleBtn')
        ).toBeVisible();
        await expect(page.locator('#addTermToggleBtn svg')).toHaveCount(1);

        // A la misma altura que el título del panel, no a media columna.
        const [boton, titulo] = await Promise.all([
            page.locator('#addTermToggleBtn').boundingBox(),
            page.locator('#terminologySidebarTitle').boundingBox(),
        ]);
        expect(Math.abs(boton.y - titulo.y)).toBeLessThan(20);
    });
});
