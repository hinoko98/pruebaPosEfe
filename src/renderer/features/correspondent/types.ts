export type CorrespondentDirection = "IN" | "OUT" | "NEUTRAL";
export type CorrespondentStatus = "REGISTERED" | "VOIDED";
export type CorrespondentSource = "MANUAL" | "IMAGE" | "FILE_IMPORT" | "API";
export type CorrespondentClosureStatus = "CLOSED" | "WITH_DIFFERENCE";
export type CommissionMode = "NONE" | "FIXED" | "PERCENTAGE";

export type CorrespondentType = {
  id: string;
  code: string;
  name: string;
  direction: CorrespondentDirection;
  requiresCustomerDocument: boolean;
  requiresExternalReference: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type CorrespondentPlatform = {
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
  types: CorrespondentType[];
  commissionRules: Array<{
    id: string;
    typeId: string | null;
    mode: CommissionMode;
    value: number;
    minAmount: number | null;
    maxAmount: number | null;
  }>;
};

export type CorrespondentTransactionItem = {
  id: string;
  approvalCode: string | null;
  platformId: string;
  platform: string;
  typeId: string;
  type: string;
  direction: CorrespondentDirection;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  externalReference: string | null;
  customerName: string | null;
  customerDocument: string | null;
  targetAccount: string | null;
  targetPhone: string | null;
  performedAt: string;
  status: CorrespondentStatus;
  source: CorrespondentSource;
  registeredBy: string;
  note: string | null;
  hasEvidence: boolean;
  evidenceCount: number;
  closureId: string | null;
  closureStatus: CorrespondentClosureStatus | null;
};

export type CorrespondentTransactionDetail = {
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
  status: CorrespondentStatus;
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

export type CorrespondentDashboard = {
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
    status: CorrespondentStatus;
    registeredBy: string;
    hasEvidence: boolean;
  }>;
};

export type CorrespondentClosureItem = {
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
    direction: CorrespondentDirection;
    total: number;
    count: number;
  }>;
  closure: {
    id: string;
    expectedBalance: number;
    reportedBalance: number;
    differenceAmount: number;
    status: CorrespondentClosureStatus;
    closedAt: string;
    closedBy: string;
    note: string | null;
  } | null;
};
