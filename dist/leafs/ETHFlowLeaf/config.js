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
export const ADMIN_PREFIX = '/admin/flows';
export const WEBHOOK_PREFIX = '/flow-hooks';
const DEFAULTS = {
    timezone: undefined,
    tickIntervalMinutes: 1,
    maxSteps: 500,
    retentionDays: 30,
    modelTriggers: true,
};
let current = Object.assign({}, DEFAULTS);
export function setLeafConfig(config) {
    current = Object.assign(Object.assign({}, DEFAULTS), config);
}
export function leafConfig() {
    return current;
}
