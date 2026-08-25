export type CustomerScreenRoute = {
  id: `CUS-${string}`
  href: string
  file: string
  title: string
}

export const customerScreenRoutes = [
  { id: 'CUS-01', href: '/app', file: 'app/(customer)/app/page.tsx', title: 'Panel principal' },
  { id: 'CUS-02', href: '/app/solicitar/aire-acondicionado', file: 'app/(customer)/app/solicitar/aire-acondicionado/page.tsx', title: 'Wizard para solicitar técnico' },
  { id: 'CUS-03', href: '/app/solicitudes', file: 'app/(customer)/app/solicitudes/page.tsx', title: 'Mis solicitudes' },
  { id: 'CUS-04', href: '/app/solicitudes/[id]', file: 'app/(customer)/app/solicitudes/[id]/page.tsx', title: 'Detalle de solicitud' },
  { id: 'CUS-05', href: '/app/trabajos', file: 'app/(customer)/app/trabajos/page.tsx', title: 'Mis trabajos' },
  { id: 'CUS-06', href: '/app/trabajos/[id]', file: 'app/(customer)/app/trabajos/[id]/page.tsx', title: 'Detalle y seguimiento del trabajo' },
  { id: 'CUS-07', href: '/app/trabajos/[id]/review', file: 'app/(customer)/app/trabajos/[id]/review/page.tsx', title: 'Calificar servicio' },
  { id: 'CUS-08', href: '/app/equipos', file: 'app/(customer)/app/equipos/page.tsx', title: 'Mis equipos' },
  { id: 'CUS-09', href: '/app/equipos/[id]', file: 'app/(customer)/app/equipos/[id]/page.tsx', title: 'Detalle del equipo' },
  { id: 'CUS-10', href: '/app/mantenimientos', file: 'app/(customer)/app/mantenimientos/page.tsx', title: 'Mantenimientos recomendados' },
  { id: 'CUS-11', href: '/app/garantias', file: 'app/(customer)/app/garantias/page.tsx', title: 'Garantías, reclamos y calidad' },
  { id: 'CUS-12', href: '/app/pagos', file: 'app/(customer)/app/pagos/page.tsx', title: 'Pagos y movimientos diferidos' },
  { id: 'CUS-13', href: '/app/perfil', file: 'app/(customer)/app/perfil/page.tsx', title: 'Perfil del cliente' },
  { id: 'CUS-14', href: '/app/direcciones', file: 'app/(customer)/app/direcciones/page.tsx', title: 'Direcciones y acceso' }
] as const satisfies readonly CustomerScreenRoute[]
