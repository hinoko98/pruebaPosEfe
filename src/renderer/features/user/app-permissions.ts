import { buildPermissionKey } from "./roles.catalog";

const INTERFACE_PERMISSION_KEYS = {
  posAccess: buildPermissionKey("Acceso a interfaces", "Operacion comercial", "Acceder a Facturar"),
  salesAccess: buildPermissionKey("Acceso a interfaces", "Operacion comercial", "Acceder a Historial ventas"),
  customersAccess: buildPermissionKey("Acceso a interfaces", "Operacion comercial", "Acceder a Clientes"),
  purchasesAccess: buildPermissionKey("Acceso a interfaces", "Operacion comercial", "Acceder a Compras"),
  suppliersAccess: buildPermissionKey("Acceso a interfaces", "Operacion comercial", "Acceder a Proveedores"),
  cashAccess: buildPermissionKey("Acceso a interfaces", "Caja y corresponsal", "Acceder a Caja general"),
  correspondentAccess: buildPermissionKey("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal transacciones"),
  correspondentHistoryAccess: buildPermissionKey("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal historial"),
  correspondentClosuresAccess: buildPermissionKey("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal resumen diario"),
  correspondentSettingsAccess: buildPermissionKey("Acceso a interfaces", "Caja y corresponsal", "Acceder a Corresponsal configuracion"),
  productsAccess: buildPermissionKey("Acceso a interfaces", "Inventario", "Acceder a Productos"),
  stockMovesAccess: buildPermissionKey("Acceso a interfaces", "Inventario", "Acceder a Movimientos de inventario"),
  accountingAccess: buildPermissionKey("Acceso a interfaces", "Control financiero", "Acceder a Centro contable"),
  reportsAccess: buildPermissionKey("Acceso a interfaces", "Control financiero", "Acceder a Reportes"),
  usersAccess: buildPermissionKey("Acceso a interfaces", "Gestion y sistema", "Acceder a Usuarios"),
  rolesAccess: buildPermissionKey("Acceso a interfaces", "Gestion y sistema", "Acceder a Roles y permisos"),
  settingsAccess: buildPermissionKey("Acceso a interfaces", "Gestion y sistema", "Acceder a Configuracion"),
} as const;

const ACTION_PERMISSION_KEYS = {
  salesCreate: buildPermissionKey("POS", "Operacion POS", "Crear ventas desde POS"),
  salesChangeCustomer: buildPermissionKey("POS", "Operacion POS", "Cambiar cliente en la factura"),
  salesManagePayments: buildPermissionKey("POS", "Operacion POS", "Gestionar pagos en efectivo, transferencia y combinado"),
  salesHistory: buildPermissionKey("POS", "Operacion POS", "Ver historial de ventas"),
  salesPrint: buildPermissionKey("POS", "Operacion POS", "Imprimir factura"),
  salesEditItemPrices: buildPermissionKey(
    "Contabilidad",
    "Facturas de venta",
    "Editar precios de los items de venta en facturas"
  ),
  cashOpen: buildPermissionKey("POS", "Caja y control diario", "Abrir caja"),
  cashClose: buildPermissionKey("POS", "Caja y control diario", "Cerrar caja"),
  cashView: buildPermissionKey("POS", "Caja y control diario", "Consultar resumen de caja"),
  productsView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de items"),
  productsCreate: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Crear nuevos items de venta"),
  productsEdit: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Editar items"),
  productsDelete: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Eliminar items"),
  stockMovesView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de ajustes de inventario"),
  purchasesView: buildPermissionKey("Contabilidad", "Compras y proveedores", "Ver listado de facturas de proveedores"),
  purchasesDetails: buildPermissionKey("Contabilidad", "Compras y proveedores", "Ver detalles de facturas de proveedores"),
  purchasesCreate: buildPermissionKey("Contabilidad", "Compras y proveedores", "Crear nuevas facturas de proveedores"),
  suppliersView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de proveedores"),
  suppliersCreate: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  suppliersEdit: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  usersView: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Ver usuarios"),
  usersCreate: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Crear usuarios"),
  usersEdit: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Editar usuarios"),
  rolesView: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Ver roles y permisos"),
  rolesManage: buildPermissionKey("Configuraciones generales", "Usuarios y seguridad", "Administrar el rol Administrador"),
  customersView: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Ver listado de clientes"),
  customersCreate: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Agregar nuevos contactos"),
  customersEdit: buildPermissionKey("Contabilidad", "Items, inventario y contactos", "Editar contactos"),
  correspondentView: buildPermissionKey("POS", "Operacion de tienda", "Gestionar corresponsal"),
  reportsView: buildPermissionKey("Contabilidad", "Reportes comerciales y financieros", "Ver reporte de ventas generales"),
  settingsView: buildPermissionKey("Configuraciones generales", "Negocio y sistema", "Editar configuracion general del negocio"),
  settingsTheme: buildPermissionKey("Configuraciones generales", "Interfaz del sistema", "Cambiar tema del sistema"),
  settingsBusiness: buildPermissionKey("Configuraciones generales", "Datos del negocio", "Editar datos del negocio"),
  settingsBilling: buildPermissionKey("Configuraciones generales", "Facturacion e impresion", "Configurar factura e impresion"),
  settingsInventory: buildPermissionKey("Configuraciones generales", "Inventario y operacion", "Configurar inventario y comportamiento de venta"),
} as const;

export const APP_PERMISSION_KEYS = {
  ...INTERFACE_PERMISSION_KEYS,
  ...ACTION_PERMISSION_KEYS,
} as const;

const ACCESS_PERMISSION_ALIASES: Record<string, string[]> = {
  [APP_PERMISSION_KEYS.posAccess]: [
    APP_PERMISSION_KEYS.salesCreate,
    APP_PERMISSION_KEYS.salesChangeCustomer,
    APP_PERMISSION_KEYS.salesManagePayments,
    APP_PERMISSION_KEYS.salesHistory,
    APP_PERMISSION_KEYS.salesPrint,
  ],
  [APP_PERMISSION_KEYS.salesAccess]: [
    APP_PERMISSION_KEYS.salesHistory,
    APP_PERMISSION_KEYS.salesPrint,
  ],
  [APP_PERMISSION_KEYS.customersAccess]: [
    APP_PERMISSION_KEYS.customersView,
    APP_PERMISSION_KEYS.customersCreate,
    APP_PERMISSION_KEYS.customersEdit,
  ],
  [APP_PERMISSION_KEYS.purchasesAccess]: [
    APP_PERMISSION_KEYS.purchasesView,
    APP_PERMISSION_KEYS.purchasesDetails,
    APP_PERMISSION_KEYS.purchasesCreate,
  ],
  [APP_PERMISSION_KEYS.suppliersAccess]: [
    APP_PERMISSION_KEYS.suppliersView,
    APP_PERMISSION_KEYS.suppliersCreate,
    APP_PERMISSION_KEYS.suppliersEdit,
  ],
  [APP_PERMISSION_KEYS.cashAccess]: [
    APP_PERMISSION_KEYS.cashView,
    APP_PERMISSION_KEYS.cashOpen,
    APP_PERMISSION_KEYS.cashClose,
  ],
  [APP_PERMISSION_KEYS.correspondentAccess]: [APP_PERMISSION_KEYS.correspondentView],
  [APP_PERMISSION_KEYS.correspondentHistoryAccess]: [APP_PERMISSION_KEYS.correspondentView],
  [APP_PERMISSION_KEYS.correspondentClosuresAccess]: [APP_PERMISSION_KEYS.correspondentView, APP_PERMISSION_KEYS.cashView],
  [APP_PERMISSION_KEYS.correspondentSettingsAccess]: [APP_PERMISSION_KEYS.correspondentView],
  [APP_PERMISSION_KEYS.productsAccess]: [
    APP_PERMISSION_KEYS.productsView,
    APP_PERMISSION_KEYS.productsCreate,
    APP_PERMISSION_KEYS.productsEdit,
    APP_PERMISSION_KEYS.productsDelete,
  ],
  [APP_PERMISSION_KEYS.stockMovesAccess]: [
    APP_PERMISSION_KEYS.stockMovesView,
    APP_PERMISSION_KEYS.productsEdit,
  ],
  [APP_PERMISSION_KEYS.accountingAccess]: [APP_PERMISSION_KEYS.reportsView],
  [APP_PERMISSION_KEYS.reportsAccess]: [APP_PERMISSION_KEYS.reportsView],
  [APP_PERMISSION_KEYS.usersAccess]: [
    APP_PERMISSION_KEYS.usersView,
    APP_PERMISSION_KEYS.usersCreate,
    APP_PERMISSION_KEYS.usersEdit,
  ],
  [APP_PERMISSION_KEYS.rolesAccess]: [
    APP_PERMISSION_KEYS.rolesView,
    APP_PERMISSION_KEYS.rolesManage,
  ],
  [APP_PERMISSION_KEYS.settingsAccess]: [
    APP_PERMISSION_KEYS.settingsView,
    APP_PERMISSION_KEYS.settingsTheme,
    APP_PERMISSION_KEYS.settingsBusiness,
    APP_PERMISSION_KEYS.settingsBilling,
    APP_PERMISSION_KEYS.settingsInventory,
  ],
};

const LEGACY_PERMISSION_FALLBACKS: Record<string, string[]> = {
  [APP_PERMISSION_KEYS.settingsTheme]: [APP_PERMISSION_KEYS.settingsView],
  [APP_PERMISSION_KEYS.settingsBusiness]: [APP_PERMISSION_KEYS.settingsView],
  [APP_PERMISSION_KEYS.settingsBilling]: [APP_PERMISSION_KEYS.settingsView],
  [APP_PERMISSION_KEYS.settingsInventory]: [APP_PERMISSION_KEYS.settingsView],
};

const LEGACY_PERMISSION_REPLACEMENTS: Record<string, string[]> = {
  [APP_PERMISSION_KEYS.settingsView]: [
    APP_PERMISSION_KEYS.settingsTheme,
    APP_PERMISSION_KEYS.settingsBusiness,
    APP_PERMISSION_KEYS.settingsBilling,
    APP_PERMISSION_KEYS.settingsInventory,
  ],
};

const EXPANDABLE_PERMISSION_KEYS = [
  ...Object.keys(ACCESS_PERMISSION_ALIASES),
  ...Object.keys(LEGACY_PERMISSION_FALLBACKS),
];

export function getCompatiblePermissionKeys(permissionKey?: string) {
  if (!permissionKey) return [];
  return [
    permissionKey,
    ...(ACCESS_PERMISSION_ALIASES[permissionKey] ?? []),
    ...(LEGACY_PERMISSION_FALLBACKS[permissionKey] ?? []),
  ];
}

export function hasPermissionKey(permissionKeys: string[] | null | undefined, permissionKey?: string) {
  if (!permissionKey) return true;
  const currentKeys = permissionKeys ?? [];
  return getCompatiblePermissionKeys(permissionKey).some((candidate) => currentKeys.includes(candidate));
}

export function expandPermissionKeys(permissionKeys: string[] | null | undefined) {
  const expanded = new Set(permissionKeys ?? []);
  for (const permissionKey of EXPANDABLE_PERMISSION_KEYS) {
    if (hasPermissionKey(Array.from(expanded), permissionKey)) {
      expanded.add(permissionKey);
    }
  }
  return Array.from(expanded);
}

export function normalizeStoredPermissionKeys(permissionKeys: string[] | null | undefined) {
  const normalized = new Set<string>();

  for (const permissionKey of permissionKeys ?? []) {
    const replacements = LEGACY_PERMISSION_REPLACEMENTS[permissionKey];
    if (replacements) {
      for (const replacement of replacements) {
        normalized.add(replacement);
      }
      continue;
    }

    normalized.add(permissionKey);
  }

  return Array.from(normalized);
}
