CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'TECHNICIAN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Staff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");

CREATE TABLE "Equipment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assetNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "department" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "assignedStaffId" TEXT,
  "purchaseDate" DATETIME,
  "condition" TEXT NOT NULL DEFAULT 'OPERATIONAL',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Equipment_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Equipment_assetNumber_key" ON "Equipment"("assetNumber");
CREATE INDEX "Equipment_condition_category_idx" ON "Equipment"("condition", "category");
CREATE INDEX "Equipment_department_location_idx" ON "Equipment"("department", "location");

CREATE TABLE "FaultReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reference" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "reportedById" TEXT NOT NULL,
  "assignedTechnicianId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REPORTED',
  "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  "resolutionSummary" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FaultReport_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FaultReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FaultReport_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FaultReport_reference_key" ON "FaultReport"("reference");
CREATE INDEX "FaultReport_equipmentId_status_idx" ON "FaultReport"("equipmentId", "status");
CREATE INDEX "FaultReport_status_priority_idx" ON "FaultReport"("status", "priority");
CREATE INDEX "FaultReport_assignedTechnicianId_status_idx" ON "FaultReport"("assignedTechnicianId", "status");
CREATE INDEX "FaultReport_reportedAt_idx" ON "FaultReport"("reportedAt");

CREATE TABLE "MaintenanceRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "faultId" TEXT NOT NULL,
  "technicianId" TEXT NOT NULL,
  "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workPerformed" TEXT NOT NULL,
  "partsReplaced" TEXT,
  "costNaira" REAL,
  "outcome" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceRecord_faultId_fkey" FOREIGN KEY ("faultId") REFERENCES "FaultReport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaintenanceRecord_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MaintenanceRecord_faultId_performedAt_idx" ON "MaintenanceRecord"("faultId", "performedAt");
CREATE INDEX "MaintenanceRecord_performedAt_idx" ON "MaintenanceRecord"("performedAt");
