// Explicit, robust registry: import markdown as URL and set metadata here.
// Relative path so bundler resolves in all environments.
// eslint-disable-next-line import/no-unresolved
import brooklynBirthdayMdUrl from '../../examples/brooklyn-birthday.md?url';

export const examples = [
  {
    slug: 'brooklyn-birthday',
    title: 'Brooklyn Birthday Party',
    summary: 'Parks mode, dropped objects, custom rectangle annotations.',
    image: '/examples/brooklyn-birthday/preview.png',
    pdf: '/examples/brooklyn-birthday/siteplan.pdf',
    json: '/examples/brooklyn-birthday/siteplan.json',
    markdown: brooklynBirthdayMdUrl
  }
];

export function getExampleBySlug(slug) {
  return examples.find((e) => e.slug === slug) || null;
}


