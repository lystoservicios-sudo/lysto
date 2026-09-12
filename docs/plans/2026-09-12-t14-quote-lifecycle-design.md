# T14 — Presupuestos versionados y aceptación

Continuación de la hoja de ruta aprobada. T11 está terminando su aceptación local; este diseño prepara la siguiente etapa sin cambiar todavía el circuito de presupuestos.

## Evidencia inicial

`/api/pricing/quote` calcula en servidor, pero guarda con un cliente service-role mediante INSERT directo, sin registrar una revisión vinculada ni volver a comprobar la autoridad de la sesión al persistir. El operador puede suministrar una ruta manual con un campo de procedencia editable. `/api/pricing/quotes` devuelve hasta 50 filas, y su PATCH llama al revisor existente sin control de versión. El envío del cliente llama a `submit_service_quote`; se deben revisar sus locks, snapshots, idempotencia y validaciones temporales frente a tarifas y revisiones nuevas.

La política actual proviene de `platform_settings`; el cálculo por defecto conserva una referencia CAIM de junio/julio de 2026 con `approvedUntil=null`. Esa referencia no acredita una tarifa aprobada para hoy. La aceptación comercial real de D01/D02/D03 queda pendiente: no se elegirán importes ni márgenes nuevos para simular esa aprobación.

## Implementación prevista

1. Agregar integración que demuestre las carencias: tarifa no aprobada/vencida, ruta ausente o simulada, peajes/materiales pendientes, fecha pasada al aceptar, total/actor/cliente falsificados, revisión concurrente y reintento de aceptación tras perder una respuesta.
2. Centralizar DTOs estrictos, validación de origen y límites de cuerpo. Conservar permisos distintos: operaciones/owner calcula y revisa; finanzas/owner configura/aprueba política. Una ruta manual debe declarar su autor, fundamento y procedencia manual; no puede hacerse pasar por Google.
3. Versionar la política económica y su procedencia, vigencia y auditoría. La autoridad que permite ofrecer precios no debe depender de una escritura genérica a settings. La ausencia de aprobación conserva el cálculo como preliminar y bloquea la oferta/aceptación.
4. Sustituir el INSERT directo por una escritura controlada que reciba sólo el cálculo del servidor, compruebe sesión/usuario/permiso vigentes en base y conserve política, insumos y fuentes. El cliente autenticado no podrá invocar un writer privilegiado ni aportar su propio total. Revisar las guardas T10 para reutilizar la comprobación de sesión del servicio en vez de inventar autoridad desde IDs.
5. Cada revisión tendrá presupuesto anterior, raíz, versión, cliente inmutable, actor y motivo. Una revisión nueva invalida la aceptación de la anterior; las revisiones compiten bajo locks/versiones y preservan historial. Mostrar siempre a qué presupuesto reemplaza.
6. Al aceptar, bloquear la fila, comprobar propietario, versión vigente, cobertura/insumos completos, vigencias y fecha de visita; persistir snapshots y vínculos una sola vez. Un segundo intento debe devolver el mismo resultado, y el frontend debe consultar el estado después de una respuesta incierta.
7. Auditar y probar redondeo monetario con importes decimales, cantidades y límites. Mantener la misma representación en cálculo, JSON y NUMERIC de base; no incorporar nuevos precios de proveedor por inferencia.

## Cierre

Conservar 40 tareas. Aplicar migraciones nuevas con timestamp de CLI y protocolo T03 contra el checkpoint T11, con datos existentes. Ejecutar contratos de precio, autorización, integración HTTP/PostgreSQL, tipos, lint y build aislado. La evidencia comercial real se documenta en `docs/release/pricing-acceptance.md` y no se reemplaza por fixtures locales. T24 continúa después según el orden aprobado.
