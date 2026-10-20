# Pagos administrativos y verificación del servicio

Diseño aprobado por el propietario el 20/10/2026: ampliar el panel actual de Pagos. Los cobros sin comisión significan comisión Lysto cero; no eliminan la tarifa de Mercado Pago.

## Alcance

- Probar pagos pendientes, rechazados, adicionales, reintentos, reembolsos y cancelaciones sin nuevas operaciones monetarias reales.
- Terminar el servicio ficticio E2E ya pagado, desde diagnóstico hasta conformidad.
- Reunir pagos, solicitudes de cobro, reintegros y cancelaciones en el módulo administrativo existente.
- Cada acción presenta servicio, importe, destinatario y motivo. Reembolsos y cancelaciones requieren una confirmación concreta; los enlaces o propuestas no debitan automáticamente al cliente.
- No usar Docker. Diferenciar expresamente pruebas de código/proveedor simulado de validación integral con proveedor y base reales.

## Alternativas consideradas

1. Ampliar Pagos y reutilizar los circuitos de adicionales, checkout, conciliación y reintegros: elegido. Conserva la aceptación del cliente y la autoridad del proveedor.
2. Un panel independiente: duplicaría navegación y controles financieros.
3. Cobros directos fuera de servicios: excluido del alcance aprobado; dificulta identificar cliente, técnico y autorización.

## Diseño

Las solicitudes administrativas son cobros adicionales explícitos ligados a un servicio y su profesional. Reutilizan la aceptación del cliente y el checkout idempotente. Se identifica su origen administrativo y se congela la comisión habitual o cero al crearlas. Los adicionales propuestos por técnicos conservan comisión Lysto cero.

Los importes y beneficiarios de checkouts ya creados permanecen inmutables. No se reescribe ningún presupuesto o pago existente. La creación exige administración con permiso de finanzas y MFA; el cliente sólo puede decidir o pagar solicitudes propias. Cancelar una propuesta aún no aceptada no equivale a cancelar un pago.

El administrador selecciona un servicio legible, sin introducir su versión interna. Para cancelar un servicio se reutiliza el mecanismo de excepciones: si hubo enlace o pago, conciliar y devolver antes de resolver. Los reintegros conservan reserva de saldo, clave idempotente y verificación del proveedor.

Se mostrarán las comisiones reales y el neto informado por Mercado Pago, separando bruto, comisión Lysto y costos del proveedor.

## Verificación

- Pruebas negativas de autorización, importes y destinatarios; duplicados y respuestas inciertas.
- Pruebas de comisión estándar/cero y preservación de los adicionales técnicos.
- Pruebas de interfaz para revisar y confirmar acciones, claves estables ante reintentos y errores sin falso éxito.
- Migraciones durables y revisión de políticas/permisos. Verificación transaccional cuando sea posible, sin ejecutar devoluciones ni cargos reales.
- TypeScript, lint, compilación y pruebas focalizadas antes de publicar.
- Verificación por las tres cuentas del servicio simulado y conservación del único pago real de ARS 100.
