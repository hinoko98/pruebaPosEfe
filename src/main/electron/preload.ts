import { contextBridge, ipcRenderer } from "electron";
import type { LoginInput, LoginResult, CreateUserInput, UpdateUserInput } from "./ipc/schemas/auth.schema";
import type {
  CreateCorrespondentClosureInput,
  CreateCorrespondentTransactionInput,
  ListCorrespondentClosuresInput,
  ListCorrespondentTransactionsInput,
} from "./ipc/schemas/correspondent.schema";
import type { CreateProductInput, UpdateProductInput } from "./ipc/schemas/product.schema";
import type { CreateRoleProfileInput, UpdateRoleProfileInput } from "./ipc/schemas/roles.schema";
import type { CreateSaleInput, CreateSaleResult } from "./ipc/schemas/sales.schema";

contextBridge.exposeInMainWorld("api", {
  login: (payload: LoginInput): Promise<LoginResult> =>
    ipcRenderer.invoke("auth:login", payload),

  createUser: (payload: CreateUserInput): Promise<{ success: boolean; message?: string; username?: string }> =>
    ipcRenderer.invoke("auth:createUser", payload),

  updateUser: (payload: UpdateUserInput): Promise<{ success: boolean; message?: string; username?: string }> =>
    ipcRenderer.invoke("users:update", payload),

  logout: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("auth:logout"),

  listProducts: (): Promise<
    Array<{
      id: string;
      name: string;
      sku: string;
      barcode: string | null;
      price: number;
      cost: number;
      taxRate: number;
      stock: number;
      category: string | null;
      subcategory: string | null;
    }>
  > => ipcRenderer.invoke("products:list"),

  createSale: (payload: CreateSaleInput): Promise<CreateSaleResult> =>
    ipcRenderer.invoke("sales:create", payload),

  getDashboardStats: (range: "day" | "week" | "month") =>
    ipcRenderer.invoke("dashboard:stats", range),

  getCorrespondentCatalog: () => ipcRenderer.invoke("correspondent:catalog"),

  getCorrespondentDashboard: () => ipcRenderer.invoke("correspondent:dashboard"),

  listCorrespondentTransactions: (payload?: ListCorrespondentTransactionsInput) =>
    ipcRenderer.invoke("correspondent:transactions:list", payload),

  createCorrespondentTransaction: (payload: CreateCorrespondentTransactionInput) =>
    ipcRenderer.invoke("correspondent:transaction:create", payload),

  listCorrespondentClosures: (payload?: ListCorrespondentClosuresInput) =>
    ipcRenderer.invoke("correspondent:closures:list", payload),

  createCorrespondentClosure: (payload: CreateCorrespondentClosureInput) =>
    ipcRenderer.invoke("correspondent:closure:create", payload),

  getAppStatus: () => ipcRenderer.invoke("app:status"),
  getBusinessSettings: () => ipcRenderer.invoke("settings:get"),
  updateBusinessSettings: (payload: {
    businessName?: string | null;
    taxId?: string | null;
    address?: string | null;
    city?: string | null;
    invoicePrefix?: string | null;
    defaultTaxRate?: number;
    allowNegativeStock?: boolean;
    receiptFooter?: string | null;
  }) => ipcRenderer.invoke("settings:update", payload),

  getCashSummary: () => ipcRenderer.invoke("cash:summary"),
  openCashSession: (payload: {
    openingCashAmount: number;
    note?: string | null;
    cashBreakdown?: Record<string, number>;
    correspondentBalances?: Array<{ platformId: string; amount: number }>;
  }) => ipcRenderer.invoke("cash:open", payload),
  closeCashSession: (payload: {
    sessionId: string;
    countedCashAmount: number;
    note?: string | null;
    cashBreakdown?: Record<string, number>;
    correspondentBalances?: Array<{ platformId: string; amount: number }>;
  }) => ipcRenderer.invoke("cash:close", payload),

  listUsers: () => ipcRenderer.invoke("users:list"),
  listRoleProfiles: () => ipcRenderer.invoke("roles:list"),
  createRoleProfile: (payload: CreateRoleProfileInput) => ipcRenderer.invoke("roles:create", payload),
  updateRoleProfile: (payload: UpdateRoleProfileInput) => ipcRenderer.invoke("roles:update", payload),

  listProductsAdmin: () => ipcRenderer.invoke("products:list-admin"),
  listProductCategories: () => ipcRenderer.invoke("products:categories:list"),
  createProductRecord: (payload: CreateProductInput) => ipcRenderer.invoke("products:create", payload),
  updateProductRecord: (payload: UpdateProductInput) => ipcRenderer.invoke("products:update", payload),
  deleteProductRecord: (id: string) => ipcRenderer.invoke("products:delete", { id }),
  createProductCategory: (name: string) => ipcRenderer.invoke("products:category:create", { name }),
  deleteProductCategory: (id: string) => ipcRenderer.invoke("products:category:delete", { id }),
  createProductSubcategory: (payload: { categoryId: string; name: string }) =>
    ipcRenderer.invoke("products:subcategory:create", payload),
  deleteProductSubcategory: (id: string) => ipcRenderer.invoke("products:subcategory:delete", { id }),

  listCustomers: () => ipcRenderer.invoke("customers:list"),
  createCustomer: (payload: {
    firstName: string;
    lastName?: string;
    documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    isActive?: boolean;
  }) => ipcRenderer.invoke("customers:create", payload),
  updateCustomer: (payload: {
    id: string;
    firstName: string;
    lastName?: string;
    documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    isActive?: boolean;
  }) => ipcRenderer.invoke("customers:update", payload),

  listSuppliers: () => ipcRenderer.invoke("suppliers:list"),
  createSupplier: (payload: {
    name: string;
    contactName?: string | null;
    documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    isActive?: boolean;
  }) => ipcRenderer.invoke("suppliers:create", payload),
  updateSupplier: (payload: {
    id: string;
    name: string;
    contactName?: string | null;
    documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    isActive?: boolean;
  }) => ipcRenderer.invoke("suppliers:update", payload),

  listPurchases: () => ipcRenderer.invoke("purchases:list"),
  getPurchaseDetail: (id: string) => ipcRenderer.invoke("purchases:get-detail", { id }),
  createPurchase: (payload: {
    supplierId: string;
    purchasedAt?: string;
    note?: string | null;
    markAsPaid?: boolean;
    items: Array<{
      productId: string;
      qty: number;
      cost: number;
      taxRate?: number;
    }>;
  }) => ipcRenderer.invoke("purchases:create", payload),

  listInventoryMoves: () => ipcRenderer.invoke("inventory:list"),

  listSales: (payload?: {
    dateFrom?: string;
    dateTo?: string;
    cashierId?: string;
    status?: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED" | "CREDIT";
    search?: string;
  }) => ipcRenderer.invoke("sales:list", payload),
  getSaleDetail: (saleId: string) => ipcRenderer.invoke("sales:get-detail", { saleId }),
  printSaleInvoice: (saleId: string) => ipcRenderer.invoke("sales:print-invoice", { saleId }),
});
