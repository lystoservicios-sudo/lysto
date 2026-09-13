# Auditoría remota de Vercel — 2026-09-12

Estado: **demo existente verificada; no apta como staging aislado**.

## Resultado

- La sesión autenticada de Vercel pertenece a `waltergaltieri` y expone el proyecto `lysto-demo` (`prj_nggGpeRYxmcrXDni6Xt98OWwVJg7`).
- El proyecto usa Next.js y mantiene despliegues Preview y Production listos; el último despliegue productivo observado fue creado el 25 de agosto de 2026 y publica `https://lysto-demo.vercel.app`.
- Vercel configura Node 24.x, mientras el candidato declara Node 22.x en `package.json`. El runtime debe alinearse antes de aceptar un candidato.
- Sólo están declaradas las variables de aplicación `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No están configurados los secretos y controles requeridos para operaciones, pagos, workers, correo, límites y observabilidad.
- La configuración Preview de `lysto-demo` apunta al proyecto Supabase `dqonlqcurvjnjgsczevu`, clasificado como producción. Por lo tanto no ofrece aislamiento para fixtures, E2E autenticado, carga, restauración ni pruebas de proveedor.

## Decisión técnica

No ejecutar T32, T34, T35 ni T36 contra `lysto-demo` mientras comparta el Supabase productivo. D04 requiere un proyecto Supabase separado, secretos propios, `APP_ENV=staging`, dominio identificable, cuentas sintéticas y custodios. El proyecto Vercel existente puede reutilizarse únicamente si se separa completamente su backend y se corrige su configuración; esa designación sigue pendiente.

La inspección fue de solo lectura. Se descargó la configuración Preview a una ruta temporal fuera del repositorio para comparar únicamente el project ref y los nombres de variables; su contenido quedó sobrescrito a longitud cero y ningún valor secreto fue registrado.
