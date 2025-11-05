import asyncHandler from "../helpers/asynchandeler";
import ApiError from "../helpers/ApiError";
import ApiResponse from "../helpers/ApiResponse";
import { Request, Response } from "express";
import PrismaClient from "../../Db/index"
import mqtt from "mqtt";
import crypto from "crypto";


const createWall = asyncHandler(async (req: Request, res: Response) => {
    const { height, width, name } = req.body;
    if (!height || !width || !name) {
        throw new ApiError(400, "Height, Width and Name are required");
    }

    const wall = await PrismaClient.wall.create({
        data: {
            name,
            height,
            width
        }
    });

    res.status(201).json(new ApiResponse("200", wall, "Wall created successfully"));
});

const getWalls = asyncHandler(async (req: Request, res: Response) => {
    const walls = await PrismaClient.wall.findMany();
    res.status(200).json(new ApiResponse("200", walls, "Walls fetched successfully"));
});

const getWallData = asyncHandler(async (req: Request, res: Response) => {
    const { wallId } = req.params;
    if (!wallId) {
        throw new ApiError(400, "Wall ID is required");
    }
    const wall = await PrismaClient.wall.findFirst({
        where: { id: parseInt(wallId) }
    });
    if (!wall) {
        throw new ApiError(404, "Wall not found");
    }
    res.status(200).json(new ApiResponse("200", wall, "Wall fetched successfully"));
});

const addObstaclesPoints = asyncHandler(async (req: Request, res: Response) => {
    const { wallId, obstacles } = req.body;
    if (!wallId || !Array.isArray(obstacles)) {
        throw new ApiError(400, "Wall ID and obstacles array are required");
    }
    const wall = await PrismaClient.wall.findFirst({
        where: { id: wallId }
    });
    if (!wall) {
        throw new ApiError(404, "Wall not found");
    }

    const updatedWall = await PrismaClient.wall.update({
        where: { id: wallId },
        data: {
            obstacles: obstacles
        }
    });
    res.status(200).json(new ApiResponse("200", updatedWall, "Obstacles added successfully"));
})

const createTrajectory = asyncHandler(async (req: Request, res: Response) => {
    const { wallId } = req.body;
    if (!wallId) {
        throw new ApiError(400, "Wall ID, Start Point and End Point are required");
    }

    const wall = await PrismaClient.wall.findFirst({ where: { id: wallId } });
    if (!wall) throw new ApiError(404, "Wall not found");

    const r = wall.height;
    const c = wall.width;
    const grid: number[][] = Array.from({ length: r }, () => Array(c).fill(0));

    // --- Normalize obstacles into {x:number, y:number} ---
    const obstaclesRaw = wall.obstacles;
    const obstacles: Array<{ x: number; y: number }> = [];

    if (Array.isArray(obstaclesRaw)) {
        for (const item of obstaclesRaw) {
            if (!item) continue;

            // handle string form like "1-13" or "1:13" or "1,13"
            if (typeof item === "string") {
                const parts = item.split(/[-:,]/).map(s => s.trim());
                if (parts.length >= 2) {
                    const px = Number(parts[0]);
                    const py = Number(parts[1]);
                    if (Number.isFinite(px) && Number.isFinite(py)) {
                        obstacles.push({ x: px, y: py });
                        continue;
                    }
                }
                continue;
            }

            // handle object form { x: number, y: number }
            if (typeof item === "object" && item !== null && typeof (item as any).x === "number" && typeof (item as any).y === "number") {
                obstacles.push({ x: (item as any).x, y: (item as any).y });
                continue;
            }

            // otherwise ignore unknown shapes
        }
    }

    // --- coerce obstacles into valid 0-based indices and mark grid ---
    let points = 0;
    for (let ob of obstacles) {
        let { x, y } = ob;

        // If it looks 1-indexed (i.e. out of bounds), try subtracting 1
        const tryUse = (xx: number, yy: number) => xx >= 0 && xx < r && yy >= 0 && yy < c;
        if (!tryUse(x, y) && tryUse(x - 1, y - 1)) {
            x = x - 1;
            y = y - 1;
        }

        if (!tryUse(x, y)) continue; // skip out-of-bounds after adjustment

        grid[x][y] = 1;
        points++;
    }

    // create trajectory record
    const trajectory = await PrismaClient.trajectory.create({
        data: {
            wallId: wall.id,
            pointsCount: points,
            compressed: true,
            length: (wall.height * wall.width) - points,
        },
    });

    // --- build all trajectoryPoint rows in memory, then insert in chunks ---
    const pointsToInsert: Array<{
        trajectoryId: number;
        x: number;
        y: number;
        seq: number;
        nozzleOn: boolean;
    }> = [];

    let seq = 1;
    for (let i = 0; i < r; i++) {
        if (i % 2 === 0) { // left -> right
            for (let j = 0; j < c; j++) {
                pointsToInsert.push({
                    trajectoryId: Number(trajectory.id),
                    x: i + 0.5,
                    y: j + 0.5,
                    seq: seq++,
                    nozzleOn: grid[i][j] === 1 ? false : true,
                });
            }
        } else { // right -> left
            for (let j = c - 1; j >= 0; j--) {
                pointsToInsert.push({
                    trajectoryId: Number(trajectory.id),
                    x: i + 0.5,
                    y: j + 0.5,
                    seq: seq++,
                    nozzleOn: grid[i][j] === 1 ? false : true,
                });
            }
        }
    }

    // chunked createMany (avoid extremely large single insert)
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < pointsToInsert.length; i += CHUNK_SIZE) {
        const chunk = pointsToInsert.slice(i, i + CHUNK_SIZE);
        await PrismaClient.trajectoryPoint.createMany({
            data: chunk,
            skipDuplicates: false,
        });
    }
    // also send all the data points in Response

    res.status(201).json(new ApiResponse("200", { trajectory, points: pointsToInsert }, "Trajectory created successfully"));
});


const getTrajectory = asyncHandler(async (req: Request, res: Response) => {
    const { wallId } = req.params;
    if (!wallId) {
        throw new ApiError(400, "Wall ID is required");
    }

    const trajectory = await PrismaClient.trajectory.findFirst({
        where: { wallId: parseInt(wallId) },
    });

    if (!trajectory) {
        throw new ApiError(404, "Trajectory not found");
    }

    const getPoints = await PrismaClient.trajectoryPoint.findMany({
        where: { trajectoryId: trajectory.id },
        orderBy: { seq: "asc" }
    });

    res.status(200).json(new ApiResponse("200", { trajectory, points: getPoints }, "Trajectory fetched successfully"));
});

const executeMqttCommand = asyncHandler(async (req: Request, res: Response) => {
    const { trajectoryId } = req.params;
    if (!trajectoryId) {
        throw new ApiError(400, "Trajectory ID is required");
    }

    const trajectory = await PrismaClient.trajectory.findFirst({
        where: { id: parseInt(trajectoryId) },
    });

    if (!trajectory || !trajectory.id) {
        throw new ApiError(404, "Trajectory not found");
    }

    const execute = await PrismaClient.execution.create({
        data: {
            trajectoryId: (trajectory.id),
            status: "PENDING",
            execId: crypto.randomUUID()
        }
    });

    const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || "mqtt://localhost:1883");

    mqttClient.on("connect", () => {
        const commandMessage = {
            type: "START_EXECUTION",
            execId: execute.execId,
            trajectoryId: trajectory.id,
            robot_id: process.env.ROBOT_ID || "robot_1"
        };
        mqttClient.publish("server/executor/start", JSON.stringify(commandMessage), {}, (err) => {
            if (err) {
                console.error("Failed to publish MQTT message:", err);
            }
            mqttClient.end();
        });
    });
    res.status(200).json(new ApiResponse("200", execute, "Execution started successfully"));
});

const fetchTelemetryData = asyncHandler(async (req: Request, res: Response) => {
    // Placeholder for telemetry data handling
    const execId = req.params.execId;

    if (!execId) {
        throw new ApiError(400, "Execution ID is required");
    }

    const execution = await PrismaClient.execution.findFirst({
        where: { execId: execId },

    });

    if (!execution) {
        throw new ApiError(404, "Execution not found");
    }

    // Here you would process and store the telemetry data sent by the robot
    // extract the latest tellemetry data from the database
    const data = await PrismaClient.telemetry.findMany({
        where: {
            execId: execId

        },
        orderBy: {
            timestampMs: 'desc'
        },
        take: 1

    });



    res.status(200).json(new ApiResponse("200", { telemetry: data }, "Telemetry data received"));
});



export { createWall, executeMqttCommand, fetchTelemetryData, addObstaclesPoints, getWalls, getWallData, createTrajectory, getTrajectory };