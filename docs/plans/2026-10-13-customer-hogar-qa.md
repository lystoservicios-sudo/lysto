# Hogar cliente — verificación e integración

Fecha: 2026-10-13. Alcance aprobado: varios hogares por direcciones propias, maqueta 3D orientativa, plantas y ambientes editables, únicamente aires acondicionados. Cámara y RA fuera de esta entrega.

## Estado de publicación

**Pendiente de autorización de Supabase y comprobación de base real. No declarar listo para producción ni publicar en main todavía.**

La rama conserva Inicio y Servicios previamente aprobados y añade Hogar sin duplicar el App Shell. La demo independiente no se utiliza como fuente de datos de clientes.

## Implementación cubierta

- Crear/configurar casa, departamento de edificio bajo/alto, PH, oficina o local comercial; características visuales de balcón, terraza y ventanas.
- Catálogo de 16 tipos de ambientes con 37 variantes, filtrados por tipo de hogar. Alta, edición, dimensiones/posición/rotación orientativas y eliminación confirmada.
- Crear, renombrar, ordenar y quitar plantas; mostrar exclusivamente la activa.
- Foco de un ambiente; alta transaccional de aire o ubicación de equipo existente sobre pared, posición y altura; cancelar, reubicar y quitar ubicación.
- Mantener ficha e historial reales. Eliminar un ambiente/planta o archivar un hogar no elimina equipos ni servicios.
- Estados vacíos/carga/error, recuperación de conflictos, reintentos inmutables, navegación enfocada y alternativa de lista sin GPU.

## Evidencia local

- Revisión independiente de cumplimiento: 101 pruebas enfocadas aprobadas antes de los últimos controles de capacidad.
- Recorridos de interfaz ampliados: 37/37; creación por perfil, varias plantas y hogares, variantes, persistencia solicitada por API, cancelación, errores, reintentos idénticos y navegación real.
- Geometría/escena: 21/21; todos los ambientes/variantes, seis tipos de aire, planta/foco, paredes, límites de ubicación y limpieza de recursos.
- Compilación Next completa aprobada. Regresión detectada/corregida en argumentos opcionales de Presupuestos y Solicitar: validación PageProps generada por Next.
- Dominio: 174/174. Seguridad del harness/herramientas: 27/27.
- Procesamiento de imágenes y biblioteca de pagos: comprobaciones locales aprobadas, sin consultas de base ni llamadas a proveedores.
- Actualizaciones de parche para superar auditoría de producción: Sharp 0.35.5 y source-map-js 1.2.2. Auditoría posterior: cero avisos altos/críticos; dos moderados preexistentes. Fuentes: [Sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

Las pruebas de UI usan dobles de API/GPU y **no acreditan persistencia real ni renderizado visual**. Una primera suite completa tuvo un timeout de 5 s durante cargas concurrentes; el archivo afectado pasó 9/9 aislado. La repetición completa sigue pendiente de cierre.

## Revisiones y correcciones

Reintentos de creación/alta conservan exactamente el cuerpo y la clave originales. Una dirección nueva participa en la misma transacción que el hogar. No se permite archivar una dirección principal vinculada a un hogar activo. Aires antiguos de tipo incompleto tienen explicación y acceso al historial; nunca se representan silenciosamente como Split. Balcón/terraza no pueden desactivarse si todavía existe ese ambiente.

La revisión de calidad identificó además condiciones de carrera entre clientes al colisionar UUID de plantas, límite de 500 ubicaciones omitido en alta y presupuesto HTTP insuficiente para una distribución válida grande. Deben comprobarse los parches y sus pruebas antes de integrar.

## Verificación todavía obligatoria

1. Aplicar y probar el conjunto de migraciones en una base aislada: SQL pgTAP con rollback, RLS/propiedad, upserts concurrentes, idempotencia, alias de dirección y límite de capacidad.
2. Regenerar `lib/supabase/database.types.ts` desde PostgreSQL real y comprobar coincidencia exacta mediante `scripts/verify-ci-schema.mjs`. Las declaraciones nuevas de RPC son provisionales; no equivalen a tipos generados.
3. Ejecutar integración y E2E contra el backend descartable de CI, sin datos de clientes ni credenciales de producción. Cero casos omitidos.
4. Verificar permisos de la conexión de producción y aplicar exclusivamente la nueva migración necesaria; ejecutar advisors y consultas enfocadas. No ejecutar fixtures generales contra producción.
5. Revisión visual 3D/gestos/responsive: el navegador integrado devuelve que el puente nativo no está disponible. No usar Chrome local como alternativa; no hay captura actual certificada.
6. Comprobar la rama remota, integrar sin force y verificar el SHA de main después de publicar.

## Bloqueos comprobados del entorno

- Proyecto Supabase vinculado: `dqonlqcurvjnjgsczevu`. MCP configurado pero herramientas no expuestas en esta sesión. CLI vinculado devuelve 403 de privilegios al iniciar el rol de consulta; advisors también. Solicitud al usuario: reconectar en Codex con cuenta propietaria, sin compartir secretos por chat.
- Docker Desktop no ofrece un motor operativo; WSL informa servicio deshabilitado. No se modificaron servicios ni características del sistema operativo. CI usa su propio contenedor Supabase descartable como alternativa.
- GitHub main previo ya fallaba en auditoría de dependencias, antes de Hogar. No se omiten ni relajan los controles para publicar.

## Recuperación

Antes de publicar, obtener evidencia de migración y snapshot del estado objetivo. No borrar ni reescribir direcciones/equipos/historial existentes. Archivar desde la interfaz es reversible a nivel de inventario histórico, pero la interfaz actual no incorpora restauración de hogares archivados. Si falla una migración, revisar el error y su estado antes de reintentar; no ejecutar DROP/TRUNCATE ni resets destructivos.
