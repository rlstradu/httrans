/**
 * La IA que corre en el ordenador de quien traduce, sin salir del navegador.
 *
 * POR QUÉ ESTO IMPORTA EN SUBTITULADO
 *
 * Casi todos los encargos de audiovisual llevan un acuerdo de confidencialidad.
 * Mandar los diálogos de una serie sin estrenar al servidor de una empresa
 * americana no es un detalle técnico: es lo que decide si se puede usar una IA o
 * no se puede. Con la IA local el texto no sale del ordenador, y esa frase se
 * puede escribir en un correo a un cliente.
 *
 * Lo que hay que decir igual de claro: un modelo que cabe en un portátil no
 * traduce como los de la nube. Ni de lejos. Sirve para consultar, para pedir
 * alternativas más cortas, para documentarse; como motor de una pretraducción
 * entera de un encargo de pago, no. Eso se le cuenta a quien lo elige antes de
 * que se descargue nada, no después.
 *
 * CÓMO FUNCIONA
 *
 * WebLLM descarga el modelo en el navegador y lo ejecuta con WebGPU. Se elige el
 * modelo, se ve lo que ocupa y se descarga una vez; a partir de ahí queda en la
 * caché del navegador y funciona sin conexión. Vale en Chrome, Edge y Safari 26.
 *
 * Hubo un segundo camino, el modelo que trae Chrome incorporado (Gemini Nano).
 * Se quitó después de probarlo: tarda tanto en estar listo que no es una opción
 * de verdad, y una opción que nadie va a esperar a que termine es una opción que
 * solo sirve para decepcionar a quien la elija.
 *
 * CÓMO ESTÁ ESCRITO
 *
 * WebGPU no existe fuera de un navegador, así que todo lo que lo toca entra por
 * un parámetro que se puede sustituir: `importar` para la librería y `ventana`
 * para lo que cuelga del navegador. Sin eso, este archivo sería el único de
 * core/ que no se puede probar sin abrir Chrome.
 */

/**
 * De dónde sale WebLLM.
 *
 * Se carga solo cuando alguien elige la IA local, y desde un CDN en vez de ir
 * dentro del programa: son más de dos megas de JavaScript, y quien usa la IA en
 * la nube —o no usa ninguna— no tiene por qué descargarlos para abrir un SRT.
 *
 * La versión va clavada a propósito. "La última" es una promesa que cumple otro,
 * y un cambio suyo un martes cualquiera dejaría la herramienta sin IA local sin
 * que aquí se hubiera tocado nada.
 */
export const DE_DONDE_SALE_WEBLLM = 'https://esm.run/@mlc-ai/web-llm@0.2.85';

/** Lo que se descarga cuando nadie ha elegido otra cosa. */
export const MODELO_LOCAL_POR_DEFECTO = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

/**
 * Modelos que hacen otra cosa, por buenos que sean en lo suyo.
 *
 * WebLLM trae variantes de código, de matemáticas y de imagen. Están ahí porque
 * a alguien le sirven, pero no para traducir subtítulos: un Qwen2.5-Coder es un
 * modelo para escribir programas y, puesto a traducir un diálogo, hace lo que
 * puede.
 */
const NO_SON_PARA_ESTO = /-(?:coder|math|vision|embed)-/i;

/**
 * Modelos que ya tienen un sucesor en la misma lista.
 *
 * Que exista Qwen2.5-0.5B hace que Qwen2-0.5B no sea una opción, es una opción
 * peor de lo mismo. Y ofrecer las dos, con el mismo tamaño y un nombre casi
 * igual, es pedirle a quien elige que se sepa cuál es cuál.
 */
const YA_HAY_UNO_MEJOR =
    /^(?:Qwen2-|Qwen1|Llama-2-|Llama-3-8B|TinyLlama-1\.1B-Chat-v0|Mistral-7B-Instruct-v0\.2|Phi-3-mini|gemma-2b-it|RedPajama)/i;

/**
 * Los que se recomiendan, en el orden en que se recomiendan.
 *
 * La lista entera son dieciocho modelos con nombres que no dicen nada a quien no
 * los sigue de cerca, y la diferencia entre el primero y el último no es de
 * matiz: unos traducen y otros devuelven algo con forma de frase. Dejar que
 * quien elige lo averigüe descargando cinco gigas es dejarle el trabajo a él.
 *
 * Por qué estos cuatro y en este orden, para subtitular:
 *
 * - **Qwen2.5-7B**: el mejor del lote. Fuerte en multilingüe y, lo que aquí
 *   importa tanto como traducir, obediente con las instrucciones.
 * - **Llama-3.1-8B**: prácticamente empatado. Español algo más natural, algo
 *   menos fiable siguiendo lo que se le pide.
 * - **Qwen2.5-3B**: el equilibrio, y el que se propone de partida. Menos de la
 *   mitad de descarga y sigue siendo utilizable.
 * - **Llama-3.2-3B**: el ligero que todavía traduce, para un equipo justo.
 *
 * Los demás no desaparecen: van debajo, por si alguien tiene sus motivos.
 */
const LOS_QUE_SE_RECOMIENDAN = [
    'Qwen2.5-7B-Instruct',
    'Llama-3.1-8B-Instruct',
    'Qwen2.5-3B-Instruct',
    'Llama-3.2-3B-Instruct',
];

/**
 * Lo más pequeño que se ofrece, en millones de parámetros.
 *
 * Por debajo de mil millones un modelo no traduce: devuelve algo con la forma
 * de una frase. Ofrecerlo porque pesa poco es ofrecer una decepción con barra
 * de progreso.
 */
const DEMASIADO_PEQUEÑO = 1000;

/**
 * Lo que se guarda entre llamadas: la librería y el motor de cada modelo.
 *
 * Cargar el modelo tarda —lo primero es descargarlo, y aun estando en la caché
 * hay que subirlo a la tarjeta gráfica—, así que se hace una vez y se reutiliza.
 */
const guardado = { libreria: null, motores: new Map() };

/** Se olvida de todo lo cargado. Para las pruebas y para cambiar de modelo. */
export function olvidarLoCargado() {
    guardado.libreria = null;
    guardado.motores.clear();
}

/**
 * Carga la librería de WebLLM, una sola vez.
 *
 * @param {{importar?: function}} [opciones] De dónde sacarla. Se pasa desde
 *   fuera para poder probar esto sin descargar dos megas de nada.
 * @returns {Promise<Object>}
 */
export async function cargarWebLlm({ importar } = {}) {
    if (guardado.libreria) return guardado.libreria;

    const traer = importar || ((donde) => import(/* @vite-ignore */ donde));

    try {
        guardado.libreria = await traer(DE_DONDE_SALE_WEBLLM);
    } catch (error) {
        // Lo que salía aquí era "Failed to fetch dynamically imported module"
        // y la dirección del CDN. Quien lea eso no sabe qué le ha pasado ni qué
        // hacer, y lo que le ha pasado casi siempre es una de dos cosas.
        const fallo = new Error(
            'No se ha podido descargar la librería de la IA local. Suele ser que no hay conexión o que la red del trabajo bloquea el sitio de donde se trae (esm.run).',
            { cause: error },
        );
        fallo.clave = 'ia_error_libreria';
        throw fallo;
    }

    return guardado.libreria;
}

/**
 * ¿Puede este navegador ejecutar un modelo?
 *
 * WebGPU es lo que hace que esto vaya a una velocidad utilizable. Sin él no es
 * que vaya lento: es que WebLLM no arranca. Vale más decirlo antes de que
 * alguien se descargue dos gigas.
 *
 * @param {Object} [ventana] Lo que hace de `window`. Se pasa para poder probarlo.
 * @returns {boolean}
 */
export function hayWebGpu(ventana = globalThis) {
    return Boolean(ventana?.navigator?.gpu);
}

/**
 * Los modelos que se ofrecen, del más ligero al más pesado.
 *
 * Se dejan solo los de instrucciones —un modelo "base" no sabe seguir un
 * encargo, solo continuar un texto— y de cada tamaño la variante más comprimida,
 * que es la que cabe en un portátil normal.
 *
 * @param {Object} webllm La librería ya cargada.
 * @returns {Array<{id: string, nombre: string, megas: number}>}
 */
export function modelosDeWebLlm(webllm) {
    const todos = webllm?.prebuiltAppConfig?.model_list || [];

    const utiles = todos
        .filter((m) => /instruct|-it-|chat/i.test(m.model_id))
        .filter((m) => Number(m.vram_required_MB) > 0)
        // La variante de 16 bits de cada modelo es la mitad de grande que la de
        // 32 y se comporta igual para lo que se usa aquí.
        .filter((m) => /q4f16_1/i.test(m.model_id))
        .filter((m) => !NO_SON_PARA_ESTO.test(m.model_id))
        .filter((m) => !YA_HAY_UNO_MEJOR.test(m.model_id))
        .filter((m) => cuantosParametros(m.model_id) >= DEMASIADO_PEQUEÑO);

    const porFamilia = new Map();
    for (const modelo of utiles) {
        // "Qwen2.5-3B-Instruct-q4f16_1-MLC" → "Qwen2.5-3B-Instruct", que es lo
        // que de verdad distingue un modelo de otro.
        const familia = modelo.model_id.replace(/-q4f16_1.*$/i, '');
        const anterior = porFamilia.get(familia);
        if (!anterior || Number(modelo.vram_required_MB) < Number(anterior.vram_required_MB)) {
            porFamilia.set(familia, modelo);
        }
    }

    // Sin recortar la lista por arriba. La recortaba, y por lo más ligero: los
    // doce primeros eran doce modelos de menos de dos gigas y ninguno de los
    // que de verdad traducen. Quien elegía "el mejor de la lista" se estaba
    // llevando el menos malo de los malos.
    const lista = [...porFamilia.values()].map((m) => {
        const familia = m.model_id.replace(/-q4f16_1.*$/i, '');
        return {
            id: m.model_id,
            familia,
            nombre: `${familia} · ${enGigas(m.vram_required_MB)}`,
            megas: Number(m.vram_required_MB),
            recomendado: LOS_QUE_SE_RECOMIENDAN.includes(familia),
        };
    });

    // Los recomendados delante y en el orden en que se recomiendan, que es por
    // lo bien que traducen; los demás detrás, del más ligero al más pesado, que
    // es por lo que se les mira cuando se busca entre ellos.
    return [
        ...LOS_QUE_SE_RECOMIENDAN.map((familia) =>
            lista.find((m) => m.familia === familia),
        ).filter(Boolean),
        ...lista.filter((m) => !m.recomendado).sort((a, b) => a.megas - b.megas),
    ];
}

/**
 * Cuántos millones de parámetros dice tener un modelo, por su nombre.
 *
 * Es lo único que hay: la lista no trae el dato. "Qwen2.5-3B" son 3000,
 * "SmolLM2-360M" son 360.
 *
 * @param {string} id
 * @returns {number} Millones, o un número alto si no lo dice —más vale
 *   ofrecerlo y que decida quien elige que esconderlo por no saber medirlo.
 */
function cuantosParametros(id) {
    const dice = String(id).match(/(\d+(?:\.\d+)?)\s*([BM])\b/i);
    if (!dice) return Infinity;
    return /b/i.test(dice[2]) ? Number(dice[1]) * 1000 : Number(dice[1]);
}

/** Megas a algo que se pueda leer de un vistazo. */
function enGigas(megas) {
    const gigas = Number(megas) / 1024;
    return gigas >= 1 ? `${gigas.toFixed(1)} GB` : `${Math.round(Number(megas))} MB`;
}

/**
 * El motor de un modelo, descargándolo si hace falta.
 *
 * @param {string} modelo
 * @param {{alProgresar?: function, importar?: function}} [opciones]
 *   `alProgresar` recibe `{parte, texto}`: cuánto lleva (de 0 a 1) y qué está
 *   haciendo, para poder enseñarlo.
 * @returns {Promise<Object>}
 */
export async function motorDeWebLlm(modelo, { alProgresar, importar } = {}) {
    const cual = modelo || MODELO_LOCAL_POR_DEFECTO;
    if (guardado.motores.has(cual)) return guardado.motores.get(cual);

    const webllm = await cargarWebLlm({ importar });

    const motor = await webllm.CreateMLCEngine(cual, {
        initProgressCallback: (paso) => {
            alProgresar?.({ parte: Number(paso?.progress) || 0, texto: String(paso?.text || '') });
        },
    });

    guardado.motores.set(cual, motor);
    return motor;
}

/**
 * Le pregunta al modelo que corre aquí mismo.
 *
 * @param {{mensajes: Array, modelo: string, temperatura?: number,
 *   alProgresar?: function, importar?: function}} peticion
 * @returns {Promise<string>}
 */
export async function chatConWebLlm({ mensajes, modelo, temperatura, alProgresar, importar }) {
    const motor = await motorDeWebLlm(modelo, { alProgresar, importar });

    const respuesta = await motor.chat.completions.create({
        messages: mensajes,
        temperature: temperatura ?? 0.2,
        // Un tope, porque un modelo pequeño que se despista sigue escribiendo
        // hasta llenar su ventana, y eso son minutos de espera para tirar la
        // respuesta a la basura. Un subtítulo cabe de sobra aquí.
        max_tokens: 600,
        stream: false,
    });

    return respuesta?.choices?.[0]?.message?.content || '';
}

// --------------------------------------------------------------------------
// Recuperar el espacio
// --------------------------------------------------------------------------

/**
 * Dónde guarda WebLLM lo que se descarga.
 *
 * Tres almacenes: los pesos del modelo, el programa que lo ejecuta y su
 * configuración. Se listan aquí porque hay que poder barrerlos a mano: la
 * librería sabe borrar un modelo que conoce, y una descarga que se cortó a
 * medias —o la de un modelo que ya no está en la lista— no la conoce nadie.
 */
const DONDE_SE_GUARDA = 'webllm';

/**
 * Cuáles de los modelos que se ofrecen están ya descargados.
 *
 * @param {{importar?: function}} [opciones]
 * @returns {Promise<string[]>} Sus identificadores.
 */
export async function modelosDescargados({ importar } = {}) {
    const webllm = await cargarWebLlm({ importar });
    if (!webllm.hasModelInCache) return [];

    const cuales = await Promise.all(
        modelosDeWebLlm(webllm).map(async (modelo) => {
            try {
                return (await webllm.hasModelInCache(modelo.id)) ? modelo.id : '';
            } catch {
                // Un modelo que no se puede consultar se da por no descargado:
                // el peor caso es ofrecer borrar algo que no está.
                return '';
            }
        }),
    );

    return cuales.filter(Boolean);
}

/**
 * Borra del navegador todo lo que se haya descargado.
 *
 * Se hace por dos caminos a la vez y no es por desconfianza: la librería sabe
 * borrar los modelos que conoce, y el barrido de los almacenes se lleva además
 * lo que ella no puede nombrar —una descarga que se cortó a la mitad, un modelo
 * que estaba en la lista de hace dos versiones—, que es justamente lo que ocupa
 * sitio sin que nadie sepa que está ahí.
 *
 * @param {{importar?: function, ventana?: Object}} [opciones]
 * @returns {Promise<{modelos: number, almacenes: number}>} Qué se ha borrado.
 */
export async function borrarLosModelos({ importar, ventana = globalThis } = {}) {
    let modelos = 0;

    try {
        const webllm = await cargarWebLlm({ importar });
        const descargados = await modelosDescargados({ importar });

        for (const id of descargados) {
            try {
                await webllm.deleteModelAllInfoInCache?.(id);
                modelos += 1;
            } catch {
                // Se sigue con los demás: que uno se resista no es motivo para
                // dejar los otros cuatro gigas donde estaban.
            }
        }
    } catch {
        // Sin librería no se puede preguntar cuáles hay, pero sí barrer los
        // almacenes, que es lo que de verdad libera el disco.
    }

    let almacenes = 0;
    try {
        const nombres = (await ventana?.caches?.keys?.()) || [];
        for (const nombre of nombres) {
            if (!String(nombre).startsWith(DONDE_SE_GUARDA)) continue;
            await ventana.caches.delete(nombre);
            almacenes += 1;
        }
    } catch {
        // Un navegador con el almacenamiento bloqueado no tiene nada guardado
        // que borrar.
    }

    olvidarLoCargado();
    return { modelos, almacenes };
}
