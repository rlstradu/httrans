/**
 * WebVTT: leerlo y devolverlo entero.
 *
 * Es el formato de los subtítulos en la web y en casi todo lo que se ve por
 * streaming. Se parece al SRT —una lista de subtítulos con sus tiempos— pero
 * lleva cosas que el SRT no tiene y que no son adorno: dónde va el subtítulo en
 * pantalla, quién habla, los estilos del documento y las regiones.
 *
 * De ahí la regla con la que está escrito el lector, la misma que usa Poanda:
 * **se reconstruye sobre el archivo que se abrió, no se escribe uno nuevo**. Lo
 * que el programa no sabe interpretar vuelve tal cual. Es la diferencia entre
 * "guardar" y "rehacer el archivo con lo que he entendido de él", y en
 * subtitulado lo segundo se lleva por delante el trabajo de quien maquetó.
 */
import { describe, expect, it } from 'vitest';
import {
    conLaPosicion,
    esVtt,
    paraElVideoElVtt,
    paraVerElVtt,
    parseVttContent,
    posicionDe,
    reconstructVtt,
} from '../src/js/core/vtt.js';
import { detectarFormatoSrt } from '../src/js/core/srt.js';

const SENCILLO = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:04.000 --> 00:00:06.500
Two lines
of text
`;

/** Un .vtt de los que salen de una plataforma de verdad. */
const COMPLETO = `WEBVTT - Episodio 1

NOTE
Este archivo lo hizo otra persona y estos comentarios
tienen que seguir aquí cuando se guarde.

STYLE
::cue(v[voice="Ana"]) {
  color: yellow;
}

REGION
id:arriba
width:40%
lines:3

saludo
00:00:01.000 --> 00:00:03.000 region:arriba align:start
<v Ana>Hello <i>there</i>

00:00:04.000 --> 00:00:06.500 line:0 position:20%
Up here
`;

const idaYVuelta = (texto) => {
    const { entradas, documento } = parseVttContent(texto);
    return reconstructVtt(entradas, documento, detectarFormatoSrt(texto));
};

describe('reconocer el formato', () => {
    it('lo reconoce por su primera línea', () => {
        expect(esVtt(SENCILLO)).toBe(true);
        expect(esVtt('﻿WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola')).toBe(true);
        expect(esVtt('1\n00:00:01,000 --> 00:00:02,000\nHola')).toBe(false);
    });
});

describe('leer un WebVTT', () => {
    it('lee los subtítulos y sus tiempos', () => {
        const { entradas } = parseVttContent(SENCILLO);

        expect(entradas).toHaveLength(2);
        expect(entradas[0].original).toBe('Hello world');
        expect(entradas[0].startTimeMs).toBe(1000);
        expect(entradas[1].durationMs).toBe(2500);
        expect(entradas[1].original).toBe('Two lines\nof text');
    });

    it('numera los subtítulos, que el formato no los numera', () => {
        const { entradas } = parseVttContent(SENCILLO);
        expect(entradas.map((e) => e.index)).toEqual([1, 2]);
    });

    it('se queda con el nombre del subtítulo cuando lo trae', () => {
        const { entradas } = parseVttContent(COMPLETO);
        expect(entradas[0].nombre).toBe('saludo');
        expect(entradas[1].nombre).toBe('');
    });

    it('se queda con los ajustes de posición, que son del maquetador', () => {
        const { entradas } = parseVttContent(COMPLETO);
        expect(entradas[0].timecodes).toContain('region:arriba align:start');
        expect(entradas[1].timecodes).toContain('line:0 position:20%');
    });

    it('no confunde un comentario con un subtítulo', () => {
        const { entradas } = parseVttContent(COMPLETO);
        expect(entradas).toHaveLength(2);
        expect(entradas.some((e) => e.original.includes('otra persona'))).toBe(false);
    });
});

describe('abrir y guardar sin traducir devuelve el mismo archivo', () => {
    it('con un archivo sencillo', () => {
        expect(idaYVuelta(SENCILLO)).toBe(SENCILLO);
    });

    it('con cabecera, comentarios, estilos y regiones', () => {
        // Esto es lo que se pierde con un lector que reescribe el archivo en
        // lugar de reconstruirlo: el trabajo de quien lo maquetó.
        expect(idaYVuelta(COMPLETO)).toBe(COMPLETO);
    });

    it('con saltos de Windows', () => {
        const conCrlf = SENCILLO.replace(/\n/g, '\r\n');
        expect(idaYVuelta(conCrlf)).toBe(conCrlf);
    });
});

describe('lo que sale traducido', () => {
    it('escribe la traducción y deja todo lo demás en su sitio', () => {
        const { entradas, documento } = parseVttContent(COMPLETO);
        entradas[0].translation = '<v Ana>Hola <i>otra vez</i>';

        const salida = reconstructVtt(entradas, documento, detectarFormatoSrt(COMPLETO));

        expect(salida).toContain('<v Ana>Hola <i>otra vez</i>');
        expect(salida).toContain('REGION');
        expect(salida).toContain('::cue(v[voice="Ana"])');
        expect(salida).toContain('00:00:01.000 --> 00:00:03.000 region:arriba align:start');
        expect(salida).toContain('saludo\n');
    });

    it('deja pasar las etiquetas que son del formato', () => {
        const { entradas, documento } = parseVttContent(SENCILLO);
        // <v> y <c> son de WebVTT; el <div> lo pone el editor del navegador.
        entradas[0].translation = '<div><v Ana><c.grito>¡Hola!</c></v></div>';

        const salida = reconstructVtt(entradas, documento, detectarFormatoSrt(SENCILLO));
        expect(salida).toContain('<v Ana><c.grito>¡Hola!</c>');
        expect(salida).not.toContain('<div>');
    });
});

describe('la tabla de formatos', () => {
    it('reconoce el formato por lo que dice el archivo, no por su extensión', async () => {
        const { formatoDe } = await import('../src/js/core/formatos.js');

        // Un .vtt renombrado a .srt sigue siendo un WebVTT: abrirlo como SRT
        // daría un archivo lleno de subtítulos rotos sin decir por qué.
        expect(formatoDe('capitulo.srt', SENCILLO).id).toBe('vtt');
        expect(formatoDe('capitulo.vtt', SENCILLO).id).toBe('vtt');
        expect(formatoDe('capitulo.srt', '1\n00:00:01,000 --> 00:00:02,000\nHola').id).toBe('srt');
    });

    it('sin nada que lo aclare, manda la extensión', async () => {
        const { formatoDe } = await import('../src/js/core/formatos.js');
        expect(formatoDe('vacio.vtt', '').id).toBe('vtt');
        expect(formatoDe('vacio.srt', '').id).toBe('srt');
        expect(formatoDe('sinnombre', '').id).toBe('srt');
    });

    it('cada formato se abre y se guarda con la misma entrada de la tabla', async () => {
        const { FORMATOS } = await import('../src/js/core/formatos.js');

        for (const formato of FORMATOS) {
            expect(typeof formato.leer).toBe('function');
            expect(typeof formato.escribir).toBe('function');
            expect(formato.extensiones.length).toBeGreaterThan(0);
            expect(formato.mime).toBeTruthy();
        }
    });

    it('la extensión del archivo que se descarga la pone el formato', async () => {
        const { conLaExtensionDe, formatoPorId } = await import('../src/js/core/formatos.js');

        expect(conLaExtensionDe('capitulo.srt', formatoPorId('vtt'))).toBe('capitulo.vtt');
        expect(conLaExtensionDe('capitulo', formatoPorId('srt'))).toBe('capitulo.srt');
    });
});

describe('el color en WebVTT', () => {
    const CON_COLOR = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
Hello

2
00:00:04.000 --> 00:00:06.000
World
`;

    /** Traduce un subtítulo y devuelve el archivo entero. */
    function traducir(contenido, traducciones) {
        const { entradas, documento } = parseVttContent(contenido);
        for (const [indice, texto] of Object.entries(traducciones)) {
            entradas[Number(indice)].translation = texto;
        }
        return reconstructVtt(entradas, documento);
    }

    it('un color de los ocho de serie sale como su clase, sin cabecera', () => {
        // <c.yellow> lo entiende cualquier reproductor sin que el archivo tenga
        // que explicar nada. Añadirle un STYLE sería ensuciarlo para nada.
        const salida = traducir(CON_COLOR, { 0: '<font color="#ffff00">Hola</font>' });
        expect(salida).toContain('<c.yellow>Hola</c>');
        expect(salida).not.toContain('STYLE');
    });

    it('y lo mismo si el navegador lo escribió como rgb()', () => {
        const salida = traducir(CON_COLOR, { 0: '<font color="rgb(0, 255, 255)">Hola</font>' });
        expect(salida).toContain('<c.cyan>Hola</c>');
    });

    it('un color cualquiera se declara en un bloque STYLE de la cabecera', () => {
        const salida = traducir(CON_COLOR, { 0: '<font color="#00ffcc">Hola</font>' });
        expect(salida).toContain('<c.color-00ffcc>Hola</c>');
        expect(salida).toContain('::cue(.color-00ffcc) { color: #00ffcc; }');
    });

    it('el bloque STYLE va antes del primer subtítulo, que es donde manda el formato', () => {
        const salida = traducir(CON_COLOR, { 0: '<font color="#00ffcc">Hola</font>' });
        expect(salida.indexOf('STYLE')).toBeGreaterThan(salida.indexOf('WEBVTT'));
        expect(salida.indexOf('STYLE')).toBeLessThan(salida.indexOf('-->'));
    });

    it('dos subtítulos del mismo color comparten una sola regla', () => {
        const salida = traducir(CON_COLOR, {
            0: '<font color="#00ffcc">Hola</font>',
            1: '<font color="#00ffcc">Mundo</font>',
        });
        expect(salida.match(/::cue\(\.color-00ffcc\)/g)).toHaveLength(1);
    });

    it('al volver a guardar no se amontonan los bloques de estilos', () => {
        // Cambiar un color y guardar otra vez dejaba el de antes y el de ahora:
        // el reproductor se queda con uno de los dos y no siempre con el bueno.
        const unaVez = traducir(CON_COLOR, { 0: '<font color="#00ffcc">Hola</font>' });
        const { entradas, documento } = parseVttContent(unaVez);
        entradas[0].translation = '<font color="#ff8800">Hola</font>';
        const otraVez = reconstructVtt(entradas, documento);

        expect(otraVez.match(/STYLE/g)).toHaveLength(1);
        expect(otraVez).toContain('::cue(.color-ff8800)');
        expect(otraVez).not.toContain('00ffcc');
    });

    it('no escribe <font>, que WebVTT no sabe qué es', () => {
        const salida = traducir(CON_COLOR, { 0: '<font color="#ffff00">Hola</font>' });
        expect(salida).not.toContain('<font');
    });

    it('respeta el bloque STYLE que ya traía el archivo', () => {
        const conEstilo = `WEBVTT

STYLE
::cue(.grito) { color: #ff0000; }

1
00:00:01.000 --> 00:00:03.000
<c.grito>Hello</c>
`;
        const { entradas, documento } = parseVttContent(conEstilo);
        entradas[0].translation = '<c.grito>Hola</c>';
        const salida = reconstructVtt(entradas, documento);
        expect(salida).toContain('::cue(.grito) { color: #ff0000; }');
        expect(salida).toContain('<c.grito>Hola</c>');
    });

    it('un color que no se entiende se queda como estaba', () => {
        const salida = traducir(CON_COLOR, { 0: '<font color="var(--rojo)">Hola</font>' });
        expect(salida).toContain('var(--rojo)');
    });
});

describe('paraVerElVtt', () => {
    it('pinta las clases de serie, que el navegador no sabe que son colores', () => {
        expect(paraVerElVtt('<c.yellow>Hola</c>')).toBe('<span style="color:#ffff00">Hola</span>');
    });

    it('pinta también las que declara subpandaTM', () => {
        expect(paraVerElVtt('<c.color-00ffcc>Hola</c>')).toContain('color:#00ffcc');
    });

    it('y las que declara el propio archivo en su STYLE', () => {
        const { documento } = parseVttContent(`WEBVTT

STYLE
::cue(.grito) { color: #ff0000; }

1
00:00:01.000 --> 00:00:03.000
<c.grito>Hello</c>
`);
        expect(paraVerElVtt('<c.grito>Hola</c>', documento)).toContain('color:#ff0000');
    });

    it('enseña el color de lo que se escribe en el editor, no lo que el editor guarda', () => {
        // La vista previa tiene que enseñar lo que va a quedar en el archivo.
        expect(paraVerElVtt('<font color="#ffff00">Hola</font>')).toContain('color:#ffff00');
    });

    it('una clase que no dice ningún color se deja en paz', () => {
        expect(paraVerElVtt('<c.loquesea>Hola</c>')).toBe('<c.loquesea>Hola</c>');
    });
});

describe('dónde sale el subtítulo', () => {
    const TIEMPOS = '00:00:01.000 --> 00:00:03.000';

    it('arriba en el centro se escribe con la altura y nada más', () => {
        expect(conLaPosicion(TIEMPOS, '8')).toBe(`${TIEMPOS} line:0%`);
    });

    it('arriba a la izquierda lleva altura y lado', () => {
        expect(conLaPosicion(TIEMPOS, '7')).toBe(`${TIEMPOS} line:0% align:start`);
    });

    it('abajo en el centro no escribe nada: es la de siempre', () => {
        // Pedirle a un reproductor lo que ya iba a hacer es ensuciar el
        // archivo para nada.
        expect(conLaPosicion(TIEMPOS, '2')).toBe(TIEMPOS);
    });

    it('abajo a la derecha lleva solo el lado', () => {
        expect(conLaPosicion(TIEMPOS, '3')).toBe(`${TIEMPOS} align:end`);
    });

    it('cambiar de sitio sustituye lo que había, no lo añade', () => {
        const arriba = conLaPosicion(TIEMPOS, '7');
        expect(conLaPosicion(arriba, '3')).toBe(`${TIEMPOS} align:end`);
    });

    it('y se puede quitar del todo', () => {
        const arriba = conLaPosicion(TIEMPOS, '7');
        expect(conLaPosicion(arriba, '')).toBe(TIEMPOS);
    });

    it('los demás ajustes de la línea no se tocan', () => {
        // `region`, `size` y `vertical` los puso alguien cobrando por ponerlos.
        const conLoSuyo = `${TIEMPOS} region:arriba size:40% vertical:rl`;
        const movido = conLaPosicion(conLoSuyo, '9');
        expect(movido).toContain('region:arriba');
        expect(movido).toContain('size:40%');
        expect(movido).toContain('vertical:rl');
        expect(movido).toContain('align:end');
    });

    it('lee dónde está puesto para que el selector lo enseñe', () => {
        expect(posicionDe(`${TIEMPOS} line:0% align:start`)).toBe('7');
        expect(posicionDe(`${TIEMPOS} line:50%`)).toBe('5');
        expect(posicionDe(`${TIEMPOS} align:end`)).toBe('3');
    });

    it('y dice que no hay ninguna cuando va donde siempre', () => {
        expect(posicionDe(TIEMPOS)).toBe('');
    });

    it('entiende también la forma de contar líneas, que sale en archivos reales', () => {
        // Sin porcentaje, `line` cuenta líneas de texto: 0 es la de arriba y
        // los negativos se cuentan desde abajo.
        expect(posicionDe(`${TIEMPOS} line:0`)).toBe('8');
        expect(posicionDe(`${TIEMPOS} line:-1`)).toBe('2');
    });

    it('poner y leer dan la vuelta completa en las nueve casillas', () => {
        for (const casilla of ['1', '3', '4', '5', '6', '7', '8', '9']) {
            expect(posicionDe(conLaPosicion(TIEMPOS, casilla)), casilla).toBe(casilla);
        }
        // La de abajo en el centro es la excepción a propósito: no se escribe,
        // así que al leerla vuelve como "sin posición".
        expect(posicionDe(conLaPosicion(TIEMPOS, '2'))).toBe('');
    });

    it('la vista previa coloca el subtítulo donde diga la línea de tiempos', () => {
        const arriba = paraElVideoElVtt('Hola', { timecodes: `${TIEMPOS} line:0% align:start` });
        expect(arriba.vertical).toBe('arriba');
        expect(arriba.horizontal).toBe('izquierda');

        const siempre = paraElVideoElVtt('Hola', { timecodes: TIEMPOS });
        expect(siempre.vertical).toBe('abajo');
        expect(siempre.horizontal).toBe('centro');
    });

    it('y en la vista previa el color se sigue viendo', () => {
        const visto = paraElVideoElVtt('<c.yellow>Hola</c>', { timecodes: TIEMPOS });
        expect(visto.html).toContain('color:#ffff00');
    });
});
