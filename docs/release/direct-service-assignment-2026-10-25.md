# Asignación directa sin aceptación del técnico

Corrección del 25/10/2026, publicada en https://lystohogar.com.

El recorrido vigente es solicitud → asignación → confirmación y pago del cliente. El técnico no acepta la solicitud para habilitar el pago. Pedir ya realiza asignación automática; se conservó sin cambios. Desde administración, enviar asigna directamente al técnico elegido y reserva la visita, sin crear ofertas ni registrar una aceptación individual del profesional.

## Publicación y alcance

- Runtime: `6e82a69bec8371b7832de9ae23ed15c6b1191cf5`; deployment `dpl_8fmWpHC3cgC8jRYe8VgNRWNP6r1b`, READY/PROMOTED, dominio verificado.
- Se conservó el arreglo concurrente de revisión de documentos `dd225b3`, que había sido publicado durante la preparación. No se sobrescribió su despliegue con una copia anterior.
- Migración `20261026011519_admin_requests_direct_assignment.sql` aplicada y registrada en el proyecto `dqonlqcurvjnjgsczevu` mediante el perfil Owner dedicado. La reparación nativa de historial encontró dos lock timeouts; se registró la migración con un INSERT de historial controlado por SQL Owner, verificando primero el MD5 exacto de prosrc instalado. No se terminó ni alteró ninguna sesión ajena.
- Se mantuvieron RLS, wrapper invoker, denegación anónima, permisos operations+finance/owner con MFA, elegibilidad, agenda, anticipo de tres días hábiles, idempotencia, versiones, consentimiento y reparto congelado.
- Se conserva la guardia que impide comenzar la visita sin consentimiento del cliente y pago aprobado. No se reescribieron solicitudes históricas.

## Evidencia

- RED: la prueba real detectó la oferta de aceptación técnica anterior; las pruebas UI fallaron por los textos y pasos antiguos.
- GREEN: la prueba SQL transaccional envía, confirma como cliente y prepara el checkout canónico sin sesión ni respuesta del técnico. Verifica ausencia de ofertas y accepted_at del técnico, reserva, concurrencia, avisos al cliente, versiones antiguas, comisión exacta, privacidad y bloqueo de visita sin pago. Se revirtió completamente antes de aplicar el cambio y se repitió contra la función realmente instalada, nuevamente con rollback.
- 65/65 pruebas enfocadas de administración, cliente y pagos. Después de conservar la revisión de documentos: 29/29 pruebas de sus tres pantallas afectadas. Estos grupos se solapan y no se suman.
- Tipos y ESLint correctos; compilación remota correcta, 118 páginas. Se promovió la misma compilación preparada con configuración de producción.
- Revisión independiente: sin P1/P2.
- Advisors: 71 antes y 71 después, cero nuevos.
- Navegación real en cuenta administradora: el formulario publicado muestra «Al enviarlo, el técnico queda asignado y el cliente puede confirmar y pagar». No espera aceptación del profesional.
- Consulta puntual de errores del despliegue en los últimos diez minutos: cero entradas.

Las comprobaciones no llamaron al proveedor de pagos ni entregaron notificaciones ni dejaron solicitudes de prueba. No se acredita un pago real nuevo. Captura: `output/playwright/admin-direct-assignment-production.png`. Informes y logs: `.worktrees/admin-direct-dispatch/output/` y `output/admin-direct-assignment-*.json/sql`.
