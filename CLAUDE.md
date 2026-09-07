# CLAUDE.md — httrans / PandaTools

Este archivo es solo un puntero con notas específicas para sesiones de Claude. **La fuente de verdad de convenciones del proyecto es `AGENTS.md`** — léelo primero, entero, antes de tocar cualquier archivo. `docs/design-system.md` cubre el sistema visual y `ONBOARDING.md` la guía práctica de arranque.

## Notas para esta sesión de Claude

- **Explica siempre en español sencillo.** Quien mantiene este proyecto es traductor, no desarrollador de formación — evita jerga técnica sin explicarla, y describe qué hace un cambio y por qué, no solo el diff.
- **Usa la lista de tareas** (TaskCreate/TaskUpdate) para cualquier trabajo de varios pasos en este proyecto — ayuda a que el usuario siga el progreso sin tener que leer cada mensaje intermedio.
- **El proyecto está en rebranding parcial y deliberadamente lento**: "PandaTools by HTTrans". No asumas que hay que renombrar el repositorio, el dominio (httrans.org) o las cuentas existentes — eso no se ha pedido. Si algo de texto visible menciona "httrans" o "HTML Translation Toolkit", no lo cambies por iniciativa propia; pregunta primero si no está claro por el contexto de la conversación.
- **No hay acceso automático a GitHub, FTP, MailerLite ni al hosting real de httrans.org desde esta sesión**, salvo que se conecte un conector o el dispositivo del usuario explícitamente. El flujo normal es: se edita el archivo en el entorno de trabajo, se entrega con SendUserFile, y la persona lo sube ella misma (o se conecta el dispositivo/conector si hace falta automatizar eso).
- **`subpandaAUTO/` ya está auditada** (sept. 2026): no sigue el patrón de pandaterm/pandoria, es un archivo único con dos scripts sacados fuera. Sin auditar sigue `pandatrainer/` (ver `AGENTS.md` §2).
- Al refactorizar una herramienta nueva al patrón pandaterm/pandoria, sigue la metodología de testeo de `AGENTS.md` §6 desde el principio del refactor, no como un paso posterior. **`poanda/` es la referencia**: fue la primera con módulos ES, Vitest y Playwright.
- **Un refactor no cambia comportamiento.** Si encuentras un fallo del código antiguo mientras refactorizas, documéntalo (con un test marcado como pendiente) y propón corregirlo aparte; no lo arregles en el mismo cambio.
- Los cambios de copy/textos (títulos, meta tags, descripciones SEO, textos de botones) normalmente se piden sueltos y rápidos — no hace falta lista de tareas para esos, basta con aplicarlos y confirmar.
