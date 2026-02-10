/**
 * HelpPanel Component
 *
 * Modal overlay showing all available keyboard shortcuts
 * Forensic terminal aesthetic
 * Press ? to toggle, Escape to close
 */

import React, { useEffect } from 'react';
import { Keyboard } from 'lucide-react';

interface HelpPanelProps {
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Playback',
      shortcuts: [
        { key: 'Space', description: 'Play / Pause' },
        { key: '1', description: 'Speed 0.25x' },
        { key: '2', description: 'Speed 0.5x' },
        { key: '3', description: 'Speed 1x (normal)' },
        { key: '4', description: 'Speed 2x' },
        { key: '5', description: 'Speed 5x' },
      ],
    },
    {
      title: 'Navigation',
      shortcuts: [
        { key: '→', description: 'Next frame' },
        { key: '←', description: 'Previous frame' },
        { key: 'Home', description: 'First frame' },
        { key: 'End', description: 'Last frame' },
      ],
    },
    {
      title: 'Search',
      shortcuts: [
        { key: 'n', description: 'Next search match' },
        { key: 'p', description: 'Previous search match' },
      ],
    },
    {
      title: 'Panels',
      shortcuts: [
        { key: 'a', description: 'Toggle file artifacts sidebar' },
        { key: 'c', description: 'Toggle compression (skip gaps)' },
        { key: 'd', description: 'Toggle CLAUDE.md panel' },
        { key: 'f', description: 'Toggle frame filters panel' },
        { key: 's', description: 'Toggle statistics panel' },
        { key: '?', description: 'Toggle this help panel' },
        { key: 'Esc', description: 'Close panels / Go back' },
      ],
    },
    {
      title: 'Jump',
      shortcuts: [
        { key: 'u', description: 'Next User frame' },
        { key: 't', description: 'Next Tool frame' },
        { key: 'r', description: 'Next Response frame' },
        { key: 'm', description: 'Next Thinking frame' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-forensic-bg-secondary border border-forensic-border max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-forensic-bg-tertiary border-b border-forensic-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent-red"></div>
            <div className="w-3 h-3 rounded-full bg-accent-amber"></div>
            <div className="w-3 h-3 rounded-full bg-accent-green"></div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-forensic-text-secondary uppercase tracking-wide">
            <Keyboard className="w-4 h-4" />
            Keyboard Shortcuts
          </div>
          <button
            onClick={onClose}
            className="text-forensic-text-muted hover:text-forensic-text-primary text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="font-mono text-xs text-accent-green uppercase tracking-wide mb-3">
                  // {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between font-mono text-sm"
                    >
                      <span className="text-forensic-text-secondary">{shortcut.description}</span>
                      <kbd className="px-2 py-1 bg-forensic-bg-tertiary border border-forensic-border text-xs text-accent-amber">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-forensic-border flex justify-between items-center">
          <span className="font-mono text-xs text-forensic-text-muted">
            Press{' '}
            <kbd className="px-1 bg-forensic-bg-tertiary border border-forensic-border text-accent-amber">
              ?
            </kbd>{' '}
            to toggle
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-forensic-bg-tertiary hover:bg-forensic-border text-forensic-text-secondary border border-forensic-border font-mono text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
