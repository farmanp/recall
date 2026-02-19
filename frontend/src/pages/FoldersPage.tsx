/**
 * FoldersPage Component
 *
 * Browse sessions organized by project folder
 * Provides hierarchical navigation of projects
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderOpen, ChevronRight, Activity, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFolderStats } from '../hooks/useTranscriptApi';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

export const FoldersPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useFolderStats();

  const folders = data?.folders ?? [];

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleFolderClick = (folderPath: string) => {
    // Navigate to sessions page with folder filter
    const encodedPath = encodeURIComponent(folderPath);
    navigate(`/sessions?project=${encodedPath}`);
  };

  return (
    <div className="min-h-screen bg-forensic-bg-primary p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-mono font-medium text-forensic-text-primary mb-1">Folders</h1>
        <p className="text-forensic-text-muted font-mono text-sm">
          Browse sessions by project directory
        </p>
      </header>

      {/* Folder List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : folders.length === 0 ? (
        <div className="bg-forensic-bg-secondary border border-forensic-border rounded-lg p-8 text-center">
          <Folder className="w-12 h-12 text-forensic-text-muted mx-auto mb-4" />
          <p className="text-forensic-text-muted font-mono">No project folders found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map((folder, index) => (
            <motion.button
              key={folder.path}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleFolderClick(folder.path)}
              className="w-full flex items-center gap-4 p-4 bg-forensic-bg-secondary border border-forensic-border rounded-lg hover:border-accent-green/50 hover:bg-forensic-bg-tertiary/50 transition-colors group text-left"
            >
              {/* Folder icon */}
              <div className="text-accent-amber group-hover:text-accent-green transition-colors">
                <FolderOpen className="w-5 h-5" />
              </div>

              {/* Folder info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-forensic-text-primary truncate">
                    {folder.name}
                  </span>
                  {folder.liveCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-accent-green/20 text-accent-green rounded animate-pulse">
                      {folder.liveCount} LIVE
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-forensic-text-muted truncate">
                  {folder.path}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs font-mono text-forensic-text-muted">
                <div className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{folder.sessionCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(folder.lastActivity)}</span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-forensic-text-muted group-hover:text-accent-green transition-colors" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FoldersPage;
