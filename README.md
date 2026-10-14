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
src/                    theme.css, site.js, font-tester.js
fonts.config.js         font presets
writer/                 the Writer app (runs on your PC, not part of the website)
  writer.config.js      Writer settings
scripts/                build.js, markdown.js, templates.js, tokens.js, check.js, serve.js
dist/                   generated output (not committed)
```

## Security

- **No scripts from authors.** Raw HTML in articles goes through an allow-list: `<script>`, `<iframe>`, forms, inline styles, `on…` handlers and `javascript:` / `data:` links are removed or shown as text.
- **Content-Security-Policy** on every page allows only the site's own scripts and styles. To embed something external (a video), add its address to `security.extra` in `site.config.js`.
- **Writer app** listens on `127.0.0.1` only, needs a random per-run token, rejects foreign Host headers, writes files atomically and checks that uploaded images really are images.
- **Dev server** (`npm run dev`) is local-only by default and answers malformed URLs safely; set `HOST=0.0.0.0` to share it on your network.
- `npm audit` reports no known vulnerabilities in the two dependencies.

## Notes

- The sample articles are placeholders. Delete them and add your own.
- Search runs in the browser against `search-index.json`, which holds the full text of every article. That's fine for hundreds of articles; a very large site would want a dedicated search index.
- There is no comment system or contact form, because a static site has no server to receive them.
- Set the `GitHub`, `X` and `LinkedIn` links and `contact.email` in `site.config.js`. Empty entries are hidden.
