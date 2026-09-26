# Mercado Pago sin clave de Webhooks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Activar OAuth y Split 1:1 por Checkout Pro con conciliación canónica cuando la firma de Webhooks no está disponible.

**Architecture:** Separar configuración de OAuth/pagos de la verificación de Webhooks. Usar IPN como disparador no confiable protegido con HMAC por checkout, consultar el recurso en Mercado Pago y aplicar la validación financiera existente. Alinear el esquema de producción con el código sin activar Orders.

**Tech Stack:** Next.js 15, TypeScript, Vitest, PostgreSQL/Supabase, Vercel, Mercado Pago Checkout Pro.

---

### Task 1: Configuración independiente de Webhooks

**Files:** `lib/payments/marketplace-config.ts`, `lib/config/env.ts`, `lib/payments/marketplace.ts`, `app/api/mercadopago/oauth/authorize/route.ts`, `app/api/mercadopago/oauth/callback/route.ts`, `app/api/mercadopago/account/route.ts`, tests unitarios de marketplace.

1. Agregar tests que demuestren que OAuth y cuenta funcionan sin `MERCADOPAGO_WEBHOOK_SECRET`, pero Webhooks firmados no aceptan notificaciones sin ella; correrlos y observar el fallo esperado.
2. Hacer opcional la firma en configuración, usar `OAuthManager` directamente para OAuth/desvinculación y `SplitPaymentClient` para Preferences.
3. Ejecutar los tests enfocados y corregir hasta que pasen.

### Task 2: Aviso IPN y conciliación canónica

**Files:** `lib/payments/checkout-contract.ts`, `lib/payments/marketplace.ts`, `app/api/mercadopago/ipn/route.ts`, `components/payments/payment-panel.tsx`, tests de contrato, API y ledger.

1. Escribir tests fallidos para URL IPN/HMAC, parámetros duplicados, cuerpo grande, tema desconocido, firma incorrecta, recurso ajeno, idempotencia y conciliación al volver del checkout.
2. Implementar la URL por checkout y el receptor IPN con validación estricta, rate limit y consulta al API con token del vendedor. Reusar `inspectPayment` y `applyCanonicalPayment`; no aceptar estados del mensaje entrante.
3. Añadir conciliación al regreso en la pantalla y conservar el botón manual.
4. Ejecutar tests enfocados, lint y typecheck.

### Task 3: Alinear base y configurar producción

**Files:** `supabase/migrations/20260920171628_marketplace_orders.sql`, Vercel Production, Supabase Production.

1. Verificar tablas, columnas y ausencia de checkouts; aplicar la migración pendiente de forma transaccional y registrarla. Confirmar columnas y `checkout_protocol='preferences'`; no activar `MERCADOPAGO_ORDERS_ENABLED`.
2. Configurar `MERCADOPAGO_MODE=live` y `PAYMENTS_PROVIDER=mercadopago_split` en Vercel, sin inventar firma de Webhooks. Mantener nuevos cobros apagados hasta comprobación funcional.
3. Verificar conexión y permisos de `lysto_marketplace` desde el runtime desplegado.

### Task 4: Verificación y publicación

1. Ejecutar suite de pagos, test de dominio, lint, typecheck, build y revisión de diff.
2. Publicar en `main` como pidió el usuario y verificar el deployment de Vercel.
3. Probar la cuenta profesional existente: `GET /api/mercadopago/account`, inicio OAuth y retorno; no efectuar una transacción financiera real sin intervención del usuario.
4. Informar qué se verificó y qué parte necesita una prueba de pago real o la clave de Webhooks futura.
