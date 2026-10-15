---
title: Understanding Git and GitHub
slug: understanding-git-and-github
date: 2026-09-21
category: Tutorials
tags: [git, github, tutorials]
excerpt: Git tracks your changes on your own computer; GitHub is a place to share them. A short, practical tour of the everyday workflow.
series: Developer Basics
seriesOrder: 3
best: true
---

People often use "Git" and "GitHub" as if they were the same thing. They are not, and knowing the difference makes everything else easier.

## Git versus GitHub

**Git** is a version control tool that runs on your computer. It records snapshots of your project, called commits, so you can see what changed, when, and why.

**GitHub** is a website that hosts Git repositories. It adds collaboration features on top: pull requests, issues, and hosting such as GitHub Pages.

## The everyday loop

Most days you will repeat the same small cycle.

```bash
git status                      # what has changed?
git add notes.md                # stage the change
git commit -m "Add notes on caching"
git push                        # send it to GitHub
```

Check `git status` often; it tells you exactly what Git thinks is going on.

## Branches

A branch is a separate line of work. Create one for each idea so the main branch always stays in a working state.

```bash
git switch -c fix-typo-in-readme
# …edit files, commit…
git push -u origin fix-typo-in-readme
```

## Pull requests

When a branch is ready, open a pull request on GitHub. It shows the difference, lets others comment, and merges the change when everyone is happy. Even on solo projects, reading your own pull request before merging catches surprising mistakes.

## Commands worth memorising

| Command | What it does |
| --- | --- |
| `git clone <url>` | Copy a repository to your computer |
| `git log --oneline` | Show a compact history |
| `git diff` | Show unstaged changes |
| `git restore <file>` | Discard changes in a file |
| `git pull` | Fetch and merge the latest changes |

## Next steps

Once the loop feels natural, learn how to resolve a merge conflict and how to write a clear commit message. Those two skills cover most of the real-world friction.
