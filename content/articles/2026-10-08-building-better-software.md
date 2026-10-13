---
title: "Building Better Software: Notes, Research & Ideas"
slug: building-better-software
date: 2026-10-08
category: Programming
tags: [programming, productivity, notes]
excerpt: A collection of practical notes, research findings, and ideas for building better software, improving workflows, and staying curious.
featured: true
---

## Introduction

Good software doesn't happen by accident. It's the result of clear thinking, consistent practice, and a willingness to learn. In this article I'm sharing some notes, research insights, and ideas that help me build better software and work more effectively. These are not strict rules, but a personal collection of things that have been useful in real projects and day-to-day work.

The goal is simple: learn, apply, and improve. Whether you're just starting out or have years of experience, there's always something new to explore.

## Technical Notes

Here are some technical notes that I keep coming back to. They cover tools, languages, and general development practices.

| Topic | Tool / Language | Key Takeaway |
| --- | --- | --- |
| Version Control | Git | Small, frequent commits make history easier to manage. |
| Package Management | npm / pip | Use a lock file to keep builds consistent. |
| Code Editor | VS Code | Extensions can save hours of repetitive work. |
| Testing | pytest | Automated tests catch issues early and give confidence. |
| Deployment | GitHub Pages | Static sites are simple, fast and reliable. |

### Why small commits win

A commit that does one thing is easy to review, easy to revert and easy to explain six months later. If you struggle to write a short message for a commit, it is usually trying to do too much.

## Practical Examples

Here are a few small examples that I use in my projects. Feel free to adapt them to your own needs.

### 1. A simple Python script

This script reads a list of numbers and prints their average.

```python
numbers = [10, 20, 30, 40, 50]

average = sum(numbers) / len(numbers)
print(f"Average: {average}")
```

### 2. A helpful Linux command

This command shows disk usage in a human-readable format.

```bash
df -h
```

### 3. Useful resources

- Python Official Documentation — <https://docs.python.org/>
- GitHub — <https://github.com/>
- Mozilla Developer Network — <https://developer.mozilla.org/>

## Frequently Asked Questions

<details class="faq">
<summary>How do I stay consistent with learning?</summary>

Make it small and make it daily. Thirty focused minutes beat a weekend marathon that never gets repeated. Write down one thing you learned at the end of each session.

</details>

<details class="faq">
<summary>What's the best way to organize notes?</summary>

Pick one place and one convention, then stick with it. Plain Markdown files in a folder you can search are hard to beat. See [how I take research notes](/articles/how-i-take-research-notes/) for my setup.

</details>

<details class="faq">
<summary>Which tools do you recommend for beginners?</summary>

A good editor, Git, and one language you stay with long enough to build something real. The [beginner's guide to Python](/articles/learning-python-a-beginners-guide/) is a gentle place to start.

</details>

<details class="faq">
<summary>How can I improve my coding skills?</summary>

Read other people's code, write small programs often, and get feedback. Rebuilding something that already exists is a surprisingly effective way to find the gaps in what you know.

</details>
