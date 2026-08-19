# Bloqueos y decisiones pendientes

La base local puede seguir evolucionando, pero todavía no está habilitada para operar en producción. Estos son los bloqueos reales para conectar servicios externos y desplegar.

## 1. Publicación en GitHub

El push y la apertura de un PR se postergan por decisión de coordinación de este trabajo; no existe un error de permisos registrado como bloqueo actual.

Cuando se autorice la publicación, corresponde revisar el historial local, subir la rama elegida y abrir el PR. Este documento no presupone ese permiso.

## 2. Staging y conexión remota de Supabase

Task 4 quedó aprobada para desarrollo local: reset 001–007, 376 pgTAP, RLS, Storage, solicitudes de reembolso, eventos y lint de base están verdes.

Antes de aplicar estos artefactos a staging o producción todavía faltan:

- crear/configurar el entorno remoto y sus secrets por canales seguros;
- ejecutar migración dry-run, reset/diff y tests RLS contra staging;
- validar Auth, backups, restore, observabilidad y E2E;
- completar inspección de bytes y limpieza de archivos huérfanos de Task 8.

`pnpm audit --prod` no está limpio actualmente: reporta advisories transitivos en Sharp, PostCSS y UUID. No se conoce una superficie habilitada que procese imágenes o CSS no confiables ni buffers UUID, pero las dependencias deben actualizarse y el audit debe revalidarse antes de staging o producción.

## 3. Secrets e integraciones externas

Faltan credenciales y configuración suministradas por los responsables de cada entorno, entre ellas Supabase, Mercado Pago y proveedores opcionales de email, WhatsApp o IA.

Los valores reales deben cargarse por mecanismos seguros del entorno o de CI. No deben escribirse en `.env.example`, documentación, commits ni logs.

## 4. Mercado Pago

Antes de habilitar pagos reales faltan:

- credenciales sandbox o producción;
- una URL pública y segura para webhooks;
- validación de firma e idempotencia con el proveedor real;
- definición del modelo de cobro, split y liquidación;
- validación operativa y contable del onboarding profesional.

## 5. Decisiones legales y operativas

Requieren validación humana:

- términos, privacidad y texto legal de garantía;
- política de cancelación y devolución;
- relación contractual con profesionales;
- comisión y reglas de liquidación;
- procedimientos de soporte, reclamos y calidad.

## 6. E2E y despliegue

Playwright está configurado, pero no se ejecutó una suite E2E en navegador para esta evidencia. Tampoco hay un despliegue productivo validado.

Después de configurar entornos seguros, deben validarse los recorridos críticos E2E y los gates de release antes de cualquier salida a producción.
