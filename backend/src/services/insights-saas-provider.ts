/**
 * SaaS Insights Provider (Free Tier)
 *
 * Makes API calls to hosted recall-insights service.
 * - Limited features (basic metrics only)
 * - Usage quota enforced server-side
 * - Requires API key (free tier)
 */

import type {
  InsightsProvider,
  SessionInsights,
  RepoInsights,
  InsightsConfig,
} from './insights-provider.js';

export class SaasInsightsProvider implements InsightsProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: InsightsConfig) {
    this.apiKey = config.apiKey || process.env.RECALL_INSIGHTS_API_KEY || '';
    this.apiUrl =
      config.apiUrl || process.env.RECALL_INSIGHTS_API_URL || 'https://api.recall-insights.com';

    if (!this.apiKey) {
      throw new Error(
        'RECALL_INSIGHTS_API_KEY required for free tier. Get your key at https://recall-insights.com/signup'
      );
    }
  }

  async analyzeSession(sessionId: string): Promise<SessionInsights> {
    // Read session file from local filesystem
    const sessionData = await this.getSessionData(sessionId);

    // Send to API (with privacy controls - only metadata, not full content)
    const response = await fetch(`${this.apiUrl}/v1/analyze/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        sessionId,
        metadata: {
          duration: sessionData.duration,
          eventCount: sessionData.eventCount,
          agent: sessionData.agent,
          model: sessionData.model,
          // No actual code/prompts sent - privacy-first
        },
        // Optionally include anonymized metrics
        metrics: this.extractAnonymizedMetrics(sessionData),
      }),
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error('Free tier quota exceeded. Upgrade to Pro for unlimited insights.');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key. Get your key at https://recall-insights.com/signup');
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    const insights = await response.json();

    return {
      ...insights,
      tier: 'free' as const,
    };
  }

  async analyzeRepo(projectPath: string): Promise<RepoInsights> {
    // Free tier: limited to last 10 sessions
    const response = await fetch(`${this.apiUrl}/v1/analyze/repo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        projectPath,
        limit: 10, // Free tier limitation
      }),
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error(
          'Repo analysis requires Pro tier. Upgrade at https://recall-insights.com/pricing'
        );
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    const insights = await response.json();
    return {
      ...insights,
      tier: 'free' as const,
    };
  }

  async isAvailable(sessionId: string): Promise<boolean> {
    try {
      // Quick check without consuming quota
      const response = await fetch(`${this.apiUrl}/v1/check/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getTier(): 'free' {
    return 'free';
  }

  private async getSessionData(sessionId: string) {
    // Read from local recall database
    // This is a placeholder - integrate with your actual session reading logic
    return {
      sessionId,
      duration: 0,
      eventCount: 0,
      agent: 'claude',
      model: 'claude-sonnet-4',
    };
  }

  private extractAnonymizedMetrics(sessionData: any) {
    // Extract non-sensitive metrics only
    return {
      toolExecutionCount: 0,
      thinkingBlockCount: 0,
      tokenCount: 0,
      // No file names, paths, or code content
    };
  }
}
