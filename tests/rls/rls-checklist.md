# Checklist RLS Supabase

Objetivo: ejecutar con usuarios reales de prueba antes del deploy comercial.

- [ ] Todas las tablas públicas sensibles tienen RLS habilitado.
- [ ] `anon` no puede leer tablas privadas.
- [ ] Cliente solo lee/modifica su perfil, direcciones, solicitudes, equipos, trabajos, pagos y reviews.
- [ ] Profesional solo lee sus trabajos asignados, su perfil, sus documentos y sus liquidaciones.
- [ ] Profesional no puede aprobarse a sí mismo.
- [ ] Cliente no puede modificar estados de pago ni asignaciones.
- [ ] Admin puede operar recursos críticos y cada acción crea audit log.
- [ ] Buckets son privados.
- [ ] Signed URLs no se generan para usuarios no autorizados.
- [ ] Service role key no se usa en cliente.
