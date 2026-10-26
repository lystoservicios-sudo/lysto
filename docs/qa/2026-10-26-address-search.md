# Buscador de direcciones — 26/10/2026

> **Reemplazado el 26/10/2026:** el titular retiró el ingreso manual y pidió Provincia obligatoria antes de Dirección. Consultar el [plan vigente](../plans/2026-10-26-province-first-address.md) y el [resultado publicado](2026-10-26-province-first-address.md). Lo siguiente conserva el historial de la implementación anterior.


Estado: **publicado y comprobado en el dominio público**.

## Cambio

La búsqueda filtra CABA y Buenos Aires antes del límite del proveedor, interpreta localidad/provincia/Argentina y conserva el contexto al editar. Una consulta territorial fallida no descarta las coincidencias válidas de otra. No se inventan alturas, identificadores ni coordenadas.

«Mi dirección no aparece» permite confirmar calle, altura (incluye S/N o km), localidad y provincia. El servidor firma una entrada manual con precisión unverified y coordenadas null; admite guardarla en perfil, domicilio, hogar y domicilio profesional. Editar, cancelar o recibir una nueva versión invalida respuestas atrasadas. La renovación mantiene la condición manual y no escribe la caché de puntos verificados.

Cuando no se puede comprobar el traslado, el precio no habilita cobro y ofrece Ayuda conservando el borrador. El texto aclara que todavía no se envió el pedido ni se creó un caso de soporte.

## Candidato

- Commit runtime: `8cb1de60b434f9bc9e503d2af7e9c0c14b6ca742`.
- Deployment preparado sin dominio: `dpl_BJpcaH7e3ivTTirBxeJNFmkDiFPs`, READY.
- Live devuelve el commit exacto; ready devuelve production/ready sin avisos.
- No hay cambios de dependencias, esquema, políticas, datos productivos ni secretos. Se conservan la asignación directa, la aprobación documental y los correos automáticos publicados previamente.

## Evidencia previa a publicar

| Comprobación | Resultado |
| --- | --- |
| Tipos y lint | Ambos exit 0. |
| Dominio | 174/174, exit 0. |
| Herramientas | 165/165, exit 0. |
| Suite unitaria completa | **2.435/2.435 pruebas, 270/270 archivos**, cero fallos y pendientes; exit 0. Informe JSON local `output/address-release-final-unit.json`. |
| Revisión independiente | Sin P1/P2 pendientes tras corregir la respuesta manual tardía en onboarding profesional. |
| GeoRef público | Corrientes 1234 encuentra San Nicolás/CABA con punto primero; variantes con CABA y Argentina coherentes. Balcarce 50 y Cerrito 628 correctas. Fuera del área o sin altura no fabrica resultados. Evidencia local `output/address-search-live-green.json`. |

Las regresiones incluyen validación estricta de firma/texto/expiración/renovación, coordenadas e identificadores enviados por el cliente rechazados, caché contaminada rechazada, ingreso manual y envío real de los contratos en componentes de cliente/hogar/profesional, cancelación y actualización concurrente, y traslado no verificable sin pago. Las pruebas usan transporte controlado; no constituyen escrituras reales de direcciones en producción.

## Publicación y navegador

Se promovió `dpl_BJpcaH7e3ivTTirBxeJNFmkDiFPs` después de cerrar todas las comprobaciones. Inmediatamente antes de promover, `lystohogar.com` seguía apuntando a `dpl_Fhmdge6SozEjBijBvPaSByU2Zwbv`; no hubo otra publicación que integrar. Después de promover, el alias apunta al candidato, `/api/health/live` devuelve HTTP 200 y el commit exacto `8cb1de60b434f9bc9e503d2af7e9c0c14b6ca742`; `/api/health/ready` devuelve HTTP 200, ready/production, sin avisos y con solicitudes/checkouts habilitados.

La sesión disponible en el navegador es de administrador. Las rutas cliente devolvieron 404 al entrar con ese rol; el acceso a administración funciona. Se comprobó el componente compartido en `/admin/precios`, sin guardar presupuestos ni cambiar clientes:

1. `Corrientes 1234` presenta primero AV CORRIENTES 1234, San Nicolás/CABA. Elegirla confirma el domicilio desde el servidor.
2. `Corrientes 1234, CABA, Argentina` mantiene cinco resultados de CABA y la coincidencia con punto primero.
3. Una calle sintética inexistente devuelve «No encontramos coincidencias» y conserva «Mi dirección no aparece».
4. La alternativa manual conserva el contexto, permite cambiar calle y altura a Balcarce / S/N y confirma `Balcarce S/N, CABA, CABA` desde el servidor. Muestra «Dirección ingresada manualmente. Verificaremos la ubicación antes de calcular el traslado». La dirección no vuelve a consultarse como si se hubiera editado.

La interfaz de cliente/profesional no se volvió a recorrer con una sesión de esos roles en esta comprobación publicada. Sus componentes reales sí tienen regresiones positivas de confirmación y guardado mediante transporte controlado, incluidas versión de registro, firma y cambios auxiliares. No se reescribieron domicilios de personas ni se agregaron filas productivas para probar.

Evidencia local ignorada: `output/address-production-health.json`, `output/address-search-browser-evidence.json` y captura `output/address-search-published.png`. Escaneo posterior del deployment, nivel error, últimos 15 minutos y límite 100: cero entradas, exit 0 (`output/address-production-error-logs.*`). Es una ventana acotada, no un monitor continuo.

## Límites

La cobertura y disponibilidad del proveedor siguen siendo externas. Una entrada manual permite guardar el domicilio, pero no acredita su ubicación ni habilita un traslado con coordenadas inventadas. No se completó un pago, un pedido ni un caso de soporte nuevo en producción. Los límites generales de apertura y recuperación siguen en el [informe de lanzamiento](2026-10-25-launch-readiness.md).
