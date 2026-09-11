/**
 * El SRT de punta a punta, en un navegador de verdad.
 *
 * Las pruebas de tests/ comprueban el núcleo que lee y escribe el formato. Estas
 * comprueban el camino entero, que es donde de verdad se pierden las cosas: leer
 * el archivo del disco con su codificación, pintarlo, escribir encima, pulsar
 * exportar y mirar el archivo que sale por el otro lado, byte a byte.
 *
 * La promesa que se vigila aquí es la de siempre: **abrir un archivo y guardarlo
 * sin traducir nada devuelve el mismo archivo**. Si eso se rompe, el
 * subtitulador se entera cuando el cliente se lo devuelve.
 */
import { test, expect, elegirIdiomas } from './apoyo.js';

/** Un .srt con todo lo que suele traer un encargo de verdad. */
const SRT_FEO = [
    '1',
    '00:00:01,000 --> 00:00:03,000',
    '<i>Come on</i>, he said',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,500 X1:100 X2:600 Y1:360 Y2:400',
    '{\\an8}Up here',
    '',
    '3',
    '00:00:07,000 --> 00:00:09,000',
    '<font color="#ffff00">Yellow</font> and <u>underlined</u>',
    '',
    '4',
    '00:00:10,000 --> 00:00:11,000',
    '',
    '',
    '5',
    '00:00:12,000 --> 00:00:14,000',
    'Two lines',
    'of text',
    '',
].join('\n');

/**
 * Carga un .srt escrito con los bytes que se le den.
 *
 * Se pasan bytes y no texto porque media prueba va justamente de eso: de con qué
 * alfabeto está escrito el archivo.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number[]} bytes
 */
async function cargarBytes(page, bytes, nombre = 'encargo.srt') {
    await page.locator('#srtFile').setInputFiles({
        name: nombre,
        mimeType: 'text/plain',
        buffer: Buffer.from(bytes),
    });
    await elegirIdiomas(page);
    await expect(page.locator('#translationsContainer')).not.toBeEmpty();
}

/**
 * Pulsa exportar y devuelve el archivo que se descarga, en bytes.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Buffer>}
 */
async function exportar(page) {
    await page.locator('#fileBtn').hover();
    await page.locator('#saveSrt').click();
    // El cuadro que pregunta el nombre del archivo.
    await expect(page.locator('#saveSrtModal')).toBeVisible();

    const descarga = page.waitForEvent('download');
    await page.locator("#confirmSaveBtn").click();
    const archivo = await descarga;

    const ruta = await archivo.path();
    return (await import('node:fs/promises')).readFile(ruta);
}

test.describe('el archivo que entra y el que sale', () => {
    test('abrir y exportar sin traducir devuelve el mismo archivo', async ({ page }) => {
        // Cursivas, coordenadas de posición, marcas de posición del estilo ASS,
        // color, subrayado, un subtítulo vacío y uno de dos líneas.
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(SRT_FEO);
    });

    test('los cinco subtítulos llegan al editor, incluido el vacío', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(5);
        // El vacío tiene sus tiempos y su sitio; lo que no tiene es texto.
        await expect(page.locator('#original-pre-3')).toHaveText('');
        await expect(page.locator('#original-pre-4')).toContainText('Two lines');
    });

    test('un archivo en Windows-1252 llega con los acentos en su sitio', async ({ page }) => {
        // El caso de siempre en español: un .srt de un programa de subtitulado
        // antiguo. Leído como UTF-8 llegaba «Canci?n de cuna».
        const texto = '1\n00:00:01,000 --> 00:00:03,000\nCanción de cuna, mañana\n';
        const bytes = [...texto].map((letra) => letra.codePointAt(0));

        await cargarBytes(page, bytes, 'antiguo.srt');

        await expect(page.locator('#original-pre-0')).toHaveText('Canción de cuna, mañana');
    });

    test('y sale en UTF-8, con las mismas letras', async ({ page }) => {
        const texto = '1\n00:00:01,000 --> 00:00:03,000\nMañana\n';
        await cargarBytes(page, [...texto].map((l) => l.codePointAt(0)), 'antiguo.srt');

        // Y se dice de dónde venía: no es un error, pero quien tenga que
        // devolvérselo a un cliente que trabaja con herramientas antiguas
        // merece enterarse ahora y no cuando se lo devuelvan.
        // El aviso es un rótulo de esquina que se va solo; se lee, no se cierra.
        await expect(page.locator('#messageText')).toContainText('windows-1252');

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(texto);
    });

    test('la marca del principio vuelve al archivo si venía en él', async ({ page }) => {
        const texto = '1\n00:00:01,000 --> 00:00:03,000\nHello\n';
        await cargarBytes(page, [...Buffer.from('﻿' + texto, 'utf8')], 'conbom.srt');

        const salida = await exportar(page);
        expect([...salida.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        expect(salida.toString('utf8').replace(/^﻿/, '')).toBe(texto);
    });

    test('un archivo con saltos de Windows se devuelve con saltos de Windows', async ({ page }) => {
        const texto = '1\r\n00:00:01,000 --> 00:00:03,000\r\nHello\r\n';
        await cargarBytes(page, [...Buffer.from(texto, 'utf8')], 'windows.srt');

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(texto);
    });

    test('lo que se escribe en el editor sale limpio al archivo', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        // Se escribe con un salto de línea y un ampersand, que es justo lo que
        // el campo del editor guarda como <br> y como &amp;.
        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Tú & yo');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type('vamos');
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('Tú & yo\nvamos');
        expect(salida).not.toContain('&amp;');
        expect(salida).not.toContain('<br>');
        expect(salida).not.toContain('<div>');
    });

    test('un WebVTT se abre y vuelve entero, con sus estilos y sus regiones', async ({ page }) => {
        // El segundo formato, y el que prueba que la idea funciona: lo que el
        // programa no sabe interpretar vuelve al archivo tal cual.
        const VTT = [
            'WEBVTT - Episodio 1',
            '',
            'NOTE',
            'Este comentario tiene que seguir aquí al guardar.',
            '',
            'STYLE',
            '::cue(v[voice="Ana"]) {',
            '  color: yellow;',
            '}',
            '',
            'REGION',
            'id:arriba',
            'width:40%',
            '',
            'saludo',
            '00:00:01.000 --> 00:00:03.000 region:arriba align:start',
            '<v Ana>Hello <i>there</i>',
            '',
            '00:00:04.000 --> 00:00:06.500 line:0 position:20%',
            'Up here',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(2);
        await expect(page.locator('#original-pre-1')).toHaveText('Up here');

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(VTT);
    });

    test('el WebVTT traducido conserva todo lo que no es texto', async ({ page }) => {
        const VTT = [
            'WEBVTT',
            '',
            'NOTE quién habla',
            '',
            'saludo',
            '00:00:01.000 --> 00:00:03.000 align:start',
            'Hello',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Hola');
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('Hola');
        expect(salida).not.toContain('Hello');
        // Y lo demás, donde estaba.
        expect(salida).toContain('NOTE quién habla');
        expect(salida).toContain('saludo\n00:00:01.000 --> 00:00:03.000 align:start\nHola');
    });

    test('un TTML se abre y vuelve entero, con su cabecera y sus regiones', async ({ page }) => {
        // El formato de las plataformas grandes. Aquí es donde se ve si la idea
        // aguanta: un archivo trae mucho más que subtítulos y todo eso tiene
        // que volver sin que le falte una coma.
        const TTML = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<!-- Lo puso quien maquetó el archivo. -->',
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:frameRate="25" xmlns:ttp="http://www.w3.org/ns/ttml#parameter">',
            '  <head>',
            '    <styling>',
            '      <style xml:id="normal" tts:fontFamily="Arial" tts:color="white"/>',
            '    </styling>',
            '    <layout>',
            '      <region xml:id="abajo" tts:origin="10% 80%" tts:extent="80% 20%"/>',
            '    </layout>',
            '  </head>',
            '  <body>',
            '    <div region="abajo" style="normal">',
            '      <p begin="00:00:01.000" end="00:00:03.000">Hello <span tts:fontStyle="italic">world</span></p>',
            '      <p begin="00:00:04.000" end="00:00:06.500">Two lines<br/>of text</p>',
            '    </div>',
            '  </body>',
            '</tt>',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(TTML, 'utf8')], 'capitulo.ttml');

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(2);
        await expect(page.locator('#original-pre-1')).toContainText('Two lines');

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(TTML);
    });

    test('el TTML traducido conserva la cabecera, los estilos y los comentarios', async ({ page }) => {
        const TTML = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<!-- No lo borres. -->',
            '<tt xmlns="http://www.w3.org/ns/ttml">',
            '  <head><layout><region xml:id="abajo"/></layout></head>',
            '  <body><div region="abajo">',
            '    <p begin="00:00:01.000" end="00:00:03.000">Hello</p>',
            '  </div></body>',
            '</tt>',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(TTML, 'utf8')], 'capitulo.ttml');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Hola & adiós');
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        // Un "&" suelto dejaría el archivo sin abrir.
        expect(salida).toContain('<p begin="00:00:01.000" end="00:00:03.000">Hola &amp; adiós</p>');
        expect(salida).toContain('<!-- No lo borres. -->');
        expect(salida).toContain('<region xml:id="abajo"/>');
        expect(salida).not.toContain('Hello');
    });

    test('un TTML con sangría llega al editor con sus líneas y no una más', async ({ page }) => {
        // El TTML de ejemplo del W3C, que es como se escriben de verdad: el <p>
        // en una línea, el texto en otra y el cierre en una tercera. Esos saltos
        // son del archivo, no del subtítulo; contarlos metía una línea vacía en
        // medio y ocho espacios delante de la segunda.
        const TTML = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<tt xmlns="http://www.w3.org/ns/ttml">',
            '  <body region="subtitleArea">',
            '    <div>',
            '      <p xml:id="subtitle1" begin="0.76s" end="3.45s">',
            '        It seems a paradox, does it not,',
            '      </p>',
            '      <p xml:id="subtitle2" begin="5.0s" end="10.0s">',
            '        that the image formed on<br/>',
            '        the Retina should be inverted?',
            '      </p>',
            '    </div>',
            '  </body>',
            '</tt>',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(TTML, 'utf8')], 'template.ttml');

        await expect(page.locator('#original-pre-0')).toHaveText('It seems a paradox, does it not,');
        await expect(page.locator('#original-pre-1')).toHaveText(
            'that the image formed on\nthe Retina should be inverted?',
        );

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(TTML);
    });

    test('un ASS se abre y vuelve entero, con sus estilos y sus marcas', async ({ page }) => {
        // El formato de Aegisub. Un archivo trae los estilos, la resolución del
        // vídeo y unas marcas dentro del texto que dicen dónde y cómo sale cada
        // cosa; nada de eso se traduce y todo eso tiene que volver.
        const ASS = [
            '[Script Info]',
            '; Lo maquetó otra persona.',
            'Title: Episodio 1',
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
            'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello {\\i1}world{\\i0}',
            'Dialogue: 0,0:00:04.00,0:00:06.50,Default,,0,0,0,,Two lines\\NOf text',
            'Comment: 0,0:00:07.00,0:00:09.00,Default,,0,0,0,,Esto lo descartó el maquetador',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(ASS, 'utf8')], 'capitulo.ass');

        // Dos, no tres: el "Comment" es un diálogo apagado y no se traduce.
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(2);
        await expect(page.locator('#original-pre-1')).toHaveText('Two lines\nOf text');
        // Y la cursiva del formato se ve en cursiva.
        await expect(page.locator('#original-pre-0 i')).toHaveText('world');

        const salida = await exportar(page);
        expect(salida.toString('utf8')).toBe(ASS);
    });

    test('el ASS traducido conserva los estilos y las marcas de posición', async ({ page }) => {
        const ASS = [
            '[Script Info]',
            'ScriptType: v4.00+',
            '',
            '[V4+ Styles]',
            'Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Italic, Alignment, Encoding',
            'Style: Cartel,Arial,36,&H0000FFFF,0,1,8,1',
            '',
            '[Events]',
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
            'Dialogue: 0,0:00:01.00,0:00:03.00,Cartel,,0,0,0,,{\\an8}A sign, up here',
            '',
        ].join('\n');

        await cargarBytes(page, [...Buffer.from(ASS, 'utf8')], 'capitulo.ass');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('{\\an8}Un cartel, aquí arriba');
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        // La coma de la traducción no puede partir la línea en dos, y el
        // {\an8} —que es lo que manda el cartel arriba— tiene que seguir ahí.
        expect(salida).toContain(
            'Dialogue: 0,0:00:01.00,0:00:03.00,Cartel,,0,0,0,,{\\an8}Un cartel, aquí arriba',
        );
        expect(salida).toContain('Style: Cartel,Arial,36');
    });

    test('y el nombre que propone no arrastra la extensión de antes', async ({ page }) => {
        // Con un .ass proponía "capitulo.ass_trad.ass": el recorte de la
        // extensión solo sabía de .srt y .vtt y se quedó así al añadir los
        // otros dos formatos.
        const ASS = [
            '[Script Info]', 'ScriptType: v4.00+', '',
            '[Events]',
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
            'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello', '',
        ].join('\n');
        await cargarBytes(page, [...Buffer.from(ASS, 'utf8')], 'capitulo.ass');

        await page.locator('#fileBtn').hover();
        await page.locator('#saveSrt').click();
        await expect(page.locator('#saveSrtModal')).toBeVisible();
        await expect(page.locator('#fileNameInput')).toHaveValue('capitulo_trad.ass');
    });

    test('y el cuadro de exportar no dice SRT teniendo abierto otro formato', async ({ page }) => {
        // Exportabas un .ass y el cuadro se titulaba "Exportar Archivo SRT":
        // quien abre su ASS y lee "SRT" piensa que no se lo van a devolver bien.
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Hello', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        await page.locator('#fileBtn').hover();
        await page.locator('#saveSrt').click();
        await expect(page.locator('#saveSrtModal')).toBeVisible();
        await expect(page.locator('#saveSrtModal h2')).not.toContainText('SRT');
    });

    test('el archivo se descarga con la extensión de su formato', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n', 'utf8')], 'capitulo.vtt');

        await page.locator('#fileBtn').hover();
        await page.locator('#saveSrt').click();
        await expect(page.locator('#fileNameInput')).toHaveValue(/\.vtt$/);
    });

    test('la cursiva escrita en el editor sale como <i> y nada más', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Vamos');
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-formato="italic"]').click();
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('<i>Vamos</i>');
        expect(salida).not.toContain('<em>');
        expect(salida).not.toContain('<span');
        expect(salida).not.toContain('style=');
    });
});

/**
 * Partir un subtítulo y el aviso de formato, en un navegador de verdad.
 *
 * Las dos cosas viven en el campo de edición, así que probarlas sin navegador
 * sería probar otra cosa: aquí el cursor es un cursor y la cursiva la pone el
 * navegador como le parece.
 */
test.describe('la pestaña de QA', () => {
    const CON_FALLOS = [
        '1', '00:00:01,000 --> 00:00:03,000', 'Hello there', '',
        '2', '00:00:02,500 --> 00:00:02,800', 'It costs 250 euros', '',
    ].join('\n');

    test('cada comprobación dice qué detecta, no solo cómo se llama', async ({ page }) => {
        // Diecinueve nombres sueltos no dicen qué hace cada uno, y el que no se
        // entiende no se enciende.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();

        const cps = page.locator('#qaResumen .qa-regla').filter({ hasText: 'CPS' }).first();
        await expect(cps.locator('.qa-regla-desc')).toContainText('Reads too fast');
    });

    test('los límites de tiempo se escriben en fotogramas y enseñan los ms', async ({ page }) => {
        // Un subtitulador piensa en fotogramas y el archivo se escribe en
        // milisegundos: teniendo los dos delante no hay que echar la cuenta.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();

        const fila = page.locator('#qaResumen .qa-regla').filter({ hasText: 'Minimum duration' });
        // 833 ms a 25 fotogramas por segundo son 21 fotogramas.
        await expect(fila.locator('[data-qa-limite]')).toHaveValue('21');
        await expect(fila.locator('.qa-regla-equivale')).toContainText('833 ms');

        // Y al cambiarlos, la equivalencia se mueve con ellos.
        await fila.locator('[data-qa-limite]').fill('50');
        await expect(fila.locator('.qa-regla-equivale')).toContainText('2000 ms');
    });

    test('la lista no aparece sola: se pide, y entonces se queda', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();

        // En un archivo largo son cientos de filas: aparecer sin que nadie las
        // pida es ruido.
        await expect(page.locator('#qaErrorListContainer')).toContainText('Run QA');
        await expect(page.locator('.qa-error-item')).toHaveCount(0);

        await page.locator('#qaRevisarBtn').click();
        await expect(page.locator('.qa-error-item').first()).toBeVisible();
    });

    test('pulsar un error lleva a su subtítulo y la lista se queda abierta', async ({ page }) => {
        // Estaba en un cuadro flotante que había que cerrar para tocar el
        // subtítulo y volver a abrir para ver el siguiente.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();
        await page.locator('#qaRevisarBtn').click();

        const cuantos = await page.locator('.qa-error-item').count();
        expect(cuantos).toBeGreaterThan(0);
        await page.locator('.qa-error-item').first().click();

        await expect(page.locator('.qa-error-item')).toHaveCount(cuantos);
        await expect(page.locator('#qaErrorListContainer')).toBeVisible();
    });

    test('al revisar se quita el panda y sale la raya que reparte el alto', async ({ page }) => {
        // El bocadillo explica los límites, que es lo que hay que entender
        // antes de revisar. Después estorba: se come un tercio del alto para
        // repetir algo ya leído, justo cuando lo que se mira es la lista.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();

        await expect(page.locator('#qaPandaAviso')).toBeVisible();
        await expect(page.locator('#tiradorQa')).toBeHidden();

        await page.locator('#qaRevisarBtn').click();
        await expect(page.locator('#qaPandaAviso')).toBeHidden();
        await expect(page.locator('#tiradorQa')).toBeVisible();
    });

    test('la raya reparte el alto, y lo recuerda', async ({ page }) => {
        // Con un reparto fijo, al cargar la lista los filtros se quedaban en un
        // hueco donde apenas se veían dos de diecinueve.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();
        await page.locator('#qaRevisarBtn').click();

        const alto = () =>
            page.locator('#qaResumen').evaluate((el) => Math.round(el.getBoundingClientRect().height));
        const antes = await alto();

        const raya = await page.locator('#tiradorQa').boundingBox();
        await page.mouse.move(raya.x + raya.width / 2, raya.y + raya.height / 2);
        await page.mouse.down();
        await page.mouse.move(raya.x + raya.width / 2, raya.y + 150, { steps: 8 });
        await page.mouse.up();

        expect(await alto()).toBeGreaterThan(antes + 50);

        // Y sigue donde se dejó al volver.
        const dejado = await alto();
        await page.reload();
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();
        await page.locator('#qaRevisarBtn').click();
        expect(Math.abs((await alto()) - dejado)).toBeLessThan(20);
    });

    test('el subtítulo con algo que mirar lleva su aviso en la tarjeta', async ({ page }) => {
        // Sin él hay que ir a la pestaña de QA para saber cuáles están mal, y
        // al volver a la lista ya no te acuerdas de cuál era.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);

        // El segundo dura 300 ms: no da tiempo a leerlo, y eso es un error.
        const aviso = page.locator('#avisoQa-1');
        await expect(aviso).toBeVisible();
        await expect(aviso).toHaveClass(/segmento-aviso-error/);
        // Y dice qué pasa sin tener que abrir nada.
        await expect(aviso).toHaveAttribute('title', /Lasts 300 ms/);
    });

    test('y se va en cuanto se arregla', async ({ page }) => {
        // Un aviso que se queda puesto después de arreglarlo enseña a no mirar
        // los avisos.
        const SIN_TRADUCIR = ['1', '00:00:01,000 --> 00:00:04,000', 'Hello', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(SIN_TRADUCIR, 'utf8')]);

        await expect(page.locator('#avisoQa-0')).toBeVisible();

        await page.locator('#translation-0').click();
        await page.keyboard.type('Hola');
        await page.locator('#translation-0').blur();

        await expect(page.locator('#avisoQa-0')).toBeHidden();
        await expect(page.locator('#avisoQa-0')).toHaveAttribute('title', '');
    });

    test('ya no hay cuadro flotante de errores', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await expect(page.locator('#qaErrorListModal')).toHaveCount(0);
    });

    test('un subtítulo con varios fallos sale una vez, con sus motivos', async ({ page }) => {
        // Cuatro filas seguidas con el mismo número obligan a leerlas todas
        // para ver que hablan del mismo sitio.
        await cargarBytes(page, [...Buffer.from(CON_FALLOS, 'utf8')]);
        await page.locator('#qaBtn').click();
        await page.locator('#qaRevisarBtn').click();

        const segundo = page.locator('.qa-error-item').filter({ hasText: '#2' });
        await expect(segundo).toHaveCount(1);
        expect(await segundo.locator('.qa-motivo').count()).toBeGreaterThan(1);
    });
});

test.describe('partir un subtítulo', () => {
    const TTML = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">',
        '  <body><div>',
        '    <p begin="1s" end="9s">Hello <span tts:fontStyle="italic">brave new world</span></p>',
        '  </div></body>',
        '</tt>',
        '',
    ].join('\n');

    test('no parte por la mitad el <span> de la plataforma', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(TTML, 'utf8')], 'capitulo.ttml');

        await page.locator('#translation-unit-0 [data-partir]').click();
        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(2);

        const salida = (await exportar(page)).toString('utf8');

        // Lo que salía antes era "<span tts:fon" + "tStyle=…": no un archivo con
        // una etiqueta rara, un archivo que no abre.
        expect(salida).not.toContain('tts:fon"');
        expect(salida.match(/<span/g)?.length).toBe(2);
        expect(salida.match(/<\/span>/g)?.length).toBe(2);

        // Y cada trozo se lleva su cursiva entera.
        expect(salida).toContain('<span tts:fontStyle="italic">');
    });

    test('se puede partir un subtítulo antes de traducirlo', async ({ page }) => {
        // Al ajustar se parte antes de traducir constantemente. Antes hacía
        // falta escribir algo en la traducción para que el botón hiciera nada.
        await cargarBytes(page, [...Buffer.from(TTML, 'utf8')], 'capitulo.ttml');

        await page.locator('#translation-unit-0 [data-partir]').click();

        await expect(page.locator('[id^="translation-unit-"]')).toHaveCount(2);
        await expect(page.locator('#original-pre-0')).not.toBeEmpty();
        await expect(page.locator('#original-pre-1')).not.toBeEmpty();
    });
});

test.describe('el aviso de formato', () => {
    const SRT = ['1', '00:00:01,000 --> 00:00:04,000', 'The <i>Titanic</i> sank', ''].join('\n');

    test('avisa cuando la cursiva del original se queda por el camino', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT, 'utf8')]);

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('El Titanic se hundió');
        await editor.blur();

        // El archivo sale bien formado, así que esto no se ve al leer la
        // traducción: por eso lo tiene que decir el QA.
        // El rótulo del QA de la barra de estado, que es el que se ve.
        // dispatchEvent y no click: la barra de estado va abajo del todo y en
        // la ventana de las pruebas se queda fuera de lo que se ve.
        await page.locator('#statusBarQaLink').dispatchEvent('click');

        // Lleva a la pestaña de QA, no a un cuadro flotante: la lista se queda
        // abierta mientras se repasan los errores uno a uno.
        await expect(page.locator('#qaContainer')).toBeVisible();
        // Y dice qué formato falta, no "Tags", que era el nombre que tenía por
        // dentro y no le decía a nadie qué había que arreglar.
        await expect(page.locator('#qaErrorListContainer')).toContainText('italics');
    });

    test('y no avisa cuando la traducción la lleva', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT, 'utf8')]);

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('El Titanic se hundió');
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-formato="italic"]').click();
        await editor.blur();

        // Sin errores no hay nada que pulsar: el rótulo dice que está limpio.
        await expect(page.locator('#statusBar')).toContainText('No QA errors found');
    });
});

/**
 * La vista previa de un ASS, encima del vídeo.
 *
 * En un SRT la vista previa es el texto con su cursiva y ya está. En un ASS es
 * la mitad del trabajo: el color, el cuerpo y la esquina en la que sale cada
 * línea no están en el texto, están en el estilo que tiene asignado, en la
 * cabecera del archivo. Un archivo con cuatro estilos son cuatro cosas distintas
 * en pantalla, y enseñarlas todas en blanco y abajo es no enseñar nada de lo que
 * hay que revisar.
 *
 * Se carga un archivo de sonido y no un vídeo: para esto da igual, y pesa mucho
 * menos en el repositorio.
 */
test.describe('la vista previa de un ASS', () => {
    const CON_ESTILOS = [
        '[Script Info]',
        'ScriptType: v4.00+',
        'PlayResX: 1920',
        'PlayResY: 1080',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,10,10,40,1',
        'Style: Arriba,Arial,50,&H0000FFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,1,8,10,10,20,1',
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:03.00,Arriba,,0,0,0,,Un cartel arriba',
        'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Y un diálogo a la vez',
        'Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,Un diálogo abajo',
        'Dialogue: 0,0:00:07.00,0:00:09.00,Default,,0,0,0,,{\\\\pos(300,400)}Con marcas que no se pintan',
        '',
    ].join('\n');

    /** Pone el archivo, un sonido y el reloj donde se le diga. */
    async function enElSegundo(page, segundo) {
        await page.evaluate((s) => {
            document.querySelector('video').currentTime = s;
        }, segundo);
        await expect
            .poll(async () => page.locator('#subtitlePreviewText').textContent(), { timeout: 5000 })
            .not.toBe('');
    }

    test('cada estilo sale con su color y en su sitio', async ({ page }) => {
        test.setTimeout(45_000);
        await cargarBytes(page, [...Buffer.from(CON_ESTILOS, 'utf8')], 'estilos.ass');

        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const aqui = path.dirname(fileURLToPath(import.meta.url));
        await page.locator('#videoFileInput').setInputFiles(path.join(aqui, 'recursos', 'tono.wav'));
        await expect(page.locator('#waveform')).toBeVisible({ timeout: 20_000 });

        // El cartel: amarillo, en negrita y en la franja de arriba.
        await enElSegundo(page, 2);
        const cartel = await page.locator('.previa-arriba .previa-linea').evaluate((e) => {
            const c = getComputedStyle(e);
            return { color: c.color, peso: c.fontWeight };
        });
        expect(cartel.color).toBe('rgb(255, 255, 0)');
        expect(Number(cartel.peso)).toBeGreaterThanOrEqual(700);

        // Y el diálogo: blanco, sin negrita y abajo, como estaba.
        await enElSegundo(page, 5);
        await expect(page.locator('.previa-arriba .previa-linea')).toHaveCount(0);
        const dialogo = await page
            .locator('.previa-abajo .previa-linea')
            .evaluate((e) => getComputedStyle(e).color);
        expect(dialogo).toBe('rgb(255, 255, 255)');
    });

    test('las marcas que no se pueden pintar no se escriben encima del vídeo', async ({ page }) => {
        test.setTimeout(45_000);
        await cargarBytes(page, [...Buffer.from(CON_ESTILOS, 'utf8')], 'estilos.ass');

        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const aqui = path.dirname(fileURLToPath(import.meta.url));
        await page.locator('#videoFileInput').setInputFiles(path.join(aqui, 'recursos', 'tono.wav'));
        await expect(page.locator('#waveform')).toBeVisible({ timeout: 20_000 });

        await enElSegundo(page, 8);

        // Un {\pos(300,400)} es movimiento: en una vista previa quieta no se
        // puede representar. Lo que no vale es dejarlo escrito encima de la
        // cara de alguien, que es lo que pasaba.
        const dicho = await page.locator('#subtitlePreviewText').textContent();
        expect(dicho).toBe('Con marcas que no se pintan');
        // Pero en el editor sí se ve: quien traduce tiene que saber que está.
        await expect(page.locator('#original-pre-3')).toContainText('\\pos(300,400)');
    });
});

test.describe('dos subtítulos a la vez', () => {
    /**
     * En un ASS es de lo más normal: un cartel arriba y el diálogo abajo, los
     * dos sonando al mismo tiempo. No es un caso raro del formato, es para lo
     * que se hizo. Se enseñaba solo el primero, así que al revisar un archivo
     * con carteles faltaba justo la mitad de lo que había que mirar.
     */
    const A_LA_VEZ = [
        '[Script Info]',
        'ScriptType: v4.00+',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,10,10,40,1',
        'Style: Arriba,Arial,50,&H0000FFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,1,8,10,10,20,1',
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:04.00,Arriba,,0,0,0,,Un cartel arriba',
        'Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Y el diálogo abajo',
        '',
    ].join('\n');

    test('se ven los dos, y cada uno en su sitio', async ({ page }) => {
        test.setTimeout(45_000);
        await cargarBytes(page, [...Buffer.from(A_LA_VEZ, 'utf8')], 'a-la-vez.ass');

        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const aqui = path.dirname(fileURLToPath(import.meta.url));
        await page.locator('#videoFileInput').setInputFiles(path.join(aqui, 'recursos', 'tono.wav'));
        await expect(page.locator('#waveform')).toBeVisible({ timeout: 20_000 });

        await page.evaluate(() => {
            document.querySelector('video').currentTime = 2;
        });

        await expect(page.locator('.previa-linea')).toHaveCount(2);
        // El cartel arriba y el diálogo abajo, cada uno en su franja.
        await expect(page.locator('.previa-arriba .previa-linea')).toHaveText('Un cartel arriba');
        await expect(page.locator('.previa-abajo .previa-linea')).toHaveText('Y el diálogo abajo');
        // Y cada uno con su color.
        const cartel = await page
            .locator('.previa-arriba .previa-linea')
            .evaluate((e) => getComputedStyle(e).color);
        expect(cartel).toBe('rgb(255, 255, 0)');
    });
});

/**
 * La barra de formato del editor.
 *
 * Había un solo botón, el de cursiva. Negrita, subrayado y color se usan poco en
 * un SRT y bastante en un ASS, donde además son la diferencia entre un cartel y
 * un diálogo. Y cada formato los escribe a su manera: un <i> del editor acaba
 * siendo {\i1} en un ASS y un tts:fontStyle en un TTML.
 */
test.describe('escribir formato desde el editor', () => {
    const ASS_SENCILLO = [
        '[Script Info]',
        'ScriptType: v4.00+',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Italic, Alignment, Encoding',
        'Style: Default,Arial,60,&H00FFFFFF,0,0,2,1',
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello world',
        '',
    ].join('\n');

    test('la negrita y el color salen con la forma del ASS', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(ASS_SENCILLO, 'utf8')], 'sencillo.ass');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Hola mundo');
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-formato="bold"]').click();
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-color]').evaluate((campo) => {
            campo.value = '#ffff00';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');

        // El color va al revés en ASS —azul, verde, rojo—, así que el amarillo
        // es 00FFFF y no FFFF00.
        expect(salida).toContain('{\\b1}{\\c&H00FFFF&}Hola mundo{\\c}{\\b0}');
        expect(salida).not.toContain('<b>');
        expect(salida).not.toContain('<font');
    });

    test('y la posición se elige sin saberse el número', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(ASS_SENCILLO, 'utf8')], 'sencillo.ass');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Un cartel');
        await editor.blur();

        // En ASS la posición es una marca dentro del texto y los números son los
        // del teclado numérico. Saberse cuál es cuál no es parte del oficio.
        await page.locator('#translation-unit-0 [data-posicion]').selectOption('8');

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain(',{\\an8}Un cartel');
    });

    test('elegir otra posición cambia la que había, no añade otra', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(ASS_SENCILLO, 'utf8')], 'sencillo.ass');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Un cartel');
        await editor.blur();

        await page.locator('#translation-unit-0 [data-posicion]').selectOption('8');
        await page.locator('#translation-unit-0 [data-posicion]').selectOption('2');

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain(',{\\an2}Un cartel');
        expect(salida).not.toContain('{\\an8}');
    });

    test('el color de un SRT va marcado, porque no todos los reproductores lo respetan', async ({ page }) => {
        // El <font> del SRT no está en ninguna norma: los reproductores de
        // ordenador lo respetan y muchos de televisión lo quitan. El botón se
        // queda —funciona casi siempre— con un punto que lo distingue.
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        const color = page.locator('#translation-unit-0 .segmento-color');
        await expect(color).toHaveClass(/segmento-icono-segun/);
        await expect(color).toHaveAttribute('title', /players ignore it/);

        // La cursiva sí está en todos: esa no lleva marca.
        await expect(page.locator('#translation-unit-0 [data-formato="italic"]')).not.toHaveClass(
            /segmento-icono-segun/,
        );
    });

    test('y el de un WebVTT no, que ese formato sí lo tiene en su norma', async ({ page }) => {
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Hello', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');
        await expect(page.locator('#translation-unit-0 .segmento-color')).not.toHaveClass(
            /segmento-icono-segun/,
        );
    });

    test('y el aviso sigue ahí después de cambiar de idioma', async ({ page }) => {
        // El title se rehace desde su clave al cambiar de idioma. Si el aviso
        // se pegara solo al pintar el botón, ahí se perdería.
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);
        await page.locator('#langBtn').hover();
        await page.locator('#langEsBtn').click();

        await expect(page.locator('#translation-unit-0 .segmento-color')).toHaveAttribute(
            'title',
            /reproductores que lo ignoran/,
        );
    });

    test('la marca no cambia el tamaño del botón', async ({ page }) => {
        // Un punto que empujara la fila sería peor que no avisar: la fila de
        // botones se lee de un vistazo justamente porque son todos iguales.
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);
        const alto = await page
            .locator('#translation-unit-0 .segmento-color')
            .evaluate((el) => Math.round(el.getBoundingClientRect().height));
        expect(alto).toBe(24);
    });

    test('la posición de un WebVTT va a la línea de tiempos, no al texto', async ({ page }) => {
        // Es el otro sitio donde puede estar: en ASS es una marca dentro del
        // texto y aquí son ajustes pegados a los tiempos. El botón es el mismo.
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Up there', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        await page.locator('#translation-0').click();
        await page.keyboard.type('Ahí arriba');
        await page.locator('#translation-unit-0 [data-posicion]').selectOption('7');

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('00:00:01.000 --> 00:00:03.000 line:0% align:start');
        // Y el texto se queda limpio: aquí la posición no se escribe dentro.
        expect(salida).toContain('Ahí arriba');
        expect(salida).not.toContain('{');
    });

    test('y el selector enseña dónde está puesto al abrir el archivo', async ({ page }) => {
        // Aparecía siempre en blanco, así que no había manera de saber si un
        // subtítulo llevaba posición sin leerle los ajustes a mano.
        const VTT = [
            'WEBVTT', '', '00:00:01.000 --> 00:00:03.000 line:0% align:start', 'Up there', '',
        ].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');
        await expect(page.locator('#translation-unit-0 [data-posicion]')).toHaveValue('7');
    });

    test('una posición puesta por error se puede quitar', async ({ page }) => {
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Down here', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        const selector = page.locator('#translation-unit-0 [data-posicion]');
        await selector.selectOption('7');
        await selector.selectOption('');

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('00:00:01.000 --> 00:00:03.000\n');
        expect(salida).not.toContain('line:');
    });

    test('el de la posición es un dibujo, no el nombre de la casilla recortado', async ({ page }) => {
        // Era un <select> pelado, así que lo que se veía era el texto de la
        // opción elegida: "Arriba izquierda" en un recuadro de 24 píxeles sale
        // cortado por la mitad. Ahora delante va una pantalla con un subtítulo
        // dentro y el desplegable va detrás, entero y funcionando.
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Hello', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        const control = page.locator('#translation-unit-0 .segmento-posicion');
        await expect(control.locator('svg')).toHaveCount(1);
        // El desplegable sigue ahí y se sigue pudiendo usar.
        await control.locator('select').selectOption('7');
        await expect(page.locator('#translation-unit-0 [data-posicion]')).toHaveValue('7');
    });

    test('y se enciende cuando el subtítulo lleva posición', async ({ page }) => {
        // Para ver de un vistazo cuáles están colocados sin abrir el
        // desplegable de uno en uno.
        const VTT = [
            'WEBVTT', '',
            '00:00:01.000 --> 00:00:03.000', 'Down here', '',
            '00:00:04.000 --> 00:00:06.000 line:0%', 'Up there', '',
        ].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        await expect(page.locator('#translation-unit-0 .segmento-posicion')).not.toHaveClass(
            /segmento-posicion-puesta/,
        );
        const puesta = page.locator('#translation-unit-1 .segmento-posicion');
        await expect(puesta).toHaveClass(/segmento-posicion-puesta/);
        // Y encendido de verdad, no solo con la clase puesta: esta regla
        // competía con la del botón normal y perdía por ir antes en la hoja.
        await expect(puesta).not.toHaveCSS('color', 'rgb(107, 114, 128)');
    });

    test('con un SRT no se ofrece la posición, que no es de ese formato', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        await expect(page.locator('#translation-unit-0 [data-formato="bold"]')).toHaveCount(1);
        await expect(page.locator('#translation-unit-0 [data-posicion]')).toHaveCount(0);
    });

    test('el color aguanta que el selector del sistema robe el foco', async ({ page }) => {
        // El selector de color de macOS es una ventana aparte: al abrirse, la
        // página pierde el foco y con él lo que hubiera seleccionado. Al
        // volver, pintar de amarillo no pintaba nada porque ya no había nada
        // que pintar. Se apunta la selección antes de salir.
        await cargarBytes(page, [...Buffer.from(ASS_SENCILLO, 'utf8')], 'sencillo.ass');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Hola mundo');
        await page.keyboard.press('Control+a');

        const selector = page.locator('#translation-unit-0 [data-color]');
        // El mousedown es lo que apunta dónde estaba el cursor.
        await selector.dispatchEvent('mousedown');
        // Y esto es lo que hace la ventana del sistema: llevarse la selección.
        await page.evaluate(() => window.getSelection().removeAllRanges());
        await selector.evaluate((campo) => {
            campo.value = '#ff0000';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('{\\c&H0000FF&}Hola mundo{\\c}');
    });

    test('y el de un WebVTT sale como clase, que es como lo escribe ese formato', async ({ page }) => {
        // WebVTT no tiene <font>: un archivo con esa etiqueta dentro se abre sin
        // protestar y sale del color de siempre, porque el reproductor no sabe
        // qué es y se la salta. El color va en una clase.
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Yellow', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Amarillo');
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-color]').evaluate((campo) => {
            campo.value = '#ffff00';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('<c.yellow>Amarillo</c>');
        expect(salida).not.toContain('<font');
    });

    test('y un color que no es de los ocho se declara en la cabecera', async ({ page }) => {
        const VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Teal', ''].join('\n');
        await cargarBytes(page, [...Buffer.from(VTT, 'utf8')], 'capitulo.vtt');

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Verdoso');
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-color]').evaluate((campo) => {
            campo.value = '#00ffcc';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('::cue(.color-00ffcc) { color: #00ffcc; }');
        expect(salida.indexOf('STYLE')).toBeLessThan(salida.indexOf('-->'));
    });

    test('se puede cambiar de color dos veces seguidas', async ({ page }) => {
        // Al aplicar el color, el navegador envuelve el texto en un elemento
        // nuevo: el sitio que se había apuntado al abrir el selector deja de
        // existir. La primera vez funcionaba y la segunda ya no, que es justo
        // lo que se hace con un selector de color: ir probando tonos.
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Amarillo');
        await page.keyboard.press('Control+a');

        // El mousedown es lo que apunta dónde estaba la selección: sin él no se
        // pasa por el camino que falla.
        await page.locator('#translation-unit-0 .segmento-color').dispatchEvent('mousedown');

        const elegir = (color) =>
            page.locator('#translation-unit-0 [data-color]').evaluate((campo, c) => {
                campo.value = c;
                campo.dispatchEvent(new Event('input', { bubbles: true }));
            }, color);

        await elegir('#ffff00');
        await elegir('#00ffff');
        await elegir('#ff0000');
        await editor.blur();

        // El último que se eligió es el que vale, y solo hay un <font>: cada
        // color sustituye al anterior en vez de envolverlo otra vez.
        const salida = (await exportar(page)).toString('utf8');
        const primero = salida.split('\n\n')[0];
        expect(primero).toContain('<font color="#ff0000">Amarillo</font>');
        expect(primero).not.toContain('#ffff00');
        expect(primero).not.toContain('#00ffff');
    });

    test('y el color de un SRT sale como <font>, que es lo suyo', async ({ page }) => {
        await cargarBytes(page, [...Buffer.from(SRT_FEO, 'utf8')]);

        const editor = page.locator('#translation-0');
        await editor.click();
        await page.keyboard.type('Amarillo');
        await page.keyboard.press('Control+a');
        await page.locator('#translation-unit-0 [data-color]').evaluate((campo) => {
            campo.value = '#ffff00';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await editor.blur();

        const salida = (await exportar(page)).toString('utf8');
        expect(salida).toContain('<font color="#ffff00">Amarillo</font>');
    });
});
