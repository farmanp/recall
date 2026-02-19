/**
 * ActivityHeatmap Component
 *
 * GitHub-style contribution heatmap showing session activity
 * over the last 30 days
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ActivityHeatmapProps {
  activityByDay: Array<{ date: string; count: number }>;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ activityByDay }) => {
  // Calculate max count for intensity scaling
  const maxCount = useMemo(() => {
    return Math.max(1, ...activityByDay.map((d) => d.count));
  }, [activityByDay]);

  // Generate weeks array (last 4 weeks + current partial week)
  const weeks = useMemo(() => {
    // Create a map for quick lookup
    const activityMap = new Map(activityByDay.map((d) => [d.date, d.count]));

    // Generate last 28 days (4 weeks)
    const days: Array<{ date: string; count: number; dayOfWeek: number }> = [];
    const today = new Date();

    for (let i = 27; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        count: activityMap.get(dateStr) || 0,
        dayOfWeek: date.getDay(),
      });
    }

    // Group into weeks (Sun-Sat)
    const weekGroups: (typeof days)[] = [];
    let currentWeek: typeof days = [];

    for (const day of days) {
      if (day.dayOfWeek === 0 && currentWeek.length > 0) {
        weekGroups.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) {
      weekGroups.push(currentWeek);
    }

    return weekGroups;
  }, [activityByDay]);

  // Get intensity level (0-4) based on count
  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  // Color mapping for intensity levels
  const getColor = (intensity: number): string => {
    switch (intensity) {
      case 0:
        return 'bg-forensic-bg-tertiary';
      case 1:
        return 'bg-accent-green/20';
      case 2:
        return 'bg-accent-green/40';
      case 3:
        return 'bg-accent-green/60';
      case 4:
        return 'bg-accent-green';
      default:
        return 'bg-forensic-bg-tertiary';
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm text-forensic-text-primary">Activity (Last 28 Days)</h3>
        <div className="flex items-center gap-1 text-xs font-mono text-forensic-text-muted">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-sm ${getColor(i)}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="w-3 h-3 text-[8px] font-mono text-forensic-text-muted flex items-center justify-center"
            >
              {i % 2 === 1 ? label : ''}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {/* Pad the first week if it doesn't start on Sunday */}
            {weekIndex === 0 &&
              week[0]?.dayOfWeek > 0 &&
              Array.from({ length: week[0].dayOfWeek }).map((_, i) => (
                <div key={`pad-${i}`} className="w-3 h-3" />
              ))}
            {week.map((day, dayIndex) => {
              const intensity = getIntensity(day.count);
              return (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (weekIndex * 7 + dayIndex) * 0.01 }}
                  className={`w-3 h-3 rounded-sm ${getColor(intensity)} cursor-pointer transition-transform hover:scale-125`}
                  title={`${formatDate(day.date)}: ${day.count} session${day.count !== 1 ? 's' : ''}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-forensic-border">
        <div className="text-xs font-mono">
          <span className="text-forensic-text-muted">Total: </span>
          <span className="text-forensic-text-primary">
            {activityByDay.reduce((sum, d) => sum + d.count, 0)}
          </span>
        </div>
        <div className="text-xs font-mono">
          <span className="text-forensic-text-muted">Peak: </span>
          <span className="text-forensic-text-primary">{maxCount}</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
