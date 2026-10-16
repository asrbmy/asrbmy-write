# ASRBMY Write

A fast, static writing site for GitHub Pages. You write Markdown; a small Node script turns it into plain HTML, with search, categories, tags, an archive, RSS and a sitemap. No database, no login, no framework.

- **Writing is separate from the website:** the Writer app runs on your PC and saves `.md` files; the website is built from those files.
- **Two dependencies:** `marked` (Markdown) and `highlight.js` (code colouring).
- **Theme and content are separate.** Adding an article never touches the design.
- **One config file** (`site.config.js`) controls the name, logo, navigation, footer, colours and fonts.

## Run it locally

Requires Node 20 or newer.

```bash
npm install
npm run dev        # builds, serves http://localhost:4321 and rebuilds when files change
npm run write      # opens the Writer app (see below)
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Generates the site into `dist/` |
| `npm run check` | Verifies every internal link, anchor and asset in `dist/` |
| `npm test` | Security/regression tests, build and check |
| `npm run test:unit` | Only the security and Markdown regression tests |
| `npm run preview` | Serves an existing `dist/` without watching |
| `npm run write` | Starts the Writer app on your computer |

To preview how a project site behaves under a sub-path: `BASE_PATH=/my-repo npm run build && BASE_PATH=/my-repo npm run preview`, then open `http://localhost:4321/my-repo/`.

## Write an article (the Writer app — runs on your computer)

The Writer is a separate program from the website. It runs only on your PC, saves each article as a Markdown (`.md`) file in a folder, and never publishes anything. You then upload the file to your site.

**Start it**

- Windows: double-click **`start-writer.bat`**
- macOS: double-click **`start-writer.command`** (or run `./start-writer.sh`)
- Any system: `npm run write`

It opens in your browser at `http://localhost:4400`. You need [Node.js](https://nodejs.org) installed (the same as for the site).

**Use it**

1. Click **New article**, add a title, category and excerpt, and write in the big box. The right side shows a live preview that uses the website's own styles.
2. It **saves automatically** a few seconds after you stop typing (and with Ctrl/Cmd+S). Each article is one `.md` file.
3. Paste or drag a picture into the text and it is saved to the images folder.
4. Use the toolbar for headings, bold, links, code blocks, tables and FAQ items. The counters beside Title and Excerpt show good lengths for search results.
5. **Build site** checks that the whole website builds with your new article. **Download .md** gives you a copy of the file.

**Writing tools:** pick a **template** (tutorial, research note, essay, quick tip) from the menu beside *New article*; watch the **word-goal** bar fill; press **Focus** for a distraction-free screen (Esc leaves it); press **Publish** to add, commit and push your new articles and images with Git, so GitHub Pages updates the site (needs Git and a repository with a remote; otherwise upload the files on GitHub as described below).

**Settings** are in their own file, **`writer/writer.config.js`**: the folder articles are saved in, the images folder, the port, default category and author, file naming and autosave delay. For example, to keep articles outside the project, set `articlesDir: 'C:/Users/me/Documents/articles'`.

**Put the article on your site** — pick whichever is easiest:

- **Upload on GitHub (no Git needed):** in your repository, open `content/articles`, choose **Add file → Upload files**, drop in the `.md` file (and any images into `public/images`), then **Commit changes**.
- **With Git:** run `git add . && git commit -m "New article" && git push`.

The site rebuilds and goes live in about a minute.

The Writer only listens on your own computer and ignores requests from other sites or machines. Deleting an article moves it to `writer/.trash/`, so you can get it back.

### Or write by hand

Create a file in `content/articles/`, such as `2026-11-02-my-new-post.md`:

```markdown
---
title: My new post
date: 2026-11-02
category: Programming
tags: [notes, ideas]
excerpt: One or two sentences shown in listings and search results.
---

## First heading

Your article, in Markdown.
```

### Front matter reference

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | |
| `date` | yes | `YYYY-MM-DD` |
| `category` | no | One per article. Defaults to `defaults.category` in `site.config.js`. New categories appear automatically. |
| `tags` | no | `[one, two]` |
| `excerpt` | no | Defaults to the first paragraph |
| `slug` | no | URL name. Defaults to the file name without its date prefix |
| `subtitle` | no | Shown under the title instead of the excerpt |
| `author` | no | Defaults to `author.name` |
| `updated` | no | Shows an "Updated" date |
| `series` | no | Name of a multi-part series. Articles with the same name are grouped, with a box listing every part and previous/next links. Pages: `/series/` and `/series/<name>/` |
| `seriesOrder` | no | Part number (1, 2, 3…). Without it, parts are ordered by date, oldest first |
| `cover` | no | Cover image: a file in `public/images` (`/images/cover.jpg`) or an `https://` address. Shown on cards and at the top of the article, and used as the share image |
| `coverAlt` | no | Description of the cover for screen readers |
| `comments` | no | `false` turns comments off for this article |
| `featured` | no | `true` pins it in the home page and sidebar. The newest featured article wins |
| `draft` | no | `true` hides it. Build with `INCLUDE_DRAFTS=1` to see drafts locally |
| `readingTime` | no | Minutes. Calculated from the word count if omitted |

Front matter values must fit on one line. Quote a value that starts with `[` or a quotation mark.

### Scheduled posts

Give an article a date in the future and it is left out of the site until that day. The deploy workflow also rebuilds the site every day (00:30 UTC), so a scheduled article goes live by itself. "Today" is measured in the time zone set as `timezone` in `site.config.js`. The Writer marks future-dated articles as *scheduled*. Build with `INCLUDE_DRAFTS=1` to preview them.

### Comments (optional)

Comments use [Giscus](https://giscus.app), which keeps them in your repository's GitHub Discussions (readers need a GitHub account). Turn on Discussions for the repository, install the Giscus app, copy the ids it shows into the `comments` block of `site.config.js`, and set `enabled: true`. Nothing is loaded from GitHub until a reader presses **Load comments**, so the site stays private by default. Use `comments: false` in an article to switch them off for that page.

### Reading aids

Article pages show a reading-progress bar. On wide screens an "On this page" list stays visible at the top of the sidebar and highlights the section you are reading; on phones the table of contents sits above the article.

### More things you can put in an article

- **Diagrams:** a fenced block starting with ```` ```mermaid ```` is drawn as a flowchart, sequence diagram and more (see [mermaid.js.org](https://mermaid.js.org)). The drawing library is served from your own site, and only on pages that use it.
- **Maths:** `$e^{i\pi}+1=0$` inline, or `$$ … $$` on its own lines. It is rendered at build time. Dollar amounts like $5 and $10 stay as text.
- **Videos:** `@[youtube](VIDEO_ID "Title")` or `@[vimeo](12345 "Title")`. Visitors see a play button; nothing loads from the video site until they press it.
- **Pictures that follow the theme:** put `photo.png` and `photo.dark.png` in `public/images` and write `![Alt](/images/photo.png)`. Light mode shows the first, dark mode the second.
- **Smaller pictures, automatically:** with the optional `sharp` package installed (it is by default), every PNG/JPG in `public/images` gets 480/960/1600px WebP copies and pages use them through `srcset`. Your originals are never changed.
- **Glossary hints:** write terms in `content/glossary.md` (`## Term`, a line, then the meaning; `## Term | alias` for alternatives). The first mention of each term in an article shows its meaning on hover or focus and links to the Glossary page. Turn it off for one article with `glossary: false`.

### Best of, authors, projects, changelog, reading list

- **Best of:** add `best: true` to an article. They appear on `/best/` and in a sidebar list.
- **Authors:** put `author: Name` in an article. Add extra writers in `authors` in `site.config.js`. Each gets a page at `/authors/<name>/`.
- **Projects:** one Markdown file per project in `content/projects/` (title, summary, status, tech, url, repo, cover, order). They appear on `/projects/` and in the menu.
- **Changelog:** edit `content/pages/changelog.md`.
- **Reading list:** every article has **Save for later**. The list lives in the reader's own browser (`/bookmarks/`), never on a server.
- **Share and print:** every article has Copy link, Share, X/LinkedIn/WhatsApp/email, Save and Print/PDF buttons. Printing produces a clean page without menus, with link addresses spelled out.

### Translations

List languages in `languages` in `site.config.js` (the first is the main one). Write the translation as its own article with `lang: hi` and `translationOf: <slug of the original>`. It appears at `/hi/articles/…`, readers get a language switcher, and search engines get `hreflang` links. Menus and buttons stay in the main language; edit their labels in the config. For a right-to-left language add `dir: 'rtl'`.

### Newsletter and analytics (optional)

Both are off until you fill in `newsletter` and `analytics` in `site.config.js`.

- **Newsletter:** a sign-up form under each article (and optionally in the sidebar) that posts to Buttondown, Mailchimp or any service with a form address. No server of your own is needed.
- **Analytics:** Plausible, GoatCounter or a custom script. The Privacy page updates itself to say which one you use, and the Content-Security-Policy allows only that service.

### Reader tools (the "Aa" button)

Every page has an **Aa** button in the header. Readers can change text size, line width, switch to an easy-read font (Atkinson Hyperlegible) or a dyslexia-friendly font (OpenDyslexic), and turn on a high-contrast mode. Choices are stored in their own browser only. The fonts are part of the site (nothing is loaded from a font service) and are only downloaded when someone picks them. Switch the button off with `reader: { enabled: false }` in `site.config.js`.

On articles, readers also get a **"N min left"** pill while scrolling, an **Up next** card at the end (the next part of a series, or the most related article), and, when they select text, a small bar to **copy a link to that passage** (it opens the page scrolled to and highlighting those words in modern browsers) or **copy the quote**. The Archive is grouped by year and month and has a **random article** button.

### Search

Search tolerates typos ("pythn" finds Python), highlights matches, and can be narrowed by category, tag and year, or sorted by newest. Every filter is saved in the page address, so a filtered search can be bookmarked or shared.

### Offline reading

After a first visit the site opens without a connection. Pages you opened are kept, and anything a reader taps **Save for later** on is stored for offline use (the Reading list page and an "offline" page work without internet). It is a service worker (`sw.js`), generated on every build, which fetches pages network-first so readers always get the newest version. Turn it off with `offline: { enabled: false }`. Browsers only allow it on `https://` (GitHub Pages) and `localhost`.

### Share images

Articles without a cover image get an automatic 1200×630 share card (title, category and site name in your colours), so links look good on social networks and chat apps. An SVG cover is also replaced this way, because social networks cannot show SVG. It needs `sharp` (installed automatically; if it cannot be installed the default image is used). Turn it off with `seo: { autoImages: false }`. Titles in non-Latin scripts (Hindi, Arabic…) use the default image.

### Contact form (optional)

The Contact page can include a message form with a "Suggest a topic" choice. The site is static, so the form posts to a form service: create a free form at [Formspree](https://formspree.io), [Web3Forms](https://web3forms.com) or similar, then set in `site.config.js`:

```js
contact: { email: 'you@example.com', form: { enabled: true, action: 'https://formspree.io/f/xxxxxxx', next: 'https://you.github.io/thanks/' } }
```

Messages never pass through this site. The page's Content-Security-Policy is widened for that one address only, and the form has a hidden spam trap field.

### Popular articles and view counts (optional)

Both use [GoatCounter](https://www.goatcounter.com) (free, no cookies). First turn on analytics: `analytics: { provider: 'goatcounter', code: 'your-code' }`.

- **Views on each article:** set `views: { enabled: true }` and, in GoatCounter, *Settings → "Allow adding visitor counts on your website"*. A "1,234 views" label appears once the number is known; if it cannot be read, nothing is shown.
- **"Popular this month" in the sidebar:** set `popular: { enabled: true }`. The list is fetched while the site builds. Create an API token in GoatCounter (*Settings → API*, with the Statistics permission) and save it in GitHub under *Settings → Secrets and variables → Actions* as `GOATCOUNTER_TOKEN`. Without it the block is simply left out. The site rebuilds daily, so the list stays fresh.

### Bring in old writing (WordPress, Blogger, Markdown)

```bash
npm run import -- path/to/export.xml                 # WordPress or Blogger export (detected automatically)
npm run import -- path/to/old-notes-folder           # a folder of .md files (Jekyll, Hugo, Obsidian…)
npm run import -- export.xml --download-images --pages --dry-run
```

*WordPress:* Tools → Export → Posts. *Blogger:* Settings → Manage blog → Back up content (or Google Takeout). Posts become Markdown files in `content/articles/`, with title, date, category and tags filled in; unpublished ones get `draft: true`; YouTube embeds become the site's click-to-play video; scripts are dropped. Nothing is overwritten unless you add `--force`. `--download-images` copies pictures (PNG, JPEG, GIF, WebP up to 8 MB) into `public/images/imported/`; `--pages` also imports static pages. Always read the imported files before publishing: old themes' shortcodes are reported but not converted.

### Check outside links

`npm run links` visits every link that points to another website and lists the ones that are really broken (404, 410, domain gone). Sites that block robots are listed as "could not be checked" and never count as broken. The workflow `.github/workflows/links.yml` runs it every Monday and on demand (Actions tab → *Check outside links* → Run workflow); a failed run emails you.

### Preview drafts and scheduled posts

```bash
npm run dev:drafts      # live preview including drafts and future-dated posts
npm run build:drafts    # the same, as a one-off build
```

Drafts and scheduled posts are tagged **Draft** / **Scheduled**, a yellow banner explains it is a preview, and every page is marked `noindex`. Never deploy this output; the normal `npm run build` hides them.

### Write from your phone (optional)

Setting `cms: { enabled: true }` adds **/admin/**, a browser editor ([Sveltia CMS](https://github.com/sveltia/sveltia-cms)) that opens and saves the Markdown files in your repository, with a form for each front-matter field and an image uploader. Sign in with GitHub (a fine-grained personal access token limited to this repository with *Contents: read and write* works without any server). New articles start as **drafts**; untick *Draft* when you are ready to publish. Each save is a commit, so the site rebuilds by itself. The editor script is loaded from unpkg at a fixed version and checked with an integrity hash (see `scripts/cms.js` to update it). The site must be built on GitHub Actions, or have `repo: 'owner/name'` set.

### Email digest of new posts

The easiest way is to let your email service read the RSS feed: Buttondown, Mailchimp and MailerLite can send a message whenever `/rss.xml` gets a new article. Set `feed: { fullText: true }` so the feed carries the whole article, then point the service at `https://your-site/rss.xml`. Combine it with the newsletter form above so people can subscribe.

### Edit or remove an article

Edit or delete its file in `content/articles/` and commit. Pages, listings, search, feeds and the sitemap all update on the next build.

### What Markdown supports

Headings (a table of contents is built from `##` and `###` when there are three or more), links, images, lists, quotes, tables, fenced code blocks with syntax colouring and a copy button, and raw HTML such as `<details>` for FAQ-style accordions.

- Put images in `public/images/` and reference them as `![Alt text](/images/photo.jpg)`.
- Root-relative links like `/articles/other-post/` are rewritten automatically for project-site base paths.

### Other pages

`content/pages/*.md` become top-level pages (`about.md` → `/about/`). They accept `{{name}}`, `{{author}}`, `{{bio}}`, `{{description}}` and `{{tagline}}`, so these pages follow your config. The Contact page is generated from `contact` and `social` in the config.

## Change the site name, logo and navigation

Open **`site.config.js`**. Change `name` and the header, `<title>`, footer, RSS feed and social metadata all follow. The same file holds the tagline, description, author, navigation (with dropdowns), footer links, social links and sidebar quote.

To change the logo, replace `public/logo.svg` and `public/favicon.svg`, or point `logo` at other files in `public/`.

## Fonts and writing style

Open the site's **Font Tester** (`/font-tester/`), choose a preset or mix a heading font and body font, adjust text size, line spacing and heading weight, and watch a sample article change. Press **Copy setting** and paste the result over the `typography` block in `site.config.js`.

Presets live in **`fonts.config.js`**: editorial, classic, modern, technical, humanist, magazine, slab and terminal. Add your own there. The site uses system fonts only, so there is nothing to download and nothing is sent to a font service.

## Search engines and sharing

Every page gets a title, description, canonical URL, Open Graph and Twitter tags, and structured data (articles, breadcrumbs, and site search). The build also writes a sitemap, an RSS feed, `robots.txt` and a web manifest. `npm run check` fails if a page is missing its description, canonical link, share image, alt text or valid structured data.

Tips for better results:

- Give every article an `excerpt` of about 120–160 characters and a title under 60 characters (the Writer shows counters).
- Replace `public/og-default.png` (1200×630) with your own share image; the icons `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` are in the same folder.
- After deploying, add your site in Google Search Console and submit `/sitemap.xml`.
- Tag pages with fewer than three articles are marked `noindex` so thin pages don't dilute your site.

## Change the theme

Everything visual is a design token in `site.config.js` under `theme` (light) and `themeDark`. Each key becomes a CSS variable, so `accent: '#b8431f'` is `--accent`. You can change background and grid colours, header and navigation colours, accents, fonts, content width (`content-max`), the main/sidebar split (`col-main`, `col-side`), spacing (`gap`) and corner radius.

Layout and component styles are in `src/theme.css`. They only use the tokens, so most restyling needs no CSS edits.

## Deploy to GitHub Pages

1. Create a repository on GitHub and push this project to the `main` branch.
2. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push. `.github/workflows/deploy.yml` builds, checks and publishes the site.

The base path and site URL are detected from the repository name:

- a repository called `<you>.github.io` is served at the root;
- any other repository is served at `https://<you>.github.io/<repo>/`.

For a custom domain, set `url` (and `base: ''`) in `site.config.js`, add the domain under **Settings → Pages**, and set `BASE_PATH=` to empty in the workflow's build step if the repository name would otherwise add a sub-path.

## How it works

```
content/articles/*.md   your writing
content/pages/*.md      About, Privacy, Terms
public/                 logo, favicon, images (copied as-is)
site.config.js          name, navigation, theme tokens
src/                    theme.css, site.js, sw.js (offline), font-tester.js …
fonts.config.js         font presets
writer/                 the Writer app (runs on your PC, not part of the website)
  writer.config.js      Writer settings
scripts/                build.js, markdown.js, templates.js, tokens.js, check.js, serve.js,
                        import.js (WordPress/Blogger/Markdown), linkcheck.js, og.js (share images), cms.js
dist/                   generated output (not committed)
```

## Security

- **No scripts from authors.** Raw HTML in articles goes through an allow-list: `<script>`, `<iframe>`, forms, inline styles, `on…` handlers and `javascript:` / `data:` links are removed or shown as text.
- **Content-Security-Policy** on every page allows only the site's own scripts and styles. To embed something external (a video), add its address to `security.extra` in `site.config.js`.
- **Diagram pages** are the only pages that allow inline styles (the diagram library needs them); every other page does not. Video, comment, analytics and newsletter services are allowed only on the pages that use them, and only the exact addresses involved.
- **Writer app** listens on `127.0.0.1` only, needs a random per-run token, rejects foreign Host headers, writes files atomically and checks that uploaded images really are images.
- **Dev server** (`npm run dev`) is local-only by default and answers malformed URLs safely; set `HOST=0.0.0.0` to share it on your network.
- **Offline support** (`sw.js`) only handles requests to this site, never other websites, and only keeps pages and files the reader already opened or saved. Switch it off with `offline: { enabled: false }`; readers can clear it from their browser's site settings.
- **Contact form, newsletter, comments, analytics and the optional editor** each talk to one fixed outside service and are off until you configure them. The reader-settings choices, reading list and offline copies never leave the reader's browser.
- **The importer** drops scripts and only downloads pictures of an allowed type and size.
- `npm audit` reports no known vulnerabilities in the dependencies.

## Notes

- The sample articles are placeholders. Delete them and add your own.
- Search runs in the browser against `search-index.json`, which holds the full text of every article. That's fine for hundreds of articles; a very large site would want a dedicated search index.
- There is no comment system or contact form, because a static site has no server to receive them.
- Set the `GitHub`, `X` and `LinkedIn` links and `contact.email` in `site.config.js`. Empty entries are hidden.
