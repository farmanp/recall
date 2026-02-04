/**
 * HelpPanel Component
 *
 * Modal overlay showing all available keyboard shortcuts
 * Press ? to toggle, Escape to close
 */

import React, { useEffect } from 'react';

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
      title: 'Other',
      shortcuts: [
        { key: 'c', description: 'Toggle compression (skip gaps)' },
        { key: 's', description: 'Toggle statistics panel' },
        { key: '?', description: 'Toggle this help panel' },
        { key: 'Esc', description: 'Close panels' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-800 border-2 border-gray-600 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-300">{shortcut.description}</span>
                      <kbd className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-200">
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
        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
