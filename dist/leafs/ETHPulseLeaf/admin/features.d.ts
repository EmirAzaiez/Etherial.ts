import { Action } from '../../ETHAdminLeaf/features/ActionRegistry.js';
import { Hook } from '../../ETHAdminLeaf/features/HookRegistry.js';
export declare const pulseActions: Record<string, Omit<Action, 'name'>>;
export declare const pulseHooks: Record<string, Omit<Hook, 'name'>>;
export declare function registerPulseCollections(adminLeaf: {
    registerCollection: (config: any) => void;
}): void;
type ActionRegistry = {
    register: (name: string, action: Omit<Action, 'name'>) => void;
};
type HookRegistry = {
    register: (name: string, hook: Omit<Hook, 'name'>) => void;
};
export declare function registerPulseActions(registry: ActionRegistry): void;
export declare function registerPulseHooks(registry: HookRegistry): void;
export declare function registerPulseFeatures(actions: ActionRegistry, hooks: HookRegistry): void;
export {};
