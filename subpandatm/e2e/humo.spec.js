/**
 * Prueba de humo: que subpandaTM sigue en pie.
 *
 * No comprueba funciones concretas, es una red de seguridad. Lo que mira es lo
 * mínimo que tiene que ser cierto para que la herramienta sirva de algo: que
 * carga sin errores, que un SRT entra y se ve, y que se puede traducir.
 *
 * El refactor a módulos es justo el momento en el que estas pruebas más valen:
 * un error de importación deja la página en blanco sin decir nada.
 */
import { test, expect, cargarSrt, traducir } from './apoyo.js';

test.describe('subpandaTM arranca', () => {
    test('la página carga sin errores de JavaScript', async ({ page }) => {
        const errores = [];
        page.on('pageerror', (e) => errores.push(e.message));
        page.on('console', (m) => {
            if (m.type() !== 'error') return;
            // El navegador pide el icono de la pestaña por su cuenta y no pasa
            // por las rutas interceptadas. No dice nada de la herramienta.
            if (m.location().url.endsWith('/favicon.ico')) return;
            errores.push(m.text());
        });

        await page.reload();
        await page.waitForTimeout(1500);

        expect(errores).toEqual([]);
    });

    test('un SRT entra y se ve', async ({ page }) => {
        await cargarSrt(page);

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(3);
        await expect(page.locator('#translationsContainer')).toContainText('Hello world');
        await expect(page.locator('#translationsContainer')).toContainText('Goodbye');
    });

    test('los tiempos se ven junto a su subtítulo, y se pueden editar', async ({ page }) => {
        // Son campos, no texto: en un editor de subtítulos los tiempos se
        // ajustan tanto como el texto.
        await cargarSrt(page);

        await expect(page.locator('#startTime-0')).toHaveValue('00:00:01,000');
        await expect(page.locator('#endTime-1')).toHaveValue('00:00:06,500');
    });

    test('se puede escribir una traducción y se queda', async ({ page }) => {
        await cargarSrt(page);
        await traducir(page, 0, 'Hola mundo');

        await expect(page.locator('#translation-0')).toHaveText('Hola mundo');
    });

});

test.describe('el idioma', () => {
    test('arranca en inglés, como el resto de PandaTools', async ({ page }) => {
        // El botón del selector dice qué idioma está puesto, y dentro se marca
        // el activo con una palomita.
        await expect(page.locator('#langActual')).toHaveText('English');
        await expect(page.locator('#langEnBtn')).toHaveClass(/active-lang/);
        await expect(page.locator('#initialMessage')).toContainText('Import a subtitle file');
    });

    test('se puede cambiar a español', async ({ page }) => {
        await page.locator('#langBtn').click();
        await page.locator('#langEsBtn').click();

        await expect(page.locator('#langActual')).toHaveText('Español');
        await expect(page.locator('#langEsBtn')).toHaveClass(/active-lang/);
        await expect(page.locator('#initialMessage')).toContainText('Importa unos subtítulos');
    });

    test('el botón de versión abre el changelog', async ({ page }) => {
        await page.locator('#versionToggle').click();

        await expect(page.locator('#changelogModal')).toBeVisible();
        // Y trae el historial de verdad, no un mensaje de error.
        await expect(page.locator('#changelogContent')).toContainText('subpandaTM v');
        await page.locator('#changelogCloseBtn').click();
        await expect(page.locator('#changelogModal')).toBeHidden();
    });

    test('importar y exportar están los dos en el menú Archivo', async ({ page }) => {
        // Antes había un menú Importar y un botón suelto de exportar: para
        // saber dónde estaba cada cosa había que abrir los dos.
        const menu = page.locator('#fileBtn').locator('xpath=..').locator('.dropdown-content');
        await expect(menu.locator('#srtFile')).toHaveCount(1);
        await expect(menu.locator('#saveSrt')).toHaveCount(1);
        await expect(menu.locator('#videoFileMenuInput')).toHaveCount(1);
        await expect(menu.locator('#backupBtn')).toHaveCount(1);
    });

    test('lo del proyecto va en su propio menú, como en Poanda', async ({ page }) => {
        // El proyecto es el encargo entero guardado en un .subpanda; Archivo es
        // lo que entra y sale suelto. Mezclados obligaban a leer el menú entero
        // para distinguir "guardar el proyecto" de "exportar los subtítulos".
        const proyecto = page.locator('#projectBtn').locator('xpath=..').locator('.dropdown-content');
        await expect(proyecto.locator('#newProjectBtn')).toHaveCount(1);
        await expect(proyecto.locator('#projectFile')).toHaveCount(1);
        await expect(proyecto.locator('#saveProjectBtn')).toHaveCount(1);

        // Y Proyecto va antes que Archivo, como allí.
        const x = async (sel) => (await page.locator(sel).boundingBox()).x;
        expect(await x('#projectBtn')).toBeLessThan(await x('#fileBtn'));
    });

    test('el botón de los paneles se llama como en Poanda', async ({ page }) => {
        await expect(page.locator('#panelesBtn')).toHaveText('TM and Glossary');
    });

    test('la bienvenida la da el panda en un bocadillo', async ({ page }) => {
        // Antes era un recuadro gris con la letra gris: era lo primero que se
        // veía al entrar y costaba leerlo.
        await expect(page.locator('#initialMessage .bienvenida-panda')).toBeVisible();
        await expect(page.locator('#initialMessage .bienvenida-bocadillo')).toBeVisible();
    });

    test('el bocadillo es también donde se suelta el archivo', async ({ page }) => {
        // La zona de arrastre está justo donde se lee qué hay que hacer, y no
        // en otro sitio de la pantalla.
        const zona = page.locator('#zonaSoltar');
        await expect(zona).toBeVisible();
        await expect(zona).toContainText('Drop your subtitles here');
        // Y pulsarla abre el selector de archivos.
        await expect(page.locator('#srtFileBienvenida')).toHaveCount(1);
        expect(await zona.getAttribute('for')).toBe('srtFileBienvenida');
    });
});

test.describe('la portada', () => {
    test('sin archivo abierto no hay columna de vídeo, solo el panda', async ({ page }) => {
        // Un reproductor vacío no sirve de nada y se comía un tercio del ancho
        // justo cuando lo único que hay que hacer es soltar un archivo.
        await expect(page.locator('.video-player-section')).toBeHidden();
        await expect(page.locator('#initialMessage .bienvenida-panda')).toBeVisible();
    });

    test('el logotipo va en la barra, no dentro del reproductor', async ({ page }) => {
        const logo = page.locator('#logoBarra');
        await expect(logo).toBeVisible();
        // A la izquierda del todo, antes que los menús.
        const caja = await logo.boundingBox();
        const archivo = await page.locator('#fileBtn').boundingBox();
        expect(caja.x).toBeLessThan(archivo.x);
    });
});

test.describe('la columna del vídeo', () => {
    test('con el SRT abierto, el panda pide el vídeo', async ({ page }) => {
        // Antes había ahí un logotipo suelto, que ni decía qué hacer ni servía
        // para hacerlo: el vídeo se cargaba desde una barra que solo salía al
        // pasar el ratón por encima del reproductor.
        await cargarSrt(page);

        const zona = page.locator('#videoLogoPlaceholder');
        await expect(zona).toBeVisible();
        await expect(zona).toContainText('load the video');
        // Y pulsarla abre el selector de archivos.
        expect(await zona.getAttribute('for')).toBe('videoFileInput');
    });

    test('el tamaño del subtítulo va del 1 al 10, y entra por el 3', async ({ page }) => {
        // Iba en píxeles, de dos en dos, desde 10 hasta 60: la cifra en píxeles
        // no dice nada sin ver el vídeo, y el mínimo seguía siendo grande.
        await cargarSrt(page);

        await page.locator('#fontSizeBtn').click();
        await expect(page.locator('#fontSizeDisplay')).toHaveText('3');

        const letra = () =>
            page.evaluate(() =>
                getComputedStyle(document.documentElement).getPropertyValue('--user-font-size'),
            );
        const dePartida = await letra();

        await page.locator('#fontSizeRange').fill('1');
        await expect(page.locator('#fontSizeDisplay')).toHaveText('1');
        const conUno = await letra();

        await page.locator('#fontSizeRange').fill('10');
        await expect(page.locator('#fontSizeDisplay')).toHaveText('10');
        const conDiez = await letra();

        // Y el 1 es de verdad pequeño, y el 10 de verdad grande.
        expect(parseFloat(conUno)).toBeLessThan(parseFloat(dePartida));
        expect(parseFloat(conDiez)).toBeGreaterThan(parseFloat(dePartida) * 3);
    });

    test('todos los botones de las dos botoneras son el mismo cuadrado', async ({ page }) => {
        // Cada uno medía lo que midiera su contenido —un icono, un signo, un
        // desplegable con su texto— y la fila era una escalera.
        await cargarSrt(page);
        await page.locator('#ondaBloque').evaluate((el) => el.classList.remove('hidden'));
        await page.locator('#waveformControls').evaluate((el) => el.classList.remove('hidden'));

        const botones = page.locator('#videoControlsBar .btn, #waveformControls .btn');
        const cuantos = await botones.count();
        expect(cuantos).toBeGreaterThan(8);
        for (let i = 0; i < cuantos; i++) {
            const caja = await botones.nth(i).boundingBox();
            expect(Math.round(caja.width)).toBe(32);
            expect(Math.round(caja.height)).toBe(32);
        }
    });

    test('el campo vacío dice qué va ahí', async ({ page }) => {
        // Un recuadro en blanco al lado del original no dice si es que falta
        // traducirlo o es que el subtítulo no lleva texto.
        await cargarSrt(page);

        const campo = page.locator('#translation-0');
        await expect(campo).toHaveAttribute('data-placeholder', /Type your translation here/);
        await expect(campo).toBeEmpty();

        // Y se va con la primera letra: es :empty, no un texto que borrar.
        await campo.click();
        await page.keyboard.type('Hola');
        await expect(campo).not.toBeEmpty();
    });

    test('la alineación del editor se elige y se recuerda', async ({ page }) => {
        // Un subtítulo se lee centrado en pantalla, y hay quien quiere verlo
        // así también mientras lo traduce.
        await cargarSrt(page);

        await page.locator('#toolsBtn').hover();
        await page.locator('#settingsBtn').click();
        await expect(page.locator('#timecodeModal')).toBeVisible();

        // De partida los dos van centrados; se cambia solo el original.
        await page.locator('#alinearOriginal .ajustes-opcion[data-alinear="left"]').click();
        await expect(page.locator('#original-pre-0')).toHaveCSS('text-align', 'left');
        // La traducción no se toca: son dos elecciones distintas.
        await expect(page.locator('#translation-0')).toHaveCSS('text-align', 'center');

        await page.locator('#ajustesCerrarBtn').click();
        await expect(page.locator('#timecodeModal')).toBeHidden();

        // Y se recuerda de una vez a otra: es de cómo trabaja cada uno.
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-alinear-original', 'left');
    });

    test('los botones de la barra encienden y apagan su pestaña', async ({ page }) => {
        // El de la memoria abría y cerraba; los otros dos solo abrían, así que
        // para quitarlos de en medio había que ir a buscar un tercer botón.
        await cargarSrt(page);

        // De partida se ve la memoria, y su botón está encendido.
        await expect(page.locator('#panelesBtn')).toHaveClass(/active/);
        await expect(page.locator('#aiBtn')).not.toHaveClass(/active/);

        await page.locator('#aiBtn').click();
        await expect(page.locator('#aiSidebar')).toBeVisible();
        await expect(page.locator('#aiBtn')).toHaveClass(/active/);
        await expect(page.locator('#panelesBtn')).not.toHaveClass(/active/);

        // Volver a pulsarlo cierra la columna entera.
        await page.locator('#aiBtn').click();
        await expect(page.locator('#panelesDerecha')).toBeHidden();
        await expect(page.locator('#aiBtn')).not.toHaveClass(/active/);

        // Y la equis de la columna hace lo mismo desde dentro.
        await page.locator('#qaBtn').click();
        await expect(page.locator('#qaContainer')).toBeVisible();
        await page.locator('#cerrarPanelesBtn').click();
        await expect(page.locator('#panelesDerecha')).toBeHidden();
        await expect(page.locator('#qaBtn')).not.toHaveClass(/active/);
    });

    test('los límites de QA viven en su pestaña y se aplican al escribirlos', async ({ page }) => {
        // Eran un cuadro encima de todo con dos campos y un botón de guardar:
        // para volver a mirar cuál era el límite había que abrirlo otra vez.
        await cargarSrt(page);

        await page.locator('#qaBtn').click();
        const pestanas = page.locator('.panel-pestana');
        await expect(pestanas.nth(2)).toHaveAttribute('data-pestana', 'qa');
        await expect(pestanas.nth(3)).toHaveAttribute('data-pestana', 'planificador');

        await expect(page.locator('#qaCpsLimit')).toHaveValue('20');
        // Con el límite por los suelos, el original de tres palabras ya se pasa.
        await page.locator('#qaCpsLimit').fill('2');
        await expect(page.locator('#origCps-0')).toHaveClass(/qa-error/);
    });

    test('los proyectos recientes listan lo abierto y se puede volver', async ({ page }) => {
        // Volver al encargo de ayer no es un rescate de emergencia: es lo que se
        // hace cada mañana, y estaba escondido en el cuadro de copia de
        // seguridad.
        await cargarSrt(page, undefined, 'encargo.srt');
        await traducir(page, 0, 'Hola mundo');

        await page.locator('#projectBtn').hover();
        await page.locator('#recentProjectsBtn').click();

        const fila = page.locator('#recentProjectsModal .reciente').first();
        await expect(fila).toBeVisible();
        await expect(fila.locator('.reciente-nombre')).toHaveText('encargo.srt');
        // El avance de verdad: uno de tres traducidos.
        await expect(fila.locator('.reciente-meta')).toContainText('1/3');
        await expect(fila.locator('.reciente-meta')).toContainText('en → es');

        await page.locator('#recentProjectsCloseBtn').click();
        await expect(page.locator('#recentProjectsModal')).toBeHidden();
    });

    test('el original lleva su barra de velocidad de lectura, como la traducción', async ({ page }) => {
        // Sin la del original al lado no hay con qué comparar: saber que el
        // original ya iba justo cambia lo que se decide al recortar.
        await cargarSrt(page);

        // Las dos columnas llevan la suya. La de la traducción está a cero
        // mientras el campo está vacío, así que se cuenta, no se mira.
        // Una en cada columna de la tarjeta. La de la traducción está a cero
        // mientras el campo está vacío, así que se cuenta, no se mira.
        const original = page.locator('#origCpsBar-0Fill');
        await expect(
            page.locator('#translation-unit-0 .cps-bar-container'),
        ).toHaveCount(2);
        await expect(page.locator('#cpsBar-0Fill')).toHaveCount(1);

        // El primer subtítulo son 11 caracteres en 2 s: 5,5 CPS de 20, sin
        // pasarse. La barra tiene algo pintado y no está en rojo.
        await expect(original).not.toHaveClass(/cps-bar-alta/);
        expect(await original.evaluate((el) => parseFloat(el.style.width))).toBeGreaterThan(0);

        // Con el límite por los suelos, la del original se pone en rojo.
        await page.locator('#qaBtn').click();
        await page.locator('#qaCpsLimit').fill('2');
        await expect(original).toHaveClass(/cps-bar-alta/);
    });

    test('lo que se pasa del límite por línea se enciende en rojo', async ({ page }) => {
        // La cifra del margen dice cuántos caracteres sobran; esto dice cuáles.
        await cargarSrt(page);
        await traducir(page, 0, 'Una línea bastante larga que se pasa del límite');

        // Con el límite de fábrica, 42, sobran los últimos caracteres.
        const sobra = page.locator('#lineCharCounts-0 .segmento-linea-sobra');
        await expect(sobra).toHaveCount(1);
        // El carácter 42 es el último que cabe; de ahí en adelante, en rojo.
        await expect(sobra).toHaveText('ímite');

        // Y con el límite subido, ya no sobra nada.
        await page.locator('#qaBtn').click();
        await page.locator('#qaCharsPerLineLimit').fill('80');
        await expect(page.locator('#lineCharCounts-0 .segmento-linea-sobra')).toHaveCount(0);
    });

    test('el texto del editor entra centrado', async ({ page }) => {
        // Un subtítulo se lee centrado en pantalla, así que verlo centrado
        // mientras se traduce es verlo como se va a ver.
        await cargarSrt(page);
        await expect(page.locator('#translation-0')).toHaveCSS('text-align', 'center');
        await expect(page.locator('#original-pre-0')).toHaveCSS('text-align', 'center');
    });

    test('el campo vacío mide lo que mide su original', async ({ page }) => {
        // Con un subtítulo de dos líneas al lado, un hueco de una sola dejaba la
        // tarjeta coja.
        await cargarSrt(page);

        const unaLinea = await page.locator('#translation-0').boundingBox();
        const dosLineas = await page.locator('#translation-1').boundingBox();
        expect(dosLineas.height).toBeGreaterThan(unaLinea.height * 1.6);
    });

    test('los botones de la tarjeta llevan su recuadro', async ({ page }) => {
        // Eran iconos sueltos sobre el fondo de la tarjeta: no se veía dónde
        // empezaba y acababa cada botón, ni que fueran botones.
        await cargarSrt(page);

        const botones = page.locator('#translation-unit-0 .segmento-icono');
        // La lista se pinta por tandas: esperar a que haya botones evita medir
        // una tarjeta a medio hacer.
        await botones.first().waitFor();
        const cuantos = await botones.count();
        expect(cuantos).toBeGreaterThan(5);
        for (let i = 0; i < cuantos; i++) {
            const caja = await botones.nth(i).evaluate((el) => {
                const e = getComputedStyle(el);
                return { borde: e.borderTopWidth, alto: el.getBoundingClientRect().height };
            });
            expect(caja.borde).toBe('1px');
            expect(Math.round(caja.alto)).toBe(24);
        }
    });

    test('el play primero, y detrás los dos saltos de un segundo', async ({ page }) => {
        // El play es el que más se pulsa y el que se busca sin mirar.
        await cargarSrt(page);
        await expect(page.locator('#seekBackBtn')).toBeVisible();
        await expect(page.locator('#seekForwardBtn')).toBeVisible();

        const x = async (sel) => (await page.locator(sel).boundingBox()).x;
        expect(await x('#seekBackBtn')).toBeGreaterThan(await x('#playPauseBtn'));
        expect(await x('#seekForwardBtn')).toBeGreaterThan(await x('#seekBackBtn'));
    });

    test('ya no hay un botón suelto de cargar vídeo', async ({ page }) => {
        // El vídeo se carga desde el panda del reproductor y desde el menú
        // Archivo: un tercer sitio para lo mismo solo ocupaba un botón.
        await cargarSrt(page);
        await expect(page.locator('#videoControlsBar label')).toHaveCount(0);
    });

    test('los controles van debajo del reproductor, no encima', async ({ page }) => {
        // Eran una barra negra que solo aparecía al pasar el ratón por encima
        // del vídeo: tapaba la imagen y había que descubrirla. Ahora es una
        // botonera fija, con el mismo diseño que la de la onda.
        await cargarSrt(page);

        const video = await page.locator('#videoPlayerWrapper').boundingBox();
        const botones = await page.locator('#videoControlsBar').boundingBox();
        expect(botones.y).toBeGreaterThanOrEqual(video.y + video.height - 2);
        await expect(page.locator('#videoControlsBar')).toBeVisible();
    });

    test('el bloque de la onda llega hasta abajo de la columna', async ({ page }) => {
        // La columna se encogía hasta lo que midiera su contenido y debajo de la
        // onda quedaba un hueco gris que crecía con la ventana.
        await cargarSrt(page);
        await page.locator('#ondaBloque').evaluate((el) => el.classList.remove('hidden'));

        const columna = await page.locator('.video-player-section').boundingBox();
        const onda = await page.locator('#ondaBloque').boundingBox();
        const sobra = columna.y + columna.height - (onda.y + onda.height);
        // Lo que quede por debajo es el relleno de la columna, no un hueco.
        expect(sobra).toBeLessThan(24);
    });
});

test.describe('el planificador', () => {
    test('la lista de sesiones no se corta a los cuatro elementos', async ({ page }) => {
        // Tenía un tope de 250 píxeles heredado de cuando era un acordeón
        // debajo del vídeo: con más de cuatro sesiones salía una barra de
        // desplazamiento al lado y el resto quedaba escondido.
        const muchos = Array.from({ length: 120 }, (_, i) => {
            const s = String(i + 1).padStart(2, '0');
            return `${i + 1}\n00:00:${s},000 --> 00:00:${s},900\nLine number ${i + 1}\n`;
        }).join('\n');
        await cargarSrt(page, muchos, 'largo.srt');

        await page.locator('.panel-pestana[data-pestana="planificador"]').click();
        await page.locator('#sessionCount').fill('8');
        await page.locator('#calculateSessionsBtn').click();

        // Ocho sesiones más la fila de revisión.
        await expect(page.locator('#sessionResults > *')).toHaveCount(9);

        // La lista se lleva el alto que queda en la pestaña, hasta abajo del
        // todo. Con el tope de 250 píxeles se quedaba en esa cifra clavada
        // aunque hubiera columna de sobra debajo.
        const lista = await page.locator('#sessionResults').boundingBox();
        const columna = await page.locator('#panelesDerecha').boundingBox();
        expect(lista.height).toBeGreaterThan(250);
        // Lo único que queda por debajo es el hueco que la columna reserva para
        // la barra de estadísticas, que va fija al pie de la ventana.
        expect(columna.y + columna.height - (lista.y + lista.height)).toBeLessThan(60);
    });
});

test.describe('la columna de consulta', () => {
    test('no se estira con la lista de subtítulos', async ({ page }) => {
        // Con un archivo largo, la memoria se estiraba hasta ocupar media
        // página y el glosario quedaba al final del todo, a un scroll de
        // distancia de donde se está trabajando.
        const muchos = Array.from({ length: 120 }, (_, i) => {
            const s = String(i + 1).padStart(2, '0');
            return `${i + 1}\n00:00:${s},000 --> 00:00:${s},900\nLine number ${i + 1}\n`;
        }).join('\n');
        await cargarSrt(page, muchos, 'largo.srt');

        const ventana = page.viewportSize().height;
        for (const id of ['#translationMemorySidebar', '#terminologySidebar']) {
            const caja = await page.locator(id).boundingBox();
            // Cada panel cabe en la ventana...
            expect(caja.height).toBeLessThan(ventana);
            // ...y el de abajo empieza dentro de ella, no más allá.
            expect(caja.y).toBeLessThan(ventana);
        }
        // Y la página no se desplaza: lo que se desplaza es la lista.
        const desbordada = await page.evaluate(
            () => document.body.scrollHeight > window.innerHeight + 2,
        );
        expect(desbordada).toBe(false);
    });
});
