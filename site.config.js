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
  // Time zone used to decide when a scheduled article (one dated in the future) goes live.
  timezone: 'Asia/Kolkata',

  // ── Hosting ────────────────────────────────────────────────────────────────
  // On GitHub Actions, `url` and `base` are detected automatically from the
  // repository name. Set them here only for a custom domain or local overrides.
  url: 'https://YOUR-USERNAME.github.io',
  base: '', // '' for user sites / custom domains, '/repo-name' for project sites

  // GitHub repository ("owner/repo"). Used to fill in the GitHub social link.
  // Detected automatically on GitHub Actions.
  repo: '',
  branch: 'main',

  // ── Author ─────────────────────────────────────────────────────────────────
  author: {
    name: 'ASRBMY',
    bio: 'I write about software, privacy, research habits and the things I learn along the way.',
  },

  // Other languages. The FIRST one is the site's main language. To publish a translation, put an
  // article in content/articles/ with `lang: hi` and `translationOf: <slug of the original>`.
  // It then lives at /hi/articles/…, and readers see a language switcher and search engines get hreflang links.
  // (Menus and buttons stay in the main language; edit their labels in this file as you like.)
  languages: [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    // { code: 'ar', label: 'العربية', dir: 'rtl' },
  ],

  // More writers. The author above is always included. An article picks its writer with `author: Name`.
  // Each writer with articles gets a page at /authors/<slug>/.
  authors: [
    // { name: 'Guest Writer', bio: 'Short bio.', links: [{ label: 'Website', href: 'https://example.com' }] },
  ],

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
    { label: 'Projects', href: '/projects/' }, // hidden until content/projects has something
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
      { label: 'Best of', href: '/best/' },
      { label: 'Glossary', href: '/glossary/' },
      { label: 'Reading list', href: '/bookmarks/' },
    ],
    legal: [
      { label: 'Privacy', href: '/privacy/' },
      { label: 'Terms', href: '/terms/' },
      { label: 'Changelog', href: '/changelog/' },
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
  // `email` is shown on the Contact page. To add a message form (no server needed), set form.enabled and give
  // the address your form service gave you (Formspree: 'https://formspree.io/f/xxxxxxx'; Web3Forms, Getform and others work too).
  // The form includes a "Suggest a topic" choice. Messages go straight to that service, never through this site.
  contact: {
    email: '',
    form: {
      enabled: false, action: '', next: '', // `next`: an https:// page to show after sending (optional)
      topics: ['Question', 'Suggest a topic', 'Feedback', 'Report a problem'],
      note: '',
    },
  },

  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebar: {
    recentCount: 5,
    best: true, // show a "Best of" list (articles marked best: true) — set false to hide
    bestTitle: 'Best of',
    bestCount: 4,
    newsletter: false, // also show the newsletter form here (needs `newsletter` below)
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
      { label: 'Glossary', desc: 'Plain-language definitions', href: '/glossary/' },
      { label: 'Reading List', desc: 'Articles you saved for later', href: '/bookmarks/' },
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

  // ── Security ───────────────────────────────────────────────────────────────
  // Every page carries a Content-Security-Policy that only allows this site's own
  // scripts and styles. Images may come from this site or any https:// address.
  // Embedding something external (a video, a widget)? Add its address to `extra`,
  // for example: "frame-src https://www.youtube-nocookie.com".
  security: { csp: true, imgSrc: "'self' data: https:", extra: '' },

  // ── Comments (optional) ────────────────────────────────────────────────────
  // Uses Giscus, which stores comments in your repository's GitHub Discussions.
  // 1. Turn on Discussions in the repo (Settings → General → Features).
  // 2. Install the Giscus app on the repo, then open https://giscus.app, enter the repo,
  //    and copy the ids it shows (repoId, categoryId) here. 3. Set enabled: true.
  // Visitors need a GitHub account to comment. Nothing loads until they press "Load comments".
  comments: { enabled: false, repo: '', repoId: '', category: 'Announcements', categoryId: '', mapping: 'pathname', reactions: true },

  // ── Share, save and print buttons under each article ──────────────────────
  // targets: x | linkedin | whatsapp | facebook | email
  share: { enabled: true, targets: ['x', 'linkedin', 'whatsapp', 'email'] },

  // ── Newsletter (optional) ──────────────────────────────────────────────────
  // The form posts straight to your email service, so no server of your own is needed.
  //   Buttondown:  provider: 'buttondown', username: 'your-name'
  //   Mailchimp / others: set `action` to the form address they give you, and `field` to the
  //   email field name they use (Mailchimp uses 'EMAIL'). Add any hidden fields under `hidden`.
  newsletter: {
    enabled: false, provider: '', username: '', action: '', field: 'email', hidden: {},
    title: 'Get new articles by email', text: 'One email when something new is published. No spam; unsubscribe any time.',
    button: 'Subscribe', placeholder: 'you@example.com', note: '',
  },

  // ── Analytics (optional, privacy-friendly, off by default) ─────────────────
  //   Plausible:    provider: 'plausible',    domain: 'example.com'
  //   GoatCounter:  provider: 'goatcounter',  code: 'your-code'
  //   Anything else: provider: 'custom', src: 'https://…/script.js', attrs: { 'data-site': 'id' }
  // The Privacy page updates itself to say which one you use.
  analytics: { provider: '', domain: '', code: '', src: '' },

  // ── Reader tools ───────────────────────────────────────────────────────────
  // The "Aa" button in the header: text size, line width, an easy-read font, a dyslexia-friendly font
  // and a high-contrast mode. Choices are saved in the reader's own browser only.
  reader: { enabled: true },

  // Offline reading: after a first visit the site works without a connection, and articles a reader
  // taps "Save for later" on are stored for offline use. Everything stays in their browser.
  offline: { enabled: true },

  // ── Popular articles & view counts (optional; need GoatCounter analytics above) ─
  // popular: a "Popular this month" block in the sidebar. It is fetched while the site builds, so
  //   create a GoatCounter API token (Settings → API, with the "Statistics" permission) and save it as the
  //   GitHub secret GOATCOUNTER_TOKEN (see the README). Without the token the block is simply left out.
  // views: shows "1,234 views" on each article, using GoatCounter's public counter. In GoatCounter, turn on
  //   Settings → "Allow adding visitor counts on your website".
  popular: { enabled: false, days: 30, count: 4, title: 'Popular this month' },
  views: { enabled: false },

  // ── RSS feed ───────────────────────────────────────────────────────────────
  // fullText: true puts the whole article in the feed (best for RSS-to-email services and feed readers).
  feed: { fullText: false },

  // ── Write from a browser (optional) ────────────────────────────────────────
  // Adds /admin/, an editor that saves straight to your GitHub repository (works on a phone).
  // Uses Sveltia CMS. Sign in there with a GitHub token. See the README, "Write from your phone".
  cms: { enabled: false },

  // ── Search & social sharing ────────────────────────────────────────────────
  seo: {
    ogImage: '/og-default.png', // 1200×630, in /public. Used when a page has no image of its own.
    autoImages: true, // make a share card (title on the site colours) for each article without a cover image
    locale: 'en_US',
    twitter: '', // e.g. '@yourhandle' (optional)
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
