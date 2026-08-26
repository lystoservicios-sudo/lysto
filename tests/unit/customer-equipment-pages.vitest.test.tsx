import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomerEquipmentDetail } from '@/components/customer/customer-equipment-detail'
import { CustomerEquipmentInventory } from '@/components/customer/customer-equipment-inventory'
import { CustomerMaintenanceCenter } from '@/components/customer/customer-maintenance-center'
import { MaintenanceReminderCard } from '@/components/customer/maintenance-reminder-card'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import type { CustomerEquipmentViewModel, CustomerMaintenanceViewModel, CustomerWarrantyViewModel } from '@/features/customer/view-models'

afterEach(() => cleanup())

const equipmentWithHistory: CustomerEquipmentViewModel = {
  ...customerDemoFixtures.equipment[0],
  statusView: { label: 'Con historial', tone: 'success' },
  roomLabel: 'Living',
  capacityLabel: '3200 frigorías',
  serialNumber: 'SERIE-DEMO-3200',
  installedAt: '2023-11-10T12:00:00.000Z',
  serviceCount: 1,
  serviceHistory: [
    {
      id: 'service_demo_cleaning',
      jobId: 'job_demo_completed',
      performedAt: '2026-08-19T18:00:00.000Z',
      serviceType: 'Mantenimiento preventivo',
      result: 'Filtros limpios; circuito y drenaje operativos.',
      professionalName: 'Profesional de demostración',
      receiptAvailable: false
    }
  ]
}
const equipmentWithoutHistory: CustomerEquipmentViewModel = {
  ...customerDemoFixtures.equipment[1],
  statusView: { label: 'Sin historial', tone: 'neutral' },
  nextMaintenanceAt: '2026-08-20T12:00:00.000Z',
  serviceHistory: []
}
const overdueMaintenance: CustomerMaintenanceViewModel = {
  id: 'maintenance_demo_overdue',
  equipmentId: equipmentWithoutHistory.id,
  equipmentName: equipmentWithoutHistory.nickname,
  recommendation: 'Limpieza preventiva de filtros',
  dueAt: '2026-08-20T12:00:00.000Z',
  urgency: 'overdue',
  actionState: 'deferred'
}
const noRecommendation: CustomerMaintenanceViewModel = {
  id: 'maintenance_demo_none',
  equipmentId: 'eq_demo_study',
  equipmentName: 'Aire del estudio',
  recommendation: 'Sin mantenimiento recomendado',
  urgency: 'none',
  actionState: 'disabled'
}
const availableMaintenance: CustomerMaintenanceViewModel = {
  ...overdueMaintenance,
  id: 'maintenance_demo_available',
  actionState: 'available'
}

describe('customer equipment inventory', () => {
  it('summarizes equipment, overdue maintenance and service history', () => {
    render(<CustomerEquipmentInventory equipment={[equipmentWithHistory, equipmentWithoutHistory]} referenceDate="2026-08-25" />)

    expect(screen.getAllByText('Equipos registrados')[0].parentElement?.textContent).toContain('2')
    expect(screen.getAllByText('Servicios acumulados')[0].parentElement?.textContent).toContain('1')
    expect(screen.getAllByText('Mantenimientos vencidos')[0].parentElement?.textContent).toContain('1')
    expect(screen.getByRole('heading', { name: 'Aire del living' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Sin imagen de Aire del dormitorio' })).toBeTruthy()
  })

  it('covers loading, empty and recoverable error states', () => {
    const retry = vi.fn()
    const { rerender } = render(<CustomerEquipmentInventory equipment={[]} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Cargando equipos')

    rerender(<CustomerEquipmentInventory equipment={[]} state="empty" />)
    expect(screen.getByText('Todavía no tenés equipos registrados')).toBeTruthy()

    rerender(<CustomerEquipmentInventory equipment={[]} state="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('customer equipment detail', () => {
  it('connects technical identity, location, history, warranty and maintenance', () => {
    const livingMaintenance = customerDemoFixtures.maintenance.find((item) => item.equipmentId === equipmentWithHistory.id)
    render(<CustomerEquipmentDetail equipment={equipmentWithHistory} warranty={customerDemoFixtures.warranties[0]} maintenance={livingMaintenance} />)

    expect(screen.getByRole('heading', { name: 'Aire del living' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ficha técnica' })).toBeTruthy()
    expect(screen.getByText('3200 frigorías')).toBeTruthy()
    expect(screen.getByText('Dirección de demostración, CABA')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Historial de servicios' })).toBeTruthy()
    expect(screen.getByText('Filtros limpios; circuito y drenaje operativos.')).toBeTruthy()
    expect(screen.getByText('Cobertura vigente')).toBeTruthy()
    expect(screen.getByText('Limpieza profunda semestral')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ver comprobante' })).toBeNull()
  })

  it('shows incomplete equipment data without inventing history or warranty', () => {
    render(<CustomerEquipmentDetail equipment={equipmentWithoutHistory} />)

    expect(screen.getByText('Modelo no informado')).toBeTruthy()
    expect(screen.getByText('Todavía no hay servicios registrados')).toBeTruthy()
    expect(screen.getByText('Sin garantía vinculada')).toBeTruthy()
  })

  it('does not present an expired warranty as active coverage', () => {
    const expiredWarranty: CustomerWarrantyViewModel = {
      ...customerDemoFixtures.warranties[0],
      status: 'expired',
      statusView: { label: 'Cobertura vencida', tone: 'danger' }
    }
    render(<CustomerEquipmentDetail equipment={equipmentWithHistory} warranty={expiredWarranty} />)

    expect(screen.getByText('Cobertura vencida').parentElement?.className).toContain('border-red-200')
    expect(screen.getByText(/Venció/).textContent).toContain('19 sept 2026')
  })
})

describe('customer maintenance center', () => {
  it('educates before presenting overdue and no-recommendation states', () => {
    render(<CustomerMaintenanceCenter maintenance={[overdueMaintenance, noRecommendation]} />)

    expect(screen.getByRole('heading', { name: 'Cuidar el equipo también es parte del servicio' })).toBeTruthy()
    expect(screen.getByText('Vencido')).toBeTruthy()
    expect(screen.getByText('Sin recomendación vigente')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Solicitar mantenimiento' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('La coordinación se habilitará cuando exista una acción conectada.')).toBeTruthy()
  })

  it('shows an honest empty state when there are no recommendations', () => {
    render(<CustomerMaintenanceCenter maintenance={[]} state="empty" />)
    expect(screen.getByText('No hay recomendaciones de mantenimiento')).toBeTruthy()
  })

  it('announces the result when maintenance coordination becomes available', async () => {
    const onRequest = vi.fn().mockResolvedValue({ ok: true, message: 'Solicitud de mantenimiento recibida.' })
    render(<MaintenanceReminderCard reminder={availableMaintenance} onRequest={onRequest} />)

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar mantenimiento' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Solicitud de mantenimiento recibida.'))
    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('turns rejected coordination into an accessible error', async () => {
    const onRequest = vi.fn().mockRejectedValue(new Error('network unavailable'))
    render(<MaintenanceReminderCard reminder={availableMaintenance} onRequest={onRequest} />)

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar mantenimiento' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No pudimos coordinar el mantenimiento.'))
  })
})
