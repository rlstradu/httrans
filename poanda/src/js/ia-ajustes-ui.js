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
 * El campo de la dirección solo sale con "compatible con OpenAI": para los tres
 * servicios de la nube la dirección es fija y enseñarla solo invita a
 * estropearla. Y con un servicio local no se pide clave, porque no la hay.
 */
import {
    guardarConfiguracion,
    leerConfiguracion,
    recordarLaClave,
    seRecuerdaLaClave,
} from './core/ia/ajustes.js';
import { listaDeProveedores, probarConexion, proveedorPorId } from './core/ia/proveedores.js';
import { olvidarConversacion } from './ai.js';
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
 * ¿Hay una configuración con la que se pueda llamar al servicio?
 *
 * No comprueba que funcione —eso solo lo sabe el servicio—, sino que no falte
 * nada: servicio elegido, clave si la pide, y modelo.
 *
 * @returns {boolean}
 */
function estaConectado() {
    const config = leerConfiguracion();
    const proveedor = proveedorPorId(config.proveedor);
    if (!proveedor) return false;
    if (proveedor.necesitaClave && !config.clave) return false;
    return Boolean(config.modelo || proveedor.modeloPorDefecto);
}

/**
 * Pinta el panel con lo que haya guardado, enseñando la cara que toque.
 */
export function pintarAjustesDeIA() {
    const select = $('aiProveedor');
    if (!select) return;

    const config = leerConfiguracion();

    select.innerHTML = listaDeProveedores()
        .map((p) => `<option value="${p.id}">${p.nombre}</option>`)
        .join('');
    select.value = config.proveedor;

    aplicarProveedor(select.value);
    $('aiRecordarClave').checked = seRecuerdaLaClave();
    $('aiInstrucciones').value = config.instrucciones || '';

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
    $('aiBaseUrl').value = config.baseUrl || proveedor.urlPorDefecto || '';

    // Un servicio local no tiene clave que pedir; pedirla solo confunde.
    $('aiClaveBloque').classList.toggle('hidden', !proveedor.necesitaClave);
    // La dirección solo se toca en el genérico: los otros tres la tienen fija.
    $('aiUrlBloque').classList.toggle('hidden', proveedor.id !== 'compatible');
    $('aiEstadoConexion').textContent = '';
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
        clave: $('aiClave').value.trim(),
        // Al conectar todavía no se ha elegido modelo: lo trae el servicio.
        modelo: '',
        baseUrl: ($('aiBaseUrl').value.trim() || proveedor.urlPorDefecto).trim(),
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

    estado.textContent = t('ai_conectando');
    boton.disabled = true;

    const config = loEscrito();

    try {
        const resultado = await probarConexion(config);

        if (!resultado.bien) {
            estado.textContent = `❌ ${resultado.mensaje}`;
            return;
        }

        modelosDelServicio = resultado.modelos;

        // El más reciente que traiga el servicio; y si no trae ninguno —hay
        // servicios locales que no saben listar—, el que el proveedor propone.
        const proveedor = proveedorPorId(config.proveedor);
        const modelo = resultado.modelos[0]?.id || proveedor.modeloPorDefecto || '';

        guardarConfiguracion({ ...config, modelo });
        // Cambiar de servicio o de modelo a media conversación deja lo hablado
        // sin sentido: mejor empezar de cero.
        olvidarConversacion();

        enseñarCara(true);
        estado.textContent = `✅ ${t('ai_conectado_bien')
            .replace('{servicio}', proveedor.nombre)
            .replace('{modelo}', modelo)}`;
    } finally {
        boton.disabled = false;
    }
}

/**
 * Engancha el panel.
 */
export function initAjustesDeIA() {
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
        $('aiConfigPanel')?.classList.add('hidden');
    });
}
