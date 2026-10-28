# Hermy HQ — private owner fork

A self-hostable mission-control dashboard for Hermes Agent, adapted from
[vantagecorp-jarvis/hermes-agent-mission-control](https://github.com/vantagecorp-jarvis/hermes-agent-mission-control).
Original Hermy HQ attribution and history are preserved; see [PROVENANCE.md](./PROVENANCE.md).
Hermes Agent is by [Nous Research](https://github.com/NousResearch/hermes-agent).

## This fork

- Next.js 16 / React 19, Prisma / PostgreSQL, standalone Docker runtime.
- **Single-owner password login** via NextAuth Credentials, fixed-cost scrypt password hash and encrypted JWT session cookies. **No Google OAuth dependency.**
- Private APIs, including Garden; no development exemption or internal-secret auth bypass.
- Tasks, ideas, content studios, agent views and memory UI remain from the upstream template. Optional integrations require their own keys/data.
- Bridge source is retained for inspection only. **Do not start the bridge:** approval enforcement, path traversal, queue/TLS and profile isolation blockers are documented in the runbook.

## Self-host

Use [DEPLOY.md](./DEPLOY.md), **not the retained upstream ONBOARDING.md or bridge startup instructions**. Deployment template: [`compose.yaml`](./compose.yaml), app port 3000 (loopback host binding), private persistent Postgres with no host-published DB ports. Secrets belong in ignored local files; examples are placeholders only.

For local development, Node.js 22 is recommended:

```sh
npm ci
npm test
npm run build
```

Configure your own ignored environment from `.env.example` and initialize an isolated Postgres schema with `npm run db:push` before using DB features. `npm run dev` still requires login. Generate a password hash with the hidden-input procedure in DEPLOY.md. No personal data is seeded automatically.

## Security and operational scope

Sessions expire after eight hours. Password-hash rotation invalidates protected-resource access for old JWTs; rotating `NEXTAUTH_SECRET` invalidates all sessions. Login has bounded input, one concurrent scrypt operation and ten attempts per minute per process; production still requires edge rate limiting and HTTPS. Machine secret/cron clients are intentionally no longer authorized. See the runbook for deployment acceptance tests, persistence, backups and remaining dependency findings.

[CHANGELOG.md](./CHANGELOG.md) lists fork changes. Optional content integrations and autonomous bridge behavior are not deployment acceptance claims.

## License / upstream permission

The original README expressly states:

> Provided as a template for you to fork, self-host, and adapt. Add the license of
> your choice before publishing your own instance.

No standalone LICENSE was present in the baseline. This fork relies on that express template/self-host/adaptation permission, preserves attribution, and **does not invent an MIT/Apache or other blanket licence**. See PROVENANCE.md before redistribution; dependency licences remain their authors'.
