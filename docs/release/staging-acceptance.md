# Aceptación de staging

Estado: **pendiente**. No existe un destino D04 designado. Completar sobre el mismo commit candidato; no pegar secretos.

## Identidad del entorno

| Campo | Valor requerido |
| --- | --- |
| Commit y deployment ID | pendiente |
| URL HTTPS y dominio | pendiente |
| Proveedor, proyecto, región y runtime Node 22 | pendiente |
| Supabase project ref no productivo | pendiente |
| Titular técnico y suplente | pendiente |
| Cuentas/IDs sintéticos de QA | pendiente |
| Fecha y ejecutor | pendiente |

El archivo de identidad protegido vive fuera del checkout, declara `environment: staging`, `production: false`, origen, project ref y al menos tres recursos sintéticos. `test:e2e:staging` rechaza localhost, producción, Mercado Pago live, otro proyecto o suites parciales.

## Configuración y migración

- [ ] HTTPS, DNS y origen exacto; allowlist de confirmación, recuperación y OAuth.
- [ ] `APP_ENV=staging`, `MERCADOPAGO_MODE=test`, proveedor split, marca visible del entorno y switches inicialmente apagados.
- [ ] Secretos propios de staging, gestor y custodios; ninguna credencial heredada de demo/producción.
- [ ] SMTP/remitente de prueba, Storage privado, scheduler, worker, logs, métricas y alertas.
- [ ] Backup pre-migración, historial esperado y todas las migraciones por el proceso automatizado.
- [ ] Esquema/tipos/roles coinciden con el candidato; DB lint, pgTAP y advisors sin error bloqueante.

## Ejecución

- [ ] `/api/health/live` y `/api/health/ready` desde el runtime real.
- [ ] Auth: registro controlado, confirmación, recuperación, MFA, revocación y suspensión.
- [ ] Storage: foto válida, hostil, lectura propia/ajena, expiración y limpieza.
- [ ] Worker: entrega a buzones designados, reintento, lease vencido y dead letter visible.
- [ ] Las 7 suites T34, 36 casos descubiertos y tres proyectos pasan sin omitidos.
- [ ] Perfil T35 smoke/pico/2×/ráfaga/60m/recuperación con métricas de app y DB.
- [ ] MP01–MP12 completados en `provider-acceptance.md` según capacidad real del sandbox.
- [ ] Restore aislado T32 dentro de RPO/RTO aprobados.

## Resultado

Registrar artefactos saneados, IDs sintéticos, límites encontrados, defectos y reejecución. La firma requiere titular técnico, QA, finanzas y titular de la aplicación de Mercado Pago. Un test local, una URL accesible o un checkout visual no equivalen a aceptación.
