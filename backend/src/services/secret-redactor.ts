/**
 * Secret Detection and Redaction Service
 *
 * Detects and redacts sensitive data from session content before sharing.
 * Uses pattern matching to identify common secret formats without storing
 * or logging the actual secret values.
 *
 * Detected patterns:
 * - API keys (OpenAI, Anthropic, AWS, GitHub, etc.)
 * - Bearer tokens and JWTs
 * - Private keys (RSA, SSH, PGP)
 * - Connection strings with passwords
 * - Password/secret fields in config
 */

/**
 * Statistics about redactions performed (never includes actual values)
 */
export interface RedactionStats {
  totalRedactions: number;
  byPattern: Record<string, number>;
}

/**
 * Pattern definition for secret detection
 */
interface SecretPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Secret detection patterns
 *
 * Each pattern includes:
 * - name: Human-readable pattern name for stats
 * - pattern: RegExp to match the secret
 * - replacement: What to replace the secret with
 */
const SECRET_PATTERNS: SecretPattern[] = [
  // OpenAI API keys
  {
    name: 'openai_key',
    pattern: /sk-[A-Za-z0-9]{20,}(?:T3BlbkFJ[A-Za-z0-9]{20,})?/g,
    replacement: '[REDACTED:OPENAI_KEY]',
  },
  // Anthropic API keys
  {
    name: 'anthropic_key',
    pattern: /sk-ant-[A-Za-z0-9\-_]{20,}/g,
    replacement: '[REDACTED:ANTHROPIC_KEY]',
  },
  // AWS Access Key IDs
  {
    name: 'aws_access_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: '[REDACTED:AWS_ACCESS_KEY]',
  },
  // AWS Secret Access Keys (typically 40 chars, base64-ish)
  {
    name: 'aws_secret_key',
    pattern: /(?<=aws_secret_access_key\s*[=:]\s*["']?)[A-Za-z0-9/+=]{40}(?=["']?)/gi,
    replacement: '[REDACTED:AWS_SECRET_KEY]',
  },
  // GitHub Personal Access Tokens (classic and fine-grained)
  {
    name: 'github_token',
    pattern: /gh[ps]_[A-Za-z0-9]{36,}/g,
    replacement: '[REDACTED:GITHUB_TOKEN]',
  },
  // GitHub OAuth tokens
  {
    name: 'github_oauth',
    pattern: /gho_[A-Za-z0-9]{36,}/g,
    replacement: '[REDACTED:GITHUB_OAUTH]',
  },
  // GitHub App tokens
  {
    name: 'github_app',
    pattern: /(?:ghu|ghr)_[A-Za-z0-9]{36,}/g,
    replacement: '[REDACTED:GITHUB_APP_TOKEN]',
  },
  // JWT tokens (three base64 segments separated by dots) - MUST be before bearer_token
  {
    name: 'jwt',
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    replacement: '[REDACTED:JWT]',
  },
  // Bearer tokens in headers (excluding already-matched JWTs)
  {
    name: 'bearer_token',
    pattern: /(?<=Bearer\s+)(?!eyJ)[A-Za-z0-9_.-]{20,}/gi,
    replacement: '[REDACTED:BEARER_TOKEN]',
  },
  // RSA Private Keys (explicitly requires "RSA " in header)
  {
    name: 'rsa_private_key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g,
    replacement: '[REDACTED:RSA_PRIVATE_KEY]',
  },
  // SSH Private Keys
  {
    name: 'ssh_private_key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g,
    replacement: '[REDACTED:SSH_PRIVATE_KEY]',
  },
  // PGP Private Keys
  {
    name: 'pgp_private_key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g,
    replacement: '[REDACTED:PGP_PRIVATE_KEY]',
  },
  // Generic private keys
  {
    name: 'generic_private_key',
    pattern:
      /-----BEGIN (?:EC |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
    replacement: '[REDACTED:PRIVATE_KEY]',
  },
  // Connection strings with passwords (MongoDB, PostgreSQL, MySQL, etc.)
  {
    name: 'connection_string',
    pattern: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    replacement: '[REDACTED:CONNECTION_STRING]',
  },
  // Password fields in JSON/YAML/env files
  // Excludes already-redacted values and known API key prefixes handled by other patterns
  {
    name: 'password_field',
    pattern:
      /(?<=["']?(?:password|passwd|pwd|secret)["']?\s*[=:]\s*["']?)(?!\[REDACTED)[^"'\s\n,}]{8,}(?=["']?)/gi,
    replacement: '[REDACTED:SECRET_VALUE]',
  },
  // Slack tokens
  {
    name: 'slack_token',
    pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
    replacement: '[REDACTED:SLACK_TOKEN]',
  },
  // Stripe keys
  {
    name: 'stripe_key',
    pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/g,
    replacement: '[REDACTED:STRIPE_KEY]',
  },
  // Discord tokens
  {
    name: 'discord_token',
    pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
    replacement: '[REDACTED:DISCORD_TOKEN]',
  },
  // npm tokens
  {
    name: 'npm_token',
    pattern: /npm_[A-Za-z0-9]{36}/g,
    replacement: '[REDACTED:NPM_TOKEN]',
  },
  // Sendgrid API keys
  {
    name: 'sendgrid_key',
    pattern: /SG\.[A-Za-z0-9\-_]{22,}\.[A-Za-z0-9\-_]{22,}/g,
    replacement: '[REDACTED:SENDGRID_KEY]',
  },
  // Twilio API keys
  {
    name: 'twilio_key',
    pattern: /SK[0-9a-fA-F]{32}/g,
    replacement: '[REDACTED:TWILIO_KEY]',
  },
  // Google API keys
  {
    name: 'google_api_key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    replacement: '[REDACTED:GOOGLE_API_KEY]',
  },
  // Heroku API keys (only match UUIDs in context of HEROKU_API_KEY assignment)
  {
    name: 'heroku_key',
    pattern:
      /(?<=HEROKU_API_KEY\s*[=:]\s*["']?)[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=["']?)/gi,
    replacement: '[REDACTED:HEROKU_API_KEY]',
  },
];

/**
 * Static class for secret detection and redaction
 *
 * @example
 * const content = "My API key is sk-1234567890abcdef";
 * const redacted = SecretRedactor.redact(content);
 * // redacted === "My API key is [REDACTED:OPENAI_KEY]"
 *
 * const stats = SecretRedactor.getLastRedactionStats();
 * // stats === { totalRedactions: 1, byPattern: { openai_key: 1 } }
 */
export class SecretRedactor {
  private static lastStats: RedactionStats = {
    totalRedactions: 0,
    byPattern: {},
  };

  /**
   * Redact secrets from content
   *
   * @param content - The content to redact secrets from
   * @returns Content with secrets replaced by redaction markers
   */
  static redact(content: string): string {
    if (!content) {
      this.lastStats = { totalRedactions: 0, byPattern: {} };
      return content;
    }

    const stats: RedactionStats = {
      totalRedactions: 0,
      byPattern: {},
    };

    let redacted = content;

    for (const { name, pattern, replacement } of SECRET_PATTERNS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;

      // Count matches before replacing
      const matches = redacted.match(pattern);
      if (matches) {
        const count = matches.length;
        stats.totalRedactions += count;
        stats.byPattern[name] = (stats.byPattern[name] || 0) + count;
      }

      // Perform replacement
      redacted = redacted.replace(pattern, replacement);
    }

    this.lastStats = stats;

    if (stats.totalRedactions > 0) {
      console.log(
        `[SecretRedactor] Redacted ${stats.totalRedactions} secret(s): ${Object.entries(
          stats.byPattern
        )
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`
      );
    }

    return redacted;
  }

  /**
   * Get statistics from the last redaction operation
   * Never includes actual secret values, only counts
   *
   * @returns Statistics about the last redaction
   */
  static getLastRedactionStats(): RedactionStats {
    return { ...this.lastStats };
  }

  /**
   * Quick check if content contains any secrets
   * More efficient than full redaction when you just need to know
   *
   * @param content - The content to check
   * @returns True if any secrets were detected
   */
  static containsSecrets(content: string): boolean {
    if (!content) {
      return false;
    }

    for (const { pattern } of SECRET_PATTERNS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get list of pattern names being checked
   * Useful for documentation/debugging
   *
   * @returns Array of pattern names
   */
  static getPatternNames(): string[] {
    return SECRET_PATTERNS.map((p) => p.name);
  }
}
