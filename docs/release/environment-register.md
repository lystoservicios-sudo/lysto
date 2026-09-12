# Registro de ambientes y dependencias — T01

Estado: inventario local verificado; designación de staging y producción pendiente de D04. No se han consultado ni modificado despliegues remotos.

| Ambiente | Evidencia disponible | Estado / siguiente paso |
|---|---|---|
| Directorio original | Lysto en main, cambios preservados; Supabase local preexistente | No usar como destino de reset ni fixtures nuevos |
| Implementación aislada | Rama codex/production-readiness, worktree hermano; sin .env.local copiado | Builds/tests locales; DB propia en T03 |
| Demo Vercel | Archivo local .vercel/project.json identifica proyecto lysto-demo; .env.local incluye metadatos Vercel | Demuestra enlace local, no disponibilidad ni idoneidad productiva; verificar remoto cuando se designe |
| Staging | No hay designación inequívoca verificada | Confirmar proyecto, dominio, región, cuentas de prueba y responsables D04 |
| Producción | No hay designación inequívoca verificada | Configurar únicamente después de D04/D11 y gates |
| Mercado Pago | Integración usa aplicación marketplace, OAuth y ledger propios | Credenciales/aceptación no verificadas; no llamadas financieras reales |

No se presume que la demo sea producción ni se cambia de proveedor por archivos históricos. Se consultó al usuario por hosting/dominio/proyectos; respuesta pendiente al crear el registro. Node 22 y PostgreSQL/Prisma requieren runtime compatible; no desplegar los handlers Node en un runtime edge incompatible.

## Variables y custodios

Valores se administran en el gestor de secretos de cada ambiente; este registro sólo describe nombres. Custodio técnico titular y suplente: por designar antes de habilitar staging/producción.

| Variables | Uso | Restricción / validación |
|---|---|---|
| NEXT_PUBLIC_APP_URL | Origen público | HTTPS en remoto, sin subruta y acorde al entorno |
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Acceso público de cliente | Ambas del mismo proyecto; RLS obligatoria |
| SUPABASE_SERVICE_ROLE_KEY | Operaciones servidor privilegiadas | Nunca frontend, ownership validado igualmente |
| GOOGLE_MAPS_SERVER_API_KEY, LYSTO_ROUTING_ORIGIN | Rutas/precios | Clave restringida, cuotas; origen operativo D03 |
| PAYMENTS_PROVIDER, MERCADOPAGO_MODE | Proveedor/ambiente explícitos | Nada de fallback live; mock sólo pruebas |
| MERCADOPAGO_MARKETPLACE_CLIENT_ID, MERCADOPAGO_MARKETPLACE_CLIENT_SECRET | Aplicación OAuth | D11; secreto servidor, cuenta titular identificada |
| MERCADOPAGO_WEBHOOK_SECRET | Firma | Propio por ambiente; validar canónico |
| MERCADOPAGO_DATABASE_URL | Ledger y OAuth PostgreSQL | Mismo proyecto; rol acotado, pooling compatible |
| MERCADOPAGO_ENCRYPTION_KEY | Cifrado de OAuth | 32 bytes base64; custodiar y recuperar; no rotar sin recifrado |
| MERCADOPAGO_PUBLIC_KEY, MERCADOPAGO_ACCESS_TOKEN | Variables legacy/SDK | Revisar uso real antes de retirar; nunca publicar access token |
| NOTIFICATIONS_EMAIL_ENABLED, RESEND_API_KEY | Correo | Buzones de prueba primero; worker T24 y autorización de destinatarios |
| WHATSAPP_ENABLED, WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID | Canal opcional | Pendiente de alcance; sin envíos externos en esta etapa |
| AI_ENABLED, AI_PROVIDER, OPENAI_API_KEY | Función opcional | D12; límites y habilitación explícitos |
| APP_ENV, LYSTO_ACCEPT_NEW_REQUESTS, LYSTO_ALLOW_NEW_CHECKOUTS | Controles operativos T30 | Implementados; producción exige valores explícitos y proveedor split. Validar ambos interruptores en cada deploy. |
| RATE_LIMIT_HASH_KEY | HMAC de claves opacas para límites compartidos | 32–128 caracteres aleatorios, distinto por ambiente; nunca frontend |
| LYSTO_TEST_DATABASE_URL | Pruebas PostgreSQL locales | Exclusivamente DB descartable identificada; guard T04 |

En el .env.local original se detectó configuración pública de Supabase y metadatos de Vercel, incluyendo token de contexto. Ningún valor fue copiado al snapshot, logs versionados o este registro. No afirmar presencia de secretos de Mercado Pago por existir nombres en .env.example.

## Direcciones de integración que deben concretarse

- Auth: origen permitido y redirecciones de confirmación/recuperación que se implementen en T07.
- OAuth: `https://<dominio-del-entorno>/api/mercadopago/oauth/callback`.
- Webhook: `https://<dominio-del-entorno>/api/mercadopago/webhook`.
- Worker/scheduler: ruta interna autenticada de T24 con identidad separada; nunca cron público sin secreto/permiso.
- Observabilidad: servicio, proyecto, canal de alertas y responsables D10.
- DNS/SMTP: propietarios, verificación del dominio y remitente de prueba; procedimiento revisable antes de enviar.

## Recuperación pendiente de designación

El verificador y los runbooks T32 están implementados. D04 debe designar un proyecto aislado de restore y D09 debe aprobar RPO/RTO, titulares, suplentes, retención real del plan y ubicación de copias independientes de Storage. Ningún entorno existente se presume apto para el ensayo.

Los marcadores de dominio no son URLs configuradas. Antes de cualquier migración remota, registrar project ref, historial, backup, responsable y autorización aplicable.
