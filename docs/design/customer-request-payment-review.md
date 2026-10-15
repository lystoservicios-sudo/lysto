## Mercado Pago Integration Review

**Scope**: security
**API detected**: both (Checkout Pro preferences + lectura canónica de Payments; Orders permanece opcional bajo el flag existente)
**Products detected**: Checkout Pro marketplace/split
**Files analyzed**: `app/api/mercadopago/{create-preference,checkouts,webhook}/route.ts`, `app/api/customer/requests/{preview,prepare}/route.ts`, `lib/payments/{marketplace,marketplace-ledger,marketplace-config,checkout-contract,orders,customer-request-actor}.ts`, `lib/customer-requests/service.ts`, migraciones `20261014023946`, `20261014213321`, `20261014235503`, `.gitignore`, pruebas enfocadas y runners QA.

### CRITICAL

- Los contratos/reparto están verificados y aplicados; la corrección nueva de conflictos `20261014235503` está aplicada solo en QA y probada con ROLLBACK en producción. Debe publicarse junto con los adaptadores compatibles. La prueba parcial real Auth/HTTP pasó 17/17; el recorrido completo de contratación/pago con proveedor sigue sin certificarse ni acreditar dinero de Mercado Pago.
- El usuario aprobó 18% para Lysto y 82% bruto para el técnico, sin reserva del 6%. La política automática continúa deshabilitada: todavía no hay tarifario vigente ni política real de alcance inicial/duración/agenda aprobada en producción.

### WARNINGS

- `sandbox_init_point` sigue apareciendo en el almacenamiento histórico y en el tipo de checkout (`lib/payments/marketplace.ts`, `marketplace-db.ts`). El nuevo endpoint utiliza exclusivamente `init_point`; no migrar columnas históricas ni borrar datos para silenciar una búsqueda textual.
- No se inspeccionaron las credenciales desplegadas. Las comprobaciones locales y las fixtures no certifican el ambiente publicado.
- No se verificó visualmente el retorno/flujo en un navegador: el puente autorizado del navegador integrado está indisponible.
- Una ejecución intermedia devolvió 503 de inventario y no conservó su código de error. No se afirma una causa o corrección retrospectiva: no se reprodujo en las dos corridas siguientes, incluida la final correcta. La nueva instrumentación registra solo códigos aprobados y tiempos, sin datos de sesión.

### PASS

- El navegador no envía monto, seller ni comisión; la preparación y el split proceden del contrato servidor congelado.
- Se valida actor explícito en el flujo nuevo, además de sesión, pertenencia y Origin.
- El retorno de Mercado Pago no acredita un pago por querystring. Se consulta el recurso canónico y el checkout persistido.
- Ambos workers canónicos devuelven el estado realmente persistido después de los guards SQL; no anuncian una visita aprobada si el guard cambia el checkout a revisión.
- Padres financieros FK fijados antes de locks job → checkout en los coordinadores canónicos, con nueva comprobación de identidad completa. La prueba unitaria de orden no sustituye una carrera real de PostgreSQL.
- No se realizaron pagos, renovaciones OAuth ni llamadas reales al proveedor durante estas pruebas.
- Acceso Owner aislado verificado con `scripts/supabase-lysto.cmd`: `SELECT 1`, usuario/base `postgres`. Migración propia aplicada atómicamente y registrada; cinco tablas privadas con RLS.
- Harness ampliado: 70 comprobaciones SQL correctas después de aplicar, incluyendo roles `service_role`, `authenticated`/AAL2 y `lysto_marketplace`. Nueva ejecución y consulta independiente posterior confirman cero fixtures persistidas, membresías administrativas restauradas exactamente y política comercial todavía deshabilitada.
- Advisors antes/después: 75 advertencias preexistentes, cero errores y ninguna advertencia nueva.
- Reparto bruto comprobado sin reservas de procesamiento, incluso con tasa heredada 6%. Cargos observados reales de proveedor permanecen separados y no modifican el presupuesto congelado.
- Cuatro recorridos completos del formulario y recorrido HTTP/coordinador/SDK/ledger con fronteras externas simuladas: calculador real, una sola preparación/preferencia, recuperación del mismo servicio y retorno únicamente canónico.
- Cinco carreras PostgreSQL reales en QA con PIDs distintos y bloqueo observable: mismo comando, comandos distintos sobre una preview, clientes compitiendo por el mismo cupo y ambos órdenes entre expiración y aprobación. Las aprobaciones financieras son fixtures del trigger SQL, no pagos del proveedor.
- 17 comprobaciones reales Auth/SSR/Next/PostgREST correctas, incluido conflicto 409 e inventario separado por cliente. La preview devuelve `tariffs_unapproved` real sin preparar contrato ni llamar al proveedor; no es un checkout exitoso.
- Preview/prepare validan el origen público configurado, no un host interno reconstruido o una cabecera reenviada. TDD de proxy y spoofing; 17/17 pruebas API y 39/39 ampliadas correctas, controles de actor/sesión/pertenencia/origen conservados.
- Teardown final verificado: ambos logouts reales correctos, consulta independiente con cero sesiones, dos Auth DELETE exactos con cascadas ausentes y restauración completa de QA. Histórico de 412 buckets con hash idéntico; resultados fallidos anteriores conservados con recibos separados.

### Quality Standards

Not requested for this scope. No se consultaron criterios oficiales ni se calcularon puntajes de calidad/homologación.

#### Required fields

Not requested for this scope.

#### Best practices

Not requested for this scope.

### Security checklist (cross-cutting)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tokens nunca hardcodeados | Implemented | `marketplaceStorage` lee la conexión privada del entorno; OAuth usa `TokenCipher`. Las coincidencias `TEST-` del código son validaciones de modo, no credenciales. |
| 2 | `.env` ignorado, `.env.example` permitido | Implemented | Excepción final de `.gitignore`; regresión real `git check-ignore --no-index` RED → GREEN. |
| 3 | Autenticación de webhook | Implemented | Gateway del SDK verifica firma antes de recursos canónicos; Orders valida HMAC-SHA256 en `orders.ts`. IPN alternativo requiere token HMAC propio ligado al checkout y vuelve a consultar al proveedor. |
| 4 | URLs de pago HTTPS | Implemented | `marketplaceConfig` rechaza origen no HTTPS; proveedor fijo HTTPS y URL de Orders validada. |
| 5 | Estado verificado servidor tras redirect | Implemented | `reconcileCheckout` obtiene `/v1/payments/{id}` o `/v1/orders/{id}`; UI lee checkout canónico, nunca `pago=retorno` como acreditación. |
| 6 | Idempotencia en creación | Implemented | `providerJson` transmite `X-Idempotency-Key`; Preferences y Orders conservan clave de su checkout. |
| 7 | `external_reference` estable | Implemented | `claimCheckout`, `buildOrderPayload` e inspectores comparan referencia con el UUID congelado del checkout. |
| 8 | Credenciales de prueba fuera de despliegue real | Partial | Fixtures separadas y comprobaciones de modo existentes; no se inspeccionó el despliegue ni se probó un pago real. |
| 9 | No utilizar `sandbox_init_point` | Partial | Redirección nueva corregida y cubierta por tests; la propiedad todavía se conserva sin usarse como URL en almacenamiento histórico. |

### Recommendations

- Usar siempre el comando Owner aislado. No volver al perfil global ni considerar que el fallo MCP invalida el acceso CLI verificado.
- Completar el recorrido exitoso de contratación/pago/proveedor en un ambiente aislado. La prueba parcial Auth/HTTP ya pasó; las carreras PostgreSQL y los coordinadores simulados no certifican un pago real del proveedor.
- Obtener aprobación comercial explícita del alcance inicial y la agenda antes de activar la política; no usar fixtures como tarifa real.
- Completar E2E y QA visual en el navegador integrado, sin navegador personal ni Docker.

**Summary**: Official quality: not requested. 7/9 security checks pass; 2 partial.

---

## Implementation Report

### Verified

- [x] Redirección `init_point`, modo de pago y actor: 36 pruebas enfocadas aprobadas.
- [x] Persistencia canónica/orden de locks: 20 regresiones nuevas aprobadas, incluidas aprobación normal, review persistido, padres financieros, cambio de identidad y falta de fila actualizada.
- [x] Contrato de Payments/Orders y frontera de red: 33 pruebas aprobadas en la ejecución conjunta con el ledger nuevo.
- [x] `.env.example` permitido sin exponer `.env` ni archivos privados: regresión RED → GREEN.
- [x] Inspección local de firma, referencias, HTTPS, idempotencia y ausencia de credenciales hardcodeadas.
- [x] Regresión global final: 1.500/1.500 pruebas unitarias en 183 archivos, cero omitidas; 174/174 de dominio, TypeScript sin incremental, lint global y build de 103 páginas correctos. Las unitarias no incluyen PostgreSQL externo ni cobros reales.
- [x] Migraciones PostgreSQL reales aplicadas transaccionalmente después de probarlas con rollback; registros `20261014023946` y `20261014213321`, funciones/permisos y cinco tablas RLS verificados.
- [x] 70 comprobaciones PostgreSQL/RPC correctas con roles reales; rollback confirmado mediante consulta independiente, cero usuarios/previews/contratos sintéticos persistidos y membresía Owner sin cambios.
- [x] Regresiones de permisos del nuevo OID, row locks y precedencia JSONB reproducidas antes de corregir; 16 guardas locales correctas.
- [x] Advisors reales: cero errores; 75 advertencias preexistentes, ninguna nueva tras la migración.
- [x] Revisión independiente final de recuperación y recorridos: 54/54 casos frescos, especificación/calidad aprobadas; corregido el borrado de un pendiente nuevo por un reintento viejo.
- [x] Cinco carreras multiconexión reales en QA, incluidas expiración→aprobación y aprobación→expiración; reparto congelado 18%/82% verificado. No equivalen a acreditación Mercado Pago.
- [x] Limpieza de QA completada mediante API oficial de Storage para el único objeto propio y SQL transaccional para el resto. Consulta independiente confirma cero fixtures y restauración exacta de permisos, owners, membresías, RLS y políticas. Ningún secreto persistido ni protección de Storage desactivada.
- [x] 157/157 guardas de tooling correctas; staging rechaza producción/default link, valida manifiesto e impide limpieza automática tras resultado incierto. 21 casos locales de concurrencia y 27 del runner parcial Auth/HTTP; recuperaciones acotadas revisadas independientemente. Los tests locales del runner no sustituyen su ejecución remota.
- [x] Ejecución real parcial `4642522b-d042-4466-8f7d-2ed8fe825399`: 17/17, salida 0, manifiesto `cleaned`, incertidumbre vacía. Snapshot Owner independiente idéntico al baseline de 79 migraciones; cero fixtures y 412 buckets históricos intactos. No proveedor ni tarifa ficticia habilitada.
- [x] Corrección `PT409` con guardas de preimagen/metadatos: QA aplicada, producción probada junto con 70 casos en ROLLBACK y huella de funciones/membresía exactamente restituida. No se modificaron errores de serialización genuinos del motor.

### Needs attention

- [ ] Revisar la representación histórica de `sandbox_init_point` en `lib/payments/marketplace.ts:202`; no se usa para redirigir el flujo nuevo.
- [ ] Verificación visual y E2E reales pendientes; no presentar mocks del coordinador como confirmación de pago del proveedor.
- [ ] Homologación y calidad oficial no solicitadas ni verificadas para este cambio. No se afirma certificación de Mercado Pago.

### Blockers (must fix before production)

- [ ] Recorrido exitoso de contratación/pago/proveedor y E2E/visual completos en entorno aislado, incluidas fotos y ruta reales; la prueba parcial Auth/HTTP y las aprobaciones financieras SQL no los sustituyen.
- [ ] Política de alcance inicial/agenda real aprobada y vigente antes de habilitar pagos automáticos.
- [ ] Publicar la migración `20261014235503` junto con los adaptadores que reconocen `PT409`, nunca por separado de la versión compatible de la aplicación.

### Next steps

1. Aprobar el tarifario real y la política de alcance inicial/duración/agenda; 18%/82% ya está confirmado y no se incluye una reserva estimada de Mercado Pago. No habilitar el rollout con referencias no aprobadas o fixtures de prueba.
2. Completar el recorrido de contratación exitosa/pago/proveedor y E2E/visual antes de desplegar; la concurrencia SQL y la prueba parcial Auth/HTTP ya se ejecutaron en QA. Preparar el release conjunto de migración y adaptadores `PT409`.
3. Re-run the `mp-review` skill after fixes to confirm the report.

### Resources used

- Local: codebase inspection + cross-cutting security floor + cuatro recorridos UI y pruebas de coordinadores sin proveedor real.
- Supabase: CLI Owner aislada, migraciones transaccionales, 70 casos rollback/RPC/roles, cinco carreras reales, 17 comprobaciones Auth/HTTP y restauración independiente de QA, advisors, 2026-10-14; sin llamadas ni cobros Mercado Pago.
- Skill: `mp-review` v1.0.0.

**Scores**: official quality: N/A, 7/9 security. **Verdict**: Blocked.
