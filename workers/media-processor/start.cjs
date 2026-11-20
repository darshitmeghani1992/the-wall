/** Fail-closed separate executable so Expo's CommonJS TS checker can import runtime.ts. */
(async () => {
  const { startWorkerRuntime } = await import('./dist/src/runtime.js');
  await startWorkerRuntime();
})().catch(() => {
  console.error('media runtime unavailable; check approved deployment configuration');
  process.exitCode = 1;
});
