export { installModelHooks } from './model.js';
export { runScheduleTick } from './schedule.js';
export { webhookTrigger } from './webhook.js';
export { manualTrigger } from './manual.js';
/**
 * The triggers that are not derived from anything.
 *
 * `model.*` is absent on purpose: those are read off the admin collections at
 * lookup time, because they do not exist yet when this runs.
 */
export declare function registerBuiltinTriggers(): void;
