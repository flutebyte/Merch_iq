-- AlterTable
ALTER TABLE "products" ADD COLUMN "recovery_action" TEXT,
ADD COLUMN "recovery_action_at" TIMESTAMP(3);
