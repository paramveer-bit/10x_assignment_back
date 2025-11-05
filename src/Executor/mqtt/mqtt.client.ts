import mqtt, { MqttClient } from 'mqtt'
import { randomUUID } from 'crypto'

let client: MqttClient | null = null

export function getMqttClient() {
    if (client) return client

    const url = process.env.MQTT_URL || 'mqtt://localhost:1883'
    const username = process.env.BROKER_USERNAME
    const password = process.env.BROKER_PASSWORD
    const clientId = process.env.MQTT_CLIENT_ID || `executor-${randomUUID()}`

    client = mqtt.connect(url, {
        clientId,
        username,
        password,
        clean: false,
        reconnectPeriod: 1000,
        keepalive: 30
    })
    return client
}
