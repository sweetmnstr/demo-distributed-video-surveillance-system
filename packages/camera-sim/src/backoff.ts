// Backoff now lives in @vss/shared so Server A's reconnect controller and the
// camera-sim supervisor share one implementation (DRY).
export { nextDelayMs } from '@vss/shared';
export type { BackoffConfig } from '@vss/shared';
