# ASRBMY Write — Blogger (Blogspot) theme

1. Blogger dashboard → **Theme** → the arrow beside **Customize** → **Backup / Restore** → **Upload**, choose `asrbmy-write-blogger.xml`.
   (Download your current theme first with **Download** so you can go back.)
2. **Layout → Menu**: add your links (Home, Articles, About…). To make a dropdown, name a link starting with an underscore, e.g. `_Tutorials` — it becomes a sub-item of the link above it.
3. **Layout → Sidebar**: add or remove Popular Posts and Labels (topics). The search box, RSS box and quote are plain HTML: **Theme → Edit HTML** to change the text.
4. **Settings → Comments**: choose *Embedded* so the comment box shows under articles.
5. Colours and fonts: **Theme → Edit HTML**, the `:root{…}` block at the top of the CSS.

What works: dark/light toggle, mobile menu, auto table of contents (3+ headings), reading time, copy button and colouring on code, labels as topics, search, RSS.
Notes: write code in the post editor's HTML view as `<pre><code>…</code></pre>`. Blogger templates can't be tested outside Blogger; if it reports an error on upload, send me the message and I'll fix that line.
