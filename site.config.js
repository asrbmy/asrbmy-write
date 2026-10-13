// ─────────────────────────────────────────────────────────────────────────────
//  ASRBMY Write — site configuration
//  Everything that identifies the site lives here. Change a value, rebuild,
//  and the header, <title>, footer, feeds and metadata all follow.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // ── Identity ───────────────────────────────────────────────────────────────
  name: 'ASRBMY Write',
  tagline: 'Notes, Research & Ideas',
  description: 'A personal space for writing, research, ideas, and technical notes.',
  language: 'en',

  // ── Hosting ────────────────────────────────────────────────────────────────
  // On GitHub Actions, `url` and `base` are detected automatically from the
  // repository name. Set them here only for a custom domain or local overrides.
  url: 'https://asrbmy.github.io',
  base: '/Write', // '' for user sites / custom domains, '/repo-name' for project sites

  // GitHub repository ("owner/repo"). Used to fill in the GitHub social link.
  // Detected automatically on GitHub Actions.
  repo: '',
  branch: 'main',

  // ── Author ─────────────────────────────────────────────────────────────────
  author: {
    name: 'ASRBMY',
    bio: 'I write about software, privacy, research habits and the things I learn along the way.',
  },

  // Applied to any article that leaves these front-matter fields out.
  defaults: { category: 'Notes', featured: false },

  // ── Logo & icons (files live in /public) ───────────────────────────────────
  logo: { src: '/logo.svg', favicon: '/favicon.svg' },

  // ── Navigation ─────────────────────────────────────────────────────────────
  // `children` may be an array of links or the string "categories".
  // `match` lists extra path prefixes that should mark the item as active.
  nav: [
    { label: 'Home', href: '/' },
    {
      label: 'Articles',
      href: '/writing/',
      match: ['/articles/', '/tags/'],
      children: [
        { label: 'All Articles', href: '/writing/' },
        { label: 'Tags', href: '/tags/' },
        { label: 'Search', href: '/search/' },
      ],
    },
    { label: 'Topics', href: '/categories/', children: 'categories' },
    { label: 'Tutorials', href: '/categories/tutorials/' },
    { label: 'Research', href: '/categories/research/' },
    { label: 'About', href: '/about/' },
    { label: 'Archive', href: '/archive/' },
  ],

  // Buttons at the right of the header
  headerActions: [
    { label: 'Search', href: '/search/' },
    { label: 'Font Tester', href: '/font-tester/', accent: true },
  ],

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    links: [
      { label: 'Home', href: '/' },
      { label: 'Writing', href: '/writing/' },
      { label: 'Categories', href: '/categories/' },
      { label: 'About', href: '/about/' },
      { label: 'Archive', href: '/archive/' },
      { label: 'Contact', href: '/contact/' },
    ],
    legal: [
      { label: 'Privacy', href: '/privacy/' },
      { label: 'Terms', href: '/terms/' },
      { label: 'Sitemap', href: '/sitemap.xml' },
    ],
  },

  // ── Social links ───────────────────────────────────────────────────────────
  // icon: github | x | linkedin | mail | rss.  Entries with an empty href are
  // hidden (GitHub falls back to the repository link when it is known).
  social: [
    { label: 'RSS', icon: 'rss', href: '/rss.xml' },
    { label: 'GitHub', icon: 'github', href: '' },
    { label: 'X', icon: 'x', href: '' },
    { label: 'LinkedIn', icon: 'linkedin', href: '' },
  ],

  // ── Contact page ───────────────────────────────────────────────────────────
  // Leave email empty to hide it. (There is no backend, so there is no form.)
  contact: { email: '' },

  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebar: {
    recentCount: 5,
    showFeatured: false, // also pin the featured article in the sidebar
    promo: {
      title: 'Follow the Writing',
      tagline: 'New notes, straight to your reader.',
      text: 'Subscribe with any RSS reader to get each new article. No account, no tracking.',
      button: { label: 'Subscribe via RSS', href: '/rss.xml' },
      note: 'Free and open. Unsubscribe by removing the feed.',
    },
    start: {
      title: 'Start Here',
      text: 'New to the site? Browse the writing by topic, or read it all in date order.',
      button: { label: 'Browse the archive', href: '/archive/' },
    },
    toolsLabel: 'Site tools',
    toolsTitle: 'Writing Tools',
    tools: [
      { label: 'Article Search', desc: 'Find anything by title or text', href: '/search/' },
      { label: 'Font Tester', desc: 'Try fonts and reading styles', href: '/font-tester/' },
      { label: 'Tag Explorer', desc: 'Browse the smaller topics', href: '/tags/' },
    ],
    downloads: [
      { label: 'RSS Feed', href: '/rss.xml' },
      { label: 'Sitemap', href: '/sitemap.xml' },
    ],
    quote: {
      text: 'Small steps, consistent effort, and a curious mind can take you a long way.',
      by: 'ASRBMY',
    },
  },

  // ── Listing ────────────────────────────────────────────────────────────────
  pageSize: 6,

  // Optional descriptions shown on the Categories pages.
  categories: {
    Programming: 'Code, tools and the habits behind building better software.',
    Tutorials: 'Step-by-step guides you can follow from start to finish.',
    Research: 'How I find, read and make sense of ideas.',
    Privacy: 'Practical, plain-language notes on staying private online.',
    Personal: 'Essays and reflections on learning and writing.',
  },

  // ── Writing style (fonts & reading) ────────────────────────────────────────
  // Pick a preset from fonts.config.js (editorial, classic, modern, technical,
  // humanist, magazine, slab, terminal) — or set `head` / `body` font stacks.
  // Try combinations on the /font-tester/ page; it prints this block for you.
  typography: {
    preset: 'editorial',
    size: '18px', // article text size
    lineHeight: 1.75, // article line spacing
    headingWeight: 800, // 400–900
  },

  // ── Search & social sharing ────────────────────────────────────────────────
  seo: {
    ogImage: '/og-default.png', // 1200×630, in /public. Used when a page has no image of its own.
    locale: 'en_US',
    twitter: '@asrbmy', // e.g. '@yourhandle' (optional)
  },

  // ── Design tokens ──────────────────────────────────────────────────────────
  // Each key becomes a CSS custom property: `bg` → `--bg`.
  theme: {
    bg: '#e9e8d9',
    'grid-line': 'rgba(12, 48, 45, 0.07)',
    'grid-size': '28px',

    'header-bg': '#0c302d',
    'header-text': '#f4f0e3',
    'header-muted': '#a9c0b8',
    'nav-bg': '#0b2c29',
    'nav-line': 'rgba(244, 240, 227, 0.12)',

    accent: '#b8431f',
    'accent-strong': '#9c3516',
    link: '#0f5a4f',

    panel: '#f6f2e4',
    'panel-alt': '#efead8',
    'panel-border': '#d3cfba',
    text: '#1a2724',
    'text-muted': '#5a6663',

    'side-bg': '#0f3431',
    'side-text': '#e8ede6',
    'side-muted': '#9fb5ac',
    'side-line': 'rgba(244, 240, 227, 0.14)',

    'code-bg': '#0d2d2a',
    'code-bar': '#14403b',
    'code-text': '#e6ede7',

    // Heading/body fonts come from `typography` above. UI and code fonts:
    'font-ui': "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    'font-mono': "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace",

    'content-max': '1240px',
    'col-main': '7fr',
    'col-side': '3fr',
    gap: '40px',
    radius: '2px',
  },

  themeDark: {
    bg: '#0a1b19',
    'grid-line': 'rgba(244, 240, 227, 0.045)',
    panel: '#10231f',
    'panel-alt': '#14302b',
    'panel-border': '#244641',
    text: '#e7eadf',
    'text-muted': '#9db2aa',
    link: '#6fcbb7',
    accent: '#e0693f',
    'accent-strong': '#f08058',
    'side-bg': '#0d2926',
    'code-bg': '#071a18',
    'code-bar': '#0f2d29',
  },
};
