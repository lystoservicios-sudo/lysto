# Puesta en producción controlada

Estado: procedimiento preparado. No autoriza un despliegue, cobro ni apertura del piloto. La ejecución requiere G01–G15 vigentes, responsables identificados y una decisión GO firmada.

## Candidato y ventana

Asignar un ID de release, commit completo, hash del conjunto de migraciones, artefacto inmutable, deployment objetivo y ventana con inicio, fin y canal de coordinación. Registrar titular de dirección, líder técnico, operador, suplente, finanzas, privacidad y responsable de incidentes. Un cambio de código o migración crea otro candidato y obliga a renovar la evidencia afectada.

Crear el inventario inicial únicamente desde un checkout limpio:

```text
pnpm release:manifest -- --release-id <id> --environment production --output output/release/<id>/manifest.json
```

El archivo nace con `decision: NO_GO` y G01–G16 pendientes. Sólo evidencia verificable y firmada puede cambiar gates. TECHNICALLY_READY describe G01–G13; no habilita producción. El piloto exige G01–G15 y G16 queda pendiente hasta terminarlo.

## Preflight 48–24 horas antes

1. Congelar el candidato exacto y confirmar que CI protegida reconstruye ese commit.
2. Completar D01–D11 y cualquier exclusión D12. Toda exclusión indica alcance, motivo, vencimiento, aprobador y comportamiento visible.
3. Verificar G01–G15 con la política de confianza protegida. Resolver o aceptar por escrito cada riesgo; un gate no admite excepción narrativa.
4. Confirmar cupo, zona, horario, cuentas de prueba, profesionales y operadores del piloto.
5. Probar que `LYSTO_ACCEPT_NEW_REQUESTS=false` y `LYSTO_ALLOW_NEW_CHECKOUTS=false` detienen sólo altas nuevas y preservan lecturas, servicios existentes y webhooks.
6. Obtener y verificar backup de DB, Auth, Storage y configuración. Registrar punto recuperable, checksum, custodio y resultado del restore aislado de G13.
7. Confirmar observabilidad, alertas, cuotas, presupuesto, soporte, suplente y canales de escalamiento.

La migración debe ser compatible hacia adelante con la versión anterior durante la ventana. Evitar eliminar o reinterpretar datos en la misma release que cambia consumidores. Documentar orden, duración prevista, locks, comprobación posterior y forward fix. El rollback de aplicación debe funcionar contra el esquema ya migrado.

## Ejecución con entradas cerradas

1. Registrar GO firmado y verificar de nuevo commit, migraciones, artefacto, backup y responsables.
2. Mantener ambos interruptores en `false` y pausar workers que generen negocio nuevo.
3. Aplicar sólo las migraciones del manifest después del preflight de historial y compatibilidad. Conservar salida y deployment ID.
4. Desplegar el artefacto inmutable. Verificar versión, dominio y TLS, headers, assets, rutas públicas, login/MFA, aislamiento de roles y RLS, archivos privados, conexiones/pools, scheduler, colas, outbox y recepción idempotente de webhook.
5. Ejecutar smoke sintético sin fixtures destructivos. Corroborar que alertas llegan a los destinos designados y que ambos interruptores siguen cerrados.
6. Si D11 exige un cobro real mínimo, ejecutarlo sólo con autorización explícita que indique importe, moneda, cuenta pagadora, destinatario, conciliador y política de devolución. Registrar intención, webhook, ledger, comisión, neto y devolución. Sin esa autorización, el caso permanece pendiente.

## Apertura limitada y observación

Habilitar primero solicitudes dentro del cupo D01. Observar admisión y asignación; luego habilitar checkouts si finanzas confirma conciliación. Cambiar un interruptor por vez y registrar actor, hora y resultado. Durante la ventana vigilar errores, latencia, conexiones, colas, webhooks, pagos inciertos, notificaciones y capacidad operativa. El operador puede cerrar ambas entradas sin desplegar.

Ante acceso indebido, doble cobro, pérdida de evidencia, estado monetario desconocido o incapacidad de atender incidentes, cerrar entradas inmediatamente. Preservar servicios existentes, recepción de eventos, outbox, ledger, auditoría y soporte. Aplicar rollback de aplicación compatible o forward fix; restaurar DB sólo bajo el procedimiento de desastre y luego conciliar eventos posteriores al punto restaurado.

## Cierre de ventana

Registrar estado de switches, versión efectiva, smoke, alertas, incidencias, conciliación, responsable de guardia y siguiente revisión. Un resultado NO-GO mantiene entradas cerradas. Un GO de piloto no autoriza crecimiento general; T38 y G16 deben demostrar el piloto antes de ampliar cupos o zonas.
