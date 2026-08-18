# ETHFlowLeaf tests

Three scripts, run from inside a project that depends on `etherial` (the
imports go through the package, not through relative paths, so the leaf is
exercised the way an application uses it).

They need a throwaway Postgres database and the connection details of one:

```sh
createdb eth_flow_test
set -a; source .env; set +a
node node_modules/etherial/dist/leafs/ETHFlowLeaf/tests/engine.mjs
```

- `engine.mjs` — branches, templates, dedup, a durable `flow.wait` resumed from
  its row, `for_each`, and a failing step.
- `reminder.mjs` — the scheduled query end to end: appointments starting within
  24 hours, checked every ten minutes, notified once. This is the test that
  proves the reminder does not go out six times an hour.
- `model-triggers.mjs` — the lifecycle triggers derived from admin collections,
  including `watch_fields`, relation hydration and bulk writes.

Each drops nothing and creates its own tables, so give it a database you are
happy to `DROP` between runs.
