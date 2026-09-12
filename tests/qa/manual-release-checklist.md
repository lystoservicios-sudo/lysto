# UAT obligatorio antes de lanzamiento

Registrar candidato, entorno, fecha, participantes, navegador/dispositivo, IDs sintéticos, resultado y defecto. Usar cuentas de staging designadas y archivos sin datos reales. Leer esta lista no acredita ejecución.

## Cliente

- [ ] UAT-01: registro con versión aprobada, confirmación, login, recuperación y cierre de sesión; probar enlace vencido y sesión revocada.
- [ ] UAT-02: crear dirección/equipo, rechazar archivo hostil, completar presupuesto, recargar y comprobar el mismo ID; Cliente A no ve datos de B.
- [ ] UAT-03: aceptar presupuesto revisado, esperar asignación aceptada y comprobar que el checkout sólo aparece después; doble click/back/refresh no duplican.
- [ ] UAT-04: confirmar diagnóstico presencial y adicional por separado, revisar pago y conformar cierre sin reseña obligatoria.

## Profesional

- [ ] UAT-05: MFA, perfil/documentos aprobados, oferta aceptada/rechazada, agenda y trabajo propio; profesional suspendido y profesional ajeno no acceden.
- [ ] UAT-06: en camino, llegada, diagnóstico, evidencia, adicional, repuesto, informe final y recuperación tras timeout usando el mismo comando.

## Operación, finanzas y calidad

- [ ] UAT-07: operador A asigna y entrega un caso; operador B retoma; conflicto de versión se recupera; auditoría identifica a ambos.
- [ ] UAT-08: finanzas concilia pago incierto y devolución sintética; calidad clasifica/resuelve reclamo y garantía; cada rol carece de herramientas ajenas.

## Navegadores y accesibilidad

- [ ] Suite completa en Chromium desktop, Chromium mobile y WebKit mobile, sin omitidos ni interceptar el backend de Lysto.
- [ ] Teclado, foco al cambiar pasos, labels, errores, contraste, zoom 200%, targets táctiles, modales y ausencia de scroll horizontal.
- [ ] Teléfono físico: cámara/archivo, red lenta, retorno del checkout de prueba, recarga y sesión vencida. Registrar modelo y sistema operativo.
- [ ] Revisar screenshots/videos de fallos; eliminar artefactos con secretos, códigos MFA, domicilios o identificadores no sintéticos.

## Cierre

- [ ] Cero defectos bloqueantes en dinero, autorización, privacidad o ciclo del servicio.
- [ ] Defectos menores tienen dueño, fecha y aceptación explícita; volver a ejecutar casos afectados y todos los gates obligatorios.
