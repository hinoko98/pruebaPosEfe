ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "documentNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;

UPDATE "User"
SET "firstName" = "name"
WHERE "name" IS NOT NULL
  AND "firstName" IS NULL;

CREATE UNIQUE INDEX "User_documentNumber_key" ON "User"("documentNumber");
