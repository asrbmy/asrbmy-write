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

  // Aim for this many words per article. The Writer shows a progress bar (0 = hide it).
  wordGoal: 800,

  // "Publish" button: adds your new articles and images to Git, commits and pushes, so GitHub Pages
  // updates the site. It needs Git installed and this folder to be a Git repository with a remote
  // (the setup GitHub shows after you create a repository). Set enabled: false to hide the button.
  publish: { enabled: true, message: 'Add article: {title}' },

  // Starting points shown under "New article". Add your own: { id, label, category, tags, body }.
  templates: [
    {
      id: 'tutorial', label: 'Tutorial', category: 'Tutorials', tags: ['tutorials'],
      body: `## What you will build\n\nOne or two sentences on the result, and who it is for.\n\n## Before you start\n\n- What you need installed\n- What you should already know\n\n## Step 1: \n\nExplain the step, then show it.\n\n\`\`\`bash\ncommand here\n\`\`\`\n\n## Step 2: \n\n## Check that it works\n\nHow the reader can tell they are done.\n\n## Where to go next\n\n- Link to a related article\n`,
    },
    {
      id: 'research', label: 'Research note', category: 'Research', tags: ['research', 'notes'],
      body: `## The question\n\nWhat were you trying to find out?\n\n## What I found\n\n- Finding one\n- Finding two\n\n## Evidence and sources\n\n1. Source, and what it shows\n\n## What I doubt\n\nWhere could this be wrong?\n\n## One line to remember\n\n`,
    },
    {
      id: 'essay', label: 'Essay', category: 'Personal', tags: ['writing'],
      body: `## The idea in one sentence\n\n\n\n## Why it matters\n\n\n\n## The story behind it\n\n\n\n## What I think now\n\n`,
    },
    {
      id: 'howto', label: 'Quick tip', category: 'Notes', tags: ['tips'],
      body: `## The problem\n\n\n\n## The fix\n\n\n\n## Why it works\n\n`,
    },
  ],
};
