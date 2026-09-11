/**
 * Con qué alfabeto se lee un archivo de subtítulos.
 *
 * El caso que importa es el de siempre en español: un .srt hecho con un programa
 * de subtitulado antiguo, en Windows-1252, con acentos y eñes. Leído como UTF-8
 * llega roto, y roto se queda: cuando el texto está en pantalla, el byte que
 * faltaba ya no se puede recuperar.
 */
import { describe, expect, it } from 'vitest';
import { guardarSubtitulos, leerSubtitulos } from '../src/js/core/codificacion.js';

/** Escribe un texto en Windows-1252, como haría un programa antiguo. */
function enWindows1252(texto) {
    // En este rango, Windows-1252 y Unicode coinciden byte a byte, que es
    // justamente lo que hace que un texto así no sea UTF-8 válido.
    return Uint8Array.from([...texto].map((letra) => letra.codePointAt(0)));
}

const enUtf8 = (texto) => new TextEncoder().encode(texto);

describe('leer un archivo de subtítulos', () => {
    it('lee UTF-8 sin marca', () => {
        const { texto, codificacion, conBom } = leerSubtitulos(enUtf8('Canción de cuna'));

        expect(texto).toBe('Canción de cuna');
        expect(codificacion).toBe('utf-8');
        expect(conBom).toBe(false);
    });

    it('lee UTF-8 con la marca de Windows y no se la deja pegada al texto', () => {
        const { texto, conBom } = leerSubtitulos(enUtf8('﻿1\n00:00:01,000 --> 00:00:02,000\nHola'));

        expect(texto.startsWith('1')).toBe(true);
        expect(conBom).toBe(true);
    });

    it('lee Windows-1252 sin romper los acentos', () => {
        // Esto es lo que antes llegaba como «Canci�n de cuna, ma�ana».
        const { texto, codificacion } = leerSubtitulos(enWindows1252('Canción de cuna, mañana'));

        expect(texto).toBe('Canción de cuna, mañana');
        expect(codificacion).toBe('windows-1252');
    });

    it('lee las comillas y los guiones de Windows-1252', () => {
        // El rango 0x80–0x9F: comillas tipográficas, raya y puntos suspensivos.
        // Un texto de subtítulos español los lleva casi siempre.
        const bytes = Uint8Array.from([0x93, 0x48, 0x6f, 0x6c, 0x61, 0x94, 0x85, 0x97]);
        const { texto } = leerSubtitulos(bytes);

        expect(texto).toBe('“Hola”…—');
    });

    it('lee UTF-16 de Windows', () => {
        const bytes = Uint8Array.from([0xff, 0xfe, 0x48, 0x00, 0x6f, 0x00, 0x6c, 0x00, 0x61, 0x00]);
        const { texto, codificacion, conBom } = leerSubtitulos(bytes);

        expect(texto).toBe('Hola');
        expect(codificacion).toBe('utf-16le');
        expect(conBom).toBe(true);
    });

    it('un archivo sin nada raro se lee como UTF-8', () => {
        const { codificacion } = leerSubtitulos(enUtf8('Hello world'));
        expect(codificacion).toBe('utf-8');
    });
});

describe('guardar un archivo de subtítulos', () => {
    const bytesDe = async (blob) => new Uint8Array(await blob.arrayBuffer());

    it('escribe en UTF-8', async () => {
        const bytes = await bytesDe(guardarSubtitulos('Canción'));
        expect(bytes).toEqual(enUtf8('Canción'));
    });

    it('devuelve la marca del principio si el archivo la traía', async () => {
        const bytes = await bytesDe(guardarSubtitulos('Hola', { conBom: true }));
        expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    });

    it('y no la pone si no la traía', async () => {
        const bytes = await bytesDe(guardarSubtitulos('Hola'));
        expect(bytes[0]).not.toBe(0xef);
    });

    it('un archivo en Windows-1252 se puede abrir y volver a guardar sin perder letras', async () => {
        // Sale en UTF-8, que es lo que entiende todo lo de hoy, pero con las
        // mismas letras: eso es lo que no puede cambiar.
        const { texto } = leerSubtitulos(enWindows1252('Mañana, corazón'));
        const bytes = await bytesDe(guardarSubtitulos(texto));

        expect(new TextDecoder('utf-8').decode(bytes)).toBe('Mañana, corazón');
    });
});
