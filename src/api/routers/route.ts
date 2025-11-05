import { Router } from "express";


const router = Router();
import { createWall, executeMqttCommand, fetchTelemetryData, addObstaclesPoints, getWalls, getWallData, createTrajectory, getTrajectory } from "../controllers/controller";

router.post("/walls", createWall);
router.get("/walls", getWalls);
router.get("/walls/:wallId", getWallData);
router.post("/walls/obstacles", addObstaclesPoints);
router.post("/trajectory", createTrajectory);
router.get("/trajectory/:wallId", getTrajectory);
router.post("/execute/:trajectoryId", executeMqttCommand);
router.post("/telemetry/:execId", fetchTelemetryData);

export default router;