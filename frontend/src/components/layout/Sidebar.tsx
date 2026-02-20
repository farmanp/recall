/**
 * Sidebar Component
 *
 * Collapsible navigation sidebar with Overview, Folders, and Sessions
 * Maintains forensic/terminal aesthetic
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Folder, List, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { SidebarFilters } from './SidebarFilters';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  liveCount?: number;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: number;
  badgePulse?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, collapsed, badge, badgePulse }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
          isActive
            ? 'bg-forensic-bg-tertiary text-accent-green'
            : 'text-forensic-text-secondary hover:text-forensic-text-primary hover:bg-forensic-bg-tertiary/50'
        } ${collapsed ? 'justify-center' : ''}`
      }
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 font-mono text-sm">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                badgePulse
                  ? 'bg-accent-green/20 text-accent-green animate-pulse'
                  : 'bg-forensic-bg-primary text-forensic-text-muted'
              }`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, liveCount = 0 }) => {
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-forensic-bg-secondary border-r border-forensic-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-forensic-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-red" />
              <div className="w-2.5 h-2.5 rounded-full bg-accent-amber" />
              <div className="w-2.5 h-2.5 rounded-full bg-accent-green" />
            </div>
            <span className="font-mono text-accent-green font-medium">recall</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded hover:bg-forensic-bg-tertiary text-forensic-text-muted hover:text-forensic-text-primary transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <NavItem
          to="/"
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Overview"
          collapsed={collapsed}
        />
        <NavItem
          to="/sessions"
          icon={<List className="w-5 h-5" />}
          label="Sessions"
          collapsed={collapsed}
          badge={liveCount}
          badgePulse={liveCount > 0}
        />
        <NavItem
          to="/folders"
          icon={<Folder className="w-5 h-5" />}
          label="Folders"
          collapsed={collapsed}
        />
      </nav>

      {/* Filters */}
      <SidebarFilters collapsed={collapsed} />

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-forensic-border">
          <div className="flex items-center gap-2 text-xs font-mono text-forensic-text-muted">
            <Radio className="w-3 h-3" />
            <span>Cmd+K to search</span>
          </div>
        </div>
      )}
    </motion.aside>
  );
};

export default Sidebar;
