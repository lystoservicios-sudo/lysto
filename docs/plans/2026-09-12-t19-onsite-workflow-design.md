# T19: trabajo en domicilio y adicionales

## Flujo canónico

1. El profesional asignado avanza `confirmed → technician_on_way → arrived → onsite_diagnosis`. Cada comando lleva una clave persistida en la sesión del dispositivo y el servidor guarda su resultado.
2. El diagnóstico presencial registra equipo del cliente, hallazgo, alcance base y una a cinco fotos procesadas por la canalización privada de evidencia. Queda separado del diagnóstico preliminar.
3. El cliente ve exactamente el registro persistido. Puede pedir cambios con motivo o aceptar. La aceptación inicia el trabajo solamente si el pago inicial y todos los adicionales aceptados figuran `approved` en el checkout canónico.
4. Cada falla adicional conserva importe, profesional, decisión e idempotencia propios. No modifica el presupuesto inicial y mantiene comisión y recargo Lysto en cero bajo la regla vigente.
5. Un timeout no genera otra orden: la UI conserva clave y borrador, vuelve a consultar el servidor y reusa la clave para el mismo contenido. Sólo un acuse exitoso borra la clave.

Los RPC antiguos que permitían avanzar desde diagnóstico directamente a trabajo o decidir un adicional sin clave de comando pierden permiso para `authenticated`.

## Decisión pendiente

D06 debe definir si los adicionales pueden tener otra modalidad de cobro. Hasta esa aprobación, la regla segura exige aceptación explícita y pago confirmado antes de comenzar el alcance adicional.
