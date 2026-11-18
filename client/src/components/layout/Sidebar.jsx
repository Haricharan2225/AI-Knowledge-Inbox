import React from 'react';
import { 
  LayoutDashboard, 
  Library, 
  PlusCircle, 
  BotMessageSquare, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Database
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, health, isMobileOpen, setIsMobileOpen }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', label: 'Knowledge Library', icon: Library },
    { id: 'add', label: 'Add Knowledge', icon: PlusCircle },
    { id: 'assistant', label: 'AI Assistant', icon: BotMessageSquare },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  const isHealthy = health?.status === 'operational';

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-neutral-dark/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-cream border-r border-sand 
        flex flex-col justify-between p-6 transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Top: Brand Header */}
        <div className="space-y-8">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-orange flex items-center justify-center text-white shadow-soft-sand">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold text-neutral-dark tracking-tight">AI Knowledge</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-orange text-white px-1.5 py-0.5 rounded">Inbox</span>
              </div>
              <p className="text-[11px] font-semibold text-neutral-subtle">Turium AI Enterprise RAG</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-150
                    ${isActive 
                      ? 'bg-orange text-white shadow-soft-sand' 
                      : 'text-neutral-dark hover:bg-sand-100 hover:text-neutral-dark'}
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-body'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: System Status Pill */}
        <div className="pt-6 border-t border-sand-200">
          <div className="p-4 rounded-2xl bg-sand-100 border border-sand space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-orange" />
                <span className="text-xs font-bold text-neutral-dark">SQLite Engine</span>
              </div>
              {isHealthy ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-dark bg-white/80 px-2 py-0.5 rounded-full border border-sand">
                  <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-subtle bg-white/80 px-2 py-0.5 rounded-full border border-sand">
                  Offline
                </span>
              )}
            </div>

            <div className="text-[11px] text-neutral-body space-y-0.5 font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-subtle font-sans">Provider:</span>
                <span className="font-bold text-neutral-dark uppercase">
                  {health?.database?.vectorEngine?.activeProvider || 'deterministic'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-subtle font-sans">Vectors:</span>
                <span className="font-bold text-neutral-dark">
                  {health?.database?.counts?.embeddedChunks || 0} chunks
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-neutral-subtle font-medium">
            Turium AI Recruitment Project
          </p>
        </div>
      </aside>
    </>
  );
}
