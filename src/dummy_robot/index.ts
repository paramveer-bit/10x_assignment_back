import 'dotenv/config'
import mqtt from 'mqtt'
import crypto from 'crypto'

const ROBOT_ID = process.env.ROBOT_ID || 'robot_1'
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883'
const QUEUE_LIMIT = Number(process.env.QUEUE_LIMIT || 100) // optional

const client = mqtt.connect(MQTT_URL, {
    clientId: `robot-sim-${ROBOT_ID}-${crypto.randomUUID()}`,
    clean: false,
    reconnectPeriod: 1000
})

let currentX = 0
let currentY = 0

console.log(`[ROBOT] Starting simulator for ${ROBOT_ID}`)
let exec_id = ''
let nozzle_state = 0

// --- Queue & processor ---
type WaypointMsg = {
    originalMsg: any
    wp: {
        seq: number
        x: number
        y: number
        nozzle_on?: number
    }
}

const waypointQueue: WaypointMsg[] = []
let isProcessing = false

async function processQueue() {
    if (isProcessing) return
    isProcessing = true

    while (waypointQueue.length > 0) {
        const item = waypointQueue.shift()!
        const msg = item.originalMsg
        const wp = item.wp

        console.log(`[ROBOT] Processing queue item seq=${wp.seq} exec_id=${msg.exec_id}`)

        // update current exec_id used by telemetry
        exec_id = msg.exec_id

        // simulate travel (1s to 2s)
        await sleep(1000 + Math.random() * 1000)

        // update position & nozzle
        currentX = wp.x
        currentY = wp.y
        nozzle_state = wp.nozzle_on ?? nozzle_state

        // small settle time (as in your original flow)
        await sleep(1000)

        // publish waypoint reached
        client.publish(`robot/${ROBOT_ID}/events`, JSON.stringify({
            type: "WAYPOINT_REACHED",
            exec_id: msg.exec_id,
            seq: wp.seq,
            x: Number(currentX.toFixed(3)),
            y: Number(currentY.toFixed(3)),
            nozzle_state: wp.nozzle_on,
            timestamp_ms: Date.now()
        }), { qos: 1 })

        console.log(`[ROBOT] REACHED seq=${wp.seq} (queue remaining=${waypointQueue.length})`)
    }

    isProcessing = false
}

// --- MQTT handling ---
client.on('connect', () => {
    console.log(`[ROBOT] Connected to MQTT`)
    client.subscribe(`server/robot/${ROBOT_ID}/cmd`, { qos: 1 })
})

client.on('message', (topic, payload) => {
    let msg: any
    try {
        msg = JSON.parse(payload.toString())
    } catch (err) {
        console.warn('[ROBOT] Ignoring non-json message', payload.toString())
        return
    }
    console.log(`[ROBOT] Received message on topic ${topic}:`, msg)

    if (msg.type !== 'WAYPOINT') return

    const wp = msg.payload
    if (!wp || typeof wp.x !== 'number' || typeof wp.y !== 'number') {
        console.warn('[ROBOT] Invalid WAYPOINT payload, ignoring', wp)
        return
    }

    // Send ACK immediately (keep this behavior)
    client.publish(`robot/${ROBOT_ID}/ack`, JSON.stringify({
        type: "ACK",
        msg_id: msg.msg_id,
        exec_id: msg.exec_id,
        seq: wp.seq,
        status: "RECEIVED",
        timestamp_ms: Date.now()
    }), { qos: 1 })

    // Buffer the waypoint
    if (waypointQueue.length >= QUEUE_LIMIT) {
        // optional behavior: reject / NACK or drop oldest. Here we NACK this incoming.
        client.publish(`robot/${ROBOT_ID}/ack`, JSON.stringify({
            type: "NACK",
            msg_id: msg.msg_id,
            exec_id: msg.exec_id,
            seq: wp.seq,
            status: "QUEUE_FULL",
            timestamp_ms: Date.now()
        }), { qos: 1 })
        console.warn(`[ROBOT] Queue full, NACK seq=${wp.seq}`)
        return
    }

    waypointQueue.push({ originalMsg: msg, wp })
    console.log(`[ROBOT] Enqueued seq=${wp.seq} (queue_size=${waypointQueue.length})`)

    // Kick off processor if not already running
    processQueue().catch(err => {
        console.error('[ROBOT] Error in processQueue:', err)
        isProcessing = false
    })
})

// Send telemetry every 500ms (keeps using exec_id)
setInterval(() => {
    client.publish(`robot/${ROBOT_ID}/telemetry`, JSON.stringify({
        type: "TELEMETRY",
        exec_id: exec_id,
        seq_current: waypointQueue.length ? waypointQueue[0].wp.seq : 0,
        x: Number(currentX.toFixed(3)),
        y: Number(currentY.toFixed(3)),
        theta: 0,
        speed: 0.5,
        nozzle_state: nozzle_state,
        battery_pct: 85 + Math.random() * 5,
        deviation_m: Math.random() * 0.02,
        timestamp_ms: Date.now()
    }), { qos: 0 })

    console.log(`[ROBOT] TELEMETRY → x=${currentX.toFixed(2)}, y=${currentY.toFixed(2)} (queue=${waypointQueue.length})`)
}, 500)

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms))
}
