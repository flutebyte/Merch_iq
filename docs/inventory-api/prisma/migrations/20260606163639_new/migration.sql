-- CreateEnum
CREATE TYPE "QuantityCertainty" AS ENUM ('exact', 'approximate', 'unknown');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('main_stock', 'partner_inventory', 'retail_store', 'in_transit', 'sold', 'returned', 'unknown');

-- CreateEnum
CREATE TYPE "ConfidenceState" AS ENUM ('photo_only', 'draft_photo', 'imported_unverified', 'manually_entered', 'count_verified', 'sales_reconciled', 'conflict_detected');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('photo', 'import', 'manual_entry', 'sales_sync', 'erp_import');

-- CreateEnum
CREATE TYPE "InventoryEventType" AS ENUM ('import', 'photo_capture', 'photo_draft', 'manual_entry', 'count', 'sale', 'return', 'adjustment', 'partner_assign', 'verification', 'conflict_detection', 'conflict_resolution');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('queued', 'processing', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'warehouse', 'sales', 'finance');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "confidence_breakdown" JSONB,
    "confidence_last_computed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_users" (
    "brand_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "brand_users_pkey" PRIMARY KEY ("brand_id","user_id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT,
    "category" TEXT,
    "color" TEXT,
    "size" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cost_price" DECIMAL(12,2),
    "selling_price" DECIMAL(12,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantity_certainty" "QuantityCertainty" NOT NULL DEFAULT 'unknown',
    "inventory_status" "InventoryStatus" NOT NULL DEFAULT 'main_stock',
    "confidence_state" "ConfidenceState" NOT NULL DEFAULT 'photo_only',
    "pre_conflict_state" "ConfidenceState",
    "source" "Source" NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_events" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "stock_lot_id" TEXT NOT NULL,
    "event_type" "InventoryEventType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_records" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "stock_lot_id" TEXT,
    "size" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2),
    "channel" TEXT NOT NULL DEFAULT 'direct',
    "date" DATE NOT NULL,
    "partner" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual_entry',
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'queued',
    "row_count" INTEGER,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "error_rows" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "products_brand_id_sku_idx" ON "products"("brand_id", "sku");

-- CreateIndex
CREATE INDEX "products_brand_id_category_idx" ON "products"("brand_id", "category");

-- CreateIndex
CREATE INDEX "stock_lots_brand_id_inventory_status_confidence_state_idx" ON "stock_lots"("brand_id", "inventory_status", "confidence_state");

-- CreateIndex
CREATE INDEX "stock_lots_brand_id_confidence_state_idx" ON "stock_lots"("brand_id", "confidence_state");

-- CreateIndex
CREATE INDEX "stock_lots_brand_id_product_id_idx" ON "stock_lots"("brand_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_events_stock_lot_id_event_type_created_at_idx" ON "inventory_events"("stock_lot_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "inventory_events_brand_id_created_at_idx" ON "inventory_events"("brand_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sales_records_brand_id_product_id_date_idx" ON "sales_records"("brand_id", "product_id", "date");

-- CreateIndex
CREATE INDEX "sales_records_brand_id_date_idx" ON "sales_records"("brand_id", "date" DESC);

-- AddForeignKey
ALTER TABLE "brand_users" ADD CONSTRAINT "brand_users_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_users" ADD CONSTRAINT "brand_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_stock_lot_id_fkey" FOREIGN KEY ("stock_lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_stock_lot_id_fkey" FOREIGN KEY ("stock_lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
