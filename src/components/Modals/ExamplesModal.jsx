import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { X, FileDown, FileText, FolderOpen, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { examples as registryExamples } from '../../pages/examples/registry';
import matter from 'gray-matter';

// Inline fallback: discover examples directly via Vite globs if registry is empty
const __filesRoot = import.meta.glob('/src/examples/*.md', { eager: true, query: '?raw', import: 'default' });
const __filesRootNested = import.meta.glob('/src/examples/**/*.md', { eager: true, query: '?raw', import: 'default' });
const __filesRel = import.meta.glob('../../examples/*.md', { eager: true, query: '?raw', import: 'default' });
const __filesRelNested = import.meta.glob('../../examples/**/*.md', { eager: true, query: '?raw', import: 'default' });

const __merged = { ...__filesRoot, ...__filesRootNested, ...__filesRel, ...__filesRelNested };
const inlineExamples = Object.entries(__merged)
  .map(([path, raw]) => {
    try {
      const text = typeof raw === 'string' ? raw : String(raw || '');
      const { data, content } = matter(text);
      const slug = data?.slug || path.split('/').pop().replace(/\.md$/, '');
      return {
        slug,
        title: data?.title || slug,
        summary: data?.summary || '',
        tags: Array.isArray(data?.tags) ? data.tags : [],
        image: data?.image || null,
        pdf: data?.pdf || null,
        json: data?.json || null,
        created: data?.created || null,
        updated: data?.updated || null,
        body: content || ''
      };
    } catch (_) { return null; }
  })
  .filter(Boolean);

// Debug logs to help diagnose why no examples show up
try {
  // eslint-disable-next-line no-console
  console.debug('[ExamplesModal][debug] registryExamples length:', Array.isArray(registryExamples) ? registryExamples.length : 'n/a');
  // eslint-disable-next-line no-console
  console.debug('[ExamplesModal][debug] inlineExamples length:', Array.isArray(inlineExamples) ? inlineExamples.length : 'n/a');
} catch (_) {}

const Card = ({ ex, onOpen, onOpenInEditor }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
    {ex.image ? (
      <img src={ex.image} alt={ex.title} className="w-full h-40 object-cover" />
    ) : (
      <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">No image</div>
    )}
    <div className="p-3 flex-1 flex flex-col">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{ex.title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">{ex.summary}</p>
      <div className="mt-auto flex items-center gap-2">
        <button onClick={() => onOpen(ex.slug)} className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
          Details
        </button>
        {ex.pdf && (
          <a href={ex.pdf} target="_blank" rel="noreferrer" className="px-2 py-1 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded inline-flex items-center gap-1">
            <FileDown className="w-4 h-4" /> PDF
          </a>
        )}
        {ex.json && (
          <a href={ex.json} target="_blank" rel="noreferrer" className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded inline-flex items-center gap-1">
            <FileText className="w-4 h-4" /> JSON
          </a>
        )}
        {ex.json && (
          <button onClick={() => onOpenInEditor(ex)} className="ml-auto px-2 py-1 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 rounded inline-flex items-center gap-1">
            <FolderOpen className="w-4 h-4" /> Open
          </button>
        )}
      </div>
    </div>
  </div>
);

const Detail = ({ ex, onBack, onOpenInEditor }) => (
  <div className="flex flex-col gap-3">
    <button onClick={onBack} className="self-start text-sm text-blue-600 hover:underline">← All examples</button>
    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{ex.title}</h2>
    {ex.image ? <img src={ex.image} alt={ex.title} className="w-full max-h-96 object-contain rounded" /> : null}
    <div className="flex items-center gap-2">
      {ex.pdf && (
        <a href={ex.pdf} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1">
          <FileDown className="w-4 h-4" /> Download PDF
        </a>
      )}
      {ex.json && (
        <a href={ex.json} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded inline-flex items-center gap-1">
          <FileText className="w-4 h-4" /> View JSON
        </a>
      )}
      {ex.json && (
        <button onClick={() => onOpenInEditor(ex)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded inline-flex items-center gap-1">
          <FolderOpen className="w-4 h-4" /> Open in SpaceStager
        </button>
      )}
    </div>
    <div className="prose dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{ex.body || ''}</ReactMarkdown>
    </div>
  </div>
);

const ExamplesModal = ({ isOpen, onClose, onOpenInEditor }) => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [activeBody, setActiveBody] = useState('');

  const stripFrontmatter = useCallback((text) => {
    if (!text) return '';
    if (text.startsWith('---')) {
      // Find the second --- at start of a line
      const match = text.match(/^---[\s\S]*?\n---\s*\n?/);
      if (match) return text.slice(match[0].length);
    }
    return text;
  }, []);

  // Use build-time registry when available; otherwise, inline glob fallback
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    try {
      const primary = Array.isArray(registryExamples) ? registryExamples : [];
      const fallback = Array.isArray(inlineExamples) ? inlineExamples : [];
      const list = primary.length > 0 ? primary : fallback;
      try { console.debug('[ExamplesModal][debug] isOpen, selecting examples length:', list.length); } catch (_) {}
      if (!cancelled) setItems(list);
    } catch (_) {
      const list = Array.isArray(inlineExamples) ? inlineExamples : [];
      try { console.debug('[ExamplesModal][debug] exception selecting examples, fallback length:', list.length); } catch (_) {}
      if (!cancelled) setItems(list);
    }
    return () => { cancelled = true; };
  }, [isOpen]);

  // Load markdown for active example when selected (use pre-parsed body when available)
  useEffect(() => {
    if (!isOpen || !activeSlug) { setActiveBody(''); return; }
    const ex = items.find((e) => e.slug === activeSlug);
    if (!ex) { setActiveBody(''); return; }
    let cancelled = false;
    if (ex.body) {
      const cleaned = stripFrontmatter(ex.body || '');
      if (!cancelled) setActiveBody(cleaned);
    } else if (ex.markdown) {
      (async () => {
        try {
          const res = await fetch(ex.markdown, { cache: 'no-store' });
          const text = await res.text();
          const cleaned = stripFrontmatter(text || '');
          if (!cancelled) setActiveBody(cleaned);
        } catch (_) {
          if (!cancelled) setActiveBody('');
        }
      })();
    } else {
      if (!cancelled) setActiveBody('');
    }
    return () => { cancelled = true; };
  }, [isOpen, activeSlug, items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items || [];
    if (!q) return list;
    return list.filter((e) =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.summary || '').toLowerCase().includes(q) ||
      (e.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  }, [query, items]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveSlug(null);
      setActiveBody('');
    }
  }, [isOpen]);

  const openDetail = useCallback((slug) => setActiveSlug(slug), []);
  const backToList = useCallback(() => setActiveSlug(null), []);

  if (!isOpen) return null;

  const activeMeta = activeSlug ? items.find((e) => e.slug === activeSlug) : null;
  const active = activeMeta ? { ...activeMeta, body: activeBody } : null;

  return (
    <div className="fixed inset-0 z-[10010]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Examples</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search examples..."
                  className="pl-7 pr-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                />
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 overflow-auto flex-1">
            {active ? (
              <Detail ex={active} onBack={backToList} onOpenInEditor={onOpenInEditor} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((ex) => (
                  <Card key={ex.slug} ex={ex} onOpen={openDetail} onOpenInEditor={onOpenInEditor} />
                ))}
                {filtered.length === 0 && (
                  <div className="text-sm text-gray-500">No examples match your search.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamplesModal;


