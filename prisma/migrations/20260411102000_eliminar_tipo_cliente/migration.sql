PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "internalCode" TEXT,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "creditLimit" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Customer" (
  "id",
  "internalCode",
  "name",
  "document",
  "phone",
  "email",
  "address",
  "creditLimit",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "internalCode",
  "name",
  "document",
  "phone",
  "email",
  "address",
  "creditLimit",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt"
FROM "Customer";

DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";

CREATE UNIQUE INDEX "Customer_document_key" ON "Customer"("document");
CREATE UNIQUE INDEX "Customer_internalCode_key" ON "Customer"("internalCode");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
