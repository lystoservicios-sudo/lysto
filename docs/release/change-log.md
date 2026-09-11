# Registro de implementación de producción

## Inicio — T00

Usuario autorizó implementar el plan etapa por etapa. Se preservó el directorio auditado en commit 2d1936c y worktree aislado; source index sin cambios. Los archivos nuevos de precios, pagos y planes están incluidos. No se copió .env.local.

Baseline: instalación congelada, lint, typecheck y pruebas locales pasan; ocho pruebas DB omitidas quedan explícitas. El primer build encontró código auxiliar bajo output; se movió nuestra copia fuera del proyecto. El siguiente se interrumpió por consumo de recursos. Esos intentos no cuentan como pases; los builds del candidato actualizado se verificaron en T02.

## T01 — decisiones y entornos

Se creó inventario D01–D12 sin atribuir aprobaciones comerciales nuevas. La autorización recibida habilita implementación técnica del plan; no certifica tarifas, políticas, contratos o entornos externos. Se identificó evidencia local de demo Vercel lysto-demo, sin asumir que sea producción.

## T02 — dependencias verificadas

Audit productivo pasó de 9 avisos (2 críticos, 4 altos, 3 moderados) a cero. Next/eslint-config-next 15.5.24, PostCSS 8.5.26 y Sharp 0.35.4; se retiró el SDK directo no usado de Mercado Pago, conservando React y split. El vendor se reconstruyó en Linux: 85 archivos idénticos; licencia UNLICENSED y autorización comercial pendiente en D05.

Instalaciones congeladas y builds Windows/Linux completos; comprobaciones del runtime de pagos e imágenes en ambos sistemas. La suite previa al último ajuste de Sharp pasó 124 casos de dominio y 263 unitarios, con ocho DB omitidos. El ajuste final de Sharp pasó optimización real y ambos builds con lint/tipos. Alcance, hashes y evidencia en dependency-verification.json.

## T03 — base reproducible y actualización verificadas

Una base descartable de proyecto/puertos propios aplica diez migraciones desde cero; 416 pgTAP pasan. Un ensayo independiente parte de siete migraciones, carga registros ficticios, aplica las tres pendientes y conserva exactamente los campos comprobados de cliente, solicitud, trabajo y pago. Tras retirar esos testigos, pasan los 416 pgTAP y ocho pruebas reales de PostgreSQL/Prisma con proveedor simulado.

Esquema limpio/actualizado/original coincidente en public/private y tipos generados idénticos. Todas las 53 tablas públicas tienen RLS, y los clientes no tienen acceso directo a tablas OAuth. No se justificó una nueva migración ni se reparó el historial de la base original. Se preservan los intentos fallidos y sus causas en database-verification.json.

## Próximo bloque

T04: guardas de entornos, identidades aisladas y pruebas integrales. T05: contrato único de servicio e invariantes. Las rutas históricas del plan apuntan al repositorio original; para implementar se resuelven bajo executionWorktree del progreso. Al cierre de este bloque hay 4/40 tareas verificadas, sin promover gates de staging, piloto o producción.
