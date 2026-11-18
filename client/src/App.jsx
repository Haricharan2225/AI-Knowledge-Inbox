import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import KnowledgeLibrary from './pages/KnowledgeLibrary';
import AddKnowledge from './pages/AddKnowledge';
import AIAssistant from './pages/AIAssistant';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'library' | 'add' | 'assistant'
  const [health, setHealth] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Poll or fetch system health
  const checkHealth = async () => {
    setIsRefreshing(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Health check warning:', err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const triggerGlobalRefresh = () => {
    checkHealth();
    setRefreshCounter((prev) => prev + 1);
  };

  const handleIngestionSuccess = () => {
    triggerGlobalRefresh();
  };

  return (
    <div className="min-h-screen bg-cream text-neutral-dark flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Layout Container */}
      <div className="flex-1 md:pl-72 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <Header
          activeTab={activeTab}
          onRefresh={triggerGlobalRefresh}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <Dashboard 
              setActiveTab={setActiveTab} 
              onRefreshTrigger={refreshCounter} 
            />
          )}

          {activeTab === 'library' && (
            <KnowledgeLibrary 
              setActiveTab={setActiveTab} 
              onRefreshTrigger={refreshCounter} 
            />
          )}

          {activeTab === 'add' && (
            <AddKnowledge 
              setActiveTab={setActiveTab} 
              onIngestionSuccess={handleIngestionSuccess} 
            />
          )}

          {activeTab === 'assistant' && (
            <AIAssistant />
          )}
        </main>
      </div>
    </div>
  );
}
