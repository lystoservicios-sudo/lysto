# Alta completa de técnicos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que Administración invite a un técnico, que éste complete identidad, documentación, foto, disponibilidad y cuenta de Mercado Pago, y que sólo reciba trabajos nuevos cuando la revisión y la conexión de cobros estén vigentes.

**Architecture:** Conservar la invitación vinculada a un correo y la revisión documental existentes. Separar `documentary clearance` de `ready for new work`: la aprobación humana puede terminar antes de OAuth, pero la asignación exige ambas condiciones y una foto de perfil válida. Reutilizar la carga privada inspeccionada para documentos y el OAuth de split para el vendedor, con un acceso acotado durante la postulación.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Auth/Postgres/Storage, Vitest, pgTAP, Playwright y Mercado Pago Split 1:1.

---

## Decisiones de diseño

1. **Invitación individual, ligada al email (recomendada).** Mantener token aleatorio, vencimiento de 14 días, un solo consumo, correo confirmado y revisión administrativa. El panel permitirá copiar el enlace *sólo en la respuesta de creación* para compartirlo manualmente; la lista posterior nunca revelará el token. Alternativa: únicamente correo automático, más simple pero sin enlace administrable. Se descartan enlaces genéricos reutilizables porque perderían el vínculo previo con una persona concreta.
2. **Dos aprobaciones independientes (recomendada).** `approved` seguirá significando que la postulación documental fue aprobada; `readyForNewWork` será una condición derivada de documentación vigente, avatar publicado y cuenta Mercado Pago habilitada. El técnico podrá conectar Mercado Pago desde `/pro/onboarding` antes de la decisión administrativa. Alternativa: exigir OAuth antes de enviar la postulación; esto bloquearía la revisión por una falla temporal del proveedor.
3. **Documentos privados, avatar público separado.** DNI y matrícula siguen en `professional-documents` y se consultan con enlaces breves. La foto de perfil tendrá una carga específica, inspección de bytes, eliminación de metadatos y reemplazo controlado en `public-avatars`; nunca se publicará una foto del DNI o de la matrícula.
4. **No cortar trabajos ya aceptados por una desconexión posterior.** La ausencia de Mercado Pago bloquea nuevas ofertas/asignaciones y el cobro, y abre un estado visible para Operaciones. La autorización a consultar y cerrar trabajos existentes sigue dependiendo de la aprobación y documentación vigente, con el circuito financiero de excepción si el vendedor no puede cobrar.

## Estado inicial y alcance

- Ya existen registro de clientes por correo, invitaciones de técnicos, formulario profesional, documentos privados, herramientas, zonas, horarios, revisión humana y OAuth de Mercado Pago. Ver `lib/professional/onboarding-service.ts`, `components/pro/connected-professional-onboarding.tsx` y `components/payments/marketplace-account.tsx`.
- Faltan enlace copiable de una sola vista, avatar operativo, acceso a OAuth durante la postulación, estado de preparación para nuevos trabajos y política documental de producción por especialidad. `private.professional_review_policies` está vacía tras las migraciones por diseño.
- La matrícula, el DNI, el CUIL, el teléfono, una zona y al menos una franja horaria ya se validan al enviar. Se conservará esa validación. La política definirá `identity` y `license` como tipos documentales exigibles cuando corresponda; si se requiere frente y dorso del DNI se configurarán como tipos distintos.
- El alta de clientes no se reescribe: se ejecuta una regresión de registro, confirmación, aceptación legal y acceso para detectar una ruptura cruzada.

## Tarea 1: Contrato de invitación y enlace administrable

**Archivos:** `supabase/migrations/<generated>_professional_invitation_link.sql`, `lib/professional/onboarding-service.ts`, `components/admin/connected-professional-invitations.tsx`, `tests/integration/professional-onboarding.test.ts`, `tests/admin-ui.vitest.test.tsx`, `supabase/tests/database/professional_onboarding.test.sql`.

1. Añadir pruebas fallidas: sólo owner/operations con MFA crea una invitación; la respuesta de creación contiene un enlace para el email indicado; la consulta/lista posterior no contiene token ni enlace; cancelar, vencer o consumir inutiliza el enlace; otro email no puede aceptarlo. Comprobar que la UI no lo guarda en `localStorage` ni lo incluye en URLs de telemetría.
2. Ejecutar `corepack pnpm exec vitest run tests/admin-ui.vitest.test.tsx` y `corepack pnpm test:integration` en el entorno local disponible; confirmar que falla el nuevo contrato.
3. Extender la función de creación para devolver el token sólo al actor autorizado en esa llamada, sin agregarlo al documento de listado ni a logs. Construir la URL con el origen configurado en servidor. Mantener el envío por outbox y mostrar en el panel los estados «en cola», «aceptada» y «vencida» con un botón de copiar disponible sólo inmediatamente después de crear.
4. Ejecutar las pruebas focalizadas y confirmar que pasan. Probar que la acción manual no altera la condición de correo confirmado.

## Tarea 2: Requisitos documentales aprobados y versionados

**Archivos:** `supabase/migrations/<generated>_professional_policy_management.sql`, `lib/professional/onboarding-contracts.ts`, `lib/professional/onboarding-service.ts`, `lib/professional/admin-workflow.ts`, `components/admin/connected-professional-review.tsx`, `components/pro/connected-professional-onboarding.tsx`, `supabase/tests/database/professional_onboarding.test.sql`, `tests/integration/professional-onboarding.test.ts`.

1. Fijar con el responsable de operaciones los requisitos por especialidad: tipos de documento, si DNI necesita frente/dorso, vigencias, matrícula, herramientas y experiencia mínima. Registrar versión, aprobador y fecha efectiva; no inventar un número de matrícula, póliza o requisito legal.
2. Añadir pruebas fallidas para política ausente, borrador, vigente y modificada: el formulario permite guardar borrador sin política; no permite enviar ni aprobar sin versión aprobada; una actualización no reescribe un envío histórico; cualquier cambio que quite habilitaciones muestra antes el alcance de profesionales afectados.
3. Crear un flujo de Administración con permisos/MFA para preparar y activar políticas versionadas, auditar el cambio y consultar el impacto. Mantener snapshots de requisitos por envío y comparar contra la versión vigente en la habilitación. Hacer explícita la revalidación de técnicos aprobados afectados por una política nueva.
4. Mostrar en el formulario los documentos exactos de la política activa, con estado y motivo de observación. Limitar el tipo de documento a los códigos permitidos por esa política en la carga, no sólo a una cadena arbitraria.
5. Ejecutar pruebas SQL e integración; verificar migración nueva y actualización con expedientes preexistentes.

## Tarea 3: Foto de perfil real

**Archivos:** `lib/uploads/validation.ts`, `lib/uploads/service.ts`, `lib/uploads/inspection.ts`, `lib/uploads/client.ts`, `supabase/migrations/<generated>_professional_avatar.sql`, `components/pro/connected-professional-onboarding.tsx`, `components/pro/pro-account.tsx`, `components/admin/connected-professional-review.tsx`, `tests/unit/*upload*.vitest.test.ts`, `supabase/tests/database/storage.test.sql`.

1. Añadir pruebas fallidas de propiedad, tamaño, MIME real, imagen corrupta, metadatos EXIF, reemplazo, dos cargas concurrentes y rechazo de una URL externa como avatar. La foto debe quedar asociada al perfil autenticado y nunca a otro técnico.
2. Crear un tipo de carga `professional-avatar` que use cuarentena, inspección y derivado sin metadatos. Publicar sólo el derivado validado en `public-avatars`, de tamaño acotado; guardar la referencia canónica en `profiles.avatar_url` mediante operación de servidor, con reemplazo y limpieza de huérfanos.
3. Agregar vista previa, cambio y estado de foto al onboarding; mostrar el mismo avatar en el perfil profesional y la vista administrativa. Marcar la foto como requisito de `readyForNewWork`, no como sustituto de la foto de documento.
4. Ejecutar pruebas focalizadas, tipos y pruebas de Storage. Verificar manualmente que el enlace público no permite inferir rutas de documentos privados.

## Tarea 4: Mercado Pago accesible durante la postulación

**Archivos:** `lib/payments/marketplace-session.ts`, `app/api/mercadopago/oauth/authorize/route.ts`, `app/api/mercadopago/oauth/callback/route.ts`, `app/api/mercadopago/account/route.ts`, `components/payments/marketplace-account.tsx`, `components/pro/connected-professional-onboarding.tsx`, `app/(professional-onboarding)/pro/onboarding/page.tsx`, `tests/unit/marketplace-api.vitest.test.ts`, `tests/integration/professional-onboarding.test.ts`.

1. Añadir pruebas fallidas: el postulante con invitación aceptada y correo confirmado puede iniciar/completar OAuth para su propio `professionalId`; un anónimo, cliente, admin o postulante ajeno no; el callback exige el `state` y cookie vinculados a la misma sesión; un vendedor ya ligado a otro profesional no se reasigna.
2. Extraer una guarda estrecha para **sólo** las rutas de cuenta/OAuth. Mantener `approvedProfessional` en checkout, cobros, reembolsos y demás rutas financieras. La conexión quedará disponible para estados editables, enviados, en revisión y aprobados; la desconexión conservará las restricciones de historial de pagos.
3. Llevar el botón y estado de conexión a `/pro/onboarding`. Volver al onboarding después de OAuth si el técnico aún no está aprobado; conservar `/pro/mercadopago` para aprobados. Mostrar «pendiente de configuración» cuando falten credenciales, sin atribuir al usuario un error del servidor.
4. Ejecutar pruebas focalizadas. En sandbox, completar una autorización real y comprobar que el ID de vendedor almacenado corresponde a la identidad que inició el flujo.

## Tarea 5: Preparación para trabajos nuevos y estados visibles

**Archivos:** `supabase/migrations/<generated>_professional_work_readiness.sql`, `supabase/migrations/<generated>_professional_assignment_readiness.sql`, `lib/professional/onboarding-contracts.ts`, `lib/professional/admin-workflow.ts`, `components/pro/connected-professional-onboarding.tsx`, `components/admin/connected-professional-directory.tsx`, `supabase/tests/database/assignment_offer_lifecycle.test.sql`, `tests/integration/professional-onboarding.test.ts`.

1. Añadir pruebas fallidas para matriz de estado: documentos aprobados + avatar + vendedor conectado = recibe ofertas; cualquier requisito faltante = no aparece como candidato ni se asigna; una cuenta desvinculada bloquea nuevas ofertas sin borrar el expediente ni los trabajos en curso. El checkout continúa rechazando `seller_not_linked` si cambia el estado después de asignar.
2. Crear una función de lectura derivada `private.professional_ready_for_new_work(id)` que combine `private.professional_clearance_valid`, avatar canónico y `mp_split_connected_accounts.enabled`. No agregar un booleano editable por el navegador ni mezclar este estado con `professional_clearance_valid`.
3. Aplicar la misma función en selección de candidatos, oferta y asignación manual dentro de transacciones; serializar el control con desconexión/suspensión donde corresponda. Exponer motivos acotados (`documentos`, `foto`, `Mercado Pago`) al propio técnico y a Operaciones, sin exponer tokens ni archivos.
4. Probar transición en ambos sentidos, concurrencia, profesionales anteriores a la migración y la separación entre trabajos nuevos y existentes. Si no hay configuración de split en un ambiente, fallar cerrado para nuevas asignaciones pagas y mostrar una razón operativa.

## Tarea 6: Recorrido de usuario, comunicación y regresión de clientes

**Archivos:** `components/pro/connected-professional-onboarding.tsx`, `components/pro/invitation-entry.tsx`, `components/admin/connected-professional-invitations.tsx`, `docs/release/professional-onboarding.md`, `tests/e2e/professional-production.spec.ts`, `tests/e2e/customer-production.spec.ts`, `tests/unit/customer-auth-actions.vitest.test.ts`.

1. Presentar el alta como pasos visibles: cuenta y confirmación, datos y disponibilidad, documentos y avatar, Mercado Pago, revisión, habilitación. Permitir volver a pasos incompletos y conservar borradores; mostrar qué falta para enviar y qué falta para recibir trabajos.
2. Añadir pruebas E2E de invitación válida, correo distinto, confirmación, carga de DNI/matrícula, foto, horarios, herramientas, revisión con corrección, OAuth de sandbox, aprobación y primera oferta. Probar las rutas de error del proveedor y recarga de página.
3. Ejecutar regresión de cliente: registro por email, confirmación, aceptación legal, perfil y acceso a `/app`. Comprobar que el enlace de técnico no crea un cliente y que la cuenta cliente existente no cambia de rol.
4. Actualizar documentación operativa para reenvío/cancelación de invitaciones, vencimiento documental, nueva política, foto de perfil, desconexión de cobros y soporte. Diferenciar «aprobado» de «habilitado para trabajos».

## Tarea 7: Verificación y despliegue controlado

**Archivos:** `docs/release/professional-onboarding-verification.json`, `docs/release/provider-acceptance.md`, `docs/release/production-handover.md`.

1. Ejecutar `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:integration`, `corepack pnpm build` y las suites locales de base (`corepack pnpm exec supabase test db --local`) donde haya stack disponible. Resolver fallos relacionados y registrar resultados frescos.
2. Validar una instalación limpia y actualización con datos existentes. Inventariar técnicos legados aprobados sin invitación y cuentas Mercado Pago ya ligadas; registrar el impacto de la nueva condición antes de activarla.
3. En staging, hacer una prueba completa con email recibido, cuenta de prueba Mercado Pago, documento revisado por una persona de Operaciones y oferta real de sandbox. Confirmar que no se envía un trabajo a una cuenta sin vendedor habilitado.
4. Publicar migraciones y aplicación con una activación coordinada de la nueva condición de asignación. Mantener el control de producción pendiente hasta que el titular apruebe las políticas documentales y los ensayos externos. Registrar fecha, actor y evidencia de la activación.

## Criterios de aceptación

- Nadie puede registrarse como técnico mediante el alta libre de clientes ni con un enlace vencido, cancelado, consumido o destinado a otro email.
- El administrador puede crear y copiar una vez un enlace individual; la entrega por correo y el estado de esa entrega se muestran por separado.
- El técnico completa los datos existentes, sube la documentación que exige una política vigente, agrega su foto de perfil y define zona, herramientas y horarios.
- La documentación sensible sigue privada; Operaciones revisa cada documento requerido, deja motivo y vigencia, y puede pedir correcciones.
- El técnico puede vincular Mercado Pago durante la postulación sin entregar su contraseña a Lysto. La cuenta queda ligada a su propia identidad y se distingue test de live.
- «Aprobado» no implica «habilitado para nuevos trabajos»: sólo se habilita con documentos vigentes, avatar y vendedor conectado. La desconexión bloquea trabajos nuevos y no impide consultar o resolver los ya asumidos.
- El registro y acceso de clientes siguen funcionando.

## Referencias externas a verificar al ejecutar

- [Mercado Pago: OAuth para vendedores](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration).
- [Mercado Pago: integración de Split 1:1](https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace).
- [Mercado Pago: Orders y `marketplace_fee`](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/create-order).
