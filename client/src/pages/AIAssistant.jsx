import React, { useState } from 'react';
import { 
  Send, 
  Sparkles, 
  BotMessageSquare, 
  User, 
  ExternalLink, 
  FileText, 
  Layers, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I am your AI Knowledge Inbox Assistant. I can answer questions strictly grounded in your saved notes and web documents with explicit source citations. What would you like to know?",
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});

  const samplePrompts = [
    'What architecture does Turium AI Platform use, and how does it prevent hallucinations?',
    'How does cosine similarity work in vector search?',
    'What security controls are implemented against SSRF attacks?',
    'What is the recipe for chocolate sourdough croissants in France?', // Out of context test!
  ];

  const toggleSourceExpand = (messageId, sourceIndex) => {
    const key = `${messageId}-${sourceIndex}`;
    setExpandedSources((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e, customText) => {
    if (e) e.preventDefault();
    const queryText = (customText || inputQuery).trim();
    if (!queryText || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await api.query({
        question: queryText,
        topK: 4,
        minSimilarity: 0.05,
      });

      if (res.success) {
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: res.data.answer,
          sources: res.data.sources || [],
          metrics: res.data.metrics,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        isError: true,
        text: `Error querying knowledge base: ${err.message}`,
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Render highlighted answer text replacing [Source X] with nice chips
  const renderFormattedAnswer = (text) => {
    if (!text) return null;
    const parts = text.split(/(\[Source\s+\d+\])/g);

    return parts.map((part, i) => {
      const match = part.match(/\[Source\s+(\d+)\]/i);
      if (match) {
        return (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-orange text-white text-[11px] font-bold font-mono shadow-sm"
          >
            Source {match[1]}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Sample Question Pills */}
      <div className="mb-4 space-y-1.5 shrink-0">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-subtle flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange" />
          Suggested Questions to Test RAG Grounding:
        </p>
        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSubmit(null, prompt)}
              disabled={loading}
              className="text-left px-3 py-1.5 rounded-xl bg-sand-100 hover:bg-sand text-neutral-dark text-xs font-medium border border-sand transition-all duration-150 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 scrollbar-thin">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`
                w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-soft-sand
                ${isUser ? 'bg-neutral-dark' : msg.isError ? 'bg-red-600' : 'bg-orange'}
              `}>
                {isUser ? <User className="w-4 h-4" /> : <BotMessageSquare className="w-5 h-5" />}
              </div>

              {/* Message Bubble Container */}
              <div className={`max-w-2xl space-y-3 ${isUser ? 'text-right' : 'text-left'}`}>
                <div className={`
                  p-5 rounded-3xl text-sm leading-relaxed shadow-card-sand
                  ${isUser 
                    ? 'bg-orange text-white font-medium rounded-tr-none' 
                    : msg.isError 
                      ? 'bg-red-50 text-red-900 border border-red-200 rounded-tl-none' 
                      : 'bg-neutral-surface text-neutral-dark border border-sand rounded-tl-none'}
                `}>
                  {isUser ? msg.text : renderFormattedAnswer(msg.text)}

                  <div className={`
                    mt-2 text-[10px] font-mono
                    ${isUser ? 'text-white/80' : 'text-neutral-subtle'}
                  `}>
                    {msg.timestamp}
                    {msg.metrics && (
                      <span className="ml-2 font-semibold">
                        • {msg.metrics.totalDurationMs}ms ({msg.metrics.provider})
                      </span>
                    )}
                  </div>
                </div>

                {/* Source Citations Section (Assistant only) */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="p-4 rounded-2xl bg-sand-100/70 border border-sand text-xs space-y-3">
                    <div className="flex items-center justify-between font-bold text-neutral-dark">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-orange" />
                        Grounded Sources ({msg.sources.length})
                      </span>
                      <span className="text-[10px] font-mono text-neutral-subtle">
                        Ranked by Cosine Similarity
                      </span>
                    </div>

                    <div className="space-y-2">
                      {msg.sources.map((src) => {
                        const isExpanded = expandedSources[`${msg.id}-${src.sourceNumber}`];
                        return (
                          <div 
                            key={src.sourceNumber}
                            className={`p-3 rounded-xl bg-white border transition-all ${
                              src.isCited ? 'border-orange shadow-sm' : 'border-sand-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className={`
                                  px-2 py-0.5 rounded text-[10px] font-mono font-bold
                                  ${src.isCited ? 'bg-orange text-white' : 'bg-sand-100 text-neutral-dark'}
                                `}>
                                  Source {src.sourceNumber}
                                </span>
                                <h5 className="font-bold text-neutral-dark truncate text-xs">
                                  {src.title}
                                </h5>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="font-mono text-[10px] text-neutral-subtle">
                                  Sim: {(src.similarity * 100).toFixed(1)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleSourceExpand(msg.id, src.sourceNumber)}
                                  className="text-neutral-subtle hover:text-orange p-1 rounded"
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Excerpt */}
                            {isExpanded ? (
                              <p className="mt-2 text-[11px] text-neutral-body leading-relaxed border-t border-sand-100 pt-2 font-sans">
                                {src.excerpt}
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] text-neutral-subtle truncate font-sans">
                                {src.excerpt}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-orange flex items-center justify-center text-white shadow-soft-sand">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div className="p-4 rounded-3xl bg-neutral-surface border border-sand shadow-card-sand text-xs font-semibold text-neutral-dark flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-orange animate-ping" />
              <span>Scanning SQLite vector store & synthesizing answer...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box Footer */}
      <form onSubmit={(e) => handleSubmit(e)} className="shrink-0 relative">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask a question about your saved notes or websites..."
          disabled={loading}
          className="w-full pl-5 pr-14 py-4 rounded-2xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm text-neutral-dark placeholder:text-neutral-subtle shadow-card-sand"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-orange hover:bg-orange-hover text-white flex items-center justify-center transition-all duration-150 shadow-soft-sand disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
