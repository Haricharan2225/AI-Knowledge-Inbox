import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Layers, 
  Cpu, 
  Globe, 
  PlusCircle, 
  BotMessageSquare, 
  ArrowRight,
  Clock,
  Sparkles,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';

export default function Dashboard({ setActiveTab, onRefreshTrigger }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [onRefreshTrigger]);

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-sand border-t-orange rounded-full animate-spin" />
          <p className="text-sm font-semibold text-neutral-dark">Loading dashboard analytics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="p-6 rounded-3xl bg-neutral-surface border border-sand shadow-card-sand text-center space-y-4">
          <p className="text-sm font-bold text-neutral-dark">Failed to load Dashboard statistics</p>
          <p className="text-xs text-neutral-body">{error}</p>
          <button
            onClick={loadStats}
            className="px-5 py-2.5 rounded-xl bg-orange text-white text-xs font-semibold hover:bg-orange-hover transition-colors shadow-soft-sand"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const counts = stats?.counts || {};
  const recentItems = stats?.recentItems || [];
  const recentActivity = stats?.recentActivity || [];

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-subtle">Saved Knowledge</span>
            <div className="w-9 h-9 rounded-xl bg-sand-100 flex items-center justify-center text-orange border border-sand">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-neutral-dark tracking-tight">{counts.totalItems || 0}</h3>
            <p className="text-xs text-neutral-body mt-1">
              <span className="font-semibold text-neutral-dark">{counts.notes || 0}</span> notes • <span className="font-semibold text-neutral-dark">{counts.urls || 0}</span> web URLs
            </p>
          </div>
        </div>

        {/* Total Chunks */}
        <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-subtle">Segmented Chunks</span>
            <div className="w-9 h-9 rounded-xl bg-sand-100 flex items-center justify-center text-orange border border-sand">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-neutral-dark tracking-tight">{counts.totalChunks || 0}</h3>
            <p className="text-xs text-neutral-body mt-1">~500 chars with 100 char sliding overlap</p>
          </div>
        </div>

        {/* Vector Embeddings */}
        <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-subtle">Vector Embeddings</span>
            <div className="w-9 h-9 rounded-xl bg-sand-100 flex items-center justify-center text-orange border border-sand">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-neutral-dark tracking-tight">{counts.embeddedChunks || 0}</h3>
            <p className="text-xs text-neutral-body mt-1">
              {counts.missingEmbeddings === 0 ? '100% vector coverage' : `${counts.missingEmbeddings} missing vectors`}
            </p>
          </div>
        </div>

        {/* Active Engine */}
        <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-subtle">Vector Search Engine</span>
            <div className="w-9 h-9 rounded-xl bg-orange text-white flex items-center justify-center shadow-soft-sand">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-extrabold text-neutral-dark tracking-tight uppercase">
              {stats?.vectorEngine?.activeProvider || 'DETERMINISTIC'}
            </h3>
            <p className="text-xs text-neutral-body mt-1">Cosine Similarity in SQLite</p>
          </div>
        </div>
      </div>

      {/* Quick Action Banner */}
      <div className="bg-sand-100 border border-sand rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-card-sand">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold text-neutral-dark tracking-tight">
            Ready to explore your Knowledge Inbox?
          </h2>
          <p className="text-sm text-neutral-body max-w-2xl">
            Save new articles and notes, browse segmented chunks, or ask the AI Assistant questions grounded in your saved data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('add')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange hover:bg-orange-hover text-white text-sm font-semibold transition-all duration-200 shadow-soft-sand"
          >
            <PlusCircle className="w-4 h-4" />
            Add Knowledge
          </button>

          <button
            onClick={() => setActiveTab('assistant')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-cream text-neutral-dark text-sm font-semibold border border-sand transition-all duration-200 shadow-card-sand"
          >
            <BotMessageSquare className="w-4 h-4 text-orange" />
            Ask AI Assistant
          </button>
        </div>
      </div>

      {/* Two Column Layout: Recent Items & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Ingested Items */}
        <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand space-y-4">
          <div className="flex items-center justify-between border-b border-sand pb-4">
            <div className="flex items-center space-x-2.5">
              <BookOpen className="w-5 h-5 text-orange" />
              <h3 className="text-base font-bold text-neutral-dark">Recent Knowledge Documents</h3>
            </div>
            <button
              onClick={() => setActiveTab('library')}
              className="text-xs font-bold text-orange hover:text-orange-dark inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentItems.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-neutral-dark font-semibold">No knowledge items saved yet.</p>
              <p className="text-xs text-neutral-subtle">Ingest your first note or URL to populate the inbox.</p>
            </div>
          ) : (
            <div className="divide-y divide-sand-200">
              {recentItems.map((item) => (
                <div key={item.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`
                        text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border
                        ${item.type === 'url' 
                          ? 'bg-sand-100 text-neutral-dark border-sand' 
                          : 'bg-white text-neutral-dark border-sand'}
                      `}>
                        {item.type}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-dark truncate">{item.title}</h4>
                    </div>

                    {item.url && (
                      <p className="text-xs text-neutral-subtle font-mono truncate flex items-center gap-1">
                        <Globe className="w-3 h-3 shrink-0" />
                        {item.url}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-semibold text-neutral-dark bg-sand-100 px-2 py-0.5 rounded border border-sand">
                      {item.chunkCount} chunks
                    </span>
                    <p className="text-[10px] text-neutral-subtle mt-1">{item.createdAt.substring(0, 10)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operational Activity Feed */}
        <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand space-y-4">
          <div className="flex items-center justify-between border-b border-sand pb-4">
            <div className="flex items-center space-x-2.5">
              <Clock className="w-5 h-5 text-orange" />
              <h3 className="text-base font-bold text-neutral-dark">Operational Audit Activity</h3>
            </div>
            <span className="text-xs font-semibold text-neutral-subtle font-mono">SQLite `logs`</span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-neutral-dark font-semibold">No operational logs recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-sand-200">
              {recentActivity.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-bold text-neutral-dark truncate">{log.message}</p>
                    <p className="text-[11px] font-mono text-neutral-subtle">{log.timestamp}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-orange bg-sand-100 px-2 py-0.5 rounded border border-sand">
                    {log.level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
