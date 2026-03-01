# Recall Insights Integration Guide

This guide explains how the recall-insights monetization system works and how to set it up.

## Architecture Overview

Recall supports three tiers of insights:

1. **None**: No insights configured (default)
2. **Free Tier**: SaaS API calls to hosted service (basic metrics, usage quotas)
3. **Pro Tier**: Local execution with full features (requires license + private npm package)

```
┌─────────────────────────────────────────────────────────┐
│         recall-player (Open Source)                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Insights Provider Interface (Abstract)          │   │
│  └──────────────────────────────────────────────────┘   │
│                       ↓                                  │
│         ┌─────────────┴─────────────┐                    │
│         ↓                           ↓                    │
│  ┌─────────────┐            ┌─────────────┐             │
│  │  Free Tier  │            │  Pro Tier   │             │
│  │  (SaaS API) │            │  (Local)    │             │
│  └─────────────┘            └─────────────┘             │
│         ↓                           ↓                    │
└─────────┼───────────────────────────┼────────────────────┘
          ↓                           ↓
   ┌──────────────┐          ┌───────────────────┐
   │ Cloud Service│          │ @recall-insights/ │
   │ (You Host)   │          │ core (Private npm)│
   └──────────────┘          └───────────────────┘
```

## For recall-player Users

### Free Tier Setup

1. Sign up for a free API key at `https://recall-insights.com/signup`
2. Set environment variable:

```bash
export RECALL_INSIGHTS_API_KEY="your-api-key-here"
npx recall-player
```

**Free tier limitations:**

- Basic metrics only (behavior, cost, simple complexity)
- 100 sessions/month quota
- Privacy-first: Only metadata sent to API (no code content)

### Pro Tier Setup

1. Purchase a Pro license at `https://recall-insights.com/pricing`
2. Install the private package:

```bash
npm install @recall-insights/core
```

3. Set environment variable:

```bash
export RECALL_INSIGHTS_LICENSE_KEY="your-license-key-here"
npx recall-player
```

**Pro tier benefits:**

- All analyzers (15+ specialized analyzers)
- Unlimited sessions
- Runs 100% locally (complete privacy)
- Custom thresholds via YAML config
- Advanced features (semantic analysis, ML-based detection)

### Environment Variables

| Variable                      | Description                                     | Tier |
| ----------------------------- | ----------------------------------------------- | ---- |
| `RECALL_INSIGHTS_API_KEY`     | API key for free tier                           | Free |
| `RECALL_INSIGHTS_API_URL`     | Override API URL (default: recall-insights.com) | Free |
| `RECALL_INSIGHTS_LICENSE_KEY` | License key for pro tier                        | Pro  |
| `RECALL_INSIGHTS_CONFIG`      | Path to custom config YAML                      | Pro  |
| `RECALL_INSIGHTS_DB`          | Path to analytics DB (default: ~/.recall/...)   | Pro  |

## For recall-insights Maintainers

### 1. Packaging recall-insights for Private npm Distribution

#### Option A: GitHub Packages (Recommended)

**Advantages:**

- Free for private packages
- Integrated with GitHub authentication
- Supports scoped packages

**Setup:**

1. Update `recall-insights/package.json`:

```json
{
  "name": "@your-org/recall-insights-core",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "@your-org:registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/recall-insights.git"
  }
}
```

2. Create GitHub Personal Access Token with `write:packages` scope

3. Authenticate npm:

```bash
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

4. Publish:

```bash
cd /Users/farman/Documents/projects/recall-insights
npm run build
npm publish
```

5. Users install with:

```bash
npm login --registry=https://npm.pkg.github.com
npm install @your-org/recall-insights-core
```

#### Option B: Verdaccio (Self-Hosted Private Registry)

**Advantages:**

- Complete control
- No external dependencies
- Can add custom license validation

**Setup:**

1. Install Verdaccio:

```bash
npm install -g verdaccio
```

2. Configure (`~/.config/verdaccio/config.yaml`):

```yaml
storage: /path/to/storage

auth:
  htpasswd:
    file: ./htpasswd
    max_users: -1 # Allow unlimited users

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@your-org/*':
    access: $authenticated
    publish: $authenticated
    unpublish: $authenticated

  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs
```

3. Start Verdaccio:

```bash
verdaccio
```

4. Publish:

```bash
npm adduser --registry http://localhost:4873
npm publish --registry http://localhost:4873
```

5. Users install:

```bash
npm install @your-org/recall-insights-core --registry http://your-server:4873
```

#### Option C: npm Enterprise (Paid)

For enterprise-grade private packages with advanced features.

### 2. Building the SaaS API Service

Create a hosted API service that implements the insights analysis:

```typescript
// server.ts (recall-insights API service)
import express from 'express';
import { analyzeBehavior } from '@recall-insights/core';

const app = express();

app.post('/v1/analyze/session', async (req, res) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');

  // Validate API key
  const user = await validateApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check quota
  const quota = await getQuota(user.id);
  if (quota.used >= quota.limit) {
    return res.status(402).json({ error: 'Quota exceeded' });
  }

  // Analyze (limited features for free tier)
  const { metadata } = req.body;
  const insights = await analyzeBehavior(metadata);

  // Increment quota
  await incrementQuota(user.id);

  res.json(insights);
});

app.listen(3000);
```

**Deployment options:**

- Railway
- Fly.io
- AWS Lambda + API Gateway
- DigitalOcean App Platform

### 3. License Key Management

#### Simple Offline License Keys

Use signed JWT tokens as license keys:

```typescript
// generate-license.ts
import jwt from 'jsonwebtoken';

const SECRET = process.env.LICENSE_SIGNING_SECRET;

function generateLicense(userId: string, tier: 'pro', expiresIn: string = '1y') {
  return jwt.sign(
    {
      userId,
      tier,
      features: ['all-analyzers', 'unlimited-usage', 'custom-config'],
    },
    SECRET,
    { expiresIn }
  );
}

// Validation in recall-insights
function validateLicense(licenseKey: string) {
  try {
    const decoded = jwt.verify(licenseKey, SECRET);
    return decoded;
  } catch {
    throw new Error('Invalid license key');
  }
}
```

#### Online License Validation

For stricter control, validate licenses against a server:

```typescript
async function validateLicense(licenseKey: string) {
  const response = await fetch('https://license.recall-insights.com/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey }),
  });

  if (!response.ok) {
    throw new Error('Invalid license');
  }

  return response.json();
}
```

### 4. Monetization Strategies

#### Option 1: Direct Sales

- Sell licenses directly via Stripe/Paddle
- Generate license keys on purchase
- Email license to customer

#### Option 2: Gumroad

- List on Gumroad as digital product
- Automatic delivery of license keys
- Built-in payment processing

#### Option 3: Lemon Squeezy

- Merchant of record (handles VAT/taxes)
- Software license management built-in
- Webhook integration

#### Option 4: Freemium SaaS

- Free tier with usage limits
- Upgrade to Pro via subscription
- Stripe Customer Portal for management

### 5. Protecting Your Code

Even with private npm packages, determined users can access the code. Additional measures:

1. **Code obfuscation**: Use `javascript-obfuscator`
2. **License checks**: Validate on every analysis
3. **Phone-home**: Periodic online validation
4. **Legal protection**: Clear license terms (EULA)

**Obfuscation example:**

```bash
npm install -g javascript-obfuscator

# After build
javascript-obfuscator dist/ --output dist-obfuscated/ \
  --compact true \
  --control-flow-flattening true \
  --dead-code-injection true
```

## Testing the Integration

### Test Free Tier

```bash
# recall-player side
export RECALL_INSIGHTS_API_KEY="test-key"
npx recall-player

# Open http://localhost:3001/sessions/some-session-id
# Click "Insights" tab - should show upgrade prompt or basic metrics
```

### Test Pro Tier

```bash
# Install local package
cd /Users/farman/Documents/projects/recall-insights
npm run build
npm link

cd /Users/farman/Documents/projects/recall
npm link @recall-insights/core

export RECALL_INSIGHTS_LICENSE_KEY="your-test-license"
npx recall-player

# Should show full insights
```

## Troubleshooting

### "Module not found: @recall-insights/core"

- Pro tier package not installed
- Run: `npm install @recall-insights/core`

### "Invalid license key"

- License expired or malformed
- Contact support or generate new license

### "API quota exceeded"

- Free tier monthly limit reached
- Upgrade to Pro or wait for reset

### "CORS error" (SaaS API)

- Add recall-player origins to API CORS config
- Default: `localhost:3001, localhost:5174`

## Updating CLAUDE.md

Add to recall-player's CLAUDE.md:

```markdown
## Insights Feature (Optional)

Recall supports advanced session analytics via recall-insights:

- **Free tier**: Basic metrics via SaaS API (100 sessions/month)
- **Pro tier**: Full features, runs locally, unlimited usage

### Setup

Free: `export RECALL_INSIGHTS_API_KEY="..."`
Pro: `npm install @recall-insights/core && export RECALL_INSIGHTS_LICENSE_KEY="..."`

See [INSIGHTS_INTEGRATION.md](docs/INSIGHTS_INTEGRATION.md) for details.
```

## Next Steps

1. ✅ Create private npm organization or GitHub Packages
2. ✅ Build and publish recall-insights package
3. ✅ Set up license generation system
4. ✅ Deploy SaaS API for free tier
5. ✅ Create marketing page (recall-insights.com)
6. ✅ Set up payment processing (Stripe/Gumroad)
7. ✅ Test end-to-end flow

## Summary

This architecture gives you:

- **Open-source core** (recall-player): Free, community-driven
- **Closed-source extension** (recall-insights): Monetized, proprietary
- **Multiple tiers**: None → Free → Pro
- **Local-first option**: Pro tier runs offline
- **Privacy-first design**: Free tier sends metadata only
- **Standard distribution**: npm packages + API
- **Flexible licensing**: Offline or online validation

This is the same model used by tools like ESLint (open) + ESLint Pro (paid), or VS Code (open) + GitHub Copilot (paid).
