## Share Relay Service (Paid Tier)

**Status:** Not implemented
**Priority:** Future paid feature

### Problem

Current share links only work locally (`localhost:3001`). For actual sharing with others, we need a relay service.

### Proposed Solution

- **Cloudflare Workers + R2** for the relay
- Endpoints:
  - `POST /upload` - Upload redacted session data, returns public share URL
  - `GET /:shareId` - Fetch shared session data
- Auto-expiry (24h, 7d, 30d based on tier)
- Rate limiting per user

### Monetization

- Free tier: Local sharing only (current behavior)
- Paid tier: Relay service for public sharing
  - Limited shares per month
  - Configurable expiry
  - Custom branding/domains

### Implementation Notes

- Frontend should detect if relay is configured (`RECALL_RELAY_URL`)
- Falls back to local-only share if not configured
- Session data is redacted before upload (using existing SecretRedactor)
