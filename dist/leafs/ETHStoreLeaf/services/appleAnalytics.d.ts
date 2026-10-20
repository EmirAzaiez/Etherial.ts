import type { StoreCursor } from '../models/StoreStatus.js';
import { DayMetrics, SourceKey } from './common.js';
export type ReportKind = 'engagement' | 'downloads' | 'installs' | 'sessions' | 'crashes';
export declare const REPORT_KINDS: ReportKind[];
/** The kind of a report from its name, or null. Standard first, then the plain one; never the Detailed. */
export declare function reportKind(name: string): {
    kind: ReportKind;
    rank: number;
} | null;
export declare function appleSource(type: string | undefined): SourceKey;
/** A report's rows, day by day, kept to the app. */
export declare function analyticsDays(kind: ReportKind, rows: Record<string, string>[], appId: string): Map<string, DayMetrics>;
export interface AnalyticsRun {
    appId: string;
    bearer: () => string;
    /** Updated as it reads: kept even when a report fails. */
    cursor: StoreCursor;
    /** The first day kept. */
    since: string;
    write: (day: string, metrics: DayMetrics) => Promise<void>;
}
/**
 * Reads the instances not read yet, the history first: its days only up to
 * the first one the daily request gave. Returns what the admins should know
 * (reports still being prepared, history still coming), or null.
 */
export declare function appleAnalytics(run: AnalyticsRun): Promise<string | null>;
