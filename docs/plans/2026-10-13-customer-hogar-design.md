# Hogar del cliente — diseño aprobado

Fecha: 2026-10-13. El cliente aprobó la estética de `prototypes/hogar-3d` y la integración completa. Solo aires acondicionados; cámara, escaneo y RA quedan fuera de esta entrega.

## Pantallas y estados

- `/app/hogar`: selector de varios lugares, dirección, planta activa, maqueta 3D, ambientes, equipos ubicados/sin ubicar y acceso al historial real de cada equipo.
- Crear/configurar hogar: nombre, dirección existente o nueva, casa/departamento/PH/oficina/local, edificio bajo/alto para departamentos, balcón/terraza/ventanas pequeñas, grandes o mixtas. Los indicadores visuales son distintos de las condiciones técnicas de acceso.
- Plantas: crear, renombrar, ordenar, quitar con confirmación; solo se dibuja la planta activa. El piso postal de la dirección no es una planta interna.
- Ambientes: añadir, editar nombre/tipo/variante/ventanas/tamaño orientativo/posición; elegir plantillas compatibles sin borrar la distribución actual. Dormitorios, living, comedor, cocina, baño, oficina, reuniones, recepción, lavadero, pasillo, depósito, garage, patio, balcón, terraza y espacio comercial con variantes.
- Detalle de ambiente: vista aislada con sus equipos; volver conserva la planta activa.
- Registrar/ubicar aire: ficha del catálogo actual, pared y posición/altura. Controles accesibles equivalentes al gesto 3D, Guardar/Cancelar. Registrar y ubicar en una transacción/idempotencia evita registros duplicados.
- Quitar ubicación: no archiva el equipo. Quitar ambiente/planta deja equipos sin ubicar. Archivar hogar no borra equipos ni servicios.
- Carga, vacío, error, conflicto y lista alternativa cuando WebGL falla.

La navegación inferior existente permanece en las vistas principales y se oculta con `useClientFocusedFlow` durante edición/registro/colocación. No se duplican shell ni rutas principales.

## Datos y seguridad

Identidad de hogar estable, independiente de las revisiones de dirección. Asociación explícita de direcciones antiguas/nuevas; jamás inferir por texto. Equipos reales existentes; ubicación 3D separada de `customer_equipment.address_id` para conservar historia y claves de servicios. Propietario derivado de la sesión, RLS y RPC transaccionales con versión esperada. No acceso a toda la vivienda para técnicos. Sin datos ficticios en cuentas reales.

## Visual y límites

Se conserva la maqueta semi-realista de geometría 3D, pisos de madera, paredes claras, muebles detallados y azul Lysto para selección. Diseño mobile-first, botones táctiles, controles por teclado, movimiento reducido y render bajo demanda. Modelo editable orientativo, no plano técnico ni medición certificada. El mobiliario no representa nuevos servicios o equipos disponibles.

## Entrega

Pruebas de contratos/dominio, UI, escena/geometría, API y base de datos: aislamiento entre clientes, revisión de dirección, concurrencia, reintentos, cambios de planta, variantes, colocación, cancelación, borrado no destructivo, fallback y regresiones. Revisar antes de integrar a `main`; no forzar Git ni reemplazar cambios del usuario.
