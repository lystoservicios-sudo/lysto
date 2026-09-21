export const customerPolicyVersion = '2026-09-21'
export const customerPolicyEffectiveDate = '21 de septiembre de 2026'

export type CustomerPolicy = {
  title: string
  version: string
  effectiveDate: string
  sections: readonly {
    title: string
    paragraphs: readonly string[]
  }[]
}

export const customerTermsPolicy: CustomerPolicy = {
  title: 'Términos del servicio',
  version: customerPolicyVersion,
  effectiveDate: customerPolicyEffectiveDate,
  sections: [
    {
      title: 'Alcance e identificación',
      paragraphs: [
        'Estos términos regulan la creación y el uso de una cuenta de cliente en Lysto, plataforma digital de gestión de servicios para el hogar con operación inicial en Buenos Aires, Argentina. Lysto es el nombre comercial con el que se presenta la plataforma. Las consultas se reciben por el canal /contacto.',
        'La creación de la cuenta es gratuita. Cada presupuesto o contratación posterior debe informar el prestador, alcance, precio final, condiciones y datos fiscales que correspondan antes de que el cliente acepte o pague.'
      ]
    },
    {
      title: 'Cuenta de cliente',
      paragraphs: [
        'El registro público es exclusivamente para clientes. Los profesionales, técnicos, operadores y administradores ingresan por circuitos separados y no obtienen permisos de personal mediante esta pantalla.',
        'La persona usuaria debe proporcionar datos verdaderos y mantenerlos actualizados, proteger su contraseña y avisar por el canal de contacto si detecta un acceso no autorizado. No se permite suplantar identidades, probar credenciales ajenas ni utilizar la plataforma para actividades ilícitas.'
      ]
    },
    {
      title: 'Solicitudes, diagnóstico y presupuesto',
      paragraphs: [
        'Lysto permite describir una necesidad, aportar información y coordinar una visita. Toda orientación remota es preliminar: el diagnóstico definitivo y la viabilidad del trabajo se confirman en el domicilio.',
        'Antes de contratar se presenta un presupuesto con alcance, importe en pesos argentinos, vigencia y condiciones. Un adicional requiere descripción, precio y aceptación independiente del cliente.'
      ]
    },
    {
      title: 'Profesionales y seguridad',
      paragraphs: [
        'Los profesionales acceden mediante un proceso separado de invitación y revisión. El cliente debe informar riesgos conocidos y facilitar un acceso razonablemente seguro. El trabajo puede detenerse ante un peligro para personas, instalaciones o equipos.',
        'La plataforma registra asignaciones, cambios de estado y evidencia operativa para acompañar el servicio y atender incidentes o reclamos.'
      ]
    },
    {
      title: 'Pagos',
      paragraphs: [
        'Cuando un servicio admita pago en línea, el cobro se procesa mediante un proveedor externo identificado en el checkout. Lysto no considera pagado un trabajo únicamente por el regreso del navegador o por una captura: prevalece la confirmación conciliada del proveedor y el registro del sistema.',
        'El cliente debe revisar importe, destinatario y estado antes de confirmar. Los reintegros, si corresponden, se cursan por el medio disponible y pueden requerir el plazo de procesamiento del proveedor de pago.'
      ]
    },
    {
      title: 'Cancelaciones, arrepentimiento y reclamos',
      paragraphs: [
        'Las condiciones aplicables de cancelación, reprogramación, baja o arrepentimiento se muestran antes de contratar y están disponibles en /cancelaciones y /contacto. Los derechos inderogables reconocidos por la normativa de defensa del consumidor prevalecen sobre estos términos.',
        'Los reclamos se registran con un identificador y se analizan según el servicio, la evidencia y el pago involucrado. La garantía concreta depende del alcance contratado y no puede reducir derechos legales del consumidor.'
      ]
    },
    {
      title: 'Disponibilidad y cambios',
      paragraphs: [
        'Lysto puede realizar mantenimiento, limitar temporalmente una función insegura o rechazar una solicitud fuera de cobertura o capacidad. Esto no autoriza a alterar un servicio ya aceptado ni a retener importes sin causa.',
        'Una modificación sustancial de estos términos se publica como una nueva versión. Cuando corresponda, se solicitará una nueva aceptación antes de continuar usando la función afectada.'
      ]
    },
    {
      title: 'Ley aplicable',
      paragraphs: [
        'Estos términos se interpretan conforme a las leyes de la República Argentina, en especial las normas de defensa del consumidor. Ninguna cláusula limita el acceso del cliente a las autoridades administrativas o judiciales competentes.'
      ]
    }
  ]
}

export const customerPrivacyPolicy: CustomerPolicy = {
  title: 'Privacidad',
  version: customerPolicyVersion,
  effectiveDate: customerPolicyEffectiveDate,
  sections: [
    {
      title: 'Responsable y contacto',
      paragraphs: [
        'Lysto determina las finalidades y medios del tratamiento de los datos utilizados para crear y operar la cuenta de cliente. Las consultas y solicitudes de privacidad se reciben mediante /contacto. La plataforma opera inicialmente en Buenos Aires, Argentina.'
      ]
    },
    {
      title: 'Datos tratados',
      paragraphs: [
        'Podemos tratar nombre, apellido, correo, teléfono, datos de autenticación, domicilio del servicio, información del equipo, disponibilidad, comunicaciones, presupuestos, pagos, reclamos e imágenes o archivos que la persona decida aportar.',
        'También se generan datos técnicos limitados, como identificadores de sesión, registros de seguridad, dispositivo, dirección de red reducida o protegida y eventos necesarios para prevenir abuso y diagnosticar fallas.'
      ]
    },
    {
      title: 'Finalidades',
      paragraphs: [
        'Los datos se utilizan para crear y proteger la cuenta, prestar y coordinar servicios, procesar y conciliar pagos, brindar soporte, atender garantías o reclamos, cumplir obligaciones legales, prevenir fraude y mejorar la confiabilidad del producto.',
        'No vendemos datos personales ni utilizamos los datos de una cuenta para publicidad de terceros. Las comunicaciones operativas necesarias para confirmar una cuenta, recuperar acceso o informar un servicio no son promociones.'
      ]
    },
    {
      title: 'Acceso y proveedores',
      paragraphs: [
        'El acceso se limita según la función: el cliente ve sus datos; un profesional sólo recibe lo necesario para un trabajo asignado; el personal autorizado accede para operar, dar soporte o investigar incidentes.',
        'Lysto utiliza proveedores de infraestructura, identidad, base de datos, correo, observabilidad y pagos, entre ellos Supabase, Vercel, Resend y Mercado Pago según la función activa. Pueden procesar información en otros países bajo sus contratos y medidas de seguridad.'
      ]
    },
    {
      title: 'Conservación',
      paragraphs: [
        'Los datos se conservan mientras la cuenta o un servicio estén activos y luego durante el tiempo necesario para atender reclamos, seguridad, obligaciones contables o legales y plazos aplicables. Cuando dejan de ser necesarios, se eliminan o anonimizan de manera segura.',
        'Una solicitud de supresión no obliga a borrar de inmediato registros que deban conservarse por una obligación legal, un pago, una disputa o la defensa de derechos; en esos casos se restringe su uso al motivo de conservación.'
      ]
    },
    {
      title: 'Tus derechos',
      paragraphs: [
        'La persona titular puede solicitar información, acceso, actualización, rectificación o supresión de sus datos y retirar consentimientos cuando el tratamiento dependa de ellos. Para ejercerlos debe usar /contacto y acreditar razonablemente su identidad.',
        'Si la respuesta no resulta satisfactoria, puede acudir ante la Agencia de Acceso a la Información Pública, autoridad de aplicación de la Ley 25.326, en https://www.argentina.gob.ar/aaip.'
      ]
    },
    {
      title: 'Seguridad y menores',
      paragraphs: [
        'Aplicamos controles de acceso, sesiones protegidas, archivos privados, enlaces con vencimiento y registro de acciones sensibles. Ningún sistema es infalible; ante un incidente relevante se aplican medidas de contención y las comunicaciones exigidas por la normativa.',
        'La cuenta está destinada a personas con capacidad para contratar. No se solicita deliberadamente que menores creen cuentas ni que se carguen datos sensibles que no sean necesarios para el servicio.'
      ]
    },
    {
      title: 'Cambios de esta política',
      paragraphs: [
        'Los cambios se publican con una nueva versión y fecha de vigencia. Cuando una modificación requiera consentimiento, se solicitará una nueva aceptación antes de aplicar el tratamiento correspondiente.'
      ]
    }
  ]
}

export function canonicalPolicyText(policy: CustomerPolicy) {
  return [
    `# ${policy.title}`,
    `Versión: ${policy.version}`,
    `Vigente desde: ${policy.effectiveDate}`,
    ...policy.sections.flatMap((section) => [
      `## ${section.title}`,
      ...section.paragraphs
    ])
  ].join('\n\n')
}
