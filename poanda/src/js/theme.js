/**
 * Modo claro / oscuro de Poanda.
 *
 * Sigue el patrón de PandaTerm y Pandoria: una clase `dark-mode` en el <body>
 * activa las reglas oscuras de css/styles.css, y la preferencia se recuerda en
 * el navegador con una clave propia de esta herramienta (`poandaDarkMode`).
 */

/** Aplica la preferencia guardada y engancha el botón de cambiar tema. */
export function initTheme() {
    // --- LÓGICA MODO OSCURO ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    // Cargar preferencia guardada
    const isDarkMode = localStorage.getItem('poandaDarkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if (darkModeToggle) darkModeToggle.textContent = '☀️';
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const enabled = document.body.classList.contains('dark-mode');
            localStorage.setItem('poandaDarkMode', enabled);
            darkModeToggle.textContent = enabled ? '☀️' : '🌙';
        });
    }
}
