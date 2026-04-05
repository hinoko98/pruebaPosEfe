import type { LoginInput, LoginResult, CreateUserInput, UpdateUserInput } from "~/main/electron/ipc/schemas/auth.schema";
import type {
  AccountingRangeInput,
  CreateAccountingCreditInput,
  CreateAccountingCreditNoteInput,
  CreateAccountingExpenseInput,
  CreateAccountingPaymentInput,
} from "~/main/electron/ipc/schemas/accounting.schema";
import type {
  CreateCorrespondentPlatformInput,
  CreateCorrespondentClosureInput,
  CreateCorrespondentTransactionTypeInput,
  CreateCorrespondentTransactionInput,
  DeleteCorrespondentPlatformInput,
  DeleteCorrespondentTransactionTypeInput,
  GetCorrespondentTransactionDetailInput,
  ListCorrespondentClosuresInput,
  ListCorrespondentTransactionsInput,
  UpdateCorrespondentPlatformInput,
  UpdateCorrespondentTransactionTypeInput,
  UpdateCorrespondentTransactionInput,
} from "~/main/electron/ipc/schemas/correspondent.schema";
import type { CreateProductInput, UpdateProductInput } from "~/main/electron/ipc/schemas/product.schema";
import type { CreateRoleProfileInput, UpdateRoleProfileInput } from "~/main/electron/ipc/schemas/roles.schema";
import type { CreateSaleInput, CreateSaleResult } from "~/main/electron/ipc/schemas/sales.schema";

type PosProduct = {
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
};

type DashboardStats = {
  range: "day" | "week" | "month";
  totals: {
    salesCount: number;
    revenue: number;
    profit: number;
    tax: number;
    averageTicket: number;
  };
  paymentSummary: Array<{ label: string; value: number }>;
  topProducts: Array<{ name: string; qty: number; total: number }>;
  recentSales: Array<{
    id: string;
    invoiceNumber: string;
    customer: string;
    total: number;
    createdAt: string;
    itemsCount: number;
  }>;
  lowStock: Array<{
    id: string;
    name: string;
    stock: number;
    sku: string;
  }>;
};

type CorrespondentCatalogResponse = {
  success: boolean;
  message?: string;
  platforms: Array<{
    id: string;
    code: string;
    name: string;
    requiresEvidence: boolean;
    supportsOcr: boolean;
    supportsFileImport: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
    types: Array<{
      id: string;
      code: string;
      name: string;
      direction: "IN" | "OUT" | "NEUTRAL";
      requiresCustomerDocument: boolean;
      requiresExternalReference: boolean;
      createdAt: string;
      updatedAt: string;
      createdBy: string | null;
      updatedBy: string | null;
    }>;
    commissionRules: Array<{
      id: string;
      typeId: string | null;
      mode: "NONE" | "FIXED" | "PERCENTAGE";
      value: number;
      minAmount: number | null;
      maxAmount: number | null;
    }>;
  }>;
};

type CorrespondentDashboardResponse = {
  success: boolean;
  message?: string;
  totals: {
    totalIn: number;
    totalOut: number;
    totalCommission: number;
    expectedBalance: number;
    transactionsCount: number;
    withEvidenceCount: number;
    pendingClosureCount: number;
    voidedCount: number;
  };
  perPlatform: Array<{
    platformId: string;
    platform: string;
    totalIn: number;
    totalOut: number;
    totalCommission: number;
    count: number;
    pendingClosureCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    approvalCode: string | null;
    platform: string;
    type: string;
    amount: number;
    commissionAmount: number;
    externalReference: string | null;
    customerName: string | null;
    performedAt: string;
    status: "REGISTERED" | "VOIDED";
    registeredBy: string;
    hasEvidence: boolean;
  }>;
};

type CorrespondentTransactionsResponse = {
  success: boolean;
  message?: string;
  transactions: Array<{
    id: string;
    approvalCode: string | null;
    platformId: string;
    platform: string;
    typeId: string;
    type: string;
    direction: "IN" | "OUT" | "NEUTRAL";
    amount: number;
    commissionAmount: number;
    netAmount: number;
    externalReference: string | null;
    customerName: string | null;
    customerDocument: string | null;
    targetAccount: string | null;
    targetPhone: string | null;
    performedAt: string;
    status: "REGISTERED" | "VOIDED";
    source: "MANUAL" | "IMAGE" | "FILE_IMPORT" | "API";
    registeredBy: string;
    note: string | null;
    hasEvidence: boolean;
    evidenceCount: number;
    closureId: string | null;
    closureStatus: "CLOSED" | "WITH_DIFFERENCE" | null;
  }>;
};

type CorrespondentTransactionDetailResponse = {
  success: boolean;
  message?: string;
  transaction?: {
    id: string;
    approvalCode: string | null;
    platformId: string;
    platform: string;
    typeId: string;
    type: string;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    performedAt: string;
    createdAt: string;
    updatedAt: string;
    registeredBy: string;
    note: string | null;
    status: "REGISTERED" | "VOIDED";
    auditTrail: Array<{
      id: string;
      action: string;
      createdAt: string;
      user: string | null;
      beforeJson: string | null;
      afterJson: string | null;
      context: string | null;
    }>;
  };
};

type CorrespondentCreateTransactionResponse = {
  success: boolean;
  message?: string;
  transaction?: {
    id: string;
    approvalCode?: string | null;
    platform: string;
    type: string;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    hasEvidence: boolean;
  };
};

type CorrespondentClosuresResponse = {
  success: boolean;
  message?: string;
  businessDate: string;
  totals: {
    totalIn: number;
    totalOut: number;
    netTotal: number;
    transactionsCount: number;
  };
  closures: Array<{
    platformId: string;
    platform: string;
    totalIn: number;
    totalOut: number;
    totalCommission: number;
    expectedBalance: number;
    transactionsCount: number;
    pendingTransactions: number;
    breakdown: Array<{
      typeId: string;
      type: string;
      direction: "IN" | "OUT" | "NEUTRAL";
      total: number;
      count: number;
    }>;
    closure: {
      id: string;
      expectedBalance: number;
      reportedBalance: number;
      differenceAmount: number;
      status: "CLOSED" | "WITH_DIFFERENCE";
      closedAt: string;
      closedBy: string;
      note: string | null;
    } | null;
  }>;
};

type CorrespondentCreateClosureResponse = {
  success: boolean;
  message?: string;
  closure?: {
    id: string;
    expectedBalance: number;
    reportedBalance: number;
    differenceAmount: number;
    status: "CLOSED" | "WITH_DIFFERENCE";
  };
};

type CorrespondentPlatformMutationResponse = {
  success: boolean;
  message?: string;
  platformId?: string;
  typeId?: string;
};

type AccountingSummaryResponse = {
  success: boolean;
  message?: string;
  summary: {
    pendingCreditsCount: number;
    pendingCreditsBalance: number;
    paymentsTotal: number;
    creditNotesTotal: number;
    expensesTotal: number;
    netOperationalBalance: number;
  };
  customers: Array<{
    id: string;
    internalCode: string | null;
    name: string;
    document: string | null;
    phone: string | null;
  }>;
  sales: Array<{
    id: string;
    invoiceNumber: string;
    customer: string;
    customerId: string | null;
    total: number;
    status: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED" | "CREDIT";
    createdAt: string;
    returnedTotal: number;
    availableCreditTotal: number;
    availableCreditNoteTotal: number;
    credit: {
      id: string;
      total: number;
      balance: number;
      status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
      dueDate: string | null;
    } | null;
  }>;
  credits: Array<{
    id: string;
    saleId: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    total: number;
    balance: number;
    paidAmount: number;
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
    dueDate: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    creditId: string | null;
    saleId: string | null;
    invoiceNumber: string | null;
    customerName: string;
    method: "CASH" | "CARD" | "TRANSFER";
    amount: number;
    note: string | null;
    createdAt: string;
  }>;
  creditNotes: Array<{
    id: string;
    saleId: string;
    invoiceNumber: string;
    customerName: string;
    total: number;
    reason: string | null;
    createdAt: string;
  }>;
  expenses: Array<{
    id: string;
    sessionId: string;
    registerName: string;
    userName: string;
    type: "EXPENSE_OUT" | "WITHDRAWAL_OUT";
    amount: number;
    note: string | null;
    createdAt: string;
  }>;
};

type AccountingMutationResponse = {
  success: boolean;
  message?: string;
  creditId?: string;
  paymentId?: string;
  creditNoteId?: string;
  expenseId?: string;
};

type AppStatusResponse = {
  success: boolean;
  connectedAt: string;
  now: string;
};

type BusinessSettingsResponse = {
  success: boolean;
  message?: string;
  settings?: {
    businessName: string;
    taxId: string;
    address: string;
    city: string;
    invoicePrefix: string;
    defaultTaxRate: number;
    allowNegativeStock: boolean;
    receiptFooter: string;
  };
};

type CashSummaryResponse = {
  success: boolean;
  message?: string;
  activeSession: null | {
    id: string;
    registerName: string;
    user: string;
    openedAt: string;
    openingAmount: number;
    expectedCash: number;
    countedCashAmount: number | null;
    cashDifferenceAmount: number | null;
    salesCash: number;
    salesCard: number;
    salesTransfer: number;
    manualIncome: number;
    manualExpense: number;
    openingBreakdown: Record<string, number>;
    closingBreakdown: Record<string, number>;
    correspondent: Array<{
      platformId: string;
      platform: string;
      openingAmount: number;
      totalIn: number;
      totalOut: number;
      totalCommission: number;
      expectedAmount: number;
      countedAmount: number | null;
      differenceAmount: number | null;
    }>;
    recentActivity: Array<{
      id: string;
      createdAt: string;
      type: string;
      detail: string;
      amount: number;
    }>;
  };
  recentSessions: Array<{
    id: string;
    registerName: string;
    user: string;
    status: "OPEN" | "CLOSED" | "CANCELLED";
    openedAt: string;
    closedAt: string | null;
    openingAmount: number;
    countedAmount: number | null;
    differenceAmount: number;
  }>;
};

type UsersListResponse = {
  success: boolean;
  message?: string;
  users: Array<{
    id: string;
    internalCode: string | null;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string;
    documentNumber: string | null;
    email: string | null;
    address: string | null;
    birthDate: string | null;
    role: "ADMIN" | "EMPLOYEE";
    roleProfileId: string | null;
    roleProfileName: string | null;
    isActive: boolean;
    createdAt: string;
    salesCount: number;
    sessionsCount: number;
  }>;
};

type RoleProfilesResponse = {
  success: boolean;
  message?: string;
  roles: Array<{
    id: string;
    key: string | null;
    name: string;
    description: string | null;
    baseRole: "ADMIN" | "EMPLOYEE";
    isSystem: boolean;
    isActive: boolean;
    permissionKeys: string[];
    usersCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

type ProductCategoriesResponse = {
  success: boolean;
  message?: string;
  categories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    subcategories: Array<{
      id: string;
      name: string;
      isActive: boolean;
    }>;
  }>;
};

type ProductsAdminResponse = {
  success: boolean;
  message?: string;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unitMeasure: string;
    price: number;
    cost: number;
    marginPercent: number;
    hasTax: boolean;
    taxRate: number;
    stock: number;
    categoryId: string | null;
    subcategoryId: string | null;
    categoryName: string | null;
    subcategoryName: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
  }>;
};

type GenericMutationResponse = {
  success: boolean;
  message?: string;
  productId?: string;
  customerId?: string;
  supplierId?: string;
  purchaseId?: string;
};

type CustomersListResponse = {
  success: boolean;
  message?: string;
  customers: Array<{
    id: string;
    internalCode: string | null;
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
    salesCount: number;
    creditsCount: number;
    createdAt: string;
    createdBy: string | null;
  }>;
};

type SuppliersListResponse = {
  success: boolean;
  message?: string;
  suppliers: Array<{
    id: string;
    internalCode: string | null;
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    contactName: string | null;
    isActive: boolean;
    purchasesCount: number;
    createdAt: string;
    createdBy: string | null;
  }>;
};

type PurchasesListResponse = {
  success: boolean;
  message?: string;
  purchases: Array<{
    id: string;
    number: string;
    supplierId: string;
    supplier: string;
    status: "DRAFT" | "RECEIVED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
    subtotal: number;
    tax: number;
    total: number;
    balance: number;
    note: string | null;
    purchasedAt: string;
    itemsCount: number;
    createdBy: string | null;
  }>;
};

type PurchaseDetailResponse = {
  success: boolean;
  message?: string;
  purchase?: {
    id: string;
    number: string;
    supplier: string;
    status: "DRAFT" | "RECEIVED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
    subtotal: number;
    tax: number;
    total: number;
    balance: number;
    note: string | null;
    purchasedAt: string;
    createdBy: string | null;
    items: Array<{
      id: string;
      productName: string;
      productSku: string | null;
      qty: number;
      cost: number;
      taxRate: number;
      subtotal: number;
      total: number;
    }>;
  };
};

type InventoryMovesResponse = {
  success: boolean;
  message?: string;
  moves: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    type:
      | "PURCHASE_IN"
      | "SALE_OUT"
      | "RETURN_IN"
      | "ADJUSTMENT_IN"
      | "ADJUSTMENT_OUT"
      | "DAMAGE_OUT"
      | "LOSS_OUT"
      | "MANUAL_IN"
      | "MANUAL_OUT";
    qty: number;
    stockBefore: number;
    stockAfter: number;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

type SalesListResponse = {
  success: boolean;
  message?: string;
  sales: Array<{
    id: string;
    invoiceNumber: string;
    customer: string;
    paymentMethod: "CASH" | "CARD" | "TRANSFER";
    subtotal: number;
    tax: number;
    total: number;
    status: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED" | "CREDIT";
    createdAt: string;
    cashier: string;
    itemsCount: number;
  }>;
};

type SaleDetailResponse = {
  success: boolean;
  message?: string;
  sale?: {
    id: string;
    invoiceNumber: string;
    customer: string;
    paymentMethod: "CASH" | "CARD" | "TRANSFER";
    subtotal: number;
    tax: number;
    total: number;
    status: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED" | "CREDIT";
    createdAt: string;
    cashier: string;
    items: Array<{
      id: string;
      name: string;
      qty: number;
      price: number;
      taxRate: number;
      lineSubtotal: number;
      lineTax: number;
      lineTotal: number;
    }>;
    payments: Array<{
      id: string;
      method: "CASH" | "CARD" | "TRANSFER";
      amount: number;
      reference: string | null;
    }>;
  };
};

declare global {
  interface Window {
    api: {
      login: (payload: LoginInput) => Promise<LoginResult>;
      createUser: (payload: CreateUserInput) => Promise<{ success: boolean; message?: string; username?: string }>;
      updateUser: (payload: UpdateUserInput) => Promise<{ success: boolean; message?: string; username?: string }>;
      logout: () => Promise<{ success: boolean }>;
      listProducts: () => Promise<PosProduct[]>;
      createSale: (payload: CreateSaleInput) => Promise<CreateSaleResult>;
      getDashboardStats: (range: "day" | "week" | "month") => Promise<DashboardStats>;
      getCorrespondentCatalog: () => Promise<CorrespondentCatalogResponse>;
      getCorrespondentDashboard: () => Promise<CorrespondentDashboardResponse>;
      listCorrespondentTransactions: (
        payload?: ListCorrespondentTransactionsInput
      ) => Promise<CorrespondentTransactionsResponse>;
      createCorrespondentTransaction: (
        payload: CreateCorrespondentTransactionInput
      ) => Promise<CorrespondentCreateTransactionResponse>;
      getCorrespondentTransactionDetail: (
        payload: GetCorrespondentTransactionDetailInput
      ) => Promise<CorrespondentTransactionDetailResponse>;
      updateCorrespondentTransaction: (
        payload: UpdateCorrespondentTransactionInput
      ) => Promise<CorrespondentCreateTransactionResponse>;
      listCorrespondentClosures: (
        payload?: ListCorrespondentClosuresInput
      ) => Promise<CorrespondentClosuresResponse>;
      createCorrespondentClosure: (
        payload: CreateCorrespondentClosureInput
      ) => Promise<CorrespondentCreateClosureResponse>;
      createCorrespondentPlatform: (
        payload: CreateCorrespondentPlatformInput
      ) => Promise<CorrespondentPlatformMutationResponse>;
      updateCorrespondentPlatform: (
        payload: UpdateCorrespondentPlatformInput
      ) => Promise<CorrespondentPlatformMutationResponse>;
      deleteCorrespondentPlatform: (
        payload: DeleteCorrespondentPlatformInput
      ) => Promise<CorrespondentPlatformMutationResponse>;
      createCorrespondentTransactionType: (
        payload: CreateCorrespondentTransactionTypeInput
      ) => Promise<CorrespondentPlatformMutationResponse>;
      updateCorrespondentTransactionType: (
        payload: UpdateCorrespondentTransactionTypeInput
      ) => Promise<CorrespondentPlatformMutationResponse>;
      deleteCorrespondentTransactionType: (
        payload: DeleteCorrespondentTransactionTypeInput
      ) => Promise<CorrespondentPlatformMutationResponse>;
      getAppStatus: () => Promise<AppStatusResponse>;
      getBusinessSettings: () => Promise<BusinessSettingsResponse>;
      updateBusinessSettings: (payload: {
        businessName?: string | null;
        taxId?: string | null;
        address?: string | null;
        city?: string | null;
        invoicePrefix?: string | null;
        defaultTaxRate?: number;
        allowNegativeStock?: boolean;
        receiptFooter?: string | null;
      }) => Promise<GenericMutationResponse>;
      getCashSummary: () => Promise<CashSummaryResponse>;
      openCashSession: (payload: {
        openingCashAmount: number;
        note?: string | null;
        cashBreakdown?: Record<string, number>;
        correspondentBalances?: Array<{ platformId: string; amount: number }>;
      }) => Promise<GenericMutationResponse>;
      closeCashSession: (payload: {
        sessionId: string;
        countedCashAmount: number;
        note?: string | null;
        cashBreakdown?: Record<string, number>;
        correspondentBalances?: Array<{ platformId: string; amount: number }>;
      }) => Promise<GenericMutationResponse>;
      listUsers: () => Promise<UsersListResponse>;
      listRoleProfiles: () => Promise<RoleProfilesResponse>;
      createRoleProfile: (payload: CreateRoleProfileInput) => Promise<{ success: boolean; message?: string; roleId?: string }>;
      updateRoleProfile: (payload: UpdateRoleProfileInput) => Promise<{ success: boolean; message?: string; roleId?: string }>;
      listProductsAdmin: () => Promise<ProductsAdminResponse>;
      listProductCategories: () => Promise<ProductCategoriesResponse>;
      createProductRecord: (payload: CreateProductInput) => Promise<GenericMutationResponse>;
      updateProductRecord: (payload: UpdateProductInput) => Promise<GenericMutationResponse>;
      deleteProductRecord: (id: string) => Promise<GenericMutationResponse>;
      createProductCategory: (name: string) => Promise<GenericMutationResponse>;
      deleteProductCategory: (id: string) => Promise<GenericMutationResponse>;
      createProductSubcategory: (payload: { categoryId: string; name: string }) => Promise<GenericMutationResponse>;
      deleteProductSubcategory: (id: string) => Promise<GenericMutationResponse>;
      listCustomers: () => Promise<CustomersListResponse>;
      createCustomer: (payload: {
        internalCode?: string | null;
        firstName: string;
        lastName?: string;
        documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
        documentNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        isActive?: boolean;
      }) => Promise<GenericMutationResponse>;
      updateCustomer: (payload: {
        id: string;
        internalCode?: string | null;
        firstName: string;
        lastName?: string;
        documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
        documentNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        isActive?: boolean;
      }) => Promise<GenericMutationResponse>;
      listSuppliers: () => Promise<SuppliersListResponse>;
      createSupplier: (payload: {
        internalCode?: string | null;
        name: string;
        contactName?: string | null;
        documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
        documentNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        isActive?: boolean;
      }) => Promise<GenericMutationResponse>;
      updateSupplier: (payload: {
        id: string;
        internalCode?: string | null;
        name: string;
        contactName?: string | null;
        documentType?: "Cédula" | "NIT" | "Cédula de extranjería" | "Pasaporte" | "Tarjeta de identidad";
        documentNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        isActive?: boolean;
      }) => Promise<GenericMutationResponse>;
      listPurchases: () => Promise<PurchasesListResponse>;
      getPurchaseDetail: (id: string) => Promise<PurchaseDetailResponse>;
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
      }) => Promise<GenericMutationResponse>;
      listInventoryMoves: () => Promise<InventoryMovesResponse>;
      listSales: (payload?: {
        dateFrom?: string;
        dateTo?: string;
        cashierId?: string;
        status?: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED" | "CREDIT";
        search?: string;
      }) => Promise<SalesListResponse>;
      getSaleDetail: (saleId: string) => Promise<SaleDetailResponse>;
      printSaleInvoice: (saleId: string) => Promise<{ success: boolean; message?: string }>;
      getAccountingSummary: (payload?: AccountingRangeInput) => Promise<AccountingSummaryResponse>;
      createAccountingCredit: (payload: CreateAccountingCreditInput) => Promise<AccountingMutationResponse>;
      createAccountingPayment: (payload: CreateAccountingPaymentInput) => Promise<AccountingMutationResponse>;
      createAccountingCreditNote: (payload: CreateAccountingCreditNoteInput) => Promise<AccountingMutationResponse>;
      createAccountingExpense: (payload: CreateAccountingExpenseInput) => Promise<AccountingMutationResponse>;
    };
  }
}

export {};
