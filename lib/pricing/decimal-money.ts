// Treat each decimal input as written, then round once with NUMERIC's half-up rule.
// BigInt stays internal; public prices remain ARS numbers with two decimal places.
function fraction(value: number): [bigint, bigint] {
  if (!Number.isFinite(value)) throw new Error('invalid_money')
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e')
  const [whole, decimal = ''] = coefficient.split('.')
  const scale = decimal.length - Number(exponent)
  const digits = BigInt(whole + decimal)
  return scale >= 0 ? [digits, 10n ** BigInt(scale)] : [digits * 10n ** BigInt(-scale), 1n]
}
function rounded(numerator: bigint, denominator: bigint) {
  if (numerator < 0n || numerator > 1_000_000_000n * denominator) throw new Error('invalid_money')
  return Number((numerator * 200n + denominator) / (2n * denominator)) / 100
}
export function money(value: number) {
  return rounded(...fraction(value))
}
export function moneyProduct(...values: number[]) {
  let numerator = 1n,
    denominator = 1n
  for (const value of values) {
    const [n, d] = fraction(value)
    numerator *= n
    denominator *= d
  }
  return rounded(numerator, denominator)
}
export function moneySum(...values: number[]) {
  let numerator = 0n,
    denominator = 1n
  for (const value of values) {
    const [n, d] = fraction(value)
    numerator = numerator * d + n * denominator
    denominator *= d
  }
  return rounded(numerator, denominator)
}
