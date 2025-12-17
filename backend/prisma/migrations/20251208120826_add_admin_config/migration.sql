-- CreateTable
CREATE TABLE "admin_configs" (
    "id" TEXT NOT NULL,
    "canteenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_config_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "defaultValue" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_config_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_config_items" (
    "id" TEXT NOT NULL,
    "adminConfigId" TEXT NOT NULL,
    "templateId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_config_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_configs_canteenId_key" ON "admin_configs"("canteenId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_config_templates_key_key" ON "admin_config_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "admin_config_items_adminConfigId_key_key" ON "admin_config_items"("adminConfigId", "key");

-- AddForeignKey
ALTER TABLE "admin_configs" ADD CONSTRAINT "admin_configs_canteenId_fkey" FOREIGN KEY ("canteenId") REFERENCES "canteens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_config_items" ADD CONSTRAINT "admin_config_items_adminConfigId_fkey" FOREIGN KEY ("adminConfigId") REFERENCES "admin_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_config_items" ADD CONSTRAINT "admin_config_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "admin_config_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
