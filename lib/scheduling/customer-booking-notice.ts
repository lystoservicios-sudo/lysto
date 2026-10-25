/** Booking lead time uses Argentina's calendar days, not rolling 24-hour periods. */
export const CUSTOMER_BOOKING_NOTICE = 'Reservá con al menos 3 días hábiles de anticipación. Contamos lunes a viernes, sin descontar feriados.'

export function argentinaDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function earliestCustomerVisitDay(now = new Date()) {
  const day = new Date(`${argentinaDay(now)}T12:00:00Z`)
  let weekdays = 0
  while (weekdays < 3) {
    day.setUTCDate(day.getUTCDate() + 1)
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) weekdays++
  }
  return day.toISOString().slice(0, 10)
}

export function customerBookingNoticeMessage(now = new Date()) {
  const firstDate = earliestCustomerVisitDay(now).split('-').reverse().join('/')
  return `${CUSTOMER_BOOKING_NOTICE} Elegí una fecha a partir del ${firstDate}.`
}
