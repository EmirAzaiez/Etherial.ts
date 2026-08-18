// Graph queries the machine needs. Pure functions over the stored JSON — no
// database, no registry, so they stay testable and cheap to call in a loop.
export function nodeById(graph, id) {
    return graph.nodes.find((node) => node.id === id);
}
export function entryNode(graph) {
    return graph.nodes.find((node) => node.kind === 'trigger');
}
export function outgoing(graph, nodeId) {
    return graph.edges.filter((edge) => edge.source === nodeId);
}
/**
 * Where to go after a step.
 *
 * A branching step follows only the edges leaving the handle it chose. A step
 * that chose nothing — or one that does not branch at all — follows every edge,
 * which is how a fan-out into three parallel notifications is drawn.
 */
export function successors(graph, nodeId, branch) {
    const edges = outgoing(graph, nodeId);
    const selected = branch === undefined ? edges : edges.filter((edge) => { var _a; return ((_a = edge.branch) !== null && _a !== void 0 ? _a : 'next') === branch; });
    return selected.map((edge) => edge.target);
}
/** Every node reachable from a set of starts, following edges forward. */
export function reachableFrom(graph, starts) {
    const seen = new Set();
    const queue = [...starts];
    while (queue.length > 0) {
        const id = queue.shift();
        if (seen.has(id))
            continue;
        seen.add(id);
        for (const edge of outgoing(graph, id))
            queue.push(edge.target);
    }
    return seen;
}
/**
 * Nodes belonging to the tail of a loop and to nothing else.
 *
 * A node the body can also reach stays in the body — if the user drew a line
 * from inside the loop to it, they meant it to run per item. Only what is
 * exclusively behind the `done` handle is fenced off and kept for after.
 */
export function loopTailOnly(graph, bodyStarts, doneStarts) {
    const body = reachableFrom(graph, bodyStarts);
    const tail = reachableFrom(graph, doneStarts);
    return Array.from(tail).filter((id) => !body.has(id));
}
/**
 * Whether the graph has a cycle the machine would spin on.
 *
 * The machine is protected anyway — a frame never visits the same node twice —
 * but a cycle almost always means the customer connected something backwards,
 * and saying so at save time beats a run that silently stops halfway.
 */
export function findCycle(graph) {
    const state = new Map();
    const path = [];
    const walk = (id) => {
        const current = state.get(id);
        if (current === 'done')
            return null;
        if (current === 'visiting')
            return [...path.slice(path.indexOf(id)), id];
        state.set(id, 'visiting');
        path.push(id);
        for (const edge of outgoing(graph, id)) {
            const cycle = walk(edge.target);
            if (cycle)
                return cycle;
        }
        path.pop();
        state.set(id, 'done');
        return null;
    };
    for (const node of graph.nodes) {
        const cycle = walk(node.id);
        if (cycle)
            return cycle;
    }
    return null;
}
