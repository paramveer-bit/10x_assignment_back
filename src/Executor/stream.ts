import { randomUUID } from 'crypto'
import { getMqttClient } from './mqtt/mqtt.client'
import { topics } from './mqtt/mqttTopics'
import { logger } from './logger'
// import { prisma } from './prisma'
import prisma from '../Db/index'
import { zWaypoint, Waypoint } from './Types/types'
import { setWaiter } from './waiters'

const ACK_TIMEOUT_MS = Number(process.env.ACK_TIMEOUT_MS || 2000)
const ACK_RETRIES = Number(process.env.ACK_RETRIES || 3)
const STRICT_WAIT_FOR_REACHED = (process.env.STRICT_WAIT_FOR_REACHED || 'false') === 'true'

export async function startExecution(execId: string, robotId: string) {
    const exec = await prisma.execution.findUnique({ where: { execId } })
    if (!exec) throw new Error('Execution not found')
    if (!exec.trajectoryId) throw new Error('Execution has no trajectoryId')

    // mark running (idempotent)
    if (exec.status !== 'RUNNING') {
        await prisma.execution.update({
            where: { execId },
            data: { status: 'RUNNING', startedAt: new Date() }
        })
    }

    // fetch waypoints (ordered)
    const points = await prisma.trajectoryPoint.findMany({
        where: { trajectoryId: exec.trajectoryId },
        orderBy: { seq: 'asc' }
    })

    const waypoints: Waypoint[] = points.map(p => zWaypoint.parse({
        seq: p.seq, x: p.x, y: p.y,
        speed: p.speed ?? 0.4,
        nozzle_on: (p as any).nozzleOn ?? 1,
        dwell_ms: (p as any).dwellMs ?? 0
    }))

    logger.info({ execId, robotId, count: waypoints.length }, 'Streaming waypoints')

    await streamWaypoints(robotId, execId, waypoints)

    await prisma.execution.update({
        where: { execId },
        data: { status: 'COMPLETED', endedAt: new Date() }
    })
    logger.info({ execId }, 'Execution completed')
}

export async function streamWaypoints(robotId: string, execId: string, waypoints: Waypoint[]) {
    const client = getMqttClient()
    const topic = topics.serverRobotCmd(robotId)

    for (const wp of waypoints) {
        const payload = {
            type: 'WAYPOINT',
            msg_id: randomUUID(),
            exec_id: execId,
            payload: wp,
            sent_at_ms: Date.now()
        }

        let ok = false
        for (let attempt = 0; attempt < ACK_RETRIES; attempt++) {
            client.publish(topic, JSON.stringify(payload), { qos: 1 })
            try {
                // Wait for ACK or REACHED (robotHandlers resolves the waiter on either)
                await setWaiter(execId, wp.seq, ACK_TIMEOUT_MS)
                await sleep(100) // small delay to avoid flooding
                ok = true
                break
            } catch {
                if (attempt === ACK_RETRIES - 1) throw new Error(`ACK_FAILED seq=${wp.seq}`)
            }
        }

        if (!ok) throw new Error(`Failed sending seq=${wp.seq}`)

        // Optional strict mode: wait until WAYPOINT_REACHED recorded in DB
        if (STRICT_WAIT_FOR_REACHED) {
            const deadline = Date.now() + ACK_TIMEOUT_MS
            while (Date.now() < deadline) {
                const reached = await prisma.event.findFirst({
                    where: { execId, eventType: 'WAYPOINT_REACHED', payload: { path: ['seq'], equals: wp.seq } as any }
                }).catch(() => null)
                if (reached) break
                await sleep(100)
            }
        }
    }
}

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms))
}
