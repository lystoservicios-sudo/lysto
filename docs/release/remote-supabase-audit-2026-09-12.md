# Auditoría del Supabase remoto de Lysto

Fecha: 2026-09-12. Proyecto: `dqonlqcurvjnjgsczevu`. Rama del proyecto: `main`, clasificada por Supabase como `PRODUCTION`.

## Identidad y disponibilidad

- La URL configurada en `.env.local` es `https://dqonlqcurvjnjgsczevu.supabase.co`.
- El panel autenticado identifica el proyecto como `lystoservicios-sudo's Project`, dentro de `lystoservicios-sudo's Org`.
- Auth responde correctamente y acepta la clave pública configurada.
- El acceso anónimo a `public.profiles` llega al Data API y es rechazado por privilegios/RLS, como corresponde para una sesión sin autenticar.

## Estado del esquema

Una consulta de sólo lectura ejecutada como `postgres` desde el SQL Editor confirmó:

| Control | Resultado |
| --- | ---: |
| Migraciones registradas | 7 |
| Última migración | `202608190007` |
| Tablas públicas | 45 |
| Vistas públicas | 1 |
| Tablas públicas con RLS | 45 |
| Tablas públicas sin RLS | 0 |
| Políticas RLS públicas | 149 |
| Tablas privadas | 4 |
| Usuarios de Auth | 3 |
| Objetos de Storage | 0 |
| Filas de negocio estimadas en `public` + `private` | 0 |

El repositorio contiene 56 migraciones. Por lo tanto, la base remota está en la línea base `202608190007` y tiene 49 migraciones pendientes. Las tablas de las funcionalidades posteriores, entre ellas `service_quotes`, `assignment_offers`, `maintenance_plans` y `operator_queue_configuration`, no existen todavía.

## Backups y acceso operativo

La organización está en el plan Free. El panel indica que ese plan no incluye backups del proyecto y no existe un backup restaurable. La sesión local del Supabase CLI pertenece a otra cuenta y no lista este project ref; por eso todavía no se puede ejecutar `db push`, obtener un dump lógico ni verificar el historial con el CLI.

No se aplicaron migraciones ni se modificaron datos. El siguiente paso seguro es autenticar el CLI con la cuenta propietaria o proporcionar una conexión de base de datos mediante un canal local seguro. Antes de promover el esquema se debe crear un dump lógico recuperable o habilitar backups, ejecutar un ensayo transaccional de las 49 migraciones, aplicar el lote por orden y comprobar migraciones, RLS, advisors e integraciones.
