# Changelog

한국어 버전: [CHANGELOG.ko.md](CHANGELOG.ko.md)

## [Unreleased]

### Added (UI & polish)

- Table header (`Graph | Commit | Author | Date | Hash`) with drag-to-resize columns; double-click a divider to auto-fit the visible content (Graph resets to lane-based width)
- Changed files as a **file tree** (default) or flat list, rendered with your IDE's **file icon theme** (SVG and font-glyph themes), with `(+added | -removed)` line stats per file
- **Co-author avatars** from `Co-authored-by` trailers — GitHub-style overlapping stack that slides open on hover; bundled icons for AI co-authors (Claude, Codex)
- Graph **line highlighting** on hover/click, and automatic highlight of the selected commit's line while details are open
- Double-click a branch badge to `git switch` (remote badges create a tracking branch)
- "Create Branch from Here…" on branch badge context menus
- Worktree panel redesign: ✓ current / ✨ main / 🔒 locked indicators, hover actions (open in new/current window), context menu (Move / Repair / Remove / Lock)
- Auto-refresh: a `.git` watcher keeps the graph in sync with any change — in-app actions or terminal commands
- Notifications now use the IDE's native notification area (success and git stderr errors)

### Added (M5 parity)

- Commit actions: **Cherry Pick** (`-x`, `--no-commit`; merges use `-m 1`), **Revert**, **Drop Commit** (rebase --onto) ⚠️, **Rebase** (onto a commit or branch)
- Remote actions: **Push Branch** (`-u`, `--force-with-lease`), **Pull into current**, **Delete Remote Branch** ⚠️, **Fetch into local branch**, **Push Tag**
- **Stash**: stash nodes on the graph (linked to their base commit, hollow dot), Apply/Pop (`--index` option)/Drop ⚠️/Create Branch from Stash/copy name & hash
- Uncommitted row context menu: **Stash** (include-untracked option), **Clean Untracked Files** ⚠️, **Discard All Changes** ⚠️, Open Source Control View
- **Commit comparison**: Ctrl/Cmd+click a second commit → changed files between the two + diffs (compared row marked with a dashed outline)
- Tags: **View Tag Details** (annotated tagger & message), branch label **Select/Unselect in Branches Dropdown**

### Changed (branding & graph visuals)

- Display name GitScope → **Git Scope**
- Original commit-graph icon — extension logo (PNG) and SCM title button (SVG light/dark) share the same glyph. The original Git Graph icon assets are not copied, per clean-room rules
- Branch badges redesigned: dark background + branch-colored border + colored icon chip; badge color matches the commit's **graph line color**; combined `branch | origin` badges with per-segment hover
- Lane-transition curves render at a constant stroke width (fixed a CSS fill bug that fattened curve interiors)
- Graph column width follows the widest lane count and grows as more commits load

### Added (authentication)

- `Git Scope: Sign in to GitHub` — uses the editor's GitHub sign-in flow; clears the avatar cache on success
- `Git Scope: Set GitHub Token (PAT)` — stores the token in SecretStorage (empty input deletes it)
- Token priority: GitHub session → SecretStorage PAT → `GITHUB_TOKEN` environment variable

### Changed

- Author column shows profile pictures — fetched via the GitHub API for GitHub repos (14-day disk cache), Gravatar (identicon) fallback otherwise, hidden when offline. Adds the `Git Scope: Clear Avatar Cache` command
- Commit details moved from a fixed bottom panel to an **inline expansion right below the selected row**, starting after the graph column so lanes stay visible

### Added

- **git reset UI**: choose soft/mixed/hard with a commit target or `HEAD~N`; hard mode always shows an irreversible-loss warning. Includes "Undo this Commit & above" (reset to parent)
- **Glob search & filters**: instant glob patterns (`*`, `?`, `[...]`) for commit search (message/author/hash) and the branch filter — match highlighting, count, prev/next navigation
- **git fetch --prune**: right-click the fetch button; `gitScope.fetchPruneByDefault` setting
- **git worktree**: list/add/remove panel, worktree badges on graph labels, "Open Worktree in New Window" instead of checkout, force-remove reconfirmation on failure
- **Core actions**: commit/branch/tag context menus — checkout (branch/remote/commit), create/delete/rename branches, merge (default/no-ff/squash), create (lightweight/annotated)/delete tags
- Confirmation dialogs for destructive actions (force delete, detached HEAD, …); git stderr shown verbatim on failure; graph refreshes after actions
- Checked-out branches hide checkout/delete/merge menu items
- **Graph MVP**: commit graph rendering — lane layout, branch colors, curved edges, branch/remote/tag labels, HEAD indicator, virtual scrolling, incremental loading
- Uncommitted-changes synthetic node (linked to HEAD, hollow dot)
- Commit details: metadata + changed files, click a file to open its diff
- Toolbar: repository picker (multi-repo), branch filter, fetch, refresh
- Git layer: direct `child_process` spawn, NUL-delimited `--format` parsing (fixture-tested parsers)
