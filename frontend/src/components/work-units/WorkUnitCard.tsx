/**
 * WorkUnitCard - Displays a work unit as a card in the list view
 * Forensic/terminal aesthetic design
 */

import { Link } from 'react-router-dom';
import type { WorkUnit, WorkUnitConfidence } from '../../types/work-unit';
import type { AgentType } from '../../types/transcript';
import { AgentBadge } from '../AgentBadge';
import { Clock, FileText, Layers, Activity } from 'lucide-react';

interface WorkUnitCardProps {
  workUnit: WorkUnit;
}

const confidenceConfig: Record<
  WorkUnitConfidence,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  high: {
    label: 'HIGH',
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/10',
    borderColor: 'border-accent-green/30',
  },
  medium: {
    label: 'MED',
    color: 'text-accent-amber',
    bgColor: 'bg-accent-amber/10',
    borderColor: 'border-accent-amber/30',
  },
  low: {
    label: 'LOW',
    color: 'text-forensic-text-muted',
    bgColor: 'bg-forensic-bg-tertiary',
    borderColor: 'border-forensic-border',
  },
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
    <span
      className={`${config.bgColor} ${config.color} px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide border ${config.borderColor}`}
    >
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
      className="group block bg-forensic-bg-secondary border border-forensic-border hover:border-accent-purple/50 transition-all overflow-hidden"
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-red"></div>
          <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
          <div className="w-3 h-3 rounded-full bg-accent-green"></div>
        </div>
        <div className="flex items-center gap-2">
          {agents.map((agent) => (
            <AgentBadge key={agent} agent={agent} size="sm" />
          ))}
        </div>
        <ConfidenceBadge confidence={workUnit.confidence} />
      </div>

      {/* Card Body */}
      <div className="p-5">
        {/* Work Unit ID & Name */}
        <div className="flex items-start gap-3 mb-3">
          <span className="font-mono text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/30 px-2 py-0.5 shrink-0">
            WU-{workUnit.id.slice(0, 6).toUpperCase()}
          </span>
          <h3
            className="font-mono text-base text-forensic-text-primary group-hover:text-accent-purple transition-colors truncate leading-tight"
            title={workUnit.name}
          >
            {workUnit.name}
          </h3>
        </div>

        {/* Project Path */}
        <p
          className="font-mono text-xs text-forensic-text-muted truncate mb-4"
          title={workUnit.projectPath}
        >
          {workUnit.projectPath}
        </p>

        {/* Preview - Command Style */}
        <div className="bg-forensic-bg-primary border border-forensic-border p-3 mb-4">
          <div className="flex items-start gap-2 font-mono text-xs">
            <span className="text-accent-green shrink-0">$</span>
            <p className="text-forensic-text-secondary line-clamp-2 leading-relaxed">
              {truncatedPreview}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 font-mono text-[10px] text-forensic-text-muted uppercase tracking-wide mb-4">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(workUnit.totalDuration)}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {workUnit.totalFrames} frames
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-forensic-border">
          <span className="font-mono text-[10px] text-forensic-text-muted uppercase tracking-wide">
            {formatRelativeTime(workUnit.startTime)}
          </span>
          <span className="font-mono text-xs text-forensic-text-muted group-hover:text-accent-purple transition-colors">
            &gt;
          </span>
        </div>
      </div>
    </Link>
  );
}

export default WorkUnitCard;
