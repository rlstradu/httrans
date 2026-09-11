/**
 * La onda de sonido y las regiones de cada subtítulo.
 *
 * Esta parte de la herramienta es la más fácil de romper sin enterarse: si el
 * núcleo de WaveSurfer y su plugin de regiones dejaran de entenderse, la
 * página seguiría cargando, los subtítulos seguirían viéndose, y solo se
 * notaría al abrir un vídeo. Hasta ahora los dos venían de un CDN en versiones
 * distintas y nadie lo comprobaba.
 *
 * Se usa un archivo de audio de verdad, no un vídeo, porque para lo que se
 * comprueba aquí da igual y pesa mucho menos.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, cargarSrt } from './apoyo.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.join(AQUI, 'recursos', 'tono.wav');

/** Carga el audio y espera a que la onda esté dibujada. */
async function cargarAudio(page) {
    await page.locator('#videoFileInput').setInputFiles(AUDIO);
    await expect(page.locator('#waveform')).toBeVisible({ timeout: 20_000 });
}

test.describe('cuando la onda no se puede dibujar', () => {
    test('lo dice, en vez de dejar un recuadro en blanco', async ({ page }) => {
        // Este aviso estaba escrito y comentado: cuando la onda fallaba no se
        // decía nada, y a quien lo mirara le tocaba adivinar si el archivo
        // tardaba, si estaba roto o si la herramienta se había colgado.
        test.setTimeout(45_000);
        await cargarSrt(page);

        // Un archivo que no es sonido: el navegador no puede leerlo.
        await page.locator('#videoFileInput').setInputFiles({
            name: 'esto-no-es-un-video.mp4',
            mimeType: 'video/mp4',
            buffer: Buffer.from('ni de lejos'),
        });

        const dice = page.locator('#ondaDice');
        await expect(dice).toBeVisible({ timeout: 20_000 });
        await expect(dice).toHaveClass(/onda-dice-fallo/);
        await expect(dice).toContainText('could not be drawn');
    });

    test('y el recuadro de la onda se enseña igualmente', async ({ page }) => {
        // Con el aviso escondido dentro de un bloque oculto no se avisa de
        // nada. Además, si algo falla entre cargar el vídeo y enseñar el
        // bloque, el bloque se queda oculto para siempre y la onda no vuelve
        // ni cargando otro archivo.
        test.setTimeout(45_000);
        await cargarSrt(page);
        await page.locator('#videoFileInput').setInputFiles({
            name: 'esto-no-es-un-video.mp4',
            mimeType: 'video/mp4',
            buffer: Buffer.from('ni de lejos'),
        });
        await expect(page.locator('#ondaBloque')).toBeVisible({ timeout: 20_000 });
    });
});

test.describe('la onda de sonido', () => {
    test('aparece al cargar un archivo con sonido', async ({ page }) => {
        test.setTimeout(45_000);
        await cargarSrt(page);
        await cargarAudio(page);

        // WaveSurfer 7 dibuja dentro de un shadow DOM, así que lo que se puede
        // comprobar desde fuera es que ha creado su lienzo.
        const dibujada = await page
            .locator('#waveform')
            .evaluate((el) => Boolean(el.querySelector('div')?.shadowRoot));
        expect(dibujada).toBe(true);
    });

    test('la onda es continua, no de barritas', async ({ page }) => {
        // Una barra de 3 píxeles con 2 de hueco resume cinco píxeles de sonido
        // en uno. Al ajustar la entrada de un subtítulo, el principio de la
        // palabra podía caer justo en el hueco y no verse.
        test.setTimeout(45_000);
        await cargarSrt(page);
        await cargarAudio(page);

        const opciones = await page.evaluate(() => {
            const ws = document.querySelector('#waveform div')?.shadowRoot;
            return ws ? true : false;
        });
        expect(opciones).toBe(true);

        // Con barras, la onda deja columnas enteras en blanco a intervalos
        // regulares. Sin ellas, no hay hueco que valga.
        const huecos = await page.locator('#waveform').evaluate((el) => {
            const lienzo = el.querySelector('div')?.shadowRoot?.querySelector('canvas');
            if (!lienzo) return -1;
            const ctx = lienzo.getContext('2d');
            const { width, height } = lienzo;
            const datos = ctx.getImageData(0, 0, Math.min(width, 400), height).data;
            let columnasVacias = 0;
            for (let x = 0; x < Math.min(width, 400); x++) {
                let pintada = false;
                for (let y = 0; y < height; y++) {
                    if (datos[(y * Math.min(width, 400) + x) * 4 + 3] > 0) {
                        pintada = true;
                        break;
                    }
                }
                if (!pintada) columnasVacias++;
            }
            return columnasVacias;
        });
        // Con barGap: 2 de cada 5 columnas quedaban vacías: 160 de 400.
        expect(huecos).toBeLessThan(40);
    });

    test('el deslizador de altura acentúa los picos', async ({ page }) => {
        // El zoom acerca en el tiempo, a lo ancho. Esto es lo otro: estira el
        // dibujo a lo alto. Una grabación floja sale como una raya casi plana y
        // no hay manera de ver dónde empieza a hablar alguien.
        test.setTimeout(45_000);
        await cargarSrt(page);
        await cargarAudio(page);

        // El deslizador vive escondido detrás de su icono, como un control de
        // volumen: hay que abrirlo.
        await expect(page.locator('#waveHeightRange')).toBeHidden();
        await page.locator('#waveHeightBtn').click();
        await expect(page.locator('#waveHeightRange')).toBeVisible();
        await expect(page.locator('#waveHeightValor')).toHaveText('1.0×');

        /** Hasta dónde llega el pico más alto dibujado, en píxeles. */
        const altoDelPico = () =>
            page.locator('#waveform').evaluate((el) => {
                const lienzo = el.querySelector('div')?.shadowRoot?.querySelector('canvas');
                if (!lienzo) return 0;
                const ancho = Math.min(lienzo.width, 400);
                const datos = lienzo.getContext('2d').getImageData(0, 0, ancho, lienzo.height).data;
                for (let y = 0; y < lienzo.height; y++) {
                    for (let x = 0; x < ancho; x++) {
                        if (datos[(y * ancho + x) * 4 + 3] > 0) return lienzo.height / 2 - y;
                    }
                }
                return 0;
            });

        const antes = await altoDelPico();
        // A diferencia de los dos botones de antes, que saltaban de escalón en
        // escalón, aquí se puede pedir cualquier valor intermedio.
        await page.locator('#waveHeightRange').fill('2.35');
        await expect(page.locator('#waveHeightValor')).toHaveText('2.4×');
        await page.waitForTimeout(400);

        expect(await altoDelPico()).toBeGreaterThan(antes);

        // Y se cierra solo al pulsar fuera, como cualquier control de volumen.
        await page.locator('#waveform').click({ position: { x: 5, y: 5 } });
        await expect(page.locator('#waveHeightRange')).toBeHidden();
    });

    test('debajo va una regla con los segundos', async ({ page }) => {
        // Sin ella la onda es un dibujo sin escala: se ve dónde suena algo pero
        // no en qué segundo, y para saberlo había que pinchar y mirar el
        // reproductor.
        test.setTimeout(45_000);
        await cargarSrt(page);
        await cargarAudio(page);
        await page.waitForTimeout(500);

        const regla = await page.locator('#waveform').evaluate((el) => {
            const sombra = el.querySelector('div')?.shadowRoot;
            const caja = sombra?.querySelector('[part~="timeline-wrapper"]');
            if (!caja) return null;
            return {
                marcas: caja.querySelectorAll('div').length,
                rotulos: [...caja.querySelectorAll('div')]
                    .map((d) => d.textContent.trim())
                    .filter(Boolean),
            };
        });

        expect(regla).not.toBe(null);
        // WaveSurfer solo dibuja las marcas que caben en la parte visible de la
        // onda, así que aquí se cuentan las de la primera pantalla, no las diez
        // del archivo entero.
        expect(regla.marcas).toBeGreaterThanOrEqual(5);
        expect(regla.rotulos).toContain('0:01');
        expect(regla.rotulos).toContain('0:02');
    });

    test('la etiqueta de cada región se lee', async ({ page }) => {
        // WaveSurfer 7 dibuja dentro de un shadow DOM, y la hoja de estilos de
        // la página no entra ahí. Desde que se actualizó la librería, la
        // etiqueta de la región salía sin fondo y a tamaño normal: letra blanca
        // sobre la onda, ilegible. Sus estilos se inyectan ahora dentro.
        test.setTimeout(45_000);
        await cargarSrt(page);
        await cargarAudio(page);
        await page.waitForTimeout(500);

        const fondo = await page.locator('#waveform').evaluate((el) => {
            const etiqueta = el
                .querySelector('div')
                ?.shadowRoot?.querySelector('.region-content');
            return etiqueta ? getComputedStyle(etiqueta).backgroundColor : null;
        });
        // Sin los estilos dentro, el fondo sería transparente.
        expect(fondo).not.toBe(null);
        expect(fondo).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('cada subtítulo tiene su región sobre la onda', async ({ page }) => {
        // Esto es lo que de verdad une las dos librerías: el plugin de regiones
        // pintando encima de la onda del núcleo.
        //
        // WaveSurfer solo dibuja las regiones que caben en la parte visible de
        // la onda, así que se recorre la onda de principio a fin y se comprueba
        // que van apareciendo todas. Antes se dibujaban de más: cada repintado
        // creaba otra vez las mismas regiones encima de las anteriores.
        test.setTimeout(60_000);
        await cargarSrt(page);
        await cargarAudio(page);

        /** Los identificadores de las regiones dibujadas ahora mismo. */
        const dibujadas = () =>
            page.locator('#waveform').evaluate((el) => {
                const sombra = el.querySelector('div')?.shadowRoot;
                if (!sombra) return [];
                return [...sombra.querySelectorAll('[part~="region"]')].map((n) =>
                    n.getAttribute('part').split(' ')[1],
                );
            });

        /** Desplaza la onda a una fracción de su largo. */
        const desplazar = (fraccion) =>
            page.locator('#waveform').evaluate((el, f) => {
                const scroll = el.querySelector('div')?.shadowRoot?.querySelector('[part="scroll"]');
                if (scroll) scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) * f;
            }, fraccion);

        const vistas = new Set();
        for (const fraccion of [0, 0.25, 0.5, 0.75, 1]) {
            await desplazar(fraccion);
            await page.waitForTimeout(300);
            const aqui = await dibujadas();
            // Ninguna región puede estar dibujada dos veces: cuando se
            // duplicaban, quedaban una encima de otra y no se notaba a simple
            // vista, pero arrastrar una dejaba la copia debajo sin mover.
            expect(aqui.length).toBe(new Set(aqui).size);
            for (const id of aqui) vistas.add(id);
        }

        // Una por subtítulo: ni una menos (faltaría marcar un subtítulo) ni una
        // más (serían duplicados apilados).
        expect(vistas.size).toBe(3);
        expect([...vistas].every((id) => id.startsWith('sub-'))).toBe(true);
    });
});
