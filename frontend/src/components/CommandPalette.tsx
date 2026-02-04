import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, History, Layout, FileText, ChevronRight, Calculator, HelpCircle } from 'lucide-react';
import { useSessions } from '../hooks/useTranscriptApi';
import type { SessionMetadata } from '../types/transcript';
import { AgentBadge } from './AgentBadge';

export const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    const { data } = useSessions({ limit: 50, offset: 0 });
    const sessions = data?.sessions || [];

    const filteredSessions = sessions.filter(s =>
        s.slug.toLowerCase().includes(search.toLowerCase()) ||
        s.project.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);

    const togglePalette = useCallback(() => {
        setIsOpen(prev => !prev);
        setSearch('');
        setSelectedIndex(0);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                togglePalette();
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, togglePalette]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 10);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isOpen]);

    const handleSelect = (session: SessionMetadata) => {
        navigate(`/session/${session.sessionId}`);
        setIsOpen(false);
    };

    const handleDeepSearch = () => {
        navigate(`/?q=${encodeURIComponent(search)}&mode=content`);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const totalItems = filteredSessions.length + (search.length > 2 ? 1 : 0) + 2; // +2 for static actions

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % totalItems);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        } else if (e.key === 'Enter') {
            if (selectedIndex < filteredSessions.length) {
                handleSelect(filteredSessions[selectedIndex]);
            } else {
                let currentIdx = filteredSessions.length;
                if (search.length > 2) {
                    if (selectedIndex === currentIdx) {
                        handleDeepSearch();
                        return;
                    }
                    currentIdx++;
                }

                if (selectedIndex === currentIdx) {
                    navigate('/');
                    setIsOpen(false);
                } else if (selectedIndex === currentIdx + 1) {
                    window.open('https://github.com/farmanp/recall', '_blank');
                    setIsOpen(false);
                }
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-[100]"
                    />
                    <div className="fixed inset-0 flex items-start justify-center pt-[15vh] pointer-events-none z-[101]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 pointer-events-auto overflow-hidden flex flex-col"
                        >
                            {/* SearchBar */}
                            <div className="flex items-center px-4 py-4 border-b border-gray-100 dark:border-gray-800">
                                <Search className="w-5 h-5 text-gray-400 mr-3" />
                                <input
                                    ref={inputRef}
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a command or search sessions..."
                                    className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 dark:text-gray-100 placeholder-gray-400 font-medium"
                                />
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Esc</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
                                {/* Sessions Section */}
                                <div className="mb-2">
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <History className="w-3 h-3" /> Recent Sessions
                                    </div>
                                    {filteredSessions.length > 0 ? (
                                        filteredSessions.map((session, idx) => (
                                            <button
                                                key={session.sessionId}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                onClick={() => handleSelect(session)}
                                                className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl text-left transition-all ${selectedIndex === idx
                                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                    }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all ${selectedIndex === idx ? 'bg-white border-blue-200 dark:bg-gray-800' : 'bg-gray-50 border-gray-100 dark:bg-gray-900 dark:border-gray-800'
                                                    }`}>
                                                    <FileText className={`w-5 h-5 ${selectedIndex === idx ? 'text-blue-500' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                                                            {session.slug}
                                                        </span>
                                                        <AgentBadge agent={session.agent} />
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                                                        <span>{session.project.split('/').pop()}</span>
                                                        <span>•</span>
                                                        <span>{new Date(session.startTime).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                {selectedIndex === idx && (
                                                    <ChevronRight className="w-4 h-4 text-blue-500" />
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-8 text-center text-gray-500">
                                            No sessions found for "{search}"
                                        </div>
                                    )}
                                </div>

                                {/* Actions Section */}
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <Command className="w-3 h-3" /> Actions
                                    </div>

                                    {search.length > 2 && (
                                        <button
                                            onMouseEnter={() => setSelectedIndex(filteredSessions.length)}
                                            onClick={handleDeepSearch}
                                            className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl text-left transition-all ${selectedIndex === filteredSessions.length
                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                }`}
                                        >
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-800">
                                                <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                    Deep Search Content <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase">New</span>
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">Search for "{search}" across all session logs</div>
                                            </div>
                                        </button>
                                    )}

                                    <button
                                        onMouseEnter={() => setSelectedIndex(filteredSessions.length + (search.length > 2 ? 1 : 0))}
                                        onClick={() => { navigate('/'); setIsOpen(false); }}
                                        className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl text-left transition-all ${selectedIndex === (filteredSessions.length + (search.length > 2 ? 1 : 0))
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }`}
                                    >
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                            <Layout className="w-5 h-5 text-gray-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-gray-100">All Sessions</div>
                                            <div className="text-xs text-gray-500">Go to the session list dashboard</div>
                                        </div>
                                    </button>

                                    <button
                                        onMouseEnter={() => setSelectedIndex(filteredSessions.length + (search.length > 2 ? 1 : 0) + 1)}
                                        onClick={() => { window.open('https://github.com/farmanp/recall', '_blank'); setIsOpen(false); }}
                                        className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl text-left transition-all ${selectedIndex === (filteredSessions.length + (search.length > 2 ? 1 : 0) + 1)
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }`}
                                    >
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                            <HelpCircle className="w-5 h-5 text-gray-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-gray-100">Documentation</div>
                                            <div className="text-xs text-gray-500">Learn how to use Recall effectively</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest font-mono">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</span> Select
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</span> Confirm
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    Recall Palette v1.0
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
