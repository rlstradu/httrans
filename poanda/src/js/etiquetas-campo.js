/**
 * Las etiquetas dentro del cuadro de traducción: en amarillo e indivisibles.
 *
 * Dos cosas que van juntas pero funcionan por separado.
 *
 * EL COLOR
 *
 * Un <textarea> no admite color por dentro: es texto plano y punto. El truco de
 * siempre es poner debajo una capa que dibuje solo los recuadros amarillos, con
 * las letras de verdad —las del textarea— encima. Lo delicado del truco es que
 * las dos capas midan exactamente igual, porque cualquier diferencia de tipo de
 * letra, interlínea o ancho descoloca los recuadros respecto a las palabras.
 * Aquí hay una ventaja heredada del editor compacto: el cuadro no tiene marco ni
 * relleno propio y crece hasta caber, así que no hay barra de desplazamiento que
 * sincronizar, que es la parte que suele dar guerra.
 *
 * LA INDIVISIBILIDAD
 *
 * Ver core/etiquetas-guardia.js, que es donde está la decisión. Aquí solo se
 * mueve la selección y se deja que edite el navegador.
 */
import { ajusteDeSeleccion } from './core/etiquetas-guardia.js';
import { partirPorEtiquetas } from './core/etiquetas.js';

/** Escapa el texto que va a salir como HTML. */
function escapar(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Marcado de la capa de color: el mismo texto, con las etiquetas envueltas.
 *
 * Las letras van transparentes (lo pone el CSS): de esta capa solo se ve el
 * fondo amarillo. Se escribe el texto entero y no solo las etiquetas porque es
 * lo que coloca cada recuadro en su sitio; sin el texto de en medio no habría
 * forma de saber dónde cae cada uno.
 *
 * @param {string} texto
 * @param {{id: string, familias: string[]}} perfil
 * @returns {string}
 */
export function marcadoDeCapa(texto, perfil) {
    const cadena = String(texto ?? '');

    const html = partirPorEtiquetas(cadena, perfil)
        .map((trozo) =>
            trozo.esEtiqueta
                ? `<span class="etiqueta-fondo">${escapar(trozo.texto)}</span>`
                : escapar(trozo.texto),
        )
        .join('');

    // Un salto de línea al final se ve en el textarea pero no en un div: sin
    // este remate, la última línea de las dos capas no coincide.
    return cadena.endsWith('\n') ? `${html} ` : html;
}

/**
 * Pone al día la capa de color de un cuadro de traducción.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {{id: string, familias: string[]}} perfil
 */
export function pintarCapa(textarea, perfil) {
    const capa = textarea.parentElement?.querySelector('.capa-etiquetas');
    if (capa) capa.innerHTML = marcadoDeCapa(textarea.value, perfil);
}

/** Pinta de una vez todas las capas del editor. */
export function pintarTodasLasCapas(contenedor, perfil) {
    contenedor
        .querySelectorAll('textarea.msgstr-textarea')
        .forEach((textarea) => pintarCapa(textarea, perfil));
}

/**
 * Qué clase de tecla es, a efectos del guardián.
 *
 * @param {KeyboardEvent} evento
 * @returns {string|null} 'Backspace', 'Delete', 'texto' o null si no edita.
 */
function claseDeTecla(evento) {
    if (evento.key === 'Backspace' || evento.key === 'Delete') return evento.key;

    // Una tecla que escribe un carácter tiene una key de longitud uno. Con Ctrl
    // o Cmd de por medio es un atajo, no una letra.
    if (evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
        return 'texto';
    }

    return null;
}

/**
 * Engancha el color y la indivisibilidad en todos los cuadros de traducción.
 *
 * Se usa delegación en el contenedor porque los segmentos se vuelven a dibujar
 * cada vez que se busca, se cambia de idioma o se abre otro archivo.
 *
 * @param {HTMLElement} contenedor El contenedor de los segmentos.
 * @param {() => {id: string, familias: string[]}} perfilActual Perfil del
 *   formato abierto; se pregunta en cada momento porque cambia con el archivo.
 */
export function initEtiquetasEnTraduccion(contenedor, perfilActual) {
    if (!contenedor) return;

    contenedor.addEventListener('keydown', (evento) => {
        const textarea = evento.target;
        if (!textarea.classList?.contains('msgstr-textarea')) return;
        if (textarea.readOnly) return;

        // Mientras se compone una tilde o se usa un método de entrada asiático,
        // el guardián se aparta. Tocar la selección en mitad de una composición
        // es exactamente lo que rompe la é.
        if (evento.isComposing || evento.keyCode === 229) return;

        const tecla = claseDeTecla(evento);
        if (!tecla) return;

        const ajuste = ajusteDeSeleccion({
            texto: textarea.value,
            inicio: textarea.selectionStart,
            fin: textarea.selectionEnd,
            tecla,
            perfil: perfilActual(),
        });

        // Se mueve la selección y se deja seguir al evento: la edición la hace
        // el navegador sobre lo que ahora hay seleccionado, así que el borrado
        // se lleva la etiqueta entera y el deshacer sigue funcionando.
        if (ajuste) textarea.setSelectionRange(ajuste.inicio, ajuste.fin);
    });

    // Pegar también puede partir una etiqueta si la selección la cortaba.
    contenedor.addEventListener('paste', (evento) => {
        const textarea = evento.target;
        if (!textarea.classList?.contains('msgstr-textarea') || textarea.readOnly) return;

        const ajuste = ajusteDeSeleccion({
            texto: textarea.value,
            inicio: textarea.selectionStart,
            fin: textarea.selectionEnd,
            tecla: 'texto',
            perfil: perfilActual(),
        });
        if (ajuste) textarea.setSelectionRange(ajuste.inicio, ajuste.fin);
    });

    // El color se repinta con cada cambio, venga de donde venga: del teclado, de
    // pegar, de insertar una etiqueta con el ratón o de la memoria de traducción.
    contenedor.addEventListener('input', (evento) => {
        if (evento.target.classList?.contains('msgstr-textarea')) {
            pintarCapa(evento.target, perfilActual());
        }
    });
}
