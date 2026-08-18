import { registerConditionNodes } from './condition.js'
import { registerFlowNodes } from './flow.js'
import { registerDataNodes } from './data.js'
import { registerNotifyNodes } from './notify.js'
import { registerHttpNodes } from './http.js'
import { registerAINodes } from './ai.js'
import { registerActionNodes } from './action.js'

export function registerBuiltinNodes(): void {
    registerConditionNodes()
    registerFlowNodes()
    registerDataNodes()
    registerNotifyNodes()
    registerHttpNodes()
    registerAINodes()
    registerActionNodes()
}
