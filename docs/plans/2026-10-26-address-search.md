# Address search implementation plan

**Goal:** encontrar coincidencias territoriales correctas y permitir guardar una dirección manual sin simular una ubicación verificada.

**Architecture:** GeoRef filtrado y búsqueda interpretada en servidor; componente compartido con alternativa manual. El servidor firma una entrada no verificada y conserva el requisito de coordenadas reales para el traslado y el precio final.

**Tech Stack:** Next15, React19, Zod4, GeoRef, OpenRouteService, Vitest, pruebas de interfaz con Testing Library y navegador de producción protegido.

## 1. Búsqueda territorial

Archivos: `lib/location/georef.ts`, helper de consulta si hace falta, `tests/unit/location-providers.vitest.test.ts` y regresiones nuevas.

1. Escribir y ejecutar regresiones que reproduzcan consulta nacional, pérdida de localidad con varias comas, nombres de calles coincidentes y coordenadas ausentes.
2. Corregir filtros antes del límite, búsquedas por provincia, parsing y orden de resultados.
3. Ejecutar las pruebas enfocadas y contrastar respuestas reales de direcciones públicas.

## 2. Entrada manual segura

Archivos: contratos, resolver, proof, caché y rutas resolve/renew en `lib/location/` y `app/api/location/`; pruebas unitarias de esas rutas y contratos.

1. Reproducir mediante tests la ausencia de alternativa para texto manual.
2. Agregar variante estricta manual con coordenadas null y prueba firmada vinculada al texto, provincia admitida y renovación sin promover su precisión.
3. Verificar rechazo de coordenadas del cliente, mezcla de contratos, manipulación, expiración y acceso sin sesión.
4. Acreditar que la entrada manual nunca entra en la caché de puntos verificados.

## 3. Interfaz y continuidad

Archivos: `components/location/full-address-combobox.tsx`, `argentine-address-fields.tsx`, estilos y pruebas compartidas; consumidor de pedido/ayuda sólo si hace falta.

1. Escribir tests de «Mi dirección no aparece», ingreso manual, guardado habilitado por comprobante firmado, fallos recuperables y conservación de cambios auxiliares.
2. Implementar con controles accesibles y estados claros; no formularios anidados ni botones de guardado implícitos.
3. Conservar texto/contexto, invalidar prueba al editar y evitar que respuestas atrasadas sustituyan la selección actual.
4. Revisar registro, clientes/viviendas, profesionales y cálculo, con salida explícita a ayuda cuando no hay traslado verificable.

## 4. Aceptación y publicación

1. Revisión independiente de seguridad, alcance y continuidad.
2. Ejecutar `pnpm typecheck`, `pnpm lint`, `pnpm test:domain`, `pnpm test:tooling` y Vitest completo; corregir fallos reales y repetir sólo lo necesario.
3. Confirmar versión pública vigente e integrar cambios concurrentes antes de preparar el despliegue.
4. Preparar producción sin asignar dominio, verificar build/health y búsqueda/entrada manual en navegador, promover y comprobar la versión exacta y recorrido publicado.
5. Guardar evidencia y límites en `docs/qa/`, publicar la rama propia y dejar el checkout limpio. No afirmar entrega de coordenadas exactas para una entrada manual ni crear un pago de prueba.
