// fast-check configuration for all property tests
export const FC_CONFIG = {
  numRuns: 100,       // minimum 100 iterations per property
  verbose: true,      // show counterexamples on failure
  endOnFailure: true  // stop on first failure for debugging
};
