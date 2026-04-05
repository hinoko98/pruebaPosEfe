ALTER TABLE "User" ADD COLUMN "internalCode" TEXT;
ALTER TABLE "Customer" ADD COLUMN "internalCode" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "internalCode" TEXT;
ALTER TABLE "CorrespondentTransaction" ADD COLUMN "approvalCode" TEXT;

CREATE UNIQUE INDEX "User_internalCode_key" ON "User"("internalCode");
CREATE UNIQUE INDEX "Customer_internalCode_key" ON "Customer"("internalCode");
CREATE UNIQUE INDEX "Supplier_internalCode_key" ON "Supplier"("internalCode");
CREATE UNIQUE INDEX "CorrespondentTransaction_approvalCode_key" ON "CorrespondentTransaction"("approvalCode");
