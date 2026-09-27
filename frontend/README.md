# Frontend (Vite + React)

Feature-Sliced Design app for CodeYoung trial booking.

Developer setup, environment variables, tests, and product behavior: **[repository README](../README.md)**.

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
```

Locally, leave `VITE_API_URL` unset so the Vite proxy sends `/api` to `http://localhost:3000`. Production builds must set `VITE_API_URL` to the deployed API `/api` prefix (see `.env.example`).
