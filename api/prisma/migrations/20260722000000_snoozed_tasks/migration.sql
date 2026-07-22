-- CreateTable
CREATE TABLE "snoozed_tasks" (
    "task_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "snoozed_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snoozed_tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateIndex
CREATE INDEX "snoozed_tasks_brand_id_idx" ON "snoozed_tasks"("brand_id");

-- AddForeignKey
ALTER TABLE "snoozed_tasks" ADD CONSTRAINT "snoozed_tasks_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
