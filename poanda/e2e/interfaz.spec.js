/**
 * Cambios de interfaz de la v1.4.0: el recuadro donde se sueltan archivos, el
 * menú Archivo reducido y la colocación de los controles.
 */
import {
    test,
    expect,
    abrirCopiasDeSeguridad,
    cambiarIdioma,
    cargarArchivo,
    cargarPo,
    responderIdiomas,
} from './apoyo.js';

test.describe('recuadro para soltar archivos', () => {
    test('se ve al entrar, con los formatos que acepta', async ({ page }) => {
        const zona = page.locator('#initialMessage.zona-soltar');
        await expect(zona).toBeVisible();

        // La lista sale de la tabla de formatos, así que crece sola al añadir
        // uno. Se comprueba que estén los que tiene que haber y que .poanda,
        // que es el proyecto guardado y no un formato de traducción, vaya al
        // final y con su propia marca.
        const formatos = await zona.locator('.formato').allTextContents();
        expect(formatos).toEqual(expect.arrayContaining(['.po', '.json', '.html', '.poanda']));
        expect(formatos[formatos.length - 1]).toBe('.poanda');
        // .htm no se enseña aparte: es el mismo formato que .html.
        expect(formatos).not.toContain('.htm');
        await expect(zona).toContainText(/never leave your computer/i);
    });

    test('los formatos van agrupados por familias', async ({ page }) => {
        // Veintitantas extensiones seguidas no se leen. Agrupadas, quien busca
        // si puede abrir un .sdlxliff mira donde pone "traducción" y lo ve.
        const zona = page.locator('#initialMessage.zona-soltar');

        await expect(zona.locator('.formatos-familia')).toHaveCount(5);
        await expect(zona).toContainText('Documents');
        await expect(zona).toContainText('Bilingual');
        await expect(zona).toContainText('Apps and code');

        // Word está entre los documentos y Trados entre los bilingües.
        const documentos = zona.locator('.formatos-familia', { hasText: 'Documents' }).first();
        await expect(documentos.locator('.formato', { hasText: '.docx' })).toHaveCount(1);
    });

    test('cada formato dice qué es al pasar el ratón', async ({ page }) => {
        // ".arb" o ".wxl" no le dicen nada a quien no trabaje con eso, y son la
        // mitad de la lista.
        const zona = page.locator('#initialMessage.zona-soltar');

        await expect(zona.locator('.formato', { hasText: '.docx' })).toHaveAttribute(
            'title',
            /Word/,
        );
        await expect(zona.locator('.formato', { hasText: '.sdlxliff' })).toHaveAttribute(
            'title',
            /Trados/,
        );
        await expect(zona.locator('.formato-proyecto')).toHaveAttribute('title', /Poanda/);
    });

    test('desaparece al cargar un archivo', async ({ page }) => {
        await cargarPo(page);
        await expect(page.locator('#initialMessage')).toHaveCount(0);
    });

    test('vuelve a aparecer al empezar un proyecto nuevo', async ({ page }) => {
        await cargarPo(page);
        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        await expect(page.locator('#initialMessage.zona-soltar')).toBeVisible();
        // Los formatos que abre Poanda más el proyecto guardado.
        expect(await page.locator('.zona-soltar .formato').count()).toBeGreaterThanOrEqual(4);
    });

    test('acepta un archivo soltado encima', async ({ page }) => {
        // Se simula el arrastre creando un DataTransfer con el archivo dentro.
        await page.evaluate(async () => {
            const contenido = 'msgid "Cat"\nmsgstr "Gato"\n';
            const datos = new DataTransfer();
            datos.items.add(new File([contenido], 'soltado.po', { type: 'text/plain' }));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        // Al soltar un archivo, lo primero es decir de qué idioma a qué idioma.
        await responderIdiomas(page);

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(1);
        await expect(page.locator('body')).toContainText('Cat');
    });

    test('rechaza un formato que no entiende y lo dice', async ({ page }) => {
        await page.evaluate(async () => {
            const datos = new DataTransfer();
            // Un .psd de Photoshop: un formato que Poanda no abre ni pretende abrir.
            datos.items.add(new File(['cualquier cosa'], 'portada.psd'));
            document
                .getElementById('dropArea')
                .dispatchEvent(new DragEvent('drop', { dataTransfer: datos, bubbles: true }));
        });

        await expect(page.locator('#messageBox')).toBeVisible();
        await expect(page.locator('#messageText')).toContainText('.po');
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(0);
    });
});

test.describe('menú Archivo simplificado', () => {
    test('tiene una sola entrada para cargar y otra para guardar', async ({ page }) => {
        await page.locator('#fileBtn').click();
        await expect(page.locator('#loadFileBtn')).toBeVisible();
        await expect(page.locator('#saveFileBtn')).toBeVisible();
        // Las antiguas entradas por formato ya no existen.
        await expect(page.locator('#loadFilePoBtn')).toHaveCount(0);
        await expect(page.locator('#loadFileJsonBtn')).toHaveCount(0);
        await expect(page.locator('#saveFilePoBtn')).toHaveCount(0);
    });

    test('sin archivo, guardar está desactivado y convertir a .mo no se ve', async ({ page }) => {
        await page.locator('#fileBtn').click();
        await expect(page.locator('#saveFileBtn')).toHaveClass(/disabled-link/);
        await expect(page.locator('#convertFileMoBtn')).toBeHidden();
    });

    test('con un PO cargado aparece convertir a .mo', async ({ page }) => {
        await cargarPo(page);
        await page.locator('#fileBtn').click();
        await expect(page.locator('#convertFileMoBtn')).toBeVisible();
        await expect(page.locator('#saveFileBtn')).not.toHaveClass(/disabled-link/);
    });

    test('los botones grandes de cargar y guardar ya no están', async ({ page }) => {
        await expect(page.locator('#savePo')).toHaveCount(0);
        await expect(page.locator('#convertToMoButton')).toHaveCount(0);
    });

    test('las copias de seguridad viven dentro del menú Archivo', async ({ page }) => {
        // Ya no hay botón propio en la barra: es una entrada más del menú.
        await expect(page.locator('#backupBtn')).toBeHidden();

        await page.locator('#fileBtn').click();
        await expect(page.locator('#backupBtn')).toBeVisible();
        await page.locator('#backupBtn').click();
        await expect(page.locator('#backupModal')).toBeVisible();
    });

    test('el aviso de copia guardada va en la propia entrada de Backup', async ({ page }) => {
        const aviso = page.locator('#backupIndicator');
        await expect(aviso).toHaveCount(1);

        const dentroDeBackup = await aviso.evaluate((el) => el.closest('#backupBtn') !== null);
        expect(dentroDeBackup).toBe(true);
    });
});

test.describe('colocación de los controles', () => {
    test('idioma, tema y versión están a la derecha del asistente', async ({ page }) => {
        const derecha = page.locator('.top-utility-right');
        await expect(derecha).toBeVisible();

        const cajaAi = await page.locator('#aiBtn').boundingBox();
        const cajaDerecha = await derecha.boundingBox();
        expect(cajaDerecha.x).toBeGreaterThan(cajaAi.x + cajaAi.width);

        // Alineados con el borde derecho del panel, pero no pegados al filo:
        // la barra respeta el mismo margen blanco que el resto del contenido.
        const cajaPanel = await page.locator('#dropArea').boundingBox();
        const margen = cajaPanel.x + cajaPanel.width - (cajaDerecha.x + cajaDerecha.width);
        expect(margen).toBeGreaterThanOrEqual(16);
        expect(margen).toBeLessThan(60);
    });

    test('la barra superior no está pegada al borde de la ventana', async ({ page }) => {
        // La barra va posicionada de forma absoluta y no hereda el relleno del
        // panel: si nadie la separa, los controles quedan sobre el filo.
        const panel = await page.locator('#dropArea').boundingBox();
        const barra = await page.locator('.top-utility-buttons-container').boundingBox();

        expect(barra.y - panel.y).toBeGreaterThanOrEqual(16);
        expect(barra.x - panel.x).toBeGreaterThanOrEqual(16);
    });

    test('el contenido empieza arriba, no centrado verticalmente', async ({ page }) => {
        const caja = await page.locator('#dropArea').boundingBox();
        expect(caja.y).toBeLessThan(80);
    });

    test('el panel ocupa toda la pantalla, sin fondo gris alrededor', async ({ page }) => {
        const ventana = page.viewportSize();
        const panel = await page.locator('#dropArea').boundingBox();

        expect(panel.x).toBe(0);
        expect(panel.y).toBe(0);
        expect(panel.width).toBe(ventana.width);
        expect(panel.height).toBeGreaterThanOrEqual(ventana.height);
    });

    test('la descripción dice qué es Poanda y quién la hace', async ({ page }) => {
        await expect(page.locator('#toolDescription')).toContainText(/CAT tool/i);
        await expect(page.locator('#toolDescription')).toContainText(/pandas/i);

        await cambiarIdioma(page, 'es');
        await expect(page.locator('#toolDescription')).toContainText(/herramienta TAO/i);
    });
});

test.describe('selector de idioma', () => {
    test('es un desplegable con English y Español', async ({ page }) => {
        // Cerrado no enseña las opciones; es un menú, no dos botones sueltos.
        await expect(page.locator('#langEnBtn')).toBeHidden();

        await page.locator('#langBtn').click();
        await expect(page.locator('#langEnBtn')).toHaveText('English');
        await expect(page.locator('#langEsBtn')).toHaveText('Español');
    });

    test('el botón lleva el idioma puesto, sin iconos', async ({ page }) => {
        await expect(page.locator('#langActual')).toHaveText('English');
        await expect(page.locator('#langBtn')).toHaveText('English');

        await cambiarIdioma(page, 'es');
        await expect(page.locator('#langActual')).toHaveText('Español');
    });

    test('marca cuál es el idioma activo', async ({ page }) => {
        await page.locator('#langBtn').click();
        await expect(page.locator('#langEnBtn')).toHaveClass(/active-lang/);
        await expect(page.locator('#langEsBtn')).not.toHaveClass(/active-lang/);

        await cambiarIdioma(page, 'es');
        await page.locator('#langBtn').click();
        await expect(page.locator('#langEsBtn')).toHaveClass(/active-lang/);
        await expect(page.locator('#langEnBtn')).not.toHaveClass(/active-lang/);
    });

    test('idioma, tema y versión se ven iguales', async ({ page }) => {
        // Son tres controles del mismo rango: si cada uno tiene su forma, la
        // esquina parece un cajón de sastre. Se comparan las medidas que se
        // notan de lejos: alto, tamaño de letra, borde y esquinas.
        const medidas = await page
            .locator('#langBtn, #darkModeToggle, #versionToggle')
            .evaluateAll((controles) =>
                controles.map((c) => {
                    const e = getComputedStyle(c);
                    return [
                        Math.round(c.getBoundingClientRect().height),
                        e.fontSize,
                        e.borderRadius,
                        e.borderTopWidth,
                        e.paddingLeft,
                    ].join('|');
                }),
            );

        expect(medidas).toHaveLength(3);
        expect(new Set(medidas).size, `no coinciden: ${medidas.join(' / ')}`).toBe(1);
    });

    test('el botón del tema dice el modo al que lleva, con palabras', async ({ page }) => {
        const boton = page.locator('#darkModeToggle');
        await expect(boton).toHaveText('Dark mode');

        await boton.click();
        await expect(page.locator('body')).toHaveClass(/dark-mode/);
        await expect(boton).toHaveText('Light mode');

        // Y sigue el idioma de la interfaz.
        await cambiarIdioma(page, 'es');
        await expect(boton).toHaveText('Modo claro');
        await boton.click();
        await expect(boton).toHaveText('Modo oscuro');
    });

    test('en modo oscuro las barras de desplazamiento también se oscurecen', async ({ page }) => {
        // Las pinta el navegador, no la hoja de estilos: solo hacen caso a
        // color-scheme puesto en la raíz del documento. Sin esto la aplicación
        // quedaba en negro con una barra blanca a la derecha.
        const esquema = () =>
            page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

        expect(await esquema()).not.toBe('dark');

        await page.locator('#darkModeToggle').click();
        expect(await esquema()).toBe('dark');

        await page.locator('#darkModeToggle').click();
        expect(await esquema()).not.toBe('dark');
    });

    test('el modo elegido se recuerda con su texto al recargar', async ({ page }) => {
        await page.locator('#darkModeToggle').click();
        await page.reload();

        await expect(page.locator('body')).toHaveClass(/dark-mode/);
        await expect(page.locator('#darkModeToggle')).toHaveText('Light mode');
    });

    test('el menú se abre hacia dentro y no se sale de la ventana', async ({ page }) => {
        // Va pegado al borde derecho: si se abriera hacia la derecha, como los
        // menús de la izquierda, la mitad quedaría fuera de la pantalla.
        await page.locator('#langBtn').click();
        const menu = await page.locator('.selector-idioma .dropdown-content').boundingBox();
        expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize().width);
    });
});

test.describe('los logos en modo oscuro', () => {
    test('llevan sombra blanca para que el texto oscuro se lea', async ({ page }) => {
        // El logo tiene el texto en oscuro, pensado para fondo blanco: sobre el
        // fondo negro se perdía.
        await page.locator('#darkModeToggle').click();

        const sombra = await page
            .locator('#cabeceraGrande img')
            .evaluate((el) => getComputedStyle(el).filter);

        expect(sombra).toContain('drop-shadow');
        expect(sombra).toMatch(/rgba?\(255, 255, 255/);
    });

    test('en modo claro no llevan sombra ninguna', async ({ page }) => {
        const sombra = await page
            .locator('#cabeceraGrande img')
            .evaluate((el) => getComputedStyle(el).filter);

        expect(sombra).toBe('none');
    });

    test('el logo pequeño también, con un archivo abierto', async ({ page }) => {
        await cargarPo(page);
        await page.locator('#darkModeToggle').click();

        const sombra = await page
            .locator('#logoPequeno')
            .evaluate((el) => getComputedStyle(el).filter);

        expect(sombra).toContain('drop-shadow');
    });
});

test.describe('cabecera que se reduce al abrir un archivo', () => {
    test('pulsar el recuadro abre el selector de archivos', async ({ page }) => {
        const seleccion = page.waitForEvent('filechooser');
        await page.locator('#initialMessage').click();
        expect(await seleccion).toBeTruthy();
    });

    test('sin archivo se ve el logo grande y la descripción', async ({ page }) => {
        await expect(page.locator('#cabeceraGrande')).toBeVisible();
        await expect(page.locator('#toolDescription')).toBeVisible();
        await expect(page.locator('#logoPequeno')).toBeHidden();
    });

    test('con un archivo abierto la cabecera se reduce a la esquina', async ({ page }) => {
        await cargarPo(page);

        await expect(page.locator('#cabeceraGrande')).toBeHidden();
        await expect(page.locator('#logoPequeno')).toBeVisible();
    });

    test('el logo reducido queda arriba a la izquierda del panel', async ({ page }) => {
        await cargarPo(page);

        const panel = await page.locator('#dropArea').boundingBox();
        const logo = await page.locator('#logoPequeno').boundingBox();
        expect(logo.x - panel.x).toBeGreaterThanOrEqual(16);
        expect(logo.x - panel.x).toBeLessThan(60);
        expect(logo.y - panel.y).toBeLessThan(60);

        // Y se ve: es la única marca de dónde estás mientras se traduce, así que
        // tiene que leerse, no ser un sello diminuto en el rincón.
        expect(logo.height).toBeGreaterThanOrEqual(44);

        // Y no se mete debajo de los botones de herramientas.
        const primerBoton = await page.locator('#projectBtn').boundingBox();
        expect(logo.x + logo.width).toBeLessThan(primerBoton.x);
    });

    test('los botones de la barra siguen siendo pulsables con el editor lleno', async ({
        page,
    }) => {
        // La barra está posicionada de forma absoluta: si el editor sube
        // demasiado, se le mete por debajo y los botones dejan de responder.
        await cargarPo(page);

        for (const boton of ['#fileBtn', '#projectBtn', '#toolsBtn', '#aiBtn']) {
            const caja = await page.locator(boton).boundingBox();
            const enMedio = await page.evaluate(
                ({ x, y }) => {
                    const encima = document.elementFromPoint(x, y);
                    return encima ? encima.closest('button, .dropdown')?.id || encima.id : null;
                },
                { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 },
            );
            expect(enMedio, `algo tapa ${boton}`).not.toBeNull();
        }

        await abrirCopiasDeSeguridad(page);
        await expect(page.locator('#backupModal')).toBeVisible();
    });

    test('el editor gana altura al ocultarse la cabecera', async ({ page }) => {
        const antes = await page.locator('#mainEditorLayout').boundingBox();
        await cargarPo(page);
        const despues = await page.locator('#mainEditorLayout').boundingBox();

        // El editor empieza más arriba que antes: eso es el espacio recuperado.
        expect(despues.y).toBeLessThan(antes.y);
    });

    test('al empezar un proyecto nuevo vuelve la cabecera grande', async ({ page }) => {
        await cargarPo(page);
        await page.locator('#projectBtn').click();
        await page.locator('#newProjectBtn').click();
        await page.locator('#confirmModalOkBtn').click();

        await expect(page.locator('#cabeceraGrande')).toBeVisible();
        await expect(page.locator('#logoPequeno')).toBeHidden();
    });
});

test.describe('la barra de arriba manda sobre las columnas', () => {
    test('el menú de idioma se puede pulsar con los paneles abiertos', async ({ page }) => {
        // Los menús se pintaban DEBAJO de la columna de memoria y glosario: se
        // veían, pero el clic se lo quedaba la columna. Con un archivo abierto
        // no había manera de cambiar de idioma sin esconder los paneles.
        await cargarPo(page);
        await expect(page.locator('#panelesDerecha')).toBeVisible();

        await page.locator('#langBtn').click();
        const encima = await page.evaluate(() => {
            const menu = document.querySelector('.selector-idioma .dropdown-content');
            const r = menu.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return el ? el.id || el.tagName : null;
        });
        expect(encima).not.toBe('panelesDerecha');

        await page.locator('#langEsBtn').click();
        await expect(page.locator('#langActual')).toHaveText('Español');
    });

    test('los demás menús de la barra tampoco quedan tapados', async ({ page }) => {
        await cargarPo(page);

        for (const [boton, entrada] of [
            ['#fileBtn', '#loadFileBtn'],
            ['#toolsBtn', '#shortcutsBtn'],
            ['#projectBtn', '#recentProjectsBtn'],
        ]) {
            await page.locator(boton).click();
            const tapado = await page.locator(entrada).evaluate((el) => {
                const r = el.getBoundingClientRect();
                const encima = document.elementFromPoint(
                    r.left + r.width / 2,
                    r.top + r.height / 2,
                );
                return !el.contains(encima) && encima !== el;
            });
            expect(tapado, `${entrada} queda tapado`).toBe(false);
            await page.keyboard.press('Escape');
        }
    });
});

test.describe('convertir a .mo solo con un PO', () => {
    const entradaVisible = (page) =>
        page.locator('#convertFileMoBtn').evaluate((el) => !el.classList.contains('hidden'));

    test('sin archivo abierto no está', async ({ page }) => {
        expect(await entradaVisible(page)).toBe(false);
    });

    test('con un PO está, y con cualquier otro formato no', async ({ page }) => {
        await cargarPo(page);
        expect(await entradaVisible(page)).toBe(true);

        await cargarArchivo(page, { nombre: 'notas.txt', contenido: 'Una linea\nOtra linea' });
        await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();
        expect(await entradaVisible(page)).toBe(false);
    });

    test('el botón se niega aunque se llegue a él por otro camino', async ({ page }) => {
        // Esconder algo no es impedirlo: el botón solo miraba si había
        // segmentos, así que compilaba un .txt como si fuera un PO y salía un
        // .mo con basura dentro.
        await cargarArchivo(page, { nombre: 'notas.txt', contenido: 'Una linea\nOtra linea' });
        await expect(page.locator('[id^="translation-unit-"]').first()).toBeVisible();

        await page.locator('#convertFileMoBtn').evaluate((el) => {
            el.classList.remove('hidden');
            el.click();
        });

        await expect(page.locator('#convertToMoModal')).toBeHidden();
        await expect(page.locator('#messageBox')).toBeVisible();
        await expect(page.locator('#messageText')).toContainText(/only po files/i);
    });
});

test.describe('la interfaz en español está en español', () => {
    test('no queda ni una palabra suelta en inglés a la vista', async ({ page }) => {
        // La clase de fallo que esto caza no rompe nada y por eso se queda
        // meses: un "segments" en la barra de estado, un saludo del asistente
        // que se escribió al arrancar y no se rehace al cambiar de idioma.
        // Solo se mira la interfaz: el texto del archivo que se traduce está en
        // el idioma que esté, y ahí no manda Poanda.
        await cambiarIdioma(page, 'es');
        await cargarPo(page);
        await page.locator('#toolsBtn').click();
        await page.locator('#statsBtn').click();
        await page.locator('#aiBtn').click();
        await expect(page.locator('#statsContainer')).toBeVisible();

        const enIngles = await page.evaluate(() => {
            // Palabras que en español no se dicen así. No es una lista de todo
            // el inglés: son las que aparecerían si algo se quedara sin pasar
            // por el diccionario.
            const DELATORAS =
                /\b(segments?|words?|remaining|progress|loading|failed|settings|glossary|memory|delete|cancel|close|search in|start out empty|paste your key|choose an ai)\b/i;

            const encontrados = [];
            const anda = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let nodo;
            while ((nodo = anda.nextNode())) {
                const texto = nodo.textContent.trim();
                if (texto.length < 3) continue;

                const el = nodo.parentElement;
                if (!el) continue;
                const estilo = getComputedStyle(el);
                if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
                if (el.closest('.hidden')) continue;
                // El contenido del archivo que se traduce, y el selector de
                // idioma, que escribe cada idioma en su propio idioma.
                if (el.closest('.segmento-origen, textarea, .capa-etiquetas')) continue;
                if (el.closest('.selector-idioma')) continue;

                if (DELATORAS.test(texto)) {
                    encontrados.push(`${el.id || el.tagName}: ${texto.slice(0, 60)}`);
                }
            }
            return encontrados;
        });

        expect(enIngles).toEqual([]);
    });

    test('el saludo del asistente cambia de idioma con la interfaz', async ({ page }) => {
        await page.locator('#aiBtn').click();
        const saludo = page.locator('#aiChatContainer .ai-message-bot').first();
        await expect(saludo).toContainText(/PandaBot/);
        await expect(saludo).toContainText(/Choose an AI service/i);

        await cambiarIdioma(page, 'es');
        await expect(saludo).toContainText(/Elige aquí arriba/i);
    });

    test('la barra de estado dice "segmentos" en español', async ({ page }) => {
        await cambiarIdioma(page, 'es');
        await cargarPo(page);
        await page.locator('#toolsBtn').click();
        await page.locator('#statsBtn').click();

        await expect(page.locator('#segmentsProgress')).toContainText(/segmentos/);
        await expect(page.locator('#segmentsProgress')).not.toContainText(/segments/);
    });
});
