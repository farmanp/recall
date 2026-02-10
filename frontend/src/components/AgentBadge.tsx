import { AgentType } from '../types/transcript';

const agentConfig: Record<
  AgentType,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  claude: {
    label: 'CLAUDE',
    color: 'text-agent-claude',
    bgColor: 'bg-agent-claude/10',
    borderColor: 'border-agent-claude/30',
  },
  codex: {
    label: 'CODEX',
    color: 'text-agent-codex',
    bgColor: 'bg-agent-codex/10',
    borderColor: 'border-agent-codex/30',
  },
  gemini: {
    label: 'GEMINI',
    color: 'text-agent-gemini',
    bgColor: 'bg-agent-gemini/10',
    borderColor: 'border-agent-gemini/30',
  },
  unknown: {
    label: 'UNKNOWN',
    color: 'text-forensic-text-muted',
    bgColor: 'bg-forensic-bg-tertiary',
    borderColor: 'border-forensic-border',
  },
};

interface AgentBadgeProps {
  agent?: AgentType;
  size?: 'sm' | 'md';
}

export function AgentBadge({ agent = 'unknown', size = 'sm' }: AgentBadgeProps) {
  const config = agentConfig[agent] || agentConfig.unknown;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`${config.bgColor} ${config.color} ${config.borderColor} ${sizeClass} border font-mono font-semibold uppercase tracking-wider`}
    >
      {config.label}
    </span>
  );
}

export default AgentBadge;
