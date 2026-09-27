import { createElement, useContext } from '../../../frontend/portfolio/node_modules/react/index.js'
import { createRoot } from '../../../frontend/portfolio/node_modules/react-dom/client.js'
import { AuthProvider } from '../../../frontend/portfolio/src/context/AuthContext.jsx'
import { AuthContext } from '../../../frontend/portfolio/src/context/authContext.js'
import { dashboardApi } from '../../../frontend/portfolio/src/services/adminApi.js'

function Probe() {
  const auth = useContext(AuthContext)
  window.authProbe = auth
  window.startOldRequest = () => {
    window.oldRequest = dashboardApi.getStats().catch((error) => error.status)
  }
  return createElement('output', null, auth.loading ? 'loading' : auth.user?.id ?? 'anonymous')
}

createRoot(document.getElementById('root')).render(
  createElement(AuthProvider, null, createElement(Probe)),
)
