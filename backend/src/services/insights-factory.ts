/**
 * Insights Provider Factory
 *
 * Determines which insights provider to use:
 * 1. Pro tier (local) if @recall-insights/core is installed + valid license
 * 2. Free tier (SaaS) if API key is provided
 * 3. None if neither is configured
 */

import type { InsightsProvider, InsightsConfig } from './insights-provider.js';
import { LocalInsightsProvider } from './insights-local-provider.js';
import { SaasInsightsProvider } from './insights-saas-provider.js';

class NoInsightsProvider implements InsightsProvider {
  async analyzeSession(): Promise<any> {
    throw this.createUpgradeError();
  }

  async analyzeRepo(): Promise<any> {
    throw this.createUpgradeError();
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  getTier(): 'none' {
    return 'none';
  }

  private createUpgradeError() {
    return {
      code: 'INSIGHTS_NOT_AVAILABLE',
      message: 'Insights feature not available',
      upgradeUrl: 'https://recall-insights.com/pricing',
      options: [
        {
          tier: 'free',
          description: 'Get started with free tier (limited features)',
          cta: 'Sign up for free API key',
          url: 'https://recall-insights.com/signup',
        },
        {
          tier: 'pro',
          description: 'Full features, unlimited usage, runs locally',
          cta: 'Get Pro license',
          url: 'https://recall-insights.com/pricing',
        },
      ],
    };
  }
}

let cachedProvider: InsightsProvider | null = null;

export async function createInsightsProvider(config?: InsightsConfig): Promise<InsightsProvider> {
  if (cachedProvider) {
    return cachedProvider;
  }

  const cfg: InsightsConfig = {
    apiKey: config?.apiKey || process.env.RECALL_INSIGHTS_API_KEY,
    apiUrl: config?.apiUrl || process.env.RECALL_INSIGHTS_API_URL,
    licenseKey: config?.licenseKey || process.env.RECALL_INSIGHTS_LICENSE_KEY,
    localConfigPath: config?.localConfigPath || process.env.RECALL_INSIGHTS_CONFIG,
  };

  // Try Pro tier first (best experience)
  if (cfg.licenseKey) {
    try {
      const provider = new LocalInsightsProvider(cfg);
      await provider.initialize();
      console.log('[Insights] Pro tier enabled (local execution)');
      cachedProvider = provider;
      return provider;
    } catch (error: any) {
      console.warn(`[Insights] Pro tier initialization failed: ${error.message}`);
      // Fall through to try free tier
    }
  }

  // Try free tier
  if (cfg.apiKey) {
    try {
      const provider = new SaasInsightsProvider(cfg);
      console.log('[Insights] Free tier enabled (SaaS API)');
      cachedProvider = provider;
      return provider;
    } catch (error: any) {
      console.warn(`[Insights] Free tier initialization failed: ${error.message}`);
    }
  }

  // No insights available
  console.log('[Insights] Not configured. Visit https://recall-insights.com to get started');
  cachedProvider = new NoInsightsProvider();
  return cachedProvider;
}

export function resetInsightsProvider() {
  cachedProvider = null;
}

/**
 * Check if insights are available without initializing
 */
export function isInsightsConfigured(): boolean {
  return !!(process.env.RECALL_INSIGHTS_LICENSE_KEY || process.env.RECALL_INSIGHTS_API_KEY);
}

/**
 * Get the configured tier
 */
export function getConfiguredTier(): 'pro' | 'free' | 'none' {
  if (process.env.RECALL_INSIGHTS_LICENSE_KEY) return 'pro';
  if (process.env.RECALL_INSIGHTS_API_KEY) return 'free';
  return 'none';
}
