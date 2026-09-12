# Migraciones reproducibles y recuperación — T03

Estado: instalación limpia y actualización verificadas con 416 pruebas pgTAP cada una. No se aplicaron ni repararon migraciones remotas ni se reinició la base original.

## Ambientes y guardas

La base de trabajo existente usa proyecto `lysto`, puerto 55322. El ensayo usa exclusivamente `E:/Proyectos/GitHub/Lysto-production-db-check`, proyecto `lysto_production_check`, puerto 56322, con marcador `DISPOSABLE.json` que declara purpose, projectId, databasePort y production=false.

Antes de reset/up/test comprobar ese marcador, config.toml, nombre del contenedor y puerto publicado. Los comandos de este documento no son instrucciones para ejecutar sobre el proyecto `lysto` ni sobre un proyecto remoto. Si el directorio ya existe sin marcador coincidente, detenerse y elegir otro destino nuevo. No sustituir --local por --linked.

La copia descartable contiene config, diez migraciones, seed y tests/fixtures SQL del snapshot. Los puertos API/Studio/shadow se diferenciaron también; el ensayo de T03 sólo necesita PostgreSQL, no todos los servicios de Supabase. Dos corridas independientes reutilizan el proyecto descartable tras capturar el esquema y resultado de la primera.

## Instalación desde cero

1. Crear un directorio nuevo y copiar exclusivamente supabase/config.toml, migrations, seed.sql y tests; no copiar .temp, vínculos remotos o secretos.
2. Asignar project_id único y puertos libres. Escribir el marcador descartable y verificarlo.
3. Desde el worktree, ejecutar `corepack pnpm exec supabase db start --workdir E:/Proyectos/GitHub/Lysto-production-db-check`.
4. Confirmar historial de las diez migraciones, capturar schema-only y ejecutar `corepack pnpm exec supabase test db --local --workdir E:/Proyectos/GitHub/Lysto-production-db-check`.
5. Generar tipos con `corepack pnpm exec supabase gen types --local --lang typescript --schema public --workdir E:/Proyectos/GitHub/Lysto-production-db-check`. Separar stdout de mensajes stderr; comparar antes de reemplazar tipos en código.
6. Ejecutar `corepack pnpm exec supabase db lint --local --schema public,private,invitation_gateway --fail-on error --workdir E:/Proyectos/GitHub/Lysto-production-db-check`. Comprobar resultado, no sólo exit code cuando se use el default fail-on none.

Resultado observado: diez migraciones y seed aplicados; 416 tests pgTAP en nueve archivos pasaron. El lint de public/private devolvió results vacío. Los tipos generados son idénticos a los versionados al normalizar finales de línea; no se sobrescribió el archivo ni se agregó una migración innecesaria.

## Ensayo de actualización

1. Capturar esquema/historial de la instalación limpia y conservar evidencia fuera de la DB.
2. Verificar nuevamente marcador y destino; ejecutar `corepack pnpm exec supabase db reset --local --version 202608190007 --workdir E:/Proyectos/GitHub/Lysto-production-db-check --yes` exclusivamente allí.
3. Verificar siete migraciones. Ejecutar `scripts/fixtures/migration-upgrade.sql` como postgres exclusivamente en el contenedor `supabase_db_lysto_production_check`, con `psql -v ON_ERROR_STOP=1`. Crea un cliente, solicitud, trabajo y pago sintéticos; no hace solicitudes al proveedor. Guardar la salida JSON de `scripts/fixtures/migration-witness.sql` antes de actualizar y exigir que las cuatro listas contengan una fila cada una: una comparación de tablas vacías no demuestra conservación de datos.
4. Ejecutar `corepack pnpm exec supabase migration up --local --workdir E:/Proyectos/GitHub/Lysto-production-db-check` para aplicar las tres pendientes.
5. Confirmar diez migraciones y ejecutar de nuevo `migration-witness.sql`; comparar exactamente los campos existentes de agosto. Guardar evidencia antes/después, esquema equivalente a la instalación limpia y tipos sin drift. Ejecutar `scripts/fixtures/migration-upgrade-cleanup.sql` sólo en el mismo contenedor descartable: retira los siete registros creados por el ensayo. Luego ejecutar pgTAP completo, que tiene fixtures y conteos propios y exige una base con sólo seed.
6. Guardar duración, logs y manifiesto. Detener sólo el proyecto de prueba al terminar si no se necesita inmediatamente; conservar su volumen/evidencia.

Resultado observado: historial 7 → 10, cuatro listas no vacías conservadas exactamente y esquema convergente. Después de retirar los testigos sintéticos, pasaron 416 casos pgTAP en nueve archivos (3 segundos reportados por el runner; no incluye reset). Se inventariaron las 53 tablas públicas, todas con RLS activo; la única vista pública usa security_invoker=true. Los clientes anon/authenticated carecen de SELECT/INSERT/UPDATE/DELETE en las tres tablas OAuth/webhook. El inventario de private muestra privilegios de postgres y permisos limitados de service_role para outbox/inbox; los casos de roles se validan en pgTAP.

Se conservaron dos intentos fallidos: un timeout de conexión local de CLI (comprobación directa posterior exitosa) y un pgTAP iniciado antes de retirar los testigos, que chocó con IDs y conteos propios. Se corrigió el orden del ensayo sin alterar migraciones ni debilitar aserciones. La comparación inicial de perfiles/trabajos vacíos se descartó como evidencia de conservación y fue reemplazada por el ensayo poblado. Estos incidentes no se cuentan como pases.

También pasaron los ocho casos existentes de `marketplace-ledger.vitest.test.ts` y `marketplace-storage.vitest.test.ts`, usando exclusivamente LYSTO_TEST_DATABASE_URL con localhost:56322 en el proceso de prueba. Se ejecutaron sobre PostgreSQL/Prisma reales en Windows, con respuestas del proveedor simuladas y sin operaciones externas. No sustituyen las pruebas integrales de T04 ni los ensayos de Mercado Pago de las tareas posteriores. El lint final se ejecutó con --fail-on error y devolvió «No schema errors found».

## Diferencia del historial original

La base original registra sólo 202608190001–202608190007. Se obtuvo un dump de esquema únicamente (public/private, incluyendo permisos) en modo lectura. Su contenido normalizado coincide con el obtenido al aplicar las diez migraciones desde cero. No se encontraron diferencias estructurales en esa comparación; no implica que todos los comportamientos del producto estén completos.

No ejecutar `migration repair` a ciegas. Para reconciliar un entorno persistente: identificar versión desplegada y proyecto, capturar backup y esquema/grants/funciones, comparar cada migración pendiente y su representación efectiva, documentar aprobación y usar la operación de historial apropiada sólo después de demostrar equivalencia. Un entorno con drift requiere corrección explícita; no marcar aplicada una migración que no lo está. Antes de actuar sobre remoto volver a consultar ayuda de CLI y permisos vigentes.

## Nuevas migraciones y recuperación

- Generar filename mediante `supabase migration new <nombre>`; no inventar timestamp ni reescribir migraciones ya desplegadas.
- Expandir antes de contraer: columnas/funciones compatibles, backfill probado, deploy compatible, comprobación, retiro posterior. Mantener separación entre esquema y seed de pruebas.
- En producción, cualquier cambio exige destino confirmado, historial, backup, ventana/responsable y preflight. Este runbook no constituye autorización de lanzamiento.
- Rollback de app sólo si compatible con esquema. Preferir forward fix si ya existen datos nuevos. No borrar pagos ni devolver la DB a un instante anterior sin reconciliar eventos posteriores del proveedor.
- El ensayo de migraciones no demuestra recuperación de Storage, secretos u operaciones remotas; esa aceptación corresponde a T32.

Referencias: [CLI Supabase](https://supabase.com/docs/reference/cli/supabase-db-start), [migraciones](https://supabase.com/docs/guides/local-development/database-migrations). Se verificaron comandos de la CLI instalada 2.115.0 con --help.
