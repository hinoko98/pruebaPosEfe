export type AppRoleKey = "ADMIN" | "EMPLOYEE";

export type PermissionGroup = {
  title: string;
  permissions: string[];
};

export type PermissionSection = {
  title: string;
  groups: PermissionGroup[];
};

export type RoleDefinition = {
  key: AppRoleKey;
  name: string;
  description: string;
  sections: PermissionSection[];
};

const interfaceAccessSection: PermissionSection = {
  title: "Acceso a interfaces",
  groups: [
    {
      title: "Operacion comercial",
      permissions: [
        "Acceder a Facturar",
        "Acceder a Historial ventas",
        "Acceder a Clientes",
        "Acceder a Compras",
        "Acceder a Proveedores",
      ],
    },
    {
      title: "Caja y corresponsal",
      permissions: [
        "Acceder a Caja general",
        "Acceder a Corresponsal transacciones",
        "Acceder a Corresponsal historial",
        "Acceder a Corresponsal resumen diario",
        "Acceder a Corresponsal configuracion",
      ],
    },
    {
      title: "Inventario",
      permissions: [
        "Acceder a Productos",
        "Acceder a Movimientos de inventario",
      ],
    },
    {
      title: "Control financiero",
      permissions: [
        "Acceder a Centro contable",
        "Acceder a Reportes",
      ],
    },
    {
      title: "Gestion y sistema",
      permissions: [
        "Acceder a Usuarios",
        "Acceder a Roles y permisos",
        "Acceder a Configuracion",
      ],
    },
  ],
};

const adminSections: PermissionSection[] = [
  interfaceAccessSection,
  {
    title: "Contabilidad",
    groups: [
      {
        title: "Inicio y documentos",
        permissions: [
          "Ver detalle de operaciones",
          "Ver graficas y tablas de la pagina de inicio",
          "Eliminar archivos adjuntos en documentos",
        ],
      },
      {
        title: "Facturas de venta",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas facturas",
          "Editar facturas por cobrar",
          "Editar facturas borrador",
          "Editar descuentos en facturas",
          "Editar precios de los items de venta en facturas",
          "Eliminar",
          "Anular",
          "Exportar facturas en Excel",
          "Convertir facturas en recurrentes",
        ],
      },
      {
        title: "Facturas recurrentes",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas facturas recurrentes",
          "Editar facturas recurrentes",
          "Eliminar",
        ],
      },
      {
        title: "Notas de credito",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas notas de credito",
          "Editar notas de credito",
          "Eliminar",
          "Exportar notas de credito en Excel",
        ],
      },
      {
        title: "Cotizaciones",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas cotizaciones",
          "Editar cotizaciones",
          "Editar descuentos en cotizaciones",
          "Editar precios de productos de venta en cotizaciones",
          "Eliminar",
          "Exportar cotizaciones en Excel",
        ],
      },
      {
        title: "Remisiones",
        permissions: [
          "Ver listado",
          "Ver detalles",
          "Crear nuevas remisiones",
          "Editar",
          "Editar descuento",
          "Editar precios de items de venta en remisiones",
          "Eliminar",
          "Anular",
          "Exportar remisiones en Excel",
          "Editar plantillas de impresion",
        ],
      },
      {
        title: "Terminos, numeraciones y vendedores",
        permissions: [
          "Crear nuevos terminos de pago",
          "Editar terminos de pago",
          "Eliminar terminos de pago",
          "Crear nuevas numeraciones",
          "Editar numeraciones",
          "Eliminar numeraciones",
          "Activar o desactivar numeraciones",
          "Crear nuevos vendedores",
          "Editar vendedores",
          "Eliminar vendedores",
          "Activar o desactivar vendedores",
        ],
      },
      {
        title: "Compras y proveedores",
        permissions: [
          "Ver listado de facturas de proveedores",
          "Ver detalles de facturas de proveedores",
          "Crear nuevas facturas de proveedores",
          "Editar facturas de proveedores",
          "Exportar facturas de proveedores en Excel",
          "Eliminar facturas de proveedores",
          "Crear nuevos pagos recurrentes",
          "Editar pagos recurrentes",
          "Eliminar pagos recurrentes",
          "Crear nuevas ordenes de compra",
          "Editar ordenes de compra",
          "Eliminar ordenes de compra",
          "Anular ordenes de compra",
          "Exportar ordenes de compra en Excel",
        ],
      },
      {
        title: "Notas debito, pagos y gastos",
        permissions: [
          "Crear nuevas notas debito",
          "Editar notas debito",
          "Eliminar notas debito",
          "Anular notas debito",
          "Exportar notas debito",
          "Crear pago menor",
          "Ver detalle de pago menor",
          "Editar pago menor",
          "Eliminar pago menor",
          "Anular pago menor",
          "Ver listado de recibos de caja",
          "Ver detalles de recibos de caja",
          "Crear nuevos recibos de caja",
          "Editar recibos de caja",
          "Ver listado de gastos",
          "Ver detalles de gastos",
          "Crear nuevos comprobantes de egreso",
          "Editar comprobantes de egreso",
          "Eliminar comprobantes de egreso",
          "Anular comprobantes de egreso",
          "Exportar transacciones en Excel",
        ],
      },
      {
        title: "Bancos e integraciones",
        permissions: [
          "Ver listado de bancos",
          "Ver detalles de bancos",
          "Agregar nuevos bancos",
          "Editar bancos",
          "Eliminar bancos",
          "Ver saldos",
          "Conciliar bancos",
          "Activar o desactivar bancos",
          "Activar integraciones bancarias",
          "Crear conexion con banco",
          "Borrar conexion con banco",
          "Ver listado de conexiones con bancos",
          "Actualizar conexion con banco",
        ],
      },
      {
        title: "Reportes comerciales y financieros",
        permissions: [
          "Ver reporte de ventas generales",
          "Exportar reporte de ventas generales",
          "Ver reporte de ventas por item",
          "Exportar reporte de ventas por item",
          "Ver reporte de ventas por cliente",
          "Exportar reporte de ventas por cliente",
          "Ver rentabilidad por item",
          "Exportar rentabilidad por item",
          "Ver ventas por vendedor",
          "Exportar ventas por vendedor",
          "Ver estado de cuenta de clientes",
          "Exportar estado de cuenta de clientes",
          "Exportar reporte de ventas diarias",
          "Exportar ventas con exencion de IVA",
          "Ver reporte de cuentas por cobrar",
          "Exportar reporte de cuentas por cobrar",
          "Ver reporte de cuentas por pagar",
          "Exportar reporte de cuentas por pagar",
          "Ver reporte de ingresos y gastos",
          "Exportar reporte de ingresos y gastos",
          "Ver reporte de flujo de efectivo",
          "Exportar reporte de flujo de efectivo",
          "Ver reporte de inventario valorizado",
          "Exportar reporte de inventario valorizado",
          "Ver reporte de transacciones",
          "Exportar reporte de transacciones",
          "Ver reporte de compras",
          "Exportar reporte de compras",
          "Ver reporte anual",
          "Ver estado de resultados",
          "Exportar estado de resultados",
          "Ver estado de situacion financiera",
          "Exportar estado de situacion financiera",
          "Ver reporte de movimientos por cuenta contable",
          "Exportar reporte de movimientos por cuenta contable",
          "Ver libro diario",
          "Exportar libro diario",
          "Ver reporte de auxiliar por tercero",
          "Exportar reporte de auxiliar por tercero",
          "Ver balance de prueba",
          "Exportar balance de prueba",
          "Exportar balance de prueba por tercero",
          "Ver diferencia en cambio de bancos",
          "Ver flujo de caja",
          "Compartir reportes",
        ],
      },
      {
        title: "Impuestos, DIAN y configuracion tributaria",
        permissions: [
          "Ver configuracion",
          "Editar configuracion",
          "Sincronizar datos desde la DIAN",
          "Ver reporte detallado de impuesto",
          "Exportar reporte detallado de impuestos",
          "Ver reporte DIOT",
          "Exportar reporte DIOT",
          "Exportar comprobante de informe diario",
          "Ver Formulario 350",
          "Exportar Formulario 350",
          "Ver certificados de retencion",
          "Exportar certificados de retencion",
          "Configurar informacion exogena",
          "Exportar reportes exogena",
          "Exportar informe contador",
        ],
      },
      {
        title: "Items, inventario y contactos",
        permissions: [
          "Ver listado de items",
          "Ver costos del negocio",
          "Ver detalles de items",
          "Crear nuevos items de venta",
          "Editar items",
          "Eliminar items",
          "Exportar listado de items en Excel",
          "Importar listado de items desde Excel",
          "Actualizar masivamente los items de venta",
          "Ver listado de ajustes de inventario",
          "Ver detalles de ajustes de inventario",
          "Agregar nuevos ajustes de inventario",
          "Editar ajustes de inventario",
          "Eliminar ajustes de inventario",
          "Exportar ajustes de inventario en Excel",
          "Importar ajustes de inventario con AI",
          "Crear nuevas variantes",
          "Editar variantes",
          "Eliminar variantes",
          "Activar o desactivar variantes",
          "Crear nuevos campos adicionales",
          "Editar campos adicionales",
          "Eliminar campos adicionales",
          "Activar o desactivar campos adicionales",
          "Crear nuevos almacenes",
          "Editar almacenes",
          "Eliminar almacenes",
          "Activar o desactivar almacenes",
          "Crear nuevas transferencias",
          "Editar transferencias",
          "Eliminar transferencias",
          "Crear nuevas listas de precios",
          "Editar listas de precios",
          "Eliminar listas de precios",
          "Ver todos los contactos",
          "Ver listado de clientes",
          "Ver listado de proveedores",
          "Ver detalles de todos los contactos",
          "Ver detalles de clientes",
          "Ver detalles de proveedores",
          "Agregar nuevos contactos",
          "Editar contactos",
          "Eliminar contactos",
          "Exportar listado de contactos en Excel",
          "Importar contactos desde Excel",
          "Usar los contactos registrados",
          "Editar limites de credito",
        ],
      },
      {
        title: "Contabilidad general",
        permissions: [
          "Ver listado de cuentas contables",
          "Ver detalles de cuentas contables",
          "Agregar nuevas cuentas contables",
          "Editar cuentas contables",
          "Eliminar cuentas contables",
          "Importar cuentas contables",
          "Exportar cuentas contables",
          "Ver listado de asientos contables",
          "Ver detalles de asientos contables",
          "Agregar nuevos asientos contables",
          "Editar asientos contables",
          "Eliminar asientos contables",
          "Exportar asientos contables",
          "Importar asientos contables",
          "Agregar nuevos tipos de comprobante contable",
          "Editar tipos de comprobante contable",
          "Eliminar tipos de comprobante contable",
          "Abrir o cerrar periodos contables",
          "Crear numeracion contable",
          "Editar numeracion contable",
          "Eliminar numeracion contable",
          "Ver detalles de numeracion contable",
          "Listar numeraciones contables",
          "Actualizar estado de numeracion contable",
          "Ver conciliador fiscal",
          "Editar conciliador fiscal",
          "Editar informacion general",
          "Agregar nuevas monedas",
          "Editar monedas",
          "Eliminar monedas",
          "Agregar nuevos centros de costos",
          "Editar centros de costos",
          "Eliminar centros de costos",
          "Activar o desactivar centros de costos",
          "Agregar nuevas retenciones",
          "Editar retenciones",
          "Eliminar retenciones",
          "Activar o desactivar retenciones",
          "Agregar nuevos impuestos",
          "Editar impuestos",
          "Eliminar impuestos",
          "Activar o desactivar impuestos",
          "Detalle de operaciones: ver listado",
          "Detalle de operaciones: ver detalles",
          "Detalle de operaciones: agregar",
          "Detalle de operaciones: editar",
          "Detalle de operaciones: eliminar",
          "Registrar depreciacion",
        ],
      },
    ],
  },
  {
    title: "POS",
    groups: [
      {
        title: "Operacion POS",
        permissions: [
          "Acceder al modulo Facturar",
          "Crear ventas desde POS",
          "Cambiar cliente en la factura",
          "Gestionar pagos en efectivo, transferencia y combinado",
          "Ver historial de ventas",
          "Anular ventas",
          "Imprimir factura",
        ],
      },
      {
        title: "Caja y control diario",
        permissions: [
          "Abrir caja",
          "Cerrar caja",
          "Registrar movimientos manuales",
          "Ver arqueos y diferencias",
          "Consultar resumen de caja",
        ],
      },
      {
        title: "Operacion de tienda",
        permissions: [
          "Ver productos y stock",
          "Crear productos",
          "Editar productos",
          "Archivar productos",
          "Ver clientes",
          "Crear clientes",
          "Editar clientes",
          "Ver compras y proveedores",
          "Gestionar corresponsal",
        ],
      },
    ],
  },
  {
    title: "Configuraciones generales",
    groups: [
      {
        title: "Usuarios y seguridad",
        permissions: [
          "Ver usuarios",
          "Crear usuarios",
          "Editar usuarios",
          "Activar o desactivar usuarios",
          "Ver roles y permisos",
          "Administrar el rol Administrador",
          "Puede agregar o eliminar usuarios",
        ],
      },
      {
        title: "Negocio y sistema",
        permissions: [
          "Editar configuracion general del negocio",
          "Editar informacion fiscal",
          "Configurar numeraciones",
          "Configurar impuestos",
          "Configurar listas de precios",
          "Configurar almacenes",
          "Sincronizar informacion",
        ],
      },
    ],
  },
];

const employeeSections: PermissionSection[] = [
  interfaceAccessSection,
  {
    title: "POS",
    groups: [
      {
        title: "Operacion POS",
        permissions: [
          "Acceder al modulo Facturar",
          "Crear ventas desde POS",
          "Gestionar pago en efectivo",
          "Gestionar pago por transferencia",
          "Ver historial de ventas",
          "Imprimir factura",
        ],
      },
      {
        title: "Caja y tienda",
        permissions: [
          "Abrir caja",
          "Cerrar caja",
          "Ver resumen de caja",
          "Ver productos y stock",
          "Ver clientes",
          "Crear clientes",
        ],
      },
    ],
  },
  {
    title: "Configuraciones generales",
    groups: [
      {
        title: "Restricciones",
        permissions: [
          "Sin acceso a crear usuarios",
          "Sin acceso a editar roles",
          "Sin acceso a configuraciones fiscales",
          "Sin acceso a reportes financieros avanzados",
        ],
      },
    ],
  },
];

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "ADMIN",
    name: "Administrador",
    description:
      "Acceso completo a todas las secciones del sistema, puede agregar o eliminar usuarios y administrar la configuracion general.",
    sections: adminSections,
  },
  {
    key: "EMPLOYEE",
    name: "Empleado",
    description:
      "Acceso operativo para ventas y caja, con permisos limitados sobre configuracion, usuarios y reportes sensibles.",
    sections: employeeSections,
  },
];

export function getRoleDefinition(role: AppRoleKey) {
  return ROLE_DEFINITIONS.find((entry) => entry.key === role) ?? ROLE_DEFINITIONS[0];
}

export function flattenRolePermissions(role: RoleDefinition) {
  return role.sections.flatMap((section) =>
    section.groups.flatMap((group) => group.permissions.map((permission) => `${section.title} / ${group.title} / ${permission}`))
  );
}

export type PermissionCatalogItem = {
  key: string;
  label: string;
  sectionTitle: string;
  groupTitle: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildPermissionKey(sectionTitle: string, groupTitle: string, label: string) {
  return [slugify(sectionTitle), slugify(groupTitle), slugify(label)].filter(Boolean).join(".");
}

export function flattenRolePermissionCatalog(role: RoleDefinition): PermissionCatalogItem[] {
  return role.sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.permissions.map((permission) => ({
        key: buildPermissionKey(section.title, group.title, permission),
        label: permission,
        sectionTitle: section.title,
        groupTitle: group.title,
      }))
    )
  );
}

export function getPermissionCatalogItem(roleKey: AppRoleKey, permissionKey: string) {
  return flattenRolePermissionCatalog(getRoleDefinition(roleKey)).find((item) => item.key === permissionKey) ?? null;
}
