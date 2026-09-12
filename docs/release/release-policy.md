# Política verificable de releases

Estado: implementación local de T33; pendiente la ejecución en GitHub del candidato definitivo y la configuración real de protecciones. Una compilación local, este documento o un archivo de avance no autorizan clientes reales.

## Catálogo y objetivos

`lib/release/release-gates.ts` define G01–G16 del anexo de aceptación. Todos deben figurar exactamente una vez. `technical` exige G01–G13, `pilot` G01–G15 y `general` G01–G16. Los gates posteriores al objetivo pueden estar pendientes; nunca se omiten. Un estado desconocido, duplicado o una evidencia inválida bloquea la evaluación. No existe un catálogo opcional provisto por el solicitante.

Cada manifest contiene `schemaVersion: 1`, `releaseId`, commit completo de 40 caracteres, `migrationSetHash` SHA-256, entorno objetivo (`staging` o `production`) y `gates`. Cada gate contiene `id`, `status` y un arreglo `evidence`. Cada evidencia incluye los mismos identificadores, `executionEnvironment`, fecha ISO `recordedAt`, comando, `exitCode`, `kind`, artefacto relativo con SHA-256 y contadores `passed`, `failed`, `skipped`. Se exige al menos un caso o comprobación real, cero errores y cero omitidos. Los artefactos se conservan fuera de secretos y de datos personales.

`environment` identifica el candidato que se quiere promover; `executionEnvironment` identifica dónde ocurrió la prueba. El catálogo permite DB descartable para migraciones/restauración, CI para fuente, staging para proveedor y producción para piloto. Esto permite restauraciones aisladas sin atribuir una prueba de otro entorno al candidato actual.

Vigencia conservadora: 72 horas para evidencia y 30 días para restauración, siempre sobre el mismo commit y conjunto de migraciones. Estos valores implementan la propuesta D10; la aprobación humana de esa política sigue pendiente. Un cambio incompatible invalida la evidencia de restauración por el cambio del hash. No hay reutilización automática de pruebas de otro commit. El estado `passed` es necesario pero insuficiente: el evaluador deriva la decisión al verificar metadatos y artefactos.

## Evidencia humana y del proveedor

G10 exige aprobación de móvil real; G12 aprobación de capacidad/costo; G13 aceptación de RPO/RTO; G14 confirmación del proveedor; G15 autorización de lanzamiento; G16 aceptación del piloto y mantenimiento. Estos requisitos se agregan a las pruebas automatizadas cuando corresponde.

Cada evidencia externa contiene `attestation` con `keyId`, `approver`, referencia HTTPS verificable y firma Ed25519. La firma cubre el gate y todo el contenido de la evidencia, excepto el propio campo `signature`, con claves JSON ordenadas recursivamente. El aprobador firma después de revisar el artefacto identificado por su hash. No se proporcionan claves privadas ni una herramienta que firme por el operador. Los tests usan claves efímeras ficticias exclusivamente en memoria.

La política de confianza es un JSON externo al checkout, suministrado por el entorno protegido de release: `{"keys":[{"id":"...","approver":"...","kind":"human","gates":["G10"],"publicKey":"PEM Ed25519"}]}`. Cada clave autoriza un responsable, un tipo (`human`, `provider` o `automated`) y gates concretos. Una clave humana no puede autenticar una ejecución automatizada. Una clave pública arbitraria suministrada por el autor del PR no constituye aprobación: el job de promoción debe tomar esta política del entorno protegido, cuya administración corresponde a dirección/operaciones. Cambiar el commit, el gate, el artefacto o el responsable invalida la firma. Una referencia y un booleano escritos por el agente no aprueban nada.

## Evidencia automatizada autenticada

El artefacto de una evidencia `automated` debe ser un registro JSON con `schemaVersion: 1`, `type: "lysto.execution"`, `gateId`, `releaseId`, `commit`, `migrationSetHash`, `environment`, `executionEnvironment`, `recordedAt`, `command`, `exitCode` y `report`. Los identificadores, fecha, comando y resultado deben coincidir exactamente con el manifest. `report` contiene `format` (`vitest`, `playwright` o `checks`), ruta relativa del reporte original y SHA-256; ambos archivos se verifican dentro del directorio de evidencias.

Los contadores se derivan del reporte original. Vitest requiere suites y casos realmente aprobados, coincidentes con sus totales, sin skips/todos/fallos. Playwright requiere resultados ejecutados y consistentes. Un reporte `checks` requiere una lista no vacía, IDs únicos y, en cada elemento, comando no vacío, `exitCode: 0` y `status: "passed"`. Un `{}`, texto libre, reporte fallido o registro de otra versión no puede respaldar un gate aunque su hash sea correcto.

Además se exige `attestation` en la evidencia automatizada, con el mismo formato y firma descritos arriba, pero emitida por una identidad CI autorizada con `kind: "automated"`. La firma cubre el hash del registro, que a su vez vincula el reporte original. Dos JSON escritos por el autor no demuestran procedencia. **Pendiente externo:** integrar un job protegido que verifique el run y sus artefactos y autentique ese registro; el workflow actual produce reportes sin firmar. Ningún PR recibe la clave de firma y este cambio no crea claves ni simula esa autenticación. Hasta disponer de ella, los gates automatizados permanecen bloqueados para promoción.

## Uso del verificador

El inventario de un candidato se genera desde un checkout limpio con `pnpm release:manifest -- --release-id <id> --environment <staging|production> --output output/release/<id>/manifest.json`. El generador fija commit y hash de migraciones, incluye G01–G16 exactamente una vez y lo marca `NO_GO`; no recoge evidencia, firma ni concede aprobación.

Registrar los scripts `release:check` (`node scripts/check-release-evidence.mjs`) y `test:e2e:staging` (`node scripts/test-e2e-staging.mjs`). El verificador exige manifest, objetivo, ID de release, entorno y archivo externo de confianza; compara commit y migraciones con el checkout limpio actual y comprueba cada artefacto dentro del directorio del manifest. No sigue rutas absolutas ni enlaces que escapen de ese directorio.

```text
pnpm release:check --manifest /evidence/candidate/manifest.json --target technical --release-id candidate-id --environment staging --trust-policy /protected/release-trust.json
node scripts/check-release-evidence.mjs --self-test-blocking
```

El segundo comando es una prueba negativa: exige que un manifest incompleto sea rechazado. Su éxito prueba el bloqueo, nunca habilita una release.

## CI y procedencia

La CI reconstruye en Ubuntu 24.04 y Node 22.23.2 con instalación congelada. Corre lint, tipos, dominio, unitarias, auditoría productiva, runtimes de pagos/imágenes, Supabase desde cero, pgTAP, lint SQL, comparación de tipos, integración obligatoria con Auth/DB reales, build y E2E con Chromium/WebKit. Conserva artefactos asociados a `github.sha` durante 14 días. El proyecto de Supabase se crea en un directorio nuevo bajo el temporal del runner, con puertos 54321/54322 e identidad `lysto_integration_ci`; se detiene únicamente ese proyecto. Los PR no reciben secretos de proveedores ni de staging/producción.

El inventario de código conserva páginas, APIs, referencias demo, hash de lock/vendor/migraciones y commit. Las referencias demo quedan para revisión de T29: la mera existencia de un inventario no aprueba G09. Los reportes de CI tampoco sustituyen ensayo de upgrade, escaneo completo de secretos, runtime desplegado, matriz del proveedor, UAT, restauración o piloto. T34 incorpora sus suites cuando existan; el runner staging exige la lista completa y rechaza cero pruebas. La CI temprana ejecuta las suites existentes, sin afirmar cobertura de suites futuras.

La compilación de producción ocurre dentro del servidor de E2E con `LYSTO_E2E_PRODUCTION=1`, después de leer y validar la identidad del Supabase descartable e inyectar sus variables. Si falla la compilación, no se inicia el servidor ni puede pasar E2E. Se evita una compilación previa con variables incompletas; el mismo control de entorno protege compilación y ejecución. La preparación de la base copia también las plantillas Auth de `supabase/templates` cuando existen y conserva el resto de la configuración del candidato.

Pins comprobados contra tags de repositorios oficiales el 2026-09-11:

| Acción | Versión | Commit |
| --- | --- | --- |
| [Checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | 7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [Setup Node](https://github.com/actions/setup-node/releases/tag/v7.0.0) | 7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
| [Setup pnpm](https://github.com/pnpm/action-setup/releases/tag/v6.0.8) | 6.0.8 | `d15e628ca66d93ee5f352c71671a7bc6a97af5c9` |
| [Upload artifact](https://github.com/actions/upload-artifact/releases/tag/v4.6.2) | 4.6.2 | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

## Staging

El runner exige `APP_ENV=staging`, `MERCADOPAGO_MODE=test`, origen HTTPS exacto, project ref Supabase exacto y un archivo de identidad permitido que declara `production: false` y recursos/cuentas de QA. Ese archivo debe ser administrado como configuración protegida del ambiente; no se acepta como permiso una URL que contiene la palabra staging. No recibe flags de Playwright arbitrarios ni permite seleccionar una suite reducida. `--list` comprueba que existan todos los archivos T34 y al menos una prueba por cada combinación de archivo obligatorio y proyecto (`chromium-desktop`, `chromium-mobile`, `webkit-mobile`). La ejecución exige esas mismas identidades de caso, archivo y proyecto, sin duplicados, skips, errores ni casos sin ejecutar. Archivos vacíos acompañados de una prueba antigua no satisfacen el requisito. Genera una configuración temporal sin servidor local, para probar el despliegue identificado.

## Configuración externa pendiente

Para cerrar T33 se debe ejecutar el workflow en GitHub, conservar URL del run del commit candidato y comprobar un fallo real ante evidencia incompleta. Configurar en las reglas de `main` los checks obligatorios `Quality gates (Ubuntu)` y `Domain tests (Windows)`, revisión obligatoria del cambio, prohibición de force push y actualización de checks al cambiar la base. El proceso que promueva a staging/producción debe exigir el resultado del verificador para el objetivo correspondiente, tomar la confianza desde un entorno protegido y requerir responsables distintos del autor del cambio para los gates externos. Este repositorio no incluye un despliegue automático ni modifica reglas remotas. Hasta verificar esas protecciones, T33 permanece parcialmente implementada.

## Promoción a producción

El objetivo `pilot` validado es condición necesaria, pero la activación además requiere el acta GO firmada, backup verificado, artefacto exacto, ventana y operadores disponibles. El despliegue comienza con solicitudes y checkouts nuevos desactivados. La prueba financiera real necesita una autorización separada con importe y destinatarios. La ampliación general exige objetivo `general`, incluido G16 con resultados del piloto y traspaso de mantenimiento.
