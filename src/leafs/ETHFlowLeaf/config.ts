// Leaf settings, kept apart from app.ts so the engine can read them without
// importing the module that constructs it.

/**
 * Where the two route families live.
 *
 * Constants rather than settings: the paths are baked into decorators, which
 * are evaluated when the route module is imported, and that can happen before
 * any configuration has been handed to the leaf. A prefix option that silently
 * failed to move the routes would be worse than no option at all.
 */
export const ADMIN_PREFIX = '/admin/flows'
export const WEBHOOK_PREFIX = '/flow-hooks'

export interface ETHFlowLeafConfig {
    /**
     * The zone dates are rendered and scheduled in. A reminder that says 09:00
     * has to mean 09:00 where the customer is; leaving this to each flow would
     * mean every flow getting it wrong once.
     */
    timezone?: string
    /** How often the ticker looks for scheduled work. Whole minutes. */
    tickIntervalMinutes?: number
    /** Steps one run may execute before it is stopped as a runaway. */
    maxSteps?: number
    /** Runs older than this are pruned. Null keeps them forever. */
    retentionDays?: number | null
    /** Turns the model.* triggers off, for a project that wants only its own. */
    modelTriggers?: boolean
}

const DEFAULTS: Required<Omit<ETHFlowLeafConfig, 'timezone'>> & { timezone?: string } = {
    timezone: undefined,
    tickIntervalMinutes: 1,
    maxSteps: 500,
    retentionDays: 30,
    modelTriggers: true,
}

let current: ETHFlowLeafConfig = { ...DEFAULTS }

export function setLeafConfig(config: ETHFlowLeafConfig): void {
    current = { ...DEFAULTS, ...config }
}

export function leafConfig(): ETHFlowLeafConfig {
    return current
}
