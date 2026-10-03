# Architecture

**Style: modular / distributed-backend.** The backend is split into independent Node.js processes (logical services) that talk to each other over HTTP/REST. On a laptop they all run on `localhost` on different ports; nothing here is *physically* distributed. Because each service owns its own data and only exposes an API, any of them could later be deployed to its own machine or container by changing only the `*_SERVICE_URL` variables.

```
Browser ──► React SPA (Vite build, served by the gateway)
              │  /api/*
              ▼
        API Gateway :4000   (JWT check, routing, health, aggregation)
     ┌────────┼───────────┬──────────────┐
     ▼        ▼           ▼              ▼
  Auth      File       Permission      Audit
 :4101     :4102        :4103          :4104
 users     files        permissions    transfer_logs
            │ Encryption module (AES-256-GCM)
            ▼
     uploads/encrypted/*.enc   (private disk directory)
                 all four services ──► MongoDB
```

| Component | Responsibility | Owns |
|---|---|---|
| Frontend | Screens, calls `/api` only, never sees keys | – |
| Gateway | Single entry point; verifies JWT; proxies; `/api/health`, `/api/service-status`, `/api/overview`, `/api/admin/stats`; rate-limits login | – |
| Auth service | Register, login (bcrypt), JWT issue, user admin | `users` |
| File service | Upload/validate, **encrypt**, store, list, **decrypt on download**, delete | `files`, encrypted blobs |
| Permission service | Grant/revoke/check sharing rights | `permissions` |
| Audit service | Records and serves events | `transfer_logs` |
| Admin module | Not a separate process: admin routes live in the auth/audit services (`/admin/*`) and the gateway (`/api/admin/stats`), all guarded by `role === 'admin'` | – |

All four services share one MongoDB *database* but each only touches its own collection(s); cross-service data goes through APIs.

## Communication
* Browser → gateway: `Authorization: Bearer <JWT>`.
* Gateway → service: same header forwarded; **every service re-verifies the JWT** (it does not trust the gateway blindly).
* Service → service: `/internal/*` routes protected by the `x-internal-key` shared secret (`INTERNAL_API_KEY`). The gateway never routes `/internal`, and strips any client-supplied `x-internal-key`.
  * file → permission: "may user X access file Y?" (fails **closed** if unreachable)
  * permission → file: "who owns file Y?" ; permission → auth: "find user by email"
  * auth / file / permission → audit: fire-and-forget event logging

## Flows
**Upload:** browser multipart → gateway (streams) → file service: JWT ✔ → size/type validation (multer) → sanitise name → random data key → AES-256-GCM encrypt → write `<random>.enc` (temp file + rename) → save metadata → audit `UPLOAD`.

**Download:** JWT ✔ → load metadata → owner? else ask permission service → *only then* read ciphertext → unwrap key → decrypt → verify SHA-256 → audit `DOWNLOAD` → stream original bytes with `Content-Disposition: attachment`. Denied attempts are logged as `DOWNLOAD_DENIED`.

**Share / revoke:** owner verified via file service → recipient resolved via auth service → permission upserted → audit `SHARE`. Revoke sets `status: "revoked"` (document kept for history) → audit `REVOKE`; the next download check fails.

## Fault isolation
Kill any one service and the rest keep working:
* Gateway health checks use short timeouts and never throw; `/api/service-status` marks the dead service `down`.
* Proxy errors become JSON `502 { error, service }`.
* File list degrades: if the permission service is down you still see your own files (with a warning); downloads of *shared* files are refused (fail-closed).
* If the audit service is down, actions still succeed but the event is not recorded (fail-open trade-off, printed as a warning).
* Dashboard and admin stats show partial data plus a warning banner.

Try it: `Ctrl+C` is not needed — run services individually (`npm run start:auth` etc.), stop one, open **System Status**.

## Future deployment
Give each service its own container/host, point `*_SERVICE_URL` at them, move the collections to separate databases, replace the shared `INTERNAL_API_KEY` with mTLS or signed service tokens, and swap the local `uploads/` directory for object storage (S3-style) with a KMS-held master key.
