/**
 * Lo común a todas las pruebas de navegador de subpandaASS.
 *
 * Las pruebas se ejecutan contra el resultado compilado, servido desde la raíz
 * del sitio igual que en httrans.org. Los CDN se interceptan: la herramienta
 * carga Tailwind, WaveSurfer, ffmpeg y jsPDF de fuera, y una prueba que
 * dependiera de que internet responda no serviría de red de seguridad.
 */
import { test as base, expect } from '@playwright/test';

/** Un ASS mínimo pero de verdad: con su cabecera, su estilo y tres líneas. */
export const ASS_EJEMPLO = [
    '[Script Info]',
    'Title: Prueba',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello world',
    'Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,{\\i1}In italics{\\i0}',
    'Dialogue: 0,0:00:07.00,0:00:09.00,Default,,0,0,0,,Last line',
    '',
].join('\n');

/** Un SRT mínimo, para lo que no es cosa del ASS. */
export const SRT_EJEMPLO = [
    '1',
    '00:00:01,000 --> 00:00:03,000',
    'Hello world',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,000',
    'Goodbye',
    '',
].join('\n');

/**
 * Lo que se responde a cada CDN. Es lo justo para que la página se monte:
 * Tailwind y las fuentes no cambian ningún comportamiento que se pruebe aquí, y
 * WaveSurfer, ffmpeg y jsPDF solo hacen falta con un vídeo o al exportar.
 */
const CDN = [
    '**/cdn.tailwindcss.com/**',
    '**/fonts.googleapis.com/**',
    '**/fonts.gstatic.com/**',
    '**/cdnjs.cloudflare.com/**',
    '**/unpkg.com/**',
    // El logotipo de la herramienta se pide a raw.githubusercontent.com en vez
    // de al propio sitio, aunque el archivo está en la raíz del repositorio.
    // Es un fallo heredado y se arregla aparte, no en el refactor; aquí se
    // intercepta para que las pruebas no dependan de que GitHub responda.
    '**/raw.githubusercontent.com/**',
];

export const test = base.extend({
    page: async ({ page }, usar) => {
        for (const patron of CDN) {
            await page.route(patron, (ruta) =>
                ruta.fulfill({
                    status: 200,
                    contentType: ruta.request().url().endsWith('.css')
                        ? 'text/css'
                        : 'application/javascript',
                    body: '',
                }),
            );
        }
        await page.goto('./');
        await usar(page);
    },
});

/**
 * Abre un archivo en la herramienta.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} contenido
 * @param {string} nombre
 */
export async function abrir(page, contenido = ASS_EJEMPLO, nombre = 'encargo.ass') {
    const cual = nombre.endsWith('.ass') ? '#ass-loader' : '#srt-loader';
    await page.locator(cual).setInputFiles({
        name: nombre,
        mimeType: 'text/plain',
        buffer: Buffer.from(contenido, 'utf8'),
    });
    await expect(page.locator('#subtitle-body tr')).not.toHaveCount(0);
}

export { expect };
