import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  FileText, 
  Globe, 
  Trash2, 
  Eye, 
  Layers, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

const PAGE_SIZE = 6;

export default function KnowledgeLibrary({ onRefreshTrigger, setActiveTab }) {
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'note' | 'url'
  const [page, setPage] = useState(1);

  // Document Detail Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Deletion Modal State
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 300ms Debounce effect on search query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to page 1 on search change
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filter type changes
  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    setPage(1);
  };

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getItems({
        type: selectedType,
        search: debouncedQuery.trim() || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      if (res.success) {
        setItems(res.data);
        setTotalItems(res.total ?? res.data.length);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedType, debouncedQuery, page, onRefreshTrigger]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setDebouncedQuery(searchQuery);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(totalItems, page * PAGE_SIZE);

  const openItemDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const res = await api.getItemById(id);
      if (res.success) {
        setSelectedItem(res.data);
      }
    } catch (err) {
      alert(`Failed to load document details: ${err.message}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const res = await api.deleteItem(itemToDelete.id);
      if (res.success) {
        setItemToDelete(null);
        // If last item on current page deleted and not on first page, step back
        if (items.length === 1 && page > 1) {
          setPage((p) => p - 1);
        } else {
          fetchItems();
        }
      }
    } catch (err) {
      alert(`Failed to delete item: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Search & Filter Toolbar */}
      <div className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Form with Debounce and Clear Button */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-neutral-subtle absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, keywords, or URL..."
              className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm text-neutral-dark placeholder:text-neutral-subtle"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-subtle hover:text-neutral-dark"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-subtle uppercase mr-1 hidden sm:inline">Type:</span>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'note', label: 'Text Notes' },
              { id: 'url', label: 'Web URLs' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleTypeChange(filter.id)}
                className={`
                  px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border
                  ${selectedType === filter.id
                    ? 'bg-orange text-white border-orange shadow-soft-sand'
                    : 'bg-sand-100 text-neutral-dark border-sand hover:bg-sand'}
                `}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-sand border-t-orange rounded-full animate-spin" />
          <p className="text-sm font-semibold text-neutral-dark">Loading knowledge repository...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-3 bg-red-50 border border-red-200 rounded-3xl text-red-800">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="font-bold text-base">Error Loading Knowledge Library</h3>
          <p className="text-xs">{error}</p>
          <button
            onClick={fetchItems}
            className="px-4 py-2 rounded-xl bg-orange text-white text-xs font-semibold shadow-soft-sand"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-neutral-surface border border-sand rounded-3xl p-8 shadow-card-sand">
          <div className="w-12 h-12 rounded-2xl bg-sand-100 border border-sand text-orange mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-neutral-dark">No Knowledge Documents Found</h3>
            <p className="text-xs text-neutral-body max-w-md mx-auto">
              {debouncedQuery 
                ? `No results matched "${debouncedQuery}". Try adjusting your keywords or clearing the filter.` 
                : 'Your knowledge repository is currently empty. Start by saving a text note or ingesting a web URL.'}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('add')}
            className="px-5 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold transition-all shadow-soft-sand inline-flex items-center gap-1.5"
          >
            Add Knowledge
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="bg-neutral-surface border border-sand rounded-3xl p-6 shadow-card-sand flex flex-col justify-between hover:border-sand-400 transition-all duration-200 group"
              >
                <div className="space-y-3">
                  {/* Header Tag and Actions */}
                  <div className="flex items-center justify-between">
                    <span className={`
                      text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border
                      ${item.type === 'url' 
                        ? 'bg-sand-100 text-neutral-dark border-sand' 
                        : 'bg-white text-neutral-dark border-sand'}
                    `}>
                      {item.type === 'url' ? 'Web URL' : 'Text Note'}
                    </span>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openItemDetails(item.id)}
                        className="p-1.5 rounded-lg hover:bg-sand-100 text-neutral-body hover:text-neutral-dark"
                        title="Inspect chunks and details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-neutral-subtle hover:text-red-700 transition-colors"
                        title="Delete knowledge item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className="text-base font-bold text-neutral-dark leading-snug line-clamp-2">
                    {item.title}
                  </h4>

                  {/* URL if applicable */}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-orange hover:text-orange-dark font-mono truncate flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}

                  {/* Preview text */}
                  <p className="text-xs text-neutral-body line-clamp-3 leading-relaxed">
                    {item.preview}
                  </p>
                </div>

                {/* Footer Meta */}
                <div className="pt-4 mt-4 border-t border-sand-200 flex items-center justify-between text-xs text-neutral-subtle font-mono">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-orange" />
                    {item.chunkCount} {item.chunkCount === 1 ? 'chunk' : 'chunks'}
                  </span>
                  <span>{item.createdAt.substring(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Previous / Next Pagination Controls */}
          {totalItems > 0 && (
            <div className="bg-neutral-surface border border-sand rounded-2xl px-6 py-4 shadow-card-sand flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-neutral-body font-mono">
                Showing <span className="font-bold text-neutral-dark">{startItem}</span> to{' '}
                <span className="font-bold text-neutral-dark">{endItem}</span> of{' '}
                <span className="font-bold text-neutral-dark">{totalItems}</span> documents
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-sand-100 hover:bg-sand text-neutral-dark text-xs font-semibold border border-sand transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-orange" />
                  <span>Previous</span>
                </button>

                <span className="px-3 py-1.5 rounded-xl bg-white border border-sand text-xs font-bold text-neutral-dark font-mono">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-sand-100 hover:bg-sand text-neutral-dark text-xs font-semibold border border-sand transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 text-orange" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-dark/50 backdrop-blur-sm">
          <div className="bg-cream border border-sand rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-sand-100 border-b border-sand flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white border border-sand text-neutral-dark">
                  {selectedItem.type}
                </span>
                <h3 className="font-bold text-sm text-neutral-dark truncate max-w-lg">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl hover:bg-sand text-neutral-dark transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Document Overview Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-white border border-sand">
                  <span className="text-neutral-subtle block text-[10px] uppercase">Chunks</span>
                  <span className="font-bold text-neutral-dark">{selectedItem.chunks?.length || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-sand">
                  <span className="text-neutral-subtle block text-[10px] uppercase">Characters</span>
                  <span className="font-bold text-neutral-dark">{selectedItem.contentLength}</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-sand col-span-2">
                  <span className="text-neutral-subtle block text-[10px] uppercase">Created</span>
                  <span className="font-bold text-neutral-dark">{selectedItem.createdAt}</span>
                </div>
              </div>

              {selectedItem.url && (
                <div className="p-3 rounded-xl bg-white border border-sand text-xs flex items-center gap-2">
                  <Globe className="w-4 h-4 text-orange shrink-0" />
                  <a href={selectedItem.url} target="_blank" rel="noreferrer" className="text-orange hover:underline font-mono truncate">
                    {selectedItem.url}
                  </a>
                </div>
              )}

              {/* Full Text Excerpt */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-dark">Original Clean Content</h4>
                <div className="p-4 rounded-2xl bg-white border border-sand max-h-48 overflow-y-auto text-xs text-neutral-body leading-relaxed whitespace-pre-line font-sans">
                  {selectedItem.content}
                </div>
              </div>

              {/* Partitioned Chunks */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-dark flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-orange" />
                  Vector Chunks ({selectedItem.chunks?.length || 0})
                </h4>

                <div className="space-y-2.5">
                  {selectedItem.chunks?.map((chunk) => (
                    <div key={chunk.id} className="p-4 rounded-2xl bg-white border border-sand text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-neutral-dark">Chunk #{chunk.chunkIndex + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-subtle">{chunk.characterCount} chars</span>
                          {chunk.hasEmbedding && (
                            <span className="text-[10px] font-bold text-neutral-dark bg-sand-100 px-2 py-0.5 rounded border border-sand">
                              Float32 Embedded
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-neutral-body leading-relaxed font-sans">{chunk.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-sand-100 border-t border-sand flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-bold shadow-soft-sand transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-dark/50 backdrop-blur-sm">
          <div className="bg-cream border border-sand rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center border border-red-200 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-neutral-dark">Delete Knowledge Item?</h3>
              <p className="text-xs text-neutral-body">
                Are you sure you want to delete <span className="font-bold text-neutral-dark">"{itemToDelete.title}"</span>?
                This will permanently delete the document and all of its associated vector chunks from SQLite.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-sand-100 border border-sand text-xs font-semibold text-neutral-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-soft-sand disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
