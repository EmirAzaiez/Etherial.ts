// ──────────────────────────────────────────────────────────────────────────
// ETHFlowLeaf — types.
//
// A flow is a trigger plus a graph of steps, stored as JSON and edited in the
// back-office. Nothing here knows about any particular business object: a
// trigger says *when*, a node says *what*, and the engine only carries opaque
// values between them.
//
// Config fields are `FieldDefinition` — the same shape the admin panel already
// renders for collection forms and actions. That is deliberate: a second field
// system would mean re-implementing relation pickers, selects and media inputs
// inside the flow builder, and the two would drift.
// ──────────────────────────────────────────────────────────────────────────
export {};
