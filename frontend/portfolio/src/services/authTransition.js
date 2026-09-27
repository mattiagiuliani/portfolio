const LOCK_NAME = 'portfolio-admin-auth-transition'

// One origin-wide lock for cookie-mutating operations. The returned promise must
// include the whole response; never release early on a timer or share credentials.
export async function runAuthTransition(operation) {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    throw new Error('Secure admin sign-in requires a browser with Web Locks support. Use an updated browser over HTTPS (or localhost).')
  }
  return navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, operation)
}
