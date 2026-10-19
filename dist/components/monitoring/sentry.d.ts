/**
 * Error reporting to Sentry, on when `SENTRY_DSN` is set.
 *
 * `@sentry/node` is not a dependency of the framework: a project that wants
 * the reports installs it (`npm install @sentry/node`) and sets the DSN. It is
 * imported by a name held in a variable, so neither tsc nor a bundler goes
 * looking for it in an app that does not use it.
 *
 * What goes out: the error, the route, and the user's id. Not the
 * Authorization header, the cookies, nor any field whose name looks like a
 * password, token or code, at any depth of the body or the query string.
 *
 * Environment: `SENTRY_DSN`, and optionally `SENTRY_ENVIRONMENT` (else
 * `NODE_ENV`) and `SENTRY_RELEASE` (a git hash, say).
 */
/**
 * Loads and starts Sentry when `SENTRY_DSN` is set; does nothing otherwise.
 * Sentry's default integrations then also report uncaught exceptions and
 * unhandled rejections, without changing what the process does with them.
 */
export declare function startSentry(): Promise<void>;
/**
 * Reports an error, with what is safe to know of the request it broke:
 * method, route, scrubbed headers, query and body, and the user's id.
 * A no-op while Sentry is off.
 */
export declare function captureError(error: unknown, req?: any): void;
/** Waits for queued events to go out — before a CLI command exits, say. */
export declare function flushSentry(timeoutMs?: number): Promise<void>;
