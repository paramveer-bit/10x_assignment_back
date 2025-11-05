-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "execId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestampMs" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_execId_eventType_idx" ON "Event"("execId", "eventType");
