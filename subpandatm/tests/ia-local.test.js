/**
 * La IA que corre en el ordenador de quien traduce.
 *
 * Ni WebGPU ni el modelo de Chrome existen fuera de un navegador, así que aquí
 * entran de mentira: una librería falsa y una ventana falsa. Lo que se comprueba
 * es lo de siempre —que se elige bien el modelo, que se avisa del progreso, que
 * un navegador que no puede lo dice antes de que nadie descargue dos gigas— y no
 * que WebGPU multiplique matrices, que de eso ya responde quien lo escribió.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MODELO_LOCAL_POR_DEFECTO,
    borrarLosModelos,
    chatConWebLlm,
    hayWebGpu,
    modelosDeWebLlm,
    motorDeWebLlm,
    olvidarLoCargado,
} from '../src/js/core/ia/local.js';
import { listaDeProveedores, probarConexion, proveedorPorId } from '../src/js/core/ia/proveedores.js';
import { encargoDeAyudar, encargoDeTraducir } from '../src/js/core/ia/prompt.js';

/** Una librería de WebLLM de mentira, con la lista que trae la de verdad. */
function webLlmDeMentira({ responde = 'Hola' } = {}) {
    const progresos = [];
    const motor = {
        chat: {
            completions: {
                create: vi.fn(async () => ({ choices: [{ message: { content: responde } }] })),
            },
        },
    };

    const libreria = {
        prebuiltAppConfig: {
            model_list: [
                { model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', vram_required_MB: 879.04 },
                { model_id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', vram_required_MB: 1128.82 },
                { model_id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', vram_required_MB: 2504.76 },
                { model_id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', vram_required_MB: 4598.34 },
                { model_id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', vram_required_MB: 5106.26 },
                // Uno "base", que no sabe seguir instrucciones, y uno de
                // embeddings: ninguno de los dos vale para conversar.
                { model_id: 'Llama-3.2-1B-q4f16_1-MLC', vram_required_MB: 800 },
                { model_id: 'snowflake-arctic-embed-m-q0f32-MLC-b4', vram_required_MB: 300 },
            ],
        },
        CreateMLCEngine: vi.fn(async (modelo, opciones) => {
            opciones?.initProgressCallback?.({ progress: 0.5, text: 'Descargando…' });
            opciones?.initProgressCallback?.({ progress: 1, text: 'Listo' });
            motor.modeloQueSePidio = modelo;
            return motor;
        }),
    };

    return { libreria, motor, progresos, importar: async () => libreria };
}

beforeEach(() => olvidarLoCargado());

describe('saber si este navegador puede', () => {
    it('lo dice mirando si hay WebGPU', () => {
        expect(hayWebGpu({ navigator: { gpu: {} } })).toBe(true);
        expect(hayWebGpu({ navigator: {} })).toBe(false);
        expect(hayWebGpu({})).toBe(false);
    });

    it('y el proveedor se niega a listar modelos sin él, en vez de fallar luego', async () => {
        const { importar } = webLlmDeMentira();

        const resultado = await probarConexion(
            { proveedor: 'webllm' },
            { importar, ventana: { navigator: {} } },
        );

        expect(resultado.bien).toBe(false);
        expect(resultado.mensaje).toContain('WebGPU');
    });
});

describe('qué modelos se ofrecen', () => {
    it('solo los que saben seguir instrucciones', () => {
        const { libreria } = webLlmDeMentira();
        const ids = modelosDeWebLlm(libreria).map((m) => m.id);

        expect(ids.some((id) => /embed/i.test(id))).toBe(false);
        // "Llama-3.2-1B" a secas no es de instrucciones: solo continúa texto.
        expect(ids).not.toContain('Llama-3.2-1B-q4f16_1-MLC');
    });

    it('una sola variante de cada modelo, la que menos ocupa', () => {
        const { libreria } = webLlmDeMentira();
        const ids = modelosDeWebLlm(libreria).map((m) => m.id);

        // Enseñar "q4f16_1" y "q4f32_1" del mismo modelo obliga a saberse qué
        // significa eso para elegir, y elegir mal es descargar de más.
        expect(ids).toContain('Llama-3.2-1B-Instruct-q4f16_1-MLC');
        expect(ids).not.toContain('Llama-3.2-1B-Instruct-q4f32_1-MLC');
    });

    it('diciendo lo que ocupa cada uno, que es lo primero que hay que saber', () => {
        const { libreria } = webLlmDeMentira();
        const modelos = modelosDeWebLlm(libreria);

        // Lo que ocupa va en el nombre, no es un detalle que se descubra a
        // mitad de la descarga. Y sin el "q4f16_1", que no le dice nada a nadie.
        expect(modelos[0].nombre).toMatch(/\d+(?:[.,]\d+)? (?:MB|GB)/);
        expect(modelos[0].nombre).not.toContain('q4f16_1');
    });

    it('los recomendados van delante, y en el orden en que se recomiendan', () => {
        // Dieciocho nombres que no dicen nada a quien no los sigue de cerca, y
        // la diferencia entre el primero y el último no es de matiz: unos
        // traducen y otros devuelven algo con forma de frase. Dejar que quien
        // elige lo averigüe descargando cinco gigas es dejarle a él el trabajo.
        const { libreria } = webLlmDeMentira();
        const modelos = modelosDeWebLlm(libreria);

        expect(modelos[0].id).toBe('Qwen2.5-7B-Instruct-q4f16_1-MLC');
        expect(modelos[0].recomendado).toBe(true);

        // Y los recomendados están todos antes que el primero que no lo es.
        const primeroSinRecomendar = modelos.findIndex((m) => !m.recomendado);
        expect(modelos.slice(0, primeroSinRecomendar).every((m) => m.recomendado)).toBe(true);
        expect(modelos.slice(primeroSinRecomendar).some((m) => m.recomendado)).toBe(false);
    });

    it('y los demás, detrás y del más ligero al más pesado', () => {
        const { libreria } = webLlmDeMentira();
        const resto = modelosDeWebLlm(libreria).filter((m) => !m.recomendado);

        expect(resto.map((m) => m.megas)).toEqual([...resto.map((m) => m.megas)].sort((a, b) => a - b));
    });
});

describe('descargar y usar el modelo', () => {
    it('avisa de cómo va la descarga', async () => {
        const { importar } = webLlmDeMentira();
        const pasos = [];

        await motorDeWebLlm('Qwen2.5-3B-Instruct-q4f16_1-MLC', {
            importar,
            alProgresar: (paso) => pasos.push(paso),
        });

        // Sin esto, descargar dos gigas es una pantalla parada.
        expect(pasos.map((p) => p.parte)).toEqual([0.5, 1]);
        expect(pasos[0].texto).toContain('Descargando');
    });

    it('no vuelve a cargarlo la segunda vez', async () => {
        const { libreria, importar } = webLlmDeMentira();

        await motorDeWebLlm('Qwen2.5-3B-Instruct-q4f16_1-MLC', { importar });
        await motorDeWebLlm('Qwen2.5-3B-Instruct-q4f16_1-MLC', { importar });

        expect(libreria.CreateMLCEngine).toHaveBeenCalledTimes(1);
    });

    it('sin modelo elegido coge el que se propone', async () => {
        const { motor, importar } = webLlmDeMentira();
        await motorDeWebLlm('', { importar });

        expect(motor.modeloQueSePidio).toBe(MODELO_LOCAL_POR_DEFECTO);
    });

    it('y contesta como los demás', async () => {
        const { importar } = webLlmDeMentira({ responde: 'Hola mundo' });

        const dicho = await chatConWebLlm({
            mensajes: [{ role: 'user', content: '¿Qué tal?' }],
            modelo: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
            importar,
        });

        expect(dicho).toBe('Hola mundo');
    });
});

describe('en la lista de servicios', () => {
    it('WebLLM viene marcado como IA local, y es el único', () => {
        const locales = listaDeProveedores().filter((p) => p.local);

        expect(locales.map((p) => p.id)).toEqual(['webllm']);
    });

    it('el modelo que trae Chrome ya no se ofrece', () => {
        // Tardaba tanto en estar listo que no era una opción de verdad, y una
        // opción que nadie va a esperar solo sirve para decepcionar.
        expect(proveedorPorId('nano')).toBe(null);
        expect(listaDeProveedores().some((p) => /nano/i.test(p.nombre))).toBe(false);
    });

    it('y no pide clave, porque no hay ninguna que pedir', () => {
        expect(proveedorPorId('webllm').necesitaClave).toBe(false);
    });

    it('los de la nube siguen pidiéndola', () => {
        for (const id of ['gemini', 'openai', 'anthropic']) {
            expect(proveedorPorId(id).necesitaClave).toBe(true);
            expect(proveedorPorId(id).local).toBeFalsy();
        }
    });
});

describe('cómo se le habla a un modelo pequeño', () => {
    /**
     * Esto es lo que fallaba: con las instrucciones largas y en español, un
     * modelo de 3B contestaba con una reformulación del texto en lugar de con
     * la traducción. No es que no supiera traducir; es que no había entendido
     * que se le estaba pidiendo eso.
     */
    const encargo = (config, extra = {}) =>
        encargoDeTraducir({
            originales: ['Hello world'],
            idiomaOrigen: 'en',
            idiomaDestino: 'es',
            corto: Boolean(proveedorPorId(config)?.local),
            ...extra,
        });

    it('las instrucciones van en inglés, que es en lo que obedece', () => {
        const sistema = encargo('webllm')[0].texto;

        expect(sistema).toContain('professional subtitle translator');
        expect(sistema).not.toContain('subtitulador profesional');
    });

    it('y van cortas: cada frase de más compite con las demás', () => {
        const corto = encargo('webllm')[0].texto;
        const largo = encargo('openai')[0].texto;

        expect(corto.length).toBeLessThan(largo.length / 2);
    });

    it('el texto que hay que traducir va el último y solo', () => {
        // Un modelo pequeño hace lo último que ha leído: una instrucción
        // escrita detrás del texto se lleva por delante la traducción entera.
        const pedido = encargo('webllm')[1].texto;

        expect(pedido.trimEnd().endsWith('Hello world')).toBe(true);
    });

    it('sin los subtítulos de alrededor, que ahí son ruido', () => {
        const vecinos = [{ original: 'Something else entirely' }];
        const pedido = encargo('webllm', { contexto: { vecinos } })[1].texto;

        // Con ellos delante, acababa traduciendo el vecino.
        expect(pedido).not.toContain('Something else entirely');
        // Pero el de la nube sí los quiere: son contexto de verdad.
        expect(encargo('openai', { contexto: { vecinos } })[1].texto).toContain(
            'Something else entirely',
        );
    });

    it('el glosario sí va, que es lo que no se puede adivinar', () => {
        const glosario = [{ termino: 'file', traduccion: 'archivo' }];
        const pedido = encargo('webllm', { contexto: { glosario } })[1].texto;

        expect(pedido).toContain('archivo');
    });

    it('a los de la nube se les sigue hablando como siempre', () => {
        const sistema = encargo('openai')[0].texto;

        expect(sistema).toContain('subtitulador profesional');
        expect(sistema).not.toContain('professional subtitle translator');
    });

    it('y al preguntar, se le pide que conteste y no que reformule', () => {
        const sistema = encargoDeAyudar({ pregunta: '¿Qué es un CPS?', corto: true })[0].texto;

        expect(sistema).toContain('Do not rephrase the question back');
    });
});

describe('los fallos, dichos en el idioma de quien los lee', () => {
    it('cada fallo del núcleo lleva su clave de traducción', async () => {
        const sinWebGpu = await probarConexion({ proveedor: 'webllm' }, { ventana: { navigator: {} } });
        const sinServicio = await probarConexion({ proveedor: 'inventado' });

        // core/ no sabe en qué idioma está la interfaz, ni tiene por qué: manda
        // la clave y quien pinta la cambia por el texto que toque.
        expect(sinWebGpu.clave).toBe('ia_error_sin_webgpu');
        expect(sinServicio.clave).toBe('ia_error_elige_servicio');
    });

    it('y todas están escritas en los dos idiomas', async () => {
        const { translations } = await import('../src/js/translations.js');

        const claves = Object.keys(translations.es).filter((c) => c.startsWith('ia_error_'));
        expect(claves.length).toBeGreaterThan(5);

        for (const clave of claves) {
            expect(translations.en[clave], `falta en inglés: ${clave}`).toBeTruthy();
            expect(translations.en[clave]).not.toBe(translations.es[clave]);
        }
    });

    it('un error del propio servicio se enseña tal cual, que traducirlo no se puede', async () => {
        const { ErrorDeIA } = await import('../src/js/core/ia/http.js');
        const suyo = new ErrorDeIA('clave', 'Invalid API key provided');

        expect(suyo.clave).toBe('');
        expect(suyo.message).toBe('Invalid API key provided');
    });
});

describe('la lista de modelos que se ofrece', () => {
    /** La lista de verdad de WebLLM, en pequeño pero con sus casos raros. */
    const comoLaDeVerdad = {
        prebuiltAppConfig: {
            model_list: [
                { model_id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', vram_required_MB: 376 },
                { model_id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', vram_required_MB: 945 },
                { model_id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC', vram_required_MB: 945 },
                { model_id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', vram_required_MB: 1629 },
                { model_id: 'Qwen2.5-Math-1.5B-Instruct-q4f16_1-MLC', vram_required_MB: 1629 },
                { model_id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', vram_required_MB: 1629 },
                { model_id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', vram_required_MB: 2504 },
                { model_id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', vram_required_MB: 2520 },
                { model_id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', vram_required_MB: 4598 },
                { model_id: 'Llama-3-8B-Instruct-q4f16_1-MLC', vram_required_MB: 4598 },
                { model_id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', vram_required_MB: 5106 },
                { model_id: 'Llama-2-7b-chat-hf-q4f16_1-MLC', vram_required_MB: 4598 },
            ],
        },
    };

    it('no se corta por arriba, que es donde están los que traducen', () => {
        // Esto es lo que fallaba: la lista salía ordenada de más ligero a más
        // pesado y cortada a los doce primeros, así que los doce eran modelos
        // pequeños y ninguno de los que de verdad traducen. Quien elegía "el
        // mejor de la lista" se llevaba el menos malo de los malos.
        const ids = modelosDeWebLlm(comoLaDeVerdad).map((m) => m.id);

        expect(ids).toContain('Llama-3.1-8B-Instruct-q4f16_1-MLC');
        expect(ids).toContain('Qwen2.5-7B-Instruct-q4f16_1-MLC');
    });

    it('fuera los que están para otra cosa', () => {
        const ids = modelosDeWebLlm(comoLaDeVerdad).map((m) => m.id);

        // Un modelo de código puesto a traducir un diálogo hace lo que puede.
        expect(ids.some((id) => /coder|math|vision/i.test(id))).toBe(false);
    });

    it('fuera los que ya tienen un sucesor en la misma lista', () => {
        const ids = modelosDeWebLlm(comoLaDeVerdad).map((m) => m.id);

        // Ofrecer Llama-3 y Llama-3.1 del mismo tamaño, con un nombre casi
        // igual, es pedirle a quien elige que se sepa cuál es cuál.
        expect(ids).toContain('Llama-3.1-8B-Instruct-q4f16_1-MLC');
        expect(ids).not.toContain('Llama-3-8B-Instruct-q4f16_1-MLC');
        expect(ids).not.toContain('Llama-2-7b-chat-hf-q4f16_1-MLC');
        expect(ids).not.toContain('Qwen2-0.5B-Instruct-q4f16_1-MLC');
    });

    it('y fuera los que no llegan a traducir, por poco que pesen', () => {
        const ids = modelosDeWebLlm(comoLaDeVerdad).map((m) => m.id);

        // Por debajo de mil millones no traduce: devuelve algo con forma de
        // frase. Ofrecerlo porque pesa poco es ofrecer una decepción.
        expect(ids).not.toContain('SmolLM2-360M-Instruct-q4f16_1-MLC');
        expect(ids).not.toContain('Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
    });
});

describe('recuperar el espacio', () => {
    const cachesDeMentira = (nombres) => {
        const quedan = [...nombres];
        return {
            caches: {
                keys: async () => [...quedan],
                delete: async (nombre) => {
                    const donde = quedan.indexOf(nombre);
                    if (donde !== -1) quedan.splice(donde, 1);
                    return donde !== -1;
                },
            },
            quedan,
        };
    };

    it('borra los modelos que la librería conoce', async () => {
        const { libreria, importar } = webLlmDeMentira();
        const borrados = [];
        libreria.hasModelInCache = async (id) => id === 'Qwen2.5-3B-Instruct-q4f16_1-MLC';
        libreria.deleteModelAllInfoInCache = async (id) => borrados.push(id);

        const ventana = cachesDeMentira([]);
        const hecho = await borrarLosModelos({ importar, ventana });

        expect(borrados).toEqual(['Qwen2.5-3B-Instruct-q4f16_1-MLC']);
        expect(hecho.modelos).toBe(1);
    });

    it('y barre además lo que la librería no sabe nombrar', async () => {
        const { libreria, importar } = webLlmDeMentira();
        libreria.hasModelInCache = async () => false;

        // Una descarga que se cortó a la mitad no la conoce nadie, y es
        // justamente lo que ocupa sitio sin que se sepa que está ahí.
        const ventana = cachesDeMentira(['webllm/model', 'webllm/wasm', 'otra-cosa']);
        const hecho = await borrarLosModelos({ importar, ventana });

        expect(hecho.almacenes).toBe(2);
        // Y no se lleva por delante lo que no es suyo.
        expect(ventana.quedan).toEqual(['otra-cosa']);
    });

    it('sin librería, todavía libera el disco', async () => {
        const ventana = cachesDeMentira(['webllm/model']);
        const hecho = await borrarLosModelos({
            importar: async () => {
                throw new Error('sin conexión');
            },
            ventana,
        });

        expect(hecho.almacenes).toBe(1);
    });
});
