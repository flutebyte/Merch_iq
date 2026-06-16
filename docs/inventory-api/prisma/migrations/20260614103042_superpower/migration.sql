-- AlterTable
ALTER TABLE "products" ADD COLUMN     "external_ids" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "sales_records" ADD COLUMN     "external_order_id" TEXT;

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "shop_domain" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "last_sync_at" TIMESTAMP(3),
    "sync_cursor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_orders" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'delivered',
    "order_date" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "platform_fee" DECIMAL(12,2),
    "shipping_cost" DECIMAL(12,2),
    "net_revenue" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "items" JSONB NOT NULL DEFAULT '[]',
    "return_reason" TEXT,
    "cancellation_reason" TEXT,
    "customer_city" TEXT,
    "customer_state" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'oauth_sync',

    CONSTRAINT "platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_metrics" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integrations_brand_id_platform_key" ON "integrations"("brand_id", "platform");

-- CreateIndex
CREATE INDEX "platform_orders_brand_id_order_date_idx" ON "platform_orders"("brand_id", "order_date");

-- CreateIndex
CREATE INDEX "platform_orders_brand_id_platform_idx" ON "platform_orders"("brand_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "platform_orders_brand_id_platform_platform_order_id_key" ON "platform_orders"("brand_id", "platform", "platform_order_id");

-- CreateIndex
CREATE INDEX "platform_metrics_brand_id_platform_date_idx" ON "platform_metrics"("brand_id", "platform", "date");

-- CreateIndex
CREATE UNIQUE INDEX "platform_metrics_brand_id_platform_date_metric_key" ON "platform_metrics"("brand_id", "platform", "date", "metric");

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_metrics" ADD CONSTRAINT "platform_metrics_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
