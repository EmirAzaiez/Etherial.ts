import type { FlowGraph, GraphEdge, GraphNode } from '../types.js';
export declare function nodeById(graph: FlowGraph, id: string): GraphNode | undefined;
export declare function entryNode(graph: FlowGraph): GraphNode | undefined;
export declare function outgoing(graph: FlowGraph, nodeId: string): GraphEdge[];
/**
 * Where to go after a step.
 *
 * A branching step follows only the edges leaving the handle it chose. A step
 * that chose nothing — or one that does not branch at all — follows every edge,
 * which is how a fan-out into three parallel notifications is drawn.
 */
export declare function successors(graph: FlowGraph, nodeId: string, branch?: string): string[];
/** Every node reachable from a set of starts, following edges forward. */
export declare function reachableFrom(graph: FlowGraph, starts: string[]): Set<string>;
/**
 * Nodes belonging to the tail of a loop and to nothing else.
 *
 * A node the body can also reach stays in the body — if the user drew a line
 * from inside the loop to it, they meant it to run per item. Only what is
 * exclusively behind the `done` handle is fenced off and kept for after.
 */
export declare function loopTailOnly(graph: FlowGraph, bodyStarts: string[], doneStarts: string[]): string[];
/**
 * Whether the graph has a cycle the machine would spin on.
 *
 * The machine is protected anyway — a frame never visits the same node twice —
 * but a cycle almost always means the customer connected something backwards,
 * and saying so at save time beats a run that silently stops halfway.
 */
export declare function findCycle(graph: FlowGraph): string[] | null;
