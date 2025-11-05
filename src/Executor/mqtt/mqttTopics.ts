export const topics = {
    // API -> worker
    serverExecutorStart: 'server/executor/start',

    // worker -> robot
    serverRobotCmd: (robotId: string) => `server/robot/${robotId}/cmd`,

    // robot -> worker
    robotAck: (robotId: string) => `robot/${robotId}/ack`,
    robotEvents: (robotId: string) => `robot/${robotId}/events`,
    robotTelemetry: (robotId: string) => `robot/${robotId}/telemetry`
}
