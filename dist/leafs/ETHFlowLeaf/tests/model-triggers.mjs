// "tel model a été créé, tel model a été modifié" — the generic lifecycle
// triggers, derived from whatever the admin panel exposes.
import etherial from 'etherial'
import { DataTypes } from 'sequelize'
import { Database } from 'etherial/components/database/index'
import { Flow } from 'etherial/leafs/ETHFlowLeaf/models/Flow'
import { FlowRun } from 'etherial/leafs/ETHFlowLeaf/models/FlowRun'
import { FlowRunKey } from 'etherial/leafs/ETHFlowLeaf/models/FlowRunKey'
import { registry } from 'etherial/leafs/ETHFlowLeaf/registry/Registry'
import { registerBuiltinTriggers, installModelHooks } from 'etherial/leafs/ETHFlowLeaf/triggers/index'
import { registerBuiltinNodes } from 'etherial/leafs/ETHFlowLeaf/nodes/index'
import { refreshListeners, invalidateListeners } from 'etherial/leafs/ETHFlowLeaf/engine/listeners'
import { setLeafConfig } from 'etherial/leafs/ETHFlowLeaf/config'

setLeafConfig({ timezone: 'Asia/Riyadh' })

const db = new Database({
    server: process.env.DATABASE_SERVER, port: Number(process.env.DATABASE_PORT),
    name: 'eth_flow_test', username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD, dialect: 'postgres', logging: false,
})
db.addModels([Flow, FlowRun, FlowRunKey])

const Ticket = db.sequelize.define('Ticket', {
    subject: DataTypes.STRING,
    status: DataTypes.STRING,
    answer: DataTypes.TEXT,
    customer_id: DataTypes.INTEGER,
}, { tableName: 'test_tickets', timestamps: true, underscored: true })

const Customer = db.sequelize.define('Customer', {
    name: DataTypes.STRING,
    email: DataTypes.STRING,
}, { tableName: 'test_customers', timestamps: true, underscored: true })

await db.run()

// The flow tables are synced, not forced, so a second run against the same
// database would count the first run's rows and report failures that are only
// leftovers. Start from empty.
await db.sequelize.query('TRUNCATE flows, flow_runs, flow_run_keys RESTART IDENTITY')
await Customer.sync({ force: true })
await Ticket.sync({ force: true })

const collections = [
    {
        name: 'tickets', model: Ticket, crud: {},
        meta: { label: 'Ticket', labelPlural: 'Tickets' },
        fields: [
            { name: 'subject', type: 'string', label: 'Subject' },
            { name: 'status', type: 'string', label: 'Status' },
            { name: 'answer', type: 'text', label: 'Answer' },
            { name: 'customer_id', type: 'relation', label: 'Customer', relation: { collection: 'customers' } },
        ],
    },
    {
        name: 'customers', model: Customer, crud: {},
        meta: { label: 'Customer', labelPlural: 'Customers' },
        fields: [
            { name: 'name', type: 'string', label: 'Name' },
            { name: 'email', type: 'email', label: 'Email' },
        ],
    },
]
etherial.eth_admin_leaf = {
    collections,
    getCollection: (name) => collections.find((c) => c.name === name) ?? null,
}

registerBuiltinTriggers()
registerBuiltinNodes()

const events = []
registry.registerNode({
    id: 'test.spy', label: 'Spy', category: 'action',
    config: [{ name: 'note', type: 'string' }],
    execute: async ({ config }) => { events.push(config.note); return {} },
})

const ok = (label, cond, extra) => console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}${cond || extra === undefined ? '' : `\n     got: ${extra}`}`)

const graphFor = (note) => ({
    nodes: [
        { id: 'trigger', kind: 'trigger', type: 'x', config: {}, position: {x:0,y:0} },
        { id: 'spy', kind: 'node', type: 'test.spy', config: { note }, position: {x:0,y:1} },
    ],
    edges: [{ id: 'e1', source: 'trigger', target: 'spy' }],
})

await Flow.create({
    name: 'On create', enabled: true, trigger_id: 'model.tickets.created', trigger_config: {},
    graph: graphFor('created: {{record.subject}} for {{record.customer.name}}'),
})

await Flow.create({
    name: 'On answer', enabled: true, trigger_id: 'model.tickets.updated',
    // Only when the answer changes — a typo fixed in the subject must not
    // notify the customer that their ticket was answered.
    trigger_config: { watch_fields: ['answer'] },
    graph: graphFor('answered: {{record.subject}} ({{trigger.changed | json}})'),
})

await Flow.create({
    name: 'On delete', enabled: true, trigger_id: 'model.tickets.deleted', trigger_config: {},
    graph: graphFor('deleted: {{record.subject}}'),
})

const hooked = installModelHooks()
ok('hooks installed on every collection model', hooked === 2, String(hooked))
invalidateListeners()
await refreshListeners()

const settle = () => new Promise((r) => setTimeout(r, 400))

const customer = await Customer.create({ name: 'Amina', email: 'amina@example.com' })
const ticket = await Ticket.create({ subject: 'Broken lift', status: 'open', customer_id: customer.id })
await settle()
ok('creating a record fires the created trigger, relation walked',
   events.includes('created: Broken lift for Amina'), JSON.stringify(events))

events.length = 0
await ticket.update({ subject: 'Broken elevator' })
await settle()
ok('an unwatched field does not fire', events.length === 0, JSON.stringify(events))

await ticket.update({ answer: 'An engineer is on the way.', status: 'answered' })
await settle()
ok('the watched field fires, with the changed list',
   events.some((e) => e.startsWith('answered: Broken elevator') && e.includes('answer')), JSON.stringify(events))

events.length = 0
await ticket.destroy()
await settle()
ok('deleting fires the deleted trigger', events.includes('deleted: Broken elevator'), JSON.stringify(events))

// Bulk writes skip row hooks unless asked; the leaf asks, but only for models
// something is actually listening to.
events.length = 0
await Ticket.bulkCreate([
    { subject: 'Bulk one', status: 'open', customer_id: customer.id },
    { subject: 'Bulk two', status: 'open', customer_id: customer.id },
])
await settle()
await Ticket.update({ answer: 'Handled in batch' }, { where: { status: 'open' } })
await settle()
ok('a bulk update still fires per row',
   events.filter((e) => e.startsWith('answered:')).length === 2, JSON.stringify(events))

const runs = await FlowRun.count()
ok('every fire produced a run', runs >= 5, String(runs))
const failed = await FlowRun.count({ where: { status: 'failed' } })
ok('none of them failed', failed === 0, String(failed))

process.exit(0)
