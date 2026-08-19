# Lysto MVP Operativo — Diseño funcional y técnico

**Estado:** aprobado  
**Fecha:** 19 de agosto de 2026  
**Ámbito inicial:** CABA y corredor sur de la Provincia de Buenos Aires, con foco inicial en Berazategui, Hudson y barrios privados cercanos  
**Servicio inicial:** aire acondicionado

## 1. Propósito del producto

Lysto será una plataforma web responsive y mobile-first que permita contratar y operar servicios técnicos de punta a punta. Su propuesta no es limitarse a publicar profesionales: Lysto selecciona, verifica, coordina y controla la calidad del servicio, ofreciendo respaldo tanto al cliente como al profesional independiente.

El MVP debe validar el modelo de negocio completo. No es una demo, una landing con formulario ni un marketplace abierto. Es la primera versión operativa de una empresa de servicios gestionada mediante tecnología de marketplace.

La primera categoría será aire acondicionado. La arquitectura permitirá agregar otras categorías en el futuro sin diseñar todavía flujos específicos para plomería, electricidad u otros oficios.

## 2. Objetivos

- Permitir que un cliente solicite, pague, siga y evalúe un servicio.
- Brindar una experiencia de confianza antes, durante y después de recibir a un profesional en el domicilio.
- Incorporar profesionales únicamente por invitación y aprobación de Lysto.
- Dar al profesional herramientas para aceptar, ejecutar, documentar y cerrar trabajos.
- Permitir que el equipo de Lysto controle solicitudes, matching, precios, pagos, calidad y excepciones.
- Construir historial técnico por equipo para mejorar futuras visitas y mantenimiento.
- Validar el modelo comercial en una zona geográfica limitada antes de escalar.

## 3. Principios del MVP

1. **Operación gestionada:** Lysto conserva control sobre la asignación y las excepciones.
2. **Confianza por diseño:** identidad, matrícula, documentación, trazabilidad, pago protegido, garantía y calidad forman parte del flujo.
3. **Todos los profesionales deben estar verificados:** las modalidades Flexible y Prioridad cambian velocidad y comodidad, no la calidad del profesional.
4. **Reglas configurables:** precios, zonas, diagnóstico, comisión, tiempos y prioridades no se fijan en el código.
5. **Seguridad por defecto:** datos y archivos privados, permisos por rol, auditoría y mínimo acceso necesario.
6. **Arquitectura modular:** comenzar con un monolito modular para avanzar rápido sin mezclar reglas de negocio con pantallas o proveedores externos.
7. **Evolución sin reescritura:** pagos, diagnóstico, notificaciones y ubicación se conectan mediante adaptadores sustituibles.

## 4. Alcance obligatorio

### 4.1 Sitio público

- Inicio y presentación de Lysto.
- Servicio disponible: aire acondicionado.
- Beneficios: profesionales verificados, pago protegido, garantía y seguimiento.
- Explicación de cómo funciona.
- Preguntas frecuentes.
- Llamadas a la acción para solicitar servicio e ingresar.
- Términos, privacidad, condiciones del servicio y contacto de soporte.

### 4.2 Identidad y cuenta del cliente

- Registro, ingreso y recuperación de contraseña.
- Aceptación versionada de términos y política de privacidad.
- Perfil con nombre, apellido, correo y teléfono.
- Direcciones guardadas.
- Solicitudes, trabajos, equipos y comprobantes.

### 4.3 Solicitud de servicio

El wizard debe guardar un borrador después de cada paso y permitir retomarlo.

1. Selección del problema:
   - No enfría.
   - Pierde agua.
   - Hace ruido.
   - No enciende.
   - No funciona calor.
   - Instalación.
   - Mantenimiento.
   - Otro problema, configurable si se habilita.
2. Detalles adicionales:
   - Antigüedad: hoy, hace días, semanas o meses.
   - Respuestas a preguntas configurables según el problema.
   - Hasta 10 fotos opcionales, 10 MB cada una.
   - Un video opcional, hasta 30 MB.
3. Diagnóstico preliminar:
   - Resumen prudente para el cliente.
   - Posibles causas, nivel de coincidencia y revisión sugerida para profesional y administración.
   - Aviso explícito de que no sustituye el diagnóstico presencial.
4. Dirección:
   - Calle, número, piso, departamento, localidad/barrio y provincia.
   - Código postal y referencias opcionales.
   - Casa, departamento, local, oficina u otro.
   - Ascensor, estacionamiento, escaleras, altura, balcón y acceso complicado.
   - Reutilización de direcciones anteriores.
5. Fecha y franja horaria:
   - Hoy, mañana u otra fecha habilitada.
   - Franjas configurables, inicialmente 08–10, 10–12, 14–16, 16–18 y 18–20.
6. Presupuesto preliminar:
   - Modalidad Flexible.
   - Modalidad Prioridad.
   - Alcance incluido, estimación, condiciones y aclaración sobre el presupuesto final.
7. Pago de la visita o diagnóstico.
8. Matching y confirmación del profesional.

### 4.4 Diagnóstico preliminar

El MVP usará una matriz de reglas estructurada, con opción de generar un resumen mediante IA. Las reglas y sus resultados son la fuente de verdad; una IA no debe autorizar trabajos, decidir precios ni inventar certeza clínica.

Se guardarán:

- Problema informado y respuestas.
- Posibles causas ordenadas.
- Nivel de coincidencia.
- Lista de controles recomendados.
- Texto mostrado al cliente.
- Versión de reglas o modelo utilizado.
- Fecha y trazabilidad de generación.

### 4.5 Precios y modalidades

Para el lanzamiento inicial se cobrará por adelantado la visita o el diagnóstico. El profesional confirmará en domicilio el alcance y el presupuesto final de la reparación. La estrategia debe poder cambiar en el futuro a cobro total estimado sin rehacer solicitudes ni pagos.

La fórmula será configurable:

```text
precio =
  precio_base
  ajuste_por_problema
  ajuste_por_zona
  ajuste_por_acceso
  ajuste_por_fecha_y_horario
  ajuste_por_modalidad
```

La comisión de Lysto y la distribución económica se calculan y registran aparte del precio comercial.

**Flexible** será la opción más económica, con ventana más amplia y asignación según disponibilidad. **Prioridad** tendrá mayor precio porque ofrece prioridad de asignación y una llegada más cercana a la fecha y franja solicitadas. Ambas incluyen profesionales aprobados, pago protegido y garantía Lysto.

Administración podrá configurar vigencias, zonas, montos base, ajustes, multiplicadores, comisión y condiciones sin desplegar código.

### 4.6 Pagos con Mercado Pago

Mercado Pago será un módulo desacoplado del trabajo. Para el lanzamiento comercial, la meta obligatoria es Split 1:1 del marketplace, mediante vinculación OAuth de la cuenta de cada profesional y las capacidades vigentes de Mercado Pago.

El sistema debe registrar siempre:

- Monto cobrado al cliente.
- Moneda.
- Comisión Lysto.
- Monto correspondiente al profesional.
- Cargos del proveedor cuando estén disponibles.
- Identificadores externos.
- Estado del pago, distribución, liquidación, reembolso y disputa.
- Eventos recibidos y su procesamiento.

Los webhooks y operaciones de pago o reembolso serán autenticados, auditados e idempotentes. Un evento repetido no podrá duplicar cobros, devoluciones ni cambios de estado.

Durante el desarrollo se utilizará un adaptador simulado y luego el entorno de prueba de Mercado Pago. El sistema podrá avanzar aunque la autenticación del MCP de Mercado Pago no esté disponible. No podrá declararse listo para comercialización hasta validar el circuito real autorizado, los reembolsos y la conciliación.

El split ayuda al flujo de fondos y a la conciliación, pero no define por sí solo el tratamiento fiscal. Antes del lanzamiento comercial, contador y asesor legal en Argentina deben validar facturación, impuestos, comprobantes, términos, retenciones y relación contractual con los profesionales.

### 4.7 Matching y asignación

El matching del MVP será **ranking automático de candidatos más confirmación administrativa**.

Los criterios iniciales serán:

- Estado aprobado.
- Especialidad.
- Zona de cobertura.
- Disponibilidad.
- Matrícula y documentación vigentes.
- Herramientas necesarias.
- Cercanía aproximada.
- Cantidad de trabajos.
- Calificación.
- Tasa de aceptación.
- Puntualidad y resolución.
- Score interno y alertas de calidad.

Para profesionales nuevos se usará un puntaje inicial neutral basado en verificación, especialidad, herramientas, zona y disponibilidad; no se los castigará por no tener reseñas.

El sistema mostrará la lista explicable de candidatos. Administración confirmará o modificará la asignación. Si un profesional rechaza o vence el tiempo de aceptación, se podrá pasar al siguiente candidato o reasignar manualmente.

### 4.8 Seguimiento del cliente

El cliente verá una línea de tiempo operativa:

- Pago recibido.
- Buscando profesional.
- Profesional confirmado.
- En camino.
- Llegó al domicilio.
- Diagnóstico en curso.
- Presupuesto final disponible.
- Presupuesto aprobado o rechazado.
- Trabajo en curso.
- Trabajo finalizado.
- Pendiente de confirmación.
- Completado.

El MVP no promete GPS permanente tipo Uber. El profesional indicará que salió, podrá compartir ubicación aproximada cuando corresponda y se mostrará un horario estimado calculado o administrado. La arquitectura permitirá incorporar seguimiento avanzado más adelante.

### 4.9 Portal profesional

No habrá registro público. Administración enviará invitaciones únicas y con vencimiento.

El onboarding incluirá:

- Nombre, apellido, correo, teléfono, DNI, CUIL y fecha de nacimiento.
- Foto y dirección base.
- Zonas de trabajo y disponibilidad.
- Años de experiencia, especialidades, matrícula y documentación.
- Movilidad y herramientas.
- Bio breve.
- Cuenta de Mercado Pago vinculada.
- Aceptaciones contractuales y de privacidad.

Herramientas iniciales para aire acondicionado:

- Bomba de vacío, manifold, balanza digital, multímetro y pinza amperométrica.
- Detector de fugas, termómetro y equipo de limpieza.
- Escalera, taladro, cortatubo, pestañadora y herramientas manuales.
- Elementos de seguridad y movilidad propia.

Estados del profesional:

```text
invited → form_started → form_submitted → under_review → approved
                                                   ↘ rejected
approved → suspended | inactive
```

Solo un profesional aprobado, habilitado y con requisitos vigentes puede recibir trabajos.

El portal permitirá:

- Ver agenda, solicitudes, trabajos actuales e historial.
- Aceptar, rechazar o pedir revisión administrativa.
- Consultar diagnóstico preliminar, archivos, acceso, horario y condiciones económicas.
- Marcar llegada y estados del servicio.
- Registrar equipo, diagnóstico real, presupuesto final, trabajo, repuestos y evidencias.
- Cerrar el servicio con resultado estructurado.
- Ver sus pagos y liquidaciones.
- Administrar perfil, disponibilidad y documentos.
- Acceder a soporte y métricas básicas.

### 4.10 Equipos e historial técnico

Cada equipo puede registrar:

- Cliente, dirección y ambiente.
- Nombre reconocible, por ejemplo “aire del living”.
- Tipo: split, inverter, on/off, ventana, piso-techo o central.
- Marca, modelo, frigorías y número de serie cuando se conozcan.
- Fotos de unidades interior y exterior.
- Observaciones.

Los trabajos se vincularán al equipo para construir un historial cronológico de problemas, diagnósticos, reparaciones, repuestos, evidencias, garantías y mantenimientos.

### 4.11 Presupuesto final y cierre técnico

Después del diagnóstico presencial, el profesional cargará un presupuesto final estructurado. El cliente debe aprobarlo antes de comenzar trabajos adicionales cobrables. Un rechazo no puede interpretarse como aprobación ni cerrar automáticamente una reparación.

El cierre incluirá:

- Diagnóstico real.
- Trabajo realizado.
- Repuestos utilizados.
- Fotos posteriores.
- Resultado: resuelto, resuelto parcialmente, pendiente de repuesto, segunda visita o no resuelto.
- Garantía aplicable.
- Observaciones internas y para el cliente.
- Recomendación de mantenimiento mediante opciones estructuradas.

Opciones iniciales de mantenimiento:

- Sin mantenimiento recomendado.
- Limpieza de filtros en 30, 60 o 90 días.
- Limpieza profunda en 6 o 12 meses.
- Revisión de gas en 30 días.
- Revisión de unidad exterior.
- Revisión eléctrica.
- Cambio de repuesto pendiente.
- Segunda visita recomendada.

### 4.12 Comprobante y QR

Cada cierre genera un comprobante accesible desde la cuenta del cliente y mediante un QR. La ruta pública será `/comprobante/[token]`.

El token debe ser aleatorio, no predecible, revocable y susceptible de vencimiento. La vista pública mostrará el mínimo de datos personales: identificador, fecha, profesional, equipo, trabajo, resultado, garantía, próximo mantenimiento y soporte Lysto.

### 4.13 Review, garantía y calidad

Después del cierre, el cliente podrá responder:

- Calificación del servicio.
- Calificación del profesional.
- Comentario opcional.
- Si el problema quedó resuelto.
- Si volvería a contratar Lysto.
- Si desea recordatorio de mantenimiento.

Las respuestas alimentarán métricas de calidad y matching. El sistema deberá contemplar garantías, reclamos, reaperturas, disputas y seguimiento administrativo.

### 4.14 Administración

El panel administrativo será una herramienta operativa, no solo informativa.

- **Profesionales:** invitaciones, revisión, aprobación, suspensión, documentos, herramientas, zonas, disponibilidad, cuenta de pago, métricas e historial.
- **Clientes:** perfil, direcciones, solicitudes, trabajos, equipos, reviews y reclamos.
- **Solicitudes y matching:** diagnóstico, archivos, horario, precio, pago, candidatos, asignación, reasignación, cancelación y excepciones.
- **Trabajos:** agenda, estados, línea de tiempo, presupuesto, cierre, comprobante y review.
- **Pagos:** cobros, comisión, monto profesional, liquidación, eventos, reembolsos y disputas.
- **Catálogo y precios:** servicios, problemas, preguntas, reglas, zonas, tarifas, modalidades y comisión.
- **Calidad:** reviews, garantías, reclamos, reaperturas, puntualidad, aceptación y resolución.
- **Auditoría:** acciones sensibles, actor, fecha, motivo y valores relevantes antes y después.

El rol administrador tendrá subpermisos iniciales de operaciones, finanzas, calidad y propietario. Esto evita otorgar acceso financiero o de configuración a todo el personal operativo.

## 5. Arquitectura

### 5.1 Enfoque

Se construirá un **monolito modular** con Next.js App Router y TypeScript. Es la opción recomendada para avanzar rápido con un equipo pequeño, mantener una única publicación y conservar límites claros entre dominios. No se crearán microservicios en el MVP.

Las pantallas no accederán libremente a tablas ni contendrán reglas centrales de negocio. Las operaciones pasarán por servicios de aplicación y funciones de dominio que validen permisos, estado e invariantes.

### 5.2 Áreas de rutas

- Rutas públicas y landing.
- `/app`: cliente.
- `/pro`: profesional.
- `/admin`: administración.
- `/comprobante/[token]`: comprobante público limitado.
- Endpoints internos para operaciones, webhooks e integraciones.

### 5.3 Módulos de dominio

- `auth` y perfiles.
- `catalog` y configuración.
- `service-requests`.
- `diagnosis`.
- `pricing`.
- `matching`.
- `jobs` y línea de tiempo.
- `equipment` e historial.
- `payments` y conciliación.
- `reviews`, garantías y calidad.
- `notifications`.
- `audit`.

Cada módulo expondrá operaciones explícitas y no dependerá directamente de componentes visuales. Mercado Pago, IA, correo, WhatsApp y mapas se implementarán mediante interfaces/adaptadores.

### 5.4 Infraestructura

**Railway** alojará la aplicación Next.js, endpoints, webhooks y tareas en segundo plano. La aplicación será stateless: no guardará archivos ni estado persistente en el disco de Railway. Podrá escalar verticalmente al inicio y con múltiples réplicas cuando el tráfico lo requiera.

**Supabase** concentrará:

- Auth.
- PostgreSQL.
- Storage.
- Row Level Security.
- Funciones o tareas gestionadas cuando sean convenientes.

No se agregará otra base de datos ni un volumen persistente en Railway durante el MVP. La conexión a PostgreSQL usará pooling apropiado para cargas serverless o múltiples réplicas.

**GitHub** será la fuente de verdad del código y disparará validaciones y despliegues. Existirán ambientes separados de desarrollo, staging y producción, con credenciales y datos independientes.

### 5.5 Escalabilidad y sostenibilidad

La arquitectura es suficiente para el piloto y para crecer si se mantienen estas reglas:

- Aplicación sin estado local persistente.
- Consultas paginadas e índices según accesos reales.
- Operaciones lentas y reintentos fuera de las respuestas interactivas.
- Webhooks y tareas idempotentes.
- Límites de carga, formatos y retención de archivos.
- Observabilidad, alertas y métricas desde staging.
- Separación de datos operativos, eventos y archivos.
- Posibilidad posterior de aumentar capacidad de Supabase, usar réplicas de lectura y separar procesos sin cambiar el modelo funcional.

## 6. Modelo conceptual de datos

Los nombres definitivos se fijarán en el plan y las migraciones, pero el modelo debe cubrir:

### 6.1 Identidad

- Perfiles de usuario.
- Roles y permisos administrativos.
- Clientes.
- Profesionales.
- Invitaciones.
- Aceptaciones legales versionadas.

### 6.2 Profesionales

- Perfil profesional.
- Especialidades.
- Matrículas y documentos.
- Herramientas.
- Zonas.
- Disponibilidad.
- Evaluaciones y estados de aprobación.
- Cuenta de Mercado Pago.

### 6.3 Catálogo y configuración

- Categorías y servicios.
- Problemas y preguntas.
- Reglas y versiones de diagnóstico.
- Zonas de cobertura.
- Tarifas, ajustes, modalidades y comisiones con vigencia.

### 6.4 Solicitudes

- Solicitud y estado.
- Respuestas.
- Archivos.
- Dirección congelada para esa solicitud.
- Preferencias de fecha y horario.
- Diagnóstico preliminar.
- Cotizaciones preliminares y opción elegida.

### 6.5 Matching y trabajo

- Ejecuciones de matching.
- Candidatos, score y razones.
- Asignaciones y respuestas.
- Trabajo.
- Eventos de estado.
- Ubicación o ETA aproximada cuando se habilite.
- Presupuesto final y decisión del cliente.
- Cierre técnico.

### 6.6 Equipos

- Equipos.
- Archivos del equipo.
- Relación con trabajos.
- Eventos de historial.
- Recomendaciones de mantenimiento.

### 6.7 Finanzas

- Pagos.
- Eventos externos.
- Distribuciones, comisiones y liquidaciones.
- Reembolsos.
- Disputas.
- Conciliaciones y errores de procesamiento.

### 6.8 Calidad y soporte

- Reviews.
- Garantías.
- Reclamos y reaperturas.
- Notificaciones y entregas por canal.
- Auditoría.

## 7. Estados y reglas de transición

La fuente de verdad será una máquina de estados central. Ninguna pantalla podrá asignar un estado arbitrario.

Flujo principal consolidado:

```text
draft
→ pending_payment
→ payment_approved
→ matching
→ assigned
→ pending_professional_acceptance
→ confirmed
→ technician_on_way
→ arrived
→ diagnosis_in_progress
→ final_quote_pending_customer
→ final_quote_approved
→ in_progress
→ completed_pending_customer_confirmation
→ completed
```

Ramas controladas:

- Pago rechazado o vencido.
- Profesional rechaza o no responde.
- Reasignación.
- Sin profesionales disponibles.
- Presupuesto final rechazado.
- Pendiente de repuesto.
- Segunda visita.
- No resuelto.
- Cancelación.
- Reembolso.
- Disputa o reclamo.

Cada transición válida registrará actor, fecha, estado anterior, estado nuevo, origen, motivo y metadatos relevantes. Las acciones financieras y administrativas críticas exigirán idempotencia y auditoría.

## 8. Seguridad y permisos

### 8.1 Roles

- **Cliente:** accede a sus datos, direcciones, solicitudes, equipos, archivos y comprobantes.
- **Profesional:** accede a su perfil y a los datos estrictamente necesarios de trabajos asignados.
- **Administrador:** accede según subpermiso de operaciones, finanzas, calidad o propietario.

Los roles y autorizaciones sensibles residirán en metadatos protegidos o tablas controladas por servidor. Nunca se confiará en campos editables por el usuario.

### 8.2 Reglas obligatorias

- RLS habilitado en toda tabla expuesta por Supabase.
- Políticas explícitas por operación y rol.
- Clave de servicio exclusivamente en Railway y procesos seguros del servidor.
- Validación de entrada en servidor aunque exista validación visual.
- URLs firmadas y breves para archivos privados.
- Límite de intentos y protección contra abuso en autenticación, invitaciones, carga y endpoints sensibles.
- MFA obligatorio para administradores antes del lanzamiento comercial.
- Auditoría de cambios de roles, precios, asignaciones, estados, pagos, devoluciones y accesos sensibles.
- Funciones `security definer`, si fueran necesarias, ubicadas fuera de esquemas expuestos, con búsqueda de esquema segura y permisos mínimos.
- Tokens del comprobante aleatorios, revocables y sin datos sensibles en la URL.
- Secretos solo en variables de entorno. Ninguna contraseña, token o clave se guardará en Git ni en documentación.
- Toda credencial compartida durante el desarrollo deberá rotarse antes de producción.

## 9. Archivos y Supabase Storage

Buckets iniciales:

- `public-avatars`: público solo para avatares expresamente autorizados.
- `request-media`: privado, fotos y videos enviados por clientes.
- `professional-documents`: privado, identidad, matrícula y documentación.
- `equipment-media`: privado, fotos identificatorias e historial.
- `job-evidence`: privado, evidencias antes y después del trabajo.

Las rutas incluirán identificadores internos no sensibles y nombres aleatorios. Se validarán tamaño, tipo declarado, tipo real y autorización. Las cargas incompletas podrán reintentarse individualmente.

El acceso será mediante políticas de Storage y URLs firmadas. Subir con reemplazo requerirá las políticas necesarias para insertar, leer y actualizar; de preferencia se crearán objetos inmutables y versionados para evitar reemplazos accidentales.

Los backups de base de datos no incluyen los objetos de Storage. Antes de producción se definirá copia independiente y restauración probada para documentos y evidencias críticas, además de políticas de conservación y eliminación.

## 10. Recuperación de errores

- El wizard guarda borradores por paso.
- Cada archivo muestra progreso, resultado y reintento individual.
- Un pago pendiente nunca se trata como aprobado.
- Webhooks repetidos o fuera de orden se procesan de forma idempotente.
- Si Mercado Pago no responde, la solicitud queda recuperable y no se duplica el cobro.
- Si un profesional rechaza o no responde, vuelve al flujo de matching.
- Si no hay disponibilidad, se crea una alerta operativa y el cliente recibe un mensaje honesto, sin ETA inventada.
- Las notificaciones fallidas se reintentan y quedan visibles para administración.
- Cada incidente importante tiene un identificador de seguimiento.
- Administración dispone de acciones manuales controladas para reasignar, corregir, reembolsar o reanudar; toda acción queda auditada.

## 11. Notificaciones

Eventos mínimos:

- Solicitud recibida.
- Pago aprobado, rechazado o reembolsado.
- Matching iniciado y profesional asignado.
- Aceptación, rechazo o reasignación.
- Profesional en camino y llegada.
- Presupuesto final disponible y decisión.
- Trabajo terminado y confirmación.
- Review pendiente.
- Mantenimiento recomendado.
- Reclamo, garantía o disputa.

Canales:

- Notificaciones dentro de la aplicación.
- Correo electrónico.
- WhatsApp mediante un adaptador cuando la cuenta y el proveedor estén listos.
- Web push en una etapa posterior del mismo producto, no como dependencia del lanzamiento inicial.

Las plantillas serán administrables o versionadas, tendrán historial de entrega y no incluirán información sensible innecesaria.

## 12. Diseño de experiencia e interfaz

Las referencias visuales suministradas definen la dirección, pero no obligan a conservar la implementación del ZIP.

- Estética limpia, tranquila y confiable.
- Azul Lysto como color principal, tinta oscura para lectura y verde para confirmaciones y seguridad.
- Español rioplatense coherente: “vos”, “elegí”, “podés”.
- Diseño mobile-first con adaptación real a escritorio, no una pantalla de teléfono estirada.
- Navegación y shell propios para cliente, profesional y administración.
- Indicador de avance y guardado en flujos largos.
- Estados vacíos, carga, error, conexión lenta y recuperación diseñados desde el inicio.
- Mensajes financieros y operativos explícitos; nunca ocultar incertidumbre mediante animaciones.
- Componentes reutilizables y tokens visuales para futuras categorías.
- Contraste, foco visible, teclado, etiquetas y mensajes que no dependan solo del color.
- Objetivo de accesibilidad WCAG 2.2 nivel AA en los recorridos críticos.

El material del ZIP se auditará y podrá reutilizarse cuando encaje con este diseño. Se reconstruirá lo que esté acoplado a datos simulados, reglas hardcodeadas o componentes que no alcancen la calidad requerida.

## 13. Pruebas y calidad de publicación

### 13.1 Capas de prueba

- **Dominio:** precios, diagnóstico, matching, comisiones, permisos, mantenimiento y máquina de estados.
- **Base de datos y RLS:** acceso permitido y denegado por rol, migraciones, restricciones, funciones y políticas de Storage.
- **Integración:** carga de archivos, webhooks, firmas, idempotencia, reintentos, OAuth y adaptadores.
- **Interfaz:** componentes críticos, formularios, accesibilidad y diseño responsive.
- **E2E:** recorrido cliente → administración → profesional → cliente.
- **Ramas E2E:** pago fallido, rechazo del profesional, reasignación, presupuesto rechazado, segunda visita, cancelación y reembolso.

### 13.2 Integración continua

Cada cambio en GitHub deberá ejecutar, según la etapa:

- Formato y lint.
- Comprobación de tipos.
- Pruebas unitarias e integración.
- Compilación de producción.
- Verificación de migraciones.
- Pruebas E2E de recorridos críticos.

### 13.3 Ambientes

- Local/desarrollo.
- Staging con datos de prueba, Supabase no productivo y Mercado Pago sandbox.
- Producción con proyecto, secretos y datos independientes.

### 13.4 Condiciones de lanzamiento comercial

- Recorridos críticos aprobados en móvil y escritorio.
- Pruebas de permisos y RLS aprobadas.
- Sin hallazgos críticos de seguridad abiertos.
- Pagos, split, webhooks, reembolsos y conciliación validados en sandbox y con una prueba controlada autorizada.
- Backups y restauración probados para base y archivos críticos.
- Monitoreo, alertas y registros operativos activos.
- Procedimiento de reversión de aplicación y migraciones.
- Manual operativo para incidencias y acciones administrativas.
- Revisión fiscal, contractual, de privacidad y consumo en Argentina.

Las integraciones incompletas se protegerán mediante configuración o feature flags. Una interfaz simulada nunca se presentará como una función comercial activa.

## 14. Despliegue y cambios de base

- Railway tendrá ambientes separados para staging y producción.
- Las publicaciones partirán de GitHub después de superar CI.
- Las migraciones serán revisadas, reproducibles y preferentemente compatibles hacia atrás.
- Los cambios destructivos se dividirán en varias publicaciones con migración de datos y verificación.
- Se conservará un procedimiento de rollback de aplicación; para datos se utilizarán migraciones correctivas y restauración solo cuando corresponda.
- Webhooks y workers deberán soportar varias réplicas sin ejecutar efectos duplicados.

## 15. Etapas de construcción

Las etapas organizan el trabajo; no eliminan funcionalidades del MVP aprobado.

1. **Base:** repositorio, Next.js, estilos, Supabase, autenticación, roles, layouts, modelo inicial, CI y ambientes.
2. **Cliente:** landing, cuenta, wizard, diagnóstico, archivos, dirección, horario, precios y confirmación.
3. **Administración operativa:** solicitudes, clientes, profesionales, matching, estados, catálogo, diagnóstico y precios.
4. **Profesional:** invitación, onboarding, aprobación, dashboard, agenda, aceptación, ejecución, equipos y cierre.
5. **Pagos:** adaptador, Mercado Pago, OAuth, webhooks, comisión, split, liquidación, reembolso y conciliación.
6. **Seguimiento y calidad:** línea de tiempo, técnico confirmado, comprobante/QR, reviews, garantía, reclamos e historial.
7. **Hardening:** seguridad, RLS, auditoría, notificaciones, rendimiento, pruebas, observabilidad, backups y lanzamiento.

## 16. Fuera del MVP

- Aplicaciones nativas Android e iOS.
- Operación real de múltiples rubros.
- GPS continuo tipo Uber.
- Chat complejo en tiempo real.
- Diagnóstico autónomo por visión.
- Optimización automática de rutas.
- Sistema contable o fiscal completo.
- Automatización total del soporte.
- Programa avanzado de capacitación.
- Modo offline profesional.

## 17. Decisiones configurables pendientes

Estas definiciones no bloquean la arquitectura y deberán cerrarse antes de habilitar la función relacionada:

- Tarifas y porcentajes comerciales definitivos.
- SLA exacto de Flexible y Prioridad por zona y horario.
- Política de cancelación, garantía y reembolso.
- Tiempo de aceptación del profesional.
- Reglas exactas para segunda visita y repuestos.
- Proveedor y plantillas de WhatsApp.
- Textos legales y esquema fiscal/contractual.
- Retención de documentos y archivos.
- Alcance exacto de ubicación aproximada.

Todas deberán vivir como configuración versionada o política documentada, no como supuestos dispersos en componentes.

## 18. Criterio de éxito del MVP

El MVP estará completo cuando sea posible operar de manera segura y trazable, en staging y luego en producción controlada, el siguiente circuito:

1. Un cliente se registra, solicita un servicio, adjunta evidencia, recibe diagnóstico preliminar, elige dirección, horario y modalidad, y paga.
2. El sistema calcula candidatos y administración asigna a un profesional aprobado.
3. El profesional acepta, actualiza su recorrido, diagnostica, carga presupuesto final, ejecuta y documenta el trabajo.
4. El cliente sigue los estados, decide sobre el presupuesto, confirma el cierre, recibe comprobante y deja una review.
5. Lysto puede auditar el proceso, atender excepciones, conciliar el pago, controlar calidad y consultar el historial del equipo.

La validación comercial deberá medir, como mínimo, conversión de solicitud, aprobación de pago, tiempo de asignación, aceptación profesional, puntualidad, resolución, satisfacción, reclamos y margen por servicio.

## 19. Referencias oficiales relevantes

- Mercado Pago Developers — Split de pagos: <https://www.mercadopago.com.ar/developers/es/docs/split-payments/landing>
- Mercado Pago Developers — MCP Server: <https://www.mercadopago.com.ar/developers/es/docs/mcp-server/overview>
- Supabase — Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase — Control de acceso de Storage: <https://supabase.com/docs/guides/storage/security/access-control>
- Supabase — Backups: <https://supabase.com/docs/guides/platform/backups>
- Railway — Deploy y escalado: <https://docs.railway.com/guides/deployments>

