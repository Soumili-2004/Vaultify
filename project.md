# Vaultify — Complete Project Overview

## Core Concept

Replace real API keys (`sk-ant-xxx`) with **scoped, revocable proxy tokens** (`vlt_prod_abc123`) stored on deployment platforms. Real keys live only in memory inside the vault server, never on disk, never in git, never on Vercel.

```
Real API Key (stored encrypted in MongoDB)
  → Proxy Token (vlt_prod_xxx, stored in Vercel env vars)
    → Proxy Service (validates token, decrypts key in memory, forwards request)
      → Provider API (Anthropic, OpenAI, GitHub, etc.)
```

---

## Architecture — 3 Microservices + Web UI + CLI

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Web UI     │     │     CLI      │     │   SDK        │
│  (React 18)  │     │ (Commander)  │     │ (vaultify)   │
│  :5173       │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                    │
       │  JWT + Bearer       │  JWT + Bearer      │  vlt_ token
       ▼                     ▼                    ▼
┌──────────────────────────────────────────────────────┐
│              Admin Server (apps/server)               │
│  :3002  ─  Key CRUD, Token CRUD, User/Workspace,      │
│           Audit proxy, Anomaly engine, Webhooks        │
│           JWT auth, MFA (TOTP), Role-based access      │
└──────┬─────────────────────────────────┬──────────────┘
       │  internal API key / mTLS        │  x-workspace-id
       ▼                                  ▼
┌──────────────┐                ┌──────────────┐
│ Proxy Service│                │ Audit Service│
│ (apps/proxy) │                │ (apps/audit) │
│ :3001        │                │ :3003        │
│              │                │              │
│ Token valid. │                │ Append-only  │
│ Key decrypt  │                │ Hash-chain   │
│ Forward req  │                │ integrity    │
│ Circuit brkr │                │ Pagination   │
└──────┬───────┘                └──────────────┘
       │
       ▼
  Provider API
  (Anthropic, OpenAI, Stripe, GitHub, etc.)
```

---

## Apps — Detailed Breakdown

### 1. Admin Server (`apps/server`) — `:3002`

**Stack:** Express, Mongoose, bcryptjs, jsonwebtoken, speakeasy (TOTP), qrcode

**All API Endpoints:**

| Module | Method | Path | Auth | Description |
|--------|--------|------|------|-------------|
| **Auth** | POST | `/api/auth/register` | No | Register + create workspace → JWT pair (access 1h + refresh 7d) with IP/UA binding |
| | POST | `/api/auth/login` | No | Login → JWT pair |
| | POST | `/api/auth/refresh` | No | Exchange refresh token for new JWT pair |
| | POST | `/api/auth/logout` | Yes | Invalidate refresh token in DB |
| | GET | `/api/auth/me` | Yes | Current user profile |
| | GET | `/api/auth/oauth/github` | No | GitHub OAuth redirect |
| | GET | `/api/auth/oauth/github/callback` | No | GitHub OAuth callback |
| **MFA** | POST | `/api/auth/mfa/setup` | Yes | Generate TOTP secret + QR code |
| | POST | `/api/auth/mfa/verify` | Yes | Verify TOTP and enable MFA |
| | POST | `/api/auth/mfa/disable` | Yes | Disable MFA |
| **Vault** | POST | `/api/vault/keys` | Yes | Encrypt & store a real API key (AES-256-GCM) |
| | GET | `/api/vault/keys` | Yes | List vault keys (metadata only) |
| | GET | `/api/vault/keys/:id/tokens-count` | Yes | Count active tokens for a key |
| | PUT | `/api/vault/keys/:id/rotate` | Yes | Rotate key value (existing tokens keep working) |
| | DELETE | `/api/vault/keys/:id` | Yes | Delete key + cascade-delete all its tokens |
| **Tokens** | POST | `/api/tokens` | Yes + scope | Issue proxy token (`vlt_prod_xxx`) |
| | GET | `/api/tokens` | Yes + scope | List tokens |
| | GET | `/api/tokens/:id` | Yes + scope | Single token detail |
| | DELETE | `/api/tokens/:id` | Yes + scope | Revoke token |
| **Audit** | GET | `/api/audit` | Yes + scope | Query logs (paginated, filterable) |
| | GET | `/api/audit/stats` | Yes + scope | Stats (total, today, blocked, avg latency) |
| | GET | `/api/audit/verify` | Yes + scope | Hash chain integrity check |
| | GET | `/api/audit/export` | Yes + scope | Export JSON/CSV |
| **Workspace** | GET | `/api/workspace` | Yes + scope | Workspace details |
| | POST | `/api/workspace/invite` | Yes + role | Invite member by email |
| | PATCH | `/api/workspace/members/:id` | Yes + role | Update member role |
| | DELETE | `/api/workspace/members/:id` | Yes + role | Remove member |
| **Access** | POST | `/api/requests` | Yes | Submit access request for a vault key |
| | GET | `/api/requests` | Yes | List requests (filter by status) |
| | PATCH | `/api/requests/:id/approve` | Yes + role | Approve → auto-issue token |
| | PATCH | `/api/requests/:id/deny` | Yes + role | Deny |
| **Webhooks** | POST | `/api/webhooks/github-pr-merged` | No | Auto-revoke preview tokens >24h old |
| | POST | `/api/webhooks/vercel-deployment` | No | Log Vercel deployment events |
| **Proxy** | ALL | `/proxy/:provider/*` | No | Forward request via token validation + key decrypt (only mounted when `PROXY_SERVICE_ENABLED=false`) |
| **Internal** | POST | `/internal/vault/decrypt/:keyId` | Int key | Decrypt vault key (used by proxy-service) |
| **Health** | GET | `/health` | No | `{ status, service, timestamp, uptime }` |

**Middleware stack (per-request):**
1. `globalLimiter` — 100 req/min per IP (sliding window)
2. `authLimiter` — 10 req/min per IP on auth endpoints (slow-burn)
3. `authMiddleware` — JWT from `Authorization: Bearer <token>`, verifies + checks IP/UA binding
4. `requireScope('scope')` — Checks token/user has required OAuth-style scope
5. `requireRole('owner')` — Checks user role for workspace admin actions
6. `proxyMultiLimiter` — 3-layer: 200 IP/min + 300 user/min + 1000 workspace/min
7. `wrapAnomalyCheck` — Post-response feature recording + MAD scoring
8. `lockoutCheck` — Checks if token is in strike-based lockout
9. `preFlightCheck` — Zero-trust gate (scores BEFORE key decryption)
10. `inspectBody` — 11 regex patterns for prompt injection detection
11. `sanitizeHeaders` — Strips sensitive response headers (cookies, cloud headers)
12. `errorHandler` — Global: 400 (validation), 409 (duplicate), exposes stack in dev

**Services (apps/server/src/services/):**
- **encryption.service.js** — Encrypt/decrypt/re-encrypt using AES-256-GCM with DEK and KMS provider
- **cache.service.js** — `SecureKeyHolder` — in-memory key cache with automatic zeroing on TTL expiry, sweep interval, and process exit cleanup
- **token.service.js** — Token generation utility (re-export from `@vaultify/utils`)
- **anomaly.service.js** — Async anomaly checks: consecutive errors, rate limit spike, usage spike, off-hours, new IP
- **anomalyDetector.service.js** — `AnomalyDetector` class: sliding window MAD scoring + strike-based lockout
- **notification.service.js** — Email via Resend API, Slack webhook notifications, access request notifications

---

### 2. Proxy Service (`apps/proxy-service`) — `:3001`

**Stack:** Express, Axios, MongoDB (direct read for token validation)

**Purpose:** Standalone, horizontally-scalable proxy that forwards API calls to providers.

**Endpoints:**
- `GET /health` — Health check
- `ALL /proxy/:provider/*` — Proxy requests (200 IP/min + 100 token/min rate limits)

**Full request flow:**
1. Extract `vlt_` token from `Authorization` or `x-api-key` header
2. **6-step token validation** (reads `ProxyToken` from MongoDB directly):
   1. Syntactic format check: `vlt_{env}_{base58}`
   2. Exists in DB and not revoked
   3. Not expired
   4. Endpoint allowed (wildcard `*` or exact match) + scope check
   5. Source IP allowed (CIDR check)
   6. Daily rate limit not exceeded (24h rolling window via `AuditLog` count)
3. Pre-flight zero-trust gate (anomaly scoring before key decryption)
4. Decrypt key via `POST admin-service:3002/internal/vault/decrypt/:keyId` (mTLS + internal API key)
5. Build target URL from provider registry (Anthropic, OpenAI, Stripe, GitHub, Groq, etc.)
6. Replace auth header with real key, zero key buffers after use
7. Forward request to provider (`arraybuffer` response type)
8. Sanitize response headers
9. Log audit entry (to audit-service via circuit breaker, or fallback to MongoDB)
10. Fire-and-forget anomaly feature recording

**Circuit breaker** (auditClient.js): 3 consecutive failures → 30s cooldown → fallback to direct MongoDB write (skip hash chain).

---

### 3. Audit Service (`apps/audit-service`) — `:3003`

**Stack:** Express, Mongoose

**Purpose:** Append-only audit log with cryptographic hash-chain integrity.

**Endpoints:**
- `POST /internal/audit/log` — Ingest new entry
- `GET /api/audit` — Query logs (paginated, filter by environment/tokenId)
- `GET /api/audit/stats` — Stats (total calls, today, blocked today, avg latency)
- `GET /api/audit/verify` — Verify full workspace hash chain
- `GET /api/audit/verify/:id` — Verify single entry
- `GET /api/audit/export` — Export JSON/CSV with date range filtering

**Hash chain:** Each entry stores:
- `entryHash = SHA256(tokenString|workspaceId|endpoint|statusCode|timestamp)`
- `prevEntryHash` — hash of the previous log entry (null for first entry)

Verification walks the entire chain, recomputes every hash, and reports `intact` or `corrupted`.

---

### 4. Web UI (`apps/web`) — `:5173`

**Stack:** React 18, Vite, React Router v6, Zustand, Axios, Tailwind CSS v4, Lucide React icons

**Pages:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | Login | Login/register toggle, calls auth API |
| `/dashboard` | Dashboard | Stats cards (active tokens, total calls, today, blocked) + recent activity table + quick actions |
| `/tokens` | Tokens | Card/table views, issue token modal (key selector + rate limits + scopes), revoke with confirmation |
| `/my-keys` | MyKeys | Grid of vault key cards, store key modal (name, provider, environment), delete with cascade warning |
| `/audit` | AuditLogs | Paginated table with environment filter, color-coded status, latency |

**State (Zustand stores):**
- **Auth:** user, accessToken, refreshToken, isAuthenticated
- **Tokens:** tokens[]
- **VaultKeys:** vaultKeys[]
- **Audit:** auditLogs[], auditStats

**API client** (`services/api.js`): Axios with `Authorization: Bearer <token>` interceptor; on 401 clears tokens and redirects to `/login`.

**Components:**
- **Layout:** Sidebar (nav + user info + logout), Header (server status indicator), ProtectedRoute
- **UI:** Button (4 variants + sizes + loading spinner), Modal (overlay + backdrop + close), StatsCard (decorative orb), TokenCard (provider accent, masked token, copy, revoke), Badge (5 variants)
- **Forms:** StoreKeyForm (provider groups: AI/ML, VCS, Cloud, Databases, Platform), IssueTokenForm
- **Tables:** AuditTable (responsive scrollable), TokenTable (table view with copy + revoke)

---

### 5. CLI (`apps/cli`) — `@vaultify/cli`

**Stack:** Commander.js, Chalk, Ora, Inquirer, Axios. Published to npm.

| Command | Description |
|---------|-------------|
| `vaultify login` | Interactive login, stores token in OS keychain (macOS Keychain / Windows DPAPI / Linux secret-tool) with fallback to `~/.vaultify/config.json` (chmod 600) |
| `vaultify tokens list` | Table of tokens (ID, Provider, Environment, Rate Limit, Status, Expires) |
| `vaultify tokens create` | Interactive: select vault key, environment, allowed endpoints, rate limit. Optionally appends to `.env.vaultify` |
| `vaultify tokens revoke <id>` | Confirmation prompt → revoke |
| `vaultify sync` | Read `.env.vaultify`, validate tokens against vault, push to Vercel env vars |
| `vaultify status` | Vault health + counts of active tokens and vault keys |
| `vaultify env list` | List Vercel env vars, identify vaultify tokens vs plain secrets |
| `vaultify audit` | Display last N audit log entries (default 20) |

**Services:**
- **api.js** — Axios client with `requireAuth()`, loads server URL from config, injects Bearer token from keychain
- **keychain.js** — Cross-platform secret storage
- **vercel.js** — Vercel API client for env var CRUD
- **envParser.js** — Parses `.env.vaultify` files (finds `vlt_` prefixed lines)

---

## Packages — Shared Libraries

### `@vaultify/utils` (packages/utils)

Core utilities used by all services:

| Export | Description |
|--------|-------------|
| `asyncHandler` | Wraps async Express route handlers to forward rejected promises to `next()` |
| `generateProxyToken(env)` | Generates `vlt_{env}_{32b base58}`. Valid env: `prod`, `prev`, `dev` |
| `generateProxyTokenForProvider(provider, env)` | Provider-prefixed variant: `sk-vlt-{env}_{base58}` |
| `validateTokenFormat(token)` | Returns `true`/`false` for canonical `vlt_` or `sk-vlt-` formats |
| `extractCanonicalToken(token)` | Normalizes any valid format to `vlt_{env}_{base58}` |
| `ipInRange(ip, cidr)` | Checks IPv4 against CIDR range |
| `ipAllowed(ip, cidrList)` | Checks IP against allowlist (empty list = allow all) |
| `rollingWindowCount(tokenId)` | Counts requests in 24h rolling window from `AuditLog` |
| `SCOPES` | 9 scope constants: `proxy:read/write/admin`, `tokens:read/write`, `audit:read`, `workspace:read/write` |
| `checkScope(tokenScopes, required)` | Scope check with hierarchy (admin includes read+write, `*` matches all) |
| `methodToScope(method)` | GET→read, POST/PUT/PATCH/DELETE→write, other→admin |
| `endpointToScope(endpoint)` | 14 resource-specific overrides (billing→admin, models→read, chat→write) |
| `createConfig(schema)` | Type-safe env var parser with validation |
| `VALIDATORS` | Collection: `string`, `number`, `port`, `hex`, `url`, `mongoUri`, `boolean`, `oneOf`, `minLength`, `file` |
| `registry` | Provider registry — 20 providers with base URLs, auth configs, key prefixes |
| `getProvider(name)` | Get provider config by name |
| `getBaseUrl(name)` | Get provider base URL |
| `getAuthConfig(name)` | Get `{ header, prefix }` for a provider |
| `detectProvider(key)` | Detect provider by matching key prefix |
| `createInternalClient(opts)` | Axios instance for service-to-service comms (optional mTLS) |

**Provider Registry — 20 supported:** Anthropic, OpenAI, Stripe, GitHub, Groq, Replicate, HuggingFace, GitLab, AWS, GCP, SendGrid, Twilio, Resend, Supabase, PlanetScale, Vercel, Shopify, Contentful, Algolia, Mapbox.

**Token format constants:**
- `VAULTIFY_ENV_SEGMENTS`: `['prod', 'prev', 'dev']`
- `BASE58_ALPHABET`: Bitcoin base58 alphabet (no 0/O/I/l)
- `CANONICAL_RE`: `/^vlt_(prod|prev|dev)_[1-9A-HJ-NP-Za-km-z]{20,}$/`

---

### `@vaultify/auth` (packages/auth)

JWT and Express middleware:

| Export | Description |
|--------|-------------|
| `signToken(payload, secret, opts)` | Signs JWT with `jti` (UUID), optional `ip_hash`/`ua_hash` binding. Default expiry: 1h |
| `verifyToken(token, secret)` | Returns `{ valid, decoded, error }` — never throws |
| `checkTokenBinding(decoded, req)` | Validates IP hash + User-Agent hash in JWT against current request |
| `requireAuth(jwtSecret)` | Express middleware: extracts Bearer token, verifies, checks binding, sets `req.user` |
| `requireRole(...roles)` | Express middleware: checks `req.user.role`. Returns 401/403 on failure |
| `jtiStore` | Singleton JTI store for replay prevention. Sweeps expired entries every 60s |

---

### `@vaultify/crypto` (packages/crypto)

AES-256-GCM encryption suite:

| Export | Description |
|--------|-------------|
| `encrypt(plaintext, key)` | AES-256-GCM encrypt → `{ iv, authTag, ciphertext }` (all hex). Random 16-byte IV |
| `decrypt({ iv, authTag, ciphertext }, key)` | Decrypt → plaintext string |
| `generateDek()` | Random 32-byte data encryption key (hex) |
| `deriveNonce(dek, counter)` | HMAC-SHA256-derived 12-byte nonce for deterministic encryption |
| `wrapDek(dek, masterKey)` | Encrypt DEK with master key → `{ iv, authTag, ciphertext }` |
| `unwrapDek(wrapped, masterKey)` | Decrypt wrapped DEK |
| `encryptWithDek(plaintext, dek, counter)` | Deterministic encryption using DEK + counter-based nonce |
| `decryptWithDek({ iv, authTag, ciphertext }, dek)` | Decrypt using DEK |
| `KmsProvider` | Abstract base class for KMS key management |
| `LocalKmsProvider` | Local KMS — wraps/unwraps DEKs via AES-256-GCM directly |
| `AwsKmsProvider` | AWS KMS — uses AWS SDK to encrypt/decrypt DEKs |
| `GcpKmsProvider` | GCP Cloud KMS — stub implementation |
| `createKmsProvider(type)` | Factory: `'local'`, `'aws'`, `'gcp'` |

**Constants:** `ALGORITHM=aes-256-gcm`, `IV_LENGTH=16`, `AUTH_TAG_LENGTH=16`, `NONCE_LENGTH=12`, `DEK_LENGTH=32`

---

### `@vaultify/db` (packages/db)

MongoDB connection + 6 Mongoose schemas:

| Export | Description |
|--------|-------------|
| `connectDB(uri, retries=5)` | Connect to MongoDB with exponential backoff (1s-2s-4s-8s-16s), database: `vaultify` |
| `User` | email, password (hashed), name, workspaceId, role (owner/member/viewer), refreshToken, MFA fields |
| `Workspace` | name, ownerId, embedded `members[]` (userId, email, name, role, joinedAt) |
| `VaultKey` | workspaceId, name, provider, environment, encryptedKey (wrapped DEK + ciphertext), keyPrefix, compound index `{workspaceId, provider, environment}` |
| `ProxyToken` | tokenString (unique), vaultKeyId, workspaceId, scopes[], allowedEndpoints[], rateLimitDaily, allowedIps[], environment, expiresAt, issuedTo, revokedAt |
| `AuditLog` | Full request/response metadata + hash chain fields, 90-day TTL index, compound index `{workspaceId, timestamp}` |
| `AccessRequest` | workspaceId, requester, vaultKeyId, provider, environment, status (pending/approved/denied), reason, issuedTokenId |
| `workspaceScopedPlugin` | Mongoose plugin enforcing workspace-scoped queries on VaultKey, ProxyToken, AuditLog, AccessRequest (throws if query lacks workspaceId) |

---

### `@vaultify/ratelimit` (packages/ratelimit)

In-memory sliding window rate limiter:

| Export | Description |
|--------|-------------|
| `createRateLimiter(opts)` | Express middleware factory. `opts`: `windowMs`, `max`, `keyType` (ip/user/workspace), `keyFn`, `enableSlowBurn`. Sets `RateLimit-*` headers |
| `store` | Global `SlidingWindowStore` singleton |
| `slowburn` | Global `SlowBurnDetector` singleton (2-min sweep) |
| `SlidingWindowStore` | 1-second bucket resolution, 60s sweep. Methods: `increment()` → `{ current, limit, remaining, exceeded }` |
| `SlowBurnDetector` | Detects gradual traffic increases. Compares recent traffic (last 2 windows) against baseline (earlier windows) using 2.5x threshold. Minimum 3 baseline samples |

**Constants:** `BUCKET_RESOLUTION_MS=1000`, `HISTORY_WINDOWS=10`, `BASELINE_WINDOW_MS=60000`, `THRESHOLD_MULTIPLIER=2.5`, `MIN_SAMPLES=3`

---

### `@vaultify/anomaly` (packages/anomaly)

MAD-based anomaly detection:

| Export | Description |
|--------|-------------|
| `AnomalyDetector` | Sliding window (100 records), MAD scoring (threshold 3.5), graduated lockout: 5 strikes → 1min → 5min → 15min → 60min |
| `MemoryStore` | In-memory key-value store for anomaly state |
| `RedisStore` | Redis-backed store with in-memory write-through cache (2h TTL on Redis keys) |
| `createMiddleware()` | Factory → `{ wrapAnomalyCheck, lockoutCheck, preFlightCheck, detector }` |

**AnomalyDetector methods:** `record()`, `score()`, `checkLockout()`, `recordAnomaly()`, `clearToken()`, `sweep()`, `destroy()`

**Middleware:**
- `wrapAnomalyCheck` — Post-response async feature recording + scoring via `setImmediate`
- `lockoutCheck` — Synchronous lockout check
- `preFlightCheck` — Synchronous zero-trust gate: checks hard lockout + anomaly score against PREFLIGHT_SCORE_THRESHOLD (4.5)

**Constants:** `WINDOW_SIZE=100`, `MAD_THRESHOLD=3.5`, `PREFLIGHT_SCORE_THRESHOLD=4.5`, `LOCKOUT_THRESHOLD=5`, `LOCKOUT_WINDOW_MS=300000`, `LOCKOUT_DURATION_MS=[60000, 300000, 900000, 3600000]`

---

### `@vaultify/logger` (packages/logger)

| Export | Description |
|--------|-------------|
| `logRequest(data)` | Fetch previous hash, compute SHA-256 hash chain entry, store AuditLog |
| `getRecentLogs(AuditLog, workspaceId, opts)` | Paginated audit log query → `{ logs, total, page, totalPages }` |
| `computeEntryHash(fields)` | SHA-256 hash over concatenated fields |

---

### `vaultify` (packages/vaultify) — Public SDK

Published to npm as `vaultify`. Standalone package (no internal deps), uses native `fetch`.

| Export | Description |
|--------|-------------|
| `createClient(proxyToken, opts)` | Creates `VaultifyClient`. `opts`: `baseUrl`, `provider`, `timeout` (default 30s) |
| `VaultifyClient` | Class. Methods: `request(method, path, body, opts)`, `messages.create(payload)` |
| `VaultifyError` | Custom error with `status`, `code`, `body` |
| `redactToken(token)` | Shows `first 8 chars + **** + last 4 chars` |

**Features:**
- Retries: 3 retries for 429/502/503/504 and network errors, exponential backoff + jitter (base 1s*2^attempt, cap 10s)
- Streaming: `messages.create({ stream: true })` returns async iterable via SSE parser
- SSE parser: Handles multi-line data, `[DONE]` sentinel, partial chunk buffering
- AbortController-based timeout

---

## Security Model — 6 Layers of Defense

1. **Vault server never runs on Vercel** — secret isolation
2. **Keys never touch disk in plaintext** — AES-256-GCM envelope encryption + KMS
3. **Encryption key != database access** — separate env vars
4. **Real key only in memory, never logged** — zeroed buffers after use
5. **Rate limiting + IP allowlisting** on admin panel
6. **Separate proxy from admin** — 3-service architecture

### Additional Security Features
- **JWT binding (DPoP-like):** Tokens bound to `sha256(ip)` + `sha256(user-agent)`
- **jtiStore:** Replay prevention for refresh tokens
- **Pre-flight zero-trust gate:** Anomaly scoring happens BEFORE key decryption
- **Key buffer sanitization:** `Buffer.fill(0)` + random overwrite + process exit cleanup via `SecureKeyHolder`
- **SecureKeyHolder:** Auto-zero cached keys on TTL expiry, sweep interval
- **Response header sanitization:** Strips cookies, cloud provider headers (`x-amz-`, `x-azure-`), security headers
- **Prompt injection detection:** 11 regex patterns scanned on proxy request bodies (`bodyInspector.js`)
- **Hash-chain audit trail:** Tamper-evident via `prevEntryHash` linking
- **mTLS:** Optional for service-to-service communication
- **Circuit breaker:** Proxy-service falls back to MongoDB if audit-service unreachable

---

## Data Flows

### Token Issuance
```
User (Web UI / CLI)
  → POST /api/tokens (JWT authenticated)
  → Validate vault key exists, user has scope tokens:write
  → generateProxyToken('prod') → vlt_prod_8x2kqr9m...
  → Store ProxyToken in MongoDB (with scopes, endpoints, rate limits, IP allowlist)
  → Return token to user (only time the full token is revealed)
```

### Proxy Request
```
Client sends Authorization: Bearer vlt_prod_8x2kqr9m...
  → Proxy Service :3001/proxy/anthropic/v1/messages
  → 6-step token validation
    1. Format check (regex: vlt_{env}_{base58})
    2. Exists in DB and not revoked
    3. Not expired
    4. Endpoint allowed (wildcard/exact match) + scope check
    5. Source IP allowed (CIDR)
    6. Daily rate limit (24h rolling count < limit)
  → Pre-flight anomaly check (score < 4.5, not locked out)
  → POST /internal/vault/decrypt/:keyId to Admin Server
  → AES-256-GCM unwrap DEK → decrypt real API key
  → Build target URL (e.g., https://api.anthropic.com/v1/messages)
  → Replace auth header (e.g., x-api-key: sk-ant-real-xxx)
  → Forward request, stream response back
  → Zero key buffer (fill(0) + random overwrite)
  → Async: record audit log + anomaly features
```

### Key Encryption (when storing)
```
User submits raw API key
  → generateDek() → 32-byte random DEK
  → wrapDek(DEK, masterKey) → wrapped DEK (AES-256-GCM)
  → encryptWithDek(realKey, DEK, counter=0) → ciphertext
  → Store { wrappedDek, nonceCounter, iv, authTag, ciphertext } in VaultKey document
  → Raw key never persisted, DEK wrapped before DB storage
```

---

## Infrastructure & DevOps

### Local Development
```bash
# Start MongoDB
docker compose -f infra/docker/docker-compose.yml up -d

# Start all services
npm run dev:all

# Start individual services
npm run dev:admin   # Admin server :3002
npm run dev:proxy   # Proxy service :3001
npm run dev:audit   # Audit service :3003
npm run dev:web     # Web UI :5173

# Seed demo data
npm run seed
```

### Environment Variables
See `.env.example` for full schema. Key vars:
| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `ENCRYPTION_KEY` | 64-char hex for AES-256-GCM master key |
| `ADMIN_PORT` / `PROXY_PORT` / `AUDIT_PORT` | Service ports |
| `ADMIN_SERVICE_URL` / `AUDIT_SERVICE_URL` | Internal service URLs |
| `INTERNAL_API_KEY` | Service-to-service auth (64-char) |
| `KMS_PROVIDER` | `local` / `aws` / `gcp` |
| `PROXY_SERVICE_ENABLED` | `true` (default) for standalone proxy |

### CI/CD (.github/workflows/)
- **test.yml** — Runs on push/PR to `main`. Matrix Node 18/20/22, `npm ci`, SDK tests, package dry-run
- **publish.yml** — Manual or GitHub Release trigger. Publishes `vaultify` (SDK) and/or `@vaultify/cli` to npm
- **preview-cleanup.yml** — PR closed → webhook to auto-revoke preview tokens >24h old

### Scripts
- **`npm run setup`** — Creates `.env` with auto-generated secure secrets, validates config, tests MongoDB
- **`npm run seed`** — Demo user (`demo@vaultify.dev` / `Demo@1234`), workspace, encrypted key, token, 10 audit entries
- **`node scripts/release.js [patch|minor|major]`** — Version bump + test + publish instructions

---

## Token Format

```
vlt_{env}_{32 base58 chars}

vlt         → prefix (Vaultify Token)
{env}       → prod | prev | dev
{base58}    → 32 random bytes in Bitcoin base58 (no 0/O/I/l)

Examples:
  vlt_prod_8x2kqr9mW7...
  vlt_dev_3f8a...
  sk-vlt-prod_8x2kqr9mW7...  (provider-prefixed, for SDK compatibility)
```

---

## Scope System

9 OAuth-style scopes with hierarchy:

| Scope | Description | Included Scopes |
|-------|-------------|-----------------|
| `proxy:read` | Read-only proxy access | — |
| `proxy:write` | Write proxy access | — |
| `proxy:admin` | Full proxy access | `proxy:read` + `proxy:write` |
| `tokens:read` | View tokens | — |
| `tokens:write` | Create/revoke tokens | — |
| `audit:read` | View audit logs | — |
| `workspace:read` | View workspace | — |
| `workspace:write` | Manage workspace | — |
| `*` | Super admin | ALL |

`endpointToScope()` maps 14 endpoint patterns (e.g., billing→`proxy:admin`, chat→`proxy:write`, models→`proxy:read`).

---

## Project Structure

```
vaultify/
├── apps/
│   ├── server/           # Admin service (Express, JWT, key management)
│   ├── proxy-service/    # Standalone proxy (token validation, forwarding)
│   ├── audit-service/    # Append-only audit log service
│   ├── web/              # React 18 + Vite dashboard
│   └── cli/              # Commander.js CLI (@vaultify/cli)
├── packages/
│   ├── vaultify/         # Public SDK (npm: vaultify)
│   ├── crypto/           # AES-256-GCM encrypt/decrypt, envelope encryption, KMS
│   ├── db/               # Mongoose schemas + connection factory
│   ├── auth/             # JWT sign/verify + Express middleware
│   ├── logger/           # Audit log writer + reader
│   ├── types/            # Shared type definitions
│   ├── utils/            # Token gen, IP validation, rate limiting, scopes, providers, config
│   ├── anomaly/          # MAD-based anomaly detection + graduated lockout
│   └── ratelimit/        # Sliding window rate limiter + slow-burn detection
├── infra/
│   ├── docker/           # docker-compose.yml (MongoDB + mongo-express)
│   ├── nginx/            # Stub nginx config
│   └── scripts/          # seed.js + deploy.sh
├── scripts/              # setup.js + release.js
├── .github/workflows/    # test.yml, publish.yml, preview-cleanup.yml
├── docs/                 # Architecture, security, plans, bug tracking
├── .env.example
├── README.md
└── package.json          # npm workspaces root
```

## Dependency Graph

```
apps/server
  └── @vaultify/anomaly (anomaly detection)
  └── @vaultify/auth (JWT + middleware)
  └── @vaultify/crypto (encryption + KMS)
  └── @vaultify/db (Mongoose models)
  └── @vaultify/logger (audit logging)
  └── @vaultify/ratelimit (rate limiting)
  └── @vaultify/utils (tokens, IP, scopes, providers, config)

apps/proxy-service
  └── @vaultify/anomaly (pre-flight checks)
  └── @vaultify/utils (token validation, scope checking)
  └── @vaultify/logger (audit logging)
  └── @vaultify/db (Mongoose models)
  └── @vaultify/ratelimit (rate limiting)

apps/audit-service
  └── @vaultify/db (AuditLog model)
  └── @vaultify/utils (helpers)

apps/web — no internal deps (browser-only)
apps/cli — no internal deps (standalone CLI)
packages/vaultify (SDK) — no internal deps (published separately)
```
