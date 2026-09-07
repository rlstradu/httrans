/**
 * Una sola escala de tamaños en toda la herramienta.
 *
 * El editor se quedó en 14 px y las ventanas siguieron con lo que traía
 * Tailwind: 20 px los títulos, 16 px el cuerpo. Abrir una ventana encima del
 * editor parecía cambiar de programa.
 *
 * Estos tests no comprueban que algo sea bonito, que no se puede: comprueban que
 * no haya tamaños fuera de la escala. Es la clase de cosa que se desordena sola
 * cada vez que alguien añade una ventana con las clases que tenía a mano, y por
 * eso conviene tenerla escrita.
 */
import { test, expect, cargarPo } from './apoyo.js';

/** Los tres pasos permitidos, en píxeles. */
const ESCALA = [12, 14, 16];

/**
 * Tamaños de letra de todo lo que se ve dentro de un elemento.
 *
 * @returns {Promise<Array<{tamano: number, texto: string, etiqueta: string}>>}
 */
async function tamanosDentroDe(page, selector) {
    return page.locator(selector).evaluate((raiz) => {
        const encontrados = [];

        for (const el of raiz.querySelectorAll('*')) {
            // Solo lo que tiene texto propio: un contenedor hereda el tamaño de
            // su padre y contarlo sería contar dos veces lo mismo.
            const propio = [...el.childNodes]
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => n.textContent.trim())
                .join('');
            if (!propio) continue;

            const estilo = getComputedStyle(el);
            if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;

            encontrados.push({
                tamano: Math.round(parseFloat(estilo.fontSize)),
                texto: propio.slice(0, 40),
                etiqueta: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
            });
        }

        return encontrados;
    });
}

/** Comprueba que no haya nada fuera de la escala dentro de un elemento. */
async function todoEnLaEscala(page, selector) {
    const fuera = (await tamanosDentroDe(page, selector)).filter(
        (x) => !ESCALA.includes(x.tamano)
    );

    expect(
        fuera,
        `fuera de la escala en ${selector}: ` +
            fuera.map((x) => `${x.etiqueta} ${x.tamano}px "${x.texto}"`).join(' | ')
    ).toEqual([]);
}

test.describe('las ventanas usan la escala del editor', () => {
    test('la de copias de seguridad', async ({ page }) => {
        await page.locator('#fileBtn').click();
        await page.locator('#backupBtn').click();
        await expect(page.locator('#backupModal')).toBeVisible();
        await todoEnLaEscala(page, '#backupModal .modal-content');
    });

    test('la de buscar y reemplazar', async ({ page }) => {
        await page.locator('#toolsBtn').click();
        await page.locator('#findReplaceBtn').click();
        await expect(page.locator('#findReplaceModal')).toBeVisible();
        await todoEnLaEscala(page, '#findReplaceModal .modal-content');
    });

    test('la de atajos de teclado', async ({ page }) => {
        await page.locator('#toolsBtn').click();
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsModal')).toBeVisible();
        await todoEnLaEscala(page, '#shortcutsModal .modal-content');
    });

    test('la de proyectos recientes', async ({ page }) => {
        await page.locator('#projectBtn').click();
        await page.locator('#recentProjectsBtn').click();
        await expect(page.locator('#recentProjectsModal')).toBeVisible();
        await todoEnLaEscala(page, '#recentProjectsModal .modal-content');
    });

    test('el changelog', async ({ page }) => {
        await page.locator('#versionToggle').click();
        await expect(page.locator('#changelogModal')).toBeVisible();
        // La equis de cerrar es a propósito más grande; se mira el resto.
        await todoEnLaEscala(page, '#changelogContent');
    });
});

test.describe('los paneles usan la escala del editor', () => {
    test('el de terminología', async ({ page }) => {
        await page.locator('#terminologyBtn').click();
        await expect(page.locator('.terminology-sidebar')).toBeVisible();
        await todoEnLaEscala(page, '.terminology-sidebar');
    });

    test('el de memoria de traducción', async ({ page }) => {
        await page.locator('#tmBtn').click();
        await expect(page.locator('.translation-memory-sidebar')).toBeVisible();
        await todoEnLaEscala(page, '.translation-memory-sidebar');
    });

    test('el del asistente', async ({ page }) => {
        await page.locator('#aiBtn').click();
        await expect(page.locator('.ai-sidebar')).toBeVisible();
        await todoEnLaEscala(page, '.ai-sidebar');
    });
});

test.describe('la barra y los menús', () => {
    test('la barra de estadísticas', async ({ page }) => {
        await page.locator('#toolsBtn').click();
        await page.locator('#statsBtn').click();
        await cargarPo(page);
        await expect(page.locator('#statsContainer')).toBeVisible();
        await todoEnLaEscala(page, '#statsContainer');
    });

    test('los menús de la barra superior', async ({ page }) => {
        await page.locator('#fileBtn').click();
        await todoEnLaEscala(page, '.top-utility-buttons-container');
    });

    test('la barra de búsqueda', async ({ page }) => {
        await cargarPo(page);
        await todoEnLaEscala(page, '#poSearchContainer');
    });
});

test.describe('coherencia entre el editor y lo demás', () => {
    test('el texto de una ventana mide lo mismo que el del editor', async ({ page }) => {
        await cargarPo(page);

        const editor = await page
            .locator('textarea[id^="msgstr-"]')
            .first()
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

        await page.locator('#projectBtn').click();
        await page.locator('#recentProjectsBtn').click();
        const ventana = await page
            .locator('#recentProjectsModal .modal-content')
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

        expect(ventana).toBe(editor);
    });

    test('los títulos de ventana no doblan al texto', async ({ page }) => {
        // Antes eran de 20 px sobre un cuerpo de 16: el salto se notaba mucho
        // más que la jerarquía que pretendía marcar.
        await page.locator('#projectBtn').click();
        await page.locator('#recentProjectsBtn').click();

        const medidas = await page.locator('#recentProjectsModal .modal-content').evaluate((m) => ({
            titulo: parseFloat(getComputedStyle(m.querySelector('h2')).fontSize),
            cuerpo: parseFloat(getComputedStyle(m).fontSize),
        }));

        expect(medidas.titulo).toBeGreaterThan(medidas.cuerpo);
        expect(medidas.titulo - medidas.cuerpo).toBeLessThanOrEqual(2);
    });
});
