# Aceptación de staging

Estado: **aceptación técnica automatizada aprobada; proveedores y firmas pendientes**. No pegar secretos.

## Identidad del entorno

| Campo | Valor requerido |
| --- | --- |
| Commit y deployment ID | runtime `7a999289bce42adb6905ef89a880fa4108bee85c`; `dpl_HFUS6175CLWP1fiwhRgjfvvMXxJ7` |
| URL HTTPS y dominio | `https://lysto-staging-preview.vercel.app` |
| Proveedor, proyecto, región y runtime Node 22 | Vercel `lysto-demo` Preview; Supabase `lysto-staging`, `us-east-1`; Node 22.23.2 |
| Supabase project ref no productivo | `obksyzasmfwcbbksesqt`, identidad protegida `production:false` |
| Titular técnico y suplente | pendiente de aprobación D04 |
| Cuentas/IDs sintéticos de QA | creados por ejecución y eliminados por ID exacto; cero remanentes |
| Fecha y ejecutor | 2026-09-12/13; agente técnico autorizado |

El archivo de identidad protegido vive fuera del checkout, declara `environment: staging`, `production: false`, origen, project ref y al menos tres recursos sintéticos. `test:e2e:staging` rechaza localhost, producción, Mercado Pago live, otro proyecto o suites parciales.

## Configuración y migración

- [x] HTTPS, alias estable y origen exacto; allowlist Auth de staging.
- [x] `APP_ENV=staging`, `MERCADOPAGO_MODE=test`, proveedor mock y switches explícitos.
- [x] Secretos propios de staging fuera del repositorio; ninguna credencial productiva en Preview.
- [x] Scheduler Supabase Cron cada minuto y worker autenticado de cinco mensajes; las últimas cinco llamadas devolvieron HTTP 200.
- [x] Remitente de prueba Resend, clave de envío cifrada y buzón designado; EM01 y EM02 fueron aceptados por el proveedor.
- [ ] Confirmación visual de recepción en Gmail, dominio remitente propio, Storage privado, métricas y alertas.
- [ ] Backup pre-migración y restore medido; no disponible en el plan Free actual.
- [x] Historial de 63 migraciones, esquema/tipos/roles y controles SQL verificados; la migración de visita/reseña aprobó 17/17 aserciones pgTAP con rollback.

## Ejecución

- [x] `/api/health/live` y `/api/health/ready` desde el runtime real.
- [x] Auth automatizado: sesiones separadas por rol, MFA, revocación y suspensión; alta/recuperación humana completa siguen en UAT físico.
- [ ] Storage: foto válida, hostil, lectura propia/ajena, expiración y limpieza.
- [x] Worker: Resend aceptó las plantillas reales de confirmación de visita y solicitud de reseña para el buzón autorizado; falta confirmar la bandeja.
- [x] Las 7 suites T34, 39 casos y tres proyectos pasan sin omitidos.
- [x] Perfil T35 smoke/pico/2×/ráfaga/60m/recuperación con métricas de app y DB; D01/D10 aún requieren firma.
- [ ] MP01–MP12 completados en `provider-acceptance.md` según capacidad real del sandbox.
- [ ] Restore aislado T32 dentro de RPO/RTO aprobados.

## Resultado

El commit `7a999289` pasó ambos jobs de CI y 39/39 E2E remotos en Chromium escritorio, Chromium móvil y WebKit móvil, con cero omitidos y cero identidades sintéticas remanentes. El scheduler continúa activo, la cola está vacía y Resend aceptó ambos correos autorizados. Falta confirmar su llegada a Gmail y verificar un dominio propio antes de producción. La firma requiere titular técnico, QA, finanzas y titular de la aplicación de Mercado Pago. Un test local o la aceptación del proveedor no equivalen a la aprobación final de producción.
