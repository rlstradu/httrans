/**
 * La tabla de formatos, y sobre todo lo que cada uno puede hacer.
 *
 * No todos los formatos saben lo mismo, y esa diferencia no es cosa de quien
 * traduce: ofrecerle el botón de la posición con un SRT abierto es ofrecerle
 * algo que en ese formato no existe. La lista la lleva el formato y la fila de
 * botones se pinta con lo que diga, así que lo que se comprueba aquí es que la
 * lista está completa y dice la verdad.
 */
import { describe, expect, it } from 'vitest';
import { FORMATOS, SE_PUEDE, conLaExtensionDe, formatoPorId, sinExtension } from '../src/js/core/formatos.js';

const LO_QUE_SE_OFRECE = ['cursiva', 'negrita', 'subrayado', 'color', 'posicion'];
const RESPUESTAS = Object.values(SE_PUEDE);

describe('lo que puede cada formato', () => {
    it('todos los formatos contestan por todo lo que se ofrece', () => {
        // Si un formato se deja una sin contestar, su botón se pinta por
        // costumbre y no porque nadie lo haya decidido.
        for (const formato of FORMATOS) {
            for (const cual of LO_QUE_SE_OFRECE) {
                expect(formato.puede?.[cual], `${formato.id} → ${cual}`).toBeDefined();
            }
        }
    });

    it('y contestan una de las tres, no lo que sea', () => {
        for (const formato of FORMATOS) {
            for (const cual of LO_QUE_SE_OFRECE) {
                expect(RESPUESTAS, `${formato.id} → ${cual}`).toContain(formato.puede[cual]);
            }
        }
    });

    it('no inventan respuestas que la fila de botones no sabe pintar', () => {
        for (const formato of FORMATOS) {
            expect(Object.keys(formato.puede).sort()).toEqual([...LO_QUE_SE_OFRECE].sort());
        }
    });

    it('la cursiva se puede en los cuatro: es lo que más se usa al traducir', () => {
        for (const formato of FORMATOS) {
            expect(formato.puede.cursiva, formato.id).toBe(SE_PUEDE.SI);
        }
    });

    it('la posición se ofrece en ASS y en WebVTT, que es donde está hecha', () => {
        // El SRT no la tiene: no existe en ese formato. El TTML sí la tiene,
        // con regiones declaradas en la cabecera, pero subpandaTM todavía no
        // las escribe, y para quien traduce el efecto es el mismo.
        const conPosicion = { srt: SE_PUEDE.NO, vtt: SE_PUEDE.SI, ttml: SE_PUEDE.NO, ass: SE_PUEDE.SI };
        for (const formato of FORMATOS) {
            expect(formato.puede.posicion, formato.id).toBe(conPosicion[formato.id]);
        }
    });

    it('el que ofrece posición sabe ponerla y sabe leerla', () => {
        // Ofrecer el botón sin saber escribirlo sería el fallo que esta tabla
        // existe para evitar, solo que al revés.
        for (const formato of FORMATOS) {
            if (formato.puede.posicion !== SE_PUEDE.SI) continue;
            // El ASS la escribe en el texto y por eso no trae `ponerLaPosicion`
            // propia; lo que sí tienen que traer los dos es cómo leerla.
            expect(typeof formato.posicionDe, formato.id).toBe('function');
        }
    });

    it('el color de un SRT queda marcado como "según el reproductor"', () => {
        // El <font> del SRT no está en ninguna norma —el SRT no tiene norma—:
        // los reproductores de ordenador lo respetan y muchos de televisión lo
        // quitan. Es lo único de toda la tabla que no es un sí o un no.
        expect(formatoPorId('srt').puede.color).toBe(SE_PUEDE.SEGUN);
    });

    it('y en los tres formatos con norma escrita el color es un sí', () => {
        for (const id of ['vtt', 'ttml', 'ass']) {
            expect(formatoPorId(id).puede.color, id).toBe(SE_PUEDE.SI);
        }
    });
});

describe('el nombre que se propone al exportar', () => {
    // Es lo que sale escrito en el cuadro de exportar, así que un nombre feo
    // aquí es un archivo feo en el disco del cliente.
    const propuesto = (nombre, id) => conLaExtensionDe(sinExtension(nombre) + '_trad', formatoPorId(id));

    it('cambia la extensión sin arrastrar la que traía', () => {
        expect(propuesto('pelicula.srt', 'srt')).toBe('pelicula_trad.srt');
        expect(propuesto('pelicula.vtt', 'vtt')).toBe('pelicula_trad.vtt');
    });

    it('y también en los formatos que se añadieron después', () => {
        // Aquí salía "pelicula.ass_trad.ass": el recorte de la extensión solo
        // sabía de .srt y .vtt, y se quedó así al añadir los otros dos.
        expect(propuesto('pelicula.ass', 'ass')).toBe('pelicula_trad.ass');
        expect(propuesto('pelicula.ssa', 'ass')).toBe('pelicula_trad.ass');
        expect(propuesto('pelicula.ttml', 'ttml')).toBe('pelicula_trad.ttml');
        expect(propuesto('pelicula.dfxp', 'ttml')).toBe('pelicula_trad.ttml');
        expect(propuesto('pelicula.xml', 'ttml')).toBe('pelicula_trad.ttml');
    });

    it('un punto en medio del nombre no se confunde con la extensión', () => {
        expect(propuesto('cap.01.ass', 'ass')).toBe('cap.01_trad.ass');
    });

    it('y un nombre sin extensión no pierde nada', () => {
        expect(propuesto('pelicula', 'srt')).toBe('pelicula_trad.srt');
    });
});
