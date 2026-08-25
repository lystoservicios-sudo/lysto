# Auditoría UI Cliente — Tanda 4

**Fecha:** 2026-08-25

**Alcance:** CUS-08, CUS-09 y CUS-10

**Estado:** checkpoint listo para revisión

## Rutas implementadas

| ID | Ruta | Resultado |
|---|---|---|
| CUS-08 | `/app/equipos` | Inventario del hogar con métricas, estado, ambiente, historial acumulado, próxima fecha y fallback accesible sin imagen. |
| CUS-09 | `/app/equipos/[id]` | Resolución real del parámetro, not-found, ficha técnica, ubicación, historial, garantía y próxima recomendación. |
| CUS-10 | `/app/mantenimientos` | Educación preventiva primero y recordatorios accionables por equipo después, con estados vencido, planificado y sin recomendación. |

Las tres rutas permanecen dentro del área de contenido de `AppShell`. El sidebar es la única navegación de rutas: la barra superior sólo conserva el contexto de cuenta y el control para abrir o contraer ese sidebar.

## Decisiones de producto

- El inventario representa equipos del hogar, no un catálogo de productos.
- La ficha de detalle funciona como “ficha de vida”: identidad técnica, historial y próximo cuidado se leen como una única continuidad.
- Las métricas distinguen equipos, servicios confirmados, mantenimientos vencidos y fichas sin historial.
- La ausencia de imagen, modelo, capacidad, serie, historial, garantía o recomendación se declara sin inventar datos.
- Las garantías se vinculan por ID estable del equipo y adaptan color, icono y vigencia a su estado real.
- Las recomendaciones explican su origen y aclaran que no constituyen una cita automática.
- Los recordatorios priorizan primero lo vencido, luego lo planificado y por último los equipos sin recomendación.
- “Solicitar mantenimiento” permanece deshabilitado hasta que exista una acción conectada y muestra el motivo visible.
- No se crean turnos, comprobantes, coberturas, pagos ni servicios técnicos falsos.

## Accesibilidad

- Fallback de imagen con nombre accesible específico por equipo.
- Métricas expresadas como lista de términos y definiciones.
- Historial técnico como lista cronológica semántica.
- Fechas expuestas con elemento `time` cuando existe una fecha real.
- Estados loading, empty, error y not-found con mensajes y próximos pasos seguros.
- Botones no conectados usan el estado nativo `disabled` y tienen explicación visible.
- Una futura coordinación conectada anuncia estados pendiente, exitoso y fallido mediante regiones vivas.
- El drawer móvil abre como diálogo, conserva foco inicial y expone una acción de cierre.

## Verificación visual

Se probaron `/app/equipos`, `/app/equipos/eq_demo_living` y `/app/mantenimientos` en 320, 375, 768, 1024 y 1440 px: 15 combinaciones. En todas, el ancho visible y el ancho desplazable coinciden; no existe desborde horizontal.

También se verificó en navegador real:

- inventario con equipo completo, equipo sin historial y equipo con datos incompletos;
- detalle completo con ficha técnica, dos servicios, garantía y recomendación;
- detalle incompleto sin modelo, capacidad, serie, historial ni garantía;
- mantenimiento vencido, planificado y sin recomendación;
- CTA de mantenimiento realmente deshabilitado;
- sidebar de escritorio y drawer móvil como única navegación de rutas;
- ID desconocido con estado específico para equipo no encontrado.

La consola de la aplicación no mostró errores de React. El entorno de desarrollo sólo solicitó un `favicon.ico` inexistente; queda fuera del alcance funcional de esta tanda.

## Datos y límites

- Las vistas consumen `customerDemoFixtures`, identificadas explícitamente como demostración.
- Ninguna ruta importa `@/lib/mock/lysto-data`.
- El ID dinámico se resuelve contra las fichas disponibles y usa `notFound()` cuando no existe.
- Historiales y garantías se muestran únicamente cuando hay registros explícitos.
- No se mutan equipos, recordatorios ni solicitudes localmente como fuente de verdad.
- Los movimientos de pago permanecen vacíos.

## Pendiente de integración

1. Consulta autenticada del inventario y detalle técnico por cliente.
2. Imágenes persistidas con política de privacidad y fallback definitivo.
3. Historial proveniente de partes técnicos cerrados y comprobantes autorizados.
4. Coberturas de garantía confirmadas por backend.
5. Motor de recomendaciones con fecha de referencia del servidor.
6. Acción idempotente para solicitar o coordinar mantenimiento.
7. Estados de carga, vacío y error conectados a la capa de datos real.
