/**
 * ArtifactToolbar Component
 *
 * Provides search, sort, filter, and export controls for the artifacts panel.
 * Compact horizontal layout with dark theme styling.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, SortAsc, Filter, Download } from 'lucide-react';
import type { ArtifactSortOption, ArtifactFilters, ExportFormat } from '../../types/artifacts';

interface ArtifactToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: ArtifactSortOption;
  onSortChange: (sort: ArtifactSortOption) => void;
  filters: ArtifactFilters;
  onFiltersChange: (filters: ArtifactFilters) => void;
  onExport: (format: ExportFormat) => void;
}

const SORT_OPTIONS: { value: ArtifactSortOption; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recent' },
  { value: 'type', label: 'Type' },
];

const EXPORT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'csv', label: 'CSV' },
];

export const ArtifactToolbar: React.FC<ArtifactToolbarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  onExport,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  const handleFilterToggle = (filterKey: keyof ArtifactFilters) => {
    onFiltersChange({
      ...filters,
      [filterKey]: !filters[filterKey],
    });
  };

  const handleExport = (format: ExportFormat) => {
    onExport(format);
    setShowExportMenu(false);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 border-b border-gray-700">
      {/* Search Input */}
      <div className="relative flex-1 min-w-0 max-w-xs">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files..."
          className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-1.5">
        <SortAsc className="w-4 h-4 text-gray-500" />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as ArtifactSortOption)}
          className="bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 py-1 px-2 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex gap-1">
          <button
            onClick={() => handleFilterToggle('showCreated')}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              filters.showCreated
                ? 'bg-green-900/50 border-green-700 text-green-400'
                : 'bg-gray-900 border-gray-700 text-gray-500'
            }`}
            title="Toggle created files"
          >
            Created
          </button>
          <button
            onClick={() => handleFilterToggle('showModified')}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              filters.showModified
                ? 'bg-yellow-900/50 border-yellow-700 text-yellow-400'
                : 'bg-gray-900 border-gray-700 text-gray-500'
            }`}
            title="Toggle modified files"
          >
            Modified
          </button>
          <button
            onClick={() => handleFilterToggle('showReadOnly')}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              filters.showReadOnly
                ? 'bg-blue-900/50 border-blue-700 text-blue-400'
                : 'bg-gray-900 border-gray-700 text-gray-500'
            }`}
            title="Toggle read-only files"
          >
            Read
          </button>
        </div>
      </div>

      {/* Export Dropdown */}
      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center gap-1.5 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 hover:border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          title="Export artifacts"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
        {showExportMenu && (
          <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg z-10 min-w-[100px]">
            {EXPORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleExport(option.value)}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-800 first:rounded-t last:rounded-b"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
