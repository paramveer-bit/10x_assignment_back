import 'dotenv/config'
import { getMqttClient } from './mqtt/mqtt.client'
import { logger } from './logger'
// import { prisma } from './prisma'
import { topics } from './mqtt/mqttTopics'
import { zStartExecution } from './Types/types'
import { handleRobotMessage } from './Handlers/messgaeHandlers'
import { startExecution } from './stream'

async function main() {
    const client = getMqttClient()

    client.on('connect', () => {
        logger.info('[EXECUTOR] MQTT connected')
        client.subscribe(topics.serverExecutorStart, { qos: 1 })
        client.subscribe(topics.robotAck('+'), { qos: 1 })
        client.subscribe(topics.robotEvents('+'), { qos: 1 })
        client.subscribe(topics.robotTelemetry('+'), { qos: 0 })
    })

    client.on('message', async (topic, payload) => {
        try {
            const msg = JSON.parse(payload.toString())

            // control from API
            if (topic === topics.serverExecutorStart) {
                // normalize common naming variants coming from different senders
                const normalized = {
                    type: msg.type ?? 'START_EXECUTION',
                    exec_id: msg.exec_id ?? msg.execId ?? msg.execId,
                    robot_id: msg.robot_id ?? msg.robotId ?? msg.robot,
                    requested_at_ms: msg.requested_at_ms ?? msg.requestedAtMs ?? msg.requested_at_ms
                }

                try {
                    const parsed = zStartExecution.parse(normalized)
                    logger.info({ parsed }, 'START_EXECUTION received')
                    console.log('-------------------------------')
                    console.log('START_EXECUTION received:', parsed)
                    await startExecution(parsed.exec_id, parsed.robot_id)
                    return
                } catch (err) {
                    // log normalized object to make debugging easier
                    logger.error({ err, normalized, raw: msg }, 'Invalid START_EXECUTION payload after normalization')
                    throw err
                }
            }

            // robot -> server messages
            const parts = topic.split('/')
            if (parts[0] === 'robot') {
                const robotId = parts[1]
                await handleRobotMessage(robotId, msg)
                return
            }
        } catch (e: any) {
            console.log("Error-------------")
            console.log(e);
            logger.error({ err: e, topic, payload: payload.toString() }, 'Error handling message')
        }
    })

    // graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('Shutting down...')
        // await prisma.$disconnect()
        client.end(true)
        process.exit(0)
    })
}

main().catch((e) => {
    logger.error(e, 'Executor fatal error')
    process.exit(1)
})
