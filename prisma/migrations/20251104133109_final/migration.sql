-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'ABORTED', 'ERROR');

-- CreateTable
CREATE TABLE "walls" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "obstacles" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "walls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajectories" (
    "id" SERIAL NOT NULL,
    "wallId" INTEGER NOT NULL,
    "name" TEXT,
    "pointsCount" INTEGER NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "blobUri" TEXT,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trajectories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajectory_points" (
    "id" SERIAL NOT NULL,
    "trajectoryId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "yaw" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION DEFAULT 0.4,
    "nozzleOn" BOOLEAN NOT NULL DEFAULT true,
    "dwellMs" INTEGER DEFAULT 0,
    "expectedTimeMs" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trajectory_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" SERIAL NOT NULL,
    "execId" TEXT NOT NULL,
    "trajectoryId" INTEGER,
    "robotId" INTEGER,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "totalTimeS" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "walls_createdAt_idx" ON "walls"("createdAt");

-- CreateIndex
CREATE INDEX "trajectories_wallId_idx" ON "trajectories"("wallId");

-- CreateIndex
CREATE INDEX "trajectory_points_trajectoryId_seq_idx" ON "trajectory_points"("trajectoryId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "trajectory_points_trajectoryId_seq_key" ON "trajectory_points"("trajectoryId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "executions_execId_key" ON "executions"("execId");

-- CreateIndex
CREATE INDEX "executions_execId_idx" ON "executions"("execId");

-- AddForeignKey
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_wallId_fkey" FOREIGN KEY ("wallId") REFERENCES "walls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajectory_points" ADD CONSTRAINT "trajectory_points_trajectoryId_fkey" FOREIGN KEY ("trajectoryId") REFERENCES "trajectories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_trajectoryId_fkey" FOREIGN KEY ("trajectoryId") REFERENCES "trajectories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
