# Alta del técnico — verificación 2026-10-16

Rama: `codex/technician-registration`, base `d3344c8`. Implementación de los siete pasos aprobados con invitación administrativa y acceso provisorio existentes. No se publicó ni se cambió main.

## Conexión real

- Se conservan las API de contexto, guardado versionado, domicilio, foto pública, documentos privados inspeccionados y envío legal versionado. No se agregó almacenamiento local de datos personales al producto.
- La cuenta de cobro se consulta realmente. El retorno OAuth de onboarding está permitido explícitamente, firmado para sesión/nonce/profesional y contempla cancelación o fallo del proveedor. El dashboard anterior conserva su destino.
- Completar el formulario, vincular cobros y estar habilitado para trabajos son estados independientes. Cuenta en modo de prueba nunca presenta habilitación real.
- Contraseña definitiva sólo cuando el RPC existente autoriza cambiarla. Suspensión/inactividad se muestran con contexto limitado autenticado, sin abrir el expediente protegido.
- Las fechas de vencimiento las asigna Operaciones al revisar documentos; el postulante no recibe un campo ficticio sin una API que lo guarde.

## Evidencia automática

- Suite general ejecutada: 223 archivos, 1.986 comprobaciones correctas y un fallo de test SSR (necesitaba el router del nuevo formulario). Se corrigió el montaje y se preservó la protección de campos antes de hidratación. El test SSR quedó verde en la ejecución final.
- Ejecución final del alcance y regresiones relacionadas: **161/161**, 12 archivos. Incluye 26 casos del recorrido, 45 del modelo, contexto/autorización de contraseña, accesos, estados restringidos, OAuth, subidas y guardado previo a hidratación. Los nuevos errores encontrados se reprodujeron en RED antes de corregirlos.
- Reglas de dominio: **174/174**.
- TypeScript: salida 0. ESLint global: salida 0. Compilación de producción final: salida 0, 109 páginas generadas.
- Prueba SQL real de sólo lectura mediante el perfil Owner aislado: proyecto `dqonlqcurvjnjgsczevu`, `SELECT 1`, usuario `postgres`, base `postgres`. Se comprobaron las ocho funciones existentes utilizadas por el alta. Sin migraciones, cambios de esquema ni datos de prueba en producción.
- Revisión independiente de especificación y calidad: corregidos guardado parcial de domicilio, actualizaciones tardías, envío concurrente/ambiguo, adjuntos pendientes, categorías desactivadas, estados restringidos y retorno OAuth fallido. Comprobación independiente final del caso de documentos vacíos: correcta.

## Navegador y diseño

Sólo navegador integrado de Codex. Componentes productivos reales con transporte local descartable en `output/professional-registration-qa`; no se sustituyeron las API de producto por mocks. El reemplazo de transporte, acceso y Storage queda exclusivamente en ese directorio ignorado.

- Recorrido interactivo: cobertura múltiple y búsqueda, movilidad, copia de horarios, guardado, reemplazo de documento por el cliente de subidas y Storage SDK, verificación de bytes/finalización local, enlace privado, revisión y envío hasta vinculación.
- Fallo de domicilio y reintento conservando versión; bloqueo al seleccionar archivos sin guardar; error de vinculación y recuperación sin abrir Mercado Pago real.
- Trece estados de acceso, edición, revisión, corrección, habilitación y fallos. Además, matriz de acceso/cobertura/horarios/documentos/revisión/aprobado pendiente en 320, 768 y 1280 px, y recorrido móvil de 390 × 844. Sin desbordamiento horizontal en la matriz final.
- Movimiento reducido comprobado en navegador (`animation: none`); se restauró la emulación. En el recorrido final no se detectaron excepciones nuevas de ejecución después de corregir el documento vacío.
- Comparaciones y capturas en `output/professional-registration-qa/screenshots/`. Resultado visual detallado al final de `design-qa.md`.

## Límites de las pruebas

No se ejecutó el conjunto E2E de integración que provisiona cuentas/base descartables: no se usó Docker ni se crearon fixtures en producción. Sus selectores fueron adaptados al flujo nuevo sin eliminar controles de autorización o persistencia. No se completó un OAuth real con una cuenta de técnico ni se aceptaron términos reales, cambiaron contraseñas reales o hicieron cobros. La lectura de Supabase producción no se presenta como prueba de escritura del expediente ni como ensayo financiero real.

El preview local informa datos ficticios. La implementación registrada en el repositorio usa los endpoints existentes del sistema, no ese transporte de pruebas.
