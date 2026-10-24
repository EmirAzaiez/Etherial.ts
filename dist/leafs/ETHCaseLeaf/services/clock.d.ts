/**
 * Flags the cases gone past their due time, each once: the conditional write
 * only lands on a case not flagged yet, so two servers never alert twice. The
 * flag is the clock's alone and written without hooks: it changes nothing the
 * customer, the history of fields or a sync care about.
 */
export declare function flagOverdueCases(now?: Date): Promise<number>;
