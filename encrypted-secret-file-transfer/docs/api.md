# REST API (all paths via the gateway, `http://localhost:4000`)

Protected endpoints need `Authorization: Bearer <JWT>`. Errors are JSON: `{ "error": "message" }`.
Common statuses: `400` invalid input · `401` auth required/invalid/expired · `403` forbidden · `404` not found · `409` conflict · `413` file too large · `415` file type not allowed · `429` too many login attempts · `502` a backend service is unavailable · `500` internal error.

## Auth
| Method & path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/register` | – | `{name,email,password}` (password ≥ 8, letters+digits) | `201 {token,user}` | 400, 409 (email exists), 429 |
| `POST /api/auth/login` | – | `{email,password}` | `200 {token,user}` | 400, 401, 403 (disabled), 429 |
| `GET /api/auth/me` | JWT | – | `200 {user}` | 401 |

## Files
| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/files/upload` | JWT | `multipart/form-data`, field **`file`**. `201 {file}`. 400 no/empty file, 413 too large (default 10 MB), 415 type not allowed |
| `GET /api/files?scope=owned\|shared\|all` | JWT | `200 {files:[…], warnings:[…]}`. Each file has `access` = `owner`/`download`/`view`; owners also get `sharedWith` |
| `GET /api/files/:id` | JWT | Metadata. 403 if no access, 404 unknown id, 400 bad id |
| `GET /api/files/:id/download` | JWT | Owner or `download` permission only. Returns decrypted bytes as attachment. 403 (logged `DOWNLOAD_DENIED`), 404, 500 if decryption/integrity fails, 502 if permission service down |
| `DELETE /api/files/:id` | JWT | Owner only. Removes ciphertext, metadata, revokes shares |

File JSON never contains storage names, paths or key material.

## Permissions
| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/permissions` | JWT (owner) | `{fileId,email,level?}` level `download` (default) or `view`. `201 {permission}`. 403 not owner, 404 file/user unknown, 409 already shared, 400 sharing with yourself |
| `GET /api/permissions/:fileId` | JWT (owner) | Active permissions for the file |
| `DELETE /api/permissions/:id` | JWT (owner) | Revokes (`status:"revoked"`). 404 unknown/already revoked, 403 not owner |

## Logs
| `GET /api/logs?action=&fileId=&limit=&skip=` | JWT | Events you performed, that happened on files you own, or that target you. `{logs,total,limit,skip}` |
|---|---|---|

## Admin (role `admin` only → otherwise 403)
| Endpoint | Description |
|---|---|
| `GET /api/admin/users` | All users (no password hashes) |
| `PATCH /api/admin/users/:id` | `{active?:bool, role?:"user"\|"admin"}`; cannot edit yourself; logged as `ADMIN_ACTION` |
| `GET /api/admin/logs` | All events |
| `GET /api/admin/stats` | Users, files, uploads, downloads, shared files, recent activity, service status |

Admins have **no** special access to file contents: downloads still require ownership or a grant.

## Gateway
| `GET /api/health` (public) | `{status:"ok"}` |
|---|---|
| `GET /api/service-status` (public) | `{gateway,authentication,file,permission,audit:"ok"\|"down", database, details:{svc:{latencyMs}}}` |
| `GET /api/overview` (JWT) | Aggregated dashboard: stats, recent uploads/downloads/sharing/activity, security indicators, services, warnings |

Audit `action` values: `REGISTER LOGIN LOGIN_FAILED UPLOAD DOWNLOAD DOWNLOAD_DENIED SHARE REVOKE DELETE ADMIN_ACTION`.
