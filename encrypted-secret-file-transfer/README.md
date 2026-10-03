# 🔐 Encrypted Secret File Transfer - Distributed Backend Database System

A secure file-transfer system with a React Native / Expo mobile client and a Node.js / Express backend split into independent services behind an API gateway. Files are **encrypted (AES-256-GCM) before they are stored**, access is controlled per file, and every action is written to an audit log. The original browser frontend is retained as an optional client; it is not part of the mobile app.

> **Accurate description:** this is a *modular / distributed-backend* design - separate Node.js services that communicate over REST and can be deployed independently. On one machine they simply run on different ports; it is not a physically distributed cluster.

## Features
Register / login (bcrypt + JWT) · upload with server-side AES-256-GCM encryption · metadata in MongoDB · share with a registered user by email · grant / revoke · "Shared With Me" · authorised download with on-the-fly decryption · audit trail · admin dashboard (users, stats, logs) · service health & fault isolation · dashboard, modals, toasts, progress bar, responsive UI.

## Architecture
```
React Native / Expo ────────────┐
                                 ├─► API Gateway :4000 ─┬─► Auth Service       :4101  (users)
Optional React SPA ──────────────┘                       ├─► File Service       :4102  (files + encryption + private storage)
                                                        ├─► Permission Service :4103  (permissions)
                                                        └─► Audit Service      :4104  (transfer_logs)
                                            all ─► MongoDB
```
Details: `docs/architecture.md`, `docs/api.md`, `docs/database-schema.md`, `docs/security.md`.

## Technology stack
React Native, Expo and TypeScript · React 18 + Vite (optional browser client) · Node.js 18+ · Express · MongoDB + Mongoose · JWT (`jsonwebtoken`) · bcrypt (`bcryptjs`) · Node `crypto` · multer · Postman · Docker (optional).

## Folder structure
```
mobile-app/  Expo Router React Native app (Android and iOS client)
frontend/    Optional existing React browser app
gateway/     API gateway (zero-dependency Node http proxy)
services/    auth-service · file-service · permission-service · audit-service
             (each: controllers/ models/ routes/ middleware/ utils/ server.js)
shared/      env loader, JWT helpers, http helpers, validation, constants, service kit
scripts/     start-all.js · reset-data.js · smoke-test.js · check.js · make-postman.js
tests/       unit tests (crypto, storage safety, validation)
docs/        architecture, API, database schema, security
postman/     Postman collection
uploads/     encrypted blobs are stored in uploads/encrypted (private, git-ignored)
```

## Prerequisites
* **Node.js 18 or newer** (`node -v`)
* **MongoDB** - local Community Server *or* a free MongoDB Atlas cluster
* (optional) MongoDB Compass, Postman, Docker Desktop

## MongoDB setup
**Local (Windows):** install MongoDB Community Server (choose "Run as a service"), then it listens on `mongodb://127.0.0.1:27017`. Check with Compass.
**Atlas:** create a free cluster → Database Access (user + password) → Network Access (allow your IP) → *Connect → Drivers* → copy the URI, e.g. `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/encrypted_file_transfer`, and put it in `MONGODB_URI`.

## Environment setup
```bash
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```
Edit `.env` if needed. Required (the services refuse to start without them): `MONGODB_URI`, `JWT_SECRET`, `FILE_ENCRYPTION_KEY`, `INTERNAL_API_KEY`. For anything beyond a classroom demo generate real values:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
> ⚠ Keep `FILE_ENCRYPTION_KEY` safe and **do not change it** after uploading files, or they can no longer be decrypted.

## Mobile application (primary client)

Follow [mobile-app/README.md](mobile-app/README.md) for Expo setup, API URL configuration, Android/iOS instructions, APK/AAB builds, features and limitations. Quick start on the Android emulator:

```powershell
cd mobile-app
Copy-Item .env.example .env
npm install
npx expo start
```

The default emulator URL is `http://10.0.2.2:4000`; set `EXPO_PUBLIC_API_URL` in `mobile-app/.env` for an iOS simulator or physical phone. The production app requires an HTTPS gateway.

## Optional browser frontend installation
```bash
npm run setup        # installs root + frontend dependencies
```

## How to run
**Development (hot reload UI):**
```bash
npm run reset:data   # creates demo users/files (needs MongoDB running)
npm run dev          # backend services + gateway + Vite UI
```
Open **http://localhost:5173** (UI dev server; proxies `/api` to the gateway).

**Production-style (gateway serves the built UI):**
```bash
npm run build
npm start
```
Open **http://localhost:4000**.

### Run each service separately (4–5 terminals)
```bash
npm run start:auth         # :4101
npm run start:audit        # :4104
npm run start:permission   # :4103
npm run start:file         # :4102
npm run start:gateway      # :4000
```
### Run everything at once
`npm run dev` (or `npm start`). Press `Ctrl+C` to stop all.

## Demo credentials (created by `npm run reset:data`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Admin@123 |
| User | alice@example.com | Alice@123 |
| User | bob@example.com | Bob@123 |

Seed data: 3 users, 2 encrypted files owned by Alice (one already shared with Bob), 1 permission, 6 audit events. Passwords are stored only as bcrypt hashes.

## API endpoints
Full details in `docs/api.md`.
```
POST /api/auth/register   POST /api/auth/login   GET /api/auth/me
POST /api/files/upload    GET /api/files   GET /api/files/:id   GET /api/files/:id/download   DELETE /api/files/:id
POST /api/permissions     GET /api/permissions/:fileId          DELETE /api/permissions/:id
GET  /api/logs
GET  /api/admin/users     GET /api/admin/logs   GET /api/admin/stats
GET  /api/health          GET /api/service-status   GET /api/overview
```

## Encryption workflow
1. Upload arrives (multipart) → JWT, size and type validated.
2. A random 256-bit **data key** is generated for this file.
3. The file is encrypted with **AES-256-GCM** (random IV, auth tag).
4. The data key is encrypted ("wrapped") with the **master key** from `FILE_ENCRYPTION_KEY`.
5. Only ciphertext is written to `uploads/encrypted/<random>.enc`; MongoDB stores metadata + wrapped key + IV + tags.
6. On download the server checks permission **first**, then reads, unwraps, decrypts, verifies the SHA-256 and returns the original bytes.

## Database collections
`users`, `files`, `permissions`, `transfer_logs` - see `docs/database-schema.md`.

## Testing
```bash
npm run check        # syntax-check every backend/script file
npm run test:unit    # crypto, tamper detection, path-traversal, validation (no DB needed)
npm run reset:data   # clean seed
npm run test:smoke   # end-to-end through the gateway (needs MongoDB; starts the stack if not running)
```
The smoke test covers gateway, health, register, login, JWT, upload, metadata, on-disk encryption, share, authorized download, unauthorized rejection, revoke, audit logs, admin protection and the dashboard endpoint.

## Postman
Import `postman/EncryptedFileTransfer.postman_collection.json`. Run `npm run reset:data` first, then run the folders in order (0 → 4). Tokens and IDs are saved to collection variables automatically. In *Upload*, click the `file` field and choose any small `.txt` before sending. Regenerate with `node scripts/make-postman.js`.

## Docker (optional)
```bash
docker compose up --build
docker compose run --rm gateway node scripts/reset-data.js     # seed demo data
```
Open http://localhost:4000. Compass can connect to `mongodb://localhost:27017`. Override secrets with `JWT_SECRET=... FILE_ENCRYPTION_KEY=... docker compose up`.

## Demonstration script (≈ 5 minutes)
1. `npm run reset:data` → `npm run dev` → open http://localhost:5173.
2. Register two users (or use Alice and Bob). Log in as **Alice**, **Upload** `secret.txt`.
3. Open the file **Details**: encryption panel, "Private file". In a terminal show the disk is unreadable: `cat uploads/encrypted/*.enc` (binary noise) - and open **Compass → files** to show only metadata + wrapped key.
4. **Share** with Bob's email. Compass → **permissions**. Log out.
5. Log in as **Bob** → **Shared With Me** → **Download**; open the file: original content.
6. Log in as Alice → file details → **Revoke** Bob.
7. Bob tries to download again → *403 "You do not have permission to access this file"*.
8. Alice → **Activity Logs**: UPLOAD, SHARE, DOWNLOAD, REVOKE, DOWNLOAD_DENIED.
9. Log in as **admin** → Admin: users, totals, system-wide log. Point out admin cannot download others' files.
10. Fault isolation: run services separately, stop the permission service → **System Status** shows only that card red; own files still list.

## Troubleshooting
| Problem | Fix |
|---|---|
| `Missing required environment variables` | `cp .env.example .env` |
| `MongoDB not reachable` | Start the MongoDB service / check `MONGODB_URI` (Atlas: allow your IP) |
| Port already in use (4000–4104, 5173) | Stop the old process or change the ports in `.env` |
| Gateway page says "React app is not built" | `npm run build`, or use `npm run dev` and open :5173 |
| 502 "… service is unavailable" | That service is down - see its `[name]` log line; use System Status |
| Files won't download after changing `.env` | `FILE_ENCRYPTION_KEY` changed → `npm run reset:data` (wipes files) |
| Login says too many attempts | Rate limit; wait a minute or raise `LOGIN_RATE_LIMIT_PER_MIN` |
| Upload rejected 415 / 413 | File type not allowed / larger than `MAX_FILE_SIZE_MB` |
| `npm install` fails behind a proxy | Configure `npm config set proxy` / registry |

## Team contribution suggestions (from the project review roles)
* **G. Eesha Yuktha - Team Lead / Backend & Database:** MongoDB schemas & indexes, auth service, file/encryption service, gateway, architecture & security docs.
* **V. Sree Pragnya - Feature Development & QA:** permission + audit services, admin features, smoke/unit tests, Postman collection, bug triage.
* **P. Sreshta - Frontend / UI-UX:** React screens, components, styling, upload/share flows, responsive layout, demo script.
