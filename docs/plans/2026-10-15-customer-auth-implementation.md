# Customer Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar el estilo aprobado de la opción 3 a todo el acceso cliente sin cambiar la autenticación real.

**Architecture:** Conservar acciones y contratos existentes; sustituir el marco visual compartido y dividir únicamente la presentación del registro. La confirmación HTML mantiene sus protecciones y consume los mismos recursos locales. Reutilizar la imagen actual del ambiente y la biblioteca de iconos existente.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Vitest/Testing Library, Supabase Auth existente.

---

### Task 1: Registro progresivo y login

**Files:** `app/(auth)/registro/registration-form.tsx`, `app/(auth)/login/login-form.tsx`, `tests/unit/customer-auth-ui.vitest.test.tsx`, `tests/unit/customer-auth-provider-pages.vitest.test.tsx`, `tests/unit/login-form.vitest.test.tsx`.

1. Añadir pruebas de avance, validación, retroceso sin pérdida, payload completo, consentimiento y error/éxito. Ejecutarlas y comprobar fallos por comportamiento ausente.
2. Implementar dos pasos sobre el mismo formulario; conservar campos montados y no deshabilitar los datos que deben enviarse. No crear una cuenta durante Continuar. Permitir revelar contraseña en login.
3. Ejecutar las pruebas afectadas y conservar las validaciones/contratos existentes.

### Task 2: Marco, estados y recuperación

**Files:** `components/auth/auth-frame.tsx`, `components/auth/auth.css`, `components/auth/customer-forms.tsx`, páginas cliente bajo `app/(auth)`, nuevas pruebas `tests/unit/customer-auth-shell.vitest.test.tsx`.

1. Escribir prueba que exija marca, recurso real, un main enfocable y ausencia de navegación comercial/autenticada. Comprobar fallo.
2. Aplicar cabecera aprobada, campos y estados, responsividad, foco/teclado y movimiento reducido. Conservar acceso de equipo fuera del alcance visual mediante variante explícita.
3. Unificar textos y vistas de recuperación/completar datos; comprobar tests y tipos.

### Task 3: Confirmación protegida

**Files:** `lib/auth/account-response.ts`, pruebas existentes de callbacks/contratos y nueva cobertura de presentación.

1. Añadir prueba que falle por falta de marco visual y acciones de recuperación en HTML de confirmación.
2. Usar imagen y CSS de mismo origen con CSP restrictiva; conservar token, CSRF y cabeceras. Escapar texto interpolado. Sin JavaScript inline ni dependencias externas.
3. Ejecutar contratos de confirmación y recuperación existentes.

### Task 4: Verificación y revisión

1. Ejecutar Vitest de auth y pruebas completas de unidad una vez, lint de archivos afectados, tipos y build.
2. Revisar móvil/escritorio e interacciones en el navegador integrado. No enviar registros, contraseñas ni correos reales para una comprobación visual.
3. Comparar con la referencia y guardar `design-qa.md`; si el navegador falla, resultado `blocked`, sin afirmar aprobación visual.
4. Revisar diff, preservar cambios ajenos y entregar vista local con los resultados reales. No publicar ni empujar a main sin petición para esta entrega.
