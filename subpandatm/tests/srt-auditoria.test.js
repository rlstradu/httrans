/**
 * El SRT, a fondo: lo que llega de fuera y lo que sale.
 *
 * Un archivo de subtítulos no lo escribe subpandaTM: llega de un cliente, de
 * otra herramienta o de una plataforma, y cada una lo escribe a su manera. Estas
 * pruebas son los archivos raros que de verdad circulan —milisegundos con punto,
 * coordenadas detrás del tiempo, BOM de Windows, saltos de Windows, subtítulos
 * vacíos, subrayados, colores— y lo que tiene que pasar con ellos.
 *
 * La regla de la casa, que es de donde sale casi todo lo de aquí: **abrir un
 * archivo y guardarlo sin traducir nada tiene que devolver el mismo archivo**.
 * Si al pasar por la herramienta se pierde una etiqueta o cambia un salto de
 * línea, el subtitulador se entera cuando el cliente se lo devuelve.
 */
import { describe, it, expect } from 'vitest';
import {
    countCharactersWithoutTags,
    cuantoCuadranLosTiempos,
    detectarFormatoSrt,
    limpiarParaSubtitulo,
    parseSrtContent,
    parseTime,
    reconstructOriginalSrt,
    reconstructSrt,
} from '../src/js/core/srt.js';

describe('lo que llega de fuera', () => {
    it('lee un archivo normal', () => {
        const srt = '1\n00:00:01,000 --> 00:00:03,000\nHello\n\n2\n00:00:04,000 --> 00:00:06,500\nTwo\nlines\n';
        const subs = parseSrtContent(srt);

        expect(subs).toHaveLength(2);
        expect(subs[0].index).toBe(1);
        expect(subs[0].original).toBe('Hello');
        expect(subs[1].original).toBe('Two\nlines');
        expect(subs[1].durationMs).toBe(2500);
    });

    it('no se deja por el camino un subtítulo sin texto', () => {
        // Pasa de verdad: una plataforma exporta un hueco donde había un
        // subtítulo forzado. Saltárselo cambia la numeración de todo lo que
        // viene detrás y devuelve al cliente un archivo con un subtítulo menos.
        const srt = '1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\n\n\n3\n00:00:05,000 --> 00:00:06,000\nBye\n';
        const subs = parseSrtContent(srt);

        expect(subs).toHaveLength(3);
        expect(subs[1].original).toBe('');
        expect(subs[2].index).toBe(3);
    });

    it('entiende los milisegundos con punto', () => {
        // Los escriben así varias herramientas, y a un reproductor le da igual.
        const subs = parseSrtContent('1\n00:00:01.500 --> 00:00:03.250\nHello\n');
        expect(subs[0].startTimeMs).toBe(1500);
        expect(subs[0].endTimeMs).toBe(3250);
    });

    it('entiende la flecha sin espacios y con espacios de más', () => {
        const sinEspacios = parseSrtContent('1\n00:00:01,000-->00:00:02,000\nHello\n');
        expect(sinEspacios[0].endTimeMs).toBe(2000);

        const conEspacios = parseSrtContent('1\n00:00:01,000  -->   00:00:02,000\nHello\n');
        expect(conEspacios[0].endTimeMs).toBe(2000);
    });

    it('no se atraganta con las coordenadas de posición', () => {
        // La extensión de posición del SRT: X1/X2/Y1/Y2 detrás del tiempo de
        // salida. Sin tenerla en cuenta, el tiempo de salida sale NaN y el
        // subtítulo queda con una duración imposible.
        const srt = '1\n00:00:01,000 --> 00:00:02,000 X1:100 X2:600 Y1:360 Y2:400\nHello\n';
        const subs = parseSrtContent(srt);

        expect(subs[0].endTimeMs).toBe(2000);
        expect(subs[0].durationMs).toBe(1000);
    });

    it('se traga el BOM de Windows sin quedárselo pegado al número', () => {
        const subs = parseSrtContent('﻿1\n00:00:01,000 --> 00:00:02,000\nHello\n');
        expect(subs[0].index).toBe(1);
        expect(subs[0].original).toBe('Hello');
    });

    it('lee un archivo con saltos de Windows', () => {
        const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\nthere\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nBye\r\n';
        const subs = parseSrtContent(srt);

        expect(subs).toHaveLength(2);
        // El texto se guarda con saltos normales: dentro de la herramienta hay
        // una sola forma de salto, y la del archivo se recuerda aparte.
        expect(subs[0].original).toBe('Hello\nthere');
    });

    it('aguanta una línea en blanco de más entre bloques', () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,000\nHello\n\n\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n';
        expect(parseSrtContent(srt)).toHaveLength(2);
    });

    it('no cuenta como subtítulo lo que no lo es', () => {
        expect(parseSrtContent('')).toHaveLength(0);
        expect(parseSrtContent('\n\n\n')).toHaveLength(0);
        expect(parseSrtContent('esto no es un srt')).toHaveLength(0);
    });
});

describe('abrir y guardar sin traducir devuelve el mismo archivo', () => {
    // Guardar es escribir los subtítulos con el formato del archivo que se
    // abrió: sus saltos de línea y su final. Es lo que hace la herramienta.
    /** @param {string} srt */
    const idaYVuelta = (srt) => reconstructSrt(parseSrtContent(srt), detectarFormatoSrt(srt));

    it('con un archivo normal', () => {
        const srt = '1\n00:00:01,000 --> 00:00:03,000\nHello\n\n2\n00:00:04,000 --> 00:00:06,500\nTwo\nlines\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('con cursivas y negritas', () => {
        const srt = '1\n00:00:01,000 --> 00:00:03,000\n<i>Come on</i>, he said\n\n2\n00:00:04,000 --> 00:00:05,000\n<b>LOUD</b>\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('con subrayado y color, que también son del formato', () => {
        // <u> y <font color> son SRT de toda la vida. Quitarlos al guardar es
        // devolverle al cliente un archivo distinto del que mandó.
        const srt = '1\n00:00:01,000 --> 00:00:03,000\n<u>Chapter one</u>\n\n2\n00:00:04,000 --> 00:00:05,000\n<font color="#ffff00">Yellow</font>\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('con las marcas de posición del estilo ASS', () => {
        const srt = '1\n00:00:01,000 --> 00:00:03,000\n{\\an8}Up here\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('con saltos de Windows: se devuelven como estaban', () => {
        const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nBye\r\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('con un subtítulo vacío por el medio', () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\n\n\n3\n00:00:05,000 --> 00:00:06,000\nBye\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('con numeración que no empieza en uno', () => {
        // Un trozo de un encargo repartido entre varias personas.
        const srt = '145\n00:10:01,000 --> 00:10:03,000\nHello\n\n146\n00:10:04,000 --> 00:10:05,000\nBye\n';
        expect(idaYVuelta(srt)).toBe(srt);
    });

    it('y el original se puede reescribir tal cual desde una copia', () => {
        const srt = '1\n00:00:01,000 --> 00:00:03,000\n<u>Hello</u>\n';
        expect(reconstructOriginalSrt(parseSrtContent(srt), detectarFormatoSrt(srt))).toBe(srt);
    });
});

describe('lo que sale traducido', () => {
    it('escribe la traducción en lugar del original', () => {
        const subs = parseSrtContent('1\n00:00:01,000 --> 00:00:03,000\nHello\n');
        subs[0].translation = 'Hola';
        expect(reconstructSrt(subs)).toBe('1\n00:00:01,000 --> 00:00:03,000\nHola\n');
    });

    it('deja el original donde no se ha traducido nada', () => {
        const subs = parseSrtContent('1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n');
        subs[0].translation = 'Hola';
        expect(reconstructSrt(subs)).toBe(
            '1\n00:00:01,000 --> 00:00:02,000\nHola\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n',
        );
    });

    it('no deja entrar en el archivo el HTML del editor', () => {
        const subs = parseSrtContent('1\n00:00:01,000 --> 00:00:03,000\nHello\n');
        // Lo que deja el navegador al escribir en el campo.
        subs[0].translation = '<div>Hola<br>mundo</div>';
        expect(reconstructSrt(subs)).toBe('1\n00:00:01,000 --> 00:00:03,000\nHola\nmundo\n');
    });

    it('devuelve el ampersand y los signos escapados a como se escriben', () => {
        // El campo del editor guarda "&" como "&amp;". Escribirlo así en el
        // archivo es escribir literalmente "&amp;" encima de la cara de
        // alguien.
        const subs = parseSrtContent('1\n00:00:01,000 --> 00:00:03,000\nA and B\n');
        subs[0].translation = 'A &amp; B &lt;3 &gt;.&nbsp;Ya';
        expect(reconstructSrt(subs)).toBe('1\n00:00:01,000 --> 00:00:03,000\nA & B <3 >. Ya\n');
    });
});

describe('lo que se limpia del editor', () => {
    it('convierte lo que escribe el navegador en lo que entiende un reproductor', () => {
        expect(limpiarParaSubtitulo('<em>a</em>')).toBe('<i>a</i>');
        expect(limpiarParaSubtitulo('<strong>a</strong>')).toBe('<b>a</b>');
        expect(limpiarParaSubtitulo('<span style="font-style: italic;">a</span>')).toBe('<i>a</i>');
        expect(limpiarParaSubtitulo('a<br>b')).toBe('a\nb');
        expect(limpiarParaSubtitulo('<div>a</div><div>b</div>')).toBe('a\nb');
    });

    it('deja pasar lo que el formato admite y nada más', () => {
        expect(limpiarParaSubtitulo('<u>a</u>')).toBe('<u>a</u>');
        expect(limpiarParaSubtitulo('<font color="#fff">a</font>')).toBe('<font color="#fff">a</font>');
        // El color en línea sí significa algo: es lo que escribe el navegador
        // cuando se pinta una palabra desde la barra del editor, y perderlo era
        // ver el amarillo en pantalla y no verlo en el archivo.
        expect(limpiarParaSubtitulo('<span style="color: red">a</span>')).toBe(
            '<font color="red">a</font>',
        );
        // Lo que sigue sin significar nada: el fondo, que ningún formato guarda.
        expect(limpiarParaSubtitulo('<span style="background-color: red">a</span>')).toBe('a');
        expect(limpiarParaSubtitulo('<script>alert(1)</script>a')).toBe('alert(1)a');
    });

    it('no cuenta las etiquetas como caracteres del subtítulo', () => {
        expect(countCharactersWithoutTags('<i>Hola</i>')).toBe(4);
        expect(countCharactersWithoutTags('<font color="#fff">Hola</font>')).toBe(4);
        expect(countCharactersWithoutTags('Hola\nmundo')).toBe(9);
        // Una marca de posición no sale en pantalla, así que no se cuenta:
        // seis caracteres de más en un subtítulo corto lo sacan del límite sin
        // que haya nada que recortar.
        expect(countCharactersWithoutTags('{\\an8}Hola')).toBe(4);
    });
});

describe('importar una traducción ya hecha', () => {
    const unos = parseSrtContent(
        '1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:05,000 --> 00:00:06,000\nB\n\n3\n00:00:09,000 --> 00:00:10,000\nC\n',
    );

    it('el mismo archivo cuadra entero', () => {
        expect(cuantoCuadranLosTiempos(unos, unos)).toBe(1);
    });

    it('una traducción corrida un subtítulo no cuadra', () => {
        // El caso que no se ve al revisar: cada línea es correcta, solo que va
        // donde no le toca, y no se nota hasta que alguien pone el vídeo.
        expect(cuantoCuadranLosTiempos(unos, unos.slice(1))).toBeLessThan(0.5);
    });

    it('unos milisegundos de diferencia siguen cuadrando', () => {
        const casi = unos.map((s) => ({ ...s, startTimeMs: s.startTimeMs + 40 }));
        expect(cuantoCuadranLosTiempos(unos, casi)).toBe(1);
    });

    it('sin nada con lo que comparar, no cuadra nada', () => {
        expect(cuantoCuadranLosTiempos(unos, [])).toBe(0);
    });
});

describe('los tiempos', () => {
    it('lee las dos maneras de escribir los milisegundos', () => {
        expect(parseTime('00:00:01,500')).toBe(1500);
        expect(parseTime('00:00:01.500')).toBe(1500);
        expect(parseTime('01:02:03,004')).toBe(3723004);
    });
});
