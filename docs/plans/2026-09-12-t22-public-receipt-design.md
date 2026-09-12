# T22 — Comprobante público mínimo

El enlace contiene un UUID aleatorio generado con el informe. El servidor valida el formato, aplica límite compartido por origen y consulta una RPC disponible sólo para `service_role`. Un token inventado, vencido o revocado devuelve ausencia sin distinguir el motivo.

La proyección permite únicamente servicio, nombre público abreviado del profesional, trabajo realizado, resultado técnico, estado de conformidad, garantía, próxima fecha de mantenimiento y fecha de emisión. El contrato estricto rechaza campos adicionales. No expone dirección, equipo identificable, teléfono, correo, documentos, notas internas, diagnóstico privado ni importes.

La página es dinámica, `no-store`, `noindex` y `no-referrer`; no integra analítica ni recursos de terceros. Los registros de aplicación no incluyen el token. La configuración del proveedor de hosting debe excluir o redactar `/comprobante/*` en logs de URL antes del piloto.

Revocar o regenerar exige admin con MFA y permiso de operaciones o calidad, token esperado y motivo. La URL anterior deja de resolver inmediatamente. La auditoría guarda hashes de tokens, nunca tokens en claro.

El texto identifica el artefacto como comprobante de servicio y aclara que no reemplaza una factura o documento fiscal, pendiente de D05/D08.
