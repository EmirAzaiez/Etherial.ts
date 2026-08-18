// Run it by hand.
//
// Every flow needs this before it is trusted with a schedule: the customer picks
// a real record, presses Run, and reads the step log. It is also a legitimate
// end state — an automation that is only ever meant to be a button.
import { registry } from '../registry/Registry.js';
import { collectionOutputFields, listCollections, collectionLabelPlural } from '../registry/admin.js';
export const manualTrigger = {
    id: 'manual.run',
    label: 'When run manually',
    description: 'Runs only when someone presses the button, optionally on a record they pick.',
    icon: 'Play',
    kind: 'manual',
    group: 'Manual',
    config: () => [
        {
            name: 'collection',
            type: 'select',
            label: 'Runs on',
            helpText: 'Leave empty for an automation that needs no record.',
            options: listCollections().map((collection) => ({
                value: collection.name,
                label: collectionLabelPlural(collection),
            })),
        },
    ],
    output: (config) => (config === null || config === void 0 ? void 0 : config.collection) ? collectionOutputFields(config.collection) : [],
};
export function registerManualTrigger() {
    registry.registerTrigger(manualTrigger);
}
