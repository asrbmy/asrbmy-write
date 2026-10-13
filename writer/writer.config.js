// ─────────────────────────────────────────────────────────────────────────────
//  ASRBMY Writer — settings for the writing app that runs on YOUR computer.
//  This is separate from the website (site.config.js). Nothing here is
//  published: the Writer only saves Markdown (.md) files into a folder.
//
//  Start it with:  npm run write   (or double-click start-writer.bat / .sh)
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // Where the Writer saves finished articles (.md files).
  // Relative paths start from the project folder. You can also use any folder
  // on your PC, e.g. 'C:/Users/me/Documents/my-articles' or '/home/me/articles',
  // and upload the files to the website's content/articles folder yourself.
  articlesDir: 'content/articles',

  // Images pasted or dropped into an article are saved here.
  // Upload them to the website's public/images folder alongside the article.
  imagesDir: 'public/images',

  // Local address. The Writer only listens on this computer (127.0.0.1).
  port: 4400,
  openBrowser: true, // open the Writer in your browser when it starts

  // Defaults for new articles
  author: '', // empty = use the author name from site.config.js
  defaultCategory: 'Notes',
  categories: [], // extra category names to suggest besides the ones already in use

  // File names: 2026-11-02-my-new-post.md (true) or my-new-post.md (false)
  filenameDate: true,

  // Save to disk automatically this many seconds after you stop typing (0 = manual only)
  autosaveSeconds: 3,
};
