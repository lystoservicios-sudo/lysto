# Criterios para declarar Lysto 100% terminado

Lysto solo se considera terminado cuando cumple todos estos puntos.

## 1. Producto

- Cliente puede solicitar servicio de aire acondicionado de punta a punta.
- Profesional puede completar onboarding, ser aprobado y operar trabajos.
- Admin puede operar solicitudes, profesionales, trabajos, precios, pagos, reclamos y calidad.
- Cliente recibe comprobante y puede dejar review.
- Queda historial de equipo y mantenimiento recomendado.

## 2. Persistencia

- Todas las pantallas críticas leen/escriben Supabase real.
- Todas las mutaciones críticas pasan por server actions o route handlers seguros.
- No hay datos críticos solo mockeados.
- Storage privado funciona para fotos, videos y documentos.

## 3. Seguridad

- Todas las tablas sensibles tienen RLS activa.
- Cliente no puede leer datos de otro cliente.
- Profesional no puede leer trabajos no asignados.
- Profesional no puede aprobarse ni modificar precios.
- Admin actions críticas generan audit log.
- QR/comprobante público no expone datos sensibles.
- No hay secrets en repo.

## 4. Pagos

- Mercado Pago sandbox funcionando.
- Preferencias se crean con datos reales.
- Webhooks actualizan pagos de forma idempotente.
- Reintentos/duplicados no duplican trabajos.
- Split/OAuth o liquidación interna queda definido y probado.
- Reembolsos/disputas básicos quedan operables desde admin.

## 5. QA

- `pnpm lint` pasa.
- `pnpm typecheck` pasa.
- `pnpm test` pasa.
- `pnpm test:e2e` pasa.
- `pnpm build` pasa.
- Los flujos E2E críticos están cubiertos.
- Mobile y desktop revisados.

## 6. Deploy

- GitHub tiene rama y PR.
- CI corre en GitHub Actions.
- Variables configuradas en hosting.
- Supabase migrado.
- Dominio/URL de staging listo.
- Checklist de release aprobado.
