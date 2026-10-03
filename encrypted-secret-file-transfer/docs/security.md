# Security design

| Topic | Implementation |
|---|---|
| **Passwords** | Hashed with **bcrypt** (cost 10, via the `bcryptjs` pure-JS implementation of the same algorithm - no native build needed on Windows). One-way: passwords cannot be recovered. Login uses a constant "dummy" comparison when the email is unknown and returns the same message for wrong email/password. |
| **JWT** | HS256, signed with `JWT_SECRET`, issuer-checked, expires (`JWT_EXPIRES_IN`, default 8h). Missing/invalid/expired → 401. Verified by the gateway **and** by each service. Stored in `localStorage` by the SPA (simple; vulnerable if XSS existed - mitigated by React escaping and a strict CSP on the served app). A demoted/disabled user keeps a valid token until expiry, except `/auth/me` and login re-check the DB. |
| **File encryption** | Node `crypto`, **AES-256-GCM** (authenticated encryption). *Envelope scheme:* a random 256-bit key per file encrypts the file; that key is encrypted with the master key `FILE_ENCRYPTION_KEY`. IVs are random 96-bit; the 128-bit auth tag detects tampering. Ciphertext → disk; wrapped key/IV/tags → MongoDB. Passwords = one-way hashing; files = reversible encryption because authorised users must get the original back. |
| **Key handling** | Master key only in the environment (`.env`, not committed). Can be 64 hex chars or a passphrase (scrypt-derived). Never sent to the browser, never logged, never in the DB. Losing/changing it makes existing files undecryptable - back it up. Per-file key material is zeroed after use. |
| **Authorization** | Enforced only on the server. Download = owner **or** active `download` permission; checked *before* any file is read/decrypted. Only owners can share/revoke/delete. Admins can manage users and view logs but **cannot** read others' files. Non-owner access is denied even for admins. |
| **Input validation** | Email/password/ObjectId checks; JSON body ≤ 100 KB; extension allow-list; upload size limit (`MAX_FILE_SIZE_MB`, 413); one file per request; unexpected fields limited. |
| **File security** | Random server-side storage names (`<32 hex>.enc`), strict name regex + resolved-path prefix check (no path traversal), private dir mode 700 / files 600, never served statically, atomic write (temp + rename), memory upload so no plaintext temp file, `Content-Disposition: attachment`, `nosniff`, `no-store`. Filenames sanitised. Integrity re-verified via SHA-256 after decryption. |
| **Errors** | Central handler returns generic messages; stack traces, paths and keys never reach clients. |
| **Audit logging** | Register, login/failed login, upload, download, download denied, share, revoke, delete, admin actions → `transfer_logs`. Audit is fail-open (see architecture) - a documented trade-off. |
| **Other** | Login/register rate limit (per IP, in memory); internal APIs guarded by `INTERNAL_API_KEY` with timing-safe compare; services bind to `127.0.0.1` outside Docker; security headers on the gateway. |

## Known limitations (be upfront in the viva)
* Encryption is **server-side**: the server sees plaintext briefly while encrypting/decrypting, so a fully compromised server (with the master key) can read files. True end-to-end encryption would encrypt in the browser (Web Crypto) - listed as future work.
* TLS is not configured; run behind HTTPS in real use (transport security).
* Single master key, no rotation UI (`keyVersion` field is reserved for that).
* Files are buffered in memory (fine for ≤ 10 MB; use streaming for large files).
* No MFA, virus scanning, or file expiry (future scope from the project report).
