// Unit isolation: deliberately permit out-of-order completions to exercise the
// provider's generation guards independently of the real cross-tab lock suite.
export const runAuthTransition = (operation) => operation()
