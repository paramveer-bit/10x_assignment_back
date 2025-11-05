type Waiter = {
    resolve: (v?: any) => void
    reject: (err: any) => void
    timer: NodeJS.Timeout
}

const waiters = new Map<string, Waiter>()

export function makeKey(execId: string, seq: number) {
    return `${execId}:${seq}`
}

export function setWaiter(execId: string, seq: number, timeoutMs: number) {
    const key = makeKey(execId, seq)
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const w = waiters.get(key)
            if (w) {
                w.reject(new Error('ACK_TIMEOUT'))
                waiters.delete(key)
            }
        }, timeoutMs)
        waiters.set(key, { resolve, reject, timer })
    })
}

export function resolveWaiter(execId: string, seq: number, value?: any) {
    const key = makeKey(execId, seq)
    const w = waiters.get(key)
    if (!w) return false
    clearTimeout(w.timer)
    w.resolve(value)
    waiters.delete(key)
    return true
}
