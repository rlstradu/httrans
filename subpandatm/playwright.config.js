import { defineConfig, devices } from '@playwright/test';

/**
 * Los tests se ejecutan contra el resultado compilado, servido desde la raíz
 * del sitio igual que en httrans.org: así se comprueba de paso que las rutas
 * del logotipo y de los iconos funcionan de verdad.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'line' : 'list',
    use: {
        baseURL: 'http://127.0.0.1:5174/subpandatm/',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    // La herramienta no necesita nada de la red salvo los CDN,
                    // y los tests los interceptan: se apagan los servicios en
                    // segundo plano para que no cuelguen la ejecución en
                    // entornos sin salida a internet.
                    args: [
                        '--disable-background-networking',
                        '--disable-component-update',
                        '--disable-sync',
                        '--no-first-run',
                        '--no-default-browser-check',
                    ],
                    // Permite apuntar a un Chromium ya instalado en el sistema.
                    // Si la variable no está, Playwright usa el suyo.
                    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
                        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
                        : {}),
                },
            },
        },
    ],
    webServer: {
        command: 'npm run build && npx --yes serve .. -l 5174',
        url: 'http://127.0.0.1:5174/subpandatm/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
