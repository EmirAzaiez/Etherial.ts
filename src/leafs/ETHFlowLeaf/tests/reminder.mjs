// The example the customer gave, end to end:
//   "every 10 minutes, look for appointments starting within 24 hours,
//    send a notification — and don't send it six times an hour."
import etherial from 'etherial'
import { DataTypes } from 'sequelize'
import { Database } from 'etherial/components/database/index'
import { Flow } from 'etherial/leafs/ETHFlowLeaf/models/Flow'
import { FlowRun } from 'etherial/leafs/ETHFlowLeaf/models/FlowRun'
import { FlowRunKey } from 'etherial/leafs/ETHFlowLeaf/models/FlowRunKey'
import { registry } from 'etherial/leafs/ETHFlowLeaf/registry/Registry'
import { registerBuiltinTriggers, runScheduleTick } from 'etherial/leafs/ETHFlowLeaf/triggers/index'
import { registerBuiltinNodes } from 'etherial/leafs/ETHFlowLeaf/nodes/index'
import { setLeafConfig } from 'etherial/leafs/ETHFlowLeaf/config'

setLeafConfig({ timezone: 'Asia/Riyadh' })

const db = new Database({
    server: process.env.DATABASE_SERVER, port: Number(process.env.DATABASE_PORT),
    name: 'eth_flow_test', username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD, dialect: 'postgres', logging: false,
})
db.addModels([Flow, FlowRun, FlowRunKey])

const Appointment = db.sequelize.define('Appointment', {
    customer_name: DataTypes.STRING,
    starts_at: DataTypes.DATE,
    status: DataTypes.STRING,
}, { tableName: 'test_appointments', timestamps: true, underscored: true })

await db.run()

// The flow tables are synced, not forced, so a second run against the same
// database would count the first run's rows and report failures that are only
// leftovers. Start from empty.
await db.sequelize.query('TRUNCATE flows, flow_runs, flow_run_keys RESTART IDENTITY')
await Appointment.sync({ force: true })

// Stand in for ETHAdminLeaf: this is all the flow leaf reads from it.
const collections = [{
    name: 'appointments',
    model: Appointment,
    crud: { create: true, read: true, update: true, delete: true },
    meta: { label: 'Appointment', labelPlural: 'Appointments' },
    fields: [
        { name: 'customer_name', type: 'string', label: 'Customer' },
        { name: 'starts_at', type: 'datetime', label: 'Starts at' },
        { name: 'status', type: 'select', label: 'Status', options: [
            { value: 'confirmed', label: 'Confirmed' }, { value: 'cancelled', label: 'Cancelled' },
        ]},
    ],
}]
etherial.eth_admin_leaf = {
    collections,
    getCollection: (name) => collections.find((c) => c.name === name) ?? null,
    canAccessAdmin: async () => true,
}

registerBuiltinTriggers()
registerBuiltinNodes()

const sent = []
registry.registerNode({
    id: 'test.notify', label: 'Notify', category: 'notify',
    config: [{ name: 'to', type: 'string' }, { name: 'message', type: 'string' }],
    execute: async ({ config }) => { sent.push(`${config.to}: ${config.message}`); return {} },
})

const ok = (label, cond, extra) => console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}${cond || extra === undefined ? '' : `\n     got: ${extra}`}`)

// ── The derived model triggers the customer asked for ─────────────────────
const derived = registry.listTriggers().map((t) => t.id)
ok('model triggers derived from the admin collection',
   ['model.appointments.created','model.appointments.updated','model.appointments.deleted'].every((id) => derived.includes(id)),
   derived.join(', '))

const updated = registry.serializeTrigger(registry.getTrigger('model.appointments.updated'), {})
ok('the updated trigger offers the collection\'s fields to watch',
   (updated.config ?? []).some((f) => f.name === 'watch_fields' && f.options?.some((o) => o.value === 'status')))
ok('and a repeat policy', (updated.config ?? []).some((f) => f.name === 'dedup_mode'))
ok('and its record shape', (updated.output ?? []).some((f) => f.key === 'customer_name'))

// ── The flow ──────────────────────────────────────────────────────────────
const T0 = new Date('2026-09-01T08:00:00.000Z')

const flow = await Flow.create({
    name: 'Remind 24h before',
    enabled: true,
    trigger_id: 'schedule.query',
    trigger_config: {
        collection: 'appointments',
        date_field: 'starts_at',
        direction: 'upcoming',
        within_amount: 24,
        within_unit: 'hours',
        from_amount: 0,
        filters: [{ field: 'status', operator: 'eq', value: 'confirmed' }],
        limit: 100,
        mode: 'every_minutes',
        every_minutes: 10,
        // The whole point: one reminder per appointment, ever.
        dedup_mode: 'once_per_record',
    },
    graph: {
        nodes: [
            { id: 'trigger', kind: 'trigger', type: 'schedule.query', config: {}, position: {x:0,y:0} },
            { id: 'notify', kind: 'node', type: 'test.notify', config: {
                to: '{{record.customer_name}}',
                message: 'Your appointment is on {{record.starts_at | date:"DD/MM HH:mm"}}',
            }, position: {x:0,y:1} },
        ],
        edges: [{ id: 'e1', source: 'trigger', target: 'notify' }],
    },
})

await Appointment.bulkCreate([
    // inside the window at T0
    { customer_name: 'Amina', starts_at: new Date(T0.getTime() + 20 * 3600 * 1000), status: 'confirmed' },
    // inside the window, but cancelled
    { customer_name: 'Cancelled Carl', starts_at: new Date(T0.getTime() + 18 * 3600 * 1000), status: 'cancelled' },
    // too far out at T0 — enters the 24h window an hour and a half in
    { customer_name: 'Bilal', starts_at: new Date(T0.getTime() + 25.5 * 3600 * 1000), status: 'confirmed' },
    // already past
    { customer_name: 'Yesterday Yasmin', starts_at: new Date(T0.getTime() - 2 * 3600 * 1000), status: 'confirmed' },
])

// Six ticks, ten minutes apart — an hour of the ticker running.
for (let i = 0; i < 6; i += 1) {
    await runScheduleTick(new Date(T0.getTime() + i * 10 * 60 * 1000))
}

ok('one notification after an hour of ticking, not six', sent.length === 1, JSON.stringify(sent))
ok('to the right person, with a readable date', sent[0] === 'Amina: Your appointment is on 02/09 07:00', sent[0])

// Two more hours of ticking: Bilal enters the window, nobody repeats.
for (let i = 6; i < 18; i += 1) {
    await runScheduleTick(new Date(T0.getTime() + i * 10 * 60 * 1000))
}
ok('the appointment that entered the window later is notified', sent.length === 2, JSON.stringify(sent))
ok('with its own date', sent[1] === 'Bilal: Your appointment is on 02/09 12:30', sent[1])
ok('and Amina is still not notified twice', sent.filter((s) => s.startsWith('Amina')).length === 1)
ok('the cancelled one is filtered out', !sent.some((s) => s.startsWith('Cancelled')))
ok('the past one is outside the window', !sent.some((s) => s.startsWith('Yesterday')))

// A tick that is not on the schedule does nothing.
const before = sent.length
await runScheduleTick(new Date(T0.getTime() + 185 * 60 * 1000)) // :05, not a multiple of 10
ok('an off-schedule minute is skipped', sent.length === before)

const runs = await FlowRun.count({ where: { flow_id: flow.id } })
ok('exactly two runs recorded', runs === 2, String(runs))
const keys = await FlowRunKey.count({ where: { flow_id: flow.id } })
ok('two dedup keys held', keys === 2, String(keys))

process.exit(0)
