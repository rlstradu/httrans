/**
 * Los servicios de IA con los que subpandaTM sabe hablar.
 *
 *   gemini      Google, en la nube
 *   openai      OpenAI, en la nube
 *   anthropic   Claude, en la nube
 *   webllm      un modelo descargado al navegador, en este ordenador
 *
 * El último lleva `local: true`, y eso se enseña: en un encargo con acuerdo de
 * confidencialidad, que el texto no salga del ordenador no es una característica
 * más, es lo que decide si se puede usar una IA o no.
 *
 * Hubo un segundo servicio local, el modelo que trae Chrome (Gemini Nano). Se
 * quitó tras probarlo: tarda tanto en estar listo que no es una opción de
 * verdad.
 *
 * Había un cuarto, "compatible con OpenAI", que valía para cualquier servicio
 * que hablara ese formato —Ollama, LM Studio, llama-server y los de pago que
 * lo copiaron— poniendo la dirección a mano. Se quitó: pedía una dirección y un
 * puerto que hay que saberse, los modelos locales pequeños no siguen las
 * instrucciones ni respetan las etiquetas con la fiabilidad que hace falta
 * aquí, y una opción que falla la mitad de las veces no es una opción.
 *
 * Cada proveedor sabe hacer tres cosas: charlar (`chat`), decir qué modelos
 * tiene (`modelos`) y comprobar que la conexión funciona (`probar`). Nada más;
 * lo que se le pide y cómo se aprovecha la respuesta vive fuera de aquí.
 */
import { ErrorDeIA, pedirJson } from './http.js';
import {
    MODELO_LOCAL_POR_DEFECTO,
    cargarWebLlm,
    chatConWebLlm,
    hayWebGpu,
    modelosDeWebLlm,
} from './local.js';

/**
 * @typedef {Object} Mensaje
 * @property {'sistema'|'persona'|'ia'} papel
 * @property {string} texto
 */

/** Convierte nuestros mensajes al formato de OpenAI, que usan casi todos. */
const comoOpenAI = (mensajes) =>
    mensajes.map((m) => ({
        role: m.papel === 'sistema' ? 'system' : m.papel === 'ia' ? 'assistant' : 'user',
        content: m.texto,
    }));

/**
 * Quita la barra final de una dirección, para poder pegarle el resto sin acabar
 * con dos barras seguidas.
 *
 * @param {string} url
 * @returns {string}
 */
const limpiarUrl = (url) => String(url || '').replace(/\/+$/, '');

/**
 * Los modelos que no sirven para traducir ni para conversar.
 *
 * Un servicio grande devuelve en la misma lista los modelos de voz, los de
 * imagen y los de embeddings. Mezclados en un desplegable obligan a saberse de
 * memoria cuál es cuál, y elegir el que no es da un error que no explica nada.
 *
 * La lista peca de prudente a propósito: dejar fuera un modelo que sí valía se
 * arregla escribiendo su nombre; colar uno que no vale se paga en una llamada
 * fallida a mitad de una pretraducción.
 */
const NO_CONVERSAN =
    /(embedding|embed-|whisper|transcribe|^tts|-tts|audio|speech|realtime|dall-e|imagen|image-|-image|veo-|moderation|rerank|guard|davinci|babbage|curie|^ada|^text-ada)/i;

/**
 * El número de versión que lleve el nombre, para poder ordenar cuando el
 * servicio no da fechas. "gemini-2.5-flash" vale 2.5; "claude-opus-4-5", 4.5.
 *
 * @param {string} id
 * @returns {number}
 */
function versionDe(id) {
    const numeros = String(id).match(/(\d+)[.-](\d+)|(\d+)/g) || [];
    if (numeros.length === 0) return 0;
    // El primer número del nombre es la versión; los de después suelen ser
    // fechas o tamaños ("claude-3-5-sonnet-20241022", "llama-3.1-8b").
    const trozos = String(numeros[0]).split(/[.-]/).map(Number);
    return trozos[0] + (trozos[1] || 0) / 100;
}

/** ¿Es un modelo preliminar, de los que pueden desaparecer sin avisar? */
function esPreliminar(id) {
    return /(preview|exp|experimental|beta|alpha|nightly|latest)/i.test(String(id));
}

/**
 * Deja la lista de modelos como hace falta para un desplegable: sin lo que no
 * conversa y con el más reciente delante.
 *
 * Se ordena por la fecha que dé el servicio, y cuando no da ninguna —el caso de
 * Gemini— por el número de versión del nombre, que es lo único que hay. A
 * igualdad, los preliminares van detrás: como propuesta por defecto para un
 * encargo de un cliente, un "preview" no es lo que nadie quiere.
 *
 * @param {Array<{id: string, creado?: number}>} modelos
 * @returns {Array<{id: string, creado?: number}>}
 */
function ordenarPorNovedad(modelos) {
    return modelos
        .filter((m) => m.id && !NO_CONVERSAN.test(m.id))
        .sort((a, b) => {
            if (a.creado && b.creado) return b.creado - a.creado;
            const version = versionDe(b.id) - versionDe(a.id);
            if (version !== 0) return version;
            const preliminar = Number(esPreliminar(a.id)) - Number(esPreliminar(b.id));
            if (preliminar !== 0) return preliminar;
            return a.id.localeCompare(b.id);
        });
}

const PROVEEDORES = {
    gemini: {
        id: 'gemini',
        nombre: 'Google Gemini',
        necesitaClave: true,
        // Dónde se saca la clave. Se enseña como enlace en los ajustes: quien
        // llega hasta ahí sin clave lo siguiente que necesita es ir a por ella,
        // y buscarla por su cuenta en la consola de cada servicio no es trivial.
        urlDeLaClave: 'https://aistudio.google.com/apikey',
        urlPorDefecto: 'https://generativelanguage.googleapis.com/v1beta',
        modeloPorDefecto: 'gemini-2.5-flash',

        async chat({ mensajes, modelo, clave, baseUrl, temperatura, senal, fetchImpl }) {
            // Gemini separa las instrucciones del sistema del resto de la
            // conversación, en lugar de mandarlas como un mensaje más.
            const sistema = mensajes.filter((m) => m.papel === 'sistema');
            const resto = mensajes.filter((m) => m.papel !== 'sistema');

            const datos = await pedirJson(
                `${limpiarUrl(baseUrl)}/models/${modelo}:generateContent?key=${encodeURIComponent(clave)}`,
                {
                    cuerpo: {
                        contents: resto.map((m) => ({
                            role: m.papel === 'ia' ? 'model' : 'user',
                            parts: [{ text: m.texto }],
                        })),
                        systemInstruction: sistema.length
                            ? { parts: sistema.map((m) => ({ text: m.texto })) }
                            : undefined,
                        generationConfig: { temperature: temperatura },
                    },
                    senal,
                    fetchImpl,
                },
            );

            const partes = datos?.candidates?.[0]?.content?.parts || [];
            return partes.map((p) => p.text || '').join('');
        },

        async modelos({ clave, baseUrl, fetchImpl }) {
            const datos = await pedirJson(
                `${limpiarUrl(baseUrl)}/models?key=${encodeURIComponent(clave)}`,
                { fetchImpl },
            );
            // Gemini no da fecha de ningún modelo: el orden sale del número de
            // versión del nombre.
            return ordenarPorNovedad(
                (datos.models || [])
                    .map((m) => ({ id: String(m.name || '').replace(/^models\//, '') }))
                    .filter((m) => /gemini/i.test(m.id)),
            );
        },
    },

    openai: {
        id: 'openai',
        nombre: 'OpenAI',
        necesitaClave: true,
        urlDeLaClave: 'https://platform.openai.com/api-keys',
        urlPorDefecto: 'https://api.openai.com/v1',
        modeloPorDefecto: 'gpt-4o-mini',

        async chat({ mensajes, modelo, clave, baseUrl, temperatura, senal, fetchImpl }) {
            const datos = await pedirJson(`${limpiarUrl(baseUrl)}/chat/completions`, {
                cuerpo: {
                    model: modelo,
                    messages: comoOpenAI(mensajes),
                    temperature: temperatura,
                    stream: false,
                },
                cabeceras: { Authorization: `Bearer ${clave}` },
                senal,
                fetchImpl,
            });

            return datos?.choices?.[0]?.message?.content || '';
        },

        async modelos({ clave, baseUrl, fetchImpl }) {
            const datos = await pedirJson(`${limpiarUrl(baseUrl)}/models`, {
                cabeceras: { Authorization: `Bearer ${clave}` },
                fetchImpl,
            });
            // `created` va en segundos desde 1970. Ollama y LM Studio, que
            // hablan este mismo formato, ponen ahí la fecha del archivo.
            return ordenarPorNovedad(
                (datos.data || []).map((m) => ({ id: m.id, creado: m.created })),
            );
        },
    },

    anthropic: {
        id: 'anthropic',
        nombre: 'Anthropic (Claude)',
        necesitaClave: true,
        urlDeLaClave: 'https://platform.claude.com/settings/keys',
        urlPorDefecto: 'https://api.anthropic.com/v1',
        modeloPorDefecto: 'claude-sonnet-4-5',

        async chat({ mensajes, modelo, clave, baseUrl, temperatura, senal, fetchImpl }) {
            const sistema = mensajes
                .filter((m) => m.papel === 'sistema')
                .map((m) => m.texto)
                .join('\n\n');
            const resto = mensajes.filter((m) => m.papel !== 'sistema');

            const datos = await pedirJson(`${limpiarUrl(baseUrl)}/messages`, {
                cuerpo: {
                    model: modelo,
                    system: sistema || undefined,
                    messages: resto.map((m) => ({
                        role: m.papel === 'ia' ? 'assistant' : 'user',
                        content: m.texto,
                    })),
                    temperature: temperatura,
                    max_tokens: 4096,
                },
                cabeceras: {
                    'x-api-key': clave,
                    'anthropic-version': '2023-06-01',
                    // Sin esta cabecera, Anthropic rechaza las llamadas hechas
                    // desde una página web. Es su forma de asegurarse de que
                    // quien la manda sabe que la clave viaja en el navegador.
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                senal,
                fetchImpl,
            });

            return (datos?.content || [])
                .filter((p) => p.type === 'text')
                .map((p) => p.text)
                .join('');
        },

        async modelos({ clave, baseUrl, fetchImpl }) {
            const datos = await pedirJson(`${limpiarUrl(baseUrl)}/models`, {
                cabeceras: {
                    'x-api-key': clave,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                fetchImpl,
            });
            // Anthropic escribe la fecha como texto ISO, no como número.
            return ordenarPorNovedad(
                (datos.data || []).map((m) => ({
                    id: m.id,
                    creado: m.created_at ? Date.parse(m.created_at) : undefined,
                })),
            );
        },
    },

    webllm: {
        id: 'webllm',
        nombre: 'WebLLM',
        // La IA que corre aquí mismo: el texto no sale del ordenador.
        local: true,
        necesitaClave: false,
        modeloPorDefecto: MODELO_LOCAL_POR_DEFECTO,

        async chat({ mensajes, modelo, temperatura, alProgresar, importar }) {
            return chatConWebLlm({
                mensajes: comoOpenAI(mensajes),
                modelo,
                temperatura,
                alProgresar,
                importar,
            });
        },

        async modelos({ importar, ventana } = {}) {
            if (!hayWebGpu(ventana)) {
                throw new ErrorDeIA(
                    'servicio',
                    'Este navegador no tiene WebGPU, que es lo que hace falta para ejecutar un modelo aquí. Con Chrome, Edge o Safari 26 funciona.',
                    { clave: 'ia_error_sin_webgpu' },
                );
            }

            // La lista no se le pregunta a ningún servidor: viene dentro de la
            // propia librería, así que esto responde igual sin conexión.
            return modelosDeWebLlm(await cargarWebLlm({ importar }));
        },
    },

};

/**
 * @param {string} id
 * @returns {Object|null}
 */
export function proveedorPorId(id) {
    return PROVEEDORES[String(id || '').toLowerCase()] || null;
}

/** @returns {Array<Object>} Todos, para pintar el desplegable. */
export function listaDeProveedores() {
    return Object.values(PROVEEDORES);
}

/**
 * Habla con el proveedor configurado.
 *
 * @param {Object} config Lo que devuelve ajustes.js.
 * @param {Array<Mensaje>} mensajes
 * @param {{temperatura?: number, senal?: AbortSignal, fetchImpl?: Function}} [opciones]
 * @returns {Promise<string>} La respuesta, en texto.
 */
export async function conversar(config, mensajes, opciones = {}) {
    const proveedor = proveedorPorId(config.proveedor);
    if (!proveedor) {
        throw new ErrorDeIA('servicio', 'No hay ningún proveedor de IA elegido.', {
            clave: 'ia_error_sin_servicio',
        });
    }

    if (proveedor.necesitaClave && !config.clave) {
        throw new ErrorDeIA('clave', 'Falta la clave de API de este servicio.', {
            clave: 'ia_error_sin_clave',
        });
    }
    if (!config.modelo) {
        throw new ErrorDeIA('modelo', 'Falta elegir el modelo.', { clave: 'ia_error_sin_modelo' });
    }

    const respuesta = await proveedor.chat({
        mensajes,
        modelo: config.modelo,
        clave: config.clave,
        baseUrl: config.baseUrl || proveedor.urlPorDefecto,
        // Para traducir se quiere consistencia, no imaginación; para consultar,
        // un poco más de soltura.
        temperatura: opciones.temperatura ?? 0.2,
        senal: opciones.senal,
        fetchImpl: opciones.fetchImpl,
        // Lo que necesitan los locales: por dónde avisar de que está cargando
        // el modelo —la primera vez tarda— y por dónde entran la librería y el
        // navegador, que en las pruebas son de mentira.
        alProgresar: opciones.alProgresar,
        importar: opciones.importar,
        ventana: opciones.ventana,
    });

    return String(respuesta || '').trim();
}

/**
 * Comprueba que la configuración sirve: que el servicio contesta y que el
 * modelo elegido existe.
 *
 * Se puede llamar sin modelo elegido, y es el caso normal la primera vez: se
 * elige servicio, se pega la clave y los modelos los trae el propio servicio.
 *
 * @param {Object} config
 * @param {{fetchImpl?: Function}} [opciones]
 * @returns {Promise<{bien: boolean, modelos: Array<{id: string, creado?: number}>, mensaje: string}>}
 */
export async function probarConexion(config, opciones = {}) {
    const proveedor = proveedorPorId(config.proveedor);
    if (!proveedor) {
        return {
            bien: false,
            modelos: [],
            mensaje: 'Elige un servicio de IA.',
            clave: 'ia_error_elige_servicio',
        };
    }

    try {
        const modelos = await proveedor.modelos({
            clave: config.clave,
            baseUrl: config.baseUrl || proveedor.urlPorDefecto,
            fetchImpl: opciones.fetchImpl,
            importar: opciones.importar,
            ventana: opciones.ventana,
        });

        // Que el servicio conteste no basta: si el modelo elegido no está en su
        // lista, la primera traducción fallaría y costaría entender por qué.
        if (config.modelo && modelos.length > 0 && !modelos.some((m) => m.id === config.modelo)) {
            return {
                bien: false,
                modelos,
                mensaje: `El servicio responde, pero no tiene el modelo "${config.modelo}".`,
                clave: 'ia_error_modelo_desconocido',
                datos: { modelo: config.modelo },
            };
        }

        return { bien: true, modelos, mensaje: 'Conexión correcta.', clave: 'ia_error_bien' };
    } catch (error) {
        return { bien: false, modelos: [], mensaje: error.message, clave: error.clave || '' };
    }
}
