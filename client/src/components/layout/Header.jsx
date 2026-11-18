import React from 'react';
import { Menu, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Header({ activeTab, onRefresh, isRefreshing, onOpenMobileMenu }) {
  const titles = {
    dashboard: {
      title: 'Dashboard Overview',
      subtitle: 'Knowledge storage, chunk vectorization, and operational activity metrics.',
    },
    library: {
      title: 'Knowledge Library',
      subtitle: 'Browse, inspect, search, and manage ingested notes and crawled URLs.',
    },
    add: {
      title: 'Add Knowledge',
      subtitle: 'Ingest raw text notes or crawl public website URLs with automated chunking.',
    },
    assistant: {
      title: 'AI Knowledge Assistant',
      subtitle: 'Ask questions grounded strictly in saved knowledge with source citations.',
    },
  };

  const current = titles[activeTab] || titles.dashboard;

  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur-md border-b border-sand px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl bg-sand-100 hover:bg-sand border border-sand text-neutral-dark"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-neutral-dark tracking-tight">
            {current.title}
          </h1>
          <p className="text-xs text-neutral-body font-medium hidden sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sand-100 hover:bg-sand text-neutral-dark text-xs font-semibold border border-sand transition-all duration-150 disabled:opacity-50"
          title="Refresh application data"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-sand text-xs font-bold text-neutral-dark">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span className="hidden sm:inline">RAG Active</span>
        </span>
      </div>
    </header>
  );
}
