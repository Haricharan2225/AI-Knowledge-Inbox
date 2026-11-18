import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Globe, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Sparkles,
  UploadCloud,
  FileCode,
  X
} from 'lucide-react';
import { api } from '../services/api';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.txt', '.md'];

export default function AddKnowledge({ setActiveTab, onIngestionSuccess }) {
  const [activeMode, setActiveMode] = useState('note'); // 'note' | 'file' | 'url'

  // Text Note State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Local File State
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileReading, setFileReading] = useState(false);
  const fileInputRef = useRef(null);

  // URL Ingest State
  const [urlInput, setUrlInput] = useState('');
  const [urlTitleOverride, setUrlTitleOverride] = useState('');

  // Status & Progress State
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const resetForm = () => {
    setNoteTitle('');
    setNoteContent('');
    setSelectedFile(null);
    setFileTitle('');
    setFileContent('');
    setUrlInput('');
    setUrlTitleOverride('');
    setResultData(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Switch modes cleanly
  const handleModeSwitch = (mode) => {
    setActiveMode(mode);
    setErrorMessage(null);
    setResultData(null);
  };

  // --- 1. Text Note Submission ---
  const handleIngestNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      setErrorMessage('Note content cannot be empty.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setResultData(null);

    try {
      const res = await api.ingest({
        type: 'note',
        title: noteTitle.trim() || undefined,
        content: noteContent.trim(),
      });

      if (res.success) {
        setResultData(res.data);
        if (onIngestionSuccess) onIngestionSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to ingest note.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- 2. Local File Validation and Reading ---
  const validateAndReadFile = (file) => {
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('Invalid file type. Only plain text (.txt) and Markdown (.md) documents are supported.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File exceeds the 5MB size limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected file is empty.');
      return;
    }

    setErrorMessage(null);
    setFileReading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (!content || !content.trim()) {
        setErrorMessage('Extracted file content is empty or whitespace.');
        setFileReading(false);
        return;
      }

      // Default title: filename without extension
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
      setSelectedFile(file);
      setFileTitle(defaultTitle);
      setFileContent(content);
      setFileReading(false);
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk.');
      setFileReading(false);
    };

    reader.readAsText(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    validateAndReadFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    validateAndReadFile(file);
  };

  const handleIngestFile = async (e) => {
    e.preventDefault();
    if (!fileContent.trim()) {
      setErrorMessage('Please select a valid .txt or .md file first.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setResultData(null);

    try {
      const res = await api.ingest({
        type: 'note',
        title: fileTitle.trim() || selectedFile?.name || 'Uploaded Document',
        content: fileContent.trim(),
      });

      if (res.success) {
        setResultData(res.data);
        if (onIngestionSuccess) onIngestionSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to ingest uploaded file.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- 3. URL Ingestion Submission ---
  const handleIngestUrl = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setErrorMessage('Please provide a valid website URL.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setResultData(null);

    try {
      const res = await api.ingest({
        type: 'url',
        url: urlInput.trim(),
        title: urlTitleOverride.trim() || undefined,
      });

      if (res.success) {
        setResultData(res.data);
        if (onIngestionSuccess) onIngestionSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to scrape and ingest URL.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      {/* 3-Mode Selection Tabs */}
      <div className="flex rounded-2xl bg-sand-100 p-1.5 border border-sand">
        <button
          type="button"
          onClick={() => handleModeSwitch('note')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-150
            ${activeMode === 'note' 
              ? 'bg-orange text-white shadow-soft-sand' 
              : 'text-neutral-dark hover:text-orange'}
          `}
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span> Text Note
        </button>

        <button
          type="button"
          onClick={() => handleModeSwitch('file')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-150
            ${activeMode === 'file' 
              ? 'bg-orange text-white shadow-soft-sand' 
              : 'text-neutral-dark hover:text-orange'}
          `}
        >
          <UploadCloud className="w-4 h-4" />
          <span className="hidden sm:inline">Upload</span> File (.txt, .md)
        </button>

        <button
          type="button"
          onClick={() => handleModeSwitch('url')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-150
            ${activeMode === 'url' 
              ? 'bg-orange text-white shadow-soft-sand' 
              : 'text-neutral-dark hover:text-orange'}
          `}
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">Ingest</span> Web URL
        </button>
      </div>

      {/* Main Ingestion Form Card */}
      <div className="bg-neutral-surface border border-sand rounded-3xl p-6 md:p-8 shadow-card-sand">
        {/* --- Tab 1: Text Note Form --- */}
        {activeMode === 'note' && (
          <form onSubmit={handleIngestNote} className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-neutral-dark tracking-tight">Add a Knowledge Note</h2>
              <p className="text-xs text-neutral-body">
                Paste meeting notes, internal procedures, architecture briefs, or customer research.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="note-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-dark">
                Note Title <span className="text-neutral-subtle font-normal lowercase">(optional)</span>
              </label>
              <input
                id="note-title"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Q4 Infrastructure Architecture Strategy"
                className="w-full px-4 py-3 rounded-xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm text-neutral-dark placeholder:text-neutral-subtle/70"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="note-content" className="block text-xs font-bold uppercase tracking-wider text-neutral-dark">
                  Note Content <span className="text-orange">*</span>
                </label>
                <span className="text-xs font-mono text-neutral-subtle">
                  {noteContent.length} characters
                </span>
              </div>
              <textarea
                id="note-content"
                rows={8}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Type or paste comprehensive text here. The pipeline will automatically split long content into ~500-character semantic chunks with 100-character overlap..."
                required
                className="w-full px-4 py-3 rounded-xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm text-neutral-dark placeholder:text-neutral-subtle/70 leading-relaxed font-sans"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-neutral-subtle flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange" />
                Automatically chunks and computes Float32 embeddings.
              </p>

              <button
                type="submit"
                disabled={submitting || !noteContent.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white text-sm font-bold transition-all duration-150 shadow-soft-sand disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Chunking & Ingesting...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Save & Chunk Note
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* --- Tab 2: Local File Upload & Drag-and-Drop --- */}
        {activeMode === 'file' && (
          <form onSubmit={handleIngestFile} className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-neutral-dark tracking-tight">Upload Local Document</h2>
              <p className="text-xs text-neutral-body">
                Drag and drop Markdown (.md) or plain text (.txt) files from your computer. Max size: 5 MB.
              </p>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Drag & Drop Target Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200
                flex flex-col items-center justify-center space-y-3
                ${isDragging 
                  ? 'border-orange bg-sand-200 scale-[0.99]' 
                  : 'border-sand bg-white hover:bg-sand-100 hover:border-orange'}
              `}
            >
              <div className="w-14 h-14 rounded-2xl bg-sand-100 text-orange flex items-center justify-center border border-sand shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-dark">
                  {selectedFile ? (
                    <span className="text-orange">Selected: {selectedFile.name}</span>
                  ) : (
                    'Click to browse or drag & drop files here'
                  )}
                </p>
                <p className="text-xs text-neutral-subtle font-mono">
                  Supported formats: Plain Text (.txt) and Markdown (.md) • Up to 5MB
                </p>
              </div>

              {selectedFile && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand-100 border border-sand text-xs font-semibold text-neutral-dark font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {fileContent.length} characters
                </span>
              )}
            </div>

            {/* File Review & Title Customization */}
            {selectedFile && (
              <div className="p-5 rounded-2xl bg-sand-100 border border-sand space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCode className="w-5 h-5 text-orange" />
                    <span className="text-xs font-bold text-neutral-dark">Document Ready for Ingestion</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="p-1 rounded-lg text-neutral-subtle hover:text-neutral-dark hover:bg-sand"
                    title="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label htmlFor="file-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-dark">
                    Document Title in Library
                  </label>
                  <input
                    id="file-title"
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm text-neutral-dark font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-neutral-dark">
                    Content Preview ({fileContent.length} chars)
                  </span>
                  <div className="p-3 rounded-xl bg-white border border-sand max-h-36 overflow-y-auto text-xs text-neutral-body font-mono leading-relaxed whitespace-pre-line">
                    {fileContent.substring(0, 500)}
                    {fileContent.length > 500 && '...'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-neutral-subtle flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange" />
                Browser FileReader client-side parsing • Zero external upload services.
              </p>

              <button
                type="submit"
                disabled={submitting || !fileContent.trim() || fileReading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white text-sm font-bold transition-all duration-150 shadow-soft-sand disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Segmenting & Ingesting...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Process & Ingest File
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* --- Tab 3: Web URL Ingestion Form --- */}
        {activeMode === 'url' && (
          <form onSubmit={handleIngestUrl} className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-neutral-dark tracking-tight">Ingest from Web URL</h2>
              <p className="text-xs text-neutral-body">
                Fetch and crawl public articles, API documentation, blog posts, or Wikipedia entries.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="web-url" className="block text-xs font-bold uppercase tracking-wider text-neutral-dark">
                Webpage URL <span className="text-orange">*</span>
              </label>
              <input
                id="web-url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/documentation"
                required
                className="w-full px-4 py-3 rounded-xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm font-mono text-neutral-dark placeholder:text-neutral-subtle/70"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="url-title-override" className="block text-xs font-bold uppercase tracking-wider text-neutral-dark">
                Document Title Override <span className="text-neutral-subtle font-normal lowercase">(optional)</span>
              </label>
              <input
                id="url-title-override"
                type="text"
                value={urlTitleOverride}
                onChange={(e) => setUrlTitleOverride(e.target.value)}
                placeholder="Leave blank to auto-extract from HTML <title> tag"
                className="w-full px-4 py-3 rounded-xl bg-white border border-sand focus:outline-none focus:ring-2 focus:ring-orange text-sm text-neutral-dark placeholder:text-neutral-subtle/70"
              />
            </div>

            {/* Security Notice */}
            <div className="p-4 rounded-2xl bg-sand-100 border border-sand text-xs text-neutral-body space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-neutral-dark">
                <ShieldCheck className="w-4 h-4 text-orange" />
                Enterprise SSRF Protection & Cheerio Cleanup
              </div>
              <p className="leading-relaxed">
                Our scraper strips navigation, scripts, footer noise, and ads. Requests to private IP ranges (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`) or localhost are automatically blocked.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-neutral-subtle font-mono">
                Timeout limit: 10,000ms
              </p>

              <button
                type="submit"
                disabled={submitting || !urlInput.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-hover text-white text-sm font-bold transition-all duration-150 shadow-soft-sand disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Crawling & Chunking...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Crawl & Ingest URL
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Error Feedback Banner */}
      {errorMessage && (
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-card-sand">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Ingestion Failed</h4>
            <p className="text-xs leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success Result Banner */}
      {resultData && (
        <div className="bg-sand-100 border border-sand rounded-3xl p-6 md:p-8 space-y-6 shadow-card-sand">
          <div className="flex items-start justify-between gap-4 border-b border-sand pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-orange text-white flex items-center justify-center shadow-soft-sand">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-dark tracking-tight">
                  Knowledge Ingested Successfully!
                </h3>
                <p className="text-xs text-neutral-body">
                  Document ID: <code className="font-mono text-neutral-dark font-semibold">{resultData.id}</code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl bg-white hover:bg-cream border border-sand text-xs font-semibold text-neutral-dark transition-colors"
              >
                Ingest Another
              </button>
              <button
                onClick={() => setActiveTab('assistant')}
                className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-hover text-white text-xs font-semibold transition-colors shadow-soft-sand inline-flex items-center gap-1.5"
              >
                Ask AI <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-white/80 border border-sand">
              <span className="text-neutral-subtle uppercase block text-[10px]">Title</span>
              <span className="font-bold text-neutral-dark truncate block mt-0.5">{resultData.title}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/80 border border-sand">
              <span className="text-neutral-subtle uppercase block text-[10px]">Extracted Length</span>
              <span className="font-bold text-neutral-dark block mt-0.5">{resultData.contentLength} characters</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/80 border border-sand">
              <span className="text-neutral-subtle uppercase block text-[10px]">Partitioned Chunks</span>
              <span className="font-bold text-neutral-dark block mt-0.5">{resultData.chunkCount} vector chunks</span>
            </div>
          </div>

          {/* Segmented Chunks Preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-dark">
              <Layers className="w-4 h-4 text-orange" />
              Segmented Chunks Preview ({resultData.chunks?.length || 0})
            </div>

            <div className="space-y-2">
              {resultData.chunks?.map((chunk) => (
                <div key={chunk.id} className="p-3.5 rounded-xl bg-white/90 border border-sand text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-subtle">
                    <span className="font-bold text-neutral-dark">Chunk #{chunk.chunkIndex + 1}</span>
                    <span>{chunk.characterCount} chars</span>
                  </div>
                  <p className="text-neutral-body font-sans leading-relaxed">{chunk.preview}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
