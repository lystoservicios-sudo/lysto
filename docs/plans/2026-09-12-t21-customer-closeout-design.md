# T21 — Conformidad, disputa y reseña separadas

El informe técnico deja el trabajo en `completed_pending_customer_confirmation`. Sólo el cliente dueño puede registrar una decisión explícita. Confirmar cambia el trabajo a `completed` sin exigir calificación. Informar desacuerdo exige motivo, cambia a `disputed` y abre un único expediente de calidad.

Cada trabajo admite una sola decisión. Repeticiones equivalentes, incluso desde dos pestañas con claves distintas, devuelven el hecho existente; una decisión diferente devuelve conflicto. No existe conformidad por timeout mientras D06 no apruebe una política.

La reseña está disponible únicamente después de conformidad y es opcional. No cambia estado, profesional, beneficiario ni pago. Una huella inmutable evita sobrescrituras y la restricción por trabajo evita duplicados. Una reseña baja o no resuelta abre una alerta `review_quality` idempotente.

`jobs_completed` se calcula desde trabajos realmente `completed`; `rating_avg` se calcula desde reseñas. La cantidad de reseñas ya no se usa como cantidad de trabajos terminados.

La interfaz distingue informe recibido, conformidad o desacuerdo, servicio completado y reseña opcional. Los comandos de decisión y reseña conservan su UUID en el navegador hasta recibir confirmación del servidor.
