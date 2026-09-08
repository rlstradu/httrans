/**
 * El motor de IA.
 *
 * Nada de esto llama a un servicio de verdad: se le pasa un `fetch` de mentira
 * que devuelve lo que hace falta para cada caso. Así se pueden probar los casos
 * que importan —que son los malos— sin gastar una sola llamada.
 *
 * Lo que más se comprueba aquí es la protección de las etiquetas, porque es lo
 * único de todo esto que puede romper el archivo de un cliente. La regla es:
 * ante la duda, no se guarda la traducción.
 */
import { describe, it, expect, vi } from 'vitest';
import { ponerMarcas, quitarMarcas } from '../src/js/core/ia/marcadores.js';
import { encargoDeTraducir, leerVariasTraducciones } from '../src/js/core/ia/prompt.js';
import { conversar, probarConexion, proveedorPorId } from '../src/js/core/ia/proveedores.js';
import { revisarTraduccion, traducirLote, traducirUno } from '../src/js/core/ia/traducir.js';
import { ErrorDeIA } from '../src/js/core/ia/http.js';
import { perfilDeFormato } from '../src/js/core/etiquetas.js';
import { pretraducir, repartirTrabajo, enGrupos } from '../src/js/core/ia/pretraducir.js';
import {
    idiomaCorto,
    prepararTraductorDelNavegador,
} from '../src/js/core/ia/navegador.js';
import { hayServicioConectado } from '../src/js/core/ia/ajustes.js';

/** Un fetch de mentira que siempre contesta lo mismo. */
function fetchQueDevuelve(datos, { estado = 200, cabeceras = {} } = {}) {
    return vi.fn(async () => ({
        ok: estado >= 200 && estado < 300,
        status: estado,
        headers: { get: (n) => cabeceras[n] || null },
        text: async () => (typeof datos === 'string' ? datos : JSON.stringify(datos)),
    }));
}

/** Lo que contesta OpenAI cuando todo va bien. */
const respuestaDeOpenAI = (texto) => ({ choices: [{ message: { content: texto } }] });

const CONFIG = { proveedor: 'openai', modelo: 'gpt-4o-mini', clave: 'sk-prueba', baseUrl: '' };

describe('proteger las etiquetas', () => {
    const perfil = perfilDeFormato('po');

    it('las etiquetas se cambian por marcas antes de mandar el texto', () => {
        // Al modelo no se le enseña "%s": se le enseña una marca. Lo que no ve,
        // no lo puede estropear.
        const { texto, etiquetas } = ponerMarcas('Pulsa %s para guardar', perfil);
        expect(texto).toBe('Pulsa ⟦0⟧ para guardar');
        expect(etiquetas).toEqual(['%s']);
    });

    it('las marcas vuelven a ser etiquetas al recibir la respuesta', () => {
        const { etiquetas } = ponerMarcas('Press %s to save <b>now</b>', perfil);
        const vuelta = quitarMarcas('Pulsa ⟦0⟧ para guardar ⟦1⟧ahora⟦2⟧', etiquetas);

        expect(vuelta.bien).toBe(true);
        expect(vuelta.texto).toBe('Pulsa %s para guardar <b>ahora</b>');
    });

    it('la etiqueta puede cambiar de sitio en la traducción', () => {
        // Es medio motivo de hacerlo así: en otro idioma el hueco cae en otro
        // lado de la frase.
        const { etiquetas } = ponerMarcas('%s files found', perfil);
        expect(quitarMarcas('Se han encontrado ⟦0⟧ archivos', etiquetas).texto).toBe(
            'Se han encontrado %s archivos',
        );
    });

    it('si falta una marca, la traducción no vale', () => {
        const { etiquetas } = ponerMarcas('Pulsa %s para guardar', perfil);
        const vuelta = quitarMarcas('Pulsa para guardar', etiquetas);

        expect(vuelta.bien).toBe(false);
        expect(vuelta.problema).toBe('faltan marcas');
    });

    it('si el modelo repite una marca, tampoco', () => {
        const { etiquetas } = ponerMarcas('Pulsa %s', perfil);
        expect(quitarMarcas('Pulsa ⟦0⟧ y ⟦0⟧', etiquetas).problema).toBe('marca repetida');
    });

    it('si el modelo se inventa una marca, tampoco', () => {
        const { etiquetas } = ponerMarcas('Pulsa %s', perfil);
        expect(quitarMarcas('Pulsa ⟦0⟧ y ⟦7⟧', etiquetas).problema).toBe('marca inventada');
    });

    it('una marca a medias se detecta', () => {
        // "⟦0" sin cerrar no lo caza la expresión normal, y colarlo metería
        // basura invisible en el archivo.
        const { etiquetas } = ponerMarcas('Pulsa %s', perfil);
        expect(quitarMarcas('Pulsa ⟦0⟧ ⟦', etiquetas).problema).toBe('marca rota');
    });

    it('un texto sin etiquetas pasa tal cual', () => {
        const { texto, etiquetas } = ponerMarcas('Una frase normal', perfil);
        expect(texto).toBe('Una frase normal');
        expect(quitarMarcas('Una frase normal', etiquetas).bien).toBe(true);
    });
});

describe('revisar lo que contesta el modelo', () => {
    const bien = { bien: true, problema: '' };

    it('una traducción normal vale', () => {
        expect(revisarTraduccion('Save', 'Guardar', bien).vale).toBe(true);
    });

    it('una respuesta vacía no vale', () => {
        expect(revisarTraduccion('Save', '   ', bien).motivo).toBe('respuesta vacía');
    });

    it('devolver el original sin traducir no vale', () => {
        // Guardarlo dejaría el archivo "traducido" en inglés, que es peor que
        // dejarlo vacío: nadie lo revisa porque parece hecho.
        const largo = 'Please save the document before closing';
        expect(revisarTraduccion(largo, largo, bien).motivo).toBe('ha devuelto el original');
    });

    it('un original corto que coincide sí vale', () => {
        // "OK" se traduce por "OK" en media Europa; marcarlo como error sería
        // un aviso falso, y a los diez avisos falsos nadie mira los avisos.
        expect(revisarTraduccion('OK', 'OK', bien).vale).toBe(true);
    });

    it('si el modelo se pone a charlar, no vale', () => {
        expect(revisarTraduccion('Save', "Here's the translation: Guardar", bien).vale).toBe(false);
    });

    it('si las etiquetas no cuadran, no vale por mucho que el texto esté bien', () => {
        const revision = revisarTraduccion('Save %s', 'Guardar', {
            bien: false,
            problema: 'faltan marcas',
        });
        expect(revision.vale).toBe(false);
        expect(revision.motivo).toContain('faltan marcas');
    });
});

describe('hablar con los servicios', () => {
    it('OpenAI: manda el modelo y la clave donde toca', async () => {
        const fetchImpl = fetchQueDevuelve(respuestaDeOpenAI('Hola'));
        const respuesta = await conversar(CONFIG, [{ papel: 'persona', texto: 'Hi' }], {
            fetchImpl,
        });

        expect(respuesta).toBe('Hola');
        const [url, opciones] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        expect(opciones.headers.Authorization).toBe('Bearer sk-prueba');
        expect(JSON.parse(opciones.body).model).toBe('gpt-4o-mini');
    });

    it('Anthropic manda la cabecera que permite llamarlo desde el navegador', async () => {
        // Sin ella, Anthropic rechaza la llamada y no hay forma de usarlo desde
        // una página web.
        const fetchImpl = fetchQueDevuelve({ content: [{ type: 'text', text: 'Hola' }] });
        await conversar(
            { proveedor: 'anthropic', modelo: 'claude-sonnet-4-5', clave: 'sk-ant' },
            [{ papel: 'persona', texto: 'Hi' }],
            { fetchImpl },
        );

        const [, opciones] = fetchImpl.mock.calls[0];
        expect(opciones.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
        expect(opciones.headers['x-api-key']).toBe('sk-ant');
    });

    it('Gemini separa las instrucciones del sistema del resto', async () => {
        const fetchImpl = fetchQueDevuelve({
            candidates: [{ content: { parts: [{ text: 'Hola' }] } }],
        });
        await conversar(
            { proveedor: 'gemini', modelo: 'gemini-2.5-flash', clave: 'AIza' },
            [
                { papel: 'sistema', texto: 'Eres traductor' },
                { papel: 'persona', texto: 'Hi' },
            ],
            { fetchImpl },
        );

        const cuerpo = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(cuerpo.systemInstruction.parts[0].text).toBe('Eres traductor');
        expect(cuerpo.contents).toHaveLength(1);
    });

    it('una IA local se llama igual que OpenAI, solo cambia la dirección', async () => {
        // Es lo que permite que Ollama, LM Studio y llama-server salgan del
        // mismo código.
        const fetchImpl = fetchQueDevuelve(respuestaDeOpenAI('Hola'));
        await conversar(
            {
                proveedor: 'compatible',
                modelo: 'llama3.2',
                clave: '',
                baseUrl: 'http://127.0.0.1:11434/v1',
            },
            [{ papel: 'persona', texto: 'Hi' }],
            { fetchImpl },
        );

        expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/chat/completions');
    });

    it('la barra de más en la dirección no da una dirección con dos barras', async () => {
        const fetchImpl = fetchQueDevuelve(respuestaDeOpenAI('Hola'));
        await conversar(
            { proveedor: 'compatible', modelo: 'x', baseUrl: 'http://localhost:1234/v1/' },
            [{ papel: 'persona', texto: 'Hi' }],
            { fetchImpl },
        );

        expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:1234/v1/chat/completions');
    });

    it('sin clave, un servicio que la necesita lo dice antes de llamar', async () => {
        await expect(
            conversar({ proveedor: 'openai', modelo: 'gpt-4o-mini', clave: '' }, []),
        ).rejects.toThrow(/clave/i);
    });

    it('una IA local no pide clave', () => {
        expect(proveedorPorId('compatible').necesitaClave).toBe(false);
    });
});

describe('los fallos se distinguen', () => {
    it('una clave mal escrita no se reintenta', async () => {
        const fetchImpl = fetchQueDevuelve({ error: { message: 'Invalid API key' } }, { estado: 401 });

        await expect(
            conversar(CONFIG, [{ papel: 'persona', texto: 'Hi' }], { fetchImpl }),
        ).rejects.toMatchObject({ codigo: 'clave', reintentable: false });
    });

    it('"vas muy deprisa" se reintenta, y respeta lo que pida esperar', async () => {
        const fetchImpl = fetchQueDevuelve(
            { error: { message: 'Rate limit' } },
            { estado: 429, cabeceras: { 'retry-after': '30' } },
        );

        await expect(
            conversar(CONFIG, [{ papel: 'persona', texto: 'Hi' }], { fetchImpl }),
        ).rejects.toMatchObject({ codigo: 'limite', reintentable: true, esperarMs: 30000 });
    });

    it('quedarse sin saldo no se reintenta', async () => {
        const fetchImpl = fetchQueDevuelve({ error: { message: 'insufficient_quota' } }, { estado: 400 });
        await expect(
            conversar(CONFIG, [{ papel: 'persona', texto: 'Hi' }], { fetchImpl }),
        ).rejects.toMatchObject({ codigo: 'saldo', reintentable: false });
    });

    it('un fallo de red lo explica sin tecnicismos y menciona la IA local', async () => {
        // Desde el navegador, un fallo de red y "este servicio no acepta
        // llamadas desde una página web" son el mismo error, así que el
        // mensaje tiene que servir para los dos.
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });

        const error = await conversar(CONFIG, [{ papel: 'persona', texto: 'Hi' }], {
            fetchImpl,
        }).catch((e) => e);

        expect(error).toBeInstanceOf(ErrorDeIA);
        expect(error.codigo).toBe('red');
        expect(error.message).toMatch(/IA local/i);
    });
});

describe('comprobar la conexión', () => {
    /** Los identificadores de la lista, que es lo que se compara casi siempre. */
    const ids = (modelos) => modelos.map((m) => m.id);

    it('avisa si el modelo elegido no existe en el servicio', async () => {
        // Que el servicio conteste no basta: con un modelo que no tiene, la
        // primera traducción fallaría y costaría entender por qué.
        const fetchImpl = fetchQueDevuelve({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] });
        const resultado = await probarConexion(
            { ...CONFIG, modelo: 'un-modelo-que-no-existe' },
            { fetchImpl },
        );

        expect(resultado.bien).toBe(false);
        expect(resultado.mensaje).toContain('un-modelo-que-no-existe');
        expect(ids(resultado.modelos)).toContain('gpt-4o');
    });

    it('con todo en orden, dice que sí y trae la lista de modelos', async () => {
        const fetchImpl = fetchQueDevuelve({ data: [{ id: 'gpt-4o-mini' }] });
        const resultado = await probarConexion(CONFIG, { fetchImpl });

        expect(resultado.bien).toBe(true);
        expect(ids(resultado.modelos)).toEqual(['gpt-4o-mini']);
    });

    it('sin modelo elegido, conecta igual y trae la lista', async () => {
        // Es el caso normal la primera vez: se elige servicio, se pega la clave
        // y el modelo lo trae el servicio. Antes había que escribirlo antes de
        // poder comprobar nada.
        const fetchImpl = fetchQueDevuelve({ data: [{ id: 'gpt-4o' }] });
        const resultado = await probarConexion({ ...CONFIG, modelo: '' }, { fetchImpl });

        expect(resultado.bien).toBe(true);
        expect(ids(resultado.modelos)).toEqual(['gpt-4o']);
    });

    it('deja fuera lo que no sirve para traducir ni conversar', async () => {
        // Un desplegable con los modelos de voz, de imagen y de embeddings
        // mezclados obliga a saberse de memoria cuál es cuál.
        const fetchImpl = fetchQueDevuelve({
            data: [
                { id: 'gpt-4o' },
                { id: 'text-embedding-3-large' },
                { id: 'whisper-1' },
                { id: 'dall-e-3' },
                { id: 'tts-1-hd' },
                { id: 'omni-moderation-latest' },
            ],
        });
        const resultado = await probarConexion({ ...CONFIG, modelo: '' }, { fetchImpl });

        expect(ids(resultado.modelos)).toEqual(['gpt-4o']);
    });

    it('pone el más reciente el primero, por la fecha que da el servicio', async () => {
        const fetchImpl = fetchQueDevuelve({
            data: [
                { id: 'gpt-4o-mini', created: 1_700_000_000 },
                { id: 'gpt-5.2', created: 1_770_000_000 },
                { id: 'gpt-4o', created: 1_720_000_000 },
            ],
        });
        const resultado = await probarConexion({ ...CONFIG, modelo: '' }, { fetchImpl });

        expect(ids(resultado.modelos)).toEqual(['gpt-5.2', 'gpt-4o', 'gpt-4o-mini']);
    });

    it('sin fechas, ordena por el número de versión del nombre', async () => {
        // Es el caso de Gemini, que no da fecha ninguna. El número de versión
        // que llevan en el nombre es lo único que hay, y basta.
        const fetchImpl = fetchQueDevuelve({
            models: [
                { name: 'models/gemini-1.5-pro' },
                { name: 'models/gemini-3.0-pro' },
                { name: 'models/gemini-2.5-flash' },
                { name: 'models/text-embedding-004' },
            ],
        });
        const resultado = await probarConexion(
            { proveedor: 'gemini', clave: 'k', modelo: '' },
            { fetchImpl },
        );

        expect(ids(resultado.modelos)).toEqual([
            'gemini-3.0-pro',
            'gemini-2.5-flash',
            'gemini-1.5-pro',
        ]);
    });

    it('los preliminares van detrás de los terminados de la misma versión', async () => {
        // Un "preview" o un "exp" puede desaparecer sin avisar; como propuesta
        // por defecto no es lo que uno quiere para un encargo de un cliente.
        const fetchImpl = fetchQueDevuelve({
            models: [
                { name: 'models/gemini-2.5-flash-preview' },
                { name: 'models/gemini-2.5-flash' },
            ],
        });
        const resultado = await probarConexion(
            { proveedor: 'gemini', clave: 'k', modelo: '' },
            { fetchImpl },
        );

        expect(ids(resultado.modelos)[0]).toBe('gemini-2.5-flash');
    });

    it('lee la fecha de Anthropic, que la escribe de otra forma', async () => {
        const fetchImpl = fetchQueDevuelve({
            data: [
                { id: 'claude-3-5-haiku', created_at: '2024-10-22T00:00:00Z' },
                { id: 'claude-opus-4-5', created_at: '2026-02-11T00:00:00Z' },
            ],
        });
        const resultado = await probarConexion(
            { proveedor: 'anthropic', clave: 'k', modelo: '' },
            { fetchImpl },
        );

        expect(ids(resultado.modelos)[0]).toBe('claude-opus-4-5');
    });
});

describe('traducir', () => {
    it('un segmento suelto vuelve traducido y con su etiqueta', async () => {
        const fetchImpl = fetchQueDevuelve(respuestaDeOpenAI('Pulsa ⟦0⟧ para guardar'));
        const resultado = await traducirUno(
            { original: 'Press %s to save', config: CONFIG, formato: 'po' },
            { fetchImpl },
        );

        expect(resultado.vale).toBe(true);
        expect(resultado.traduccion).toBe('Pulsa %s para guardar');
    });

    it('si el modelo pierde la etiqueta, la traducción se descarta', async () => {
        const fetchImpl = fetchQueDevuelve(respuestaDeOpenAI('Pulsa para guardar'));
        const resultado = await traducirUno(
            { original: 'Press %s to save', config: CONFIG, formato: 'po' },
            { fetchImpl },
        );

        expect(resultado.vale).toBe(false);
        expect(resultado.motivo).toContain('faltan marcas');
    });

    it('un lote entero se traduce en una sola petición', async () => {
        // Es lo que hace que pretraducir no tarde una tarde: lo caro es el ir y
        // venir, no el texto.
        const fetchImpl = fetchQueDevuelve(
            respuestaDeOpenAI('["Guardar", "Cancelar", "Eliminar"]'),
        );
        const resultados = await traducirLote(
            { originales: ['Save', 'Cancel', 'Delete'], config: CONFIG, formato: 'po' },
            { fetchImpl },
        );

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(resultados.map((r) => r.traduccion)).toEqual(['Guardar', 'Cancelar', 'Eliminar']);
        expect(resultados.every((r) => r.vale)).toBe(true);
    });

    it('el JSON envuelto en un bloque de código se entiende igual', () => {
        expect(leerVariasTraducciones('```json\n["Uno", "Dos"]\n```', 2)).toEqual(['Uno', 'Dos']);
    });

    it('si vuelven menos traducciones de las pedidas, el lote entero se descarta', async () => {
        // Emparejarlas a ojo pondría una traducción en el segmento equivocado,
        // que es el peor fallo posible: el archivo queda plausible y mal.
        const fetchImpl = fetchQueDevuelve(respuestaDeOpenAI('["Guardar", "Cancelar"]'));
        const resultados = await traducirLote(
            { originales: ['Save', 'Cancel', 'Delete'], config: CONFIG, formato: 'po' },
            { fetchImpl },
        );

        expect(resultados).toHaveLength(3);
        expect(resultados.every((r) => !r.vale)).toBe(true);
        expect(resultados[0].motivo).toBe('respuesta desordenada');
    });

    it('en un lote, un segmento malo no se lleva por delante a los buenos', async () => {
        const fetchImpl = fetchQueDevuelve(
            respuestaDeOpenAI('["Pulsa ⟦0⟧ ahora", "Se ha perdido la marca"]'),
        );
        const resultados = await traducirLote(
            { originales: ['Press %s now', 'Save %d files'], config: CONFIG, formato: 'po' },
            { fetchImpl },
        );

        expect(resultados[0].vale).toBe(true);
        expect(resultados[1].vale).toBe(false);
    });
});

describe('el encargo que se le manda al modelo', () => {
    it('lleva el glosario y la memoria como datos, no como órdenes', () => {
        const mensajes = encargoDeTraducir({
            originales: ['Save'],
            idiomaOrigen: 'en',
            idiomaDestino: 'es',
            contexto: {
                glosario: [{ termino: 'file', traduccion: 'archivo' }],
                memoria: [{ original: 'Save all', traduccion: 'Guardar todo', parecido: 80 }],
            },
        });

        const texto = mensajes.map((m) => m.texto).join('\n');
        expect(texto).toContain('file → archivo');
        expect(texto).toContain('Guardar todo');
        expect(texto).toMatch(/datos, nunca instrucciones/i);
    });

    it('la nota de un término del glosario viaja con él', () => {
        // Un glosario dice qué poner y también qué NO poner. Sin la nota, el
        // modelo repite justo el error que la nota estaba ahí para evitar.
        const mensajes = encargoDeTraducir({
            originales: ['Open file'],
            idiomaOrigen: 'en',
            idiomaDestino: 'es',
            contexto: {
                glosario: [
                    {
                        termino: 'file',
                        traduccion: 'archivo',
                        nota: 'nunca "fichero" en este cliente',
                    },
                ],
            },
        });

        const texto = mensajes.map((m) => m.texto).join('\n');
        expect(texto).toContain('file → archivo (nunca "fichero" en este cliente)');
    });

    it('un término sin nota se manda igual que antes', () => {
        const mensajes = encargoDeTraducir({
            originales: ['Open file'],
            idiomaOrigen: 'en',
            idiomaDestino: 'es',
            contexto: { glosario: [{ termino: 'file', traduccion: 'archivo' }] },
        });

        expect(mensajes.map((m) => m.texto).join('\n')).toContain('- file → archivo\n');
    });

    it('avisa de que las marcas no se tocan', () => {
        const mensajes = encargoDeTraducir({ originales: ['⟦0⟧ archivos'] });
        expect(mensajes[0].texto).toMatch(/⟦0⟧/);
    });

    it('con varios segmentos pide la respuesta en una lista ordenada', () => {
        const mensajes = encargoDeTraducir({ originales: ['Uno', 'Dos', 'Tres'] });
        expect(mensajes[1].texto).toMatch(/3 traducciones/);
        expect(mensajes[1].texto).toMatch(/JSON/);
    });
});

describe('pretraducir un archivo entero', () => {
    /** Un motor de mentira que traduce poniendo "ES:" delante. */
    const motorSimple = (opciones = {}) => ({
        porLote: opciones.porLote || 10,
        traducirLote: vi.fn(async (originales) => {
            if (opciones.falla) throw Object.assign(new Error('caído'), { reintentable: true });
            return originales.map((o) => ({ traduccion: `ES:${o}`, vale: true, motivo: '' }));
        }),
    });

    const segmentos = (textos) =>
        textos.map((original, i) => ({ clave: `s${i}`, original }));

    it('lo que no es texto se copia sin gastar una llamada', async () => {
        // Una URL, un correo o un número no se traducen, y preguntárselo a una
        // IA es pagar por que te devuelva lo mismo.
        const motor = motorSimple();
        const { traducciones } = await pretraducir({
            segmentos: segmentos(['https://ejemplo.org', 'hola@ejemplo.org', '42', 'Save']),
            motor,
        });

        expect(traducciones.get('s0').origen).toBe('copia');
        expect(traducciones.get('s1').origen).toBe('copia');
        expect(traducciones.get('s2').origen).toBe('copia');
        expect(motor.traducirLote).toHaveBeenCalledTimes(1);
        expect(motor.traducirLote.mock.calls[0][0]).toEqual(['Save']);
    });

    it('lo que ya está en la memoria de traducción se coge de ahí', async () => {
        const motor = motorSimple();
        const { traducciones } = await pretraducir({
            segmentos: segmentos(['Save', 'Cancel']),
            memoria: [{ original: 'Save', traduccion: 'Guardar' }],
            motor,
        });

        expect(traducciones.get('s0')).toEqual({ traduccion: 'Guardar', origen: 'memoria' });
        expect(motor.traducirLote.mock.calls[0][0]).toEqual(['Cancel']);
    });

    it('un segmento repetido se traduce una vez y se copia', async () => {
        // En un archivo de software, "Save" puede salir cuarenta veces.
        const motor = motorSimple();
        const { traducciones } = await pretraducir({
            segmentos: segmentos(['Save', 'Cancel', 'Save']),
            motor,
        });

        expect(motor.traducirLote.mock.calls[0][0]).toEqual(['Save', 'Cancel']);
        expect(traducciones.get('s2').traduccion).toBe('ES:Save');
        expect(traducciones.get('s2').origen).toBe('repetido');
    });

    it('los segmentos se mandan en lotes, no de uno en uno', async () => {
        const motor = motorSimple({ porLote: 3 });
        await pretraducir({
            segmentos: segmentos(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
            motor,
            aLaVez: 1,
        });

        expect(motor.traducirLote).toHaveBeenCalledTimes(3);
        expect(motor.traducirLote.mock.calls[0][0]).toHaveLength(3);
        expect(motor.traducirLote.mock.calls[2][0]).toHaveLength(1);
    });

    it('los lotes se mandan a la vez, no esperando uno a otro', async () => {
        // Es la diferencia entre veinte minutos y dos horas.
        let simultaneos = 0;
        let maximo = 0;
        const motor = {
            porLote: 1,
            traducirLote: async (originales) => {
                simultaneos += 1;
                maximo = Math.max(maximo, simultaneos);
                await new Promise((r) => setTimeout(r, 5));
                simultaneos -= 1;
                return originales.map((o) => ({ traduccion: o, vale: true }));
            },
        };

        await pretraducir({ segmentos: segmentos(['a', 'b', 'c', 'd']), motor, aLaVez: 4 });
        expect(maximo).toBeGreaterThan(1);
    });

    it('va contando lo que lleva hecho', async () => {
        const avances = [];
        await pretraducir({
            segmentos: segmentos(['Save', 'Cancel']),
            motor: motorSimple(),
            alAvanzar: (a) => avances.push({ ...a }),
        });

        expect(avances[0].estado).toBe('preparando');
        expect(avances[avances.length - 1]).toMatchObject({ estado: 'terminado', hechos: 2, total: 2 });
    });

    it('lo que falla se apunta y no detiene lo demás', async () => {
        const motor = {
            porLote: 1,
            traducirLote: async (originales) =>
                originales.map((o) => ({
                    traduccion: o === 'malo' ? '' : `ES:${o}`,
                    vale: o !== 'malo',
                    motivo: o === 'malo' ? 'faltan marcas' : '',
                })),
        };

        const { traducciones, fallos } = await pretraducir({
            segmentos: segmentos(['bueno', 'malo', 'otro']),
            motor,
            aLaVez: 1,
        });

        expect(traducciones.size).toBe(2);
        expect(fallos).toHaveLength(1);
        expect(fallos[0].motivo).toBe('faltan marcas');
    });

    it('se puede cancelar a media faena', async () => {
        const control = new AbortController();
        const motor = {
            porLote: 1,
            traducirLote: async (originales) => {
                control.abort();
                return originales.map((o) => ({ traduccion: o, vale: true }));
            },
        };

        const resultado = await pretraducir({
            segmentos: segmentos(['a', 'b', 'c', 'd']),
            motor,
            aLaVez: 1,
            senal: control.signal,
        });

        expect(resultado.cancelado).toBe(true);
        // Lo ya traducido antes de cancelar no se tira.
        expect(resultado.traducciones.size).toBeGreaterThan(0);
    });

    it('un fallo pasajero se reintenta', async () => {
        let veces = 0;
        const motor = {
            porLote: 2,
            traducirLote: async (originales) => {
                veces += 1;
                if (veces === 1) throw Object.assign(new Error('red'), { reintentable: true, esperarMs: 1 });
                return originales.map((o) => ({ traduccion: `ES:${o}`, vale: true }));
            },
        };

        const { fallos } = await pretraducir({ segmentos: segmentos(['a', 'b']), motor });
        expect(veces).toBe(2);
        expect(fallos).toHaveLength(0);
    });

    it('una clave mal escrita no se reintenta', async () => {
        // Reintentar tres veces con una clave inválida es hacer esperar para
        // nada a quien mira la barra.
        let veces = 0;
        const motor = {
            porLote: 2,
            traducirLote: async () => {
                veces += 1;
                throw Object.assign(new Error('clave'), { reintentable: false });
            },
        };

        const { fallos } = await pretraducir({ segmentos: segmentos(['a', 'b']), motor });
        expect(veces).toBe(1);
        expect(fallos).toHaveLength(2);
    });
});

describe('el traductor del navegador', () => {
    it('se queda con la parte del idioma que entiende', () => {
        // Los archivos escriben el idioma de muchas maneras.
        expect(idiomaCorto('es_ES')).toBe('es');
        expect(idiomaCorto('pt-BR')).toBe('pt');
        expect(idiomaCorto('EN')).toBe('en');
        expect(idiomaCorto('')).toBe('');
    });

    it('en un navegador que no lo trae, se dice en vez de fallar de mala manera', async () => {
        await expect(
            prepararTraductorDelNavegador({ origen: 'en', destino: 'es' }),
        ).rejects.toThrow(/Chrome o Edge/);
    });
});

describe('la protección de etiquetas aguanta el uso repetido', () => {
    it('dos segmentos seguidos se comprueban igual de bien', () => {
        // Con una expresión global compartida, la segunda llamada contestaba
        // cualquier cosa porque la expresión recordaba por dónde iba. El primer
        // segmento salía bien y el siguiente no, que es de lo más difícil de
        // localizar mirando la pantalla.
        const perfil = perfilDeFormato('po');

        for (let i = 0; i < 5; i++) {
            const sinEtiquetas = ponerMarcas('Una frase normal', perfil);
            expect(quitarMarcas('Una frase normal', sinEtiquetas.etiquetas).bien).toBe(true);

            const conEtiqueta = ponerMarcas('Press %s now', perfil);
            const vuelta = quitarMarcas('Pulsa ⟦0⟧ ahora', conEtiqueta.etiquetas);
            expect(vuelta.bien).toBe(true);
            expect(vuelta.texto).toBe('Pulsa %s ahora');
        }
    });
});

describe('hay servicio conectado', () => {
    /** Un almacén de mentira, que es todo lo que mira la configuración. */
    function conAlmacen(valores = {}) {
        const datos = { ...valores };
        const falso = {
            getItem: (clave) => (clave in datos ? datos[clave] : null),
            setItem: (clave, valor) => {
                datos[clave] = String(valor);
            },
            removeItem: (clave) => {
                delete datos[clave];
            },
        };
        globalThis.localStorage = falso;
        globalThis.sessionStorage = falso;
        return datos;
    }

    const deNube = { id: 'openai', necesitaClave: true, modeloPorDefecto: 'gpt-4o-mini' };
    const local = { id: 'compatible', necesitaClave: false, modeloPorDefecto: 'llama' };
    const buscar = (lista) => ({ proveedorPorId: (id) => lista.find((p) => p.id === id) || null });

    it('un servicio de nube sin clave no cuenta como conectado', () => {
        // Es la regla que protege pretraducir: mandar el archivo entero a un
        // servicio sin clave es cientos de llamadas que fallan una por una.
        conAlmacen({ poanda_ia_proveedor: 'openai' });
        expect(hayServicioConectado(buscar([deNube]))).toBe(false);
    });

    it('con clave y modelo, sí', () => {
        conAlmacen({
            poanda_ia_proveedor: 'openai',
            poanda_ia_clave_openai: 'sk-prueba',
            poanda_ia_modelo_openai: 'gpt-4o-mini',
        });
        expect(hayServicioConectado(buscar([deNube]))).toBe(true);
    });

    it('un servicio local no necesita clave, pero sí modelo', () => {
        conAlmacen({ poanda_ia_proveedor: 'compatible' });
        // Vale con el modelo que propone el propio servicio.
        expect(hayServicioConectado(buscar([local]))).toBe(true);

        expect(
            hayServicioConectado(buscar([{ ...local, modeloPorDefecto: '' }])),
        ).toBe(false);
    });

    it('un servicio que ya no existe no cuenta', () => {
        // Alguien que guardó un servicio que se ha quitado de la lista.
        conAlmacen({ poanda_ia_proveedor: 'inventado' });
        expect(hayServicioConectado(buscar([deNube, local]))).toBe(false);
    });

    it('la clave de la sesión vale igual que la recordada', () => {
        conAlmacen({
            poanda_ia_proveedor: 'openai',
            poanda_ia_clave_openai: 'sk-de-esta-sesion',
        });
        expect(hayServicioConectado(buscar([deNube]))).toBe(true);
    });
});
