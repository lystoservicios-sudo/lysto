# Lysto Email Visual System Implementation Plan

**Goal:** Aplicar la identidad visual cálida elegida a todos los correos transaccionales y de autenticación de Lysto.

**Architecture:** Un shell HTML compartido renderiza los correos de aplicación con variantes por familia. Supabase Auth conserva plantillas independientes pero replica los mismos tokens, logo, estructura y familias mediante URLs públicas del sitio.

**Tech Stack:** TypeScript, HTML email con estilos inline, Supabase Auth templates, Vitest, Playwright.

---

### Task 1: Contrato visual

- Ampliar las pruebas de plantillas para exigir logo oficial, shell tabular, familia visual y CTA.
- Ejecutar las pruebas y confirmar que fallan antes de cambiar producción.

### Task 2: Activos de marca e ilustraciones

- Preparar logo oficial transparente.
- Crear ilustraciones para visitas, solicitudes, pagos, seguridad, soporte y profesionales.
- Guardar y optimizar los activos bajo `public/images/email/`.

### Task 3: Correos transaccionales

- Extraer tokens y componentes del shell.
- Diseñar contenido específico para cada evento y audiencia.
- Mantener texto plano, destinos y validaciones existentes.

### Task 4: Correos de Supabase Auth

- Rediseñar confirmación, recuperación y cambio de correo.
- Conservar `TokenHash`, rutas propias y doble confirmación.

### Task 5: Evidencia y regresión

- Ampliar fixtures para todas las familias.
- Renderizar vistas responsive.
- Ejecutar pruebas unitarias, tipos y lint de los archivos afectados.

