import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de los tests de navegador.
 *
 * Levanta un servidor estático en esta misma carpeta (Poanda usa módulos ES, que
 * por `file://` no cargan) y ejecuta los tests contra él.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'line' : 'list',
    // Los tests se ejecutan contra el resultado compilado y servido desde la
    // raíz del sitio, igual que en httrans.org: así se comprueba de paso que las
    // rutas del logo (/images/...) y del changelog funcionan de verdad.
    use: {
        baseURL: 'http://127.0.0.1:5173/poanda/',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Normalmente Playwright usa el navegador que él mismo descarga
                // con `npx playwright install`. Esta variable permite apuntar a
                // un Chromium ya instalado en el sistema (útil en servidores de
                // integración continua). Si no está definida, no cambia nada.
                launchOptions: {
                    // Poanda no necesita nada de la red salvo los CDN, y los
                    // tests los interceptan: se desactivan los servicios en
                    // segundo plano del navegador para que no cuelguen la
                    // ejecución en entornos sin salida a internet.
                    args: [
                        '--disable-background-networking',
                        '--disable-component-update',
                        '--disable-sync',
                        '--no-first-run',
                        '--no-default-browser-check',
                    ],
                    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
                        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
                        : {}),
                },
            },
        },
    ],
    webServer: {
        command: 'npm run build && npx --yes serve .. -l 5173',
        url: 'http://127.0.0.1:5173/poanda/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
