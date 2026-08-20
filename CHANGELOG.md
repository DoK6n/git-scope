# Changelog

한국어 버전: [CHANGELOG.ko.md](CHANGELOG.ko.md)

## [Unreleased]

### Added

- **Stash list panel** — a "Stashes" toolbar button opens a dedicated panel listing all stashes (selector, subject, date); click a row to select it in the graph, right-click for Apply/Pop/Create Branch/Drop, and stash uncommitted changes from the footer button
- Clicking a stash in the panel now **scrolls the graph to that row** (centered, like search navigation) — if the stash is outside the loaded range, more commits are **loaded automatically until it's found**; rows also have **checkboxes for batch drop** — "Drop Selected (N)" deletes highest-index-first so remaining selectors stay valid
- Stashes whose base commit is unreachable from any branch/tag (deleted or rebased-away branch) are marked with an **orphan chip** in the panel — they can't appear on the graph, but Apply/Drop still work
- Stash rows now show a **`stash@{N}` label badge** (box glyph, own SVG per clean-room rules) next to the stash subject, colored by the commit's graph line like branch badges; right-clicking the badge opens the same stash menu

## [0.2.0] - 2026-08-20

### Added

- **Edit Commit Message…** on the commit context menu — reword any commit reachable from HEAD. The dialog opens a textarea pre-filled with the full original message; only the message changes (tree and author info are preserved). HEAD commits use `commit --amend --only`; ancestor commits are rewritten via `commit-tree` + `rebase --rebase-merges --onto` ⚠️ (descendant hashes change — a warning is shown)
- **Git Scope output channel** — every git command the extension runs is logged to the Output panel (command line, exit code, duration, repo path; stderr on failure)
- Fetch is now a **split button** — the ▾ caret opens the fetch options menu (**Fetch (prune)** — clean up refs of remote branches deleted upstream), which was previously reachable only via right-click
- Branches filter dropdown now has a **Tree | List** view toggle — tree groups branches by `/` segments (single-child folder chains compressed), folders collapse/expand, and a folder checkbox selects/unselects all branches beneath it (indeterminate when partial)
- **Drag & drop branch badges** — drag a branch badge (local or remote) onto a local branch badge to choose **Merge into** (checks out the target first if needed) or **Rebase onto** ⚠️ (local sources only; remote sources offer merge only). Drop targets show a dashed outline while dragging

### Fixed

- Dialog warning box text was unreadable in themes where the warning background and `editorWarning.foreground` are both orange — now pairs `inputValidation.warningBackground` with its matching foreground (falling back to the normal foreground), plus a warning border
- Danger buttons now pair `inputValidation.errorBackground` with its matching foreground for readability; a dialog's confirm button no longer turns red just because a warning is shown (the warning box is the signal) — only explicitly dangerous dialogs keep the red button

### Changed

- Avatar stack z-order: the commit **author is now in front**; co-author avatars (including AI co-authors) tuck behind it
- Bundled AI co-author icons now include **Cursor** (`Co-authored-by: Cursor <…@cursor.com>`), alongside Claude and Codex

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
