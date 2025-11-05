import prisma from '../../Db/index'
import { logger } from '../logger'
import { zAck, zTelemetry, zWaypointReached } from '../Types/types'
import { resolveWaiter } from '../waiters'

export async function handleRobotMessage(robotId: string, msg: any) {
    const type = msg?.type
    console.log("Received message from robot:", robotId, msg);
    if (!type) return
    if (type === 'ACK') {
        const parsed = zAck.safeParse(msg)
        if (!parsed.success) return
        const { exec_id, seq } = parsed.data

        resolveWaiter(exec_id, seq, parsed.data)

        await prisma.event.create({
            data: {
                execId: exec_id,
                eventType: 'ACK',
                payload: msg,
                timestampMs: BigInt(parsed.data.timestamp_ms ?? Date.now())
            } as any
        })
        return
    }

    if (type === 'WAYPOINT_REACHED') {
        const parsed = zWaypointReached.safeParse(msg)
        if (!parsed.success) return
        const { exec_id, seq } = parsed.data

        resolveWaiter(exec_id, seq, parsed.data)

        await prisma.$transaction([
            prisma.event.create({
                data: {
                    execId: exec_id,
                    eventType: 'WAYPOINT_REACHED',
                    payload: msg,
                    timestampMs: BigInt(parsed.data.timestamp_ms)
                } as any
            }),
            // prisma.execution.update({
            //     where: { execId: exec_id },
            //     data: { lastSeq: seq }
            // })
        ])
        return
    }

    if (type === 'TELEMETRY') {
        const parsed = zTelemetry.safeParse(msg)
        if (!parsed.success) {
            console.log("Invalid TELEMETRY message:",);
            return
        }
        await prisma.telemetry.create({
            data: {
                execId: parsed.data.exec_id,
                seqCurrent: parsed.data.seq_current ?? 1,
                x: parsed.data.x ?? null,
                y: parsed.data.y ?? null,
                theta: parsed.data.theta ?? null,
                speed: parsed.data.speed ?? null,
                nozzleState: parsed.data.nozzle_state ?? null,
                batteryPct: parsed.data.battery_pct ?? null,
                deviationM: parsed.data.deviation_m ?? null
                // timestampMs: BigInt(parsed.data.timestamp_ms)
            } as any
        })
        return
    }

    // Unknown event
    await prisma.event.create({
        data: { execId: msg.exec_id ?? null, eventType: type, payload: msg, timestampMs: BigInt(Date.now()) } as any
    })
    logger.warn({ robotId, type }, 'Unhandled robot message type')
}
