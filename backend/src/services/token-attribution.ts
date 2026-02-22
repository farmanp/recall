/**
 * Token Attribution Service
 *
 * Calculates per-frame token attribution by category and estimates API costs.
 * Supports multiple Claude models with their respective pricing tiers.
 *
 * @module token-attribution
 */

import type { PlaybackFrame, TokenAttribution, TokenUsage } from '../types/transcript';

/**
 * Token attribution categories
 */
export enum TokenCategory {
  UserInput = 'userInput',
  ToolOutput = 'toolOutput',
  Thinking = 'thinking',
  Response = 'response',
  ClaudeMd = 'claudeMd',
  Cache = 'cache',
}

/**
 * Model pricing in dollars per million tokens (MTok)
 * Based on Anthropic's published pricing
 */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

/**
 * Supported model pricing tiers
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus models
  'claude-opus-4-5-20251101': { inputPerMTok: 15, outputPerMTok: 75 },
  'claude-4-opus': { inputPerMTok: 15, outputPerMTok: 75 },
  opus: { inputPerMTok: 15, outputPerMTok: 75 },

  // Sonnet models
  'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-4-sonnet': { inputPerMTok: 3, outputPerMTok: 15 },
  sonnet: { inputPerMTok: 3, outputPerMTok: 15 },

  // Haiku models
  'claude-haiku-3-5-20241022': { inputPerMTok: 0.25, outputPerMTok: 1.25 },
  'claude-3-haiku': { inputPerMTok: 0.25, outputPerMTok: 1.25 },
  haiku: { inputPerMTok: 0.25, outputPerMTok: 1.25 },
};

/**
 * Default model used when none is specified
 */
const DEFAULT_MODEL = 'opus';

/**
 * Frame attribution result with category and token count
 */
export interface FrameAttribution {
  frameId: string;
  category: TokenCategory;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
}

/**
 * Token Attribution Service
 *
 * Provides methods to:
 * - Attribute tokens to categories based on frame type
 * - Calculate per-frame token breakdown
 * - Estimate API costs for sessions
 */
export class TokenAttributionService {
  /**
   * Attribute tokens from frames to their respective categories
   *
   * Maps frame types to token categories:
   * - user_message -> userInput
   * - claude_thinking -> thinking
   * - claude_response -> response
   * - tool_execution -> toolOutput
   * - cache_read_input_tokens -> cache
   *
   * @param frames - Array of playback frames
   * @returns Array of TokenAttribution objects, one per frame
   *
   * @example
   * const attributions = TokenAttributionService.attributeTokens(frames);
   * console.log(attributions[0].userInput); // tokens from user input
   */
  static attributeTokens(frames: PlaybackFrame[]): TokenAttribution[] {
    return frames.map((frame) => this.attributeFrameTokens(frame));
  }

  /**
   * Calculate token attribution for a single frame
   *
   * @param frame - A single playback frame
   * @returns TokenAttribution object with per-category breakdown
   */
  static attributeFrameTokens(frame: PlaybackFrame): TokenAttribution {
    const attribution: TokenAttribution = {
      userInput: 0,
      toolOutput: 0,
      thinking: 0,
      response: 0,
      claudeMd: 0,
      cache: 0,
    };

    const usage = frame.tokenUsage;
    if (!usage) {
      return attribution;
    }

    // Attribute cache tokens separately
    if (usage.cache_read_input_tokens) {
      attribution.cache = usage.cache_read_input_tokens;
    }

    // Calculate non-cache input tokens
    const inputTokens = usage.input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const nonCacheInputTokens = Math.max(0, inputTokens - cacheReadTokens);

    // Attribute based on frame type
    switch (frame.type) {
      case 'user_message':
        // User messages contribute to input tokens
        attribution.userInput = nonCacheInputTokens;
        break;

      case 'claude_thinking':
        // Thinking blocks are output tokens
        attribution.thinking = usage.output_tokens || 0;
        break;

      case 'claude_response':
        // Response blocks are output tokens
        attribution.response = usage.output_tokens || 0;
        break;

      case 'tool_execution':
        // Tool outputs contribute to input tokens (they're sent back to Claude)
        attribution.toolOutput = nonCacheInputTokens;
        break;

      case 'context_compaction':
        // Context compaction doesn't have direct token attribution
        break;

      default:
        // Unknown frame types - attribute to response as fallback
        if (usage.output_tokens) {
          attribution.response = usage.output_tokens;
        }
        if (nonCacheInputTokens) {
          attribution.userInput = nonCacheInputTokens;
        }
        break;
    }

    return attribution;
  }

  /**
   * Get frame attributions with frame IDs and detailed breakdown
   *
   * @param frames - Array of playback frames
   * @returns Array of FrameAttribution objects with frame IDs
   */
  static getFrameAttributions(frames: PlaybackFrame[]): FrameAttribution[] {
    return frames.map((frame) => {
      const category = this.getFrameCategory(frame);
      const usage = frame.tokenUsage;

      return {
        frameId: frame.id,
        category,
        inputTokens: usage?.input_tokens || 0,
        outputTokens: usage?.output_tokens || 0,
        cacheTokens: usage?.cache_read_input_tokens || 0,
      };
    });
  }

  /**
   * Determine the primary token category for a frame
   *
   * @param frame - A single playback frame
   * @returns The primary TokenCategory for this frame
   */
  static getFrameCategory(frame: PlaybackFrame): TokenCategory {
    switch (frame.type) {
      case 'user_message':
        return TokenCategory.UserInput;
      case 'claude_thinking':
        return TokenCategory.Thinking;
      case 'claude_response':
        return TokenCategory.Response;
      case 'tool_execution':
        return TokenCategory.ToolOutput;
      default:
        return TokenCategory.Response;
    }
  }

  /**
   * Calculate aggregated attribution across all frames
   *
   * @param frames - Array of playback frames
   * @returns Single TokenAttribution with totals across all frames
   */
  static calculateTotalAttribution(frames: PlaybackFrame[]): TokenAttribution {
    const attributions = this.attributeTokens(frames);

    return attributions.reduce(
      (total, attr) => ({
        userInput: total.userInput + attr.userInput,
        toolOutput: total.toolOutput + attr.toolOutput,
        thinking: total.thinking + attr.thinking,
        response: total.response + attr.response,
        claudeMd: total.claudeMd + attr.claudeMd,
        cache: total.cache + attr.cache,
      }),
      {
        userInput: 0,
        toolOutput: 0,
        thinking: 0,
        response: 0,
        claudeMd: 0,
        cache: 0,
      }
    );
  }
}

/**
 * Calculate the cost for a single API turn/call
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param modelName - Model identifier (defaults to 'opus')
 * @returns Cost in cents
 *
 * @example
 * // Opus: $15/$75 per MTok
 * const cost = calculatePerTurnCost(1000, 500, 'opus');
 * // = (1000 * 15 / 1_000_000 + 500 * 75 / 1_000_000) * 100
 * // = (0.015 + 0.0375) * 100 = 5.25 cents
 *
 * @example
 * // Sonnet: $3/$15 per MTok
 * const cost = calculatePerTurnCost(10000, 2000, 'sonnet');
 * // = (10000 * 3 / 1_000_000 + 2000 * 15 / 1_000_000) * 100
 * // = (0.03 + 0.03) * 100 = 6 cents
 */
export function calculatePerTurnCost(
  inputTokens: number,
  outputTokens: number,
  modelName?: string
): number {
  const model = modelName?.toLowerCase() || DEFAULT_MODEL;
  const pricing = getPricingForModel(model);

  // Calculate cost in dollars
  const inputCostDollars = (inputTokens * pricing.inputPerMTok) / 1_000_000;
  const outputCostDollars = (outputTokens * pricing.outputPerMTok) / 1_000_000;

  // Convert to cents
  return (inputCostDollars + outputCostDollars) * 100;
}

/**
 * Calculate cost from TokenUsage object
 *
 * @param usage - TokenUsage object with input/output tokens
 * @param modelName - Model identifier (defaults to 'opus')
 * @returns Cost in cents
 */
export function calculateCostFromUsage(usage: TokenUsage, modelName?: string): number {
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  return calculatePerTurnCost(inputTokens, outputTokens, modelName);
}

/**
 * Calculate total session cost from frames
 *
 * @param frames - Array of playback frames with token usage
 * @param modelName - Model identifier (defaults to 'opus')
 * @returns Total cost in cents
 */
export function calculateSessionCost(frames: PlaybackFrame[], modelName?: string): number {
  return frames.reduce((total, frame) => {
    if (!frame.tokenUsage) return total;
    return total + calculateCostFromUsage(frame.tokenUsage, modelName);
  }, 0);
}

/**
 * Get pricing for a model, with fallback to default
 *
 * @param modelName - Model identifier
 * @returns ModelPricing object
 */
function getPricingForModel(modelName: string): ModelPricing {
  // Default pricing (Opus - most expensive = safe default)
  const defaultPricing: ModelPricing = { inputPerMTok: 15, outputPerMTok: 75 };

  // Try exact match first
  const exactMatch = MODEL_PRICING[modelName];
  if (exactMatch) {
    return exactMatch;
  }

  // Try to match by tier name in model string
  const lowerModel = modelName.toLowerCase();
  if (lowerModel.includes('opus')) {
    return MODEL_PRICING['opus'] ?? defaultPricing;
  }
  if (lowerModel.includes('sonnet')) {
    return MODEL_PRICING['sonnet'] ?? defaultPricing;
  }
  if (lowerModel.includes('haiku')) {
    return MODEL_PRICING['haiku'] ?? defaultPricing;
  }

  // Default to Opus pricing
  return defaultPricing;
}

/**
 * Get human-readable pricing info for a model
 *
 * @param modelName - Model identifier
 * @returns Formatted pricing string
 */
export function getModelPricingInfo(modelName?: string): string {
  const model = modelName?.toLowerCase() || DEFAULT_MODEL;
  const pricing = getPricingForModel(model);

  return `$${pricing.inputPerMTok}/$${pricing.outputPerMTok} per MTok (input/output)`;
}
