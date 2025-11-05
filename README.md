# Autonomous Wall-finishing Robot Path Palnner and Monitoring System 
Quick guide to the repository structure, purpose and how pieces interact.

## Project overview
This repository implements:
- An API server exposing endpoints to manage walls, trajectories and start executions ([src/api/app.ts](src/api/app.ts), [src/api/index.ts](src/api/index.ts)).
- An executor worker that listens for start requests, streams waypoints to robots over MQTT and records robot events ([src/Executor/index.ts](src/Executor/index.ts)).
- A dummy robot simulator to test the MQTT flow ([src/dummy_robot/index.ts](src/dummy_robot/index.ts)).
- A PostgreSQL schema managed by Prisma ([prisma/schema.prisma](prisma/schema.prisma)).

## Key components and entrypoints
- API server
  - App: [src/api/app.ts](src/api/app.ts)
  - Startup: [src/api/index.ts](src/api/index.ts)
  - Controllers: [`createTrajectory`, `executeMqttCommand`, `fetchTelemetryData`](src/api/controllers/controller.ts) — see [src/api/controllers/controller.ts](src/api/controllers/controller.ts)
  - Router: [src/api/routers/route.ts](src/api/routers/route.ts)

- Executor (worker)
  - Worker entry: [src/Executor/index.ts](src/Executor/index.ts)
  - MQTT client helper: [`getMqttClient`](src/Executor/mqtt/mqtt.client.ts) — [src/Executor/mqtt/mqtt.client.ts](src/Executor/mqtt/mqtt.client.ts)
  - Topics: [src/Executor/mqtt/mqttTopics.ts](src/Executor/mqtt/mqttTopics.ts)
  - Message handlers: [`handleRobotMessage`](src/Executor/Handlers/messgaeHandlers.ts) — [src/Executor/Handlers/messgaeHandlers.ts](src/Executor/Handlers/messgaeHandlers.ts)
  - Stream logic: [`startExecution`, `streamWaypoints`](src/Executor/stream.ts) — [src/Executor/stream.ts](src/Executor/stream.ts)
  - Waiters utility (ACK waiters): [src/Executor/waiters.ts](src/Executor/waiters.ts)
  - Logger: [src/Executor/logger.ts](src/Executor/logger.ts)

- Simulator & tools
  - Dummy robot simulator: [src/dummy_robot/index.ts](src/dummy_robot/index.ts)
  - Old JS executor example (reference): [extcutor.js](extcutor.js)

- Database
  - Prisma schema: [prisma/schema.prisma](prisma/schema.prisma)
  - Migrations: [prisma/migrations/](prisma/migrations/)
  - Runtime Prisma client helper: [src/Db/index.ts](src/Db/index.ts)
- Frontend Repo
  - https://github.com/paramveer-bit/10x_assignment_front
## How it works (high level)
1. API creates a trajectory from a wall: controller [`createTrajectory`](src/api/controllers/controller.ts) creates Trajectory and TrajectoryPoint rows.
2. When API requests execution start, it creates an Execution row and publishes a start message for the executor ([src/api/controllers/controller.ts](src/api/controllers/controller.ts)).
3. The executor ([src/Executor/index.ts](src/Executor/index.ts)) receives the start message, validates it with [`zStartExecution`](src/Executor/Types/types.ts) and calls [`startExecution`](src/Executor/stream.ts).
4. [`startExecution`](src/Executor/stream.ts) loads waypoint rows, converts them via [`zWaypoint`](src/Executor/Types/types.ts) and streams them to the robot using MQTT. It uses [src/Executor/waiters.ts](src/Executor/waiters.ts) to await ACKs.
5. Robot(s) respond with ACK / WAYPOINT_REACHED / TELEMETRY. Messages are consumed by the executor's MQTT subscriptions and handled by [`handleRobotMessage`](src/Executor/Handlers/messgaeHandlers.ts), which persists events and telemetry.

      <img width="928" height="496" alt="image" src="https://github.com/user-attachments/assets/98d51e02-fbcc-44f9-aa82-4e4129b39e01" />
      

## Running locally (dev)
1. Install deps:
   ```
   git clone <this-repo>
   npm install
   # .env file with DATABASE_URL
   npx prisma migrate
   npx prisma generate
   npx tsc -b
   # Open 3 terminal and run
   node dist/src/dummy_robot/index.js
   node dist/src/api/index.js
   node dist/src/executor/index.js
