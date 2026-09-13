# Auditoría remota de Vercel — 2026-09-12

Estado: **Preview convertido en staging técnico aislado; aceptación externa pendiente**.

## Resultado

- La sesión autenticada de Vercel pertenece a `waltergaltieri` y expone el proyecto `lysto-demo` (`prj_nggGpeRYxmcrXDni6Xt98OWwVJg7`).
- El proyecto usa Next.js y mantiene despliegues Preview y Production listos; el último despliegue productivo observado fue creado el 25 de agosto de 2026 y publica `https://lysto-demo.vercel.app`.
- El candidato se compiló con Node 22.23.2 y publicó 81 rutas en Preview.
- Preview usa variables propias de staging, controles de admisión explícitos, proveedor de pagos simulado y protección de despliegue. El secreto de automatización está fuera del repositorio y fue rotado durante la preparación.
- La configuración Preview apunta al Supabase aislado `obksyzasmfwcbbksesqt` (`lysto-staging`, `us-east-1`, `production:false`). Producción conserva `dqonlqcurvjnjgsczevu` y su alias no fue modificado.
- El alias estable es `https://lysto-staging-preview.vercel.app`; el candidato runtime `ff9925959eab64dd40362e4aaff7bc6114a4ad6b` corresponde al deployment `dpl_BkgTPU5Nurei2dp8Q7DTMPvQEURN`.
- `/api/health/live` y `/api/health/ready` respondieron 200. La aceptación funcional pasó 36/36 casos, sin omitidos, en Chromium desktop/mobile y WebKit mobile.

## Decisión técnica

El aislamiento técnico requerido para T34/T35 ya existe y fue utilizado. T35 aprobó carga sostenida, doble pico, ráfaga y recuperación. T32 sigue pendiente porque el plan Free no entrega un backup recuperable, y T36 conserva gates por Mercado Pago, correo, scheduler, alertas y aceptación de responsables. D04 aún necesita aprobación nominal de titular y suplente; la identidad técnica está registrada fuera del checkout.

Ningún secreto fue registrado. La configuración de Production y el alias `https://lysto-demo.vercel.app` no se cambiaron; todas las mutaciones se limitaron a Preview y al proyecto Supabase de staging.
