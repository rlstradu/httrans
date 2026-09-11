/**
 * El panel de ajustes de la IA.
 *
 * Tiene dos caras, y solo se ve una cada vez:
 *
 * - **Sin conectar**: qué servicio y, si lo pide, la clave. Un solo botón,
 *   *Conectar y guardar*, que hace las dos cosas de una vez. Antes eran dos
 *   —*Probar conexión* y *Guardar*— y esa separación no le servía a nadie:
 *   nunca se quiere guardar una configuración que no funciona, ni probar una y
 *   luego no guardarla. Dos botones para un solo acto.
 * - **Conectado**: a qué servicio se está conectado y con qué modelo, con la
 *   lista entera de modelos del servicio en un desplegable —el más reciente
 *   elegido de partida— y un botón para cambiar de servicio. Pasar de Gemini a
 *   OpenAI es pulsar *Cambiar de servicio*, elegirlo y pegar la clave.
 *
 * Con un servicio local no se pide clave, porque no la hay: lo que se pide es
 * elegir qué modelo se descarga y esperar a que baje. Por eso la lista de
 * servicios va separada en dos —los de la nube y los de este ordenador—, y el
 * botón cambia de "Conectar" a "Descargar y usar": no es lo mismo pegar una
 * clave que traerse dos gigas.
 *
 * Lo propio de subpandaTM es la casilla de los límites: si la traducción tiene
 * que caber en el tiempo que el subtítulo está en pantalla, o no.
 */
import {
    guardarConfiguracion,
    guardarRespetarLimites,
    hayServicioConectado,
    leerConfiguracion,
    recordarLaClave,
    seRecuerdaLaClave,
    seRespetanLosLimites,
} from './core/ia/ajustes.js';
import { listaDeProveedores, probarConexion, proveedorPorId } from './core/ia/proveedores.js';
import { MODELO_LOCAL_POR_DEFECTO, borrarLosModelos, motorDeWebLlm } from './core/ia/local.js';
import { appendAiMessage, olvidarConversacion, yaHayIAConectada } from './ia.js';
import { mensajeDeError } from './ia-textos.js';
import { state } from './state.js';
import { translations } from './translations.js';

const t = (clave) => translations[state.currentLanguage][clave] || '';
const $ = (id) => document.getElementById(id);

/**
 * Los modelos que trajo la última conexión, para poder repintar el desplegable
 * sin volver a preguntárselos al servicio.
 * @type {Array<{id: string}>}
 */
let modelosDelServicio = [];

/**
 * Los modelos que se pueden descargar, cuando el servicio elegido es local.
 * @type {Array<{id: string, nombre?: string}>}
 */
let modelosLocales = [];

/**
 * El cuadro de sí o no de la herramienta, que vive en app.js.
 *
 * Se pasa desde fuera igual que en el puente de los recientes: app.js importa
 * este módulo, así que importarlo de vuelta cerraría el círculo. Sin él no se
 * pregunta y no se borra, que es lo correcto: borrar diez gigas sin preguntar
 * no lo hace nadie.
 * @type {Function|null}
 */
let preguntarSiSeguro = null;

/** @returns {boolean} Si hay servicio, clave y modelo con los que llamar. */
const estaConectado = () => hayServicioConectado({ proveedorPorId });

/**
 * Pinta el panel con lo que haya guardado, enseñando la cara que toque.
 */
export function pintarAjustesDeIA() {
    const select = $('aiProveedor');
    if (!select) return;

    const config = leerConfiguracion();

    // En dos grupos, y dicho con todas las letras. Que un servicio corra en
    // este ordenador no es un detalle de implementación: en un encargo con
    // acuerdo de confidencialidad es lo que decide si se puede usar o no.
    const opciones = (cuales) =>
        cuales.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const todos = listaDeProveedores();

    select.innerHTML = [
        `<optgroup label="${t('ai_grupo_nube')}">${opciones(todos.filter((p) => !p.local))}</optgroup>`,
        `<optgroup label="${t('ai_grupo_local')}">${opciones(todos.filter((p) => p.local))}</optgroup>`,
    ].join('');
    select.value = config.proveedor;

    aplicarProveedor(select.value);
    $('aiRecordarClave').checked = seRecuerdaLaClave();
    $('aiInstrucciones').value = config.instrucciones || '';
    $('aiRespetarLimites').checked = seRespetanLosLimites();

    enseñarCara(estaConectado());
}

/**
 * Enseña una de las dos caras del panel.
 *
 * @param {boolean} conectado
 */
function enseñarCara(conectado) {
    $('aiConectado')?.classList.toggle('hidden', !conectado);
    $('aiSinConectar')?.classList.toggle('hidden', conectado);
    if (conectado) pintarResumenDeConexion();
}

/** Escribe a qué servicio y con qué modelo se está trabajando. */
function pintarResumenDeConexion() {
    const config = leerConfiguracion();
    const proveedor = proveedorPorId(config.proveedor);
    if (!proveedor) return;

    $('aiConectadoServicio').textContent = t('ai_conectado_a').replace(
        '{servicio}',
        proveedor.nombre,
    );

    // Si no se ha vuelto a conectar en esta sesión no hay lista que pintar; se
    // deja al menos el modelo guardado, para que el desplegable no salga vacío.
    const modelo = config.modelo || proveedor.modeloPorDefecto || '';
    const lista = modelosDelServicio.length > 0 ? modelosDelServicio : modelo ? [{ id: modelo }] : [];
    pintarModelos(lista, modelo);
}

/**
 * Llena el desplegable de modelos.
 *
 * Vienen ya ordenados del más reciente al más antiguo, así que el primero es el
 * que se propone: es lo que casi siempre se quiere, y quien tenga motivos para
 * usar otro lo tiene ahí mismo en la lista en vez de tener que escribir el
 * nombre exacto de memoria.
 *
 * @param {Array<{id: string}>} modelos
 * @param {string} elegido
 */
function pintarModelos(modelos, elegido) {
    const select = $('aiModelo');
    if (!select) return;

    const ids = modelos.map((m) => m.id);
    // Un modelo guardado que ya no esté en la lista se añade igualmente: puede
    // seguir funcionando aunque el servicio no lo anuncie.
    if (elegido && !ids.includes(elegido)) ids.unshift(elegido);

    select.innerHTML = ids.map((id) => `<option value="${id}">${id}</option>`).join('');
    select.value = elegido && ids.includes(elegido) ? elegido : ids[0] || '';
}

/**
 * Ajusta la cara de "sin conectar" al servicio elegido y rellena sus valores.
 *
 * @param {string} proveedorId
 */
function aplicarProveedor(proveedorId) {
    const proveedor = proveedorPorId(proveedorId);
    if (!proveedor) return;

    const config = leerConfiguracion({
        modelo: proveedor.modeloPorDefecto,
        baseUrl: proveedor.urlPorDefecto,
    });

    $('aiClave').value = config.clave || '';
    $('aiClaveBloque').classList.toggle('hidden', !proveedor.necesitaClave);
    aplicarProveedorLocal(proveedor, config);

    // Adónde se va a por la clave de ESTE servicio. Cada consola la esconde en
    // un sitio distinto, y quien llega aquí sin clave lo que necesita a
    // continuación es ir a buscarla.
    const enlace = $('aiEnlaceClave');
    if (enlace) {
        enlace.href = proveedor.urlDeLaClave || '#';
        enlace.textContent = t('ai_conseguir_clave').replace('{servicio}', proveedor.nombre);
        enlace.parentElement.classList.toggle('hidden', !proveedor.urlDeLaClave);
    }

    $('aiEstadoConexion').textContent = '';
}

/**
 * La parte del panel que solo sale con un servicio local.
 *
 * Lo que hay que contar aquí no es un detalle de letra pequeña: por qué se
 * elegiría un modelo local —el texto no sale del ordenador, y en un encargo con
 * acuerdo de confidencialidad eso es lo que decide si se puede usar una IA— y
 * qué se pierde a cambio. Y hay que contarlo ANTES de que alguien se descargue
 * dos gigas, no después.
 *
 * @param {Object} proveedor
 * @param {Object} config
 */
function aplicarProveedorLocal(proveedor, config) {
    const bloque = $('aiLocalBloque');
    if (!bloque) return;

    bloque.classList.toggle('hidden', !proveedor.local);
    // El panda de la clave se calla con un servicio local: no hay clave de la
    // que hablar, y dos pandas diciendo cosas distintas a la vez no es un
    // aviso, es ruido.
    $('aiPandaConectar')?.closest('.panda-aviso')?.classList.toggle('hidden', Boolean(proveedor.local));
    $('aiModeloLocalBloque')?.classList.toggle('hidden', !proveedor.local);
    $('aiDescarga')?.classList.add('hidden');

    const boton = $('aiConectarBtn');
    if (boton) {
        boton.textContent = proveedor.local ? t('ai_descargar') : t('ai_conectar');
    }

    if (!proveedor.local) return;

    // Cada uno tiene sus particularidades y son distintas: uno se descarga aquí
    // y el otro viene con el navegador y pide un Chrome reciente.
    const $panda = $('aiPandaLocal');
    if ($panda) $panda.textContent = t(`ai_panda_${proveedor.id}`);

    // Los modelos de WebLLM no se le preguntan a ningún servidor: vienen dentro
    // de la librería. Pero la librería son dos megas, así que se trae solo al
    // llegar aquí, que es cuando de verdad hace falta.
    traerLosModelosLocales(config.modelo);
}

/**
 * Llena el desplegable de modelos que se pueden descargar.
 *
 * @param {string} elegido
 */
async function traerLosModelosLocales(elegido) {
    const select = $('aiModeloLocal');
    if (!select) return;

    select.innerHTML = `<option value="">${t('ai_modelos_cargando')}</option>`;
    select.disabled = true;

    const resultado = await probarConexion({ proveedor: 'webllm' });

    if (!resultado.bien) {
        // Un navegador sin WebGPU no puede, y vale más decirlo aquí que dejar
        // que alguien empiece una descarga que no va a servirle de nada.
        select.innerHTML = '';
        $('aiEstadoConexion').textContent = `❌ ${mensajeDeError(resultado)}`;
        return;
    }

    modelosLocales = resultado.modelos;
    select.disabled = false;

    // En dos grupos. Dieciocho nombres que no dicen nada a quien no los sigue de
    // cerca, y la diferencia entre el primero y el último no es de matiz: unos
    // traducen y otros devuelven algo con forma de frase.
    const opciones = (cuales) =>
        cuales.map((m) => `<option value="${m.id}">${m.nombre || m.id}</option>`).join('');
    const recomendados = modelosLocales.filter((m) => m.recomendado);
    const losDemas = modelosLocales.filter((m) => !m.recomendado);

    select.innerHTML = [
        recomendados.length
            ? `<optgroup label="${t('ai_modelos_recomendados')}">${opciones(recomendados)}</optgroup>`
            : '',
        losDemas.length
            ? `<optgroup label="${t('ai_modelos_los_demas')}">${opciones(losDemas)}</optgroup>`
            : '',
    ].join('');

    // El guardado, si sigue estando; si no, el que se propone de partida, que es
    // el del equilibrio y no el primero de la lista —que es el más pesado.
    const porDefecto = modelosLocales.find((m) => m.id === MODELO_LOCAL_POR_DEFECTO);
    if (elegido && modelosLocales.some((m) => m.id === elegido)) select.value = elegido;
    else if (porDefecto) select.value = porDefecto.id;
}

/**
 * Por dónde se cancela una descarga que se está haciendo eterna.
 * @type {AbortController|null}
 */
let descargaEnCurso = null;

/**
 * Enseña cómo va la descarga del modelo.
 *
 * @param {{parte: number, texto: string}} paso
 */
function pintarLaDescarga({ parte, texto }) {
    $('aiDescarga')?.classList.remove('hidden');

    const relleno = $('aiDescargaRelleno');
    if (relleno) {
        // Sin cifra que enseñar, la barra se mueve sola. Es la diferencia entre
        // "sigo trabajando" y "esto se ha colgado", que es lo que parece una
        // barra vacía y quieta durante cinco minutos.
        const sinCifra = !Number.isFinite(parte) || parte <= 0;
        relleno.classList.toggle('ia-descarga-sin-saber', sinCifra);
        relleno.style.width = sinCifra
            ? ''
            : `${Math.round(Math.min(1, Math.max(0, parte)) * 100)}%`;
    }

    const rotulo = $('aiDescargaTexto');
    if (rotulo) {
        rotulo.textContent =
            texto ||
            (Number(parte) > 0
                ? t('ai_descargando').replace('{0}', Math.round(parte * 100))
                : t('ai_descargando_sin_cifra'));
    }
}

/** Esconde la barra y se olvida de la descarga que hubiera. */
function cerrarLaDescarga() {
    $('aiDescarga')?.classList.add('hidden');
    descargaEnCurso = null;
}

/**
 * Se trae el modelo local y lo deja listo para usar.
 *
 * Es lo que hace que un servicio local esté "conectado": en la nube basta con
 * que la clave valga, pero aquí el modelo tiene que estar descargado y subido a
 * la tarjeta gráfica, y eso la primera vez son minutos.
 *
 * @param {Object} proveedor
 * @param {string} modelo
 */
async function traerElModelo(proveedor, modelo) {
    descargaEnCurso = new AbortController();
    // Se enseña la barra ya, antes de que el navegador diga nada: con el modelo
    // de Chrome pasa un buen rato entre el "empiezo" y el primer aviso de
    // progreso, y en ese rato no había nada en pantalla.
    pintarLaDescarga({ parte: 0, texto: '' });

    try {
        await motorDeWebLlm(modelo, { alProgresar: pintarLaDescarga });
    } finally {
        cerrarLaDescarga();
    }
}

/**
 * Borra del navegador los modelos que se hayan descargado.
 *
 * Un par de modelos probados son diez gigas guardados en el navegador, y ahí no
 * se ven: no salen en la carpeta de descargas ni en ningún sitio donde alguien
 * piense en mirar cuando le falte disco. Se borra todo de una vez, incluidas las
 * descargas que se cortaron a la mitad, que son las que más cuesta encontrar.
 */
async function borrarLoDescargado() {
    if (!preguntarSiSeguro) return;
    if (!(await preguntarSiSeguro(t('ai_borrar_modelos_confirmar'), { peligro: true }))) return;

    const estado = $('aiEspacioEstado');
    const boton = $('aiBorrarModelosBtn');
    if (estado) estado.textContent = ` ${t('ai_borrando_modelos')}`;
    if (boton) boton.disabled = true;

    try {
        const { modelos } = await borrarLosModelos();

        if (estado) estado.textContent = ` ${t('ai_modelos_borrados').replace('{0}', modelos)}`;

        // Lo que estuviera conectado ya no lo está: el modelo que usaba se acaba
        // de ir. Vale más volver a la primera cara que dejarlo diciendo que hay
        // una IA lista.
        const config = leerConfiguracion();
        if (proveedorPorId(config.proveedor)?.local) {
            guardarConfiguracion({ ...config, modelo: '' });
            enseñarCara(false);
        }
    } finally {
        if (boton) boton.disabled = false;
    }
}

/**
 * Recoge lo que hay escrito en la cara de "sin conectar".
 *
 * @returns {Object}
 */
function loEscrito() {
    const proveedor = proveedorPorId($('aiProveedor').value);
    return {
        proveedor: proveedor.id,
        clave: proveedor.necesitaClave ? $('aiClave').value.trim() : '',
        // Con un servicio de la nube todavía no se ha elegido modelo: lo trae
        // él. Con uno local hay que elegirlo antes, porque elegirlo es decidir
        // qué se descarga y cuánto ocupa.
        modelo: proveedor.local ? $('aiModeloLocal')?.value || '' : '',
        baseUrl: String(proveedor.urlPorDefecto || '').trim(),
        instrucciones: $('aiInstrucciones').value.trim(),
    };
}

/**
 * Conecta con el servicio y, si contesta, guarda la configuración.
 *
 * Guardar solo cuando el servicio ha contestado es lo que evita el caso peor:
 * una clave mal pegada que se queda guardada tan tranquila y no da la cara
 * hasta que estás a mitad de una pretraducción de mil segmentos.
 */
async function conectarYGuardar() {
    const estado = $('aiEstadoConexion');
    const boton = $('aiConectarBtn');

    const config = loEscrito();
    const proveedor = proveedorPorId(config.proveedor);

    estado.textContent = t(proveedor.local ? 'ai_preparando' : 'ai_conectando');
    boton.disabled = true;

    try {
        const resultado = await probarConexion(config);

        if (!resultado.bien) {
            estado.textContent = `❌ ${mensajeDeError(resultado)}`;
            return;
        }

        modelosDelServicio = resultado.modelos;

        // Con un servicio local manda lo elegido: el modelo es lo que se
        // descarga. Con uno de la nube, el más reciente que traiga el servicio.
        const modelo = proveedor.local
            ? config.modelo || proveedor.modeloPorDefecto
            : resultado.modelos[0]?.id || proveedor.modeloPorDefecto || '';

        // Y aquí es donde de verdad se trae el modelo. Guardar la
        // configuración sin haberlo descargado dejaría "conectado" un servicio
        // que se cae en la primera pregunta.
        if (proveedor.local) {
            try {
                await traerElModelo(proveedor, modelo);
            } catch (error) {
                estado.textContent = `❌ ${mensajeDeError(error)}`;
                $('aiDescarga')?.classList.add('hidden');
                return;
            }
        }

        guardarConfiguracion({ ...config, modelo });
        // Cambiar de servicio o de modelo a media conversación deja lo hablado
        // sin sentido: mejor empezar de cero.
        olvidarConversacion();

        enseñarCara(true);

        const bien = t('ai_conectado_bien')
            .replace('{servicio}', proveedor.nombre)
            .replace('{modelo}', modelo);
        estado.textContent = `✅ ${bien}`;

        // Y se cierra el cuadro: lo que se quería hacer era hablar con el
        // modelo, no quedarse en los ajustes. La confirmación se dice en la
        // conversación, que es adonde se va ahora y donde queda por escrito.
        $('aiConfigModal')?.classList.add('hidden');
        // El saludo pedía configurar una IA; ya está hecho.
        yaHayIAConectada();
        appendAiMessage('bot', `✅ ${bien}`);
    } finally {
        boton.disabled = false;
    }
}

/**
 * Engancha el panel.
 */
export function initAjustesDeIA({ confirmar } = {}) {
    preguntarSiSeguro = confirmar || null;

    const select = $('aiProveedor');
    if (!select) return;

    pintarAjustesDeIA();

    select.addEventListener('change', () => aplicarProveedor(select.value));

    $('aiRecordarClave').addEventListener('change', (evento) => {
        recordarLaClave(evento.target.checked);
        // Al marcarla, la clave que esté escrita pasa a guardarse en el
        // ordenador; al desmarcarla, guardarClave se encarga de que deje de
        // estarlo. Se guarda el modelo que ya hubiera, no uno vacío.
        const config = leerConfiguracion();
        guardarConfiguracion({ ...loEscrito(), modelo: config.modelo });
    });

    $('aiConectarBtn')?.addEventListener('click', conectarYGuardar);

    // Rendirse a media descarga. Un modelo tarda lo que tarda y no siempre se
    // tiene ese rato; sin esto, la única salida era cerrar la pestaña.
    $('aiCancelarDescargaBtn')?.addEventListener('click', () => {
        descargaEnCurso?.abort();
        cerrarLaDescarga();
        $('aiEstadoConexion').textContent = t('ai_descarga_cancelada');
    });

    $('aiBorrarModelosBtn')?.addEventListener('click', borrarLoDescargado);

    // Los ajustes avanzados, plegados de partida. El botón está en las dos
    // caras: los límites de subtitulado no dependen del servicio, y con uno ya
    // conectado es justo cuando se quieren tocar.
    for (const boton of document.querySelectorAll('.ia-avanzado-btn')) {
        boton.addEventListener('click', () => {
            const abierto = $('aiAvanzado').classList.toggle('hidden') === false;
            for (const otro of document.querySelectorAll('.ia-avanzado-btn')) {
                otro.setAttribute('aria-expanded', String(abierto));
            }
        });
    }

    // Respetar o no los límites de subtitulado. Se guarda al momento y no al
    // pulsar guardar: es una casilla suelta, y una casilla que hay que confirmar
    // en otro sitio es una casilla que la mitad de las veces no se aplica.
    $('aiRespetarLimites')?.addEventListener('change', (evento) => {
        guardarRespetarLimites(evento.target.checked);
    });

    // Cambiar de servicio: se vuelve a la primera cara con lo que hubiera
    // guardado de ese servicio. No se borra nada: si se cambia de idea, la
    // clave de antes sigue donde estaba.
    $('aiCambiarBtn')?.addEventListener('click', () => {
        modelosDelServicio = [];
        $('aiEstadoConexion').textContent = '';
        enseñarCara(false);
        $('aiProveedor').focus();
    });

    // Cambiar de modelo o de instrucciones no necesita volver a conectar: el
    // servicio ya ha dicho qué modelos tiene.
    $('aiGuardarModeloBtn')?.addEventListener('click', () => {
        const config = leerConfiguracion();
        guardarConfiguracion({
            ...config,
            modelo: $('aiModelo').value,
            instrucciones: $('aiInstrucciones').value.trim(),
        });
        olvidarConversacion();
        $('aiEstadoConexion').textContent = t('ai_guardado');
        $('aiConfigModal')?.classList.add('hidden');
    });
}
