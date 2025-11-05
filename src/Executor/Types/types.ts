import { z } from 'zod'

// API -> worker
export const zStartExecution = z.object({
    type: z.literal('START_EXECUTION'),
    exec_id: z.string().min(1),
    robot_id: z.string().min(1),
    requested_at_ms: z.number().optional()
})
export type StartExecution = z.infer<typeof zStartExecution>

// Waypoint structure (DB -> MQTT)
export const zWaypoint = z.object({
    seq: z.number().int().nonnegative(),
    x: z.number(),
    y: z.number(),
    speed: z.number().default(0.4),
    nozzle_on: z.boolean().transform(v => v ? 1 : 0),
    dwell_ms: z.number().int().min(0).default(0)
})
export type Waypoint = z.infer<typeof zWaypoint>

// MQTT messages from robot
export const zAck = z.object({
    type: z.literal('ACK'),
    msg_id: z.string(),
    exec_id: z.string(),
    seq: z.number().int(),
    status: z.string(),
    timestamp_ms: z.number().optional()
})
export const zWaypointReached = z.object({
    type: z.literal('WAYPOINT_REACHED'),
    exec_id: z.string(),
    seq: z.number().int(),
    x: z.number(),
    y: z.number(),
    timestamp_ms: z.number(),
    nozzle_state: z.number().int().min(0).max(1).optional()
})
export const zTelemetry = z.object({
    type: z.literal('TELEMETRY'),
    exec_id: z.string(),
    seq_current: z.number().int().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    theta: z.number().optional(),
    speed: z.number().optional(),
    nozzle_state: z.number().int().min(0).max(1).optional(),
    battery_pct: z.number().optional(),
    deviation_m: z.number().optional(),
    timestamp_ms: z.number()
})
