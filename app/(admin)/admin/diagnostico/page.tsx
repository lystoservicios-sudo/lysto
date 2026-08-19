import { PageScaffold } from '@/components/layout/page-scaffold'
import { RecordList, RecordRow } from '@/components/business/record-list'

const causes = ['Carga de gas baja','Filtros sucios','Drenaje obstruido','Falla de capacitor','Falla de placa','Válvula inversora defectuosa','Problema de instalación']
export default function AdminDiagnosisPage() {
  return <PageScaffold title="Diagnóstico" eyebrow="Admin" description="Reglas de diagnóstico preliminar, textos para cliente y checklist técnico."><RecordList title="Causas configuradas">{causes.map((cause) => <RecordRow key={cause} title={cause} subtitle="Regla activa para aire acondicionado. Se guarda score interno y resumen para técnico." meta="aire_acondicionado" />)}</RecordList></PageScaffold>
}
