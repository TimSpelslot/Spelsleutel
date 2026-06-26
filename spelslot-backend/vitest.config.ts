import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    clearMocks: true,
    restoreMocks: true,
    // The suite is pure, fast unit tests (mocked DB/Firebase). Spreading it
    // across multiple worker forks gains nothing and intermittently triggers
    // "Worker exited unexpectedly" on Windows when a child fork is killed
    // during parallel teardown (made worse by V8 coverage memory pressure).
    // Run everything in a single fork to make teardown deterministic.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
})
