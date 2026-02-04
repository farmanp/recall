/**
 * ModelBadge Component
 *
 * Displays AI model information in a styled badge.
 * Formats raw model strings into human-readable names.
 */

interface ModelBadgeProps {
  model?: string;
  size?: 'sm' | 'md';
}

/**
 * Format raw model string into human-readable display name
 *
 * Examples:
 * - "claude-opus-4-5-20251101" → "Opus 4.5"
 * - "claude-haiku-4-5-20251001" → "Haiku 4.5"
 * - "claude-sonnet-4-20250514" → "Sonnet 4"
 * - "o1" → "O1"
 * - "gpt-4o" → "GPT-4"
 * - "gemini-2.0-flash" → "Gemini 2.0 Flash"
 */
export function formatModelName(model: string | undefined): string | null {
  if (!model) return null;

  // Claude models: claude-opus-4-5-20251101 -> "Opus 4.5"
  // Also handles: claude-sonnet-4-20250514 -> "Sonnet 4"
  const claudeMatch = model.match(/claude-(\w+)-(\d+)(?:-(\d+))?/i);
  if (claudeMatch) {
    const [, variant, major, minor] = claudeMatch;
    const variantName = variant.charAt(0).toUpperCase() + variant.slice(1);
    // If minor version exists, show "Variant Major.Minor", otherwise just "Variant Major"
    return minor ? `${variantName} ${major}.${minor}` : `${variantName} ${major}`;
  }

  // Codex/OpenAI models: o1, o3, gpt-4o, etc.
  if (/^o[1-9]/.test(model)) {
    return model.toUpperCase();
  }
  if (model.includes('gpt-4')) {
    return 'GPT-4';
  }
  if (model.includes('gpt-3')) {
    return 'GPT-3.5';
  }

  // Gemini models: gemini-2.0-flash -> "Gemini 2.0 Flash"
  const geminiMatch = model.match(/gemini-(\d+\.\d+)-?(\w*)/i);
  if (geminiMatch) {
    const [, version, variant] = geminiMatch;
    const variantName = variant ? ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : '';
    return `Gemini ${version}${variantName}`;
  }

  // Fallback: return raw model name (truncated if too long)
  return model.length > 20 ? model.substring(0, 17) + '...' : model;
}

export function ModelBadge({ model, size = 'sm' }: ModelBadgeProps) {
  const displayName = formatModelName(model);
  if (!displayName) return null;

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`bg-gray-700/50 text-gray-300 ${sizeClass} rounded font-mono border border-gray-600/30`}
    >
      {displayName}
    </span>
  );
}

export default ModelBadge;
