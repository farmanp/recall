import { AgentType } from '../types/transcript';

const agentConfig: Record<AgentType, { label: string; color: string; bgColor: string }> = {
  claude: { label: 'Claude', color: 'text-orange-100', bgColor: 'bg-orange-600' },
  codex: { label: 'Codex', color: 'text-green-100', bgColor: 'bg-green-600' },
  gemini: { label: 'Gemini', color: 'text-blue-100', bgColor: 'bg-blue-600' },
  unknown: { label: 'Unknown', color: 'text-gray-100', bgColor: 'bg-gray-600' },
};

interface AgentBadgeProps {
  agent?: AgentType;
  size?: 'sm' | 'md';
}

export function AgentBadge({ agent = 'unknown', size = 'sm' }: AgentBadgeProps) {
  const config = agentConfig[agent] || agentConfig.unknown;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`${config.bgColor} ${config.color} ${sizeClass} rounded font-medium`}>
      {config.label}
    </span>
  );
}

export default AgentBadge;
