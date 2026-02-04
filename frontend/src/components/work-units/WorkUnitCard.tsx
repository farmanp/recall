/**
 * WorkUnitCard - Displays a work unit as a card in the list view
 */

import { Link } from 'react-router-dom';
import type { WorkUnit, WorkUnitConfidence } from '../../types/work-unit';
import type { AgentType } from '../../types/transcript';
import { AgentBadge } from '../AgentBadge';

interface WorkUnitCardProps {
  workUnit: WorkUnit;
}

const confidenceConfig: Record<
  WorkUnitConfidence,
  { label: string; color: string; bgColor: string }
> = {
  high: { label: 'High', color: 'text-green-100', bgColor: 'bg-green-700' },
  medium: { label: 'Medium', color: 'text-yellow-100', bgColor: 'bg-yellow-700' },
  low: { label: 'Low', color: 'text-gray-100', bgColor: 'bg-gray-600' },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function ConfidenceBadge({ confidence }: { confidence: WorkUnitConfidence }) {
  const config = confidenceConfig[confidence];
  return (
    <span className={`${config.bgColor} ${config.color} px-2 py-0.5 text-xs rounded font-medium`}>
      {config.label}
    </span>
  );
}

export function WorkUnitCard({ workUnit }: WorkUnitCardProps) {
  const { sessions, agents } = workUnit;

  // Get first user message as preview
  const preview = sessions[0]?.firstUserMessage || workUnit.name;
  const truncatedPreview = preview.length > 150 ? preview.slice(0, 150) + '...' : preview;

  return (
    <Link
      to={`/work-units/${workUnit.id}`}
      className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-lg truncate" title={workUnit.name}>
            {workUnit.name}
          </h3>
          <p className="text-gray-400 text-sm truncate" title={workUnit.projectPath}>
            {workUnit.projectPath}
          </p>
        </div>
        <ConfidenceBadge confidence={workUnit.confidence} />
      </div>

      {/* Preview */}
      <p className="text-gray-300 text-sm mb-4 line-clamp-2">{truncatedPreview}</p>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {formatDuration(workUnit.totalDuration)}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          {workUnit.totalFrames} frames
        </span>
      </div>

      {/* Footer: Agents and time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {agents.map((agent) => (
            <AgentBadge key={agent} agent={agent} size="sm" />
          ))}
        </div>
        <span className="text-gray-500 text-sm">{formatRelativeTime(workUnit.startTime)}</span>
      </div>
    </Link>
  );
}

export default WorkUnitCard;
