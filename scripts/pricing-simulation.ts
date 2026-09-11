import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import { calculateServiceQuote, defaultQuotePolicy, scenarioCodes, type QuoteInput, type TravelEstimate } from '../lib/pricing/service-quote.ts'
import { AIR_CONDITIONING_ISSUES } from '../lib/domain/constants.ts'

const output = new URL('../output/pricing/', import.meta.url)
await mkdir(output, { recursive: true })
const now = new Date('2026-09-10T15:00:00Z')
const route: TravelEstimate = { source:'simulation', origin:'Obelisco, CABA',destination:'Av. Corrientes 1240, CABA (punto fijo de prueba)',province:'CABA',outboundKm:10,returnKm:10,outboundMinutes:30,returnMinutes:30,tolls:0,tollsVerified:true,measuredAt:now.toISOString() }
const baseline: QuoteInput = { issue:'no_enfria',timeSince:'days',urgency:'flexible',propertyType:'apartment',access:{hasElevator:true,hasParking:true,stairsRequired:false,outdoorUnitAtHeight:false,outdoorUnitOnBalcony:false,difficultAccess:false},equipment:{capacity:3000,technology:'conventional'},route,materials:[],materialsConfirmed:false }
const policy = defaultQuotePolicy
const out = createWriteStream(new URL('combinaciones.csv', output), { encoding:'utf8' })
out.write('\uFEFFproblema;antiguedad;prioridad;propiedad;accesos_mascara;frigorias;tecnologia;subtotal;recargo_30;total;profesional;comision;provision_cobro;contribucion;requiere_revision\n')
let count=0
const totals: Record<string,{ min:number;max:number;count:number }>={}
const accessKeys = ['hasElevator','hasParking','stairsRequired','outdoorUnitAtHeight','outdoorUnitOnBalcony','difficultAccess'] as const
const capacities=[2250,3000,4500,6000,8000,9000,18000] as const
for(const {slug:issue} of AIR_CONDITIONING_ISSUES) for(const timeSince of ['today','days','weeks','months'] as const) for(const urgency of ['flexible','priority'] as const) for(const propertyType of ['house','apartment','commercial','office'] as const) for(let mask=0;mask<64;mask++) for(const capacity of capacities) for(const technology of ['conventional','inverter','unknown'] as const){
  const access=Object.fromEntries(accessKeys.map((name,bit)=>[name,Boolean(mask&(1<<bit))]))
  const q=calculateServiceQuote({...baseline,issue,timeSince,urgency,propertyType,access,equipment:{capacity,technology}},policy,now)
  assert.equal(Math.round(q.total*100),Math.round(q.calculatorSubtotal*100)+Math.round(q.safetyAmount*100))
  assert.equal(q.safetyAmount,Math.round(q.calculatorSubtotal*30)/100)
  assert.equal(Math.round(q.professionalAmount*100)+Math.round(q.platformFee*100),Math.round(q.total*100))
  assert.ok(q.professionalAmount>=q.calculatorSubtotal)
  assert.ok(q.platformContribution>=0)
  assert.equal(q.travel,32000)
  assert.equal(q.readyToOffer,false)
  const stats=totals[issue]??{min:Infinity,max:0,count:0};stats.min=Math.min(stats.min,q.total);stats.max=Math.max(stats.max,q.total);stats.count++;totals[issue]=stats
  const line=[issue,timeSince,urgency,propertyType,mask,capacity,technology,q.calculatorSubtotal,q.safetyAmount,q.total,q.professionalAmount,q.platformFee,q.paymentCostBudget,q.platformContribution,'si'].join(';')+'\n'
  if(!out.write(line))await once(out,'drain')
  count++
}
out.end();await once(out,'finish')
assert.equal(count,7*4*2*4*64*7*3)
const ars=(n:number)=>'$ '+n.toLocaleString('es-AR',{maximumFractionDigits:2})
const mainRows=AIR_CONDITIONING_ISSUES.map(({slug:issue,title})=>{
  const flexible=calculateServiceQuote({...baseline,issue,urgency:'flexible'},policy,now)
  const priority=calculateServiceQuote({...baseline,issue,urgency:'priority'},policy,now)
  return `| ${title} | ${ars(flexible.labor)} | ${ars(flexible.calculatorSubtotal)} | ${ars(flexible.safetyAmount)} | ${ars(flexible.total)} | ${ars(priority.total)} |`
})
const scenarios:string[]=[]
let manualCases=0
for(const {slug:issue,title} of AIR_CONDITIONING_ISSUES) for(const scenario of scenarioCodes[issue]){
  try{const q=calculateServiceQuote({...baseline,issue,scenario},policy,now);scenarios.push(`| ${title} | ${q.scope} | ${ars(q.total)} |`)}
  catch(error){assert.match(String(error),/manual_quote_required/);manualCases++;scenarios.push(`| ${title} | ${scenario} | Cotización manual: falta el precio del compresor compatible |`)}
}
const report=`# Prueba de presupuestos Lysto — 10 de septiembre de 2026

${count.toLocaleString('es-AR')} combinaciones calculadas y verificadas. ${scenarios.length} escenarios de alcance, incluidos ${manualCases} casos que correctamente requieren cotización manual.

## Condiciones comunes de la comparación principal

Destino fijo: Av. Corrientes 1240, CABA. Origen de referencia: Obelisco. **La ruta es sintética para aislar variables: 10 km y 30 minutos de ida, otros 10 km y 30 minutos de vuelta; no es una consulta real a Google, Uber o Cabify.** La tarifa interna de prueba es $700/km + $300/minuto: traslado idéntico de **$32.000** en todos los casos; peajes $0 supuestos.

Equipo convencional de 3000 frigorías/h, departamento, ascensor y estacionamiento disponibles, sin altura ni acceso complicado. Materiales y repuestos **sin cotizar y excluidos**. Fuente de mano de obra: imagen CAIM junio–julio 2026 proporcionada por el usuario. Tarifas aún pendientes de validación comercial. Las referencias sin máximo usan el mínimo publicado como referencia, no como tope de reparación.

## Precios principales en pesos argentinos

| Problema elegido | Mano de obra prevista | Calculadora con traslado | Recargo 30% | Flexible | Prioridad |
|---|---:|---:|---:|---:|---:|
${mainRows.join('\n')}

Prioridad aplica 25% a mano de obra y dificultad; después se suman materiales y traslado y se aplica el recargo de seguridad de 30%. El 30% no vuelve a aplicarse al aceptar ni a los adicionales.

## Alcance según escenario

Un síntoma no identifica una reparación segura. Se usa un alcance preliminar por defecto; se muestran alternativas expresas. Los puntajes del diagnóstico existente no se tratan como probabilidades estadísticas. Fallas eléctricas, motores, sensores, soportes o instalaciones que no encajen en estos alcances necesitan revisión técnica; no se inventa una tarifa de repuesto.

| Problema | Alcance posible | Flexible con traslado y 30% |
|---|---|---:|
${scenarios.join('\n')}

## Matriz completa

7 motivos × 4 antigüedades × 2 prioridades × 4 propiedades × 64 combinaciones de los seis indicadores de acceso × 7 capacidades × 3 tecnologías = **${count.toLocaleString('es-AR')}**. Los motivos son mutuamente excluyentes en el formulario; no se combinan dos fallas independientes como si fueran un diagnóstico confirmado. Los cambios de día/franja afectan la ruta real; en esta prueba la ruta se fija deliberadamente.

CSV: [todas las combinaciones](./combinaciones.csv). La máscara de accesos usa estos bits, desde el menos significativo: ${accessKeys.join(', ')}. Las cuatro antigüedades se recorren, pero no encarecen por sí solas el trabajo. Ascensor y balcón se registran sin recargo propio; altura, escalera y dificultad se declaran por separado para evitar duplicación.

| Motivo | Casos | Menor estimación | Mayor estimación |
|---|---:|---:|---:|
${AIR_CONDITIONING_ISSUES.map(({slug,title})=>`| ${title} | ${totals[slug].count} | ${ars(totals[slug].min)} | ${ars(totals[slug].max)} |`).join('\n')}

## Comprobaciones de dinero

En cada combinación: subtotal + recargo = total; comisión + importe del profesional = total; el importe bruto del profesional cubre el costo calculado. Mercado Pago descuenta sus cargos de la parte del profesional. Con comisión Lysto del 18% y costo estimado de cobro del 6%, el neto profesional es 98,8% del subtotal: el sistema marca revisión por costo no cubierto. No aumenta el total ni modifica automáticamente la comisión. Finanzas debe validar los costos y configurar un reparto viable antes de ofrecer. El 6% es una estimación, no una tarifa verificada de Mercado Pago.

Un adicional de $50.000 implica $50.000 para el profesional antes de cargos de Mercado Pago, $0 de comisión Lysto y $0 de recargo. Su registro y la aceptación del cliente no alteran el presupuesto inicial ni crean un pago. Esta separación se verifica también en PostgreSQL con roles de cliente y profesional.

**Estos resultados son estimaciones de prueba, no presupuestos completos listos para cobrar.** Los materiales, el alcance técnico, las tarifas vigentes y la ruta real deben quedar verificados antes de ofrecer el trabajo. El recargo reduce exposición; no garantiza rentabilidad frente a costos omitidos.
`
await writeFile(new URL('informe-presupuestos.md',output),report,'utf8')
await writeFile(new URL('resumen.json',output),JSON.stringify({count,scenarioCount:scenarios.length,manualCases,route,totals},null,2),'utf8')
console.log(JSON.stringify({combinations:count,scenarios:scenarios.length,manualCases,report:new URL('informe-presupuestos.md',output).pathname}))
