import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest solo se ocupa de los tests de la lógica pura, que viven en `tests/`.
 * Los de `e2e/` son de Playwright y necesitan un navegador de verdad.
 *
 * El atajo `@core` tiene que estar aquí igual que en vite.config.js: los tests
 * importan las piezas compartidas por ese nombre, y si Vitest no supiera
 * resolverlo fallarían todos a la vez sin decir por qué.
 */
export default defineConfig({
    resolve: {
        alias: { '@core': path.resolve(AQUI, '..', 'panda-core') },
    },
    test: {
        include: ['tests/**/*.test.js'],
    },
});
