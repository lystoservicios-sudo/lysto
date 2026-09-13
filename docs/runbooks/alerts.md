# Alertas y controles de producción

## Señales mínimas

- `GET /api/health/live` prueba que el proceso responde. Tres fallos consecutivos requieren reiniciar la instancia.
- `GET /api/health/ready` prueba configuración y base de datos. Un `503` saca la instancia del tráfico y abre un incidente.
- Los registros `http.request` incluyen correlación, ruta, método, estado, latencia y release. Los campos sensibles se redactan antes de escribirlos.
- Alertar si los errores 5xx superan 2% durante cinco minutos, p95 supera 2 segundos durante diez minutos, el outbox más antiguo supera 10 minutos, una devolución supera 15 minutos o existen pagos en revisión durante más de 30 minutos.
- Alertar por aumentos sostenidos de 429. No ampliar límites durante un incidente sin comprobar abuso, capacidad y efecto para clientes.

## Respuesta

1. Identificar release, entorno y correlaciones afectadas sin copiar datos personales.
2. Si el problema afecta nuevas solicitudes, fijar `LYSTO_ACCEPT_NEW_REQUESTS=false` y volver a desplegar.
3. Si afecta cobros nuevos, fijar `LYSTO_ALLOW_NEW_CHECKOUTS=false`. Webhooks, conciliación y devoluciones deben seguir activos.
4. Confirmar `/api/health/ready`, colas y pagos en revisión después de mitigar.
5. Registrar inicio, alcance, decisión, responsable, recuperación y seguimiento.

## Recuperación

Reactivar cada interruptor por separado después de validar una solicitud o checkout controlado en staging y comprobar que colas y errores vuelven a sus umbrales. Eliminar buckets vencidos con `prune_rate_limits` desde una identidad `service_role`; nunca exponer esa operación al navegador.
