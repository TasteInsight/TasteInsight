/*
  Warnings:

  - A unique constraint covering the columns `[userId,dishId]` on the table `browse_history` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "browse_history_userId_dishId_key" ON "browse_history"("userId", "dishId");
