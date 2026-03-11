# GODSend CMS

## Overview

GODSend CMS is a web-based content management system for managing Xbox 360 game downloads. It replaces the original local Go server with a cloud-hosted Node.js application. The system provides an admin panel for managing games, integrates with WordPress (Paid Memberships Pro) for user management, and uses WebDAV (Pydio) for file serving. Includes a downloadable Aurora plugin for Xbox 360.

## Architecture

- **Backend**: Node.js + Express on port 5000
- **Database**: PostgreSQL (Replit built-in) / MySQL (shared hosting) via Sequelize ORM
- **Views**: EJS templates with Tailwind CSS (CDN)
- **Auth**: Session-based authentication with bcrypt password hashing
- **File Storage**: Cover images uploaded to `src/public/uploads/` or external URLs, game files served via WebDAV proxy
- **Xbox Plugin**: Aurora Lua scripts served as downloadable ZIP at `/plugin/download`

## Project Structure

```
index.js                          # Entry point for LiteSpeed/cPanel hosting
src/
├── app.js                    # Express app setup
├── config/
│   └── database.js           # Sequelize DB config (PostgreSQL/MySQL)
├── controllers/
│   ├── apiController.js      # REST API for Xbox plugin
│   ├── authController.js     # Login/logout
│   ├── adminsController.js   # Admin CRUD
│   ├── dashboardController.js
│   ├── gamesController.js    # Game CRUD + WebDAV browse
│   ├── settingsController.js # WebDAV & WordPress config
│   └── usersController.js    # WordPress members list
├── middleware/
│   ├── apiAuth.js             # API token authentication
│   ├── auth.js                # Session auth & role checking
│   └── upload.js              # Multer image upload config
├── models/
│   ├── index.js               # Model associations & DB init
│   ├── Admin.js               # Admin users (super_admin, admin, editor)
│   ├── Game.js                # Games catalog (title_id at game level, STRING platform)
│   ├── GameFile.js            # Game files (game, dlc, tu, translation + file_size in bytes)
│   ├── Attribute.js           # Dynamic attributes (file_type, platform, category)
│   ├── GameCategory.js        # Many-to-many join table (game_id + category_value)
│   ├── Download.js            # Download history tracking (per-file stats)
│   ├── ConsoleDownload.js     # Guest console download tracking (console_id, daily limit)
│   ├── Setting.js             # Key-value settings (timezone, cms_version, etc.)
│   ├── Role.js                # Admin roles with granular permissions (JSON)
│   ├── WebDAVConfig.js        # WebDAV server config
│   └── WordPressConfig.js     # WordPress API config
├── routes/
│   ├── api.js, auth.js, dashboard.js, games.js, attributes.js, downloads.js
│   ├── admins.js, users.js, settings.js, plugin.js
│   ├── update.js               # Database update page (CMS version check + schema sync)
│   ├── about.js                # System info page (version, uptime, DB dialect)
│   └── consoles.js             # Console download tracking admin page
├── services/
│   ├── webdavService.js       # WebDAV client operations
│   ├── wordpressService.js    # WordPress API integration
│   ├── pydioService.js        # Pydio Cells integration (JWT auth, URL generation, WARP streaming)
│   └── downloadTracker.js     # In-memory active download tracking (pause/resume/cancel)
├── views/                     # EJS templates
│   ├── login.ejs, dashboard.ejs, error.ejs
│   ├── partials/ (sidebar, navbar)
│   ├── games/ (index, form, show)
│   ├── admins/ (index, form)
│   ├── users/ (index)
│   └── settings/ (index)
└── public/
    ├── uploads/               # Uploaded cover images
    └── plugin/                # Aurora Xbox plugin files
        ├── main.lua           # Plugin v8.0 (connects to API)
        ├── MenuSystem.lua     # Menu helper module
        ├── JSON.lua           # JSON encode/decode library (for WebUI installer)
        ├── GODSend.ini        # Plugin config (server URL)
        └── Icon/              # Plugin icon assets
```

## Admin Roles

- **super_admin**: Full access, manage other admins
- **admin**: Manage games, settings
- **editor**: Manage games only

## Default Login

- Username: `admin`
- Password: `admin123`

## Install Wizard

- `/install` — Setup wizard for first-time installation or database updates
- Step 1: Database configuration (MySQL/PostgreSQL) with connection test button
- Step 2: Status check (fresh install vs existing data) + admin creation form
- Step 3: Completion with redirect to login
- After installation: only accessible by super_admin (protected by `.installed` lock file)
- Supports: fresh install, schema update (sync alter), DATABASE_URL auto-detection

## Sidebar Downloads

- **Download CMS Node.js**: ZIP of the entire system for shared hosting (admin-only)
- **Download Plugin Xbox**: ZIP of Aurora plugin for Xbox 360 (public)

## API Endpoints (for Xbox plugin)

- `GET /api/categories` — List all game categories (value + label)
- `GET /api/games` — List active games (filterable by platform, search, category)
- `GET /api/games/:id` — Game details with files and categories
- `GET /api/games/:id/files` — File list with download URLs
- `GET /api/download/:fileId` — Download file via WebDAV proxy (supports `?subPath=` for sub-directory files)
- `GET /api/download/:fileId/info` — File info with recursive directory listing (includes sub-folder files with `relative_path`)
- `GET /api/lookup?title_ids=ID1,ID2` — Batch lookup games by title IDs (returns map keyed by title ID with game info + files)
- `GET /api/guest/check?console_id=XXX` — Check if guest console can download today (1/day limit)
- `GET /api/guest/track?console_id=XXX` — Track a guest download by console_id
- `GET /api/games/:id/rate?rating=N&user_id=X|console_id=Y` — Submit 1-5 star rating (upsert per user/console)
- `GET /api/favorites?user_id=X` — List user's favorite games
- `GET /api/favorites/check?game_id=X&user_id=Y` — Check if game is in favorites
- `GET /api/favorites/add?game_id=X&user_id=Y` — Add game to favorites
- `GET /api/favorites/remove?game_id=X&user_id=Y` — Remove game from favorites
- `GET /api/report?file_id=X&type=wrong|corrupted&user_id=Y&console_id=Z` — Report a file as wrong or corrupted
- `HEAD/GET /api/ping` — Connectivity check (HEAD returns 200, GET returns `{status:'ok'}`)
- `GET /api/dbox/description/:titleId` — Proxy to DBox marketplace API for game description (CORS enabled, 24h cache)
- `GET /api/dbox/descriptions?title_ids=ID1,ID2` — Batch description lookup (max 50 IDs)
- `GET/POST /api/games/:gameId/comments` — Game comments (gameId can be DB id or title_id with/without 0x prefix)
- `GET /api/game/by-title-id/:titleId` — Lookup game by title_id, returns description/publisher/release_date
- `GET /plugin/download` — Download Xbox plugin as ZIP
- **CORS**: All `/api/*` routes include `Access-Control-Allow-Origin: *` and handle OPTIONS preflight
- **Comments title_id matching**: Uses `REPLACE(UPPER(title_id), '0X', '')` to normalize both stored and input values (handles `5841140D`, `0x5841140D`, `0X5841140D`)
- **CMS game detail**: `/games/:id` shows comments section with user info and delete buttons
- **Game statuses**: `active` (visible in API/downloads), `inactive` (hidden everywhere), `standby` (visible in CMS only, not in download API — used for auto-created games awaiting download link setup)
- **Auto-creation from comments**: When a WebUI comment is posted for an unregistered title_id, the game is auto-created with `standby` status and Gemini fills description/publisher/release_date
- **Duplicate prevention**: title_id uniqueness enforced in store, update, importCsv, and comment auto-create (all normalize with `REPLACE(UPPER, '0X', '')`)
- **Google Gemini integration**: API key/model config in Settings (`gemini_api_key`, `gemini_model`), service at `src/services/geminiService.js`, auto-complete button in game form
- **WebUI description priority**: CMS game description first (via `/api/game/by-title-id`), dbox.tools fallback if empty

## Xbox Aurora Plugin (v8.0)

The plugin connects to `http://godsend.speedygamesdownloads.com` (configurable via GODSend.ini). Aurora does NOT support HTTPS.
Features: browse all games (alphabet filter for large lists), search by name, filter by platform, browse by category, view game details, download files with drive selection, "My Games" local scanner, downloaded badge tracking, verify installation (check file sizes via download sub-menu), welcome/splash screen with description + registration URL, guest access (1 download/day tracked by console_id), login persistence (auto-login from saved GODSend.ini creds), console info display (Kernel API), logout with credential clearing.
No authentication required in test mode (API_OPEN_ACCESS=true).
All functions wrapped in pcall for crash protection. Detailed error messages shown on failure.
API routes set `Content-Encoding: identity` and `Cache-Control: no-transform` to prevent proxy compression (LiteSpeed compatibility).
Download path strategy: Files download to a short temp folder `{drive}:\0\` (e.g., `Hdd1:\0\t1.tmp`) using ultra-short temp names to avoid FATX path length limits. After download completes, file is renamed to max 12 chars (preserving extension) and moved to the final destination via MoveFile (with CopyFile+Delete fallback). This reduces directory path from ~60 chars (`\Xbox360\System\Hdd1\Aurora\User\Scripts\Utility\GodSend\Downloads\`) to ~23 chars (`\Xbox360\System\Hdd1\0\`), ensuring even long filenames never exceed FATX limits during download.
Game details menu has dedicated "View Description" button; Publisher/Platform labels are non-interactive.
Multi-language support: PT-BR (default), English, Spanish. Language saved to GODSend.ini. First-run shows language selector.
Download progress shows transferred/total with smart units: `200.18 MB / 1.10 GB | 1.90 MB/s | 2m 10s`. Files >= 910 MB display in GB, below in MB. Uses gKnownFileSize from registered file_size for accurate total.
Automatic download retry: minimum 3 attempts (forced floor), configurable 0-10 in Settings. Saved to GODSend.ini (MaxRetries). Incomplete downloads (file size < expected) auto-retry.
Drive selection: Before each download, user can pick install drive (Hdd1, Usb0-4) with current drive pre-selected as default start button.
Abort download: sets gAbortedOperation flag, HttpProgressRoutine returns 0 (not 1) to let Aurora finish HTTP lifecycle gracefully — avoids console freeze. Post-download cleanup deletes incomplete file.
Game-level title_id: Plugin reads title_id from game object, falls back to file-level title_id for backward compat.
My Games: Scans `{drive}:\Content\0000000000000000\` for title ID folders. Batch-looks up IDs via `/api/lookup` endpoint. Registered games show by name with full download menu; unregistered show as `[TITLEID]` with "coming soon" message. Scan drive saved to GODSend.ini (MyGamesDrive). First access prompts drive selection.
Downloaded badge: In-memory tracking via gDownloadedFileIds table. After successful download (single, bulk, or retry), file ID is marked. Game details view shows "(Baixado)" / "(Downloaded)" / "(Descargado)" badge next to already-downloaded files. Resets on script restart.
Attributes system: File types, platforms, and categories are configurable via /attributes admin page. Seeded with defaults on first run. Categories are many-to-many via GameCategory join table (game_id + category_value). Default categories: Ação, Aventura, FPS, RPG, Corrida, Esportes, Plataforma, Luta, Puzzle, Estratégia, Simulação, Terror. Games can have multiple categories assigned via checkboxes in the game form. Categories shown as badges on game detail and index pages.
Category browsing in plugin: Fetches categories from GET /api/categories, shows category list sub-menu, filters games by selected category.
Verify installation: Available via download sub-menu when game is installed (detected by scanning installed games for title_id match). Checks all game files on Xbox filesystem — compares existence and file sizes against server info endpoint. Reports OK/missing/wrong-size files. Offers re-download of problematic files.
Download sub-menu: When clicking a file, shows sub-menu with "Baixar Arquivo", "Verificar Instalação" (verify only shown if game is installed), and "Reportar Item" (report file as wrong or corrupted). Guest downloads check server-side limit via /api/guest/check before proceeding.
Welcome screen: Shown before login (skipped if auto-login succeeds). Displays plugin description, registration URL (speedygamesdownloads.com), membership promo. Options: Guest Access (1 download/day tracked by console_id) or Login (Member).
Login persistence: After successful login, credentials saved to GODSend.ini (SavedLogin, SavedPassword, SavedUserId). On next startup, auto-login attempted silently. If credentials invalid, cleared from ini and normal welcome screen shown.
Console Info: Menu option showing Kernel Version, Console Type, Motherboard, Serial, Console ID, DVD Key, CPU Key via Aurora Kernel API. Console ID also used for guest download tracking.
Nova WebUI: Integrated WebUI installer accessible via Settings menu (moved from main menu). Sub-menu with: Install New WebUI (from `webuis/` subfolder), Backup Current WebUI (copies `Game:\Plugins\WebRoot` to named backup), Update titles.json (reads Aurora SQLite DB via `Sql.ExecuteFetchRows` to build game info JSON with art URLs). Requires `sql` permission. Uses `JSON.lua` library for encoding. Plugin folder includes `JSON.lua` alongside `main.lua`. The modernized Nova WebUI is bundled in the plugin download ZIP at `GODSend/webuis/Nova/`.
Logout: Clears login state and saved credentials from GODSend.ini, returns to welcome screen.
CMS Update page: /update (super_admin only) — compares CMS_VERSION (2.0.0) with stored version in Settings. If different, runs sequelize.sync({alter:true}) to update schema without reinstalling.
CMS About page: /about — shows CMS version, Node.js version, DB dialect, server uptime.
Console tracking: /consoles admin page — lists all Xbox consoles that have downloaded as guests, with download stats (console_id, downloads today, total downloads, first/last seen). Ban/unban toggles via AJAX.
Reports page: /reports admin page — lists file reports (wrong/corrupted) submitted from plugin. Filterable by file type. Shows game title, file name, report type, reporter. Delete button. Requires manage_settings permission. FileReport FK uses CASCADE on delete (auto-migrated on startup for existing DBs).
Game ratings: 5-star rating system. One vote per user (wp user) or console (guest). Stored in GameRating model. Average shown in game details API response, plugin game details menu, and CMS game list/detail pages (yellow star badge with avg + vote count).
Game favorites: Logged-in users can add/remove games from their favorites list. "Minha Lista" in plugin main menu shows all favorites with direct access to game details.
Download counting: GameDownloadCount tracks unique console downloads per game. Count displayed on game list and detail pages in CMS.
Subscription expiration: authLogin API returns days_remaining from WordPress membership. Plugin shows "Assinatura expira em: X dias" in account info. Shows "expirada" if expired.
Game form: Title ID is at game level only (removed from per-file rows). File size input uses number + unit dropdown (KB/MB/GB) — converted to bytes on save, auto-selects best unit when editing.
Pagination: Games list supports 15/30/50 items per page with selector UI.
Downloads page: /downloads shows today's download stats (total, completed, cancelled, transferred bytes), active downloads with cancel buttons, and paginated historical table (15/30/50 items) with smart pagination (±3 pages, first/last, ellipsis). Active downloads refresh every 3 seconds via AJAX. Download model logs every file download (game_file_id, game_title, file_name, file_size, bytes_transferred, status, client_ip, user_identifier). User identifier populated from console_id or wp_user_id on download. Date range filters: quick buttons (Hoje, Semana, Mês, Ano, Tudo) and custom date picker (De/Até) with bandwidth summary for filtered period. HTML escaping (escHtml) applied to all dynamic values in JS-rendered history. In-memory tracker (downloadTracker.js) manages active stream references for cancel.
Dashboard: Recent games section with smart pagination (15/30/50 items per page).
Games views: Gallery grid and list view toggle (saved to localStorage). List view includes edit button for quick access.
Games import/export: CSV export of all games, CSV template download, CSV import with error handling. Routes: GET /games/export-csv, GET /games/csv-template, POST /games/import-csv.
Settings: Timezone selector (Configurações > Fuso Horário). Saved in Setting model. Applied globally via middleware for date/time formatting (formatDate, formatDateTime, formatTime helpers in res.locals).
Collapsible sidebar: Toggle button collapses sidebar to icon-only mode. State persisted in localStorage.
Header logout: User avatar dropdown in navbar with username/role display and logout button.
Admin roles: /admins/roles subpage for managing roles and granular permissions. Role model with permissions JSON. System roles (super_admin, admin, editor) seeded on first run. Custom roles can be created with specific permissions (manage_games, manage_attributes, manage_downloads, manage_users, manage_settings, manage_admins). Sub-permissions: games_delete (can delete games), games_edit_others (can edit games by other admins). Games track created_by admin ID. Sub-permissions displayed indented under manage_games in roles UI with auto-check parent/child behavior.
Filename handling: Server-side safeFileName() sanitizes filenames (replaces unsafe chars) without length truncation, preserving identity-critical names like Xbox Title IDs. Plugin uses short temp names during download (`t1.tmp`, `t2.tmp`). For simple files, renames to max 12 chars after download. For games with `.data` companion folders (detected via `hasSubPaths` flag from `/info` endpoint), preserves original filenames exactly to maintain the main-file-to-data-folder link. Sub-folder files use `relative_path` field and `subPath` query param to download from correct WebDAV sub-directories.
SPA Navigation: `src/public/js/spa.js` intercepts all internal link clicks and form submissions to load pages via AJAX without full reload. Extracts `<main>` content from fetched HTML, swaps it with smooth opacity transition, updates URL via pushState, updates sidebar active state, and re-executes inline scripts (including external `<script src>` tags and `<link>/<style>` tags for pages like Blog editor that load Quill CDN). Handles timer cleanup (setInterval/setTimeout) between page transitions. Loaded via sidebar partial. Excludes: login, logout, install, API, file downloads, multipart forms.
Users page: /users shows WordPress members with "Último Acesso" column cross-referenced from UserProfile.last_seen (set on login). Shows formatted date or "Nunca" for users who never logged in via the WebUI/plugin.

## WordPress Plugin (GODSend API Bridge)

A WordPress plugin (`src/public/wp-plugin/godsend-api.php`) that provides a custom REST API endpoint for fetching all WordPress users with their PMPro membership levels. Solves the WP REST API 100-user limit and the lack of PMPro level data in standard endpoints.
- Endpoint: `/wp-json/godsend/v1/members` — Returns all users with level_id, level_name, status
- Endpoint: `/wp-json/godsend/v1/stats` — Returns user counts and PMPro levels
- Auth: Basic Auth (WP admin credentials) or Bearer token (generated in WP Settings > GODSend API)
- Params: `page`, `per_page` (max 500, 0=all), `search`
- Download: `/plugin/download-wp-plugin` (admin-only, ZIP format)
- The WordPress service auto-discovers this endpoint first, falling back to PMPro/WP Users APIs

## Player Profile System (Phase 1)

Backend models and API endpoints for a social player profile system integrated with WordPress authentication.

**Models:** `src/models/UserProfile.js`, `Friendship.js`, `GameComment.js`, `UserAchievement.js`, `UserGameStats.js`, `GameRoom.js`, `GameRoomParticipant.js`, `Notification.js`

**API Endpoints (under /api):**
- `POST /api/profile/login` — WordPress auth, creates/updates UserProfile, returns JWT token
- `GET/PUT /api/profile/:id` — Get/update profile
- `GET /api/profile/:id/stats` — Game stats + achievements
- `GET/POST /api/profile/:id/friends` — Friends list (includes friends, pending_requests, sent_requests) / send request
- `GET /api/profile/setPrimaryXuid` — Set primary XUID (hex validated), generates 7-char friend code
- `GET /api/profile/lookup` — Lookup user by friend code (7 hex chars)
- `PUT/DELETE /api/profile/friends/:id` — Accept/reject/remove friend
- `GET/POST /api/games/:id/comments` — Game comments (supports title_id lookup)
- `DELETE /api/games/:id/comments/:commentId` — Delete own comment
- `GET /api/profile/:id/achievements` — User achievements
- `POST /api/profile/:id/gamestats` — Update game stats
- `GET /api/profile/:id/notifications` — Notifications
- `PUT /api/profile/notifications/:id/read` — Mark as read
- `GET /api/push/vapid-key` — VAPID public key for push subscriptions
- `POST /api/profile/push/subscribe` — Save push subscription

**Game Rooms (under /api/rooms):**
- `POST /api/rooms` — Create room (title, game, schedule, max players, public/private)
- `GET /api/rooms` — List public rooms (filters: upcoming, game_id)
- `GET /api/rooms/:id` — Room details with participants
- `PUT/DELETE /api/rooms/:id` — Update/cancel room (creator only)
- `POST /api/rooms/:id/join` — Join room
- `POST /api/rooms/:id/leave` — Leave room
- `POST /api/rooms/:id/invite` — Invite friends
- `GET /api/rooms/my` — My rooms

**Achievement Service:** `src/services/achievementService.js` — Auto-awards achievements on download completion (first_download, downloads_10/50/100, gold_member, vip_member, first_comment, first_room, social_butterfly_5_friends)

**Push Notifications:** `src/services/pushService.js` — Web Push via VAPID keys. Service worker at `src/public/nova-webui/sw.js`. Push triggered on: friend requests, room invites, room join/leave, room cancellation.

**Auth:** `src/middleware/profileAuth.js` — JWT token-based auth for profile endpoints

**WebUI Integration:**
- Home page: CMS login form (when logged out) or profile card with stats/achievements (when logged in)
- Rooms page: Browse public rooms, create rooms, join/leave, invite friends, "Minhas Salas" tab
- Game detail: "Comentários" tab with add/delete comments
- Push notification permission requested on CMS login

## Phase 2: CMS Social CRUD + WebUI Offline/Online + Dual Achievements

**CMS Admin Social Pages:**
- `src/controllers/socialController.js` — Admin CRUD for Rooms, Comments, Achievements, Profiles
- `src/routes/social.js` — Social routes under `/social/*` (requireAuth + checkSocialPermission)
- `src/views/social/` — EJS templates: rooms.ejs, room-form.ejs, comments.ejs, achievements.ejs, achievement-form.ejs, profiles.ejs, profile-detail.ejs, profile-edit.ejs
- Sidebar: Social section with Salas, Comentários, Conquistas, Perfis links (visible to super_admin/admin/manage_settings)

**StixAchievementDef Model:**
- `src/models/StixAchievementDef.js` — Achievement definitions (key, name, description, icon, category, auto_rule JSON, active, sort_order)
- Seeded with 9 defaults on first run (download/social/membership categories)
- `src/services/achievementService.js` — Reads from DB first, falls back to hardcoded catalog. Supports auto_rule types: downloads, comments, rooms, friends, membership

**WebUI Offline/Online Mode:**
- `state.isOnline` flag in app.js — Detects via `navigator.onLine` + HEAD request to CMS `/api/ping`
- Backend `/api/ping` route defined in `src/routes/api.js` (HEAD returns 200, GET returns JSON `{status:'ok'}`)
- When offline: Shows banner "Offline — apenas recursos do console disponíveis", hides Rooms nav, hides CMS login/profile section, hides Comments tab in game detail
- Listens to browser `online`/`offline` events for dynamic switching
- `NovaAPI.checkOnline(callback)` in nova-api.js

**CMS URL Configuration (WebUI):**
- `getCmsUrl()` reads from `localStorage('nova_cms_url')`, falls back to `window.location.origin`
- `setCmsUrl(url)` saves to localStorage (strips trailing slashes), or clears if null
- Settings page has "GODSend CMS" card with URL input, save button, and connection status indicator
- `loadSettingsCms()` function in app.js renders the card and tests connectivity
- Plugin download ZIP (`/plugin/download`) auto-injects `cms-config.js` with server URL (only sets if not already configured)
- `src/public/nova-webui/js/cms-config.js` — empty placeholder, overwritten in downloaded ZIP
- `src/public/nova-webui/index.html` loads `cms-config.js` before `nova-api.js`

**Dual Achievement System in WebUI:**
- Home profile section: "Conquistas Stix" with STIX badge, emoji icons, unlock dates
- Game detail: "Game Achievements" (Xbox, from Aurora API) + "Conquistas Stix" count badge (when logged in)
- Profile "Visão Geral" tab: "Conquistas Xbox" section showing harvested Xbox achievements with icon, name, description, date
- `NovaAPI.getStixAchievements(profileId, callback)` in nova-api.js
- `NovaAPI.getUserAchievements(profileId, callback)` in nova-api.js — fetches user's harvested Xbox achievements
- CSS: `.offline-banner`, `.cms-ach-badge-stix`, `.cms-ach-icon-emoji`, `.cms-ach-date`, `.stix-ach-count-badge`, `.profile-xbox-ach-*`

**Room Chat:**
- Chat input is disabled (hidden) when room status is `finished` or `cancelled` — messages remain visible (read-only)
- Backend `sendRoomMessage` rejects messages for finished/cancelled rooms

**Profile Page:**
- Share button removed (copy button is sufficient)
- Xbox profile card (friend code) moved from "Visão Geral" tab to info popup triggered by "i" icon in profile header
- `loadXboxProfileSelectorInto(container)` renders Xbox profile selector in any target container

**Game Detail:**
- "Now Playing" badge positioned to the right of the game title (flex row layout)
- "Play Trailer" button rendered below "Launch Game" in the sidebar (via `#sidebar-trailer-btn-wrap`)
- Favorite heart button: fixed `wp_user_id` availability in profile refresh, CSS z-index increased to 10

## Phase 3: Blog, Favorites WebUI, Public Profiles, Room Chat, Crown Icon

**Blog System:**
- `src/models/BlogPost.js` — Model (admin_id, title, content TEXT, cover_image_url, published, published_at, category_id FK, pinned BOOLEAN)
- `src/models/BlogCategory.js` — Categories (id, name, slug unique, description)
- `src/controllers/blogController.js` — Admin CRUD + `apiListPublished` public API (supports `?category=slug` filter, auto-publishes scheduled posts)
- `src/controllers/blogCategoryController.js` — Category CRUD with post count
- `src/routes/blog.js` — Admin routes under `/blog` (manage_settings permission), image upload endpoint with multer error handling
- `src/routes/blogCategories.js` — Category routes under `/blog/categories`
- `src/views/blog/index.ejs`, `form.ejs`, `categories.ejs`, `category-form.ejs` — Admin blog management pages
- Blog form uses Quill.js rich text editor (CDN) with image upload support (uploads to `/uploads/blog/`)
- Blog editor features: "Ver HTML" toggle (raw HTML textarea mode with sync), custom link dialog with "Abrir em nova aba" checkbox (sets `target="_blank"` + `rel="noopener noreferrer"`), custom Link blot with protocol sanitization
- Scheduled publishing: `published_at` datetime picker, auto-publishes when date passes (checked on list/API load)
- Pinned posts: `pinned` flag, pinned posts always appear first in API and WebUI
- Pagination: 15/30/50 items per page with category filter
- `GET /api/blog/posts` — Public API (paginated, newest first, published only, pinned first, category filter)
- Sidebar: Blog submenu with "Posts" and "Categorias" links
- WebUI Home: "Novidades" section shows latest 5 published blog posts with pin badges, clickable to detail view

**Blog Comments:**
- `src/models/BlogComment.js` — Model (blog_post_id FK, user_profile_id FK, comment_text TEXT, createdAt, updatedAt)
- API: `GET /api/blog/posts/:id/comments` (public, paginated), `POST /api/blog/posts/:id/comments` (profileAuth), `DELETE /api/blog/posts/:id/comments/:commentId` (profileAuth, own only)
- CMS: `DELETE /blog/:id/comments/:commentId` (admin, any comment). Comments section shown below post form when editing, with admin delete buttons
- WebUI: Comments section below blog post detail, login prompt for non-authenticated users, delete own comments
- XSS protection: escapeHtml on all user-generated content in both WebUI and CMS renderers

**Favorites in WebUI:**
- `NovaAPI.checkFavorite()`, `addFavorite()`, `removeFavorite()`, `listFavorites()` — API wrappers using wp_user_id
- Game detail: Heart icon button (top-right of banner) for logged-in users on `active` status games only (not standby)
- Profile page: Redesigned social-media-inspired layout with large avatar (84px, accent border, glow), level overlay badge, level pill tag, bio text, stats row (friends count + downloads), action icon buttons (copy friend code, share). Tabbed navigation: "Visão Geral" (favorites + Xbox profile), "Estatísticas" (partidas/game stats), "Amigos" (add friend, friends list, pending requests). Favorites shown as horizontal scrollable cards with cover art, playtime overlay badge, and click-to-navigate
- `GET /api/profile/:id/favorites` — Returns user's favorited active games (maps profile ID to wp_user_id)
- `NovaAPI.getUserFavorites(profileId, callback)` — Fetch user favorites by profile ID

**Clickable Commenter Profiles:**
- Comment author names are links (`.comment-author-link`) that open the commenter's public profile
- `showUserPublicProfile(profileId)` — Renders a public profile view in the games page area
- Public profile shows: avatar, name, level, stats, achievements, and favorites
- Uses `NovaAPI.getUserPublicProfile()`, `getUserPublicStats()`, `getUserFavorites()` API functions
- Back button returns to previous game detail or games list

**Room Chat:**
- `src/models/RoomMessage.js` — Model (room_id, user_profile_id, message TEXT, createdAt)
- `GET /api/rooms/:id/messages` — List messages (supports `?after=lastId` for polling)
- `POST /api/rooms/:id/messages` — Send message (auth required, must be participant)
- WebUI: Chat section in room detail for participants/creator, auto-polls every 5 seconds
- Own messages right-aligned with accent color

**Room Creator Crown:**
- Room participant list shows a crown SVG icon next to the room creator's name (replaces "Host" text badge)
- `.room-crown-badge` CSS class with golden crown icon

**Room Server Type:**
- `server_type` field on GameRoom model: `'system_link'` (default) or `'stealth_server'`
- Room creation form includes "Tipo de Servidor" selector (System Link / Servidor Stealth)
- Room cards and detail view show server type badge (blue for System Link, purple for Stealth)
- CSS: `.room-server-badge.syslink`, `.room-server-badge.stealth`

**Room Game Filter:**
- Public rooms listing has game filter dropdown (only shows games that have active rooms)
- Client-side filtering via `roomsGameFilter` state variable
- CSS: `.rooms-game-filter`

**Events System:**
- `src/models/Event.js` — Model (admin_id, title, description TEXT, event_type STRING(100), cover_image_url, event_date DATE, event_url, published BOOLEAN)
- `src/models/EventType.js` — Dynamic event types (id, name, slug unique, color STRING, createdAt). Seeded defaults: Sorteio (#a78bfa), Live (#ef4444), Torneio (#f59e0b), Outro (#8b8ba3)
- `src/controllers/eventController.js` — Admin CRUD + `apiListUpcoming` public endpoint + cover image upload
- `src/controllers/eventTypeController.js` — EventType CRUD (list, create, edit, delete). On update migrates events to new slug. On delete moves events to "outro"
- `src/routes/events.js` — Admin routes under `/events` (manage_settings permission), includes `POST /events/upload` for cover image upload
- `src/routes/eventTypes.js` — Routes under `/events/types` (registered before `/events` in app.js)
- `src/views/events/index.ejs`, `form.ejs`, `types.ejs`, `type-form.ejs` — Admin event management pages with smart pagination (±3 pages, ellipsis), per-page selector (15/30/50)
- `GET /api/events` — Public API (upcoming published events)
- Sidebar: "Eventos" submenu with "Lista" and "Tipos" sub-items (like Blog pattern)
- WebUI Home: "Eventos" section showing upcoming events with type badges, countdown timers, click-to-open-url
- `NovaAPI.getEvents(callback)` in nova-api.js
- Event type badges use dynamic colors from EventType model
- Auto-migration: ENUM→VARCHAR(100) for existing databases on startup

**Dashboard Overhaul:**
- Stats summary row: Downloads Today, Total Posts, Total Comments, Active Rooms
- Cards: Recent Posts (2), Recent Comments (5), Recent Rooms (3), Reports (5), Download Stats (day/week/month/year)
- Quick-action buttons: Novo Post, Novo Evento, Novo Game
- Kept: WebDAV/WordPress status, platform breakdown, games listing with pagination
- Uses GameDownloadCount, BlogPost, GameComment, GameRoom, FileReport models

**Sidebar Redesign:**
- Collapse button moved to header area (top-right next to GODSend logo)
- Download buttons moved from absolute-bottom section to "Downloads" submenu in nav
- "Atributos" is now a submenu under "Games"
- "Blog" is a submenu with "Posts" and "Categorias" sub-items
- Nav is scrollable (overflow-y-auto) to prevent overlap
- Generic `toggleSubmenu(name)` function for all submenus (games, blog, sobre, dl)

**WebUI Achievement Auto-Refresh:**
- Fixed: `title` event listener now triggers `loadAchievements(detailTid)` when detected game matches currently viewed game detail
- Works together with existing `notification` listener for ongoing achievement updates

**WebUI Profile "Minhas Partidas":**
- `GET /api/profile/:id/gamestats` — Returns UserGameStats with Game info (title, cover_image)
- `NovaAPI.getUserGameStats(profileId, callback)` in nova-api.js
- Profile page section: Time filter buttons (Todos, Dia, Semana, Mês, Ano), summary row (playtime today/week/month/year), per-game list with cover, playtime, launch count, last played
- CSS: `.partidas-filter-bar`, `.partidas-summary-grid`, `.partida-item`

**WebUI Timezone-Aware Greeting:**
- Home page shows "Bom dia/Boa tarde/Boa noite, [name]" based on user's local time

**Timezone Preferences:**
- `getUserTimezone()` / `setUserTimezone()` — stored in `localStorage('nova_timezone')`
- Default: `America/Sao_Paulo` (Brasília)
- All room times displayed using user's selected timezone (not room creator's)
- Room creation sends user's timezone
- Settings page: "Preferências > Fuso Horário" section with 16 timezone options:
  - 4 Brazilian: Brasília, Manaus, Rio Branco/Acre, Fernando de Noronha
  - 12 international: NY, Chicago, Denver, LA, Mexico City, Buenos Aires, London, Paris, Berlin, Moscow, Tokyo, Sydney

## Key Dependencies

- express, ejs, sequelize, mysql2, pg, bcryptjs
- express-session, connect-session-sequelize
- multer (image uploads), axios (HTTP client), webdav (WebDAV client)
- socks-proxy-agent (SOCKS5 proxy for WARP downloads)
- archiver (ZIP creation for plugin download)
- web-push (Web Push notifications via VAPID)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (Replit auto-set)
- `DB_DIALECT` — Database dialect when not using DATABASE_URL (mysql/postgres)
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT` — Manual DB config
- `SESSION_SECRET` — Session encryption key
- `API_OPEN_ACCESS` — Set to "true" to disable API auth check
- `FORCE_HTTPS` — Set to "true" only if site uses HTTPS (default: false for HTTP hosting)
- `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_EMAIL` — Initial admin credentials
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — VAPID keys for Web Push notifications
- `VAPID_SUBJECT` — Contact email for VAPID (default: mailto:admin@speedygamesdownloads.com)

## VPS Installation

The CMS can be installed on a clean Ubuntu Server 24 VPS (no control panel needed) for dedicated download speeds.
See `INSTALL_VPS.md` for a complete step-by-step guide in Portuguese (beginner-friendly).

**Key files for VPS deployment:**
- `INSTALL_VPS.md` — Complete installation guide (Ubuntu Server 24, nginx, PM2, MySQL)
- `.env.example` — Environment variables template
- `ecosystem.config.js` — PM2 process manager config

**Stack:** Ubuntu Server 24 + Node.js 20 + MySQL 8 + nginx (reverse proxy) + PM2 (process manager)
**Domain:** stix.speedygamesdownloads.com

**Pydio Cells Direct Download:**
When configured and active in Settings > Pydio Cells, downloads bypass the VPS entirely. The CMS authenticates with Pydio Cells to get a JWT token, then generates direct download URLs (`{base_url}/io/{workspace}/{path}?pydio_jwt={token}`). The Xbox plugin and CMS web interface use these URLs to download directly from the Quotaless/Pydio server. Falls back to WebDAV proxy if Pydio is not configured or URL generation fails.
- Config model: `src/models/PydioConfig.js` (base_url, username, password, workspace, is_active, warp_proxy_enabled, warp_proxy_port)
- Service: `src/services/pydioService.js` (multi-method JWT login with cascading fallbacks, cache, URL generation with aggressive path deduplication, WARP SOCKS5 proxy streaming)
- **Authentication methods** (tried in order): 1) API REST `/a/frontend/session`, 2) OIDC password grant `/auth/dex/token`, 3) Web form login `/login` with cookie extraction, 4) Full OIDC flow `/oidc/oauth2/auth`
- **Path deduplication**: `cleanFilePath()` loops to strip repeated `io/`, workspace, and `ws-{workspace}` prefixes from file paths, preventing `io/io/` duplication in URLs. Also strips `/io` from base_url if user included it.
- **Directory resolution**: `downloadFile` first resolves directory paths via WebDAV (stat + getDirectoryContents) to find the actual file, THEN generates direct URL. This is critical because most `server_path` values point to Xbox content directories (e.g., `000D0000/`), not individual files.
- API: `downloadFile` returns JSON `{direct_url}` for Xbox or 302 redirect for browsers; `downloadFileInfo` includes `direct_url` per file
- Plugin: `main.lua` uses `direct_url` from file info when available, calls CMS endpoint for tracking only
- Download records use status `'direct'` for tracking without streaming
- Settings UI: Test connection shows which login method succeeded, sample URL preview, and JWT preview for debugging

**Download Architecture (Direct URL + CDN Proxy):**
Both browser and Xbox/API clients receive direct Pydio URLs for downloads. The CMS never proxies/streams file data — it only generates authenticated URLs and redirects clients. For CDN/Tunnel downloads, the Xbox plugin reports download progress back to the CMS via `GET /api/download/report` endpoint (started/progress/completed/failed/cancelled). The `downloadTracker.js` service handles both proxied downloads (with stream objects) and external/CDN downloads (reported by plugin). External downloads auto-cleanup after 10 minutes of inactivity.
- **Browser**: 302 redirect to Pydio HTTP URL (direct to Quotaless)
- **Xbox/API**: JSON response with `direct_url` field. When CDN Proxy URL is configured, URLs use the CDN proxy instead of direct Quotaless (needed because Xbox doesn't support HTTPS and Quotaless forces HTTPS)
- **CDN Proxy**: nginx on VPS acts as HTTP→HTTPS reverse proxy. Xbox downloads via HTTP from `cdn.speedygamesdownloads.com`, nginx fetches via HTTPS from Quotaless. Config field: `cdn_proxy_url` in PydioConfig model. Configured in Settings > Pydio Cells > CDN Proxy section.
- **nginx config**: Separate server block for `cdn.speedygamesdownloads.com` with `proxy_pass https://drive.quotaless.cloud` and optimized streaming settings (proxy_buffering off, large timeouts).
- **Fallback**: If Pydio URL generation fails, falls back to WebDAV proxy download
- **Cloudflare WARP (VPN)**: Cloudflare WARP installed on VPS routes all traffic through Cloudflare's optimized network. Two modes: Proxy SOCKS5 (port 40000, recommended) and Full Tunnel (experimental, can cause residual network issues). Settings visible in CMS Settings > Pydio Cells > Cloudflare WARP section with enable toggle, port config, and "Testar WARP" button. When WARP is enabled and CDN Proxy URL is NOT configured, CMS streams downloads via WARP SOCKS5 (`streamViaWarp` in pydioService.js). Speed test supports `?via=warp` param. Test endpoint: `POST /settings/warp/test`. Installation guide: `CLOUDFLARE_WARP.md`. **NOTE**: WARP changes the VPS routing, not the client routing. Tests showed it does NOT improve Xbox download speed when the bottleneck is geographic (VPS in Dallas, Xbox in Brazil).
- **Cloudflare Tunnel (RECOMMENDED for speed)**: Creates a secure connection from VPS to Cloudflare's network. The Xbox connects to the nearest Cloudflare edge server (e.g. in Brazil) instead of directly to the VPS. Flow: Xbox (Brazil) → Cloudflare Edge (Brazil, low latency) → Cloudflare Backbone → VPS (Dallas) via tunnel → nginx CDN proxy → Quotaless. Free tier has no bandwidth limits. Optional Argo Smart Routing ($5/month + $0.10/GB) adds real-time optimized routing (~30% faster). Installation guide: `CLOUDFLARE_TUNNEL.md`. Requires: domain DNS managed by Cloudflare, Configuration Rule to allow HTTP on CDN hostname only (zone SSL stays Full/Strict), cache bypass for JWT URLs.

## Nova WebUI (Modernized)

A modernized Nova WebUI for Xbox 360 Aurora dashboard, located at `src/public/nova-webui/`. This is a standalone static web application that runs on Aurora's built-in HTTP server (port 9999) on the Xbox.

**Design:** Mobile-first dark theme with bottom navigation bar, modern card-based UI.

**Structure:**
```
src/public/nova-webui/
├── index.html            # Single-page app shell
├── css/app.css           # Complete styles (dark theme, responsive)
├── js/
│   ├── nova-api.js       # Aurora REST API client (all endpoints)
│   └── app.js            # App logic (pages, rendering, state management)
├── api/templates/        # Aurora API response templates (JSON)
├── img/                  # Icons, logos, achievement icons
│   ├── icon.nova.png, logo.nova.png, favicon.ico
│   ├── noboxart.svg      # Placeholder for missing game art
│   └── achievement.*.png # Achievement type icons
└── errors/               # HTTP error pages (400-501)
```

**Pages (bottom nav, hash-based routing: #home, #games, #screens, #files, #settings):**
- **Home** — Dashboard: profile (gamerpic via `/image/profile?uuid=X`), temperatures (live), memory, enhanced "Now Playing" card (game art thumbnail, name matched from library, elapsed play time persisted in localStorage across page reloads, click-to-navigate to game detail; shows "Aurora Dashboard" when no game running), quick stats, "Restart Aurora" button (uses GET /plugin for launcher path, then POST /title/launch with FormData). Title polling via auto-refresh (every 5s) detects title changes. Notification polling via `/update/notification` detects content changes (achievements, title, profiles, screenshots).
- **Games** — Library: grid/list view (boxartLarge preferred, 219:300 aspect ratio, single-click to open details in both views), search, filter by type (Xbox 360/XBLA/Classic/Homebrew), enhanced game detail with boxart sidebar + tabbed content area (two tabs: "Descrição" shows description from DBox API (via CMS proxy) with developer/publisher/release info — works without game running, falls back to Aurora `/title/live/cache` XML when DBox unavailable, "Informações Extras" shows metadata grid — Title ID, type, Media ID, disc info, versions, TU version, resolution, path — live data from `/title` API when game is running), description tab is default active, game art screenshots gallery with click-to-zoom viewer, achievements with authenticated image loading via `/image/achievement?uuid=<imageid>` (blob URLs, cache key includes titleId via `&t=` param), correct Aurora API field mapping (`cred` for score, `strings.caption/description` for text, `player[0]` for unlock status, hidden achievement support), progress ring, auto-reload on notification change, overlay toggle (eye icon, stored in `nova_ach_overlays` localStorage), launch button
- **Screens** — Screenshots: grid gallery with loading spinners (max 5 concurrent downloads), IndexedDB cache for persistent image caching, full-screen viewer, download, delete (also clears cache), "Take New" capture button
- **Files** — File manager: browse Xbox filesystem (read-only), drive selection (Hdd1, Usb0-2, Flash, Game), breadcrumb navigation with back button, download files. Uses Aurora `/filebrowser?path=` endpoint (GET only; path ending with `\` lists directory contents; returns `{name, attributes, size}`, attribute 16 = directory). Download uses `/title/file?path=` for Game: drive, `/filebrowser?path=` for others. Note: NOVA API does NOT support upload, delete, or create directory — those operations require FTP (Aurora built-in FTP: `xboxftp`/`xboxftp`).
- **Settings** — Full console dashboard with 2-column grid of collapsible cards: System LiNK (status, IPs, MACs, ports) + Bandwidth (download/upload rates/bytes); Device (console type, motherboard, serial, console ID, CPU key, kernel, DVD key) + SMC (all SMC registers, nested values flattened); Temperatures section (CPU/GPU/RAM with live refresh, color-coded); Plugin (version, API version, paths, features with enabled/disabled indicators) + Active Threads (thread IDs, priority, state); DashLaunch (version with kernel, options grouped by category). Profiles section: dynamic slots with localStorage persistence — starts with 2 empty placeholder slots, automatically expands as more profiles are detected (no fixed limit). Each profile shows gamerpic from Aurora API (`/image/profile?uuid=X`) with letter-initial fallback, gamertag, gamerscore, XUID, online status. Delete button (X) on each slot to remove from history. GODSend CMS section: Server URL input for DBox description proxy (auto-loaded from `api/config.json` if available, manually configurable, saved to localStorage). Refresh All Data + Logout buttons at bottom.

**Aurora API Endpoints Used:**
`/system`, `/temperature` (fields: cpu, gpu, memory, case, celsius), `/smc` (nested: smcversion, avpack, traystate, temperature.target/max), `/memory`, `/profile`, `/title`, `/plugin` (nested: version.number, path, features), `/screencapture` (GET+DELETE), `/screencapture/meta`, `/screencapture/meta/list`, `/achievement`, `/achievement/player`, `/image/achievement?uuid=<imageid>`, `/image/profile?uuid=X`, `/update/notification` (returns `{profiles,achievements,screencapture,title}` change counters), `/dashlaunch` (version.number+kernel, options[{id,category,name,value}]), `/multidisc`, `/title/launch` (POST, FormData: path, exec, type), `/title/file?path=` (GET, downloads from Game: only), `/filebrowser?path=` (GET only — directory listing with trailing `\`, file details without), `/systemlink` (enabled, username, apikey, xboxip, xboxmac, gateway), `/systemlink/bandwidth` (rate+bytes, downstream/upstream), `/thread` (id, type, flags, priority, address, state). Official docs: github.com/jrobiche/xbox360-aurora-developer-documentation

**Games data** comes from `api/titles.json` (generated by the Aurora plugin's "Update titles.json" function). Fields: `titleName`, `directory`, `executable`, `type`, `contentGroup`, `hidden`, `art` (tile, boxartLarge, boxartSmall, background, banner, screenshots[]).

**Authentication:** Uses Aurora's native auth system. POST `/authenticate` with URLSearchParams (form-encoded `username` + `password`). Response: `{"token":"JWT"}`. Token stored in localStorage, sent as `Authorization: Bearer <token>`. Auth detection: `X-Security-Enabled: 1` response header or HTTP 401. Auto-login from saved token on page load. Logout clears token from localStorage. The `/authenticate` endpoint uses `skipSecurityCheck` to bypass the token check (since token hasn't been received yet).

**Authenticated Image Loading:** Images from Aurora (screenshots, boxart) require auth headers. `NovaAPI.loadAuthImage()` fetches via XHR with Bearer token and creates blob URLs, with IndexedDB caching (NovaImgCache database). `NovaAPI.loadAuthImageQueued()` wraps loading in a concurrency-limited queue (max 5 simultaneous). `NovaAPI.downloadAuthFile()` does the same for downloads. Images use `data-auth-src` attribute instead of `src` to trigger authenticated loading. `removeFromImageCache(uuid)` clears cached screenshot from IndexedDB on delete.

**Game Launch:** POST `/title/launch` uses FormData (multipart/form-data) with fields: `path` (directory), `exec` (executable), `type` (exec type). Aurora returns 202 Accepted (not 200). The `ajax()` function accepts any 2xx status code — only HTTP 401 triggers login required.

**Session Expiration:** When any API call returns HTTP 401, `nova-api.js` emits `'session_expired'` event. `app.js` listens and: (1) if "Lembrar de mim" credentials exist in `nova_remember` localStorage (base64-encoded `{u,p}`), auto-re-authenticates transparently; (2) otherwise stops auto-refresh, clears token, shows login screen with "Session expired" message. Same auto-re-login logic runs on page load if saved token is expired.

**Remember Me:** "Lembrar de mim" checkbox on login form. When checked, saves `{u: username, p: password}` as base64 in `nova_remember` localStorage. On login screen load, auto-fills fields if saved. On session expiration, auto-re-authenticates without user intervention. Cleared if re-auth fails or user unchecks on next login.

**Hash-Based Routing:** `navigateTo()` updates `window.location.hash`. On load, `getPageFromHash()` reads hash to restore the correct page. `hashchange` event listener keeps navigation in sync with browser back/forward.

**Profile API:** `/profile` returns an array of profiles. Fields: `gamertag`, `gamerscore`, `signedin`, `xuid`, `index` (lowercase). Profile images loaded via `/image/profile?uuid=X` (not `?index=`). Profile image cache uses composite key `baseCacheKey#xuid` via `loadAuthImage(url, img, onDone, uniqueId)` — the XUID is passed as `uniqueId` so different users at the same slot index get separate cache entries (fixes stale image bug). Now Playing timer: `state.titleStartTime` persisted in localStorage (`nova_title_start` key with `{titleId, startTime}`) so elapsed time survives page reloads. Cleared when returning to dashboard.

**Installation:** Installed via Aurora plugin Settings menu (Settings > Nova WebUI > Install New WebUI). The plugin copies files from `webuis/` subfolder to `Game:\Plugins\WebRoot`. The Nova WebUI is bundled inside the plugin download ZIP at `GODSend/webuis/Nova/`.

**Preview:** Accessible at `/nova-webui/` on the CMS server for development preview (shows "Could not connect to console" since Aurora APIs are on Xbox).

## FTP Bridge System

Standalone Node.js app that acts as intermediary between Nova WebUI and Xbox 360 FTP server, enabling full file management from the browser (Chrome removed FTP support).

**Flow:** WebUI → HTTP → Node.js Bridge → FTP → Xbox 360

**Files:**
- `src/public/ftp-bridge/bridge.js` — Express HTTP server (port 7860) + basic-ftp client
- `src/public/ftp-bridge/package.json` — Dependencies: basic-ftp, express, multer, cors
- `src/public/ftp-bridge/bridge-config.json` — FTP host/port/user/pass configuration
- `src/public/ftp-bridge/README.md` — Usage instructions

**Bridge REST API:**
- `GET /status` — Health check + FTP connection status (returns `{type: 'godsend-ftp-bridge'}`)
- `GET /config` / `POST /config` — Read/update FTP configuration
- `GET /list?path=` — Directory listing (returns JSON array: name, size, type, attributes)
- `GET /download?path=` — Stream file download with Content-Length/progress headers
- `POST /upload?path=` — Multipart file upload with transfer progress tracking
- `DELETE /delete?path=&type=` — Delete file or directory
- `POST /move` — Move/rename (body: `{from, to}`)
- `POST /mkdir?path=` — Create directory
- `GET /transfer-progress/:id` — Poll transfer progress (percentage, speed, ETA)
- `GET /transfers` — List all active transfers

**CMS Integration:**
- `GET /plugin/download-ftp-bridge` — Download pre-configured bridge ZIP (public, accepts `?xbox_ip=` query param)
- Route in `src/routes/plugin.js`

**NovaAPI Methods (nova-api.js):**
- `getFtpBridgeUrl()` / `setFtpBridgeUrl(url)` — localStorage persistence (`nova_ftp_bridge_url`)
- `checkFtpBridge(url, callback)` — Verify bridge at URL via GET /status
- `autoDiscoverFtpBridge(callback)` — Try saved URL, then localhost:7860, 127.0.0.1:7860, current hostname:7860
- `ftpList()`, `ftpDownload()`, `ftpUpload()`, `ftpDelete()`, `ftpMove()`, `ftpMkdir()`, `ftpTransferProgress()`, `ftpUpdateConfig()`

**WebUI File Manager (app.js):**
- Dual mode: Aurora (read-only, existing) and FTP Bridge (full CRUD)
- Bridge auto-detection on Files page load via `fmInitBridge()`
- Mode toggle (Aurora/FTP Bridge) on drive selection page
- FTP Bridge mode: Upload button, New Folder button, per-file Rename/Delete actions
- Upload progress overlay with percentage and speed
- Delete confirmation dialog
- Rename dialog with input field
- Bridge status indicator (green/red dot) in toolbar, clickable to open setup wizard

**Setup Wizard (app.js):**
- 4-step wizard shown when bridge not detected
- Step 0: Welcome — explains bridge purpose, 3 options (download ZIP, manual setup, connect existing)
- Step 1: Installation — Xbox config inputs (IP, user, password) + 3 individual file downloads: bridge.js (fetched from server, config injected), bridge-config.json (generated client-side), package.json (fetched as-is). Important notice to put all files in one folder. Platform commands: Windows/Linux (`cd folder, npm install, node bridge.js`), Android (Termux required, F-Droid download button at `https://f-droid.org/F-Droid.apk`). Copy buttons with fallbackCopy.
- Step 2: Configure & Connect — URL input, auto-detect button, test connection button, shows FTP status. After bridge connects, shows FTP Settings panel (Xbox IP, port, user, password) loaded from bridge's GET /config, with Save button that POSTs to bridge /config and re-tests connection
- Step 3: Connected — success screen with bridge/FTP info, disconnect option
- Re-accessible via bridge status indicator click

**Bridge First-Run Setup (bridge.js):**
- If no `bridge-config.json` exists and running in a TTY, prompts interactively for Xbox IP, FTP port, username, password, and HTTP port
- Saves config to `bridge-config.json` after prompts complete
- If config exists or not a TTY (e.g. launched from WebUI), starts directly with defaults
- FTP settings can also be configured from the WebUI wizard step 2 config panel

**FTP Path Handling:**
- FTP Bridge mode uses forward-slash paths: `/Hdd1/`, `/Flash/`, `/Game/` (Xbox 360 FTP convention)
- Aurora mode uses backslash paths: `Hdd1:\`, `Flash:\` (Aurora API convention)
- Drive selection: FTP strips `:`, prepends `/`, appends `/`; Aurora keeps `DriveName:\`
- Breadcrumbs build cumulative FTP paths with leading `/` and trailing `/`
- Parent path of `/Hdd1/Content/` → `/Hdd1/`

**CSS (app.css):**
- `.fm-bridge-*` — Bridge status indicator styles
- `.fm-mode-*` — Aurora/FTP mode toggle
- `.fm-toolbar*` — Toolbar layout
- `.fm-upload-*` — Upload progress overlay
- `.fm-progress-*` — Progress bars
- `.fm-action-btn` — Per-file action buttons
- `.fm-dialog-*` — Rename/confirm dialogs
- `.ftp-wizard-*` — Setup wizard (cards, steps, options, commands, inputs, status indicators)

## Game Achievements System

- **GameAchievement model** (`src/models/GameAchievement.js`): Global Xbox game achievement definitions with `title_id`, `achievement_id`, `name`, `description`, `image_url` (local CMS path), `gamerscore`. Unique on `(title_id, achievement_id)`.
- **Auto-registration**: When users harvest Xbox achievements via `harvestAchievements`, the system creates global `GameAchievement` records and downloads achievement images from Aurora to `src/public/uploads/achievements/` as `{TITLEID}_{ACHID}.png`.
- **Title ID normalization**: All title IDs are normalized (strip `0x` prefix, uppercase) before storage/lookup to prevent duplicates.
- **Image URL protection**: SSRF protection blocks `localhost`, `127.0.0.1`, `::1`, and link-local IPs; content-type validation ensures only images are saved.
- **Game stats auto-tracking**: WebUI automatically sends playtime stats to CMS when a game title changes (NovaAPI `postGameStats`). Backend increments `playtime_minutes` and `times_launched` instead of overwriting.
- **Achievement separation**: Home page shows only Stix (system) achievements; Xbox game achievements (key prefix `xbox_`) display grouped by game on the Profile page with CMS-prefixed image URLs.
- **CMS admin page**: `/social/game-achievements` lists all registered game achievements with filtering by game.

## Legacy Files

- `.old/source-control/` — Original Go server code (kept as reference)
- `.old/client-scripts/` — Original Xbox Lua scripts v6.1 (replaced by plugin v7.0)
