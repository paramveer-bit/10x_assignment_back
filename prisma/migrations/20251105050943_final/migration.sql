-- CreateTable
CREATE TABLE "Telemetry" (
    "id" SERIAL NOT NULL,
    "execId" TEXT NOT NULL,
    "seqCurrent" INTEGER,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "theta" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "nozzleState" INTEGER,
    "batteryPct" DOUBLE PRECISION,
    "deviationM" DOUBLE PRECISION,
    "timestampMs" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Telemetry_execId_timestampMs_idx" ON "Telemetry"("execId", "timestampMs");
