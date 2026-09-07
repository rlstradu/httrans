/**
 * Detección de etiquetas y códigos dentro de los segmentos.
 *
 * Una etiqueta es cualquier trozo del texto que no se traduce y tiene que
 * sobrevivir intacto: %s, {nombre}, <a href="...">. Si se pierde una, el archivo
 * se rompe; si se cambia el orden de dos, el programa muestra los datos
 * cambiados de sitio. Por eso todas las herramientas TAO las tratan aparte.
 *
 * Lo que se comprueba aquí es el reconocimiento: qué es etiqueta y qué no en
 * cada formato. Es la base de todo lo demás (pintarlas, insertarlas, avisar de
 * las que faltan), así que un fallo aquí se propaga a todo.
 */
import { describe, it, expect } from 'vitest';
import {
    compararEtiquetas,
    extraerEtiquetas,
    partirPorEtiquetas,
    perfilDeFormato,
} from '../src/js/core/etiquetas.js';

const po = perfilDeFormato('po');
const json = perfilDeFormato('json');
const html = perfilDeFormato('html');

/** Atajo: los textos de las etiquetas encontradas, en orden. */
const marcas = (texto, perfil) => extraerEtiquetas(texto, perfil).map((e) => e.texto);

describe('perfilDeFormato', () => {
    it('da un perfil por formato y uno de reserva para lo desconocido', () => {
        expect(perfilDeFormato('po').id).toBe('po');
        expect(perfilDeFormato('json').id).toBe('json');
        expect(perfilDeFormato('html').id).toBe('html');
        // Un formato que no conocemos no puede quedarse sin perfil: se le da el
        // más general, que reconoce lo común a todos.
        expect(perfilDeFormato('cualquiera')).toBeTruthy();
        expect(perfilDeFormato(undefined)).toBeTruthy();
    });
});

describe('extraerEtiquetas en archivos PO', () => {
    it('encuentra los marcadores de printf', () => {
        expect(marcas('Hola %s, tienes %d mensajes', po)).toEqual(['%s', '%d']);
    });

    it('encuentra los marcadores numerados y con nombre', () => {
        expect(marcas('%1$s ha invitado a %2$s', po)).toEqual(['%1$s', '%2$s']);
        expect(marcas('Hola %(nombre)s', po)).toEqual(['%(nombre)s']);
        expect(marcas('Total: %.2f euros', po)).toEqual(['%.2f']);
    });

    it('no confunde el porcentaje escapado con un marcador', () => {
        // En gettext, "%%" es un signo de porcentaje literal, no un hueco: si se
        // tratara como etiqueta, cada "50%%" pediría rellenar algo.
        expect(marcas('Descuento del 50%% en todo', po)).toEqual([]);
    });

    it('encuentra las llaves', () => {
        expect(marcas('Hola {nombre}, van {0} intentos', po)).toEqual(['{nombre}', '{0}']);
    });

    it('encuentra el HTML de dentro del texto', () => {
        expect(marcas('Lee la <a href="/ayuda">ayuda</a> antes', po)).toEqual([
            '<a href="/ayuda">',
            '</a>',
        ]);
        expect(marcas('Primera línea<br />segunda', po)).toEqual(['<br />']);
    });

    it('deja en paz el texto que solo se le parece', () => {
        expect(marcas('El precio es 5 < 7 y 9 > 3', po)).toEqual([]);
        expect(marcas('Sin nada que marcar.', po)).toEqual([]);
    });
});

describe('extraerEtiquetas en archivos JSON', () => {
    it('encuentra las llaves dobles de i18next y las simples de ICU', () => {
        expect(marcas('Hola {{nombre}}, tienes {contador} avisos', json)).toEqual([
            '{{nombre}}',
            '{contador}',
        ]);
    });

    it('encuentra los marcadores con porcentaje y llave', () => {
        expect(marcas('Hola %{nombre}', json)).toEqual(['%{nombre}']);
    });

    it('encuentra las etiquetas numeradas de react-i18next', () => {
        expect(marcas('Pulsa <0>aquí</0> para seguir', json)).toEqual(['<0>', '</0>']);
    });
});

describe('extraerEtiquetas en archivos HTML', () => {
    it('encuentra las etiquetas de formato con y sin atributos', () => {
        expect(marcas('Texto <strong>en negrita</strong> y <em>cursiva</em>', html)).toEqual([
            '<strong>',
            '</strong>',
            '<em>',
            '</em>',
        ]);
        expect(marcas('<span class="x">algo</span>', html)).toEqual(['<span class="x">', '</span>']);
    });

    it('encuentra las que no llevan cierre', () => {
        expect(marcas('Uno<br>dos<br/>tres', html)).toEqual(['<br>', '<br/>']);
    });
});

describe('clasificación de las etiquetas', () => {
    it('distingue apertura, cierre, sueltas y huecos', () => {
        const encontradas = extraerEtiquetas('<b>%s</b><br/>{n}', po);
        expect(encontradas.map((e) => e.tipo)).toEqual(['apertura', 'hueco', 'cierre', 'suelta', 'hueco']);
    });

    it('empareja la apertura con su cierre por el nombre', () => {
        const [abre, cierra] = extraerEtiquetas('<a href="/x">y</a>', po);
        expect(abre.nombre).toBe('a');
        expect(cierra.nombre).toBe('a');
    });

    it('dice en qué posición del texto está cada una', () => {
        const [primera] = extraerEtiquetas('Hola %s', po);
        expect(primera.inicio).toBe(5);
        expect(primera.fin).toBe(7);
    });
});

describe('partirPorEtiquetas', () => {
    it('devuelve el texto troceado en partes de texto y de etiqueta', () => {
        expect(partirPorEtiquetas('Hola %s, adiós', po)).toEqual([
            { esEtiqueta: false, texto: 'Hola ' },
            { esEtiqueta: true, texto: '%s' },
            { esEtiqueta: false, texto: ', adiós' },
        ]);
    });

    it('no pierde nada al trocear', () => {
        const texto = 'Antes <b>%1$s</b> {n} después';
        const trozos = partirPorEtiquetas(texto, po);
        expect(trozos.map((t) => t.texto).join('')).toBe(texto);
    });

    it('aguanta el texto vacío y el texto sin etiquetas', () => {
        expect(partirPorEtiquetas('', po)).toEqual([]);
        expect(partirPorEtiquetas('Sin nada', po)).toEqual([
            { esEtiqueta: false, texto: 'Sin nada' },
        ]);
    });
});

describe('compararEtiquetas', () => {
    it('no dice nada cuando están todas y en el mismo orden', () => {
        const r = compararEtiquetas('Hola %s, tienes %d', 'Hola %s, tienes %d avisos', po);
        expect(r.correcto).toBe(true);
        expect(r.faltan).toEqual([]);
        expect(r.sobran).toEqual([]);
    });

    it('avisa de la que falta', () => {
        const r = compararEtiquetas('Hola %s, tienes %d', 'Hola %s', po);
        expect(r.correcto).toBe(false);
        expect(r.faltan).toEqual(['%d']);
    });

    it('avisa de la que sobra', () => {
        const r = compararEtiquetas('Hola %s', 'Hola %s %s', po);
        expect(r.correcto).toBe(false);
        expect(r.sobran).toEqual(['%s']);
    });

    it('cuenta las repetidas, no solo si aparecen', () => {
        // Dos %s en el original y uno solo en la traducción es un error, aunque
        // "%s" sí esté presente.
        const r = compararEtiquetas('%s y %s', 'solo %s', po);
        expect(r.faltan).toEqual(['%s']);
    });

    it('avisa cuando están todas pero cambiadas de orden', () => {
        // Es el error más traicionero: el archivo se guarda sin quejarse y el
        // programa acaba enseñando los datos cambiados de sitio.
        const r = compararEtiquetas('%1$s invitó a %2$s', '%2$s fue invitado por %1$s', po);
        expect(r.faltan).toEqual([]);
        expect(r.sobran).toEqual([]);
        expect(r.ordenCambiado).toBe(true);
        expect(r.correcto).toBe(false);
    });

    it('no llama desorden a lo que solo es una etiqueta repetida', () => {
        const r = compararEtiquetas('<b>uno</b> <b>dos</b>', '<b>eins</b> <b>zwei</b>', po);
        expect(r.correcto).toBe(true);
    });

    it('avisa de una apertura sin su cierre', () => {
        const r = compararEtiquetas('<b>negrita</b>', '<b>negrita', po);
        expect(r.faltan).toEqual(['</b>']);
        expect(r.sinCerrar).toEqual(['<b>']);
    });

    it('avisa de un cierre suelto', () => {
        // Se ha borrado la apertura al traducir y ha quedado el cierre huérfano.
        const r = compararEtiquetas('<b>x</b>', 'x</b>', po);
        expect(r.cierresSueltos).toEqual(['</b>']);
        expect(r.faltan).toEqual(['<b>']);
    });

    it('no dice nada de una traducción todavía vacía', () => {
        // Mientras no se ha escrito nada no hay error que señalar: sería un
        // aviso rojo en cada segmento del archivo desde el momento de abrirlo.
        const r = compararEtiquetas('Hola %s', '', po);
        expect(r.correcto).toBe(true);
        expect(r.vacia).toBe(true);
    });

    it('tampoco dice nada cuando el original no tiene etiquetas', () => {
        const r = compararEtiquetas('Texto normal', 'Texto traducido', po);
        expect(r.correcto).toBe(true);
    });

    it('resume el problema en una frase legible', () => {
        const r = compararEtiquetas('Hola %s y %d', 'Hola %s', po);
        expect(r.resumen).toContain('%d');
    });
});
