# T16 — Asignación, propuesta y aceptación con recuperación

## Autoridad y estados

La recomendación ordena candidatos, pero no concede elegibilidad. `create_assignment_offer` vuelve a comprobar en una sola transacción la habilitación vigente, especialidad, zona, herramientas, disponibilidad semanal, ausencias y capacidad. El trabajo y cada oferta tienen versiones independientes.

Una oferta pendiente es la única salida de `pending_assignment`. Reserva la visita como hold hasta su vencimiento. La aceptación confirma el trabajo y la reserva; el rechazo o vencimiento conserva el historial, libera la capacidad y devuelve el trabajo a la cola. La aceptación repetida de la misma oferta aceptada devuelve el estado existente sin repetir transiciones.

## Dinero y recuperación

La aceptación informa si falta la cuenta de cobro y si el pago sigue pendiente. El guard existente impide iniciar la visita sin pago aprobado y también impide cambiar el destinatario cuando hay un checkout activo. Esa conciliación se resuelve en T18.

El proceso de vencimiento es acotado, bloquea filas con `skip locked` y es idempotente. Ante una pausa operativa se detienen nuevas asignaciones y el worker; las ofertas persistidas se resuelven antes de reemitir.
