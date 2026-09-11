# Línea base de implementación

La implementación se ejecuta en `E:/Proyectos/GitHub/Lysto-production-readiness`, rama `codex/production-readiness`.

Se preservaron 536 archivos del directorio auditado, incluidos cambios y archivos nuevos de interfaz, presupuestos, pagos, migraciones, vendor y planes. El commit de partida es `2d1936c7db150832b96b196c13f990501463c21f`, con padre `6bbabd3187498a3bf0b69b9f2d714bf787fb1ca0` y árbol `78e4627223acba17868dd509b2833c950f563bd5`.

Se creó el snapshot con un índice Git alternativo. La rama principal, su índice y los cambios de aplicación existentes se conservaron. El registro del plan en el directorio original apunta ahora al worktree de ejecución. No se copiaron secretos de .env.local.

El manifiesto [baseline-manifest.json](./baseline-manifest.json) registra hashes del lockfile, vendor y diez migraciones; versiones y resultados. Las ocho pruebas que requieren PostgreSQL quedaron omitidas en la suite inicial sin DB. No acreditan integración; se volverán obligatorias en T04.

Las exclusiones incluyen builds, node_modules, adjuntos, logs y artefactos de navegador. Los parches de origen y la lista exacta de archivos quedan en el output local del repositorio original; el commit preserva la parte versionable. Se ejecutó escaneo acotado de patrones de secretos sin coincidencias; no constituye una auditoría exhaustiva de secretos.

## Recuperación

Para consultar la base usar el commit indicado en otra copia aislada. No aplicar reset/clean sobre el directorio original. Para revertir cambios posteriores, revisar y revertir sólo los commits de implementación afectados. Nunca revertir datos financieros ni ejecutar reset de DB para deshacer un cambio de aplicación.

## Verificación

Instalación congelada, lint, tipos y suites de dominio/unitarias iniciales pasaron. Build y resultados finales de esta tarea se documentan en el manifiesto y change-log. No se ha autorizado producción por pasar estos checks.
