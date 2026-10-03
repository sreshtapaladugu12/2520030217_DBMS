# MongoDB schema (Mongoose) - database `encrypted_file_transfer`

## users  (auth-service)
| Field | Type | Notes |
|---|---|---|
| _id | ObjectId | |
| name | String | 2–80 chars |
| email | String | unique, lowercase |
| passwordHash | String | bcrypt hash, `select:false`, never returned |
| role | `user`\|`admin` | default `user`; cannot be set at registration |
| active | Boolean | admin can disable |
| lastLoginAt, createdAt, updatedAt | Date | |

Indexes: `email` (unique).

## files  (file-service)
| Field | Type | Notes |
|---|---|---|
| originalName | String | sanitised display name |
| storedName | String (unique) | random `32hex.enc`; the only name used on disk |
| ownerId | ObjectId → users | |
| ownerName, ownerEmail | String | denormalised for display |
| mimeType, size, encryptedSize | | size = plaintext bytes |
| sha256 | String | hash of plaintext, verified after decrypt |
| storagePath | String | relative to the private storage dir |
| encryption | { algorithm, keyVersion, iv, authTag, wrappedKey, wrapIv, wrapTag } | base64. Useless without the master key |

Indexes: `ownerId`, `{ownerId, createdAt:-1}`, `storedName` (unique).

## permissions  (permission-service)
| Field | Type | Notes |
|---|---|---|
| fileId | ObjectId → files | |
| ownerId | ObjectId → users | who granted |
| userId | ObjectId → users | recipient |
| userEmail, userName, fileName | String | denormalised so the service works without calling others |
| level | `view`\|`download` | |
| status | `active`\|`revoked` | revoke keeps the document; re-sharing reactivates it |
| revokedAt, createdAt, updatedAt | Date | |

Indexes: `{fileId, userId}` (unique), `fileId`, `{userId, status}`, `ownerId`.

## transfer_logs  (audit-service)
| Field | Type | Notes |
|---|---|---|
| userId → users, userName, userEmail | | actor (denormalised) |
| fileId → files, fileName, ownerId → users | | subject file and its owner |
| action | enum | see API doc |
| targetUserId → users, targetEmail | | for SHARE / REVOKE / ADMIN_ACTION |
| status | `success`\|`denied`\|`failed` | |
| metadata | Mixed | e.g. `{size}`, `{level}` |
| timestamp | Date | |

Indexes: `userId`, `fileId`, `ownerId`, `{timestamp:-1}`, `{action:1,timestamp:-1}`.

## Relationships
`users 1─* files` (ownerId) · `files 1─* permissions` · `users 1─* permissions` (recipient) · `files/users 1─* transfer_logs`.
References are ObjectIds. Some display fields are copied (denormalised) on purpose so a service can answer without calling another; the trade-off is that a renamed user would not update old rows (there is no rename feature).

## Seeing it in MongoDB Compass
Connect to `mongodb://127.0.0.1:27017` → database `encrypted_file_transfer`.
register → **users** · upload → **files** (see `encryption.*`, no file bytes) · share → **permissions** (`status:"active"`) · download → **transfer_logs** (`DOWNLOAD`) · revoke → **permissions** (`status:"revoked"`) + `REVOKE` log.
