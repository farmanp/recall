# Antigravity Agent Spec: LLM Session Summaries

**Agent:** Antigravity (Sonnet 4.5)
**Branch:** `feat/llm-summaries`
**Directory:** `~/Documents/projects/recall-antigravity/`
**Priority:** HIGH - Core feature for indie-ready milestone

---

## Mission

Implement AI-powered session summaries that automatically generate concise descriptions of what happened in each coding session. This enables quick understanding of session content without replaying.

---

## Tasks

### Task S.1: LLM Summary Generation Service

**File to Create:** `backend/src/services/summary-generator.ts`

**Acceptance Criteria:**

- [ ] Supports multiple LLM providers (Claude API, OpenAI)
- [ ] Configurable via environment variables
- [ ] Generates structured summaries with:
  - One-line description
  - Key accomplishments (bullet points)
  - Files modified
  - Estimated complexity
- [ ] Rate limiting (max 10 requests/minute)
- [ ] Cost tracking per summary
- [ ] Graceful fallback when API unavailable

**Environment Variables:**

```
RECALL_LLM_PROVIDER=anthropic|openai
RECALL_ANTHROPIC_API_KEY=sk-ant-...
RECALL_OPENAI_API_KEY=sk-...
RECALL_LLM_MODEL=claude-3-haiku-20240307
RECALL_LLM_MAX_TOKENS=500
```

**Implementation:**

```typescript
// backend/src/services/summary-generator.ts
import Anthropic from '@anthropic-ai/sdk';

export interface SessionSummary {
  sessionId: string;
  oneLiner: string;
  accomplishments: string[];
  filesModified: string[];
  complexity: 'low' | 'medium' | 'high';
  tokensUsed: number;
  estimatedCost: number;
  generatedAt: string;
  model: string;
}

export interface SummaryInput {
  sessionId: string;
  frames: Array<{
    type: string;
    content: string;
    toolName?: string;
    filePath?: string;
  }>;
  project: string;
  duration: number;
}

const SUMMARY_PROMPT = `Analyze this AI coding session and provide a structured summary.

Session from project: {{project}}
Duration: {{duration}} minutes

Conversation transcript:
{{transcript}}

Respond in this exact JSON format:
{
  "oneLiner": "Brief one-sentence description of what was accomplished",
  "accomplishments": ["Key thing 1", "Key thing 2", "Key thing 3"],
  "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
  "complexity": "low|medium|high"
}`;

export class SummaryGenerator {
  private anthropic: Anthropic | null = null;
  private requestCount = 0;
  private lastResetTime = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 10;

  constructor() {
    const apiKey = process.env.RECALL_ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  async generateSummary(input: SummaryInput): Promise<SessionSummary> {
    this.checkRateLimit();

    if (!this.anthropic) {
      throw new Error('LLM not configured. Set RECALL_ANTHROPIC_API_KEY.');
    }

    const transcript = this.buildTranscript(input.frames);
    const prompt = SUMMARY_PROMPT.replace('{{project}}', input.project)
      .replace('{{duration}}', String(Math.round(input.duration / 60000)))
      .replace('{{transcript}}', transcript);

    const model = process.env.RECALL_LLM_MODEL || 'claude-3-haiku-20240307';

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: parseInt(process.env.RECALL_LLM_MAX_TOKENS || '500'),
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from LLM');
    }

    const parsed = JSON.parse(content.text);
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    return {
      sessionId: input.sessionId,
      ...parsed,
      tokensUsed,
      estimatedCost: this.estimateCost(tokensUsed, model),
      generatedAt: new Date().toISOString(),
      model,
    };
  }

  private buildTranscript(frames: SummaryInput['frames']): string {
    // Limit to ~4000 tokens worth of content
    const maxChars = 12000;
    let result = '';

    for (const frame of frames) {
      const line = this.formatFrame(frame);
      if (result.length + line.length > maxChars) break;
      result += line + '\n';
    }

    return result;
  }

  private formatFrame(frame: SummaryInput['frames'][0]): string {
    switch (frame.type) {
      case 'user_message':
        return `USER: ${frame.content.slice(0, 500)}`;
      case 'claude_response':
        return `ASSISTANT: ${frame.content.slice(0, 500)}`;
      case 'tool_execution':
        return `TOOL [${frame.toolName}]: ${frame.filePath || frame.content.slice(0, 200)}`;
      default:
        return '';
    }
  }

  private checkRateLimit(): void {
    const now = Date.now();
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded. Try again in a minute.');
    }

    this.requestCount++;
  }

  private estimateCost(tokens: number, model: string): number {
    // Haiku: $0.25/MTok input, $1.25/MTok output (estimate average)
    const costPerMToken = model.includes('haiku') ? 0.75 : 3.0;
    return (tokens / 1_000_000) * costPerMToken;
  }
}

export const summaryGenerator = new SummaryGenerator();
```

**Dependencies to Add:**

```bash
npm install @anthropic-ai/sdk
```

---

### Task S.2: Summary Caching & Storage

**Files to Create:**

- `backend/src/db/migrations/030_session_summaries.sql`
- `backend/src/db/summary-queries.ts`

**Database Schema:**

```sql
-- backend/src/db/migrations/030_session_summaries.sql
CREATE TABLE IF NOT EXISTS session_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  one_liner TEXT NOT NULL,
  accomplishments TEXT NOT NULL,  -- JSON array
  files_modified TEXT NOT NULL,   -- JSON array
  complexity TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  estimated_cost REAL NOT NULL,
  model TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  generated_at_epoch INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES session_metadata(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_summaries_generated ON session_summaries(generated_at_epoch DESC);
```

**Query Functions:**

```typescript
// backend/src/db/summary-queries.ts
export function saveSummary(summary: SessionSummary): void;
export function getSummary(sessionId: string): SessionSummary | null;
export function hasSummary(sessionId: string): boolean;
export function getSummaryStats(): { total: number; totalCost: number; totalTokens: number };
export function deleteSummary(sessionId: string): boolean;
```

---

### Task S.3: Summary API Routes

**File to Create:** `backend/src/routes/summaries.ts`

**Endpoints:**

```
GET  /api/sessions/:id/summary     - Get summary for session (generate if missing)
POST /api/sessions/:id/summary     - Force regenerate summary
DELETE /api/sessions/:id/summary   - Delete cached summary

GET  /api/summaries/stats          - Get summary statistics
POST /api/summaries/batch          - Generate summaries for multiple sessions
```

**Implementation Notes:**

- GET should return cached summary if available
- If no cache and `?generate=true`, generate on-demand
- Batch endpoint should queue summaries and process async
- Return 402 Payment Required if API key not configured

---

### Task S.4: Summary Display Integration

**Files to Modify:**

- `frontend/src/hooks/useTranscriptApi.ts` - Add `useSessionSummary` hook (already exists, verify it works)
- `frontend/src/components/session-player/SummaryCard.tsx` - Improve display

**Verify existing SummaryCard works with new data structure.**

---

## Testing Strategy

**Unit Tests:**

```typescript
// backend/src/__tests__/services/summary-generator.test.ts
describe('SummaryGenerator', () => {
  it('should build transcript from frames');
  it('should respect rate limits');
  it('should estimate cost correctly');
  it('should parse LLM response');
});

// backend/src/__tests__/db/summary-queries.test.ts
describe('summary queries', () => {
  it('should save and retrieve summary');
  it('should handle duplicate session_id');
  it('should calculate stats correctly');
});
```

**Integration Test:**

```bash
# Set API key and test
RECALL_ANTHROPIC_API_KEY=sk-ant-xxx npm start
curl http://localhost:3001/api/sessions/SESSION_ID/summary?generate=true
```

---

## Definition of Done

- [ ] Summary generation service working with Claude API
- [ ] Summaries cached in database
- [ ] API routes implemented
- [ ] Rate limiting working
- [ ] Cost tracking accurate
- [ ] Unit tests passing
- [ ] Integration tested with real API

---

## Commit Messages

```
feat(summaries): add LLM summary generation service
feat(summaries): add summary caching and storage
feat(summaries): add summary API routes
feat(summaries): integrate with frontend SummaryCard
```

---

## Notes for Agent

- **API costs matter** - Use Haiku for cost efficiency, track every token
- **Cache aggressively** - Never regenerate unless explicitly requested
- **Fail gracefully** - Missing API key should disable feature, not crash
- **Test with mocks** - Don't burn API credits in unit tests
