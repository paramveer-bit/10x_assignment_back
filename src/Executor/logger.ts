import pino from 'pino'

// Configure transport only when not in production. Use require.resolve so pino
// can locate the module by absolute path. If `pino-pretty` is not installed,
// fall back to the default pino output and warn once.
let transport: any = undefined
// if (process.env.NODE_ENV !== 'production') {
//     try {
//         // resolve the installed module to an absolute path so pino can load it
//         // at runtime (avoids the "unable to determine transport target" error).
//         // eslint-disable-next-line @typescript-eslint/no-var-requires
//         const resolved = require.resolve('pino-pretty')
//         transport = { target: resolved, options: { colorize: true } }
//     } catch (err) {
//         // If pino-pretty isn't installed, prefer to continue rather than crash.
//         // eslint-disable-next-line no-console
//         console.warn('pino-pretty not found; using default pino output')
//     }
// }

export const logger = pino({
    //     level: process.env.LOG_LEVEL || 'info',
    //     transport,

})
