/**
 * AppLayout Component
 *
 * Main application layout with collapsible sidebar navigation
 * Provides consistent structure across all pages
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'recall-sidebar-collapsed';

// Routes where sidebar should be hidden (e.g., shared sessions, full-screen player)
const SIDEBAR_HIDDEN_ROUTES = ['/shared/', '/session/'];

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to expanded on desktop, collapsed on smaller screens
    return window.innerWidth < 1024;
  });

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Check if sidebar should be hidden for this route
  const shouldHideSidebar = SIDEBAR_HIDDEN_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );

  const handleToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  // Render without sidebar for specific routes
  if (shouldHideSidebar) {
    return <div className="min-h-screen bg-forensic-bg-primary">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-forensic-bg-primary">
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggle} />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
};

export default AppLayout;
