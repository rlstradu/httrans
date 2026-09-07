/**
 * Etiquetas indivisibles: qué selección hace falta antes de que edite el navegador.
 *
 * En Trados y en memoQ una etiqueta es una pieza: le das a retroceso encima y
 * desaparece entera, no se queda en "<a hre=". Poanda lo consigue sin cambiar el
 * cuadro de texto por nada raro: cuando la tecla iba a partir una etiqueta, se
 * amplía la selección para que abarque la etiqueta completa y se deja que borre
 * el navegador. Como la edición la hace él, el deshacer de siempre sigue
 * funcionando, que es lo que se pierde en cuanto uno se pone a falsificar
 * ediciones a mano.
 *
 * Aquí se prueba solo la decisión —qué trozo hay que seleccionar—, que es donde
 * está toda la lógica y donde se puede probar sin navegador.
 */
import { describe, it, expect } from 'vitest';
import { perfilDeFormato } from '../src/js/core/etiquetas.js';
import { ajusteDeSeleccion } from '../src/js/core/etiquetas-guardia.js';

const po = perfilDeFormato('po');

/** Atajo: decide el ajuste sobre un texto, con el cursor o la selección dada. */
const ajuste = (texto, inicio, fin, tecla) =>
    ajusteDeSeleccion({ texto, inicio, fin, tecla, perfil: po });

describe('retroceso', () => {
    it('con el cursor justo detrás de una etiqueta, la selecciona entera', () => {
        //            0123456
        //            Hola %s|
        expect(ajuste('Hola %s', 7, 7, 'Backspace')).toEqual({ inicio: 5, fin: 7 });
    });

    it('con el cursor dentro de una etiqueta, también', () => {
        // "Hola <b|>" — el cursor está partiendo la etiqueta por la mitad.
        expect(ajuste('Hola <b>', 7, 7, 'Backspace')).toEqual({ inicio: 5, fin: 8 });
    });

    it('no toca nada en el texto normal', () => {
        expect(ajuste('Hola mundo', 10, 10, 'Backspace')).toBeNull();
    });

    it('no toca nada justo delante de una etiqueta', () => {
        // "Hola |%s": el retroceso se lleva el espacio, que es lo que toca.
        expect(ajuste('Hola %s', 5, 5, 'Backspace')).toBeNull();
    });

    it('coge la etiqueta correcta cuando hay varias', () => {
        //            0123456789
        //            %s y %d
        expect(ajuste('%s y %d', 7, 7, 'Backspace')).toEqual({ inicio: 5, fin: 7 });
        expect(ajuste('%s y %d', 2, 2, 'Backspace')).toEqual({ inicio: 0, fin: 2 });
    });
});

describe('suprimir', () => {
    it('con el cursor justo delante de una etiqueta, la selecciona entera', () => {
        expect(ajuste('Hola %s', 5, 5, 'Delete')).toEqual({ inicio: 5, fin: 7 });
    });

    it('con el cursor dentro, también', () => {
        expect(ajuste('Hola <b>', 6, 6, 'Delete')).toEqual({ inicio: 5, fin: 8 });
    });

    it('no toca nada justo detrás de una etiqueta', () => {
        // "Hola %s|mundo": suprimir se lleva la "m", que es lo que toca.
        expect(ajuste('Hola %smundo', 7, 7, 'Delete')).toBeNull();
    });
});

describe('escribir', () => {
    it('dentro de una etiqueta, saca el cursor al final en vez de partirla', () => {
        // Escribir en "<b|>" dejaría "<bx>", que ya no es la etiqueta que era.
        expect(ajuste('Hola <b>', 7, 7, 'texto')).toEqual({ inicio: 8, fin: 8 });
    });

    it('pegado a una etiqueta, por fuera, no molesta', () => {
        expect(ajuste('Hola %s', 7, 7, 'texto')).toBeNull();
        expect(ajuste('Hola %s', 5, 5, 'texto')).toBeNull();
    });

    it('en texto normal, no molesta', () => {
        expect(ajuste('Hola mundo', 4, 4, 'texto')).toBeNull();
    });
});

describe('selecciones', () => {
    it('una selección que parte una etiqueta se amplía hasta abarcarla', () => {
        // Seleccionado "la <b" de "Hola <b>x": al borrar quedaría ">" suelto.
        expect(ajuste('Hola <b>x', 2, 7, 'Backspace')).toEqual({ inicio: 2, fin: 8 });
    });

    it('se amplía por los dos lados si hace falta', () => {
        //            0123456789...
        //            <b>Hola</b>
        const texto = '<b>Hola</b>';
        expect(ajuste(texto, 2, 9, 'Backspace')).toEqual({ inicio: 0, fin: 11 });
    });

    it('una selección que ya abarca etiquetas enteras se deja como está', () => {
        expect(ajuste('<b>Hola</b>', 0, 11, 'Backspace')).toBeNull();
    });

    it('una selección de texto normal se deja como está', () => {
        expect(ajuste('Hola mundo entero', 5, 10, 'Backspace')).toBeNull();
    });

    it('también se amplía al escribir encima de la selección', () => {
        // Escribir con algo seleccionado sustituye lo seleccionado: si la
        // selección parte una etiqueta, la sustitución la dejaría a medias.
        expect(ajuste('Hola <b>x', 2, 7, 'texto')).toEqual({ inicio: 2, fin: 8 });
    });
});

describe('casos de borde', () => {
    it('aguanta el texto vacío', () => {
        expect(ajuste('', 0, 0, 'Backspace')).toBeNull();
        expect(ajuste('', 0, 0, 'texto')).toBeNull();
    });

    it('aguanta el principio y el final del texto', () => {
        expect(ajuste('%s', 0, 0, 'Backspace')).toBeNull();
        expect(ajuste('%s', 2, 2, 'Delete')).toBeNull();
    });

    it('no se inventa nada con una tecla que no edita', () => {
        expect(ajuste('Hola %s', 7, 7, 'ArrowLeft')).toBeNull();
    });

    it('respeta el perfil del formato', () => {
        // {{nombre}} es una etiqueta en JSON y dos llaves sueltas en PO.
        const enJson = ajusteDeSeleccion({
            texto: 'Hola {{nombre}}',
            inicio: 15,
            fin: 15,
            tecla: 'Backspace',
            perfil: perfilDeFormato('json'),
        });
        expect(enJson).toEqual({ inicio: 5, fin: 15 });
    });
});
