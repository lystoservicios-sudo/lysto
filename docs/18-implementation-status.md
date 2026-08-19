# Lysto — estado de implementación local

Este documento separa lo que ya quedó creado en el paquete local de lo que queda bloqueado por credenciales o ejecución en el entorno real.

## Implementado en código local

### Producto / pantallas

- Landing pública.
- Página de servicio de aire acondicionado.
- Login y registro visual.
- Shells por rol: cliente, profesional y admin.
- Navegación responsive por rol.
- Wizard mobile-first de solicitud con 10 pasos:
  1. Problema.
  2. Detalles y media opcional.
  3. Diagnóstico preliminar.
  4. Dirección y acceso.
  5. Horario.
  6. Precio Flexible/Prioridad.
  7. Pago protegido.
  8. Matching.
  9. Técnico confirmado.
  10. Seguimiento.
- Panel cliente con métricas, trabajo activo y equipos.
- Solicitudes cliente, detalle, trabajos, detalle, equipos, direcciones, perfil y pagos.
- Portal profesional con dashboard, onboarding, solicitudes, trabajos, agenda, equipo, pagos, perfil y Mercado Pago.
- Panel admin con dashboard, solicitudes, detalle, trabajos, detalle, profesionales, invitaciones, clientes, equipos, pagos, precios, servicios, diagnóstico, calidad, configuración y auditoría.

### Dominio / funciones

- Motor de diagnóstico preliminar.
- Motor de precios.
- Split marketplace estimado.
- Normalización de estados Mercado Pago.
- Idempotencia de webhook por provider event id.
- Matching/scoring de profesionales.
- Máquina de estados de solicitud, trabajo, profesional y pago.
- Validación de solicitud antes de pago.
- Validación de cierre técnico.
- Reglas de garantía.
- Review y recalculo de score.
- Validación de checklist de herramientas.
- Cola operativa admin.
- Comprobante público con ocultamiento de datos sensibles.
- Validación de uploads.
- Invitaciones profesionales.
- Eventos de auditoría.

### Supabase

- Migración inicial amplia con tablas del MVP operativo.
- Segunda migración con funciones operativas, notificaciones, recibos, vista pública segura, triggers de eventos de estado y políticas adicionales.
- Seed inicial de aire acondicionado.
- Buckets privados planteados para media de solicitud, documentos profesionales y media de trabajos.
- RLS base y políticas conservadoras.

### Tests

- Runner de tests de dominio sin dependencias externas.
- 50 tests de dominio pasando.
- Casos cubiertos: diagnóstico, precios, estados, matching, pagos, permisos, reviews, cierre técnico, validación de request, ciclo de vida, cola admin, herramientas y comprobante público.

## No ejecutado por bloqueo de entorno

- `pnpm install`: no se pudo descargar pnpm/dependencias desde registry en este entorno.
- `next build`, `vitest`, `playwright`: requieren instalar dependencias.
- Aplicación real de migraciones en Supabase: requiere sesión MCP/CLI autenticada en tu máquina o secrets.
- Pago real Mercado Pago: requiere credenciales reales/sandbox.
- Push directo a GitHub: la integración disponible respondió 403.

## Intervención humana necesaria al final

1. Subir el paquete al repo o dar permisos correctos a la integración GitHub.
2. Ejecutar instalación de dependencias localmente.
3. Configurar `.env.local` con Supabase y Mercado Pago.
4. Aplicar migraciones a Supabase.
5. Cargar secrets en GitHub Actions/Vercel.
6. Probar pagos con Mercado Pago sandbox.
7. Revisar legal/comercial de garantía, split y vínculo con profesionales.
