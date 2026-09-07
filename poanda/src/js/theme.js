/**
 * Modo claro / oscuro de Poanda.
 *
 * Sigue el patrón de PandaTerm y Pandoria: una clase `dark-mode` en el <body>
 * activa las reglas oscuras de css/styles.css, y la preferencia se recuerda en
 * el navegador con una clave propia de esta herramienta (`poandaDarkMode`).
 *
 * El botón lleva texto, no un emoji: un sol y una luna se parecen demasiado a
 * primera vista y nunca queda claro si dicen en qué modo estás o a cuál vas.
 * Dice a cuál vas, como cualquier otro botón de la barra.
 */
import { state } from './state.js';
import { translations } from './translations.js';

/**
 * Enciende o apaga el modo oscuro en las dos raíces de la página.
 *
 * La clase del <body> es la que usan todas las reglas de color. La del <html>
 * existe solo para poder declarar ahí `color-scheme: dark`: las barras de
 * desplazamiento las pinta el navegador, no la hoja de estilos, y solo hacen
 * caso a esa propiedad puesta en la raíz del documento. Sin ella la página
 * queda oscura con dos barras blancas a los lados.
 *
 * @param {boolean} oscuro
 */
function aplicarModo(oscuro) {
    document.body.classList.toggle('dark-mode', oscuro);
    document.documentElement.classList.toggle('dark-mode', oscuro);
}

/**
 * Pone en el botón el nombre del modo al que lleva.
 *
 * Se llama al arrancar, al cambiar de modo y al cambiar de idioma: el texto
 * depende de las dos cosas.
 */
export function actualizarBotonTema() {
    const boton = document.getElementById('darkModeToggle');
    if (!boton) return;

    const enOscuro = document.body.classList.contains('dark-mode');
    const textos = translations[state.currentLanguage] || translations.en;
    boton.textContent = textos[enOscuro ? 'light_mode_btn' : 'dark_mode_btn'];
}

/** Aplica la preferencia guardada y engancha el botón de cambiar tema. */
export function initTheme() {
    const darkModeToggle = document.getElementById('darkModeToggle');

    aplicarModo(localStorage.getItem('poandaDarkMode') === 'true');
    actualizarBotonTema();

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const oscuro = !document.body.classList.contains('dark-mode');
            aplicarModo(oscuro);
            localStorage.setItem('poandaDarkMode', oscuro);
            actualizarBotonTema();
        });
    }
}
