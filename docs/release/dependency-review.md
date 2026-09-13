# Revisión de dependencias y paquete de pagos — T02

Estado: T02 verificado en Windows y Linux. No autoriza producción.

## Cambios acotados

- Next.js y eslint-config-next fijados juntos en 15.5.24. La auditoría inicial identificó dos avisos críticos en Next 15.5.23: [Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) y [optimización AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4). Sus condiciones de explotación son específicas; no se afirma que Lysto haya sido comprometido.
- PostCSS resuelto por Next actualizado a 8.5.26 con override limitado a Next 15.5.24. El paquete del framework seguía fijando 8.4.31; se mantiene el mismo major y se valida la compilación real de CSS. El override requiere revisión al actualizar Next, no es una excepción al audit.
- Sharp resuelto por Next fijado en 0.35.4, dentro del rango admitido por Next 15.5.24 (`^0.34.3 || ^0.35.3`). El lockfile retenía 0.34.5 después de actualizar Next. [Release oficial de Sharp](https://github.com/lovell/sharp/releases/tag/v0.35.4).
- Se eliminó únicamente la dependencia directa `mercadopago@2.13.0`: un escaneo de imports/imports dinámicos/require en archivos versionados no encontró consumidores directos. Traía `uuid@9.0.1`, con aviso moderado. Se conserva `@mercadopago/sdk-react` y el paquete propietario de split; su SDK transitorio efectivo es `mercadopago@3.6.1`.
- El adaptador Supabase SSR no fue cambiado: sus pruebas de cookies, login y tipos pasan. No se hizo una actualización mayor ajena a la corrección de seguridad.
- La generación de páginas de Next usa como máximo dos procesos, evitando que el número de núcleos del equipo multiplique el consumo de memoria durante builds. No cambia la concurrencia del servidor desplegado.

## Procedencia y reconstrucción del vendor

Origen: https://github.com/waltergaltieri/mercadopago-split-node, commit `aeb07a24303edf701004ec1dbb8d4073dc8784af`. Se descargó una copia independiente y se reconstruyó en Linux con Node 22.23.2, `npm ci --no-audit --no-fund` y `npm pack`.

Los 85 archivos contenidos coinciden byte por byte con el tarball instalado por Lysto. Los bytes del contenedor tar/gzip difieren; no se afirma identidad binaria entre tarballs. Se conserva el original. Los hashes, commit, imagen y resultado están en `docs/release/vendor-provenance.json`; los logs y la comparación completa quedan en output/production-readiness.

El paquete declara `UNLICENSED`. Se conserva su uso existente, sin cambiar licencia ni publicarlo. Debe registrarse titularidad/autorización comercial aplicable en D05 antes de redistribución a terceros; no se presume una licencia de código abierto.

## Verificación reproducible

- `pnpm verify:payments`: carga exportaciones y Prisma generado, prueba cifrado/descifrado y aislamiento de contexto; no conecta DB ni llama al proveedor.
- `pnpm verify:images`: comprueba dependencias efectivamente resueltas por Next, optimiza y decodifica JPEG/PNG/WebP y exige el rechazo de AVIF como entrada. Next 15.5.24 bloquea intencionalmente ese cargador por seguridad; no se elimina la restricción. El checker falló primero por Sharp 0.34.5 y luego se adaptó al contrato público y al bloqueo de AVIF verificados en código/documentación.
- `scripts/verify-linux-release.sh`: instala desde lockfile en copia limpia Linux, ejecuta ambos smoke tests, pruebas de módulo de pagos y build. Las ocho pruebas de PostgreSQL se acreditan por separado en T03/T04; no se cuenta un skip como pass.
- El audit inicial tuvo 9 avisos: 2 críticos, 4 altos y 3 moderados. El primer update dejó sólo los dos avisos de Sharp, motivando el pin específico. Ver resultados finales en el manifiesto de esta tarea.

La imagen de revisión está fijada por digest en vendor-provenance.json. Las compilaciones y fixtures no usan .env.local del usuario, tokens del proveedor ni proyectos remotos.

Resultado: audit productivo final con cero avisos; instalación congelada y build de producción completos en Windows y Linux. Lint, tipos, 124 pruebas de dominio y 263 unitarias pasaron; ocho casos de DB omitidos en esa corrida se verifican por separado en T03. Linux ejecutó además 32 casos del módulo marketplace y los smoke tests de pagos e imágenes. Los 32 son un subconjunto de la suite, no se suman como cobertura nueva.

La suite Windows se ejecutó tras actualizar Next/PostCSS y retirar el SDK directo; el último cambio de Sharp se verificó con instalación congelada, optimización real de imágenes y ambos builds completos. Cada build incluye lint/tipos. No se repite ni se presenta esa suite anterior como ejecutada después del último cambio de Sharp. El manifiesto conserva hashes y alcance por comprobación. Cero avisos de dependencias productivas no equivale a una auditoría completa de seguridad del sistema.

La revisión independiente encontró que una repetición fallida del checker Linux podía conservar el resultado passed anterior. Se reprodujo el fallo y se corrigió: el archivo pasa a running al inicio y a failed con código de salida ante errores. Una prueba aislada con comandos simulados comprobó error y éxito; no se acredita esa simulación como build. Los builds completos preceden este cambio exclusivo de reporte. La aplicación y la secuencia de instalación/pruebas/build no cambiaron.

## Recuperación

Revertir juntos package.json y pnpm-lock.yaml del cambio que corresponda. Si reaparecen avisos aplicables, mantener el lanzamiento bloqueado. No revertir migraciones, datos ni pagos para deshacer una actualización de dependencias.
