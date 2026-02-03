/**
 * EventDisplay Component
 *
 * Router component for event type rendering
 * Detects gaps and routes to PromptCard or ObservationCard
 */

import React from 'react';
import type { SessionEvent } from '@/types';
import { PromptCard } from './PromptCard';
import { ObservationCard } from './ObservationCard';
// import { GapIndicator } from './GapIndicator'; // Phase 2

export interface EventDisplayProps {
  event: SessionEvent;
  index: number;
  expanded?: boolean;
  isCurrent?: boolean; // Phase 2
  onToggleExpand?: () => void;
  onClick?: () => void; // Phase 2
}

export const EventDisplay: React.FC<EventDisplayProps> = ({
  event,
  index,
  expanded = false,
  isCurrent = false,
  onToggleExpand,
  onClick,
}) => {
  // Phase 2: Gap detection
  // const gap = detectGap(events[index - 1], event);

  return (
    <>
      {/* Phase 2: Show gap indicator if gap detected */}
      {/* {gap && <GapIndicator gap={gap} />} */}

      {/* Route to appropriate card based on event type */}
      {event.event_type === 'prompt' ? (
        <PromptCard
          event={event}
          index={index}
          expanded={expanded}
          isCurrent={isCurrent}
          onToggleExpand={onToggleExpand}
          onClick={onClick}
        />
      ) : (
        <ObservationCard
          event={event}
          index={index}
          expanded={expanded}
          isCurrent={isCurrent}
          onToggleExpand={onToggleExpand}
          onClick={onClick}
        />
      )}
    </>
  );
};
