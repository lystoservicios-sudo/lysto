# Alineación de CI con el acceso actual

## Contexto y objetivo

La CI de `main` falla en cinco pruebas de integración de Auth; las mismas cinco fallaban antes de integrar Orders. El sitio separa el login de clientes (`/login`) del equipo (`/equipo/login`) y exige datos mínimos de contacto y dirección antes de entrar en `/app`. El objetivo es preservar ese diseño, restablecer la CI y no debilitar límites entre roles.

## Decisión

- Las pruebas de visitantes anónimos esperarán `/login` para `/app` y `/equipo/login` para `/pro` y `/admin`.
- La resolución de acceso al cliente distinguirá un rol ajeno validado por Auth de un cliente cuyo contexto aún no está listo. El rol ajeno recibirá 404 sin cerrar su sesión; el cliente conservará la secuencia de aceptación legal, perfil y dirección antes de la comprobación final de sesión. Los enlaces directos conservarán su destino tras el login.
- Las pruebas de ciclo de cuenta recorrerán la transición real: confirmación o login, redirección a `/completar-perfil` cuando falte dirección, guardado del perfil mediante el formulario real y acceso posterior a `/app`. Una cuenta reparada que perdió su perfil también debe completar los datos que falten.
- No se modificarán políticas RLS, migraciones, credenciales ni datos productivos. No se usarán Docker ni Supabase local en este equipo. La CI automática existente de GitHub utilizará su entorno descartable remoto, según la aprobación del usuario.

## Alternativas descartadas

1. Volver a una sola pantalla de login y permitir `/app` sin dirección: haría pasar expectativas antiguas, pero revertiría decisiones de producto y permitiría flujos incompletos.
2. Cambiar sólo las expectativas de las pruebas: ocultaría que un usuario de otro rol recibe una redirección y puede perder la sesión. El 404 entre roles debe preservarse.
3. Omitir estas pruebas: dejaría una CI verde sin demostrar el límite de acceso ni el onboarding.

## Verificación

Primero se añadirán pruebas unitarias que distingan rol ajeno, cliente con aceptación legal pendiente y visitante con enlace directo; luego se hará el cambio mínimo. Las pruebas de integración se actualizarán para afirmar el recorrido de login y perfil, sin desactivar casos ni relajar permisos. Se ejecutarán lint, tipos, pruebas y build local sin Docker. Antes de fusionar se hará revisión independiente; tras el push se esperará la CI completa de GitHub. Sólo con CI aprobada se considerará cerrado este bloqueo; los cobros reales seguirán apagados y la migración Orders no se aplicará a producción.
