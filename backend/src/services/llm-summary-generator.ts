/**
 * LLM-Powered Session Summary Generator
 *
 * Generates rich, contextual session summaries using Claude API (Anthropic).
 * Provides more detailed summaries than heuristic-based approaches.
 *
 * @module llm-summary-generator
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PlaybackFrame } from '../types/transcript';
import type { SessionSummary } from './summarizer';

/**
 * Input data for LLM summary generation
 */
export interface LlmSummaryInput {
  sessionId: string;
  frames: PlaybackFrame[];
  project: string;
  duration: number;
}

/**
 * LLM-generated summary response
 */
interface LlmSummaryResponse {
  oneLiner: string;
  accomplishments: string[];
  filesModified: string[];
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Summary prompt template for Claude
 */
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

/**
 * LLM-powered session summary generator
 *
 * Uses Claude API to generate rich session summaries with:
 * - Natural language descriptions
 * - Key accomplishments
 * - Files modified
 * - Complexity assessment
 * - Cost and token tracking
 */
export class LlmSummaryGenerator {
  private _anthropic: Anthropic | null = null;
  private _initialized = false;
  private requestCount = 0;
  private lastResetTime = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private readonly MAX_TRANSCRIPT_CHARS = 12000; // ~4k tokens

  /**
   * Initialize the LLM summary generator
   *
   * Uses lazy initialization to ensure dotenv has loaded before
   * reading environment variables. Safe to instantiate at module load.
   */
  constructor() {
    // Lazy initialization - don't read env vars in constructor
  }

  /**
   * Get or create the Anthropic client (lazy initialization)
   *
   * This ensures the API key is read after dotenv.config() has run.
   */
  private getClient(): Anthropic | null {
    if (!this._initialized) {
      const apiKey = process.env.RECALL_ANTHROPIC_API_KEY;
      if (apiKey) {
        this._anthropic = new Anthropic({ apiKey });
      }
      this._initialized = true;
    }
    return this._anthropic;
  }

  /**
   * Check if LLM summarization is available
   *
   * @returns true if API key is configured
   */
  isAvailable(): boolean {
    return this.getClient() !== null;
  }

  /**
   * Generate an LLM-powered summary
   *
   * @param input - Summary input with frames and metadata
   * @returns SessionSummary with LLM-generated content
   * @throws Error if API key not configured or rate limit exceeded
   *
   * @example
   * const generator = new LlmSummaryGenerator();
   * const summary = await generator.generateSummary({
   *   sessionId: 'abc-123',
   *   frames: frames,
   *   project: 'my-app',
   *   duration: 300000
   * });
   */
  async generateSummary(input: LlmSummaryInput): Promise<SessionSummary> {
    this.checkRateLimit();

    const client = this.getClient();
    if (!client) {
      throw new Error('LLM not configured. Set RECALL_ANTHROPIC_API_KEY environment variable.');
    }

    const transcript = this.buildTranscript(input.frames);
    const prompt = this.buildPrompt(input.project, input.duration, transcript);
    const model = process.env.RECALL_LLM_MODEL || 'claude-3-haiku-20240307';
    const maxTokens = parseInt(process.env.RECALL_LLM_MAX_TOKENS || '500', 10);

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type from LLM');
      }

      const parsed = this.parseResponse(content.text);
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

      // Build summary in format compatible with existing schema
      return {
        sessionId: input.sessionId,
        summaryText: parsed.oneLiner,
        keyDecisions: parsed.accomplishments,
        filesChanged: this.parseFilesChanged(parsed.filesModified),
        toolsUsed: {}, // LLM doesn't track individual tool usage
        errorCount: 0, // LLM doesn't track errors
        successIndicators: [],
        generatedAt: new Date().toISOString(),
        generatedBy: 'llm',
        tokensUsed,
        estimatedCost: this.estimateCost(tokensUsed, model),
        model,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LLM summary generation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build transcript from playback frames
   *
   * Extracts relevant content from frames and truncates to fit token limits.
   * Focuses on user messages, assistant responses, and tool executions.
   *
   * @param frames - Array of playback frames
   * @returns Formatted transcript string (max ~12k chars)
   */
  private buildTranscript(frames: PlaybackFrame[]): string {
    let result = '';

    for (const frame of frames) {
      const line = this.formatFrame(frame);
      if (!line) continue;

      // Stop if we exceed character limit
      if (result.length + line.length > this.MAX_TRANSCRIPT_CHARS) {
        break;
      }

      result += line + '\n';
    }

    return result.trim();
  }

  /**
   * Format a single frame for transcript
   *
   * @param frame - Playback frame to format
   * @returns Formatted string or empty if not relevant
   */
  private formatFrame(frame: PlaybackFrame): string {
    switch (frame.type) {
      case 'user_message':
        if (frame.userMessage?.text) {
          return `USER: ${frame.userMessage.text.slice(0, 500)}`;
        }
        break;

      case 'claude_response':
        if (frame.claudeResponse?.text) {
          return `ASSISTANT: ${frame.claudeResponse.text.slice(0, 500)}`;
        }
        break;

      case 'tool_execution':
        if (frame.toolExecution) {
          const tool = frame.toolExecution.tool;
          const input = frame.toolExecution.input;
          const filePath = input?.file_path || input?.path || '';

          if (filePath) {
            return `TOOL [${tool}]: ${filePath}`;
          }

          const output = frame.toolExecution.output?.content || '';
          return `TOOL [${tool}]: ${output.slice(0, 200)}`;
        }
        break;

      default:
        return '';
    }

    return '';
  }

  /**
   * Build the prompt for Claude
   *
   * @param project - Project name
   * @param duration - Session duration in milliseconds
   * @param transcript - Formatted transcript
   * @returns Complete prompt string
   */
  private buildPrompt(project: string, duration: number, transcript: string): string {
    const durationMinutes = Math.round(duration / 60000);
    return SUMMARY_PROMPT.replace('{{project}}', project)
      .replace('{{duration}}', String(durationMinutes))
      .replace('{{transcript}}', transcript);
  }

  /**
   * Parse LLM JSON response
   *
   * @param text - Raw text from LLM
   * @returns Parsed summary response
   * @throws Error if JSON is invalid
   */
  private parseResponse(text: string): LlmSummaryResponse {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.oneLiner || !Array.isArray(parsed.accomplishments)) {
        throw new Error('Invalid response structure');
      }

      return {
        oneLiner: parsed.oneLiner,
        accomplishments: parsed.accomplishments,
        filesModified: parsed.filesModified || [],
        complexity: parsed.complexity || 'medium',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse files modified into structured format
   *
   * @param files - Array of file paths
   * @returns Structured files changed object
   */
  private parseFilesChanged(files: string[]): SessionSummary['filesChanged'] {
    return {
      created: [],
      modified: files,
      deleted: [],
    };
  }

  /**
   * Check and enforce rate limiting
   *
   * Prevents excessive API calls by limiting to MAX_REQUESTS_PER_MINUTE.
   * Resets counter every minute.
   *
   * @throws Error if rate limit exceeded
   */
  private checkRateLimit(): void {
    const now = Date.now();

    // Reset counter if more than a minute has passed
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error(
        'Rate limit exceeded. Maximum 10 requests per minute. Try again in a moment.'
      );
    }

    this.requestCount++;
  }

  /**
   * Estimate API cost for a request
   *
   * Uses model-specific pricing to estimate cost.
   *
   * @param tokens - Total tokens (input + output)
   * @param model - Model name
   * @returns Estimated cost in USD
   *
   * @example
   * const cost = generator.estimateCost(1000, 'claude-3-haiku-20240307');
   * // Returns: 0.00075 (approximately $0.75 per million tokens)
   */
  private estimateCost(tokens: number, model: string): number {
    // Claude Haiku pricing (as of 2024):
    // $0.25/MTok input, $1.25/MTok output
    // Average: ~$0.75/MTok
    const costPerMToken = model.includes('haiku') ? 0.75 : 3.0;
    return (tokens / 1_000_000) * costPerMToken;
  }
}

/**
 * Singleton instance for LLM summary generator
 */
export const llmSummaryGenerator = new LlmSummaryGenerator();
