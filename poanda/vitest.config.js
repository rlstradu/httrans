import { defineConfig } from 'vitest/config';

/**
 * Vitest solo se ocupa de los tests de la lógica pura, que viven en `tests/`.
 * Los de `e2e/` son de Playwright y necesitan un navegador de verdad.
 */
export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
    },
});
