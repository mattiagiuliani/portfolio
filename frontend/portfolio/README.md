# Portfolio frontend

React 19 + Vite frontend for the public portfolio and private admin dashboard.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

Set `VITE_API_URL` to the backend base URL when it is not running at
`http://localhost:5000`.

The public site reads published posts, projects and the public Settings profile
from the API. Admin requests use HTTP-only authentication cookies.
