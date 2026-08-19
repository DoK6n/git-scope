# Git Scope

> A clean-room reimplementation of the Git Graph concept, rebuilt from scratch with modern improvements. Not derived from the original source code.

A VS Code / Cursor extension that visualizes your commit graph and lets you run git actions directly from it.

## Usage

Command Palette (`Cmd+Shift+P`) → **Git Scope: View Git Graph**

## Features

- **Commit graph**: branch lanes & colors, local/remote/tag badges (combined `branch | origin` badges), HEAD indicator, incremental loading on scroll, line highlighting on hover/click
- **Commit details**: inline expansion below the row, changed files as an icon-themed tree or flat list with `(+added | -removed)` line stats, click to open diffs, commit comparison via Ctrl/Cmd+click
- **Actions**: checkout (double-click a badge to `git switch`), create/delete/rename branches, merge, rebase, cherry-pick, revert, drop, tag, stash, push/pull — destructive actions always require confirmation
- **Enhanced git reset**: choose `--soft` / `--mixed` / `--hard` with a commit target or `HEAD~N`, plus an "undo this commit" shortcut
- **Worktree management**: list/add/remove/move/lock worktrees, worktree badges on the graph, open in a new or current window
- **Glob search & filters**: instant glob patterns (`feature/*`, `release-[0-9]*`) for commit search and branch filtering
- **fetch --prune**: clean up deleted remote branch references right from the fetch button
- **Avatars**: GitHub profile pictures (with disk cache and GitHub sign-in support), Gravatar fallback, and AI co-author icons for `Co-authored-by` trailers
- Auto-refresh: the graph follows any `.git` change — actions in the app or commands in your terminal

## Development

```bash
npm install
npm run build      # host (esbuild) + webview (vite)
npm run check      # typecheck + lint + tests
```

Local packaging: `npx @vscode/vsce package --no-dependencies`

## License

MIT
