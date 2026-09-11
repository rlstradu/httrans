/**
 * El formato SRT.
 *
 * La promesa de fondo de subpandaTM es que abrir un archivo y guardarlo sin
 * traducir nada devuelve el mismo archivo. Si eso falla, todo lo demás da
 * igual, así que es lo primero que se comprueba aquí.
 */
import { describe, expect, it } from 'vitest';
import {
    calculateCPS,
    countCharactersWithoutTags,
    countWords,
    formatFrameTime,
    formatTime,
    parseFrameTime,
    parseSrtContent,
    parseTime,
    reconstructOriginalSrt,
    reconstructSrt,
} from '@core/srt.js';

const EJEMPLO = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,500
This is a subtitle
with two lines

3
00:01:07,250 --> 00:01:09,000
Goodbye`;

describe('leer un SRT', () => {
    it('separa los subtítulos por su línea en blanco', () => {
        expect(parseSrtContent(EJEMPLO)).toHaveLength(3);
    });

    it('lee los tiempos hasta el milisegundo', () => {
        const [uno, dos, tres] = parseSrtContent(EJEMPLO);
        expect([uno.startTimeMs, uno.endTimeMs]).toEqual([1000, 3000]);
        expect([dos.startTimeMs, dos.endTimeMs]).toEqual([4000, 6500]);
        expect([tres.startTimeMs, tres.endTimeMs]).toEqual([67250, 69000]);
        expect(dos.durationMs).toBe(2500);
    });

    it('conserva el texto de varias líneas', () => {
        expect(parseSrtContent(EJEMPLO)[1].original).toBe('This is a subtitle\nwith two lines');
    });

    it('entiende los saltos de línea de Windows', () => {
        // Los archivos vienen de todas partes; los de Windows llevan CRLF.
        const conCrlf = EJEMPLO.replace(/\n/g, '\r\n');
        expect(parseSrtContent(conCrlf)).toHaveLength(3);
        expect(parseSrtContent(conCrlf)[1].original).toBe('This is a subtitle\nwith two lines');
    });

    it('lo que no tiene línea de tiempos no es un subtítulo', () => {
        // Un trozo de texto suelto al principio del archivo, o un archivo que no
        // es un SRT, no puede convertirse en subtítulos con tiempos inventados.
        expect(parseSrtContent('esto no es un srt')).toHaveLength(0);
        expect(parseSrtContent('1\nHello world')).toHaveLength(0);
    });

    it('un subtítulo sin texto sí lo es', () => {
        // Tiene sus tiempos y su número: es un hueco a propósito, y saltárselo
        // corre la numeración de todo lo que viene detrás. Antes se descartaba.
        const [uno] = parseSrtContent('1\n00:00:01,000 --> 00:00:03,000');
        expect(uno.original).toBe('');
        expect(uno.durationMs).toBe(2000);
    });

    it('empieza sin traducir', () => {
        const [uno] = parseSrtContent(EJEMPLO);
        expect(uno.translation).toBe('');
        expect(uno.isTranslated).toBe(false);
    });
});

describe('volver a escribir el SRT', () => {
    it('abrir y guardar sin traducir devuelve el mismo archivo', () => {
        // Con su salto de línea final, que es como acaba un SRT. El ejemplo de
        // aquí arriba no lo trae porque es una plantilla escrita a mano.
        expect(reconstructOriginalSrt(parseSrtContent(EJEMPLO))).toBe(`${EJEMPLO}\n`);
    });

    it('con traducción, escribe la traducción y no el original', () => {
        const subtitulos = parseSrtContent(EJEMPLO);
        subtitulos[0].translation = 'Hola mundo';
        const escrito = reconstructSrt(subtitulos);
        expect(escrito).toContain('Hola mundo');
        expect(escrito).not.toContain('Hello world');
    });

    it('un subtítulo sin traducir conserva su original', () => {
        // Entregar a medias no puede significar entregar líneas vacías.
        const subtitulos = parseSrtContent(EJEMPLO);
        subtitulos[0].translation = 'Hola mundo';
        expect(reconstructSrt(subtitulos)).toContain('Goodbye');
    });

    it('convierte a saltos de línea lo que el editor escribe como HTML', () => {
        const subtitulos = parseSrtContent(EJEMPLO);
        subtitulos[0].translation = 'Primera línea<br>Segunda línea';
        expect(reconstructSrt(subtitulos)).toContain('Primera línea\nSegunda línea');

        subtitulos[0].translation = '<div>Primera</div><div>Segunda</div>';
        expect(reconstructSrt(subtitulos)).toContain('Primera\nSegunda');
    });

    it('conserva la negrita y la cursiva, y se lleva el resto de etiquetas', () => {
        // <b> e <i> significan algo en un subtítulo y los reproductores las
        // entienden; un <span style> del portapapeles, no.
        const subtitulos = parseSrtContent(EJEMPLO);
        subtitulos[0].translation = '<span style="color:red"><i>Hola</i> <b>mundo</b></span>';
        expect(reconstructSrt(subtitulos)).toContain('<i>Hola</i> <b>mundo</b>');
        expect(reconstructSrt(subtitulos)).not.toContain('span');
    });
});

describe('los tiempos', () => {
    it('ida y vuelta entre milisegundos y código de tiempo', () => {
        for (const ms of [0, 1, 999, 1000, 61_000, 3_661_001, 36_000_000]) {
            expect(parseTime(formatTime(ms))).toBe(ms);
        }
    });

    it('escribe siempre con dos cifras y tres de milisegundos', () => {
        expect(formatTime(0)).toBe('00:00:00,000');
        expect(formatTime(61_001)).toBe('00:01:01,001');
    });

    it('cuenta en fotogramas para quien trabaja con vídeo', () => {
        // Un subtítulo no puede empezar a mitad de fotograma.
        expect(formatFrameTime(1000, 25)).toBe('00:00:01:00');
        expect(formatFrameTime(1040, 25)).toBe('00:00:01:01');
        expect(parseFrameTime('00:00:01:01', 25)).toBe(1040);
    });

    it('un código de tiempo de fotogramas mal escrito se rechaza', () => {
        expect(() => parseFrameTime('00:00:01', 25)).toThrow();
    });
});

describe('los recuentos', () => {
    it('cuenta palabras sin dejarse engañar por los espacios de más', () => {
        expect(countWords('  Hola   mundo  ')).toBe(2);
        expect(countWords('')).toBe(0);
    });

    it('no cuenta las etiquetas como caracteres', () => {
        // Un <i> que el espectador no ve no puede gastar cuatro caracteres del
        // límite de la línea.
        expect(countCharactersWithoutTags('<i>Hola</i>')).toBe(4);
        expect(countCharactersWithoutTags('Hola&nbsp;mundo')).toBe(10);
    });

    it('el salto de línea no cuenta como carácter', () => {
        // Partir un subtítulo en dos líneas es lo que se hace para que se lea
        // mejor: si el salto contara, hacerlo subiría los CPS y parecería que
        // se ha empeorado.
        expect(countCharactersWithoutTags('Hola\nmundo')).toBe(9);
        expect(Number(calculateCPS('12345\n67890', 1000))).toBe(10);
    });

    it('los CPS salen de lo que se lee y del tiempo que hay para leerlo', () => {
        expect(Number(calculateCPS('12345678901234567890', 2000))).toBe(10);
        // Sin duración no hay CPS que valgan, y dividir por cero daría infinito.
        expect(calculateCPS('Hola', 0)).toBe(0);
    });
});
