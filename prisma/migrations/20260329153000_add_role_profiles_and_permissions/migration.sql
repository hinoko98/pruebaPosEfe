CREATE TABLE "RoleProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "baseRole" TEXT NOT NULL DEFAULT 'EMPLOYEE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "RoleProfile_key_key" ON "RoleProfile"("key");
CREATE UNIQUE INDEX "RoleProfile_name_key" ON "RoleProfile"("name");

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roleProfileId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_roleProfileId_fkey"
    FOREIGN KEY ("roleProfileId") REFERENCES "RoleProfile" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RolePermission_roleProfileId_permissionKey_key"
ON "RolePermission"("roleProfileId", "permissionKey");

CREATE INDEX "RolePermission_roleProfileId_idx"
ON "RolePermission"("roleProfileId");

ALTER TABLE "User" ADD COLUMN "roleProfileId" TEXT;

CREATE INDEX "User_roleProfileId_idx" ON "User"("roleProfileId");
