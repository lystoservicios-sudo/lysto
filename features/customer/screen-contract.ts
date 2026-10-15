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
  { id: 'CUS-12', href: '/app/pagos', file: 'app/(customer)/app/pagos/page.tsx', title: 'Pagos y comprobantes' },
  { id: 'CUS-13', href: '/app/perfil', file: 'app/(customer)/app/perfil/page.tsx', title: 'Perfil del cliente' },
  { id: 'CUS-14', href: '/app/direcciones', file: 'app/(customer)/app/direcciones/page.tsx', title: 'Direcciones y acceso' },
  { id: 'CUS-15', href: '/app/hogar', file: 'app/(customer)/app/hogar/page.tsx', title: 'Mi hogar' },
  { id: 'CUS-16', href: '/app/mas', file: 'app/(customer)/app/mas/page.tsx', title: 'Más opciones' },
  { id: 'CUS-17', href: '/app/perfil/correo', file: 'app/(customer)/app/perfil/correo/page.tsx', title: 'Cambiar correo' },
  { id: 'CUS-18', href: '/app/preferencias', file: 'app/(customer)/app/preferencias/page.tsx', title: 'Notificaciones y preferencias' },
  { id: 'CUS-19', href: '/app/seguridad', file: 'app/(customer)/app/seguridad/page.tsx', title: 'Seguridad y cuenta' },
  { id: 'CUS-20', href: '/app/seguridad/contrasena', file: 'app/(customer)/app/seguridad/contrasena/page.tsx', title: 'Cambiar contraseña' },
  { id: 'CUS-21', href: '/app/seguridad/sesiones', file: 'app/(customer)/app/seguridad/sesiones/page.tsx', title: 'Sesiones y dispositivos' },
  { id: 'CUS-22', href: '/app/seguridad/privacidad', file: 'app/(customer)/app/seguridad/privacidad/page.tsx', title: 'Privacidad y gestión de cuenta' },
  { id: 'CUS-23', href: '/app/mas/terminos', file: 'app/(customer)/app/mas/terminos/page.tsx', title: 'Términos del servicio' },
  { id: 'CUS-24', href: '/app/mas/privacidad', file: 'app/(customer)/app/mas/privacidad/page.tsx', title: 'Privacidad' },
  { id: 'CUS-25', href: '/app/pagos/[id]', file: 'app/(customer)/app/pagos/[id]/page.tsx', title: 'Detalle del pago' },
  { id: 'CUS-26', href: '/app/pagos/[id]/comprobante', file: 'app/(customer)/app/pagos/[id]/comprobante/page.tsx', title: 'Comprobante de pago' },
  { id: 'CUS-27', href: '/app/pagos/[id]/reintegros/[refundId]', file: 'app/(customer)/app/pagos/[id]/reintegros/[refundId]/page.tsx', title: 'Detalle del reintegro' },
  { id: 'CUS-28', href: '/app/ayuda', file: 'app/(customer)/app/ayuda/page.tsx', title: 'Ayuda y mis consultas' },
  { id: 'CUS-29', href: '/app/ayuda/articulos/[slug]', file: 'app/(customer)/app/ayuda/articulos/[slug]/page.tsx', title: 'Artículo de ayuda' },
  { id: 'CUS-30', href: '/app/ayuda/nueva', file: 'app/(customer)/app/ayuda/nueva/page.tsx', title: 'Nueva consulta' },
  { id: 'CUS-31', href: '/app/ayuda/consultas', file: 'app/(customer)/app/ayuda/consultas/page.tsx', title: 'Mis consultas' },
  { id: 'CUS-32', href: '/app/ayuda/consultas/[id]', file: 'app/(customer)/app/ayuda/consultas/[id]/page.tsx', title: 'Detalle de consulta' },
  { id: 'CUS-33', href: '/app/garantias/[jobId]', file: 'app/(customer)/app/garantias/[jobId]/page.tsx', title: 'Detalle de garantía' },
  { id: 'CUS-34', href: '/app/garantias/[jobId]/reclamar', file: 'app/(customer)/app/garantias/[jobId]/reclamar/page.tsx', title: 'Informar un problema' }
] as const satisfies readonly CustomerScreenRoute[]
