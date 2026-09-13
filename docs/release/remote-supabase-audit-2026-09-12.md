# Auditoría del Supabase remoto de Lysto

Fecha: 2026-09-12. Proyecto: `dqonlqcurvjnjgsczevu`. Rama del proyecto: `main`, clasificada por Supabase como `PRODUCTION`.

## Identidad y acceso operativo

- La URL configurada es `https://dqonlqcurvjnjgsczevu.supabase.co`.
- El panel autenticado identifica el proyecto como `lystoservicios-sudo's Project`, dentro de `lystoservicios-sudo's Org`.
- El proyecto está `ACTIVE_HEALTHY` en `us-east-1`.
- Auth y Data API responden correctamente. Una consulta anónima a `public.profiles` es rechazada por privilegios/RLS.
- Existe un PAT permanente dedicado a este proyecto. Se guarda fuera del repositorio, con ACL limitada al usuario local de Windows. Su valor no forma parte de ninguna evidencia ni archivo versionado.

## Promoción del esquema

La base comenzó con 7 de 56 migraciones y sin filas de negocio estimadas. Se construyó un lote ordenado para las 49 migraciones pendientes, se ensayó completo dentro de una transacción con `ROLLBACK` y luego se aplicó el mismo conjunto dentro de una única transacción con guardas de línea base y controles posteriores.

El ensayo detectó y corrigió antes del commit dos defectos: un rango de exclusión que usaba operadores `timestamptz` no inmutables y una ambigüedad del parser PL/pgSQL en la confirmación del cliente. Las verificaciones de comportamiento revelaron después dos RPC públicas que no podían alcanzar sus implementaciones privadas. La migración 58 restauró esos límites como funciones `security definer` con `search_path` fijado, conservando revocado el acceso directo a las funciones privadas.

| Artefacto | Resultado | SHA-256 |
| --- | --- | --- |
| Ensayo de migraciones 8–56 | rollback correcto | `4AA62A80BA7C8BBB31C5A963D940037BD2CC3019DFDB565BD2EA889ECEB8CE5B` |
| Aplicación de migraciones 8–56 | commit correcto | `98D8613333DF4FE497D67842D5EAEE2DD2671F1AFFA2EDA30020052252E48A57` |
| Migración 57, `set_updated_at` | commit correcto | `231EC847A1903BB6604655BADA2878620916A04166375923EF2D5811B8C14A47` |
| Ensayo de migración 58 | rollback correcto | `4E3D83281FD9CFBFE0889DFE9B39C7D6187157B86F07B358C28E24322A3D31E1` |
| Aplicación de migración 58 | commit correcto | `21F5E241F1E397A5CB0278F3852B77E3CC9C4F60DE84994C9C7BA3496C59351A` |

## Estado verificado

| Control | Resultado |
| --- | ---: |
| Migraciones registradas | 58 |
| Última migración | `20260912234933` |
| Tablas públicas | 65 |
| Vistas públicas | 0 |
| Tablas públicas con RLS | 65 |
| Tablas públicas sin RLS | 0 |
| Políticas RLS públicas | 159 |
| Longitud mínima de contraseña | 12 |
| Errores del asesor de seguridad | 0 |

Se regeneraron los tipos TypeScript desde el esquema remoto. Las cinco nulabilidades de argumentos que el generador no representa se conservaron explícitamente para reflejar el contrato SQL real.

## Pruebas remotas

Las 28 suites SQL del repositorio pasaron contra el esquema remoto. Producción conserva 59 migraciones y staging avanzó a las 62 del repositorio, incluida la corrección de autorización de soporte. Cada suite se ejecutó en una transacción que instaló pgTAP sólo dentro de la transacción y terminó con una excepción de control para forzar la reversión. La comprobación posterior confirmó cero usuarios fixture, ningún helper de prueba y ninguna extensión pgTAP persistidos.

Esta ejecución cubre esquema, RLS, roles, registro, almacenamiento, eventos, cotizaciones, agenda, asignación, pagos, cierre, confirmación, recibos, soporte, notificaciones, mantenimiento, políticas y colas operativas. Los tests integrales que crean identidades o ejercen HTTP siguen reservados para un entorno desechable de staging; no deben ejecutarse con datos persistentes de producción.

## Advisors y bloqueos restantes

El asesor no informa errores. Permanecen tres clases de advertencias:

- `auth_leaked_password_protection`: no puede activarse en el plan Free; la API devuelve HTTP 402. Requiere pasar al plan Pro.
- 32 RPC `security definer` ejecutables por usuarios autenticados: son límites públicos intencionales. Todas fijan `search_path`; las funciones de negocio verifican sesión, rol, pertenencia o permiso antes de mutar. Las implementaciones privadas sensibles siguen sin permiso de ejecución directa.
- `citext` en `public`: mover la extensión exige una migración coordinada porque funciones existentes referencian `public.citext`. Se mantiene documentada hasta realizar ese refactor.

La organización sigue en el plan Free y no ofrece backups restaurables. Staging está aislado y validado, pero producción y piloto continúan bloqueados hasta habilitar backup/restore verificable, promover las tres migraciones pendientes de producción mediante el proceso aprobado y completar las aceptaciones externas de la hoja de ruta.
