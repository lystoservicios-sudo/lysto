# T07 — Ciclo de cuenta cliente

Estado: implementación local comprobada con Auth y buzón reales del entorno descartable. La aceptación de entrega SMTP externa y documentación legal definitiva sigue pendiente; este documento no habilita altas de producción.

## Política de registro

La migración `20260911051612_customer_account_bootstrap.sql` crea un catálogo legal privado sin documentos ni habilitación de registro. La publicación de términos y privacidad, sus versiones, contenidos y autorización corresponde a D08. Una versión de ensayo identificada `test-only-*` no equivale a aprobación legal y sólo se utiliza en la base descartable.

El servidor obtiene la política activa, muestra sus enlaces y versiones y exige aceptación explícita. La base conserva la aceptación original con fecha y hashes de los documentos. Los cambios posteriores del usuario en metadata no alteran esa evidencia ni su rol.

## Alta y reparación

El alta pública asigna exclusivamente `customer`. Los roles asignados por aprovisionamiento administrativo quedan fuera del alta pública. La operación de bootstrap toma únicamente `auth.uid()`, exige cuenta confirmada y rol confiable customer, y crea ambos perfiles dentro de una transacción idempotente. Un reintento mantiene la cuenta Auth y los identificadores ya existentes. Una cuenta antigua sin aceptación válida debe completar sus datos, sin registrarse de nuevo.

Los fixtures T04 usan roles explícitos mediante Admin API y crean sus perfiles directamente. No dependen del alta pública ni de habilitar documentación legal.

La corrección `20260911224417_administrative_auth_provisioning_order.sql` contempla que Auth puede insertar primero la identidad y aplicar después la metadata administrativa confiable. Un alta sin campos de aceptación queda incompleta y sin perfiles; nunca obtiene permisos por un marcador enviado por el usuario. Cualquier aceptación parcial se valida contra el catálogo activo. Este orden se comprobó con los ocho actores reales de T04, además de la prueba SQL.

El límite de reenvío de correo para una cuenta sin confirmar conserva el mismo mensaje genérico que un alta nueva. La compatibilidad de tipos entre el adaptador SSR instalado y el cliente se concentra en la fábrica del cliente servidor, conservando el contrato generado de la base.

## Correos y sesiones

Las plantillas de confirmación y recuperación apuntan a páginas propias. Leer el enlace mediante GET no verifica el token: el usuario debe realizar una acción POST. Los tokens tienen un tipo fijado por el flujo; los destinos se limitan al origen de aplicación configurado. Se rechazan mutaciones con origen ausente o distinto.

Logout sólo permite POST y elimina la sesión/cookies a través de Supabase Auth. T08 añade la verificación estricta de revocación de access tokens en operaciones sensibles.

## Validación requerida

- Pruebas unitarias de validación, política legal, mensajes genéricos y origen.
- pgTAP de asignación de rol, consentimiento inmutable, idempotencia y reparación, grants y denegación admin/pro.
- Integración con Auth real y buzón local: alta, scanner GET, confirmación, login, recuperación, contraseña nueva, token expirado/reutilizado y logout.
- Regresión de los ocho actores T04 y sesión T06.

## Pendientes externos

- D08: documentos definitivos y aprobación de su publicación.
- Dominio y configuración del proyecto de staging/producción.
- SMTP del titular, entrega sandbox externa y configuración de protección de correo.

Referencias oficiales consultadas: [plantillas y scanners](https://supabase.com/docs/guides/auth/auth-email-templates), [contraseñas](https://supabase.com/docs/guides/auth/passwords), [configuración CLI](https://supabase.com/docs/guides/local-development/cli/config).
