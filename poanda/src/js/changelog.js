/**
 * Modal de changelog de Poanda.
 *
 * El botón de versión de la cabecera abre una ventana con el historial de
 * cambios, que se descarga en vivo del CHANGELOG.md de esta misma carpeta.
 * Así el historial vive junto al código de la herramienta, igual que en
 * PandaTerm y Pandoria.
 */

/** Engancha el botón de versión y el cierre del modal. */
export function initChangelog() {
    // --- LÓGICA CHANGELOG ---
    const versionToggle = document.getElementById('versionToggle');
    const changelogModal = document.getElementById('changelogModal');
    const changelogCloseBtn = document.getElementById('changelogCloseBtn');
    const changelogContent = document.getElementById('changelogContent');

    if (versionToggle && changelogModal) {
        versionToggle.addEventListener('click', async () => {
            changelogContent.textContent = 'Cargando changelog...';
            changelogModal.classList.remove('hidden');
            try {
                // Se añade el timestamp a la URL para evitar que el navegador guarde el txt en caché
                const response = await fetch(`CHANGELOG.md?t=${new Date().getTime()}`);
                if (response.ok) {
                    const text = await response.text();
                    changelogContent.textContent = text;
                } else {
                    changelogContent.textContent =
                        'Error al cargar el changelog (HTTP ' + response.status + ').';
                }
            } catch (error) {
                changelogContent.textContent = 'Error de red al cargar el changelog.';
                console.error('Error al obtener el changelog:', error);
            }
        });

        changelogCloseBtn.addEventListener('click', () => {
            changelogModal.classList.add('hidden');
        });
    }
}
