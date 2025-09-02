import matter from 'gray-matter';

// Prefer absolute-from-root globs; also include a relative fallback and an explicit seed import.
const filesRoot = import.meta.glob('/src/examples/*.md', { eager: true, query: '?raw', import: 'default' });
const filesNested = import.meta.glob('/src/examples/**/*.md', { eager: true, query: '?raw', import: 'default' });
const filesRelative = import.meta.glob('../../examples/*.md', { eager: true, query: '?raw', import: 'default' });
// Explicit seed so at least one example appears even if glob misses during dev HMR.
// This path is safe even if the file is missing; bundlers will ignore at build if not found.
// eslint-disable-next-line import/no-unresolved
import seedTimesSquare from '/src/examples/times-square-streetery.md?raw';

const mergedFiles = {
  ...filesRoot,
  ...filesNested,
  ...filesRelative,
  ...(seedTimesSquare ? { '/src/examples/times-square-streetery.md': seedTimesSquare } : {})
};

// Parse frontmatter and build example objects
export const examples = Object.entries(mergedFiles)
  .map(([path, raw]) => {
    try {
      const { data, content } = matter(raw || '');
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
    } catch (_) {
      return null;
    }
  })
  .filter(Boolean)
  // Sort newest first if updated is set, otherwise by title
  .sort((a, b) => {
    const au = a.updated || a.created || '';
    const bu = b.updated || b.created || '';
    if (au && bu) return bu.localeCompare(au);
    return a.title.localeCompare(b.title);
  });

export function getExampleBySlug(slug) {
  return examples.find((e) => e.slug === slug) || null;
}


