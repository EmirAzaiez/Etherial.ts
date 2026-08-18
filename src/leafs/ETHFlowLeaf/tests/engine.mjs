import { Database } from 'etherial/components/database/index'
import { Flow } from 'etherial/leafs/ETHFlowLeaf/models/Flow'
import { FlowRun, FlowRunStatus } from 'etherial/leafs/ETHFlowLeaf/models/FlowRun'
import { FlowRunKey } from 'etherial/leafs/ETHFlowLeaf/models/FlowRunKey'
import { registry } from 'etherial/leafs/ETHFlowLeaf/registry/Registry'
import { registerBuiltinTriggers } from 'etherial/leafs/ETHFlowLeaf/triggers/index'
import { registerBuiltinNodes } from 'etherial/leafs/ETHFlowLeaf/nodes/index'
import { runFlow, resumeDueRuns } from 'etherial/leafs/ETHFlowLeaf/engine/fire'
import { setLeafConfig } from 'etherial/leafs/ETHFlowLeaf/config'

setLeafConfig({ timezone: 'Asia/Riyadh' })

const db = new Database({
    server: process.env.DATABASE_SERVER,
    port: Number(process.env.DATABASE_PORT),
    name: 'eth_flow_test',
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    dialect: 'postgres',
    logging: false,
})
db.addModels([Flow, FlowRun, FlowRunKey])
await db.run()

// The flow tables are synced, not forced, so a second run against the same
// database would count the first run's rows and report failures that are only
// leftovers. Start from empty.
await db.sequelize.query('TRUNCATE flows, flow_runs, flow_run_keys RESTART IDENTITY')

registerBuiltinTriggers()
registerBuiltinNodes()

const calls = []
registry.registerNode({
    id: 'test.record',
    label: 'Record a call',
    category: 'action',
    config: [{ name: 'message', type: 'string', label: 'Message' }],
    output: [{ key: 'echo', label: 'Echo', type: 'string' }],
    execute: async ({ config, log }) => {
        calls.push(config.message)
        log(`recorded "${config.message}"`)
        return { output: { echo: config.message } }
    },
})

const ok = (label, cond) => console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`)

// ── 1. a straight run, with templates and a condition ──────────────────────
const flow = await Flow.create({
    name: 'Greet',
    enabled: true,
    trigger_id: 'manual.run',
    trigger_config: {},
    graph: {
        nodes: [
            { id: 'trigger', kind: 'trigger', type: 'manual.run', config: {}, position: {x:0,y:0} },
            { id: 'if', kind: 'node', type: 'condition.if', config: {
                match: 'all',
                conditions: [{ left: '{{record.status}}', operator: 'eq', right: 'confirmed' }],
            }, position: {x:0,y:1} },
            { id: 'yes', kind: 'node', type: 'test.record', config: { message: 'hello {{record.name}}' }, position: {x:0,y:2} },
            { id: 'no', kind: 'node', type: 'test.record', config: { message: 'skipped' }, position: {x:1,y:2} },
        ],
        edges: [
            { id:'e1', source:'trigger', target:'if' },
            { id:'e2', source:'if', target:'yes', branch:'true' },
            { id:'e3', source:'if', target:'no', branch:'false' },
        ],
    },
})

let out = await runFlow(flow, { triggerId: 'manual.run', record: { name: 'Emir', status: 'confirmed' } })
ok('run succeeds', out.run?.status === FlowRunStatus.SUCCESS)
ok('true branch taken, false branch not', JSON.stringify(calls) === '["hello Emir"]')
ok('step logs recorded', (out.run.step_logs ?? []).length === 2)

calls.length = 0
out = await runFlow(flow, { triggerId: 'manual.run', record: { name: 'Emir', status: 'draft' } })
ok('false branch taken', JSON.stringify(calls) === '["skipped"]')

// ── 2. dedup: the user's "don't send the reminder six times" ───────────────
calls.length = 0
const remind = await Flow.create({
    name: 'Remind',
    enabled: true,
    trigger_id: 'manual.run',
    trigger_config: { dedup_mode: 'once_per_record' },
    graph: {
        nodes: [
            { id: 'trigger', kind: 'trigger', type: 'manual.run', config: {}, position: {x:0,y:0} },
            { id: 'send', kind: 'node', type: 'test.record', config: { message: 'reminder for {{record.id}}' }, position: {x:0,y:1} },
        ],
        edges: [{ id:'e1', source:'trigger', target:'send' }],
    },
})

const a = await runFlow(remind, { triggerId: 'manual.run', record: { id: 42 } })
const b = await runFlow(remind, { triggerId: 'manual.run', record: { id: 42 } })
const c = await runFlow(remind, { triggerId: 'manual.run', record: { id: 43 } })
ok('first fires', a.run !== null)
ok('second is deduplicated', b.run === null && b.skipped === 'deduplicated')
ok('a different record still fires', c.run !== null)
ok('sent exactly twice', calls.length === 2)

// ── 3. a durable wait survives being written to a row ──────────────────────
calls.length = 0
const waiting = await Flow.create({
    name: 'Wait then act',
    enabled: true,
    trigger_id: 'manual.run',
    trigger_config: {},
    graph: {
        nodes: [
            { id: 'trigger', kind: 'trigger', type: 'manual.run', config: {}, position: {x:0,y:0} },
            { id: 'before', kind: 'node', type: 'test.record', config: { message: 'before' }, position: {x:0,y:1} },
            { id: 'wait', kind: 'node', type: 'flow.wait', config: { mode: 'duration', amount: 1, unit: 'minutes' }, position: {x:0,y:2} },
            { id: 'after', kind: 'node', type: 'test.record', config: { message: 'after' }, position: {x:0,y:3} },
        ],
        edges: [
            { id:'e1', source:'trigger', target:'before' },
            { id:'e2', source:'before', target:'wait' },
            { id:'e3', source:'wait', target:'after' },
        ],
    },
})

const w = await runFlow(waiting, { triggerId: 'manual.run', record: { id: 1 } })
ok('run suspends', w.run.status === FlowRunStatus.WAITING)
ok('only the pre-wait step ran', JSON.stringify(calls) === '["before"]')
ok('state was stored', !!w.run.state && Array.isArray(w.run.state.frames))

// Rewind the clock rather than sleeping a minute: the point of the test is
// that the run comes back from the row, not that setTimeout works.
await w.run.update({ resume_at: new Date(Date.now() - 1000) })
const resumed = await resumeDueRuns()
ok('one run resumed', resumed === 1)
const reloaded = await FlowRun.findByPk(w.run.id)
ok('resumed run finished', reloaded.status === FlowRunStatus.SUCCESS)
ok('post-wait step ran', JSON.stringify(calls) === '["before","after"]')
ok('state cleared when finished', !reloaded.state)

// ── 4. a loop, and what comes after it ─────────────────────────────────────
calls.length = 0
const looping = await Flow.create({
    name: 'Loop',
    enabled: true,
    trigger_id: 'manual.run',
    trigger_config: {},
    graph: {
        nodes: [
            { id: 'trigger', kind: 'trigger', type: 'manual.run', config: {}, position: {x:0,y:0} },
            { id: 'each', kind: 'node', type: 'flow.for_each', config: { items: '{{record.guests}}' }, position: {x:0,y:1} },
            { id: 'body', kind: 'node', type: 'test.record', config: { message: 'guest {{loop.number}}: {{item.name}}' }, position: {x:0,y:2} },
            { id: 'done', kind: 'node', type: 'test.record', config: { message: 'done' }, position: {x:1,y:2} },
        ],
        edges: [
            { id:'e1', source:'trigger', target:'each' },
            { id:'e2', source:'each', target:'body', branch:'item' },
            { id:'e3', source:'each', target:'done', branch:'done' },
        ],
    },
})

const l = await runFlow(looping, { triggerId: 'manual.run', record: { guests: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] } })
ok('loop run succeeds', l.run.status === FlowRunStatus.SUCCESS)
ok('body ran once per item, tail ran once after', JSON.stringify(calls) === '["guest 1: A","guest 2: B","guest 3: C","done"]')

// ── 5. a failing step stops the run, and says why ──────────────────────────
registry.registerNode({
    id: 'test.boom', label: 'Explode', category: 'action', config: [],
    execute: async () => { throw new Error('kaboom') },
})

const failing = await Flow.create({
    name: 'Fails', enabled: true, trigger_id: 'manual.run', trigger_config: {},
    graph: {
        nodes: [
            { id: 'trigger', kind: 'trigger', type: 'manual.run', config: {}, position: {x:0,y:0} },
            { id: 'boom', kind: 'node', type: 'test.boom', config: {}, position: {x:0,y:1} },
            { id: 'never', kind: 'node', type: 'test.record', config: { message: 'never' }, position: {x:0,y:2} },
        ],
        edges: [{ id:'e1', source:'trigger', target:'boom' }, { id:'e2', source:'boom', target:'never' }],
    },
})

calls.length = 0
const f = await runFlow(failing, { triggerId: 'manual.run', record: {} })
ok('run marked failed', f.run.status === FlowRunStatus.FAILED)
ok('error kept', /kaboom/.test(f.run.error ?? ''))
ok('nothing downstream ran', calls.length === 0)
await failing.reload()
ok('error counted on the flow', failing.error_count === 1 && /kaboom/.test(failing.last_error ?? ''))

process.exit(0)
