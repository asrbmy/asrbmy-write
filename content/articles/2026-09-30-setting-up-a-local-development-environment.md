---
title: Setting Up a Local Development Environment
slug: setting-up-a-local-development-environment
date: 2026-09-30
category: Programming
tags: [tooling, setup, programming]
excerpt: A small, repeatable setup beats a clever one. Here is how I get a new machine ready for development without losing an afternoon.
series: Developer Basics
seriesOrder: 1
cover: /images/cover-setup.svg
coverAlt: Abstract terminal window
---

A new laptop or a fresh clone should not take a day to become useful. The trick is to keep the setup small, write it down, and make it easy to check.

## Start with the smallest useful setup

You need four things on almost every project: an editor, a terminal, Git and the language runtime. Resist installing anything else until a project actually asks for it. Every extra tool is something to update and something that can break.

## Pin your tool versions

"Works on my machine" is usually a version mismatch. Record the runtime version in the repository so everyone, including future you, uses the same one.

- Node projects can use an `.nvmrc` file or the `engines` field in `package.json`.
- Python projects can use a `.python-version` file together with a virtual environment.
- Commit your lock file (`package-lock.json`, `poetry.lock`, `requirements.txt` with pinned versions).

## Keep a setup script

If you do something twice, script it. A short script doubles as documentation:

```bash
#!/usr/bin/env bash
set -euo pipefail

node --version
git --version

npm ci
npm test
```

`set -euo pipefail` makes the script stop at the first problem instead of carrying on with a half-working environment.

## Check that it works

Finish every setup with one command that proves things are healthy: run the tests, build the project, or start the dev server and open it. A setup you have not verified is only a guess.

## Keep secrets out of the repository

Put credentials in environment variables or a local `.env` file, add that file to `.gitignore`, and commit an `.env.example` listing the names (not the values) that a newcomer needs to fill in.
