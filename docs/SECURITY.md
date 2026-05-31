# Security

## The Safe Plays

A layered defense model for Vaultify.

### Layer 1: The vault server never runs on Vercel
This is critical. If the vault runs on Vercel and Vercel is compromised, the vault is compromised too. The vault must live on separate, independent infrastructure such as Railway, Fly.io, or a VPS. Different company, different attack surface, different breach.

### Layer 2: Keys never touch disk in plaintext
Even if someone gets a database dump, they only get AES-256 encrypted blobs. Those blobs are useless without the encryption key, which lives as an environment secret on the server, not in the database.

### Layer 3: Encryption key is not database access
Keep the two separated. Even if an attacker gets the database, they still do not have the encryption key. Even if they get the encryption key from server env, they still need the database. Two separate breaches are required.

### Layer 4: Real key only exists in memory, never in logs
The decrypted real key should exist in RAM for only the narrow window needed to service a single request, then be cleared immediately. It should never be written to logs, files, metrics, or traces. A database dump, log dump, or filesystem dump must never reveal it.

### Layer 5: Rate limiting and IP allowlisting on the vault admin panel
The vault's key management UI, where real keys are added and viewed, should only be accessible from trusted IPs. Even if an attacker has valid credentials, they should not be able to reach the admin panel from an untrusted machine.

### Layer 6: Separate the proxy from the admin
The proxy endpoint that Vercel calls and the admin endpoint used to manage keys should be completely separate services. Compromising the proxy endpoint must give zero access to key management.

## Operational Rule of Thumb
If a control protects the proxy path, it is not enough for admin access. If a control protects admin access, it is not enough for proxy traffic. Keep those boundaries separate by design.

## Tasks

### Infrastructure
- [ ] Host the vault server on separate infrastructure from Vercel.
- [ ] Confirm the proxy service and admin service are deployed independently.
- [ ] Document the allowed production hosts for the vault server.

### Encryption
- [ ] Ensure real API keys are stored only as AES-256 encrypted blobs.
- [ ] Keep the encryption key in server environment secrets, not in the database.
- [ ] Verify decrypted keys are never persisted to disk.

### Runtime Safety
- [ ] Limit decrypted keys to in-memory use only during a single request.
- [ ] Audit logs, traces, and error handlers to prevent secret leakage.
- [ ] Add tests that fail if a real key appears in any log output.

### Admin Access
- [ ] Restrict the admin panel to trusted IP addresses.
- [ ] Add rate limiting to the admin surface.
- [ ] Keep admin credentials separate from proxy credentials.

### Service Separation
- [ ] Split proxy endpoints from admin endpoints.
- [ ] Verify the proxy path cannot reach key management routes.
- [ ] Add a security review step for any change touching both services.
