import Link from 'next/link'
import { ChevronRight, Download, FileText, LifeBuoy, ReceiptText, Undo2, Wrench } from 'lucide-react'
import { MoreEmpty, MoreLink, MorePage, MoreSection, moreStyles as styles } from '@/components/customer/more/more-ui'
import { customerPaymentFilters, paymentCurrency, paymentDate, paymentRecordAvailable, paymentState, refundState, type CustomerPaymentFilter, type PaymentRecord } from '@/lib/customer-more/payments-model'
import type { CustomerPaymentDetail, CustomerPaymentMovement, listCustomerPayments, readCustomerRefund } from '@/lib/customer-more/payments'
import { MorePaymentActions, PrintPaymentRecord } from './payment-actions'
import local from './payments.module.css'

const helpUrl = (jobId: string) => `/app/ayuda/nueva?jobId=${encodeURIComponent(jobId)}&category=payment`
const pageUrl = (filter: CustomerPaymentFilter, page: number) => `/app/pagos?estado=${filter}&pagina=${page}`
type PaymentList = Awaited<ReturnType<typeof listCustomerPayments>>
const emptyTitles: Record<CustomerPaymentFilter, string> = {
  todos: 'Todavía no hay pagos registrados', pendientes: 'No tenés pagos pendientes',
  procesando: 'No hay pagos en proceso', pagados: 'Todavía no hay pagos confirmados', reintegros: 'No hay reintegros registrados'
}

function Movement({ movement }: { movement: CustomerPaymentMovement }) {
  const state = paymentState(movement.status, movement.expiresAt)
  return <Link className={local.movement} href={`/app/pagos/${movement.jobId}`}>
    <span className={local.movementCopy}>
      <strong>{movement.service}</strong>
      <span>{movement.extraLabel ? `Adicional · ${movement.extraLabel}` : 'Servicio inicial'} · {paymentDate(movement.createdAt)}</span>
      <span className={local.state} data-tone={state.tone}>{state.label}{movement.liveMode === false ? ' · Registro de prueba' : ''}</span>
    </span>
    <span className={local.movementAmount}>{paymentCurrency(movement.amount)}<ChevronRight size={18} aria-hidden="true" /></span>
  </Link>
}
export function CustomerPaymentsList({ data }: { data: PaymentList }) {
  return <MorePage title="Pagos y comprobantes" description="Consultá tus pagos, continuá los pendientes y seguí tus reintegros.">
    <nav className={styles.filters} aria-label="Filtrar pagos">
      {customerPaymentFilters.map((filter) => <Link key={filter.value} href={pageUrl(filter.value, 1)} aria-current={data.filter === filter.value ? 'page' : undefined}>{filter.label}</Link>)}
    </nav>
    {data.items.length ? <section aria-label="Movimientos de pago">
      <p className={styles.muted}>{data.total} {data.total === 1 ? 'movimiento' : 'movimientos'}</p>
      {data.items.map((movement) => <Movement key={movement.id} movement={movement} />)}
    </section> : <>
      <MoreEmpty title={emptyTitles[data.filter]} description={data.filter === 'todos'
        ? 'Acá vas a encontrar los pagos de tus servicios, sus registros y las solicitudes de reintegro.'
        : 'Los estados se muestran con la información registrada en el sistema. No agregamos movimientos de ejemplo.'} />
      <Link className={styles.secondary} href={data.filter === 'todos' ? '/app/trabajos' : '/app/pagos'}>{data.filter === 'todos' ? 'Ver mis servicios' : 'Ver todos los pagos'}</Link>
    </>}
    {data.hasPrevious || data.hasNext ? <nav className={local.pagination} aria-label="Páginas de pagos">
      {data.hasPrevious ? <Link className={styles.secondary} href={pageUrl(data.filter, data.page - 1)}>Anterior</Link> : <span />}
      <span className={styles.muted}>Página {data.page}</span>
      {data.hasNext ? <Link className={styles.secondary} href={pageUrl(data.filter, data.page + 1)}>Siguiente</Link> : <span />}
    </nav> : null}
    <p className={styles.muted}>El registro de pago no reemplaza una factura fiscal. Si necesitás una factura o ayuda con un cargo, podés consultar a Lysto.</p>
    <MoreLink href="/app/ayuda/nueva?category=payment" icon={LifeBuoy} title="Ayuda con un pago" description="Consultas sobre cobros, comprobantes o reintegros." />
  </MorePage>
}

function CheckoutRecord({ customerId, detail, checkout }: { customerId: string; detail: CustomerPaymentDetail; checkout: CustomerPaymentDetail['checkouts'][number] }) {
  const state = paymentState(checkout.status, checkout.expiresAt)
  return <article className={local.checkout}>
    <div className={local.checkoutHeading}><h3>{checkout.extraLabel ? `Adicional · ${checkout.extraLabel}` : 'Servicio inicial'}</h3><span className={local.state} data-tone={state.tone}>{state.label}</span></div>
    <p className={styles.amount}>{paymentCurrency(checkout.amount)}</p>
    <p className={styles.muted}>{state.description}</p>
    {checkout.liveMode === false ? <p className={styles.notice}>Este es un registro de prueba, no un cobro real.</p> : null}
    {checkout.refundedAmount > 0 ? <p className={styles.muted}>Reintegro confirmado: {paymentCurrency(checkout.refundedAmount)}</p> : null}
    <MorePaymentActions customerId={customerId} jobId={detail.id} jobStatus={detail.status} amount={checkout.amount} extraId={checkout.extraId ?? undefined} checkout={checkout} payEnabled={detail.canStartPayment ?? false} />
    {paymentRecordAvailable(checkout) ? <MoreLink title="Ver registro de pago" description="Consultar, descargar o imprimir. No es una factura fiscal." icon={ReceiptText}
      href={`/app/pagos/${detail.id}/comprobante?checkoutId=${checkout.id}`} /> : null}
    {checkout.refunds.map((refund) => <MoreLink key={refund.id} title={refundState(refund.status).label} description={`${paymentCurrency(refund.amount)} · ${paymentDate(refund.requestedAt)}`} icon={Undo2}
      href={`/app/pagos/${detail.id}/reintegros/${refund.id}`} />)}
  </article>
}
export function CustomerPaymentDetails({ customerId, detail }: { customerId: string; detail: CustomerPaymentDetail }) {
  const missingInitial = !detail.checkouts.some((checkout) => checkout.extraId === null)
  const unpreparedExtras = detail.extras.filter((extra) => extra.status === 'accepted' && !detail.checkouts.some((checkout) => checkout.extraId === extra.id))
  return <MorePage title="Detalle del pago" description={detail.service} backHref="/app/pagos" backLabel="Volver a pagos">
    <dl className={styles.facts}>
      <div className={styles.fact}><dt>Servicio</dt><dd>{detail.service}</dd></div>
      <div className={styles.fact}><dt>Profesional</dt><dd>{detail.professional}</dd></div>
      {detail.scheduledDate ? <div className={styles.fact}><dt>Visita</dt><dd>{detail.scheduledDate.split('-').reverse().join('/')} {detail.timeWindow ? `· ${detail.timeWindow}` : ''}</dd></div> : null}
    </dl>
    <MoreSection title="Pagos del servicio">
      {detail.checkouts.map((checkout) => <CheckoutRecord key={checkout.id} customerId={customerId} detail={detail} checkout={checkout} />)}
      {missingInitial ? <article className={local.checkout}>
        <h3>Servicio inicial</h3>
        {detail.amount !== null ? <p className={styles.amount}>{paymentCurrency(detail.amount)}</p> : null}
        <p className={styles.muted}>{detail.status.startsWith('cancelled') ? 'El servicio está cancelado. Si pagaste y todavía no figura el movimiento, contactá a soporte.'
          : ['pending_assignment', 'pending_professional_acceptance'].includes(detail.status) ? 'El pago estará disponible cuando el profesional quede confirmado.'
            : !detail.canStartPayment ? 'Necesitás un presupuesto aceptado y un servicio habilitado para continuar con el pago. Podés consultar desde Ayuda.'
              : 'Todavía no hay un pago confirmado para este servicio.'}</p>
        <MorePaymentActions customerId={customerId} jobId={detail.id} jobStatus={detail.status} amount={detail.amount} payEnabled={detail.canStartPayment ?? false} />
      </article> : null}
      {unpreparedExtras.map((extra) => <article key={extra.id} className={local.checkout}>
        <h3>Adicional · {extra.fault}</h3><p className={styles.amount}>{paymentCurrency(extra.amount)}</p>
        <p className={styles.muted}>Presupuesto adicional aceptado. Se paga por separado del servicio inicial.</p>
        <MorePaymentActions customerId={customerId} jobId={detail.id} jobStatus={detail.status} amount={extra.amount} extraId={extra.id} payEnabled={detail.canStartPayment ?? false} />
      </article>)}
    </MoreSection>
    <div className={styles.notice}>Si aparecen otras fallas o se necesitan repuestos, el profesional te presenta un presupuesto adicional para que lo revises antes de continuar.</div>
    <MoreSection title="Servicio y ayuda">
      <MoreLink href={`/app/trabajos/${detail.id}`} title="Ver servicio" description="Visita, equipo, presupuestos e informe del trabajo." icon={Wrench} />
      {detail.serviceReceipt ? <MoreLink href={`/comprobante/${detail.serviceReceipt.token}`} title="Ver comprobante del servicio" description="Informe del trabajo y cobertura registrada. No es un comprobante de pago." icon={FileText} /> : null}
      <MoreLink href={helpUrl(detail.id)} title="Necesito ayuda con este pago" description="Consultar un cargo, pedir una factura o informar un problema." icon={LifeBuoy} />
    </MoreSection>
  </MorePage>
}

export function CustomerPaymentRecordView({ record }: { record: PaymentRecord }) {
  return <MorePage title="Registro de pago" description="Información confirmada y registrada de tu pago." backHref={`/app/pagos/${record.jobId}`} backLabel="Volver al pago">
    <article className={local.printable} aria-label="Registro confirmado de pago">
      <p className={local.recordBrand}>Lysto · Registro de pago</p>
      <p className={styles.amount}>{paymentCurrency(record.amount)}</p>
      <span className={local.state} data-tone="confirmed">{paymentState(record.status).label}</span>
      <dl className={styles.facts}>
        <div className={styles.fact}><dt>Servicio</dt><dd>{record.service}</dd></div>
        <div className={styles.fact}><dt>Concepto</dt><dd>{record.extraLabel ? `Adicional · ${record.extraLabel}` : 'Servicio inicial'}</dd></div>
        <div className={styles.fact}><dt>Registro creado</dt><dd>{paymentDate(record.createdAt)}</dd></div>
        <div className={styles.fact}><dt>Última actualización</dt><dd>{paymentDate(record.updatedAt)}</dd></div>
        <div className={styles.fact}><dt>Referencia Mercado Pago</dt><dd>{record.providerReferences.join(', ')}</dd></div>
        {record.refundedAmount > 0 ? <div className={styles.fact}><dt>Reintegro confirmado</dt><dd>{paymentCurrency(record.refundedAmount)}</dd></div> : null}
        <div className={styles.fact}><dt>Servicio Lysto</dt><dd className={local.reference}>{record.jobId}</dd></div>
        <div className={styles.fact}><dt>Registro</dt><dd className={local.reference}>{record.checkoutId}</dd></div>
      </dl>
      <p className={styles.notice}>No es una factura fiscal. Refleja el estado registrado y confirmado por Mercado Pago al momento de la consulta. Para solicitar una factura fiscal, contactá a Lysto desde Ayuda.</p>
    </article>
    <div className={styles.actions}>
      <Link className={styles.primary} href={`/api/customer/payments/${record.jobId}/record?checkoutId=${record.checkoutId}`} prefetch={false}><Download size={18} aria-hidden="true" />Descargar registro</Link>
      <PrintPaymentRecord />
    </div>
    <MoreLink href={helpUrl(record.jobId)} title="Consultar sobre este registro" icon={LifeBuoy} />
  </MorePage>
}

export function CustomerRefundDetails({ data }: { data: NonNullable<Awaited<ReturnType<typeof readCustomerRefund>>> }) {
  const state = refundState(data.refund.status)
  return <MorePage title="Detalle del reintegro" description={data.service} backHref={`/app/pagos/${data.jobId}`} backLabel="Volver al pago">
    <section aria-label="Estado del reintegro">
      <span className={local.state} data-tone={state.tone}>{state.label}</span>
      <p className={styles.amount}>{paymentCurrency(data.refund.amount)}</p>
      <p className={styles.muted}>{state.description}</p>
    </section>
    <dl className={styles.facts}>
      <div className={styles.fact}><dt>Servicio</dt><dd>{data.service}</dd></div>
      <div className={styles.fact}><dt>Importe del pago original</dt><dd>{paymentCurrency(data.paymentAmount)}</dd></div>
      <div className={styles.fact}><dt>Solicitado el</dt><dd>{paymentDate(data.refund.requestedAt)}</dd></div>
      <div className={styles.fact}><dt>Última actualización</dt><dd>{paymentDate(data.refund.updatedAt)}</dd></div>
      <div className={styles.fact}><dt>Motivo registrado</dt><dd>{data.refund.reason}</dd></div>
      {data.refund.providerReference ? <div className={styles.fact}><dt>Referencia del reintegro</dt><dd>{data.refund.providerReference}</dd></div> : null}
    </dl>
    <p className={styles.notice}>Una solicitud no equivale a una devolución completada. Cuando el reintegro se confirma, la acreditación se realiza al medio de pago original según sus plazos.</p>
    <MoreLink href={helpUrl(data.jobId)} title="Necesito ayuda con el reintegro" description="Tu consulta queda vinculada al servicio y al historial de pago." icon={LifeBuoy} />
    <MoreLink href={`/app/trabajos/${data.jobId}`} title="Ver servicio" icon={Wrench} />
  </MorePage>
}
