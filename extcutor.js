// backend_executor.js
const mqtt = require('mqtt')
const { v4: uuidv4 } = require('uuid')

// config
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883'
const ACK_TIMEOUT = 2000 // ms
const ACK_RETRIES = 3
const CLIENT_ID = 'backend-executor-' + uuidv4()

const client = mqtt.connect(MQTT_URL, { clientId: CLIENT_ID, clean: false }) // persistent session

const ACK_WAITERS = new Map()


client.on('connect', () => {
  console.log('MQTT connected')
  // subscribe to ack and events for all robots (or per-robot)
  client.subscribe('robot/+/ack')
  client.subscribe('robot/+/events')
  client.subscribe('robot/+/telemetry')
})


client.on('message', (topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString())
    // extract robotId from topic: e.g., robot/{robotId}/ack
    const parts = topic.split('/')
    const robotId = parts[1]
    handleIncoming(robotId, msg)
  } catch (e) {
    console.error('Bad message', e)
  }
})



function handleIncoming(robotId, msg) {
  const type = msg.type
  if (type === 'ACK' || type === 'WAYPOINT_REACHED') {
    const key = `${msg.exec_id}:${msg.seq}`
    const waiter = ACK_WAITERS.get(key)
    if (waiter) {
      waiter.resolve(msg)
      ACK_WAITERS.delete(key)
    }
    // persist event to DB (not shown) ...
    console.log('ACK/REACHED for', key)
  } else if (type === 'TELEMETRY') {
    // save telemetry (to DB/TSDB)
    // telemetryHandler(msg)
    console.log('telemetry', msg.exec_id, msg.seq_current)
  } else {
    // events/error handling
    console.log('event', type, msg)
  }
}


function waitForAck(execId, seq, timeoutMs) {
  return new Promise((resolve, reject) => {
    const key = `${execId}:${seq}`
    const timer = setTimeout(() => {
      if (ACK_WAITERS.has(key)) {
        ACK_WAITERS.get(key).reject(new Error('ACK_TIMEOUT'))
        ACK_WAITERS.delete(key)
      }
    }, timeoutMs)

    const wrapper = {
      resolve: (msg) => {
        clearTimeout(timer)
        resolve(msg)
      },
      reject: (err) => {
        clearTimeout(timer)
        reject(err)
      }
    }
    ACK_WAITERS.set(key, wrapper)
  })
}



async function sendWaypoint(robotId, execId, waypoint) {
  const msgId = uuidv4()
  const payload = {
    type: 'WAYPOINT',
    msg_id: msgId,
    exec_id: execId,
    payload: waypoint,
    sent_at_ms: Date.now()
  }
  const topic = `server/robot/${robotId}/cmd`
  for (let attempt = 0; attempt < ACK_RETRIES; attempt++) {
    client.publish(topic, JSON.stringify(payload), { qos: 1 })
    try {
      const ack = await waitForAck(execId, waypoint.seq, ACK_TIMEOUT)
      // optionally validate ack.status or content
      return ack
    } catch (err) {
      console.warn(`No ACK for ${execId}:${waypoint.seq} attempt ${attempt+1}`)
      if (attempt === ACK_RETRIES - 1) throw new Error('ACK_FAILED')
    }
  }
}



// executor that streams a list of waypoints sequentially
async function streamTrajectory(robotId, execId, waypoints) {
  for (const wp of waypoints) {
    try {
      const ack = await sendWaypoint(robotId, execId, wp)
      console.log('sent', wp.seq, 'ack', ack.status)
      // optionally wait until WAYPOINT_REACHED event recorded before next (or continue)
      // e.g., poll DB events or set another waiter for WAYPOINT_REACHED
    } catch (err) {
      console.error('Failed at seq', wp.seq, err)
      // update DB execution status to ERROR/PAUSED
      throw err
    }
  }
  // mark execution completed in DB
  console.log('Execution finished', execId)
}
