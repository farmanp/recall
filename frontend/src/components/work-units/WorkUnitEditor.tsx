/**
 * WorkUnitEditor Component
 *
 * Modal for editing work unit - adding/removing sessions manually.
 */

import React, { useState } from 'react';
import type { WorkUnit, WorkUnitSession } from '../../types/work-unit';
import { useUpdateWorkUnit, useDeleteWorkUnit } from '../../hooks/useWorkUnits';
import { AgentBadge } from '../AgentBadge';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface WorkUnitEditorProps {
  workUnit: WorkUnit;
  onClose: () => void;
  onDeleted?: () => void;
}

export function WorkUnitEditor({ workUnit, onClose, onDeleted }: WorkUnitEditorProps) {
  const [sessionIdToAdd, setSessionIdToAdd] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = useUpdateWorkUnit(workUnit.id);
  const deleteMutation = useDeleteWorkUnit();

  const handleAddSession = async () => {
    if (!sessionIdToAdd.trim()) return;

    try {
      await updateMutation.mutateAsync({
        action: 'add',
        sessionId: sessionIdToAdd.trim(),
      });
      setSessionIdToAdd('');
    } catch (err) {
      console.error('Failed to add session:', err);
    }
  };

  const handleRemoveSession = async (sessionId: string) => {
    try {
      await updateMutation.mutateAsync({
        action: 'remove',
        sessionId,
      });
    } catch (err) {
      console.error('Failed to remove session:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(workUnit.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error('Failed to delete work unit:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Edit Work Unit</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Work unit info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-2">{workUnit.name}</h3>
            <p className="text-sm text-gray-400">{workUnit.projectPath}</p>
          </div>

          {/* Add session */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add Session by ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sessionIdToAdd}
                onChange={(e) => setSessionIdToAdd(e.target.value)}
                placeholder="Session UUID"
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddSession}
                disabled={!sessionIdToAdd.trim() || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Sessions list */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sessions ({workUnit.sessions.length})
            </label>
            <div className="space-y-2">
              {workUnit.sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="flex items-center justify-between p-3 bg-gray-750 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <AgentBadge agent={session.agent} size="sm" />
                    <span className="text-sm text-gray-300 font-mono">
                      {session.sessionId.slice(0, 8)}...
                    </span>
                    {session.model && (
                      <span className="text-xs text-gray-500">{session.model}</span>
                    )}
                    <span className="text-xs text-gray-500">
                      Score: {(session.correlationScore * 100).toFixed(0)}%
                    </span>
                    {session.joinReason.includes('manual_override') && (
                      <span className="text-xs px-2 py-0.5 bg-purple-600 text-purple-100 rounded">
                        Manual
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveSession(session.sessionId)}
                    disabled={updateMutation.isPending || workUnit.sessions.length <= 1}
                    className="p-1.5 hover:bg-red-600/20 text-red-400 rounded transition-colors disabled:opacity-30"
                    title={
                      workUnit.sessions.length <= 1
                        ? 'Cannot remove last session'
                        : 'Remove session'
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-850">
          {confirmDelete ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Delete this work unit?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Work Unit
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkUnitEditor;
