# Plan de implementación: CI de autenticación

> **Objetivo:** restablecer las pruebas obligatorias sin modificar el flujo de acceso ni relajar límites entre roles.

## 1. Documentar el fallo y reproducirlo

- Confirmar que las cinco fallas remotas corresponden a expectativas antiguas de login/perfil y al orden de autorización de `/app`.
- Ejecutar localmente la prueba unitaria actual del layout para establecer la línea base.

## 2. Corregir el límite de rol con TDD

- Agregar pruebas que exijan 404 sin cerrar sesión para un rol ajeno y preserven el onboarding del cliente y los enlaces directos.
- Ejecutarla y confirmar que falla con el layout actual.
- Distinguir el rol ajeno en `resolvedCustomerDestination` antes del onboarding, manteniendo `requirePageSession('customer')` tras la resolución para clientes listos.
- Repetir la prueba hasta que pase.

## 3. Alinear pruebas de integración con el recorrido real

- Exigir `/equipo/login` para las páginas privadas de profesional y administrador; conservar `/login` para clientes.
- En el ciclo de cuenta, comprobar la redirección a `/completar-perfil`, enviar el formulario real y verificar luego `/app` y la persistencia de los datos.
- Repetir la verificación tras reparar un perfil eliminado, sin crear otra cuenta Auth.

## 4. Verificación e integración

- Ejecutar lint, tipos, pruebas de dominio, unitarias y build localmente; no iniciar Docker ni Supabase local.
- Solicitar revisión independiente del cambio y resolver observaciones.
- Integrar la rama en `main` y esperar la CI remota completa, cuyo backend es descartable.
- Confirmar el resultado del despliegue sin activar cobros ni aplicar migraciones a la base productiva.
