var App = (function() {
    var state = {
        currentPage: 'home',
        games: [],
        filteredGames: [],
        gameView: 'grid',
        gameFilter: 'all',
        searchQuery: '',
        screenshots: [],
        selectedGame: null,
        systemInfo: null,
        temperature: null,
        memory: null,
        profile: null,
        filesPath: '',
        filesList: [],
        filesLoading: false,
        filesError: null,
        filesUploading: false,
        ftpBridgeConnected: false,
        ftpBridgeUrl: '',
        ftpBridgeInfo: null,
        ftpBridgeMode: false,
        ftpWizardStep: 0,
        smc: null,
        title: null,
        titleStartTime: null,
        lastTitleId: null,
        notification: null,
        cmsProfile: null,
        cmsNotifications: null,
        cmsStats: null,
        cmsRecentAchievements: null,
        cmsFriendsList: null,
        isOnline: navigator.onLine !== false
    };

    var pages = ['home', 'games', 'profile', 'rooms', 'screens', 'files', 'settings'];
    var perfilSubmenuOpen = false;
    var screensFilterTid = null;

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function show(el) { if (el) el.classList.remove('hidden'); }
    function hide(el) { if (el) el.classList.add('hidden'); }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    function getTempColor(temp) {
        if (temp < 55) return 'var(--success)';
        if (temp < 70) return 'var(--warning)';
        return 'var(--danger)';
    }

    function getTempClass(temp) {
        if (temp < 55) return 'success';
        if (temp < 70) return 'warning';
        return 'danger';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    }

    function sanitizeHtml(html) {
        if (!html) return '';
        var s = String(html)
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<script[\s>]/gi, '&lt;script')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
            .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
            .replace(/<iframe[\s>]/gi, '&lt;iframe')
            .replace(/<object[\s\S]*?<\/object>/gi, '')
            .replace(/<embed[^>]*>/gi, '')
            .replace(/href\s*=\s*["']\s*javascript:/gi, 'href="')
            .replace(/src\s*=\s*["']\s*javascript:/gi, 'src="')
            .replace(/href\s*=\s*["']\s*data:/gi, 'href="')
            .replace(/src\s*=\s*["']\s*data:(?!image\/)/gi, 'src="')
            .replace(/<form[\s\S]*?<\/form>/gi, '')
            .replace(/<form[\s>]/gi, '&lt;form')
            .replace(/<meta[^>]*>/gi, '')
            .replace(/<link[^>]*>/gi, '')
            .replace(/<base[^>]*>/gi, '');
        return s;
    }

    function sanitizeUrl(url) {
        if (!url) return '';
        var u = String(url).trim();
        if (/^javascript:/i.test(u) || /^data:/i.test(u) || /^vbscript:/i.test(u)) return '';
        return u;
    }

    function getOverlayPref() {
        try { var v = localStorage.getItem('nova_ach_overlays'); return v === null ? true : v === '1'; } catch(e) { return true; }
    }
    function setOverlayPref(val) {
        try { localStorage.setItem('nova_ach_overlays', val ? '1' : '0'); } catch(e) {}
    }
    function applyOverlayState(container) {
        var on = getOverlayPref();
        container.querySelectorAll('.achievement-type-overlay').forEach(function(img) { img.style.display = on ? '' : 'none'; });
        if (on) {
            container.classList.remove('ach-overlays-off');
        } else {
            container.classList.add('ach-overlays-off');
        }
    }

    function gameTypeLabel(type) {
        var t = String(type);
        var types = {
            '1': 'Xbox 360', '2': 'Arcade', '3': 'Indie', '4': 'OG Xbox', '5': 'Homebrew',
            '6': 'Homebrew', '7': 'Homebrew',
            'Xbox360': 'Xbox 360', 'XBLA': 'Arcade', 'Homebrew': 'Homebrew',
            'XboxClassic': 'OG Xbox', 'Indie': 'Indie', 'Unsigned': 'Homebrew',
            'LibXenon': 'Homebrew'
        };
        return types[t] || (t && t !== '0' && t !== 'undefined' ? t : 'Unknown');
    }

    function getGameName(g) { return g.titleName || g.Name || g.name || ''; }
    function getGameType(g) { return g.contentGroup != null ? g.contentGroup : (g.type != null ? g.type : (g.ContentType || g.contenttype || '')); }
    function getGameArt(g) {
        if (g.art) return g.art.boxartLarge || g.art.boxartSmall || g.art.tile || '';
        return g.BoxArt || g.boxart || '';
    }
    function getGameBanner(g) {
        if (g.art) return g.art.banner || g.art.background || g.art.boxartLarge || '';
        return g.BannerPath || g.BoxArt || g.boxart || '';
    }
    function getGameId(g) { return g.TitleId || g.titleid || g.contentGroup || ''; }
    function getGamePath(g) {
        if (g.directory && g.executable) {
            var dir = g.directory;
            if (dir && dir[dir.length - 1] !== '\\' && dir[dir.length - 1] !== '/') dir += '\\';
            return dir + g.executable;
        }
        return g.Path || g.path || '';
    }

    function getGameScreenshots(g) {
        if (g.art && Array.isArray(g.art.screenshots)) return g.art.screenshots;
        return [];
    }

    function getGameBoxartLarge(g) {
        if (g.art) return g.art.boxartLarge || g.art.boxartSmall || g.art.tile || '';
        return g.BoxArt || g.boxart || '';
    }

    function formatElapsed(ms) {
        if (!ms || ms < 0) return '0s';
        var totalSeconds = Math.floor(ms / 1000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        if (hours > 0) return hours + 'h ' + minutes + 'm';
        if (minutes > 0) return minutes + 'm ' + seconds + 's';
        return seconds + 's';
    }

    function getTitleIdFromState() {
        if (!state.title) return '';
        return state.title.titleid || state.title.TitleId || '';
    }

    function findGameByTitleId(tid) {
        if (!tid) return null;
        var tidLower = tid.toLowerCase();
        return state.games.find(function(g) {
            var gid = getGameId(g);
            return gid && gid.toLowerCase() === tidLower;
        }) || null;
    }

    function isDashboard(ti) {
        if (!ti) return true;
        var tid = ti.titleid || ti.TitleId || '';
        if (!tid || tid === '0x00000000' || tid === '0x00000000') return true;
        var name = ti.Name || ti.name;
        if (name && name.toLowerCase() === 'dashboard') return true;
        return false;
    }

    function navigateTo(page, skipHash) {
        if (pages.indexOf(page) === -1) page = 'home';
        if (page !== 'profile' && page !== 'rooms') {
            closePerfilSubmenu();
        }
        state.currentPage = page;
        if (!skipHash) window.location.hash = '#' + page;
        pages.forEach(function(p) {
            var el = $('#page-' + p);
            if (el) {
                el.classList.remove('active');
                if (p === page) el.classList.add('active');
            }
        });
        $$('.nav-item').forEach(function(btn) {
            btn.classList.remove('active');
            var bp = btn.dataset.page;
            if (bp === page) btn.classList.add('active');
            if (bp === 'profile' && (page === 'profile' || page === 'rooms')) btn.classList.add('active');
        });
        closeSidebar();
        window.scrollTo(0, 0);
        renderPage(page);
    }

    function togglePerfilSubmenu() {
        var existing = $('#perfil-submenu');
        if (existing) {
            closePerfilSubmenu();
            return;
        }
        perfilSubmenuOpen = true;
        var navBtn = $('#nav-perfil-btn');
        if (!navBtn) return;
        var rect = navBtn.getBoundingClientRect();
        var submenu = document.createElement('div');
        submenu.id = 'perfil-submenu';
        submenu.className = 'perfil-submenu';
        submenu.style.left = (rect.left + rect.width / 2) + 'px';
        submenu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        submenu.innerHTML =
            '<button class="perfil-submenu-item" data-sub-page="profile">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                ' Meu Perfil' +
            '</button>' +
            '<button class="perfil-submenu-item" data-sub-page="rooms">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                ' Salas' +
            '</button>';
        document.body.appendChild(submenu);
        submenu.querySelectorAll('.perfil-submenu-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var target = this.getAttribute('data-sub-page');
                closePerfilSubmenu();
                navigateTo(target);
            });
        });
        setTimeout(function() {
            document.addEventListener('click', closePerfilSubmenuOnClick);
        }, 10);
    }

    function closePerfilSubmenu() {
        perfilSubmenuOpen = false;
        var existing = $('#perfil-submenu');
        if (existing) existing.remove();
        document.removeEventListener('click', closePerfilSubmenuOnClick);
    }

    function closePerfilSubmenuOnClick(e) {
        var submenu = $('#perfil-submenu');
        var navBtn = $('#nav-perfil-btn');
        if (submenu && !submenu.contains(e.target) && navBtn && !navBtn.contains(e.target)) {
            closePerfilSubmenu();
        }
    }

    function getPageFromHash() {
        var h = window.location.hash.replace('#', '');
        return pages.indexOf(h) !== -1 ? h : 'home';
    }

    function closeSidebar() {
        var sb = $('#sidebar');
        var overlay = $('#sidebar-overlay');
        if (sb) { sb.classList.remove('open'); hide(sb); }
        if (overlay) hide(overlay);
    }

    function openSidebar() {
        var sb = $('#sidebar');
        var overlay = $('#sidebar-overlay');
        if (sb) { show(sb); setTimeout(function(){ sb.classList.add('open'); }, 10); }
        if (overlay) show(overlay);
    }

    function renderPage(page) {
        switch(page) {
            case 'home': renderHome(); break;
            case 'games': renderGames(); break;
            case 'profile': renderProfile(); break;
            case 'rooms': renderRooms(); break;
            case 'screens': renderScreens(); break;
            case 'files': fmRestoreAndInit(); break;
            case 'settings': renderSettings(); break;
        }
    }

    function formatPlaytime(minutes) {
        if (!minutes || minutes <= 0) return '0h';
        var h = Math.floor(minutes / 60);
        var m = minutes % 60;
        if (h > 0 && m > 0) return h + 'h ' + m + 'm';
        if (h > 0) return h + 'h';
        return m + 'm';
    }

    function isCmsLoggedIn() {
        return !!NovaAPI.getCmsAuthToken() && !!NovaAPI.getCmsProfileData();
    }

    function sendGameStats(titleId, startTime) {
        if (!titleId || !startTime) return;
        var elapsed = Date.now() - startTime;
        var minutes = Math.round(elapsed / 60000);
        if (minutes < 1) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) return;
        NovaAPI.cmsLookupGameByTitleId(titleId, function(err, data) {
            if (err || !data || !data.game) return;
            var gameId = data.game.id;
            NovaAPI.postGameStats(cp.id, {
                game_id: gameId,
                title_id: titleId,
                playtime_minutes: minutes,
                times_launched: 1,
                completed: false
            }, function(err2) {
                if (err2) {
                    console.log('[STATS] Failed to post game stats:', err2.message);
                }
            });
        });
    }

    function checkOnlineStatus() {
        if (!navigator.onLine) {
            setOnlineState(false);
            return;
        }
        NovaAPI.checkOnline(function(online) {
            setOnlineState(online);
        });
    }

    function setOnlineState(online) {
        var changed = state.isOnline !== online;
        state.isOnline = online;
        updateOfflineBanner();
        updateOfflineNav();
        if (changed) {
            renderPage(state.currentPage);
        }
    }

    function updateOfflineBanner() {
        var existing = $('#offline-banner');
        if (!state.isOnline) {
            if (!existing) {
                var banner = document.createElement('div');
                banner.id = 'offline-banner';
                banner.className = 'offline-banner';
                banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> Offline — apenas recursos do console disponíveis';
                var mainContent = $('#main-content');
                if (mainContent) mainContent.parentNode.insertBefore(banner, mainContent);
            }
        } else {
            if (existing) existing.remove();
        }
    }

    function updateOfflineNav() {
        var roomsNav = document.querySelector('.nav-item[data-page="rooms"]');
        var roomsSidebar = document.querySelector('.sidebar-link[data-page="rooms"]');
        if (!state.isOnline) {
            if (roomsNav) roomsNav.style.display = 'none';
            if (roomsSidebar) roomsSidebar.style.display = 'none';
        } else {
            if (roomsNav) roomsNav.style.display = '';
            if (roomsSidebar) roomsSidebar.style.display = '';
        }
    }

    function loadCmsProfileData() {
        var profile = NovaAPI.getCmsProfileData();
        if (!profile || !profile.id) return;
        state.cmsProfile = profile;

        NovaAPI.getCmsProfile(function(err, freshProfile) {
            if (!err && freshProfile) {
                state.cmsProfile = freshProfile;
                NovaAPI.setCmsProfileData(freshProfile);
                if (state.currentPage === 'home') renderHome();
            }
        });

        NovaAPI.getCmsStats(profile.id, function(err, data) {
            if (!err && data) {
                state.cmsStats = data.stats;
                state.cmsRecentAchievements = data.recent_achievements || [];
                if (state.currentPage === 'home') renderHome();
            }
        });

        NovaAPI.getNotifications(profile.id, function(err, data) {
            if (!err && data) {
                state.cmsNotifications = data;
                if (state.currentPage === 'home') renderHome();
            }
        });
    }

    function renderCmsLoginSection() {
        return '<div class="section-title">GODSend Account</div>' +
            '<div class="cms-login-card card">' +
                '<div class="cms-login-header">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                    '<div class="cms-login-title">Entrar na sua conta</div>' +
                '</div>' +
                '<form id="cms-login-form" class="cms-login-form">' +
                    '<div class="cms-login-field">' +
                        '<input type="text" id="cms-login-email" placeholder="Email ou username" autocomplete="email" autocapitalize="off">' +
                    '</div>' +
                    '<div class="cms-login-field">' +
                        '<input type="password" id="cms-login-password" placeholder="Senha" autocomplete="current-password">' +
                    '</div>' +
                    '<p id="cms-login-error" class="cms-login-error hidden"></p>' +
                    '<button type="submit" class="btn btn-primary btn-block" id="cms-login-btn">' +
                        '<span id="cms-login-btn-text">Entrar</span>' +
                        '<div id="cms-login-spinner" class="loader-spinner small hidden"></div>' +
                    '</button>' +
                '</form>' +
                '<div class="cms-login-signup">' +
                    '<a href="https://speedygamesdownloads.com/register" target="_blank" rel="noopener">Criar conta em speedygamesdownloads.com</a>' +
                '</div>' +
            '</div>';
    }

    function renderCmsProfileSection() {
        var cp = state.cmsProfile;
        if (!cp) return '';

        var avatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
        var avatarHtml = cp.avatar_url
            ? '<img class="cms-profile-avatar" src="' + escapeHtml(cp.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="cms-profile-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="cms-profile-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var levelBadge = cp.level_name
            ? '<span class="cms-level-badge">' + escapeHtml(cp.level_name) + '</span>'
            : '';

        var unreadCount = 0;
        if (state.cmsNotifications && state.cmsNotifications.unread_count) {
            unreadCount = state.cmsNotifications.unread_count;
        }

        var notifBell = '<button class="cms-notif-bell" id="cms-notif-bell" title="Notificações">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
            (unreadCount > 0 ? '<span class="cms-notif-count">' + (unreadCount > 9 ? '9+' : unreadCount) + '</span>' : '') +
        '</button>';

        var html = '<div class="section-title">GODSend Account ' + notifBell + '</div>' +
            '<div class="cms-profile-card card">' +
                '<div class="cms-profile-header">' +
                    '<div class="cms-profile-avatar-wrap">' + avatarHtml + '</div>' +
                    '<div class="cms-profile-info">' +
                        '<div class="cms-profile-name">' + escapeHtml(cp.display_name || cp.username) + '</div>' +
                        levelBadge +
                    '</div>' +
                    '<button class="cms-logout-btn" id="cms-logout-btn" title="Sair">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
                    '</button>' +
                '</div>';

        var stats = state.cmsStats || cp;
        html += '<div class="cms-stats-grid">' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + (stats.total_downloads || 0) + '</div><div class="cms-stat-label">Downloads</div></div>' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + formatPlaytime(stats.total_playtime_minutes || 0) + '</div><div class="cms-stat-label">Playtime</div></div>' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + (stats.achievements_count || 0) + '</div><div class="cms-stat-label">Conquistas</div></div>' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + (stats.games_completed || 0) + '</div><div class="cms-stat-label">Completos</div></div>' +
        '</div>';

        var stixAchievements = (state.cmsRecentAchievements || []).filter(function(a) {
            return !a.achievement_key || a.achievement_key.indexOf('xbox_') !== 0;
        });
        if (stixAchievements.length > 0) {
            html += '<div class="cms-achievements-title"><span class="cms-ach-badge-stix">STIX</span> Conquistas Stix</div>' +
                '<div class="cms-achievements-list">';
            stixAchievements.forEach(function(ach) {
                var iconContent = (ach.icon && ach.icon.length <= 4) ? ach.icon : '';
                var iconHtml = iconContent
                    ? '<span class="cms-ach-icon-emoji">' + iconContent + '</span>'
                    : (ach.icon
                        ? '<img class="cms-ach-icon-img" src="' + escapeHtml(ach.icon) + '" alt="">'
                        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 15l-2 5 2-1 2 1-2-5z"/><circle cx="12" cy="8" r="6"/></svg>');
                var dateStr = '';
                if (ach.unlocked_at) {
                    try { dateStr = new Date(ach.unlocked_at).toLocaleDateString('pt-BR'); } catch(e) {}
                }
                html += '<div class="cms-ach-item">' +
                    '<div class="cms-ach-icon">' + iconHtml + '</div>' +
                    '<div class="cms-ach-info">' +
                        '<div class="cms-ach-name">' + escapeHtml(ach.achievement_name) + '</div>' +
                        '<div class="cms-ach-desc">' + escapeHtml(ach.achievement_description || '') +
                            (dateStr ? ' <span class="cms-ach-date">' + dateStr + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function bindCmsLogin() {
        var form = $('#cms-login-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var email = $('#cms-login-email').value.trim();
            var password = $('#cms-login-password').value;
            var errorEl = $('#cms-login-error');
            var btnText = $('#cms-login-btn-text');
            var btnSpinner = $('#cms-login-spinner');
            var submitBtn = $('#cms-login-btn');

            if (!email || !password) {
                show(errorEl);
                errorEl.textContent = 'Preencha email e senha';
                return;
            }

            hide(errorEl);
            hide(btnText);
            show(btnSpinner);
            submitBtn.disabled = true;

            NovaAPI.cmsLogin(email, password, function(err, data) {
                show(btnText);
                hide(btnSpinner);
                submitBtn.disabled = false;

                if (err) {
                    show(errorEl);
                    errorEl.textContent = err.message || 'Falha no login';
                    return;
                }

                state.cmsProfile = data.profile;
                loadCmsProfileData();
                renderHome();

                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission().then(function(perm) {
                        if (perm === 'granted') {
                            NovaAPI.registerPushSubscription(function() {});
                        }
                    });
                } else if ('Notification' in window && Notification.permission === 'granted') {
                    NovaAPI.registerPushSubscription(function() {});
                }
            });
        });
    }

    function bindCmsLogout() {
        var btn = $('#cms-logout-btn');
        if (!btn) return;
        btn.addEventListener('click', function() {
            NovaAPI.cmsLogout();
            state.cmsProfile = null;
            state.cmsStats = null;
            state.cmsNotifications = null;
            state.cmsRecentAchievements = null;
            renderHome();
        });
    }

    function renderHome() {
        var el = $('#page-home');

        var cmsLoginActive = false;
        var cmsLoginValues = null;
        var existingEmailInput = $('#cms-login-email');
        if (existingEmailInput) {
            var emailVal = existingEmailInput.value;
            var passVal = ($('#cms-login-password') || {}).value || '';
            if (emailVal || passVal) {
                cmsLoginActive = true;
                cmsLoginValues = { email: emailVal, password: passVal };
            }
        }

        var profileHtml = '';
        if (state.profile) {
            var p = state.profile;
            var gt = p.gamertag || p.Gamertag || 'X';
            var initial = (gt && gt.length > 0) ? gt[0].toUpperCase() : '?';
            var pIdx = p.index != null ? p.index : 0;
            var pXuid = p.xuid || p.Xuid || '';
            var profileImgUrl = NovaAPI.getProfileImageUrl(pIdx);
            profileHtml = '<div class="profile-section">' +
                '<img class="profile-avatar-img" data-profile-img="' + escapeHtml(profileImgUrl) + '" data-profile-xuid="' + escapeHtml(pXuid) + '" alt="" src="img/noboxart.svg">' +
                '<div class="profile-avatar" style="display:none">' + escapeHtml(initial) + '</div>' +
                '<div class="profile-info">' +
                    '<div class="profile-name">' + escapeHtml(gt) + '</div>' +
                    '<div class="profile-gamerscore">GS: ' + (p.gamerscore || p.Gamerscore || 0) + '</div>' +
                '</div>' +
            '</div>';
        }

        var cmsHtml = '';
        if (state.isOnline) {
            cmsHtml = isCmsLoggedIn() ? renderCmsProfileSection() : renderCmsLoginSection();
        }

        var tempHtml = '';
        if (state.temperature) {
            var t = state.temperature;
            var cpuTemp = t.cpu || t.CPU || 0;
            var gpuTemp = t.gpu || t.GPU || 0;
            var memTemp = t.memory || t.mem || t.MEM || t.ram || t.RAM || 0;
            tempHtml = '<div class="info-grid">' +
                renderTempCard('CPU', cpuTemp) +
                renderTempCard('GPU', gpuTemp) +
                renderTempCard('RAM', memTemp) +
            '</div>';
        }

        var memHtml = '';
        if (state.memory) {
            var m = state.memory;
            var totalMem = m.total || m.Total || 0;
            var usedMem = m.used || m.Used || 0;
            var pct = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;
            memHtml = '<div class="card" style="margin-top:16px">' +
                '<div class="card-title">Memory</div>' +
                '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
                    '<span class="card-label">Used</span>' +
                    '<span style="font-size:12px;color:var(--text-secondary)">' + formatBytes(usedMem) + ' / ' + formatBytes(totalMem) + '</span>' +
                '</div>' +
                '<div class="temp-bar"><div class="temp-bar-fill" style="width:' + pct + '%;background:' + (pct > 80 ? 'var(--danger)' : 'var(--accent)') + '"></div></div>' +
            '</div>';
        }

        var titleHtml = '';
        if (state.title) {
            var ti = state.title;
            var currentTid = ti.titleid || ti.TitleId || '';
            var matchedGame = findGameByTitleId(currentTid);
            var npName = matchedGame ? getGameName(matchedGame) : (ti.Name || ti.name || 'Dashboard');
            var npIsDash = isDashboard(ti);

            if (npIsDash) {
                titleHtml = '<div class="section-title">Now Playing</div>' +
                    '<div class="card now-playing-card">' +
                        '<div class="now-playing-info">' +
                            '<div class="now-playing-name">Aurora Dashboard</div>' +
                            '<div class="now-playing-detail">No game running</div>' +
                        '</div>' +
                    '</div>';
            } else {
                var npArt = matchedGame ? getGameArt(matchedGame) : '';
                var npArtAttr = npArt ? 'data-auth-src="' + escapeHtml(npArt) + '"' : 'src="img/noboxart.svg"';
                var elapsed = state.titleStartTime ? formatElapsed(Date.now() - state.titleStartTime) : '';
                var npType = matchedGame ? gameTypeLabel(getGameType(matchedGame)) : '';
                var npClickAttr = matchedGame ? ' data-np-tid="' + escapeHtml(currentTid) + '"' : '';

                titleHtml = '<div class="section-title">Now Playing</div>' +
                    '<div class="card now-playing-card' + (matchedGame ? ' clickable' : '') + '"' + npClickAttr + '>' +
                        '<img class="now-playing-art" ' + npArtAttr + ' alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                        '<div class="now-playing-info">' +
                            '<div class="now-playing-name">' + escapeHtml(npName) + '</div>' +
                            '<div class="now-playing-detail">' +
                                (npType ? '<span class="badge badge-accent">' + npType + '</span> ' : '') +
                                '<span style="font-family:monospace;font-size:11px;color:var(--text-muted)">' + escapeHtml(currentTid) + '</span>' +
                            '</div>' +
                            (elapsed ? '<div class="now-playing-elapsed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + elapsed + '</div>' : '') +
                        '</div>' +
                    '</div>';
            }
        }

        var statsHtml = '<div class="quick-stats">' +
            '<div class="quick-stat"><div class="quick-stat-value">' + state.games.length + '</div><div class="quick-stat-label">Games</div></div>' +
            '<div class="quick-stat"><div class="quick-stat-value">' + state.screenshots.length + '</div><div class="quick-stat-label">Screens</div></div>' +
            '<div class="quick-stat"><div class="quick-stat-value">' + (state.temperature ? '<span class="refresh-indicator live"></span>' : '--') + '</div><div class="quick-stat-label">Live</div></div>' +
        '</div>';

        var actionsHtml = '<div class="section-title">Actions</div>' +
            '<div class="card" style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<button class="btn btn-primary" id="restart-aurora-btn">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align:-3px;margin-right:4px"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
                    'Restart Aurora' +
                '</button>' +
            '</div>';

        var liveSectionHtml = statsHtml + titleHtml +
            '<div class="section-title">Temperatures</div>' + tempHtml +
            memHtml + actionsHtml;

        if (cmsLoginActive && !isCmsLoggedIn()) {
            var tempSection = $('#home-live-section');
            if (tempSection) {
                tempSection.innerHTML = liveSectionHtml;
            }
            bindHomeLiveHandlers();
            return;
        }

        var greetingText = 'Dashboard';
        var hour = new Date().getHours();
        var greetName = '';
        if (state.cmsProfile) {
            greetName = state.cmsProfile.display_name || state.cmsProfile.username || '';
        } else if (state.profile) {
            greetName = state.profile.gamertag || state.profile.Gamertag || '';
        }
        if (greetName) {
            if (hour >= 5 && hour < 12) greetingText = 'Bom dia, ' + greetName;
            else if (hour >= 12 && hour < 18) greetingText = 'Boa tarde, ' + greetName;
            else greetingText = 'Boa noite, ' + greetName;
        }

        el.innerHTML = '<div class="page-header"><div><div class="page-title">' + escapeHtml(greetingText) + '</div></div></div>' +
            profileHtml + cmsHtml +
            (state.isOnline ? '<div id="home-blog-section"></div>' : '') +
            (state.isOnline ? '<div id="home-events-section"></div>' : '') +
            '<div id="home-live-section">' + liveSectionHtml + '</div>';

        if (isCmsLoggedIn()) {
            bindCmsLogout();
        } else {
            bindCmsLogin();
            if (cmsLoginValues) {
                var emailInput = $('#cms-login-email');
                var passInput = $('#cms-login-password');
                if (emailInput) emailInput.value = cmsLoginValues.email;
                if (passInput) passInput.value = cmsLoginValues.password;
            }
        }

        bindHomeLiveHandlers();
        loadHomeBlogPosts();
        loadHomeEvents();

        var profileImg = document.querySelector('.profile-avatar-img[data-profile-img]');
        if (profileImg) {
            var profUrl = profileImg.getAttribute('data-profile-img');
            var profXuid = profileImg.getAttribute('data-profile-xuid') || '';
            var profFallback = profileImg.nextElementSibling;
            NovaAPI.loadAuthImage(profUrl, profileImg, function() {
                if (profileImg.src.indexOf('noboxart') !== -1) {
                    profileImg.style.display = 'none';
                    if (profFallback) profFallback.style.display = 'flex';
                }
            }, profXuid);
        }
    }

    function loadHomeBlogPosts() {
        var section = $('#home-blog-section');
        if (!section || !state.isOnline) return;

        NovaAPI.getBlogPosts(function(err, data) {
            if (err || !data || !section) return;
            var posts = data.posts || [];
            if (posts.length === 0) return;

            var html = '<div class="section-title">Novidades</div>';
            html += '<div class="blog-posts-list">';
            posts.slice(0, 5).forEach(function(post) {
                var dateStr = '';
                if (post.published_at) {
                    try {
                        var d = new Date(post.published_at);
                        dateStr = d.toLocaleDateString('pt-BR');
                    } catch(e) {}
                }
                var excerpt = (post.content || '').replace(/<[^>]*>/g, '').substring(0, 150);
                if ((post.content || '').length > 150) excerpt += '...';

                html += '<div class="blog-post-card card" data-blog-id="' + post.id + '">';
                if (post.cover_image_url) {
                    html += '<div class="blog-post-cover"><img src="' + escapeHtml(post.cover_image_url) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>';
                }
                var pinnedBadge = post.pinned ? '<span class="blog-pin-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span> ' : '';
                html += '<div class="blog-post-body">' +
                    '<div class="blog-post-title">' + pinnedBadge + escapeHtml(post.title) + '</div>' +
                    '<div class="blog-post-date">' + escapeHtml(dateStr) + (post.author ? ' · ' + escapeHtml(typeof post.author === 'string' ? post.author : (post.author.display_name || post.author.username || '')) : '') + '</div>' +
                    '<div class="blog-post-excerpt">' + escapeHtml(excerpt) + '</div>' +
                '</div></div>';
            });
            html += '</div>';
            section.innerHTML = html;

            section.querySelectorAll('.blog-post-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    var postId = parseInt(card.getAttribute('data-blog-id'));
                    var post = posts.find(function(p) { return p.id === postId; });
                    if (post) showBlogPostDetail(post);
                });
            });
        });
    }

    function loadHomeEvents() {
        var section = $('#home-events-section');
        if (!section || !state.isOnline) return;

        NovaAPI.getEvents(function(err, data) {
            if (err || !data || !section) return;
            var events = data.events || [];
            if (events.length === 0) return;

            var html = '<div class="section-title">Eventos</div>';
            html += '<div class="events-list">';
            events.slice(0, 5).forEach(function(ev) {
                var dateStr = '';
                if (ev.event_date) {
                    try {
                        var d = new Date(ev.event_date);
                        dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } catch(e) {}
                }
                var typeLabels = { sorteio: 'Sorteio', live: 'Live', torneio: 'Torneio', outro: 'Outro' };
                var typeColors = { sorteio: '#a78bfa', live: '#ef4444', torneio: '#f59e0b', outro: '#8b8ba3' };
                var typeBadgeColor = typeColors[ev.event_type] || '#8b8ba3';
                var typeLabel = typeLabels[ev.event_type] || ev.event_type;

                var safeUrl = sanitizeUrl(ev.event_url);
                var clickAttr = safeUrl ? ' onclick="window.open(\'' + escapeHtml(safeUrl).replace(/'/g, "\\'") + '\', \'_blank\')" style="cursor:pointer"' : '';

                html += '<div class="event-card card"' + clickAttr + '>';
                if (ev.cover_image_url) {
                    html += '<div class="event-cover"><img src="' + escapeHtml(ev.cover_image_url) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>';
                }
                var countdownHtml = '';
                if (ev.event_date) {
                    var evDate = new Date(ev.event_date);
                    var nowMs = Date.now();
                    var diffMs = evDate.getTime() - nowMs;
                    if (diffMs > 0) {
                        var diffDays = Math.floor(diffMs / 86400000);
                        var diffHours = Math.floor((diffMs % 86400000) / 3600000);
                        var diffMins = Math.floor((diffMs % 3600000) / 60000);
                        var cdText = '';
                        if (diffDays > 0) cdText = diffDays + 'd ' + diffHours + 'h';
                        else if (diffHours > 0) cdText = diffHours + 'h ' + diffMins + 'm';
                        else cdText = diffMins + 'm';
                        countdownHtml = '<div class="event-countdown"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + cdText + '</div>';
                    }
                }

                html += '<div class="event-body">' +
                    '<div class="event-header">' +
                        '<span class="event-type-badge" style="background:' + typeBadgeColor + '">' + escapeHtml(typeLabel) + '</span>' +
                        (dateStr ? '<span class="event-date">' + escapeHtml(dateStr) + '</span>' : '') +
                    '</div>' +
                    '<div class="event-title">' + escapeHtml(ev.title) + '</div>' +
                    (ev.description ? '<div class="event-desc">' + escapeHtml(ev.description.substring(0, 120)) + (ev.description.length > 120 ? '...' : '') + '</div>' : '') +
                    countdownHtml +
                '</div></div>';
            });
            html += '</div>';
            section.innerHTML = html;
        });
    }

    function showBlogPostDetail(post) {
        var el = $('#page-home');
        if (!el) return;

        var dateStr = '';
        if (post.published_at) {
            try {
                var d = new Date(post.published_at);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }

        var html = '<button class="back-btn" id="blog-back-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

        if (post.cover_image_url) {
            html += '<div class="blog-detail-cover"><img src="' + escapeHtml(post.cover_image_url) + '" alt=""></div>';
        }

        html += '<div class="blog-detail-header">' +
            '<h1 class="blog-detail-title">' + escapeHtml(post.title) + '</h1>' +
            '<div class="blog-detail-meta">' + escapeHtml(dateStr) +
                (post.author ? ' · ' + escapeHtml(typeof post.author === 'string' ? post.author : (post.author.display_name || post.author.username || '')) : '') +
            '</div>' +
        '</div>' +
        '<div class="blog-detail-content card">' + sanitizeHtml(post.content || '') + '</div>' +
        '<div class="section-title">Comentários</div>' +
        '<div id="blog-comments-section"><div class="loader-spinner" style="margin:16px auto"></div></div>';

        el.innerHTML = html;

        el.querySelector('#blog-back-btn').addEventListener('click', function() {
            renderHome();
        });

        loadBlogComments(post.id, 1);
    }

    function loadBlogComments(postId, page) {
        var section = $('#blog-comments-section');
        if (!section) return;

        if (page === 1) {
            section.innerHTML = '<div class="loader-spinner" style="margin:16px auto"></div>';
        }

        NovaAPI.getBlogComments(postId, page, function(err, data) {
            if (!section) return;
            if (err || !data) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">Não foi possível carregar comentários.</p>';
                return;
            }

            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var loggedIn = isCmsLoggedIn();

            var html = '';

            if (loggedIn) {
                html += '<div class="comment-form-wrap">' +
                    '<form id="blog-comment-form" class="comment-form">' +
                        '<textarea id="blog-comment-text" class="comment-textarea" placeholder="Escreva um comentário..." rows="3" maxlength="1000"></textarea>' +
                        '<div class="comment-form-actions">' +
                            '<span id="blog-comment-char-count" class="comment-char-count">0/1000</span>' +
                            '<button type="submit" class="btn btn-primary btn-sm" id="blog-comment-submit-btn">Enviar</button>' +
                        '</div>' +
                        '<p id="blog-comment-error" class="comment-error hidden"></p>' +
                    '</form>' +
                '</div>';
            } else {
                html += '<div class="comment-login-prompt">' +
                    '<p>Faça login na sua conta GODSend para comentar.</p>' +
                '</div>';
            }

            if (comments.length === 0 && page === 1) {
                html += '<div class="comment-empty"><p>Nenhum comentário ainda. Seja o primeiro!</p></div>';
            } else {
                html += '<div class="comment-list" id="blog-comment-list">';
                comments.forEach(function(c) {
                    html += renderBlogCommentItem(c, cmsProfile);
                });
                html += '</div>';

                if (data.page < data.pages) {
                    html += '<div class="comment-load-more">' +
                        '<button class="btn btn-secondary btn-sm" id="blog-comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>' +
                    '</div>';
                }
            }

            html += '<div class="comment-total" style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px">' + (data.total || 0) + ' comentário(s)</div>';

            section.innerHTML = html;

            if (loggedIn) {
                bindBlogCommentForm(postId);
            }
            bindBlogCommentActions(postId);

            var loadMoreBtn = $('#blog-comment-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', function() {
                    var nextPage = parseInt(this.getAttribute('data-page'));
                    appendBlogComments(postId, nextPage);
                });
            }
        });
    }

    function appendBlogComments(postId, page) {
        var loadMoreBtn = $('#blog-comment-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Carregando...';
        }

        NovaAPI.getBlogComments(postId, page, function(err, data) {
            if (err || !data) return;
            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var list = $('#blog-comment-list');
            if (!list) return;

            comments.forEach(function(c) {
                list.insertAdjacentHTML('beforeend', renderBlogCommentItem(c, cmsProfile));
            });

            var loadMoreWrap = loadMoreBtn ? loadMoreBtn.parentElement : null;
            if (loadMoreWrap) {
                if (data.page < data.pages) {
                    loadMoreWrap.innerHTML = '<button class="btn btn-secondary btn-sm" id="blog-comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>';
                    var newBtn = $('#blog-comment-load-more');
                    if (newBtn) {
                        newBtn.addEventListener('click', function() {
                            appendBlogComments(postId, parseInt(this.getAttribute('data-page')));
                        });
                    }
                } else {
                    loadMoreWrap.remove();
                }
            }

            bindBlogCommentActions(postId);
        });
    }

    function renderBlogCommentItem(c, cmsProfile) {
        var up = c.userProfile || {};
        var displayName = escapeHtml(up.display_name || up.username || 'Anônimo');
        var avatarInitial = (up.display_name || up.username || '?')[0].toUpperCase();
        var avatarHtml = up.avatar_url
            ? '<img class="comment-avatar" src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="comment-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="comment-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var dateStr = '';
        if (c.created_at) {
            try {
                var d = new Date(c.created_at);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) { dateStr = c.created_at; }
        }

        var deleteBtn = '';
        if (cmsProfile && up.id === cmsProfile.id) {
            deleteBtn = '<button class="blog-comment-delete-btn comment-delete-btn" data-comment-id="' + c.id + '" title="Excluir">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>';
        }

        var authorTag = up.id
            ? '<a class="comment-author comment-author-link" data-profile-id="' + up.id + '" href="javascript:void(0)">' + displayName + '</a>'
            : '<span class="comment-author">' + displayName + '</span>';

        return '<div class="comment-item" data-comment-id="' + c.id + '">' +
            '<div class="comment-avatar-wrap">' + avatarHtml + '</div>' +
            '<div class="comment-body">' +
                '<div class="comment-header">' +
                    authorTag +
                    '<span class="comment-date">' + escapeHtml(dateStr) + '</span>' +
                    deleteBtn +
                '</div>' +
                '<div class="comment-text">' + escapeHtml(c.comment_text) + '</div>' +
            '</div>' +
        '</div>';
    }

    function bindBlogCommentForm(postId) {
        var form = $('#blog-comment-form');
        if (!form) return;

        var textarea = $('#blog-comment-text');
        var charCount = $('#blog-comment-char-count');
        if (textarea && charCount) {
            textarea.addEventListener('input', function() {
                charCount.textContent = this.value.length + '/1000';
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var text = textarea.value.trim();
            var errorEl = $('#blog-comment-error');
            var submitBtn = $('#blog-comment-submit-btn');

            if (!text) {
                if (errorEl) { errorEl.textContent = 'Escreva algo antes de enviar.'; errorEl.classList.remove('hidden'); }
                return;
            }

            if (errorEl) errorEl.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            NovaAPI.addBlogComment(postId, text, function(err, comment) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar';

                if (err) {
                    if (errorEl) { errorEl.textContent = err.message || 'Erro ao enviar comentário'; errorEl.classList.remove('hidden'); }
                    return;
                }

                textarea.value = '';
                if (charCount) charCount.textContent = '0/1000';
                loadBlogComments(postId, 1);
            });
        });
    }

    function bindBlogCommentActions(postId) {
        document.querySelectorAll('.blog-comment-delete-btn').forEach(function(btn) {
            btn.onclick = function() {
                var commentId = this.getAttribute('data-comment-id');
                if (!confirm('Excluir este comentário?')) return;
                var item = this.closest('.comment-item');
                if (item) item.style.opacity = '0.5';

                NovaAPI.deleteBlogComment(postId, commentId, function(err) {
                    if (err) {
                        if (item) item.style.opacity = '1';
                        return;
                    }
                    loadBlogComments(postId, 1);
                });
            };
        });
        document.querySelectorAll('#blog-comments-section .comment-author-link').forEach(function(link) {
            link.onclick = function(e) {
                e.preventDefault();
                var pid = parseInt(this.getAttribute('data-profile-id'));
                if (pid) showUserPublicProfile(pid);
            };
        });
    }

    function showNotificationPanel(bellEl) {
        var notifs = (state.cmsNotifications && state.cmsNotifications.notifications) || [];
        var panel = document.createElement('div');
        panel.id = 'cms-notif-panel';
        panel.className = 'cms-notif-panel';

        if (notifs.length === 0) {
            panel.innerHTML = '<div class="cms-notif-empty">Sem notificações</div>';
        } else {
            var html = '<div class="cms-notif-list">';
            notifs.forEach(function(n) {
                var iconSvg = '';
                if (n.type === 'friend_request') {
                    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
                } else if (n.type === 'room_invite' || n.type === 'room_reminder') {
                    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
                } else if (n.type === 'achievement') {
                    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 15l-2 5 2-1 2 1-2-5z"/><circle cx="12" cy="8" r="6"/></svg>';
                } else {
                    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
                }
                var readClass = n.read ? ' cms-notif-read' : '';
                var timeStr = '';
                if (n.createdAt || n.created_at) {
                    try {
                        var d = new Date(n.createdAt || n.created_at);
                        var now = new Date();
                        var diffMs = now - d;
                        var diffMin = Math.floor(diffMs / 60000);
                        if (diffMin < 1) timeStr = 'agora';
                        else if (diffMin < 60) timeStr = diffMin + 'min';
                        else if (diffMin < 1440) timeStr = Math.floor(diffMin / 60) + 'h';
                        else timeStr = Math.floor(diffMin / 1440) + 'd';
                    } catch(e) {}
                }
                html += '<div class="cms-notif-item' + readClass + '" data-notif-id="' + n.id + '" data-notif-type="' + escapeHtml(n.type) + '" data-notif-data=\'' + escapeHtml(JSON.stringify(n.data || {})) + '\'>' +
                    '<div class="cms-notif-icon">' + iconSvg + '</div>' +
                    '<div class="cms-notif-body">' +
                        '<div class="cms-notif-title">' + escapeHtml(n.title) + '</div>' +
                        (n.message ? '<div class="cms-notif-msg">' + escapeHtml(n.message) + '</div>' : '') +
                    '</div>' +
                    (timeStr ? '<div class="cms-notif-time">' + timeStr + '</div>' : '') +
                '</div>';
            });
            html += '</div>';
            panel.innerHTML = html;
        }

        var parent = bellEl.closest('.section-title') || bellEl.parentElement;
        parent.style.position = 'relative';
        parent.appendChild(panel);

        panel.querySelectorAll('.cms-notif-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var nid = parseInt(item.getAttribute('data-notif-id'));
                var ntype = item.getAttribute('data-notif-type');
                var ndata = {};
                try { ndata = JSON.parse(item.getAttribute('data-notif-data')); } catch(e) {}

                if (!item.classList.contains('cms-notif-read')) {
                    NovaAPI.markNotificationRead(nid, function() {});
                    item.classList.add('cms-notif-read');
                    if (state.cmsNotifications && state.cmsNotifications.unread_count > 0) {
                        state.cmsNotifications.unread_count--;
                        var badge = bellEl.querySelector('.cms-notif-count');
                        if (state.cmsNotifications.unread_count > 0) {
                            if (badge) badge.textContent = state.cmsNotifications.unread_count > 9 ? '9+' : state.cmsNotifications.unread_count;
                        } else {
                            if (badge) badge.remove();
                        }
                        var n = state.cmsNotifications.notifications;
                        if (n) {
                            for (var i = 0; i < n.length; i++) {
                                if (n[i].id === nid) { n[i].read = true; break; }
                            }
                        }
                    }
                }

                panel.remove();

                if (ntype === 'friend_request') {
                    navigateTo('friends');
                } else if (ntype === 'room_invite' || ntype === 'room_reminder') {
                    navigateTo('rooms');
                    if (ndata && ndata.room_id) {
                        setTimeout(function() { loadRoomDetail(ndata.room_id); }, 200);
                    }
                } else if (ntype === 'achievement') {
                    navigateTo('home');
                }
            });
        });

        var closePanel = function(e) {
            if (!panel.contains(e.target) && e.target !== bellEl && !bellEl.contains(e.target)) {
                panel.remove();
                document.removeEventListener('click', closePanel);
            }
        };
        setTimeout(function() {
            document.addEventListener('click', closePanel);
        }, 10);
    }

    function bindHomeLiveHandlers() {
        var restartBtn = $('#restart-aurora-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', function() {
                restartBtn.disabled = true;
                restartBtn.textContent = 'Restarting...';
                NovaAPI.getPluginInfo(function(err, data) {
                    if (err || !data || !data.path || !data.path.launcher) {
                        restartBtn.textContent = 'Error';
                        setTimeout(function() { restartBtn.disabled = false; restartBtn.textContent = 'Restart Aurora'; }, 2000);
                        return;
                    }
                    var fullPath = data.path.launcher;
                    var lastSlash = fullPath.lastIndexOf('\\');
                    var dir = lastSlash !== -1 ? fullPath.substring(0, lastSlash) : fullPath;
                    var exec = lastSlash !== -1 ? fullPath.substring(lastSlash + 1) : 'default.xex';
                    NovaAPI.launchTitle({ directory: dir, executable: exec, type: 0 }, function(launchErr) {
                        if (launchErr) {
                            restartBtn.textContent = 'Error';
                        } else {
                            restartBtn.textContent = 'Sent!';
                        }
                        setTimeout(function() { restartBtn.disabled = false; restartBtn.textContent = 'Restart Aurora'; }, 3000);
                    });
                });
            });
        }

        var notifBell = $('#cms-notif-bell');
        if (notifBell) {
            notifBell.addEventListener('click', function(e) {
                e.stopPropagation();
                var existing = $('#cms-notif-panel');
                if (existing) {
                    existing.remove();
                    return;
                }
                showNotificationPanel(notifBell);
            });
        }

        var npCard = document.querySelector('.now-playing-card[data-np-tid]');
        if (npCard) {
            npCard.addEventListener('click', function() {
                var tid = this.getAttribute('data-np-tid');
                if (tid && state.games.length > 0) {
                    navigateTo('games');
                    setTimeout(function() { showGameDetail(tid); }, 100);
                } else if (tid) {
                    navigateTo('games');
                }
            });
        }

        var npArt = document.querySelector('.now-playing-art[data-auth-src]');
        if (npArt) {
            NovaAPI.loadAuthImage(npArt.getAttribute('data-auth-src'), npArt);
        }
    }

    function renderTempCard(label, temp) {
        var pct = Math.min(100, Math.round((temp / 100) * 100));
        return '<div class="info-item">' +
            '<div class="info-label">' + label + '</div>' +
            '<div class="info-value ' + getTempClass(temp) + '">' + temp + '°C</div>' +
            '<div class="temp-bar"><div class="temp-bar-fill" style="width:' + pct + '%;background:' + getTempColor(temp) + '"></div></div>' +
        '</div>';
    }

    function renderGames() {
        var el = $('#page-games');
        applyGameFilter();

        if (state.selectedGame) {
            var selectedStillVisible = state.filteredGames.some(function(g) {
                return getGameId(g) === getGameId(state.selectedGame);
            });
            if (!selectedStillVisible) {
                state.selectedGame = null;
            }
        }

        var searchBarHtml = '<div class="search-bar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input type="text" id="game-search" placeholder="Search games..." value="' + escapeHtml(state.searchQuery) + '">' +
        '</div>';

        var tabsHtml = '<div class="tabs">' +
            renderTab('all', 'All') +
            renderTab('1', 'Xbox 360') +
            renderTab('2', 'Arcade') +
            renderTab('3', 'Indie') +
            renderTab('homebrew', 'Homebrew') +
            renderTab('4', 'OG Xbox') +
        '</div>';

        var viewToggleHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
            '<div class="game-count">' + state.filteredGames.length + ' games</div>' +
            '<div class="view-toggle">' +
                '<button class="' + (state.gameView === 'grid' ? 'active' : '') + '" data-view="grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></button>' +
                '<button class="' + (state.gameView === 'list' ? 'active' : '') + '" data-view="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>' +
            '</div>' +
        '</div>';

        var gamesHtml = '';
        if (state.filteredGames.length === 0) {
            gamesHtml = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/></svg><p>No games found</p></div>';
        } else if (state.gameView === 'grid') {
            gamesHtml = '<div class="game-grid">';
            state.filteredGames.forEach(function(g) {
                var imgUrl = getGameArt(g) || '';
                var imgAttr = imgUrl ? 'data-auth-src="' + escapeHtml(imgUrl) + '"' : 'src="img/noboxart.svg"';
                var hasLaunch = !!(g.directory && g.executable);
                var launchBtnHtml = hasLaunch ?
                    '<button class="game-card-launch" data-titleid="' + escapeHtml(getGameId(g)) + '" title="Launch">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                    '</button>' : '';
                gamesHtml += '<div class="game-card" data-titleid="' + escapeHtml(getGameId(g)) + '">' +
                    '<div class="game-card-img-wrapper">' +
                        '<img class="game-card-img" ' + imgAttr + ' alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                        launchBtnHtml +
                    '</div>' +
                    '<div class="game-card-info">' +
                        '<div class="game-card-title">' + escapeHtml(getGameName(g)) + '</div>' +
                        '<div class="game-card-type">' + gameTypeLabel(getGameType(g)) + '</div>' +
                    '</div>' +
                '</div>';
            });
            gamesHtml += '</div>';
        } else {
            gamesHtml = '<div class="game-list-container">';
            state.filteredGames.forEach(function(g) {
                var imgUrl = getGameArt(g) || '';
                var tileUrl = '';
                if (g.art) tileUrl = g.art.tile || g.art.boxartLarge || g.art.boxartSmall || '';
                if (!tileUrl) tileUrl = imgUrl;
                var imgAttr = tileUrl ? 'data-auth-src="' + escapeHtml(tileUrl) + '"' : 'src="img/noboxart.svg"';
                var selectedClass = (state.selectedGame && getGameId(state.selectedGame) === getGameId(g)) ? ' selected' : '';
                var hasLaunch = !!(g.directory && g.executable);
                var launchBtnHtml = hasLaunch ?
                    '<button class="game-list-launch" data-titleid="' + escapeHtml(getGameId(g)) + '" title="Launch">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                    '</button>' : '';
                gamesHtml += '<div class="game-list-item' + selectedClass + '" data-titleid="' + escapeHtml(getGameId(g)) + '">' +
                    '<img class="game-list-thumb" ' + imgAttr + ' alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                    '<div class="game-list-info">' +
                        '<div class="game-list-title">' + escapeHtml(getGameName(g)) + '</div>' +
                        '<div class="game-list-meta">' + gameTypeLabel(getGameType(g)) + '</div>' +
                    '</div>' +
                    launchBtnHtml +
                '</div>';
            });
            gamesHtml += '</div>';
        }

        el.innerHTML = '<div class="page-header"><div class="page-title">' +
            (state.gameFilter === 'all' ? 'All' : state.gameFilter === '1' ? 'Xbox 360' : state.gameFilter === '2' ? 'Arcade' : state.gameFilter === '3' ? 'Indie' : state.gameFilter === '4' ? 'OG Xbox' : 'Homebrew') +
            ' Games</div><div class="page-subtitle">' + state.filteredGames.length + ' Titles</div></div>' +
            searchBarHtml + tabsHtml + viewToggleHtml + gamesHtml;

        var searchInput = $('#game-search');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                state.searchQuery = e.target.value;
                renderGames();
            });
        }

        $$('.tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                state.gameFilter = this.dataset.filter;
                renderGames();
            });
        });

        $$('.view-toggle button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                state.gameView = this.dataset.view;
                if (this.dataset.view === 'grid') {
                    state.selectedGame = null;
                }
                renderGames();
            });
        });

        $$('img[data-auth-src]').forEach(function(img) {
            NovaAPI.loadAuthImage(img.getAttribute('data-auth-src'), img);
        });

        $$('.game-card').forEach(function(card) {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.game-card-launch')) return;
                var tid = this.dataset.titleid;
                showGameDetail(tid);
            });
        });

        $$('.game-list-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.game-list-launch')) return;
                var tid = this.dataset.titleid;
                showGameDetail(tid);
            });
        });

        $$('.game-card-launch, .game-list-launch').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                var self = this;
                var tid = this.dataset.titleid;
                var game = state.games.find(function(g) { return getGameId(g) === tid; });
                if (game && game.directory && game.executable) {
                    self.disabled = true;
                    self.style.background = 'rgba(255,165,0,0.9)';
                    NovaAPI.launchTitle(game, function(err) {
                        if (err) {
                            self.style.background = 'rgba(244,67,54,0.9)';
                            setTimeout(function() {
                                self.disabled = false;
                                self.style.background = '';
                            }, 2000);
                        } else {
                            self.style.background = 'rgba(76,175,80,0.9)';
                            setTimeout(function() {
                                self.disabled = false;
                                self.style.background = '';
                            }, 3000);
                        }
                    });
                }
            });
        });

    }

    function renderTab(filter, label) {
        return '<button class="tab ' + (state.gameFilter === filter ? 'active' : '') + '" data-filter="' + filter + '">' + label + '</button>';
    }

    function applyGameFilter() {
        state.filteredGames = state.games.filter(function(g) {
            if (g.hidden) return false;
            var cg = String(getGameType(g));
            var matchType;
            if (state.gameFilter === 'all') {
                matchType = true;
            } else if (state.gameFilter === 'homebrew') {
                matchType = cg === '5' || cg === '6' || cg === '7';
            } else {
                matchType = cg === state.gameFilter;
            }
            var matchSearch = !state.searchQuery || getGameName(g).toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1;
            return matchType && matchSearch;
        });
    }

    function showGameDetail(titleId) {
        var game = state.games.find(function(g) {
            var gid = getGameId(g);
            return gid && gid.toLowerCase() === titleId.toLowerCase();
        });
        if (!game) return;

        state.selectedGame = game;
        var el = $('#page-games');
        var bannerUrl = getGameBanner(game) || '';
        var bannerAttr = bannerUrl ? 'data-auth-src="' + escapeHtml(bannerUrl) + '"' : 'src="img/noboxart.svg"';
        var boxartUrl = getGameBoxartLarge(game);
        var boxartAttr = boxartUrl ? 'data-auth-src="' + escapeHtml(boxartUrl) + '"' : 'src="img/noboxart.svg"';

        var currentTid = getTitleIdFromState();
        var isRunning = currentTid && currentTid.toLowerCase() === titleId.toLowerCase();
        var ti = isRunning ? state.title : null;

        var metaItems = '';
        metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Title ID</span><span class="game-detail-meta-value" style="font-family:monospace">' + escapeHtml(getGameId(game)) + '</span></div>';
        metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Type</span><span class="game-detail-meta-value">' + gameTypeLabel(getGameType(game)) + '</span></div>';

        if (ti && ti.mediaid) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Media ID</span><span class="game-detail-meta-value" style="font-family:monospace">' + escapeHtml(ti.mediaid) + '</span></div>';
        }
        if (ti && ti.disc) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Disc</span><span class="game-detail-meta-value">' + safeStr(ti.disc.current) + ' / ' + safeStr(ti.disc.count) + '</span></div>';
        }
        if (ti && ti.version) {
            if (ti.version.base) metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Base Version</span><span class="game-detail-meta-value">' + escapeHtml(safeStr(ti.version.base)) + '</span></div>';
            if (ti.version.current) metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Current Version</span><span class="game-detail-meta-value">' + escapeHtml(safeStr(ti.version.current)) + '</span></div>';
        }
        if (ti && ti.tuver != null) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">TU Version</span><span class="game-detail-meta-value">' + escapeHtml(safeStr(ti.tuver)) + '</span></div>';
        }
        if (ti && ti.resolution) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Resolution</span><span class="game-detail-meta-value">' + safeStr(ti.resolution.width) + ' × ' + safeStr(ti.resolution.height) + '</span></div>';
        }
        var gamePath = getGamePath(game);
        if (gamePath) {
            metaItems += '<div class="game-detail-meta-item game-detail-meta-path"><span class="game-detail-meta-label">Path</span><span class="game-detail-meta-value" style="font-family:monospace;font-size:11px;word-break:break-all">' + escapeHtml(gamePath) + '</span></div>';
        }

        var screenshots = getGameScreenshots(game);
        var screenshotsHtml = '';
        if (screenshots.length > 0) {
            screenshotsHtml = '<div class="detail-section"><div class="section-title">Screenshots <span class="badge badge-accent">' + screenshots.length + '</span></div>' +
                '<div class="game-screenshots-grid">';
            screenshots.forEach(function(ssUrl, idx) {
                screenshotsHtml += '<div class="game-screenshot-item" data-ss-idx="' + idx + '">' +
                    '<img class="game-screenshot-img" data-auth-src="' + escapeHtml(ssUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                '</div>';
            });
            screenshotsHtml += '</div></div>';
        }

        var descriptionHtml = '';

        var html = '<button class="back-btn" id="back-to-games">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back' +
        '</button>' +
        '<div class="game-detail-header">' +
            '<img class="game-detail-bg" ' + bannerAttr + ' alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
            '<div class="game-detail-overlay">' +
                '<div class="game-detail-title-row">' +
                    '<div class="game-detail-title">' + escapeHtml(getGameName(game)) + '</div>' +
                    (isRunning ? '<span class="badge badge-success">Now Playing</span>' : '') +
                '</div>' +
            '</div>' +
            '<div id="game-favorite-btn-wrap"></div>' +
        '</div>' +
        '<div class="game-detail-body">' +
            '<div class="game-detail-sidebar">' +
                '<img class="game-detail-boxart" ' + boxartAttr + ' alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                (game.directory && game.executable ? '<button class="btn btn-primary btn-block" id="launch-game" style="margin-top:12px">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Game' +
                '</button>' : '') +
                '<div id="sidebar-trailer-btn-wrap"></div>' +
            '</div>' +
            '<div class="game-detail-main">' +
                '<div class="game-detail-tabs">' +
                    '<button class="game-detail-tab active" data-detail-tab="description">Descrição</button>' +
                    (state.isOnline ? '<button class="game-detail-tab" data-detail-tab="comments">Comentários</button>' : '') +
                    '<button class="game-detail-tab" data-detail-tab="extrainfo">Informações Extras</button>' +
                '</div>' +
                '<div id="game-tab-description" class="game-tab-content">' +
                    '<div id="game-description-section" class="game-description-section">' +
                        '<div class="game-description"><p class="game-desc-text" style="color:var(--text-muted)">Carregando descrição...</p></div>' +
                    '</div>' +
                '</div>' +
                (state.isOnline ? '<div id="game-tab-comments" class="game-tab-content" style="display:none">' +
                    '<div id="game-comments-section"><div class="loader-spinner" style="margin:16px auto"></div></div>' +
                '</div>' : '') +
                '<div id="game-tab-extrainfo" class="game-tab-content" style="display:none">' +
                    '<div class="game-detail-meta">' + metaItems + '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        screenshotsHtml +
        '<div id="achievements-section" class="detail-section">' +
            '<div class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align:-2px;margin-right:4px"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="16" cy="10" r="1"/><circle cx="18" cy="12" r="1"/></svg>Game Achievements</div>' +
            '<div class="card"><div class="loader-spinner" style="margin:16px auto"></div></div>' +
        '</div>' +
        (state.isOnline && isCmsLoggedIn() && state.cmsProfile ? '<div id="stix-achievements-section" class="detail-section">' +
            '<div class="section-title"><span class="cms-ach-badge-stix" style="font-size:10px;padding:1px 5px;margin-right:4px">STIX</span>Conquistas Stix <span class="stix-ach-count-badge">' + (state.cmsProfile.achievements_count || 0) + '</span></div>' +
        '</div>' : '');

        el.innerHTML = html;

        $('#back-to-games').addEventListener('click', function() {
            state.selectedGame = null;
            renderGames();
        });

        var launchBtn = $('#launch-game');
        if (launchBtn) {
            launchBtn.addEventListener('click', function() {
                var btn = this;
                btn.disabled = true;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launching...';
                NovaAPI.launchTitle(game, function(err) {
                    if (err) {
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Error!';
                        btn.style.background = 'var(--danger)';
                    } else {
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launched!';
                    }
                    setTimeout(function() {
                        btn.disabled = false;
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Game';
                        btn.style.background = '';
                    }, 3000);
                });
            });
        }

        document.querySelectorAll('.game-screenshot-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var img = this.querySelector('.game-screenshot-img');
                if (!img) return;
                var src = img.getAttribute('data-auth-src') || img.src;
                if (src) openGameScreenshot(src);
            });
        });

        $$('img[data-auth-src]').forEach(function(img) {
            NovaAPI.loadAuthImage(img.getAttribute('data-auth-src'), img);
        });

        var commentsLoaded = false;
        document.querySelectorAll('.game-detail-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var target = this.getAttribute('data-detail-tab');
                document.querySelectorAll('.game-detail-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                document.querySelectorAll('.game-tab-content').forEach(function(c) { c.style.display = 'none'; });
                var panel = $('#game-tab-' + target);
                if (panel) panel.style.display = '';
                if (target === 'comments' && !commentsLoaded) {
                    commentsLoaded = true;
                    loadGameComments(getGameId(game), getGameName(game), 1);
                }
            });
        });

        function extractYouTubeId(url) {
            if (!url) return null;
            var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            return m ? m[1] : null;
        }

        function openTrailerModal(youtubeUrl) {
            var videoId = extractYouTubeId(youtubeUrl);
            if (!videoId) return;
            var existing = $('#trailer-modal');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'trailer-modal';
            modal.className = 'trailer-modal';
            modal.innerHTML = '<div class="trailer-modal-backdrop"></div>' +
                '<div class="trailer-modal-content">' +
                    '<button class="trailer-modal-close" id="trailer-modal-close">&times;</button>' +
                    '<iframe class="trailer-modal-iframe" src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>' +
                '</div>';
            document.body.appendChild(modal);
            modal.querySelector('.trailer-modal-backdrop').addEventListener('click', function() { modal.remove(); });
            modal.querySelector('#trailer-modal-close').addEventListener('click', function() { modal.remove(); });
        }

        function renderDescriptionSection(desc, developer, publisher, releaseDate, youtubeTrailerUrl) {
            var descEl = $('#game-description-section');
            if (!descEl) return;
            var extra = '';
            if (developer) extra += '<span class="game-desc-meta"><strong>Developer:</strong> ' + escapeHtml(developer) + '</span>';
            if (publisher) extra += '<span class="game-desc-meta"><strong>Publisher:</strong> ' + escapeHtml(publisher) + '</span>';
            if (releaseDate) extra += '<span class="game-desc-meta"><strong>Release:</strong> ' + escapeHtml(releaseDate) + '</span>';
            descEl.innerHTML = '<div class="game-description">' +
                (extra ? '<div class="game-desc-meta-row">' + extra + '</div>' : '') +
                '<p class="game-desc-text">' + escapeHtml(desc) + '</p>' +
            '</div>';
            var sidebarWrap = $('#sidebar-trailer-btn-wrap');
            if (sidebarWrap && youtubeTrailerUrl && extractYouTubeId(youtubeTrailerUrl)) {
                sidebarWrap.innerHTML = '<button class="btn btn-trailer btn-block" id="play-trailer-btn" style="margin-top:8px">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                    ' Play Trailer</button>';
                var tBtn = sidebarWrap.querySelector('#play-trailer-btn');
                if (tBtn) {
                    tBtn.addEventListener('click', function() { openTrailerModal(youtubeTrailerUrl); });
                }
            }
        }

        var gameTitleId = getGameId(game);
        var descLoaded = false;

        function fallbackToDbox() {
            NovaAPI.getDBoxDescription(gameTitleId, function(err, dbox) {
                if (descLoaded) return;
                if (!err && dbox && dbox.description) {
                    descLoaded = true;
                    var relDate = '';
                    if (dbox.release_date) {
                        try { relDate = dbox.release_date.substring(0, 10); } catch(e) {}
                    }
                    renderDescriptionSection(dbox.description, dbox.developer, dbox.publisher, relDate);
                } else if (isRunning) {
                    NovaAPI.getLiveInfo(function(err, info) {
                        if (descLoaded) return;
                        var descEl = $('#game-description-section');
                        if (!descEl) return;
                        if (!err && info && (info.description || info.reduceddescription)) {
                            descLoaded = true;
                            var desc = info.description || info.reduceddescription;
                            renderDescriptionSection(desc, info.developer, info.publisher, info.releasedate);
                        } else {
                            descEl.innerHTML = '<div class="game-description"><p class="game-desc-text" style="color:var(--text-muted)">Nenhuma descrição disponível.</p></div>';
                        }
                    });
                } else {
                    var descEl = $('#game-description-section');
                    if (descEl) {
                        descEl.innerHTML = '<div class="game-description"><p class="game-desc-text" style="color:var(--text-muted)">Nenhuma descrição disponível.</p></div>';
                    }
                }
            });
        }

        NovaAPI.getCmsGameByTitleId(gameTitleId, function(err, cmsGame) {
            if (!err && cmsGame && cmsGame.description) {
                descLoaded = true;
                var relDate = '';
                if (cmsGame.release_date) {
                    try { relDate = String(cmsGame.release_date).substring(0, 10); } catch(e) {}
                }
                renderDescriptionSection(cmsGame.description, null, cmsGame.publisher, relDate, cmsGame.youtube_trailer_url);
            } else {
                fallbackToDbox();
            }
            if (!err && cmsGame && cmsGame.status === 'active' && cmsGame.id && isCmsLoggedIn() && state.cmsProfile) {
                loadFavoriteButton(cmsGame.id);
            }
        });

        loadAchievements(titleId);
    }

    function loadFavoriteButton(cmsGameId) {
        var wrap = $('#game-favorite-btn-wrap');
        if (!wrap) return;
        var cp = state.cmsProfile;
        if (!cp) return;
        var wpUserId = cp.wp_user_id || cp.id;
        if (!wpUserId) return;

        NovaAPI.checkFavorite(cmsGameId, wpUserId, function(err, data) {
            if (err || !wrap) return;
            var isFav = data && data.is_favorite;
            renderFavBtn(wrap, cmsGameId, wpUserId, isFav);
        });
    }

    function renderFavBtn(wrap, gameId, userId, isFav) {
        var heartFilled = '<svg viewBox="0 0 24 24" fill="var(--danger)" stroke="var(--danger)" stroke-width="2" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        var heartEmpty = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        wrap.innerHTML = '<button class="game-favorite-btn' + (isFav ? ' favorited' : '') + '" id="toggle-favorite-btn" title="' + (isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '">' + (isFav ? heartFilled : heartEmpty) + '</button>';
        var btn = wrap.querySelector('#toggle-favorite-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                btn.disabled = true;
                if (isFav) {
                    NovaAPI.removeFavorite(gameId, userId, function(err2) {
                        if (!err2) renderFavBtn(wrap, gameId, userId, false);
                        else btn.disabled = false;
                    });
                } else {
                    NovaAPI.addFavorite(gameId, userId, function(err2) {
                        if (!err2) renderFavBtn(wrap, gameId, userId, true);
                        else btn.disabled = false;
                    });
                }
            });
        }
    }

    function loadGameComments(titleId, gameTitle, page) {
        var section = $('#game-comments-section');
        if (!section) return;

        if (page === 1) {
            section.innerHTML = '<div class="loader-spinner" style="margin:16px auto"></div>';
        }

        NovaAPI.getGameComments(titleId, page, function(err, data) {
            if (!section) return;
            if (err || !data) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">Não foi possível carregar comentários.</p>';
                return;
            }

            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var loggedIn = isCmsLoggedIn();

            var html = '';

            if (loggedIn) {
                html += '<div class="comment-form-wrap">' +
                    '<form id="comment-form" class="comment-form">' +
                        '<textarea id="comment-text" class="comment-textarea" placeholder="Escreva um comentário..." rows="3" maxlength="1000"></textarea>' +
                        '<div class="comment-form-actions">' +
                            '<span id="comment-char-count" class="comment-char-count">0/1000</span>' +
                            '<button type="submit" class="btn btn-primary btn-sm" id="comment-submit-btn">Enviar</button>' +
                        '</div>' +
                        '<p id="comment-error" class="comment-error hidden"></p>' +
                    '</form>' +
                '</div>';
            } else {
                html += '<div class="comment-login-prompt">' +
                    '<p>Faça login na sua conta GODSend para comentar.</p>' +
                '</div>';
            }

            if (comments.length === 0 && page === 1) {
                html += '<div class="comment-empty"><p>Nenhum comentário ainda. Seja o primeiro!</p></div>';
            } else {
                html += '<div class="comment-list" id="comment-list">';
                comments.forEach(function(c) {
                    html += renderCommentItem(c, cmsProfile);
                });
                html += '</div>';

                if (data.page < data.pages) {
                    html += '<div class="comment-load-more">' +
                        '<button class="btn btn-secondary btn-sm" id="comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>' +
                    '</div>';
                }
            }

            html += '<div class="comment-total" style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px">' + (data.total || 0) + ' comentário(s)</div>';

            section.innerHTML = html;

            if (loggedIn) {
                bindCommentForm(titleId, gameTitle);
            }
            bindCommentActions(titleId, gameTitle);

            var loadMoreBtn = $('#comment-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', function() {
                    var nextPage = parseInt(this.getAttribute('data-page'));
                    appendGameComments(titleId, gameTitle, nextPage);
                });
            }
        });
    }

    function appendGameComments(titleId, gameTitle, page) {
        var loadMoreBtn = $('#comment-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Carregando...';
        }

        NovaAPI.getGameComments(titleId, page, function(err, data) {
            if (err || !data) return;
            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var list = $('#comment-list');
            if (!list) return;

            comments.forEach(function(c) {
                list.insertAdjacentHTML('beforeend', renderCommentItem(c, cmsProfile));
            });

            var loadMoreWrap = loadMoreBtn ? loadMoreBtn.parentElement : null;
            if (loadMoreWrap) {
                if (data.page < data.pages) {
                    loadMoreWrap.innerHTML = '<button class="btn btn-secondary btn-sm" id="comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>';
                    var newBtn = $('#comment-load-more');
                    if (newBtn) {
                        newBtn.addEventListener('click', function() {
                            appendGameComments(titleId, gameTitle, parseInt(this.getAttribute('data-page')));
                        });
                    }
                } else {
                    loadMoreWrap.remove();
                }
            }

            bindCommentActions(titleId, gameTitle);
        });
    }

    function renderCommentItem(c, cmsProfile) {
        var up = c.userProfile || {};
        var displayName = escapeHtml(up.display_name || up.username || 'Anônimo');
        var avatarInitial = (up.display_name || up.username || '?')[0].toUpperCase();
        var avatarHtml = up.avatar_url
            ? '<img class="comment-avatar" src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="comment-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="comment-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var dateStr = '';
        if (c.created_at) {
            try {
                var d = new Date(c.created_at);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) { dateStr = c.created_at; }
        }

        var deleteBtn = '';
        if (cmsProfile && up.id === cmsProfile.id) {
            deleteBtn = '<button class="comment-delete-btn" data-comment-id="' + c.id + '" title="Excluir">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>';
        }

        var authorTag = up.id
            ? '<a class="comment-author comment-author-link" data-profile-id="' + up.id + '" href="javascript:void(0)">' + displayName + '</a>'
            : '<span class="comment-author">' + displayName + '</span>';

        return '<div class="comment-item" data-comment-id="' + c.id + '">' +
            '<div class="comment-avatar-wrap">' + avatarHtml + '</div>' +
            '<div class="comment-body">' +
                '<div class="comment-header">' +
                    authorTag +
                    '<span class="comment-date">' + escapeHtml(dateStr) + '</span>' +
                    deleteBtn +
                '</div>' +
                '<div class="comment-text">' + escapeHtml(c.comment_text) + '</div>' +
            '</div>' +
        '</div>';
    }

    function bindCommentForm(titleId, gameTitle) {
        var form = $('#comment-form');
        if (!form) return;

        var textarea = $('#comment-text');
        var charCount = $('#comment-char-count');
        if (textarea && charCount) {
            textarea.addEventListener('input', function() {
                charCount.textContent = this.value.length + '/1000';
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var text = textarea.value.trim();
            var errorEl = $('#comment-error');
            var submitBtn = $('#comment-submit-btn');

            if (!text) {
                if (errorEl) { errorEl.textContent = 'Escreva algo antes de enviar.'; errorEl.classList.remove('hidden'); }
                return;
            }

            if (errorEl) errorEl.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            NovaAPI.addGameComment(titleId, text, gameTitle, function(err, comment) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar';

                if (err) {
                    if (errorEl) { errorEl.textContent = err.message || 'Erro ao enviar comentário'; errorEl.classList.remove('hidden'); }
                    return;
                }

                textarea.value = '';
                if (charCount) charCount.textContent = '0/1000';
                loadGameComments(titleId, gameTitle, 1);
            });
        });
    }

    function bindCommentActions(titleId, gameTitle) {
        document.querySelectorAll('.comment-delete-btn').forEach(function(btn) {
            btn.onclick = function() {
                var commentId = this.getAttribute('data-comment-id');
                if (!confirm('Excluir este comentário?')) return;
                var item = this.closest('.comment-item');
                if (item) item.style.opacity = '0.5';

                NovaAPI.deleteGameComment(titleId, commentId, function(err) {
                    if (err) {
                        if (item) item.style.opacity = '1';
                        return;
                    }
                    loadGameComments(titleId, gameTitle, 1);
                });
            };
        });
        document.querySelectorAll('.comment-author-link').forEach(function(link) {
            link.onclick = function(e) {
                e.preventDefault();
                var pid = parseInt(this.getAttribute('data-profile-id'));
                if (pid) showUserPublicProfile(pid);
            };
        });
    }

    function openGameScreenshot(url) {
        var viewer = $('#image-viewer');
        var img = $('#viewer-image');
        var dl = $('#viewer-download');
        var filename = 'game_screenshot.jpg';

        NovaAPI.loadAuthImage(url, img);
        dl.href = '#';
        dl.download = filename;
        dl.onclick = function(e) {
            e.preventDefault();
            NovaAPI.downloadAuthFile(url, filename);
        };
        show(viewer);
    }

    function getAchievementCacheKey(titleId) {
        return 'nova_ach_' + titleId.toLowerCase();
    }

    function loadCachedAchievements(titleId) {
        try {
            var data = localStorage.getItem(getAchievementCacheKey(titleId));
            if (data) return JSON.parse(data);
        } catch(e) {}
        return null;
    }

    function saveCachedAchievements(titleId, achList, unlocked) {
        try {
            localStorage.setItem(getAchievementCacheKey(titleId), JSON.stringify({
                achievements: achList,
                unlocked: unlocked,
                timestamp: Date.now()
            }));
        } catch(e) {}
    }

    function loadAchievements(titleId) {
        var section = $('#achievements-section');
        if (!section) return;

        var currentTid = getTitleIdFromState();
        var isRunning = currentTid && currentTid.toLowerCase() === titleId.toLowerCase();

        var cached = loadCachedAchievements(titleId);
        if (cached && cached.achievements && cached.achievements.length > 0 && !isRunning) {
            renderAchievements(section, cached.achievements, cached.unlocked || [], titleId);
            return;
        }

        if (!isRunning && (!cached || !cached.achievements || cached.achievements.length === 0)) {
            section.innerHTML = '<div class="section-title">Achievements</div>' +
                '<div class="card"><p style="color:var(--text-muted);font-size:13px">Inicie o jogo para carregar os achievements. Os dados serão salvos para visualização futura.</p></div>';
            return;
        }

        NovaAPI.getAchievements(titleId, function(err, achievements) {
            NovaAPI.getPlayerAchievements(titleId, function(err2, playerAch) {
                if (!section) return;

                var achList = [];
                if (achievements && achievements.length) achList = achievements;
                else if (achievements && achievements.Achievements) achList = achievements.Achievements;

                var unlocked = [];
                if (playerAch && playerAch.length) unlocked = playerAch;
                else if (playerAch && playerAch.Achievements) unlocked = playerAch.Achievements;

                if (achList.length === 0) {
                    section.innerHTML = '<div class="section-title">Achievements</div>' +
                        '<div class="card"><p style="color:var(--text-muted);font-size:13px">Inicie o jogo para carregar os achievements. Os dados serão salvos para visualização futura.</p></div>';
                    return;
                }

                saveCachedAchievements(titleId, achList, unlocked);
                renderAchievements(section, achList, unlocked, titleId);
            });
        });
    }

    function renderAchievements(section, achList, unlocked, titleId) {
        var totalScore = 0, earnedScore = 0, earnedCount = 0;
        var unlockedIds = {};
        unlocked.forEach(function(u) {
            var uid = u.id != null ? u.id : (u.AchievementId || u.Id);
            if (uid == null) return;
            var isUnlocked = (u.player && u.player.length > 0) ? (u.player[0] !== 0) : true;
            if (isUnlocked) unlockedIds[uid] = true;
        });

        var processedList = [];
        achList.forEach(function(a) {
            var achId = a.id != null ? a.id : (a.AchievementId || a.Id);
            var score = a.cred != null ? a.cred : (a.Gamerscore || a.gamerscore || 0);
            var isUnlocked = !!unlockedIds[achId];
            var isHidden = a.hidden;
            var achName, achDesc;

            if (isHidden && !isUnlocked) {
                achName = 'Secret Achievement';
                achDesc = (a.strings && a.strings.unachieved) ? a.strings.unachieved : 'This is a secret achievement.';
            } else {
                achName = (a.strings && a.strings.caption) ? a.strings.caption : (a.Name || a.name || 'Achievement');
                achDesc = (a.strings && a.strings.description) ? a.strings.description : (a.Description || a.description || '');
            }

            var imgSrc = '';
            if (a.imageid != null && titleId) {
                imgSrc = NovaAPI.getAchievementImageUrl(titleId, a.imageid);
            } else {
                imgSrc = a.TileUrl || a.ImageUrl || '';
            }

            totalScore += score;
            if (isUnlocked) {
                earnedScore += score;
                earnedCount++;
            }

            var achType = a.type != null ? a.type : '';
            var achHidden = !!a.hidden;
            var typeIconMap = {1:'completion',2:'leveling',3:'unlock',4:'event',5:'tournament',6:'checkpoint'};
            var typeIcon = '';
            if (achHidden && !isUnlocked) {
                typeIcon = 'img/achievement.secret.png';
            } else if (achType && typeIconMap[achType]) {
                typeIcon = 'img/achievement.type.' + typeIconMap[achType] + '.png';
            } else if (achType) {
                typeIcon = 'img/achievement.type.other.png';
            }

            processedList.push({
                achId: achId,
                name: achName,
                desc: achDesc,
                score: score,
                imgSrc: imgSrc,
                imageid: a.imageid,
                unlocked: isUnlocked,
                typeIcon: typeIcon
            });
        });

        var pct = achList.length ? Math.round((earnedCount / achList.length) * 100) : 0;
        var circumference = 2 * Math.PI * 52;
        var offset = circumference - (pct / 100) * circumference;

        var harvestBtn = '';
        if (earnedCount > 0 && state.isOnline && isCmsLoggedIn() && state.cmsProfile) {
            harvestBtn = ' <button class="btn btn-sm btn-accent" id="harvest-ach-btn" title="Enviar conquistas desbloqueadas para seu perfil GODSend" style="margin-left:8px;font-size:11px;padding:2px 8px">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Colher</button>';
        }

        var html = '<div class="section-title">Achievements <span class="badge badge-accent">' + earnedCount + '/' + achList.length + '</span>' + harvestBtn + '</div>' +
            '<div class="achievement-progress-center">' +
                '<svg class="progress-ring" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fill" cx="60" cy="60" r="52" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 60 60)"/></svg>' +
                '<div class="progress-text-inline"><div class="progress-value">' + earnedScore + 'G</div><div class="progress-label">of ' + totalScore + 'G</div></div>' +
            '</div>' +
            '<div class="achievement-filter">' +
                '<button class="btn btn-sm ach-filter-btn active" data-ach-filter="all">Todos</button>' +
                '<button class="btn btn-sm ach-filter-btn" data-ach-filter="locked">Faltando (' + (achList.length - earnedCount) + ')</button>' +
                '<button class="btn btn-sm ach-filter-btn" data-ach-filter="unlocked">Desbloqueados (' + earnedCount + ')</button>' +
                '<button class="btn btn-sm ach-overlay-toggle' + (getOverlayPref() ? ' active' : '') + '" id="ach-overlay-toggle" title="Mostrar/ocultar marcações">' +
                    '<svg class="ach-toggle-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' + (getOverlayPref() ? '' : '<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/>') + '</svg>' +
                '</button>' +
            '</div>' +
            '<div class="achievement-list" id="ach-list-container">';

        processedList.forEach(function(item) {
            var achBgAttr = item.imgSrc ? 'data-ach-bg="' + escapeHtml(item.imgSrc) + '"' : '';
            var overlayImg = item.typeIcon ? '<img class="achievement-type-overlay" src="' + item.typeIcon + '" alt="">' : '';
            html += '<div class="achievement-item' + (item.unlocked ? ' achievement-unlocked' : ' achievement-locked') + '" data-ach-status="' + (item.unlocked ? 'unlocked' : 'locked') + '">' +
                '<div class="achievement-icon" ' + achBgAttr + '>' + overlayImg + '</div>' +
                '<div class="achievement-info">' +
                    '<div class="achievement-name">' + escapeHtml(item.name) + '</div>' +
                    '<div class="achievement-desc">' + escapeHtml(item.desc) + '</div>' +
                '</div>' +
                '<div class="achievement-score">' + item.score + 'G</div>' +
            '</div>';
        });

        html += '</div>';
        section.innerHTML = html;

        section.querySelectorAll('.achievement-icon[data-ach-bg]').forEach(function(div) {
            NovaAPI.loadAuthBackgroundImage(div.getAttribute('data-ach-bg'), div);
        });

        var achListContainer = section.querySelector('#ach-list-container');
        if (achListContainer) applyOverlayState(achListContainer);

        var overlayToggle = section.querySelector('#ach-overlay-toggle');
        if (overlayToggle) {
            overlayToggle.addEventListener('click', function() {
                var newVal = !getOverlayPref();
                setOverlayPref(newVal);
                this.classList.toggle('active', newVal);
                var eyeSvg = '<svg class="ach-toggle-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' + (newVal ? '' : '<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/>') + '</svg>';
                this.innerHTML = eyeSvg;
                if (achListContainer) applyOverlayState(achListContainer);
            });
        }

        section.querySelectorAll('.ach-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                section.querySelectorAll('.ach-filter-btn').forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
                var filter = this.getAttribute('data-ach-filter');
                section.querySelectorAll('.achievement-item').forEach(function(item) {
                    if (filter === 'all') {
                        item.style.display = '';
                    } else {
                        item.style.display = item.getAttribute('data-ach-status') === filter ? '' : 'none';
                    }
                });
            });
        });

        var harvestBtnEl = section.querySelector('#harvest-ach-btn');
        if (harvestBtnEl) {
            harvestBtnEl.addEventListener('click', function() {
                var btn = this;
                if (btn.disabled) return;

                var unlockedAchs = processedList.filter(function(item) { return item.unlocked; });
                if (unlockedAchs.length === 0) return;

                var achievementsToSend = unlockedAchs.map(function(item) {
                    return {
                        title_id: titleId,
                        achievement_id: String(item.achId),
                        name: item.name,
                        description: item.desc,
                        gamerscore: item.score,
                        image_url: item.imgSrc || ''
                    };
                });

                btn.disabled = true;
                btn.innerHTML = '<div class="loader-spinner small" style="display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:3px"></div>Enviando...';

                NovaAPI.harvestAchievements(state.cmsProfile.id, achievementsToSend, function(err, result) {
                    if (err) {
                        btn.disabled = false;
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Colher';
                        alert('Erro: ' + err.message);
                        return;
                    }
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><polyline points="20 6 9 17 4 12"/></svg>' +
                        (result.added > 0 ? result.added + ' nova(s)' : 'Já colhidas');
                    btn.style.opacity = '0.7';
                    setTimeout(function() {
                        btn.disabled = false;
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Colher';
                        btn.style.opacity = '';
                    }, 3000);
                    if (result.added > 0 && state.cmsProfile) {
                        state.cmsProfile.achievements_count = result.total;
                        NovaAPI.setCmsProfileData(state.cmsProfile);
                    }
                });
            });
        }
    }

    var roomsTab = 'public';
    var roomsData = null;
    var roomsMyData = null;
    var roomsLoading = false;
    var roomsDetailRoom = null;
    var roomsFriendIds = {};
    var roomsShowCreateForm = false;
    var roomsGameFilter = '';
    var roomsSearchQuery = '';
    var roomChatPollInterval = null;
    var roomChatLastId = 0;

    function getUserTimezone() {
        try {
            var saved = localStorage.getItem('nova_timezone');
            if (saved) return saved;
        } catch(e) {}
        return 'America/Sao_Paulo';
    }

    function setUserTimezone(tz) {
        try { localStorage.setItem('nova_timezone', tz); } catch(e) {}
    }

    var _intlTzSupported = null;
    function supportsIntlTimeZone() {
        if (_intlTzSupported !== null) return _intlTzSupported;
        try {
            new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            _intlTzSupported = true;
        } catch(e) {
            _intlTzSupported = false;
        }
        return _intlTzSupported;
    }

    var tzOffsetMap = {
        'America/Noronha': -120,
        'America/Sao_Paulo': -180,
        'America/Manaus': -240,
        'America/Rio_Branco': -300,
        'America/New_York': -300,
        'America/Chicago': -360,
        'America/Denver': -420,
        'America/Los_Angeles': -480,
        'America/Mexico_City': -360,
        'America/Argentina/Buenos_Aires': -180,
        'Europe/London': 0,
        'Europe/Paris': 60,
        'Europe/Berlin': 60,
        'Europe/Moscow': 180,
        'Asia/Tokyo': 540,
        'Australia/Sydney': 600
    };

    function applyTzOffset(d, tz) {
        var offsetMin = tzOffsetMap[tz];
        if (offsetMin === undefined) offsetMin = -180;
        var utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
        return new Date(utcMs + offsetMin * 60000);
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function formatRoomTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var tz = getUserTimezone();
        if (supportsIntlTimeZone()) {
            try {
                return d.toLocaleString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }
        var local = applyTzOffset(d, tz);
        return pad2(local.getDate()) + '/' + pad2(local.getMonth() + 1) + '/' + String(local.getFullYear()).slice(2) + ' ' + pad2(local.getHours()) + ':' + pad2(local.getMinutes());
    }

    function formatRoomCountdown(dateStr) {
        if (!dateStr) return '';
        var now = Date.now();
        var target = new Date(dateStr).getTime();
        var diff = target - now;
        if (diff <= 0) return 'Agora';
        var hours = Math.floor(diff / 3600000);
        var mins = Math.floor((diff % 3600000) / 60000);
        if (hours > 24) {
            var days = Math.floor(hours / 24);
            return 'em ' + days + 'd ' + (hours % 24) + 'h';
        }
        if (hours > 0) return 'em ' + hours + 'h ' + mins + 'm';
        return 'em ' + mins + 'm';
    }

    function getRoomStatusBadge(status) {
        var map = {
            'scheduled': '<span class="badge badge-accent">Agendada</span>',
            'active': '<span class="badge badge-success">Ativa</span>',
            'finished': '<span class="badge" style="background:var(--bg-secondary);color:var(--text-muted)">Finalizada</span>',
            'cancelled': '<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger)">Cancelada</span>'
        };
        return map[status] || '';
    }

    function getCmsProfileId() {
        var p = NovaAPI.getCmsProfileData();
        return p ? p.id : null;
    }

    function renderRoomCard(room) {
        var participants = room.participants || [];
        var activeCount = participants.filter(function(p) { return p.status === 'joined' || p.status === 'confirmed'; }).length;
        var creatorName = room.creator ? (room.creator.display_name || room.creator.username) : 'Unknown';
        var gameTitle = room.game_title || (room.game ? room.game.title : '');

        var avatarsHtml = '<div class="room-avatars">';
        var shown = 0;
        participants.forEach(function(p) {
            if ((p.status === 'joined' || p.status === 'confirmed') && shown < 4) {
                var up = p.userProfile || p.user_profile || {};
                var initial = ((up.display_name || up.username || '?')[0] || '?').toUpperCase();
                if (up.avatar_url) {
                    avatarsHtml += '<img class="room-avatar-thumb" src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\'">';
                } else {
                    avatarsHtml += '<div class="room-avatar-thumb room-avatar-fallback">' + escapeHtml(initial) + '</div>';
                }
                shown++;
            }
        });
        if (activeCount > 4) {
            avatarsHtml += '<div class="room-avatar-thumb room-avatar-fallback">+' + (activeCount - 4) + '</div>';
        }
        avatarsHtml += '</div>';

        var timeInfo = '';
        if (room.scheduled_at) {
            timeInfo = '<div class="room-card-time">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px;margin-right:2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                formatRoomTime(room.scheduled_at, room.timezone) +
                '<span class="room-countdown">' + formatRoomCountdown(room.scheduled_at) + '</span>' +
            '</div>';
        }

        var serverBadge = room.server_type === 'stealth_server'
            ? '<span class="room-server-badge stealth">Stealth</span>'
            : '<span class="room-server-badge syslink">System Link</span>';

        return '<div class="room-card card" data-room-id="' + room.id + '">' +
            '<div class="room-card-header">' +
                '<div class="room-card-info">' +
                    '<div class="room-card-title">' + escapeHtml(room.title) + '</div>' +
                    (gameTitle ? '<div class="room-card-game">' + escapeHtml(gameTitle) + '</div>' : '') +
                '</div>' +
                '<div class="room-card-badges">' + serverBadge + getRoomStatusBadge(room.status) + '</div>' +
            '</div>' +
            '<div class="room-card-meta">' +
                '<div class="room-card-host"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px;margin-right:2px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' + escapeHtml(creatorName) + '</div>' +
                '<div class="room-card-players">' + activeCount + '/' + (room.max_players || 4) + ' jogadores</div>' +
            '</div>' +
            timeInfo +
            avatarsHtml +
        '</div>';
    }

    function renderProfile() {
        var el = $('#page-profile');
        if (!el) return;

        var loggedIn = isCmsLoggedIn();
        var cp = state.cmsProfile;

        var headerHtml = '<div class="page-header"><div><div class="page-title">Meu Perfil</div></div></div>';

        if (!state.isOnline) {
            el.innerHTML = headerHtml +
                '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/></svg>' +
                '<p>Perfil indisponível offline</p></div>';
            return;
        }

        if (!loggedIn) {
            el.innerHTML = headerHtml +
                '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                    '<p>Faça login na sua conta GODSend na tela Home para acessar o perfil.</p>' +
                '</div>';
            return;
        }

        var avatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
        var avatarHtml = cp.avatar_url
            ? '<img class="profile-page-avatar" src="' + escapeHtml(cp.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="profile-page-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="profile-page-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var levelNum = cp.level || '';
        var levelOverlay = levelNum ? '<div class="profile-level-overlay">' + escapeHtml(String(levelNum)) + '</div>' : '';
        var levelPill = cp.level_name ? '<div class="profile-level-pill">' + escapeHtml(cp.level_name) + '</div>' : '';
        var bioHtml = cp.bio ? '<div class="profile-bio">' + escapeHtml(cp.bio) + '</div>' : '';

        var pStats = state.cmsStats || cp;
        var friendsCount = 0;
        if (state.cmsFriendsList) friendsCount = state.cmsFriendsList.length;
        var downloadsCount = pStats.total_downloads || cp.total_downloads || 0;

        var html = headerHtml;

        html += '<div class="card profile-page-card">' +
            '<div class="profile-page-header">' +
                '<div class="profile-page-avatar-wrap">' + avatarHtml + levelOverlay + '</div>' +
                '<div class="profile-page-info">' +
                    '<div class="profile-page-name">' + escapeHtml(cp.display_name || cp.username) + (cp.level_name ? ' <span class="profile-level-inline">(' + escapeHtml(cp.level_name) + ')</span>' : '') + '</div>' +
                    bioHtml +
                    '<div class="profile-stats-row">' +
                        '<span><strong id="profile-friends-count">' + friendsCount + '</strong> amigos</span>' +
                        '<span><strong>' + downloadsCount + '</strong> downloads</span>' +
                    '</div>' +
                    '<div class="profile-actions-row">' +
                        (cp.friend_code ? '<button class="profile-action-icon-btn" id="copy-friend-code-btn" title="Copiar código de amigo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' : '') +
                        '<button class="profile-action-icon-btn profile-info-btn" id="profile-info-btn" title="Informações do perfil Xbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="profile-tabs">' +
                '<button class="profile-tab active" data-profile-tab="overview">Visão Geral</button>' +
                '<button class="profile-tab" data-profile-tab="stats">Estatísticas</button>' +
                '<button class="profile-tab" data-profile-tab="friends">Amigos</button>' +
            '</div>' +
        '</div>';

        html += '<div class="profile-tab-content active" id="profile-tab-overview">';
        html += '<div class="profile-fav-section-title">Jogos Favoritos</div>' +
            '<div id="profile-favorites-list"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '<div class="section-title">Conquistas Xbox</div>' +
            '<div id="profile-xbox-achievements"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '</div>';

        html += '<div class="profile-tab-content" id="profile-tab-stats">';
        html += '<div class="section-title">Minhas Partidas</div>' +
            '<div class="partidas-filter-bar" id="partidas-filter-bar">' +
                '<button class="partidas-filter-btn active" data-partidas-filter="all">Todos</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="day">Dia</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="week">Semana</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="month">Mês</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="year">Ano</button>' +
            '</div>' +
            '<div id="partidas-summary" class="partidas-summary"></div>' +
            '<div id="profile-gamestats-list"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '</div>';

        html += '<div class="profile-tab-content" id="profile-tab-friends">';
        html += '<div class="section-title">Adicionar Amigo</div>' +
            '<div class="card" style="padding:16px">' +
                '<div class="add-friend-form">' +
                    '<input type="text" id="friend-code-input" class="friend-code-input" placeholder="Código de amigo (7 dígitos)" maxlength="7" style="text-transform:uppercase">' +
                    '<button class="btn btn-primary btn-sm" id="friend-code-search-btn">Buscar</button>' +
                '</div>' +
                '<div id="friend-code-result"></div>' +
            '</div>';
        html += '<div class="section-title">Amigos</div>' +
            '<div id="profile-friends-list"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '<div class="section-title">Pedidos Pendentes</div>' +
            '<div id="profile-pending-requests"></div>';
        html += '</div>';

        el.innerHTML = html;

        el.querySelectorAll('.profile-tab').forEach(function(tabBtn) {
            tabBtn.addEventListener('click', function() {
                el.querySelectorAll('.profile-tab').forEach(function(t) { t.classList.remove('active'); });
                el.querySelectorAll('.profile-tab-content').forEach(function(c) { c.classList.remove('active'); });
                tabBtn.classList.add('active');
                var tabId = 'profile-tab-' + tabBtn.getAttribute('data-profile-tab');
                var tabContent = el.querySelector('#' + tabId);
                if (tabContent) tabContent.classList.add('active');
            });
        });

        var copyBtn = el.querySelector('#copy-friend-code-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var code = cp.friend_code;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(function() {
                        copyBtn.title = 'Copiado!';
                        setTimeout(function() { copyBtn.title = 'Copiar código de amigo'; }, 2000);
                    });
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = code;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    copyBtn.title = 'Copiado!';
                    setTimeout(function() { copyBtn.title = 'Copiar código de amigo'; }, 2000);
                }
            });
        }

        var infoBtn = el.querySelector('#profile-info-btn');
        if (infoBtn) {
            infoBtn.addEventListener('click', function() {
                var popupContent = '';
                if (cp.friend_code) {
                    popupContent += '<div class="profile-info-popup-section">' +
                        '<div class="friend-code-label">Seu Código de Amigo</div>' +
                        '<div class="friend-code-value">' + escapeHtml(cp.friend_code) + '</div>' +
                        '<div class="friend-code-hint">Compartilhe este código para seus amigos te adicionarem</div>' +
                        '<button class="btn btn-primary btn-sm" id="popup-copy-code-btn" style="margin-top:12px">Copiar Código</button>' +
                    '</div>';
                } else {
                    popupContent += '<div class="profile-info-popup-section">' +
                        '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Selecione seu perfil Xbox principal para gerar seu código de amigo (últimos 7 dígitos do XUID).</p>' +
                        '<div id="popup-xbox-selector"></div>' +
                    '</div>';
                }
                popupContent += '<div class="profile-info-popup-section">' +
                    '<div class="friend-code-label">Compartilhar Perfil</div>' +
                    '<div class="friend-code-hint">Compartilhe seu código de amigo com outros jogadores para que eles possam te encontrar e adicionar.</div>' +
                '</div>';

                var overlay = document.createElement('div');
                overlay.className = 'profile-info-popup-overlay';
                overlay.innerHTML = '<div class="profile-info-popup">' +
                    '<div class="profile-info-popup-header">' +
                        '<div class="profile-info-popup-title">Perfil Xbox</div>' +
                        '<button class="profile-info-popup-close" id="profile-info-popup-close">&times;</button>' +
                    '</div>' +
                    '<div class="profile-info-popup-body">' + popupContent + '</div>' +
                '</div>';
                document.body.appendChild(overlay);

                overlay.querySelector('#profile-info-popup-close').addEventListener('click', function() {
                    overlay.remove();
                });
                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) overlay.remove();
                });

                var popupCopyBtn = overlay.querySelector('#popup-copy-code-btn');
                if (popupCopyBtn && cp.friend_code) {
                    popupCopyBtn.addEventListener('click', function() {
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(cp.friend_code).then(function() {
                                popupCopyBtn.textContent = 'Copiado!';
                                setTimeout(function() { popupCopyBtn.textContent = 'Copiar Código'; }, 2000);
                            });
                        } else {
                            var ta = document.createElement('textarea');
                            ta.value = cp.friend_code;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                            popupCopyBtn.textContent = 'Copiado!';
                            setTimeout(function() { popupCopyBtn.textContent = 'Copiar Código'; }, 2000);
                        }
                    });
                }

                if (!cp.friend_code) {
                    var selectorContainer = overlay.querySelector('#popup-xbox-selector');
                    if (selectorContainer) {
                        loadXboxProfileSelectorInto(selectorContainer);
                    }
                }
            });
        }

        bindFriendCodeSearch();
        loadFriendsList();
        loadProfileFavorites();
        loadProfileXboxAchievements();
        loadProfileGameStats('all');
        bindPartidasFilter();
    }

    function loadProfileXboxAchievements() {
        var container = $('#profile-xbox-achievements');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Faça login para ver suas conquistas</div>';
            return;
        }
        NovaAPI.getUserAchievements(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar conquistas</div>';
                return;
            }
            var allAchs = data.achievements || [];
            var xboxAchs = allAchs.filter(function(a) {
                return a.achievement_key && a.achievement_key.indexOf('xbox_') === 0;
            });
            if (xboxAchs.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhuma conquista Xbox colhida ainda. Use o botão "Colher" na página de detalhes de um jogo.</div>';
                return;
            }
            var groups = {};
            xboxAchs.forEach(function(a) {
                var parts = (a.achievement_key || '').split('_');
                var gameTid = parts.length >= 3 ? parts[1] : 'unknown';
                gameTid = gameTid.replace(/^0x/i, '').toUpperCase();
                if (!groups[gameTid]) groups[gameTid] = [];
                groups[gameTid].push(a);
            });
            var achHtml = '';
            var gameKeys = Object.keys(groups);
            var resolved = 0;
            var groupHtmls = {};
            function renderGroups() {
                achHtml = '';
                gameKeys.forEach(function(tid) {
                    var items = groups[tid];
                    var gameName = (groupHtmls[tid] && groupHtmls[tid].name) || ('Title ' + tid);
                    achHtml += '<div class="profile-xbox-game-group">' +
                        '<div class="profile-xbox-game-header">' +
                            '<span class="profile-xbox-game-name">' + escapeHtml(gameName) + '</span>' +
                            '<span class="profile-xbox-game-count">' + items.length + ' conquista(s)</span>' +
                        '</div>' +
                        '<div class="profile-xbox-ach-list">';
                    items.forEach(function(a) {
                        var iconHtml = '';
                        var iconSrc = a.icon || '';
                        if (iconSrc && iconSrc.indexOf('/') === 0) {
                            var cmsBase = NovaAPI.getCmsUrl ? NovaAPI.getCmsUrl() : '';
                            if (cmsBase) iconSrc = cmsBase + iconSrc;
                        }
                        if (iconSrc && iconSrc.length > 0) {
                            iconHtml = '<img class="profile-xbox-ach-icon" src="' + escapeHtml(iconSrc) + '" alt="" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                                '<div class="profile-xbox-ach-icon-fallback" style="display:none">🏆</div>';
                        } else {
                            iconHtml = '<div class="profile-xbox-ach-icon-fallback">🏆</div>';
                        }
                        var dateStr = '';
                        if (a.unlocked_at) {
                            try { dateStr = new Date(a.unlocked_at).toLocaleDateString('pt-BR'); } catch(e) {}
                        }
                        achHtml += '<div class="profile-xbox-ach-item">' +
                            '<div class="profile-xbox-ach-icon-wrap">' + iconHtml + '</div>' +
                            '<div class="profile-xbox-ach-info">' +
                                '<div class="profile-xbox-ach-name">' + escapeHtml(a.achievement_name || '') + '</div>' +
                                '<div class="profile-xbox-ach-desc">' + escapeHtml(a.achievement_description || '') +
                                    (dateStr ? ' <span class="profile-xbox-ach-date">' + dateStr + '</span>' : '') +
                                '</div>' +
                            '</div>' +
                        '</div>';
                    });
                    achHtml += '</div></div>';
                });
                container.innerHTML = achHtml;
            }
            gameKeys.forEach(function(tid) {
                NovaAPI.cmsLookupGameByTitleId(tid, function(err, data) {
                    if (!err && data && data.game) {
                        groupHtmls[tid] = { name: data.game.title || ('Title ' + tid) };
                    } else {
                        groupHtmls[tid] = { name: 'Title ID: ' + tid };
                    }
                    resolved++;
                    if (resolved === gameKeys.length) {
                        renderGroups();
                    }
                });
            });
            if (gameKeys.length === 0) renderGroups();
        });
    }

    function loadProfileFavorites() {
        var container = $('#profile-favorites-list');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Faça login para ver seus favoritos</div>';
            return;
        }
        NovaAPI.getUserFavorites(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar favoritos</div>';
                return;
            }
            var favs = data.favorites || [];
            if (favs.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum jogo favoritado ainda</div>';
                return;
            }
            var html = '<div class="profile-favorites-scroll">';
            favs.forEach(function(f) {
                var g = f.game;
                if (!g) return;
                var coverUrl = g.cover_image || '';
                var playtimeStr = '';
                if (f.playtime_minutes && f.playtime_minutes > 0) {
                    playtimeStr = formatPlaytime(f.playtime_minutes);
                } else if (g.playtime_minutes && g.playtime_minutes > 0) {
                    playtimeStr = formatPlaytime(g.playtime_minutes);
                }
                html += '<div class="profile-fav-item" data-fav-title-id="' + escapeHtml(g.title_id || '') + '">' +
                    '<div class="profile-fav-cover">' +
                        (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                        (playtimeStr ? '<div class="profile-fav-playtime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + escapeHtml(playtimeStr) + '</div>' : '') +
                    '</div>' +
                    '<div class="profile-fav-title">' + escapeHtml(g.title || 'Unknown') + '</div>' +
                '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
            container.querySelectorAll('.profile-fav-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    var tid = item.getAttribute('data-fav-title-id');
                    if (tid) {
                        navigateTo('games');
                        setTimeout(function() { showGameDetail(tid); }, 100);
                    }
                });
            });
        });
    }

    function bindPartidasFilter() {
        var bar = $('#partidas-filter-bar');
        if (!bar) return;
        bar.querySelectorAll('.partidas-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                bar.querySelectorAll('.partidas-filter-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                loadProfileGameStats(btn.getAttribute('data-partidas-filter'));
            });
        });
    }

    function loadProfileGameStats(filter) {
        var container = $('#profile-gamestats-list');
        var summaryEl = $('#partidas-summary');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Faça login para ver suas partidas</div>';
            return;
        }
        container.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';
        NovaAPI.getUserGameStats(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar partidas</div>';
                if (summaryEl) summaryEl.innerHTML = '';
                return;
            }
            var allStats = data.game_stats || [];
            if (allStats.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhuma partida registrada ainda</div>';
                if (summaryEl) summaryEl.innerHTML = '';
                return;
            }

            var now = new Date();
            var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            var startOfYear = new Date(now.getFullYear(), 0, 1);

            var totalDay = 0, totalWeek = 0, totalMonth = 0, totalYear = 0;
            allStats.forEach(function(s) {
                if (!s.last_played) return;
                var lp = new Date(s.last_played);
                var pt = s.playtime_minutes || 0;
                if (lp >= startOfDay) totalDay += pt;
                if (lp >= startOfWeek) totalWeek += pt;
                if (lp >= startOfMonth) totalMonth += pt;
                if (lp >= startOfYear) totalYear += pt;
            });

            if (summaryEl) {
                summaryEl.innerHTML =
                    '<div class="partidas-summary-grid">' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalDay) + '</div><div class="partidas-summary-label">Hoje</div></div>' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalWeek) + '</div><div class="partidas-summary-label">Semana</div></div>' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalMonth) + '</div><div class="partidas-summary-label">Mês</div></div>' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalYear) + '</div><div class="partidas-summary-label">Ano</div></div>' +
                    '</div>';
            }

            var filtered = allStats;
            if (filter === 'day') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfDay; });
            } else if (filter === 'week') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfWeek; });
            } else if (filter === 'month') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfMonth; });
            } else if (filter === 'year') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfYear; });
            }

            if (filtered.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhuma partida neste período</div>';
                return;
            }

            var html = '<div class="partidas-list">';
            filtered.forEach(function(s) {
                var game = s.game || {};
                var coverUrl = game.cover_image || '';
                var title = game.title || 'Unknown';
                var playtime = formatPlaytime(s.playtime_minutes || 0);
                var lastPlayed = '';
                if (s.last_played) {
                    try { lastPlayed = new Date(s.last_played).toLocaleDateString('pt-BR'); } catch(e) {}
                }
                html += '<div class="partidas-item card">' +
                    '<div class="partidas-cover">' +
                        (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                    '</div>' +
                    '<div class="partidas-info">' +
                        '<div class="partidas-title">' + escapeHtml(title) + '</div>' +
                        '<div class="partidas-meta">' +
                            '<span class="partidas-playtime">' + escapeHtml(playtime) + '</span>' +
                            (s.times_launched ? '<span class="partidas-launches">' + s.times_launched + 'x</span>' : '') +
                            (lastPlayed ? '<span class="partidas-date">' + lastPlayed + '</span>' : '') +
                        '</div>' +
                        (s.completed ? '<span class="badge badge-success" style="margin-top:4px">Completo</span>' : '') +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        });
    }

    function showUserPublicProfile(profileId) {
        var el = $('#page-games');
        if (!el) {
            navigateTo('games');
            el = $('#page-games');
        }
        if (!el) return;

        el.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';

        NovaAPI.getUserPublicProfile(profileId, function(err, profile) {
            if (err || !profile) {
                el.innerHTML = '<button class="back-btn" id="public-profile-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>' +
                    '<div class="empty-state"><p>Não foi possível carregar o perfil.</p></div>';
                var bb = el.querySelector('#public-profile-back');
                if (bb) bb.addEventListener('click', function() { renderGames(); });
                return;
            }

            var avatarInitial = (profile.display_name || profile.username || '?')[0].toUpperCase();
            var avatarHtml = profile.avatar_url
                ? '<img class="profile-page-avatar" src="' + escapeHtml(profile.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                  '<div class="profile-page-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
                : '<div class="profile-page-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

            var pubLevelNum = profile.level || '';
            var pubLevelOverlay = pubLevelNum ? '<div class="profile-level-overlay">' + escapeHtml(String(pubLevelNum)) + '</div>' : '';
            var pubLevelPill = profile.level_name ? '<div class="profile-level-pill">' + escapeHtml(profile.level_name) + '</div>' : '';
            var pubBioHtml = profile.bio ? '<div class="profile-bio">' + escapeHtml(profile.bio) + '</div>' : '';

            var html = '<button class="back-btn" id="public-profile-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

            html += '<div class="card profile-page-card">' +
                '<div class="profile-page-header">' +
                    '<div class="profile-page-avatar-wrap">' + avatarHtml + pubLevelOverlay + '</div>' +
                    '<div class="profile-page-info">' +
                        '<div class="profile-page-name">' + escapeHtml(profile.display_name || profile.username) + (profile.level_name ? ' <span class="profile-level-inline">(' + escapeHtml(profile.level_name) + ')</span>' : '') + '</div>' +
                        pubBioHtml +
                        '<div class="profile-stats-row">' +
                            '<span><strong>' + (profile.total_downloads || 0) + '</strong> downloads</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

            html += '<div class="section-title">Conquistas</div>' +
                '<div id="public-profile-achievements"><div class="fm-loading"><div class="spinner"></div></div></div>';

            html += '<div class="profile-fav-section-title">Jogos Favoritos</div>' +
                '<div id="public-profile-favorites"><div class="fm-loading"><div class="spinner"></div></div></div>';

            el.innerHTML = html;

            var backBtn = el.querySelector('#public-profile-back');
            if (backBtn) {
                backBtn.addEventListener('click', function() {
                    if (state.selectedGame) {
                        showGameDetail(getGameId(state.selectedGame));
                    } else {
                        renderGames();
                    }
                });
            }

            NovaAPI.getUserPublicStats(profileId, function(err2, statsData) {
                var achContainer = el.querySelector('#public-profile-achievements');
                if (!achContainer) return;
                if (err2 || !statsData) {
                    achContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar</div>';
                    return;
                }
                var achs = statsData.recent_achievements || [];
                if (achs.length === 0) {
                    achContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhuma conquista ainda</div>';
                    return;
                }
                var achHtml = '<div class="public-achievements-list">';
                achs.forEach(function(a) {
                    achHtml += '<div class="public-ach-item">' +
                        '<span class="cms-ach-icon-emoji">' + (a.icon || '🏆') + '</span>' +
                        '<div class="public-ach-info">' +
                            '<div class="public-ach-name">' + escapeHtml(a.name || a.achievement_key || '') + '</div>' +
                            '<div class="public-ach-desc">' + escapeHtml(a.description || '') + '</div>' +
                        '</div>' +
                    '</div>';
                });
                achHtml += '</div>';
                achContainer.innerHTML = achHtml;
            });

            NovaAPI.getUserFavorites(profileId, function(err3, favData) {
                var favContainer = el.querySelector('#public-profile-favorites');
                if (!favContainer) return;
                if (err3 || !favData) {
                    favContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar</div>';
                    return;
                }
                var favs = favData.favorites || [];
                if (favs.length === 0) {
                    favContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum jogo favoritado</div>';
                    return;
                }
                var favHtml = '<div class="profile-favorites-scroll">';
                favs.forEach(function(f) {
                    var g = f.game;
                    if (!g) return;
                    var coverUrl = g.cover_image || '';
                    var playtimeStr = '';
                    if (f.playtime_minutes && f.playtime_minutes > 0) {
                        playtimeStr = formatPlaytime(f.playtime_minutes);
                    } else if (g.playtime_minutes && g.playtime_minutes > 0) {
                        playtimeStr = formatPlaytime(g.playtime_minutes);
                    }
                    favHtml += '<div class="profile-fav-item" data-fav-title-id="' + escapeHtml(g.title_id || '') + '">' +
                        '<div class="profile-fav-cover">' +
                            (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                            (playtimeStr ? '<div class="profile-fav-playtime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + escapeHtml(playtimeStr) + '</div>' : '') +
                        '</div>' +
                        '<div class="profile-fav-title">' + escapeHtml(g.title || 'Unknown') + '</div>' +
                    '</div>';
                });
                favHtml += '</div>';
                favContainer.innerHTML = favHtml;
                favContainer.querySelectorAll('.profile-fav-item').forEach(function(item) {
                    item.addEventListener('click', function() {
                        var tid = item.getAttribute('data-fav-title-id');
                        if (tid) {
                            state.selectedGame = null;
                            showGameDetail(tid);
                        }
                    });
                });
            });
        });
    }

    function loadXboxProfileSelectorInto(container) {
        if (!container) return;
        container.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';

        NovaAPI.getProfiles(function(err, data) {
            if (!container) return;
            var profiles = [];
            if (!err && data) {
                if (Array.isArray(data)) profiles = data;
                else if (Array.isArray(data.profiles)) profiles = data.profiles;
                else if (data.gamertag || data.Gamertag) profiles = [data];
            }

            profiles.forEach(function(p, idx) {
                if (p && p.index == null) p.index = idx;
            });

            var activeProfiles = profiles.filter(function(p) {
                return p && (p.gamertag || p.Gamertag) && (p.xuid || p.Xuid);
            });

            if (activeProfiles.length === 0) {
                container.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Nenhum perfil Xbox encontrado. Faça login no Xbox 360 primeiro.</p>';
                return;
            }

            var html = '<div class="xbox-profile-selector">';
            activeProfiles.forEach(function(p) {
                var gt = p.gamertag || p.Gamertag || '---';
                var xuid = p.xuid || p.Xuid || '';
                var last7 = xuid.replace(/^0x/i, '').toUpperCase().slice(-7);
                html += '<button class="xbox-profile-option" data-xuid="' + escapeHtml(xuid) + '" data-gt="' + escapeHtml(gt) + '">' +
                    '<div class="xbox-profile-option-name">' + escapeHtml(gt) + '</div>' +
                    '<div class="xbox-profile-option-xuid">XUID: ' + escapeHtml(xuid) + '</div>' +
                    '<div class="xbox-profile-option-code">Código: ' + escapeHtml(last7) + '</div>' +
                '</button>';
            });
            html += '</div>';
            container.innerHTML = html;

            container.querySelectorAll('.xbox-profile-option').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var xuid = this.getAttribute('data-xuid');
                    var gt = this.getAttribute('data-gt');
                    btn.disabled = true;
                    btn.textContent = 'Salvando...';
                    NovaAPI.setPrimaryXuid(xuid, gt, function(err, resp) {
                        if (err) {
                            btn.textContent = 'Erro: ' + err.message;
                            btn.disabled = false;
                            return;
                        }
                        if (state.cmsProfile) {
                            state.cmsProfile.friend_code = resp.friend_code;
                            state.cmsProfile.primary_xuid = resp.primary_xuid;
                            NovaAPI.setCmsProfileData(state.cmsProfile);
                        }
                        var popupOverlay = document.querySelector('.profile-info-popup-overlay');
                        if (popupOverlay) popupOverlay.remove();
                        renderProfile();
                    });
                });
            });
        });
    }

    function bindFriendCodeSearch() {
        var btn = $('#friend-code-search-btn');
        var input = $('#friend-code-input');
        if (!btn || !input) return;

        btn.addEventListener('click', function() {
            var code = input.value.trim().toUpperCase();
            if (code.length !== 7) {
                var result = $('#friend-code-result');
                if (result) result.innerHTML = '<p class="friend-search-error">O código deve ter 7 caracteres</p>';
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Buscando...';
            NovaAPI.lookupByFriendCode(code, function(err, profile) {
                btn.disabled = false;
                btn.textContent = 'Buscar';
                var result = $('#friend-code-result');
                if (!result) return;
                if (err) {
                    result.innerHTML = '<p class="friend-search-error">' + escapeHtml(err.message) + '</p>';
                    return;
                }
                var myId = getCmsProfileId();
                if (profile.id === myId) {
                    result.innerHTML = '<p class="friend-search-error">Este é o seu próprio código</p>';
                    return;
                }
                var pName = profile.display_name || profile.username || 'Unknown';
                result.innerHTML = '<div class="friend-search-result">' +
                    '<div class="friend-search-name">' + escapeHtml(pName) +
                        (profile.level_name ? ' <span class="cms-level-badge" style="font-size:9px">' + escapeHtml(profile.level_name) + '</span>' : '') +
                    '</div>' +
                    '<button class="btn btn-primary btn-sm" id="send-friend-req-btn" data-target-id="' + profile.id + '">Adicionar</button>' +
                '</div>';
                var sendBtn = result.querySelector('#send-friend-req-btn');
                if (sendBtn) {
                    sendBtn.addEventListener('click', function() {
                        var targetId = parseInt(this.getAttribute('data-target-id'));
                        this.disabled = true;
                        this.textContent = 'Enviando...';
                        var btnRef = this;
                        NovaAPI.sendFriendRequest(targetId, function(err2) {
                            if (err2) {
                                btnRef.textContent = err2.message;
                                btnRef.style.background = 'var(--danger)';
                            } else {
                                btnRef.textContent = 'Enviado!';
                                btnRef.style.background = 'var(--success)';
                            }
                        });
                    });
                }
            });
        });
    }

    function loadFriendsList() {
        var profileId = getCmsProfileId();
        if (!profileId) return;
        var container = $('#profile-friends-list');
        var pendingContainer = $('#profile-pending-requests');

        NovaAPI.getFriendsList(profileId, function(err, data) {
            if (err || !data) {
                if (container) container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px">Não foi possível carregar amigos</p>';
                return;
            }

            var friends = data.friends || [];
            var pending = data.pending_requests || [];
            state.cmsFriendsList = friends;

            var friendsCountEl = document.querySelector('#profile-friends-count');
            if (friendsCountEl) friendsCountEl.textContent = friends.length;

            if (container) {
                if (friends.length === 0) {
                    container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum amigo adicionado ainda</div>';
                } else {
                    var html = '<div class="friends-list">';
                    friends.forEach(function(f) {
                        var fName = f.display_name || f.username || 'Unknown';
                        var initial = (fName[0] || '?').toUpperCase();
                        html += '<div class="friend-item">' +
                            '<div class="friend-avatar">';
                        if (f.avatar_url) {
                            html += '<img src="' + escapeHtml(f.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                                '<div class="friend-avatar-fallback" style="display:none">' + escapeHtml(initial) + '</div>';
                        } else {
                            html += '<div class="friend-avatar-fallback">' + escapeHtml(initial) + '</div>';
                        }
                        html += '</div>' +
                            '<div class="friend-info">' +
                                '<div class="friend-name">' + escapeHtml(fName) + '</div>' +
                                (f.level_name ? '<span class="cms-level-badge" style="font-size:9px">' + escapeHtml(f.level_name) + '</span>' : '') +
                            '</div>' +
                            '<button class="btn btn-sm friend-remove-btn" data-fid="' + f.friendship_id + '" title="Remover">' +
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                            '</button>' +
                        '</div>';
                    });
                    html += '</div>';
                    container.innerHTML = html;

                    container.querySelectorAll('.friend-remove-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fid = parseInt(this.getAttribute('data-fid'));
                            if (!confirm('Remover este amigo?')) return;
                            btn.disabled = true;
                            NovaAPI.removeFriend(fid, function(err2) {
                                if (!err2) loadFriendsList();
                                else { btn.disabled = false; }
                            });
                        });
                    });
                }
            }

            if (pendingContainer) {
                if (pending.length === 0) {
                    pendingContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum pedido pendente</div>';
                } else {
                    var pHtml = '<div class="friends-list">';
                    pending.forEach(function(req) {
                        var reqProfile = req.requester || {};
                        var rName = reqProfile.display_name || reqProfile.username || 'Unknown';
                        var rInitial = (rName[0] || '?').toUpperCase();
                        pHtml += '<div class="friend-item">' +
                            '<div class="friend-avatar">';
                        if (reqProfile.avatar_url) {
                            pHtml += '<img src="' + escapeHtml(reqProfile.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                                '<div class="friend-avatar-fallback" style="display:none">' + escapeHtml(rInitial) + '</div>';
                        } else {
                            pHtml += '<div class="friend-avatar-fallback">' + escapeHtml(rInitial) + '</div>';
                        }
                        pHtml += '</div>' +
                            '<div class="friend-info">' +
                                '<div class="friend-name">' + escapeHtml(rName) + '</div>' +
                            '</div>' +
                            '<div class="friend-request-actions">' +
                                '<button class="btn btn-sm btn-primary friend-accept-btn" data-fid="' + req.id + '">Aceitar</button>' +
                                '<button class="btn btn-sm friend-reject-btn" data-fid="' + req.id + '">Recusar</button>' +
                            '</div>' +
                        '</div>';
                    });
                    pHtml += '</div>';
                    pendingContainer.innerHTML = pHtml;

                    pendingContainer.querySelectorAll('.friend-accept-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fid = parseInt(this.getAttribute('data-fid'));
                            btn.disabled = true;
                            btn.textContent = '...';
                            NovaAPI.respondFriendRequest(fid, 'accepted', function(err2) {
                                if (!err2) loadFriendsList();
                            });
                        });
                    });
                    pendingContainer.querySelectorAll('.friend-reject-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fid = parseInt(this.getAttribute('data-fid'));
                            btn.disabled = true;
                            btn.textContent = '...';
                            NovaAPI.respondFriendRequest(fid, 'rejected', function(err2) {
                                if (!err2) loadFriendsList();
                            });
                        });
                    });
                }
            }
        });
    }

    function renderRooms() {
        var el = $('#page-rooms');
        if (!el) return;

        if (!state.isOnline) {
            el.innerHTML = '<div class="page-header"><div><div class="page-title">Game Rooms</div></div></div>' +
                '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/></svg>' +
                '<p>Salas indisponíveis offline</p><p style="font-size:12px;margin-top:4px">Conecte-se à internet para acessar as salas</p></div>';
            return;
        }

        if (roomsDetailRoom) {
            renderRoomDetail(el);
            return;
        }

        if (roomsShowCreateForm) {
            renderRoomCreateForm(el);
            return;
        }

        var headerHtml = '<div class="page-header"><div><div class="page-title">Game Rooms</div></div>' +
            (isCmsLoggedIn() ? '<button class="btn btn-primary btn-sm" id="rooms-create-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Criar Sala</button>' : '') +
        '</div>';

        var tabsHtml = '<div class="tabs">' +
            '<button class="tab' + (roomsTab === 'public' ? ' active' : '') + '" data-rooms-tab="public">Salas Públicas</button>' +
            (isCmsLoggedIn() ? '<button class="tab' + (roomsTab === 'my' ? ' active' : '') + '" data-rooms-tab="my">Minhas Salas</button>' : '') +
        '</div>';

        var searchAndFilterHtml = '';
        if (roomsTab === 'public') {
            searchAndFilterHtml = '<div class="rooms-search-filter">' +
                '<div class="rooms-search-wrap">' +
                    '<svg class="rooms-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                    '<input type="text" id="rooms-search-input" class="rooms-search-input" placeholder="Buscar sala por nome..." value="' + escapeHtml(roomsSearchQuery) + '" autocomplete="off">' +
                '</div>';

            if (roomsData && roomsData.rooms && roomsData.rooms.length > 0) {
                var roomGames = {};
                roomsData.rooms.forEach(function(r) {
                    var gt = r.game_title || (r.game ? r.game.title : '');
                    if (gt) roomGames[gt] = true;
                });
                var gameNames = Object.keys(roomGames).sort();
                if (gameNames.length > 1) {
                    searchAndFilterHtml += '<div class="rooms-game-filter">' +
                        '<select id="rooms-game-filter-select">' +
                            '<option value="">Todos os jogos</option>';
                    gameNames.forEach(function(gn) {
                        searchAndFilterHtml += '<option value="' + escapeHtml(gn) + '"' + (roomsGameFilter === gn ? ' selected' : '') + '>' + escapeHtml(gn) + '</option>';
                    });
                    searchAndFilterHtml += '</select></div>';
                }
            }
            searchAndFilterHtml += '</div>';
        }

        var contentHtml = '';

        if (roomsLoading) {
            contentHtml = '<div class="fm-loading"><div class="spinner"></div></div>';
        } else if (roomsTab === 'public') {
            var allRooms = (roomsData && roomsData.rooms) ? roomsData.rooms : [];
            var filteredRooms = allRooms;
            if (roomsGameFilter) {
                filteredRooms = filteredRooms.filter(function(r) {
                    var gt = r.game_title || (r.game ? r.game.title : '');
                    return gt === roomsGameFilter;
                });
            }
            if (roomsSearchQuery) {
                var sq = roomsSearchQuery.toLowerCase();
                filteredRooms = filteredRooms.filter(function(r) {
                    var title = (r.title || '').toLowerCase();
                    return title.indexOf(sq) !== -1;
                });
            }
            if (allRooms.length === 0) {
                contentHtml = '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                    '<p>Nenhuma sala disponível</p>' +
                    (isCmsLoggedIn() ? '<p style="font-size:12px;margin-top:4px">Crie uma nova sala para jogar com amigos!</p>' : '<p style="font-size:12px;margin-top:4px">Faça login para criar salas</p>') +
                '</div>';
            } else if (filteredRooms.length === 0) {
                contentHtml = '<div class="empty-state"><p>' + (roomsSearchQuery ? 'Nenhuma sala encontrada para "' + escapeHtml(roomsSearchQuery) + '"' : 'Nenhuma sala para este jogo') + '</p></div>';
            } else {
                contentHtml = '<div class="rooms-list">';
                filteredRooms.forEach(function(room) {
                    contentHtml += renderRoomCard(room);
                });
                contentHtml += '</div>';
            }
        } else if (roomsTab === 'my') {
            if (!roomsMyData) {
                contentHtml = '<div class="fm-loading"><div class="spinner"></div></div>';
            } else {
                var createdRooms = roomsMyData.created || [];
                var participatingRooms = roomsMyData.participating || [];

                if (createdRooms.length === 0 && participatingRooms.length === 0) {
                    contentHtml = '<div class="empty-state">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
                        '<p>Você não tem salas</p><p style="font-size:12px;margin-top:4px">Crie ou entre em uma sala para começar</p>' +
                    '</div>';
                } else {
                    contentHtml = '';
                    if (createdRooms.length > 0) {
                        contentHtml += '<div class="section-title">Minhas Salas Criadas</div><div class="rooms-list">';
                        createdRooms.forEach(function(room) { contentHtml += renderRoomCard(room); });
                        contentHtml += '</div>';
                    }
                    if (participatingRooms.length > 0) {
                        contentHtml += '<div class="section-title">Salas que Participo</div><div class="rooms-list">';
                        participatingRooms.forEach(function(room) { contentHtml += renderRoomCard(room); });
                        contentHtml += '</div>';
                    }
                }
            }
        }

        el.innerHTML = headerHtml + tabsHtml + searchAndFilterHtml + contentHtml;

        var gameFilterSelect = el.querySelector('#rooms-game-filter-select');
        if (gameFilterSelect) {
            gameFilterSelect.addEventListener('change', function() {
                roomsGameFilter = this.value;
                renderRooms();
            });
        }

        el.querySelectorAll('[data-rooms-tab]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                roomsTab = this.getAttribute('data-rooms-tab');
                roomsGameFilter = '';
                if (roomsTab === 'my' && !roomsMyData) {
                    loadMyRooms();
                }
                renderRooms();
            });
        });

        el.querySelectorAll('.room-card[data-room-id]').forEach(function(card) {
            card.addEventListener('click', function() {
                var roomId = this.getAttribute('data-room-id');
                loadRoomDetail(roomId);
            });
        });

        var createBtn = el.querySelector('#rooms-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', function() {
                roomsShowCreateForm = true;
                renderRooms();
            });
        }

        if (!roomsData && !roomsLoading) {
            loadPublicRooms();
        }
    }

    function loadPublicRooms() {
        roomsLoading = true;
        renderRooms();
        NovaAPI.getRooms({ upcoming: true }, function(err, data) {
            roomsLoading = false;
            if (!err && data) {
                roomsData = data;
            } else {
                roomsData = { rooms: [] };
            }
            if (state.currentPage === 'rooms') renderRooms();
        });
    }

    function loadMyRooms() {
        roomsMyData = null;
        renderRooms();
        NovaAPI.getMyRooms(function(err, data) {
            if (!err && data) {
                roomsMyData = data;
            } else {
                roomsMyData = { created: [], participating: [] };
            }
            if (state.currentPage === 'rooms') renderRooms();
        });
    }

    function loadRoomDetail(roomId) {
        roomsDetailRoom = null;
        roomsFriendIds = {};
        var pending = 2;
        var done = function() {
            pending--;
            if (pending <= 0 && state.currentPage === 'rooms') renderRooms();
        };
        NovaAPI.getRoom(roomId, function(err, data) {
            if (!err && data && data.room) {
                roomsDetailRoom = data.room;
            }
            done();
        });
        var pid = getCmsProfileId();
        if (pid) {
            NovaAPI.getFriendsList(pid, function(err, data) {
                if (!err && data) {
                    (data.friends || []).forEach(function(f) { roomsFriendIds[f.id] = 'friend'; });
                    (data.pending_requests || []).forEach(function(f) {
                        var req = f.requester || {};
                        if (req.id) roomsFriendIds[req.id] = 'pending';
                    });
                    (data.sent_requests || []).forEach(function(f) { roomsFriendIds[f.id] = 'sent'; });
                }
                done();
            });
        } else {
            done();
        }
    }

    function renderRoomDetail(el) {
        var room = roomsDetailRoom;
        if (!room) {
            el.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';
            return;
        }

        var profileId = getCmsProfileId();
        var isCreator = profileId && room.creator_id === profileId;
        var participants = room.participants || [];
        var activeParticipants = participants.filter(function(p) { return p.status === 'joined' || p.status === 'confirmed'; });
        var isParticipant = participants.some(function(p) { return p.user_profile_id === profileId && (p.status === 'joined' || p.status === 'confirmed'); });
        var creatorName = room.creator ? (room.creator.display_name || room.creator.username) : 'Unknown';
        var gameTitle = room.game_title || (room.game ? room.game.title : '');
        var isFull = activeParticipants.length >= (room.max_players || 4);

        var backBtn = '<button class="back-btn" id="rooms-back-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

        var html = backBtn +
            '<div class="room-detail-header">' +
                '<div class="room-detail-title">' + escapeHtml(room.title) + '</div>' +
                getRoomStatusBadge(room.status) +
            '</div>';

        html += '<div class="card" style="margin-top:12px">';
        if (gameTitle) {
            html += '<div class="room-detail-row"><span class="room-detail-label">Jogo</span><span>' + escapeHtml(gameTitle) + '</span></div>';
        }
        var detailServerBadge = room.server_type === 'stealth_server'
            ? '<span class="room-server-badge stealth">Servidor Stealth</span>'
            : '<span class="room-server-badge syslink">System Link</span>';
        html += '<div class="room-detail-row"><span class="room-detail-label">Host</span><span>' + escapeHtml(creatorName) + '</span></div>' +
            '<div class="room-detail-row"><span class="room-detail-label">Servidor</span><span>' + detailServerBadge + '</span></div>' +
            '<div class="room-detail-row"><span class="room-detail-label">Jogadores</span><span>' + activeParticipants.length + '/' + (room.max_players || 4) + '</span></div>' +
            '<div class="room-detail-row"><span class="room-detail-label">Tipo</span><span>' + (room.is_public ? 'Pública' : 'Privada') + '</span></div>';
        if (room.scheduled_at) {
            html += '<div class="room-detail-row"><span class="room-detail-label">Horário</span><span>' + formatRoomTime(room.scheduled_at, room.timezone) + '</span></div>' +
                '<div class="room-detail-row"><span class="room-detail-label">Countdown</span><span class="room-countdown-detail">' + formatRoomCountdown(room.scheduled_at) + '</span></div>';
        }
        html += '</div>';

        if (isCmsLoggedIn() && room.status !== 'cancelled' && room.status !== 'finished') {
            html += '<div class="room-detail-actions">';
            if (!isParticipant && !isCreator && !isFull) {
                html += '<button class="btn btn-primary" id="room-join-btn">Entrar na Sala</button>';
            } else if (isParticipant && !isCreator) {
                html += '<button class="btn btn-secondary" id="room-leave-btn">Sair da Sala</button>';
            }
            if (isCreator) {
                html += '<button class="btn btn-secondary" id="room-edit-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>';
                html += '<button class="btn" style="background:rgba(16,185,129,0.15);color:var(--success);border:1px solid rgba(16,185,129,0.2)" id="room-finish-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Concluir</button>';
                html += '<button class="btn btn-secondary" id="room-invite-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Convidar Amigos</button>';
                html += '<button class="btn" style="background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.2)" id="room-cancel-btn">Cancelar Sala</button>';
            }
            html += '</div>';
        }

        html += '<div class="section-title">Participantes (' + activeParticipants.length + ')</div>' +
            '<div class="room-participants-list">';
        participants.forEach(function(p) {
            if (p.status !== 'joined' && p.status !== 'confirmed' && p.status !== 'invited') return;
            var up = p.userProfile || p.user_profile || {};
            var pName = up.display_name || up.username || 'Unknown';
            var initial = (pName[0] || '?').toUpperCase();
            var statusLabel = p.status === 'invited' ? ' <span class="badge" style="background:rgba(245,158,11,0.15);color:var(--warning);font-size:9px">Convidado</span>' : '';
            var isHost = room.creator_id === up.id;

            html += '<div class="room-participant-item">' +
                '<div class="room-participant-avatar">';
            if (up.avatar_url) {
                html += '<img src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                    '<div class="room-avatar-fallback" style="display:none;width:36px;height:36px;font-size:14px">' + escapeHtml(initial) + '</div>';
            } else {
                html += '<div class="room-avatar-fallback" style="width:36px;height:36px;font-size:14px">' + escapeHtml(initial) + '</div>';
            }
            var canAddFriend = isCmsLoggedIn() && up.id && up.id !== profileId && !roomsFriendIds[up.id];
            var friendState = roomsFriendIds[up.id];
            var friendBadge = '';
            if (friendState === 'friend') {
                friendBadge = '<span class="badge" style="background:rgba(16,185,129,0.15);color:var(--success);font-size:9px;margin-left:4px">Amigo</span>';
            } else if (friendState === 'pending' || friendState === 'sent') {
                friendBadge = '<span class="badge" style="background:rgba(245,158,11,0.15);color:var(--warning);font-size:9px;margin-left:4px">Pendente</span>';
            }
            html += '</div>' +
                '<div class="room-participant-info">' +
                    '<div class="room-participant-name">' + escapeHtml(pName) + (isHost ? ' <span class="room-crown-badge" title="Criador da sala"><svg viewBox="0 0 24 24" fill="var(--warning)" stroke="var(--warning)" stroke-width="1" width="14" height="14"><path d="M2 20h20l-2-14-5 7-3-8-3 8-5-7-2 14z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg></span>' : '') + statusLabel + friendBadge + '</div>' +
                '</div>' +
                (canAddFriend ? '<button class="btn btn-sm room-add-friend-btn" data-add-friend-id="' + up.id + '" title="Adicionar amigo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></button>' : '') +
            '</div>';
        });
        html += '</div>';

        html += '<div id="room-edit-section" class="hidden"></div>';

        html += '<div id="room-invite-section" class="hidden"></div>';

        if (isParticipant || isCreator) {
            var roomClosed = room.status === 'finished' || room.status === 'cancelled';
            html += '<div class="section-title">Chat</div>' +
                '<div class="room-chat-container">' +
                    '<div class="room-chat-messages" id="room-chat-messages"></div>' +
                    (roomClosed ? '' :
                    '<div class="room-chat-input-area">' +
                        '<input type="text" class="room-chat-input" id="room-chat-input" placeholder="Digite sua mensagem..." maxlength="1000">' +
                        '<button class="btn btn-primary room-chat-send-btn" id="room-chat-send">Enviar</button>' +
                    '</div>') +
                '</div>';
        }

        el.innerHTML = html;

        if (isParticipant || isCreator) {
            roomChatLastId = 0;
            loadRoomMessages(room.id, false);
            startRoomChatPoll(room.id);

            var chatInput = el.querySelector('#room-chat-input');
            var chatSendBtn = el.querySelector('#room-chat-send');
            if (chatSendBtn && chatInput) {
                chatSendBtn.addEventListener('click', function() {
                    sendRoomChatMessage(room.id);
                });
                chatInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendRoomChatMessage(room.id);
                    }
                });
            }
        }

        var backBtnEl = el.querySelector('#rooms-back-btn');
        if (backBtnEl) {
            backBtnEl.addEventListener('click', function() {
                stopRoomChatPoll();
                roomsDetailRoom = null;
                roomsData = null;
                loadPublicRooms();
            });
        }

        var joinBtn = el.querySelector('#room-join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', function() {
                joinBtn.disabled = true;
                joinBtn.textContent = 'Entrando...';
                NovaAPI.joinRoom(room.id, function(err) {
                    if (err) {
                        joinBtn.disabled = false;
                        joinBtn.textContent = 'Erro: ' + err.message;
                        setTimeout(function() { joinBtn.textContent = 'Entrar na Sala'; }, 2000);
                    } else {
                        loadRoomDetail(room.id);
                    }
                });
            });
        }

        var leaveBtn = el.querySelector('#room-leave-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', function() {
                if (!confirm('Sair desta sala?')) return;
                leaveBtn.disabled = true;
                leaveBtn.textContent = 'Saindo...';
                NovaAPI.leaveRoom(room.id, function(err) {
                    if (err) {
                        leaveBtn.disabled = false;
                        leaveBtn.textContent = 'Erro';
                        setTimeout(function() { leaveBtn.textContent = 'Sair da Sala'; }, 2000);
                    } else {
                        loadRoomDetail(room.id);
                    }
                });
            });
        }

        var cancelBtn = el.querySelector('#room-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                if (!confirm('Tem certeza que deseja cancelar esta sala?')) return;
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'Cancelando...';
                var cmsUrl = NovaAPI.getCmsUrl();
                var token = NovaAPI.getCmsAuthToken();
                var xhr = new XMLHttpRequest();
                xhr.open('DELETE', cmsUrl + '/api/rooms/' + room.id, true);
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.timeout = 15000;
                xhr.onload = function() {
                    loadRoomDetail(room.id);
                };
                xhr.onerror = function() { cancelBtn.textContent = 'Erro'; };
                xhr.send();
            });
        }

        var finishBtn = el.querySelector('#room-finish-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', function() {
                if (!confirm('Concluir esta sala? Ela será marcada como finalizada.')) return;
                finishBtn.disabled = true;
                finishBtn.textContent = 'Concluindo...';
                NovaAPI.finishRoom(room.id, function(err) {
                    if (err) {
                        finishBtn.disabled = false;
                        finishBtn.textContent = 'Erro: ' + err.message;
                        setTimeout(function() { finishBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Concluir'; }, 2000);
                    } else {
                        loadRoomDetail(room.id);
                    }
                });
            });
        }

        var editBtn = el.querySelector('#room-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                var editSection = el.querySelector('#room-edit-section');
                if (!editSection) return;
                if (!editSection.classList.contains('hidden')) {
                    editSection.classList.add('hidden');
                    return;
                }
                editSection.classList.remove('hidden');
                editSection.innerHTML =
                    '<div class="card" style="margin-top:12px">' +
                        '<div class="section-title" style="margin-top:0">Editar Sala</div>' +
                        '<div class="room-edit-form">' +
                            '<div class="room-edit-field">' +
                                '<label>Título</label>' +
                                '<input type="text" id="room-edit-title" value="' + escapeHtml(room.title) + '" maxlength="255">' +
                            '</div>' +
                            '<div class="room-edit-field">' +
                                '<label>Máx. Jogadores</label>' +
                                '<input type="number" id="room-edit-max-players" value="' + (room.max_players || 4) + '" min="2" max="32">' +
                            '</div>' +
                            '<div class="room-edit-field">' +
                                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
                                    '<input type="checkbox" id="room-edit-is-public"' + (room.is_public ? ' checked' : '') + '> Sala Pública' +
                                '</label>' +
                            '</div>' +
                            '<div class="room-edit-actions">' +
                                '<button class="btn btn-primary btn-sm" id="room-edit-save">Salvar</button>' +
                                '<button class="btn btn-secondary btn-sm" id="room-edit-cancel-btn">Cancelar</button>' +
                            '</div>' +
                            '<p id="room-edit-error" class="hidden" style="color:var(--danger);font-size:12px;margin-top:8px"></p>' +
                        '</div>' +
                    '</div>';

                var editCancelBtn = editSection.querySelector('#room-edit-cancel-btn');
                if (editCancelBtn) {
                    editCancelBtn.addEventListener('click', function() {
                        editSection.classList.add('hidden');
                    });
                }

                var editSaveBtn = editSection.querySelector('#room-edit-save');
                if (editSaveBtn) {
                    editSaveBtn.addEventListener('click', function() {
                        var newTitle = editSection.querySelector('#room-edit-title').value.trim();
                        var newMaxPlayers = parseInt(editSection.querySelector('#room-edit-max-players').value) || 4;
                        var newIsPublic = editSection.querySelector('#room-edit-is-public').checked;
                        var editError = editSection.querySelector('#room-edit-error');

                        if (!newTitle) {
                            editError.textContent = 'Título é obrigatório';
                            editError.classList.remove('hidden');
                            return;
                        }

                        editSaveBtn.disabled = true;
                        editSaveBtn.textContent = 'Salvando...';
                        editError.classList.add('hidden');

                        NovaAPI.updateRoom(room.id, {
                            title: newTitle,
                            max_players: newMaxPlayers,
                            is_public: newIsPublic
                        }, function(err) {
                            if (err) {
                                editSaveBtn.disabled = false;
                                editSaveBtn.textContent = 'Salvar';
                                editError.textContent = err.message;
                                editError.classList.remove('hidden');
                            } else {
                                loadRoomDetail(room.id);
                            }
                        });
                    });
                }
            });
        }

        var inviteBtn = el.querySelector('#room-invite-btn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', function() {
                var inviteSection = el.querySelector('#room-invite-section');
                if (!inviteSection) return;
                if (!inviteSection.classList.contains('hidden')) {
                    inviteSection.classList.add('hidden');
                    return;
                }
                inviteSection.classList.remove('hidden');
                inviteSection.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';

                NovaAPI.getFriendsList(profileId, function(err, data) {
                    if (err || !data) {
                        inviteSection.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted)">Não foi possível carregar amigos</div>';
                        return;
                    }

                    var friends = data.friends || [];
                    if (friends.length === 0) {
                        inviteSection.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted)">Você não tem amigos para convidar</div>';
                        return;
                    }

                    var existingIds = {};
                    participants.forEach(function(p) { existingIds[p.user_profile_id] = true; });

                    var availableFriends = friends.filter(function(f) {
                        var fId = f.id || (f.friend ? f.friend.id : null);
                        return fId && !existingIds[fId];
                    });

                    if (availableFriends.length === 0) {
                        inviteSection.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted)">Todos os amigos já estão na sala</div>';
                        return;
                    }

                    var friendHtml = '<div class="section-title">Convidar Amigos</div><div class="room-invite-list">';
                    availableFriends.forEach(function(f) {
                        var friend = f.friend || f;
                        var fName = friend.display_name || friend.username || 'Unknown';
                        var fId = friend.id;
                        friendHtml += '<div class="room-invite-friend" data-invite-id="' + fId + '">' +
                            '<span>' + escapeHtml(fName) + '</span>' +
                            '<button class="btn btn-sm btn-primary room-invite-friend-btn" data-invite-friend="' + fId + '">Convidar</button>' +
                        '</div>';
                    });
                    friendHtml += '</div>';
                    inviteSection.innerHTML = friendHtml;

                    inviteSection.querySelectorAll('.room-invite-friend-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fId = parseInt(this.getAttribute('data-invite-friend'));
                            this.disabled = true;
                            this.textContent = 'Enviando...';
                            var btnRef = this;
                            NovaAPI.inviteFriends(room.id, [fId], function(err2) {
                                if (err2) {
                                    btnRef.textContent = 'Erro';
                                } else {
                                    btnRef.textContent = 'Enviado!';
                                    btnRef.style.background = 'var(--success)';
                                }
                            });
                        });
                    });
                });
            });
        }

        el.querySelectorAll('.room-add-friend-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var targetId = parseInt(this.getAttribute('data-add-friend-id'));
                this.disabled = true;
                var btnRef = this;
                NovaAPI.sendFriendRequest(targetId, function(err2) {
                    if (err2) {
                        btnRef.innerHTML = '<span style="font-size:10px">' + escapeHtml(err2.message).substring(0, 20) + '</span>';
                        btnRef.style.color = 'var(--danger)';
                    } else {
                        btnRef.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>';
                        btnRef.style.color = 'var(--success)';
                    }
                });
            });
        });
    }

    function stopRoomChatPoll() {
        if (roomChatPollInterval) {
            clearInterval(roomChatPollInterval);
            roomChatPollInterval = null;
        }
    }

    function startRoomChatPoll(roomId) {
        stopRoomChatPoll();
        roomChatPollInterval = setInterval(function() {
            if (state.currentPage !== 'rooms' || !roomsDetailRoom || roomsDetailRoom.id !== roomId) {
                stopRoomChatPoll();
                return;
            }
            loadRoomMessages(roomId, true);
        }, 5000);
    }

    function loadRoomMessages(roomId, isPolling) {
        var afterId = isPolling ? roomChatLastId : 0;
        NovaAPI.getRoomMessages(roomId, afterId, function(err, data) {
            if (err || !data || !data.messages) return;
            var msgs = data.messages;
            if (msgs.length === 0 && isPolling) return;
            var container = document.getElementById('room-chat-messages');
            if (!container) return;

            if (!isPolling) {
                container.innerHTML = '';
                roomChatLastId = 0;
            }

            var profileId = getCmsProfileId();
            msgs.forEach(function(msg) {
                var up = msg.userProfile || {};
                var name = up.display_name || up.username || 'Unknown';
                var initial = (name[0] || '?').toUpperCase();
                var isMine = up.id === profileId;
                var time = '';
                try {
                    var d = new Date(msg.createdAt);
                    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch(e) {}

                var msgEl = document.createElement('div');
                msgEl.className = 'room-chat-msg' + (isMine ? ' room-chat-msg-mine' : '');
                msgEl.innerHTML =
                    '<div class="room-chat-msg-avatar">' +
                        (up.avatar_url ? '<img src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                            '<div class="room-avatar-fallback" style="display:none;width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>' :
                            '<div class="room-avatar-fallback" style="width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>') +
                    '</div>' +
                    '<div class="room-chat-msg-content">' +
                        '<div class="room-chat-msg-header">' +
                            '<span class="room-chat-msg-name">' + escapeHtml(name) + '</span>' +
                            '<span class="room-chat-msg-time">' + time + '</span>' +
                        '</div>' +
                        '<div class="room-chat-msg-text">' + escapeHtml(msg.message) + '</div>' +
                    '</div>';
                container.appendChild(msgEl);

                if (msg.id > roomChatLastId) roomChatLastId = msg.id;
            });

            if (msgs.length > 0) {
                container.scrollTop = container.scrollHeight;
            }

            if (!isPolling && msgs.length === 0) {
                container.innerHTML = '<div class="room-chat-empty">Nenhuma mensagem ainda. Comece a conversa!</div>';
            }
        });
    }

    function sendRoomChatMessage(roomId) {
        var input = document.getElementById('room-chat-input');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        var sendBtn = document.getElementById('room-chat-send');
        if (sendBtn) sendBtn.disabled = true;

        NovaAPI.sendRoomMessage(roomId, text, function(err, data) {
            if (sendBtn) sendBtn.disabled = false;
            if (err) {
                input.value = text;
                return;
            }
            if (data && data.message) {
                var container = document.getElementById('room-chat-messages');
                if (!container) return;

                var emptyMsg = container.querySelector('.room-chat-empty');
                if (emptyMsg) emptyMsg.remove();

                var msg = data.message;
                var up = msg.userProfile || {};
                var name = up.display_name || up.username || 'Unknown';
                var initial = (name[0] || '?').toUpperCase();
                var time = '';
                try {
                    var d = new Date(msg.createdAt);
                    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch(e) {}

                var msgEl = document.createElement('div');
                msgEl.className = 'room-chat-msg room-chat-msg-mine';
                msgEl.innerHTML =
                    '<div class="room-chat-msg-avatar">' +
                        (up.avatar_url ? '<img src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                            '<div class="room-avatar-fallback" style="display:none;width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>' :
                            '<div class="room-avatar-fallback" style="width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>') +
                    '</div>' +
                    '<div class="room-chat-msg-content">' +
                        '<div class="room-chat-msg-header">' +
                            '<span class="room-chat-msg-name">' + escapeHtml(name) + '</span>' +
                            '<span class="room-chat-msg-time">' + time + '</span>' +
                        '</div>' +
                        '<div class="room-chat-msg-text">' + escapeHtml(msg.message) + '</div>' +
                    '</div>';
                container.appendChild(msgEl);
                container.scrollTop = container.scrollHeight;

                if (msg.id > roomChatLastId) roomChatLastId = msg.id;
            }
            input.focus();
        });
    }

    function renderRoomCreateForm(el) {
        var backBtn = '<button class="back-btn" id="rooms-create-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

        var gameOptions = '<option value="">Selecionar jogo (opcional)</option>';
        state.games.forEach(function(g) {
            var name = getGameName(g);
            var id = g.id || '';
            if (name) {
                gameOptions += '<option value="' + escapeHtml(String(id)) + '" data-game-title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
            }
        });

        var now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        var defaultTime = now.toISOString().slice(0, 16);

        var html = backBtn +
            '<div class="page-header" style="padding-top:8px"><div class="page-title">Criar Sala</div></div>' +
            '<form id="room-create-form" class="room-create-form">' +
                '<div class="room-form-field">' +
                    '<label>Nome da Sala *</label>' +
                    '<input type="text" id="room-form-title" placeholder="Ex: Vamos jogar Halo 3" required maxlength="100">' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>Jogo</label>' +
                    '<select id="room-form-game">' + gameOptions + '</select>' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>Data e Hora</label>' +
                    '<input type="datetime-local" id="room-form-time" value="' + defaultTime + '">' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>Tipo de Servidor *</label>' +
                    '<select id="room-form-server-type">' +
                        '<option value="system_link">System Link</option>' +
                        '<option value="stealth_server">Servidor Stealth</option>' +
                    '</select>' +
                '</div>' +
                '<div class="room-form-row">' +
                    '<div class="room-form-field" style="flex:1">' +
                        '<label>Máx. Jogadores</label>' +
                        '<input type="number" id="room-form-max" value="4" min="2" max="16">' +
                    '</div>' +
                    '<div class="room-form-field" style="flex:1">' +
                        '<label>Visibilidade</label>' +
                        '<select id="room-form-public">' +
                            '<option value="true">Pública</option>' +
                            '<option value="false">Privada</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<p id="room-create-error" class="cms-login-error hidden"></p>' +
                '<button type="submit" class="btn btn-primary btn-block" id="room-create-submit">' +
                    '<span id="room-create-btn-text">Criar Sala</span>' +
                    '<div id="room-create-spinner" class="loader-spinner small hidden"></div>' +
                '</button>' +
            '</form>';

        el.innerHTML = html;

        el.querySelector('#rooms-create-back').addEventListener('click', function() {
            roomsShowCreateForm = false;
            renderRooms();
        });

        el.querySelector('#room-create-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var title = el.querySelector('#room-form-title').value.trim();
            var gameSelect = el.querySelector('#room-form-game');
            var gameId = gameSelect.value || null;
            var gameTitle = '';
            if (gameSelect.selectedIndex > 0) {
                gameTitle = gameSelect.options[gameSelect.selectedIndex].getAttribute('data-game-title') || '';
            }
            var scheduledAt = el.querySelector('#room-form-time').value;
            var serverType = el.querySelector('#room-form-server-type').value;
            var maxPlayers = parseInt(el.querySelector('#room-form-max').value) || 4;
            var isPublic = el.querySelector('#room-form-public').value === 'true';
            var errorEl = el.querySelector('#room-create-error');
            var btnText = el.querySelector('#room-create-btn-text');
            var spinner = el.querySelector('#room-create-spinner');
            var submitBtn = el.querySelector('#room-create-submit');

            if (!title) {
                show(errorEl);
                errorEl.textContent = 'Nome da sala é obrigatório';
                return;
            }

            hide(errorEl);
            hide(btnText);
            show(spinner);
            submitBtn.disabled = true;

            var data = {
                title: title,
                game_id: gameId ? parseInt(gameId) : null,
                game_title: gameTitle || null,
                scheduled_at: scheduledAt || null,
                timezone: getUserTimezone(),
                max_players: maxPlayers,
                is_public: isPublic,
                server_type: serverType
            };

            NovaAPI.createRoom(data, function(err, resp) {
                show(btnText);
                hide(spinner);
                submitBtn.disabled = false;

                if (err) {
                    show(errorEl);
                    errorEl.textContent = err.message || 'Erro ao criar sala';
                    return;
                }

                roomsShowCreateForm = false;
                roomsData = null;
                if (resp && resp.room) {
                    roomsDetailRoom = resp.room;
                }
                renderRooms();
            });
        });
    }

    function extractTitleIdFromFilename(fname) {
        if (!fname) return '';
        var upper = String(fname).toUpperCase();
        var m = upper.match(/([0-9A-F]{8})/);
        return m ? m[1] : '';
    }

    function getScreenshotGameMap(allScreenshots) {
        var tidMap = {};
        allScreenshots.forEach(function(s) {
            var fname = s.filename || s.uuid || s || '';
            var tid = extractTitleIdFromFilename(fname);
            if (tid && tid !== '00000000') {
                if (!tidMap[tid]) tidMap[tid] = { tid: tid, count: 0, name: '' };
                tidMap[tid].count++;
            }
        });
        Object.keys(tidMap).forEach(function(tid) {
            var game = state.games.find(function(g) {
                var gid = getGameId(g);
                return gid && gid.replace(/^0x/i, '').toUpperCase() === tid;
            });
            if (game) tidMap[tid].name = getGameName(game);
        });
        return tidMap;
    }

    function renderScreens() {
        var el = $('#page-screens');

        var allScreenshots = state.screenshots || [];
        var currentTitleId = state.title ? (state.title.titleid || state.title.TitleId || '') : '';
        var currentCleanTid = currentTitleId ? currentTitleId.replace(/^0x/i, '').toUpperCase() : '';
        var hasCurrent = currentCleanTid && !isDashboard(state.title);

        var tidMap = getScreenshotGameMap(allScreenshots);

        if (!screensFilterTid) {
            try {
                var savedTid = localStorage.getItem('nova_screens_filter_tid');
                if (savedTid && tidMap[savedTid]) screensFilterTid = savedTid;
            } catch(e) {}
        }

        var displayScreenshots = allScreenshots;
        if (screensFilterTid) {
            displayScreenshots = allScreenshots.filter(function(s) {
                var fname = (s.filename || s.uuid || s || '').toUpperCase();
                return fname.indexOf(screensFilterTid) !== -1;
            });
        }

        var filterHtml = '';
        var gameKeys = Object.keys(tidMap);
        if (gameKeys.length > 0 || hasCurrent) {
            filterHtml = '<div class="screens-filter-bar">';
            filterHtml += '<button class="screens-filter-btn' + (!screensFilterTid ? ' active' : '') + '" data-screens-tid="">Tudo (' + allScreenshots.length + ')</button>';
            if (hasCurrent && tidMap[currentCleanTid]) {
                var currentGame = findGameByTitleId(currentTitleId);
                var currentLabel = currentGame ? getGameName(currentGame) : 'Este Jogo';
                filterHtml += '<button class="screens-filter-btn' + (screensFilterTid === currentCleanTid ? ' active' : '') + '" data-screens-tid="' + currentCleanTid + '">' + escapeHtml(currentLabel) + ' (' + tidMap[currentCleanTid].count + ')</button>';
            }
            gameKeys.sort(function(a, b) {
                var na = tidMap[a].name || a;
                var nb = tidMap[b].name || b;
                return na.localeCompare(nb);
            });
            gameKeys.forEach(function(tid) {
                if (hasCurrent && tid === currentCleanTid) return;
                var info = tidMap[tid];
                var label = info.name || ('0x' + tid);
                filterHtml += '<button class="screens-filter-btn' + (screensFilterTid === tid ? ' active' : '') + '" data-screens-tid="' + tid + '">' + escapeHtml(label) + ' (' + info.count + ')</button>';
            });
            filterHtml += '</div>';
        }

        var headerHtml = '<div class="page-header">' +
            '<div><div class="page-title">Screenshots</div><div class="page-subtitle">' + displayScreenshots.length + ' captures</div></div>' +
            '<button class="take-screenshot-btn" id="take-screenshot-btn">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
                ' Take New' +
            '</button>' +
        '</div>';

        if (displayScreenshots.length === 0) {
            el.innerHTML = headerHtml + filterHtml +
                '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                    '<p>No screenshots yet</p><p style="font-size:12px;margin-top:4px">Press "Take New" to capture a screenshot</p>' +
                '</div>';
            bindTakeScreenshot();
            bindScreensFilter();
            return;
        }

        var progressHtml = '<div class="screens-progress-wrap" id="screens-progress-wrap">' +
            '<div class="screens-progress-bar"><div class="screens-progress-fill" id="screens-progress-fill"></div></div>' +
            '<div class="screens-progress-text" id="screens-progress-text">Carregando 0 / ' + displayScreenshots.length + '</div>' +
        '</div>';

        var html = headerHtml + filterHtml + progressHtml + '<div class="screenshots-grid">';

        displayScreenshots.forEach(function(s) {
            var uuid = s.filename || s.uuid || s;
            var imgUrl = NovaAPI.getScreencaptureUrl(uuid);
            html += '<div class="screenshot-item" data-uuid="' + escapeHtml(uuid) + '">' +
                '<div class="screenshot-loader"><div class="spinner"></div></div>' +
                '<img data-auth-src="' + escapeHtml(imgUrl) + '" alt="Screenshot" style="display:none">' +
                '<div class="screenshot-actions">' +
                    '<button class="screenshot-delete" data-uuid="' + escapeHtml(uuid) + '" title="Delete" onclick="event.stopPropagation()">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                    '</button>' +
                    '<button class="screenshot-download" data-url="' + escapeHtml(imgUrl) + '" data-filename="screenshot_' + escapeHtml(uuid) + '.bmp" title="Download" onclick="event.stopPropagation()">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>';
        });

        html += '</div>';
        el.innerHTML = html;

        var screensTotal = displayScreenshots.length;
        var screensLoaded = 0;
        var progressWrap = $('#screens-progress-wrap');
        var progressFill = $('#screens-progress-fill');
        var progressText = $('#screens-progress-text');

        function updateProgress() {
            screensLoaded++;
            var pct = Math.round((screensLoaded / screensTotal) * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressText) progressText.textContent = 'Carregando ' + screensLoaded + ' / ' + screensTotal;
            if (screensLoaded >= screensTotal && progressWrap) {
                setTimeout(function() { progressWrap.classList.add('screens-progress-done'); }, 400);
            }
        }

        $$('.screenshot-item img[data-auth-src]').forEach(function(img) {
            var loader = img.parentElement.querySelector('.screenshot-loader');
            function hideLoader() {
                img.style.display = '';
                if (loader) loader.style.display = 'none';
                updateProgress();
            }
            img.onload = hideLoader;
            img.onerror = hideLoader;
            NovaAPI.loadAuthImageQueued(img.getAttribute('data-auth-src'), img);
        });

        $$('.screenshot-download').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                NovaAPI.downloadAuthFile(this.dataset.url, this.dataset.filename);
            });
        });

        $$('.screenshot-delete').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var uuid = this.dataset.uuid;
                if (!confirm('Delete this screenshot?')) return;
                NovaAPI.deleteScreencapture(uuid, function(err) {
                    if (!err) {
                        NovaAPI.removeFromImageCache(uuid);
                        state.screenshots = state.screenshots.filter(function(s) {
                            return (s.filename || s.uuid || s) !== uuid;
                        });
                        renderScreens();
                    }
                });
            });
        });

        $$('.screenshot-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var uuid = this.dataset.uuid;
                openImageViewer(uuid);
            });
        });

        bindTakeScreenshot();
        bindScreensFilter();
    }

    function bindScreensFilter() {
        $$('.screens-filter-btn[data-screens-tid]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tid = this.getAttribute('data-screens-tid');
                screensFilterTid = tid || null;
                try { localStorage.setItem('nova_screens_filter_tid', screensFilterTid || ''); } catch(e) {}
                renderScreens();
            });
        });
    }

    function bindTakeScreenshot() {
        var btn = $('#take-screenshot-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                btn.disabled = true;
                btn.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle"></div> Capturing...';
                NovaAPI.takeScreencapture(function(err, data) {
                    if (!err && data) {
                        state.screenshots.unshift(data);
                    }
                    renderScreens();
                });
            });
        }
    }

    function openImageViewer(uuid) {
        var viewer = $('#image-viewer');
        var img = $('#viewer-image');
        var dl = $('#viewer-download');
        var url = NovaAPI.getScreencaptureUrl(uuid);
        var filename = 'screenshot_' + uuid + '.png';

        NovaAPI.loadAuthImage(url, img);
        dl.href = '#';
        dl.download = filename;
        dl.onclick = function(e) {
            e.preventDefault();
            NovaAPI.downloadAuthFile(url, filename);
        };
        show(viewer);
    }

    function closeImageViewer() {
        hide($('#image-viewer'));
        $('#viewer-image').src = '';
    }

    var FM_DRIVES = [
        { name: 'Hdd1:', label: 'Hard Drive' },
        { name: 'Usb0:', label: 'USB 0' },
        { name: 'Usb1:', label: 'USB 1' },
        { name: 'Usb2:', label: 'USB 2' },
        { name: 'Flash:', label: 'Flash' },
        { name: 'Game:', label: 'Game (Aurora)' }
    ];
    var FM_ATTR_DIR = 16;

    var folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    var fileSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
    var downloadSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    var deleteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    var uploadSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    var newFolderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
    var refreshSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    var driveSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="17" cy="12" r="1.5"/></svg>';
    var renameSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
    var gearSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    var copySvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

    function fmFormatSize(bytes) {
        if (!bytes || bytes <= 0) return '';
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        if (i >= sizes.length) i = sizes.length - 1;
        return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
    }

    function fmFormatSpeed(bytesPerSec) {
        if (!bytesPerSec || bytesPerSec <= 0) return '';
        var sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        var i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
        if (i >= sizes.length) i = sizes.length - 1;
        return (bytesPerSec / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    function fmIsDir(item) {
        if (item.type === 'directory') return true;
        return (item.attributes & FM_ATTR_DIR) !== 0;
    }

    function fmBuildFullPath(name) {
        var base = state.filesPath;
        if (state.ftpBridgeMode) {
            if (base && base.charAt(base.length - 1) !== '/') base += '/';
        } else {
            if (base && base.charAt(base.length - 1) !== '\\') base += '\\';
        }
        return base + name;
    }

    function fmSep() {
        return state.ftpBridgeMode ? '/' : '\\';
    }

    function fmNavigateTo(path) {
        state.filesPath = path;
        state.filesList = [];
        state.filesError = null;
        state.filesLoading = true;
        renderFiles();

        var listFn = state.ftpBridgeMode ? NovaAPI.ftpList.bind(NovaAPI) : NovaAPI.getFileList.bind(NovaAPI);

        listFn(path, function(err, data) {
            state.filesLoading = false;
            if (err) {
                state.filesError = 'Could not load directory';
                state.filesList = [];
            } else {
                state.filesError = null;
                var items = [];
                if (Array.isArray(data)) {
                    items = data;
                } else if (data && typeof data === 'object' && data.name != null) {
                    items = [data];
                } else if (data && data.files) {
                    items = data.files;
                }
                items = items.filter(function(item) {
                    return item && item.name && item.name !== '.' && item.name !== '..';
                });
                items.sort(function(a, b) {
                    var aDir = fmIsDir(a) ? 0 : 1;
                    var bDir = fmIsDir(b) ? 0 : 1;
                    if (aDir !== bDir) return aDir - bDir;
                    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                });
                state.filesList = items;
            }
            renderFiles();
        });
    }

    function fmGetParentPath(path) {
        if (!path) return '';
        var sep = state.ftpBridgeMode ? '/' : '\\';
        var clean = path.replace(new RegExp(sep.replace('\\', '\\\\') + '+$'), '');
        var idx = clean.lastIndexOf(sep);
        if (idx === -1) return '';
        var parent = clean.substring(0, idx);
        if (!parent || parent === clean) return '';
        if (state.ftpBridgeMode) parent += '/';
        return parent;
    }

    function fmGetBreadcrumbs(path) {
        if (!path) return [];
        var sep = state.ftpBridgeMode ? '/' : '\\';
        var parts = path.split(sep).filter(function(p) { return p !== ''; });
        var crumbs = [];
        var cumulative = '';
        for (var i = 0; i < parts.length; i++) {
            if (state.ftpBridgeMode) {
                cumulative += '/' + parts[i];
            } else {
                cumulative += (i === 0 ? '' : sep) + parts[i];
            }
            var crumbPath = state.ftpBridgeMode ? cumulative + '/' : cumulative;
            crumbs.push({ label: parts[i], path: crumbPath });
        }
        return crumbs;
    }

    function fmRestoreAndInit() {
        try {
            var savedMode = localStorage.getItem('nova_ftp_bridge_mode');
            if (savedMode === 'true') {
                state.ftpBridgeMode = true;
            }
        } catch(e) {}
        renderFiles();
        fmInitBridge();
    }

    function fmInitBridge() {
        NovaAPI.autoDiscoverFtpBridge(function(err, url, data) {
            if (!err && url) {
                state.ftpBridgeConnected = true;
                state.ftpBridgeUrl = url;
                state.ftpBridgeInfo = data;
                state.ftpBridgeMode = true;
                state.ftpWizardStep = 0;
                try { localStorage.setItem('nova_ftp_bridge_mode', 'true'); } catch(e) {}
            } else {
                state.ftpBridgeConnected = false;
                state.ftpBridgeUrl = '';
                state.ftpBridgeInfo = null;
                state.ftpBridgeMode = false;
                try { localStorage.removeItem('nova_ftp_bridge_mode'); } catch(e) {}
            }
            renderFiles();
        });
    }

    function fmShowUploadProgress(fileName, percentage, speed) {
        var existing = $('#fm-upload-overlay');
        if (!existing) {
            var overlay = document.createElement('div');
            overlay.id = 'fm-upload-overlay';
            overlay.className = 'fm-upload-overlay';
            overlay.innerHTML = '<div class="fm-upload-modal">' +
                '<div class="fm-upload-title">Uploading...</div>' +
                '<div class="fm-upload-filename" id="fm-upload-filename"></div>' +
                '<div class="fm-progress-bar"><div class="fm-progress-fill" id="fm-upload-fill"></div></div>' +
                '<div class="fm-progress-text" id="fm-upload-pct">0%</div>' +
                '<div class="fm-progress-speed" id="fm-upload-speed"></div>' +
            '</div>';
            document.body.appendChild(overlay);
        }
        var nameEl = $('#fm-upload-filename');
        var fillEl = $('#fm-upload-fill');
        var pctEl = $('#fm-upload-pct');
        var speedEl = $('#fm-upload-speed');
        if (nameEl) nameEl.textContent = fileName;
        if (fillEl) fillEl.style.width = percentage + '%';
        if (pctEl) pctEl.textContent = percentage + '%';
        if (speedEl) speedEl.textContent = speed ? fmFormatSpeed(speed) : '';
    }

    function fmHideUploadProgress() {
        var el = $('#fm-upload-overlay');
        if (el) el.remove();
    }

    function fmShowDialog(title, placeholder, defaultVal, onConfirm) {
        var overlay = document.createElement('div');
        overlay.className = 'fm-dialog-overlay';
        overlay.innerHTML = '<div class="fm-dialog">' +
            '<div class="fm-dialog-title">' + escapeHtml(title) + '</div>' +
            '<input type="text" class="fm-dialog-input" id="fm-dialog-val" placeholder="' + escapeHtml(placeholder) + '" value="' + escapeHtml(defaultVal || '') + '">' +
            '<div class="fm-dialog-actions">' +
                '<button class="btn" id="fm-dialog-cancel" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Cancel</button>' +
                '<button class="btn" id="fm-dialog-ok" style="background:var(--accent);color:#fff;border:none">Confirm</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        var input = $('#fm-dialog-val');
        if (input) { input.focus(); input.select(); }
        $('#fm-dialog-cancel').addEventListener('click', function() { overlay.remove(); });
        $('#fm-dialog-ok').addEventListener('click', function() {
            var val = input.value.trim();
            overlay.remove();
            if (val && onConfirm) onConfirm(val);
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var val = input.value.trim();
                overlay.remove();
                if (val && onConfirm) onConfirm(val);
            } else if (e.key === 'Escape') {
                overlay.remove();
            }
        });
    }

    function fmConfirmDelete(path, isDir, name) {
        var overlay = document.createElement('div');
        overlay.className = 'fm-dialog-overlay';
        overlay.innerHTML = '<div class="fm-dialog">' +
            '<div class="fm-dialog-title">Delete ' + (isDir ? 'folder' : 'file') + '?</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;word-break:break-all">Are you sure you want to delete <strong>' + escapeHtml(name) + '</strong>? This cannot be undone.</div>' +
            '<div class="fm-dialog-actions">' +
                '<button class="btn" id="fm-del-cancel" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Cancel</button>' +
                '<button class="btn" id="fm-del-ok" style="background:#ef4444;color:#fff;border:none">Delete</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        $('#fm-del-cancel').addEventListener('click', function() { overlay.remove(); });
        $('#fm-del-ok').addEventListener('click', function() {
            overlay.remove();
            NovaAPI.ftpDelete(path, isDir, function(err) {
                if (err) {
                    showNotification('Failed to delete: ' + err.message, 'error');
                } else {
                    showNotification('Deleted successfully', 'success');
                    fmNavigateTo(state.filesPath);
                }
            });
        });
    }

    function fmUploadFiles() {
        var input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.style.display = 'none';
        input.addEventListener('change', function() {
            var files = input.files;
            if (!files || files.length === 0) return;
            var names = [];
            for (var i = 0; i < files.length; i++) names.push(files[i].name);
            var uploadStart = Date.now();
            fmShowUploadProgress(names.join(', '), 0, 0);
            NovaAPI.ftpUpload(state.filesPath, files, function(progress) {
                var elapsed = (Date.now() - uploadStart) / 1000;
                var speed = elapsed > 0 ? Math.round(progress.loaded / elapsed) : 0;
                fmShowUploadProgress(names.join(', '), progress.percentage || 0, speed);
            }, function(err, data) {
                fmHideUploadProgress();
                if (err) {
                    showNotification('Upload failed: ' + err.message, 'error');
                } else {
                    showNotification(files.length + ' file(s) uploaded', 'success');
                    if (data && data.transferId) {
                        fmPollTransfer(data.transferId);
                    } else {
                        fmNavigateTo(state.filesPath);
                    }
                }
            });
        });
        document.body.appendChild(input);
        input.click();
        setTimeout(function() { input.remove(); }, 60000);
    }

    function fmPollTransfer(transferId) {
        var poll = setInterval(function() {
            NovaAPI.ftpTransferProgress(transferId, function(err, data) {
                if (err || !data) {
                    clearInterval(poll);
                    fmNavigateTo(state.filesPath);
                    return;
                }
                if (data.status === 'completed') {
                    clearInterval(poll);
                    fmNavigateTo(state.filesPath);
                } else if (data.status === 'error') {
                    clearInterval(poll);
                    showNotification('Transfer failed: ' + (data.error || 'Unknown'), 'error');
                    fmNavigateTo(state.filesPath);
                }
            });
        }, 1500);
    }

    function renderFiles() {
        var el = $('#page-files');
        if (!el) return;

        if (!state.filesPath) {
            renderFilesDriveSelect(el);
            return;
        }

        var crumbs = fmGetBreadcrumbs(state.filesPath);
        var parentPath = fmGetParentPath(state.filesPath);
        var isBridge = state.ftpBridgeMode;

        var backBtnHtml = '<button class="fm-back-btn" id="fm-back-btn" title="Go back">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</button>';

        var breadcrumbHtml = '<div class="fm-nav-bar">' + backBtnHtml +
            '<div class="fm-breadcrumb">' +
            '<button class="fm-breadcrumb-item" data-fm-path="">Drives</button>';
        for (var i = 0; i < crumbs.length; i++) {
            breadcrumbHtml += '<span class="fm-breadcrumb-sep">/</span>';
            var cls = i === crumbs.length - 1 ? 'fm-breadcrumb-item current' : 'fm-breadcrumb-item';
            breadcrumbHtml += '<button class="' + cls + '" data-fm-path="' + escapeHtml(crumbs[i].path) + '">' + escapeHtml(crumbs[i].label) + '</button>';
        }
        breadcrumbHtml += '</div></div>';

        var toolbarHtml = '<div class="fm-toolbar">' +
            '<button class="btn" id="fm-refresh-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary)">' + refreshSvg + ' Refresh</button>';

        if (isBridge) {
            toolbarHtml += '<button class="btn" id="fm-upload-btn" style="background:var(--accent);color:#fff;border:none">' + uploadSvg + ' Upload</button>';
            toolbarHtml += '<button class="btn" id="fm-mkdir-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary)">' + newFolderSvg + ' New Folder</button>';
        }

        toolbarHtml += '<div class="fm-toolbar-spacer"></div>';

        var dotClass = state.ftpBridgeConnected ? 'fm-bridge-dot connected' : 'fm-bridge-dot';
        var statusLabel = state.ftpBridgeConnected ? 'FTP Bridge' : 'Aurora (Read-only)';
        toolbarHtml += '<div class="fm-bridge-status" id="fm-bridge-status" style="cursor:pointer" title="Click to configure bridge">' +
            '<span class="' + dotClass + '"></span>' + statusLabel +
        '</div>';

        toolbarHtml += '</div>';

        var headerHtml = '<div class="page-header"><div><div class="page-title">File Manager</div></div></div>';
        var contentHtml = '';

        if (state.filesLoading) {
            contentHtml = '<div class="fm-loading"><div class="spinner"></div></div>';
        } else if (state.filesError) {
            contentHtml = '<div class="fm-error">' + escapeHtml(state.filesError) + '</div>';
        } else if (state.filesList.length === 0) {
            contentHtml = '<div class="fm-empty">This folder is empty or not accessible</div>';
        } else {
            contentHtml = '<div class="fm-list">';
            state.filesList.forEach(function(item) {
                var isDir = fmIsDir(item);
                var fullPath = fmBuildFullPath(item.name);
                contentHtml += '<div class="fm-item" data-fm-item-path="' + escapeHtml(fullPath) + '" data-fm-is-dir="' + (isDir ? '1' : '0') + '">' +
                    '<div class="fm-item-icon ' + (isDir ? 'folder' : 'file') + '">' + (isDir ? folderSvg : fileSvg) + '</div>' +
                    '<div class="fm-item-info">' +
                        '<div class="fm-item-name">' + escapeHtml(item.name) + '</div>' +
                        '<div class="fm-item-meta">' + (isDir ? 'Folder' : fmFormatSize(item.size)) + '</div>' +
                    '</div>' +
                    '<div class="fm-item-actions">';

                if (!isDir) {
                    contentHtml += '<button class="fm-action-btn" data-fm-dl="' + escapeHtml(fullPath) + '" data-fm-name="' + escapeHtml(item.name) + '" title="Download">' + downloadSvg + '</button>';
                }
                if (isBridge) {
                    contentHtml += '<button class="fm-action-btn" data-fm-rename="' + escapeHtml(fullPath) + '" data-fm-oldname="' + escapeHtml(item.name) + '" title="Rename">' + renameSvg + '</button>';
                    contentHtml += '<button class="fm-action-btn danger" data-fm-delete="' + escapeHtml(fullPath) + '" data-fm-del-name="' + escapeHtml(item.name) + '" data-fm-del-dir="' + (isDir ? '1' : '0') + '" title="Delete">' + deleteSvg + '</button>';
                }

                contentHtml += '</div></div>';
            });
            contentHtml += '</div>';
        }

        el.innerHTML = headerHtml + breadcrumbHtml + toolbarHtml + contentHtml;

        var backBtn = $('#fm-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                if (parentPath) {
                    fmNavigateTo(parentPath);
                } else {
                    state.filesPath = '';
                    renderFiles();
                }
            });
        }

        $$('.fm-breadcrumb-item').forEach(function(btn) {
            if (btn.classList.contains('current')) return;
            btn.addEventListener('click', function() {
                var p = this.getAttribute('data-fm-path');
                if (p === '') {
                    state.filesPath = '';
                    renderFiles();
                } else {
                    fmNavigateTo(p);
                }
            });
        });

        $$('.fm-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.fm-item-actions')) return;
                var isDir = this.getAttribute('data-fm-is-dir') === '1';
                if (isDir) {
                    fmNavigateTo(this.getAttribute('data-fm-item-path'));
                }
            });
        });

        $$('[data-fm-dl]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var fpath = this.getAttribute('data-fm-dl');
                var name = this.getAttribute('data-fm-name');
                if (state.ftpBridgeMode) {
                    NovaAPI.ftpDownload(fpath, name);
                } else {
                    NovaAPI.downloadFileFromConsole(fpath, name);
                }
            });
        });

        $$('[data-fm-delete]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var fpath = this.getAttribute('data-fm-delete');
                var name = this.getAttribute('data-fm-del-name');
                var isDir = this.getAttribute('data-fm-del-dir') === '1';
                fmConfirmDelete(fpath, isDir, name);
            });
        });

        $$('[data-fm-rename]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var fpath = this.getAttribute('data-fm-rename');
                var oldName = this.getAttribute('data-fm-oldname');
                fmShowDialog('Rename', 'New name', oldName, function(newName) {
                    if (newName === oldName) return;
                    var parentDir = fpath.substring(0, fpath.lastIndexOf('/') + 1);
                    var newPath = parentDir + newName;
                    NovaAPI.ftpMove(fpath, newPath, function(err) {
                        if (err) {
                            showNotification('Rename failed: ' + err.message, 'error');
                        } else {
                            showNotification('Renamed successfully', 'success');
                            fmNavigateTo(state.filesPath);
                        }
                    });
                });
            });
        });

        var refreshBtn = $('#fm-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                fmNavigateTo(state.filesPath);
            });
        }

        var uploadBtn = $('#fm-upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', function() { fmUploadFiles(); });
        }

        var mkdirBtn = $('#fm-mkdir-btn');
        if (mkdirBtn) {
            mkdirBtn.addEventListener('click', function() {
                fmShowDialog('New Folder', 'Folder name', '', function(name) {
                    var newPath = state.filesPath;
                    if (newPath && newPath.charAt(newPath.length - 1) !== '/') newPath += '/';
                    newPath += name;
                    NovaAPI.ftpMkdir(newPath, function(err) {
                        if (err) {
                            showNotification('Failed to create folder: ' + err.message, 'error');
                        } else {
                            showNotification('Folder created', 'success');
                            fmNavigateTo(state.filesPath);
                        }
                    });
                });
            });
        }

        var bridgeStatusBtn = $('#fm-bridge-status');
        if (bridgeStatusBtn) {
            bridgeStatusBtn.addEventListener('click', function() {
                state.filesPath = '';
                state.ftpWizardStep = 0;
                renderFtpWizard($('#page-files'));
            });
        }
    }

    function renderFilesDriveSelect(el) {
        var statusHtml = '';
        var dotClass = state.ftpBridgeConnected ? 'fm-bridge-dot connected' : 'fm-bridge-dot';
        var statusLabel = state.ftpBridgeConnected ? 'FTP Bridge Connected' : 'Aurora Mode (Read-only)';
        statusHtml = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
            '<div class="fm-bridge-status" id="fm-bridge-status-drive" style="cursor:pointer" title="Bridge settings">' +
                '<span class="' + dotClass + '"></span>' + statusLabel +
            '</div>' +
            '<div class="fm-mode-toggle">';
        if (state.ftpBridgeConnected) {
            statusHtml += '<button class="fm-mode-btn' + (!state.ftpBridgeMode ? ' active' : '') + '" id="fm-mode-aurora">Aurora</button>';
            statusHtml += '<button class="fm-mode-btn' + (state.ftpBridgeMode ? ' active' : '') + '" id="fm-mode-ftp">FTP Bridge</button>';
        }
        statusHtml += '</div></div>';

        if (!state.ftpBridgeConnected) {
            var wizardPromptHtml = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">' +
                '<div style="font-size:14px;color:var(--text-secondary);margin-bottom:10px">Want to upload, delete, and manage files on your Xbox?</div>' +
                '<button class="btn" id="fm-setup-bridge" style="background:var(--accent);color:#fff;border:none;padding:8px 20px">Set Up FTP Bridge</button>' +
            '</div>';
            statusHtml += wizardPromptHtml;
        }

        var html = '<div class="page-header"><div><div class="page-title">File Manager</div><div class="page-subtitle">Select a drive</div></div></div>' +
            statusHtml +
            '<div class="fm-drives">';

        FM_DRIVES.forEach(function(drive) {
            html += '<div class="fm-drive" data-fm-drive="' + escapeHtml(drive.name) + '">' +
                '<div class="fm-drive-icon">' + driveSvg + '</div>' +
                '<div class="fm-drive-label">' + escapeHtml(drive.label) + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + escapeHtml(drive.name) + '</div></div>' +
            '</div>';
        });

        html += '</div>';
        el.innerHTML = html;

        $$('.fm-drive').forEach(function(driveEl) {
            driveEl.addEventListener('click', function() {
                var driveName = this.getAttribute('data-fm-drive');
                if (state.ftpBridgeMode) {
                    var ftpDrive = driveName.replace(/:$/, '');
                    fmNavigateTo('/' + ftpDrive + '/');
                } else {
                    fmNavigateTo(driveName + '\\');
                }
            });
        });

        var setupBtn = $('#fm-setup-bridge');
        if (setupBtn) {
            setupBtn.addEventListener('click', function() {
                renderFtpWizard(el);
            });
        }

        var bridgeStatusDrive = $('#fm-bridge-status-drive');
        if (bridgeStatusDrive) {
            bridgeStatusDrive.addEventListener('click', function() {
                renderFtpWizard(el);
            });
        }

        var modeAurora = $('#fm-mode-aurora');
        var modeFtp = $('#fm-mode-ftp');
        if (modeAurora) {
            modeAurora.addEventListener('click', function() {
                state.ftpBridgeMode = false;
                try { localStorage.removeItem('nova_ftp_bridge_mode'); } catch(e) {}
                renderFiles();
            });
        }
        if (modeFtp) {
            modeFtp.addEventListener('click', function() {
                state.ftpBridgeMode = true;
                try { localStorage.setItem('nova_ftp_bridge_mode', 'true'); } catch(e) {}
                renderFiles();
            });
        }
    }

    function renderFtpWizard(el) {
        var step = state.ftpWizardStep || 0;
        var totalSteps = 4;

        var stepsHtml = '<div class="ftp-wizard-steps">';
        for (var s = 0; s < totalSteps; s++) {
            var stepClass = 'ftp-wizard-step';
            if (s < step) stepClass += ' done';
            else if (s === step) stepClass += ' active';
            stepsHtml += '<div class="' + stepClass + '"></div>';
        }
        stepsHtml += '</div>';

        var bodyHtml = '';

        if (step === 0) {
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">FTP Bridge Setup</div>' +
                '<div class="ftp-wizard-desc">The FTP Bridge is a small app that runs on your PC or phone. It connects your browser to your Xbox 360\'s FTP server, allowing you to upload, download, delete, and manage files directly from this WebUI.<br><br>Since modern browsers no longer support FTP, this bridge acts as the middleman.</div>' +
                '<div class="ftp-wizard-options">' +
                    '<div class="ftp-wizard-option" id="wiz-opt-download">' +
                        '<div class="ftp-wizard-option-icon">' + downloadSvg + '</div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Download Pre-configured Bridge</div>' +
                            '<div class="ftp-wizard-option-desc">Get a ready-to-run ZIP file with everything you need</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ftp-wizard-option" id="wiz-opt-manual">' +
                        '<div class="ftp-wizard-option-icon">' + gearSvg + '</div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Manual Setup</div>' +
                            '<div class="ftp-wizard-option-desc">Step-by-step instructions to set up manually</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ftp-wizard-option" id="wiz-opt-connect">' +
                        '<div class="ftp-wizard-option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Already Running? Connect Now</div>' +
                            '<div class="ftp-wizard-option-desc">Enter the bridge URL if it\'s already set up</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="ftp-wizard-nav"><button class="btn" id="wiz-back-home" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back to Files</button></div>' +
            '</div>';
        } else if (step === 1) {
            var fileSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;display:inline;vertical-align:middle;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">Instalação</div>' +
                '<div class="ftp-wizard-desc">Configure as informações do seu Xbox e baixe os arquivos:</div>' +
                '<div class="ftp-wizard-label">Configuração do Xbox</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' +
                    '<div><label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">IP do Xbox</label>' +
                    '<input type="text" class="ftp-wizard-input" id="wiz-cfg-host" placeholder="192.168.1.100" value="192.168.1.100" style="margin-bottom:0"></div>' +
                    '<div style="display:flex;gap:8px">' +
                        '<div style="flex:1"><label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">Usuário FTP</label>' +
                        '<input type="text" class="ftp-wizard-input" id="wiz-cfg-user" placeholder="xboxftp" value="xboxftp" style="margin-bottom:0"></div>' +
                        '<div style="flex:1"><label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:3px">Senha FTP</label>' +
                        '<input type="text" class="ftp-wizard-input" id="wiz-cfg-pass" placeholder="xboxftp" value="xboxftp" style="margin-bottom:0"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="ftp-wizard-label">Baixar Arquivos</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' +
                    '<button class="btn wiz-dl-btn" id="wiz-dl-bridge" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>bridge.js</strong> <span style="font-size:11px;opacity:0.8">— servidor FTP Bridge configurado</span></span></button>' +
                    '<button class="btn wiz-dl-btn" id="wiz-dl-config" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>bridge-config.json</strong> <span style="font-size:11px;opacity:0.8">— configuração FTP</span></span></button>' +
                    '<button class="btn wiz-dl-btn" id="wiz-dl-package" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>package.json</strong> <span style="font-size:11px;opacity:0.8">— dependências do projeto</span></span></button>' +
                '</div>' +
                '<div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:12px;margin-bottom:16px">' +
                    '<div style="font-size:13px;color:var(--accent-light);font-weight:600;margin-bottom:6px">⚠ Importante</div>' +
                    '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5">Coloque os 3 arquivos em uma <strong>única pasta</strong> (ex: <code>godsend-ftp-bridge</code>) antes de executar os comandos abaixo.</div>' +
                '</div>' +
                '<div style="border-top:1px solid var(--border);margin:16px 0;padding-top:16px">' +
                '<div class="ftp-wizard-label">Windows (CMD / PowerShell)</div>' +
                '<div class="ftp-wizard-cmd" id="cmd-win">cd godsend-ftp-bridge\nnpm install\nnode bridge.js</div>' +
                '<div class="ftp-wizard-label">Linux / macOS (Terminal)</div>' +
                '<div class="ftp-wizard-cmd" id="cmd-linux">cd godsend-ftp-bridge\nnpm install\nnode bridge.js</div>' +
                '<div class="ftp-wizard-label">Android (Termux)</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5">Você precisa do <strong>Termux</strong> para rodar o bridge no celular. Baixe pelo F-Droid:</div>' +
                '<a href="https://f-droid.org/F-Droid.apk" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#1a73e8;color:#fff;border:none;padding:10px 16px;width:100%;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:10px"><span style="display:inline-flex;width:16px;height:16px">' + downloadSvg + '</span> Baixar F-Droid (para instalar Termux)</a>' +
                '<div class="ftp-wizard-cmd" id="cmd-termux">pkg install nodejs\ncd godsend-ftp-bridge\nnpm install\nnode bridge.js</div>' +
                '</div>' +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="wiz-prev" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back</button>' +
                    '<button class="btn" id="wiz-next" style="background:var(--accent);color:#fff;border:none">Next: Configure</button>' +
                '</div>' +
            '</div>';
        } else if (step === 2) {
            var savedUrl = NovaAPI.getFtpBridgeUrl() || 'http://localhost:7860';
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">Configure & Connect</div>' +
                '<div class="ftp-wizard-desc">Enter the address where your FTP Bridge is running.</div>' +
                '<div class="ftp-wizard-label">Bridge URL</div>' +
                '<input type="text" class="ftp-wizard-input" id="wiz-bridge-url" placeholder="http://localhost:7860" value="' + escapeHtml(savedUrl) + '">' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;margin-bottom:12px">Usually <code>http://localhost:7860</code> if running on the same PC, or <code>http://192.168.x.x:7860</code> if on another device</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:12px">' +
                    '<button class="btn" id="wiz-auto-detect" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);flex:1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Auto-Detect</button>' +
                    '<button class="btn" id="wiz-test-conn" style="background:var(--accent);color:#fff;border:none;flex:1">Test Connection</button>' +
                '</div>' +
                '<div id="wiz-conn-status"></div>' +
                '<div id="wiz-ftp-config" style="display:none;border-top:1px solid var(--border);margin-top:14px;padding-top:14px">' +
                    '<div class="ftp-wizard-label" style="margin-top:0">Xbox FTP Settings (on the Bridge)</div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">' +
                        '<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Xbox IP</div><input type="text" class="ftp-wizard-input" id="wiz-ftp-host" placeholder="192.168.1.100" style="margin-bottom:0"></div>' +
                        '<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">FTP Port</div><input type="text" class="ftp-wizard-input" id="wiz-ftp-port" placeholder="21" style="margin-bottom:0"></div>' +
                    '</div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">' +
                        '<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">FTP User</div><input type="text" class="ftp-wizard-input" id="wiz-ftp-user" placeholder="xboxftp" style="margin-bottom:0"></div>' +
                        '<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">FTP Password</div><input type="password" class="ftp-wizard-input" id="wiz-ftp-pass" placeholder="xboxftp" style="margin-bottom:0"></div>' +
                    '</div>' +
                    '<button class="btn" id="wiz-save-ftp" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);width:100%">Save FTP Settings to Bridge</button>' +
                    '<div id="wiz-ftp-save-status"></div>' +
                '</div>' +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="wiz-prev" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back</button>' +
                    '<button class="btn" id="wiz-next" style="background:var(--accent);color:#fff;border:none" disabled>Next</button>' +
                '</div>' +
            '</div>';
        } else if (step === 3) {
            bodyHtml = '<div class="ftp-wizard-card" style="text-align:center">' +
                stepsHtml +
                '<div style="font-size:48px;margin-bottom:12px">&#10003;</div>' +
                '<div class="ftp-wizard-title">Connected!</div>' +
                '<div class="ftp-wizard-desc">FTP Bridge is connected and ready to use. You can now upload, download, delete, and manage files on your Xbox 360 directly from this browser.</div>' +
                (state.ftpBridgeInfo ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Bridge v' + escapeHtml(state.ftpBridgeInfo.version || '1.0.0') + ' | FTP: ' + escapeHtml(state.ftpBridgeInfo.ftp && state.ftpBridgeInfo.ftp.host || '---') + '</div>' : '') +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="wiz-disconnect" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Disconnect</button>' +
                    '<button class="btn" id="wiz-done" style="background:var(--accent);color:#fff;border:none">Open File Manager</button>' +
                '</div>' +
            '</div>';
        }

        el.innerHTML = '<div class="page-header"><div><div class="page-title">File Manager</div><div class="page-subtitle">FTP Bridge Setup</div></div></div>' +
            '<div class="ftp-wizard">' + bodyHtml + '</div>';

        if (step === 0) {
            var optDl = $('#wiz-opt-download');
            var optManual = $('#wiz-opt-manual');
            var optConnect = $('#wiz-opt-connect');
            var backHome = $('#wiz-back-home');
            if (optDl) optDl.addEventListener('click', function() {
                state.ftpWizardStep = 1;
                renderFtpWizard(el);
            });
            if (optManual) optManual.addEventListener('click', function() {
                state.ftpWizardStep = 1;
                renderFtpWizard(el);
            });
            if (optConnect) optConnect.addEventListener('click', function() {
                state.ftpWizardStep = 2;
                renderFtpWizard(el);
            });
            if (backHome) backHome.addEventListener('click', function() {
                state.ftpWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
        } else if (step === 1) {
            $$('.ftp-wizard-cmd').forEach(function(cmdBlock) {
                var copyBtn = document.createElement('button');
                copyBtn.className = 'ftp-wizard-cmd-copy';
                copyBtn.innerHTML = copySvg;
                copyBtn.title = 'Copy';
                copyBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var text = cmdBlock.innerText || cmdBlock.textContent || '';
                    text = text.replace(/\u2713/g, '').trim();
                    function onCopied() {
                        copyBtn.innerHTML = '&#10003;';
                        setTimeout(function() { copyBtn.innerHTML = copySvg; }, 1500);
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(onCopied).catch(function() {
                            fallbackCopy(text);
                            onCopied();
                        });
                    } else {
                        fallbackCopy(text);
                        onCopied();
                    }
                });
                cmdBlock.style.position = 'relative';
                cmdBlock.appendChild(copyBtn);
            });

            function wizGetConfig() {
                var h = $('#wiz-cfg-host');
                var u = $('#wiz-cfg-user');
                var p = $('#wiz-cfg-pass');
                return {
                    host: (h && h.value.trim()) || '192.168.1.100',
                    user: (u && u.value.trim()) || 'xboxftp',
                    pass: (p && p.value.trim()) || 'xboxftp'
                };
            }

            function wizDownloadFile(content, filename) {
                var blob = new Blob([content], { type: 'application/octet-stream' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            }

            var dlBridgeBtn = $('#wiz-dl-bridge');
            if (dlBridgeBtn) dlBridgeBtn.addEventListener('click', function() {
                var cfg = wizGetConfig();
                var xhr = new XMLHttpRequest();
                xhr.open('GET', '/ftp-bridge/bridge.js', true);
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        var content = xhr.responseText;
                        var safeHost = cfg.host.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        var safeUser = cfg.user.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        var safePass = cfg.pass.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                        content = content.replace(/ftpHost:\s*'[^']*'/, "ftpHost: '" + safeHost + "'");
                        content = content.replace(/ftpUser:\s*'[^']*'/, "ftpUser: '" + safeUser + "'");
                        content = content.replace(/ftpPass:\s*'[^']*'/, "ftpPass: '" + safePass + "'");
                        wizDownloadFile(content, 'bridge.js');
                    }
                };
                xhr.send();
            });

            var dlConfigBtn = $('#wiz-dl-config');
            if (dlConfigBtn) dlConfigBtn.addEventListener('click', function() {
                var cfg = wizGetConfig();
                var configJson = JSON.stringify({
                    httpPort: 7860,
                    ftpHost: cfg.host,
                    ftpPort: 21,
                    ftpUser: cfg.user,
                    ftpPass: cfg.pass,
                    ftpSecure: false
                }, null, 2);
                wizDownloadFile(configJson, 'bridge-config.json');
            });

            var dlPkgBtn = $('#wiz-dl-package');
            if (dlPkgBtn) dlPkgBtn.addEventListener('click', function() {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', '/ftp-bridge/package.json', true);
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        wizDownloadFile(xhr.responseText, 'package.json');
                    }
                };
                xhr.send();
            });

            fmWizardNav(el);
        } else if (step === 2) {
            var testBtn = $('#wiz-test-conn');
            var autoBtn = $('#wiz-auto-detect');
            var urlInput = $('#wiz-bridge-url');
            var statusDiv = $('#wiz-conn-status');
            var nextBtn = $('#wiz-next');
            var ftpConfigDiv = $('#wiz-ftp-config');

            function showFtpConfigPanel(bridgeUrl) {
                if (!ftpConfigDiv) return;
                ftpConfigDiv.style.display = 'block';
                var cleanUrl = bridgeUrl.replace(/\/+$/, '');
                var xhr = new XMLHttpRequest();
                xhr.open('GET', cleanUrl + '/config', true);
                xhr.timeout = 5000;
                xhr.onload = function() {
                    try {
                        var cfg = JSON.parse(xhr.responseText);
                        var h = $('#wiz-ftp-host');
                        var p = $('#wiz-ftp-port');
                        var u = $('#wiz-ftp-user');
                        var pw = $('#wiz-ftp-pass');
                        if (h) h.value = cfg.ftpHost || '';
                        if (p) p.value = cfg.ftpPort || '21';
                        if (u) u.value = cfg.ftpUser || '';
                        if (pw) pw.placeholder = cfg.ftpPass || 'xboxftp';
                    } catch(e) {}
                };
                xhr.send();
            }

            function onBridgeConnected(url, data) {
                NovaAPI.setFtpBridgeUrl(url);
                state.ftpBridgeConnected = true;
                state.ftpBridgeUrl = url;
                state.ftpBridgeInfo = data;
                state.ftpBridgeMode = true;
                try { localStorage.setItem('nova_ftp_bridge_mode', 'true'); } catch(e) {}
                var ftpOk = data.ftp && data.ftp.connected;
                var ftpStatus = ftpOk ? 'FTP Connected to ' + escapeHtml(data.ftp.host) : 'Bridge online, but Xbox FTP not reachable. Configure Xbox IP below.';
                var statusClass = ftpOk ? 'success' : 'error';
                statusDiv.innerHTML = '<div class="ftp-wizard-status ' + statusClass + '">' + ftpStatus + '</div>';
                if (nextBtn) nextBtn.disabled = !ftpOk;
                showFtpConfigPanel(url);
            }

            if (testBtn) testBtn.addEventListener('click', function() {
                var url = urlInput.value.trim();
                if (!url) return;
                statusDiv.innerHTML = '<div class="ftp-wizard-status loading">Testing connection...</div>';
                NovaAPI.checkFtpBridge(url, function(err, data) {
                    if (err) {
                        statusDiv.innerHTML = '<div class="ftp-wizard-status error">Failed: ' + escapeHtml(err.message) + '</div>';
                    } else {
                        onBridgeConnected(url, data);
                    }
                });
            });

            if (autoBtn) autoBtn.addEventListener('click', function() {
                statusDiv.innerHTML = '<div class="ftp-wizard-status loading">Searching for bridge...</div>';
                NovaAPI.autoDiscoverFtpBridge(function(err, url, data) {
                    if (err) {
                        statusDiv.innerHTML = '<div class="ftp-wizard-status error">Bridge not found on common addresses. Enter the URL manually.</div>';
                    } else {
                        urlInput.value = url;
                        onBridgeConnected(url, data);
                    }
                });
            });

            var saveFtpBtn = $('#wiz-save-ftp');
            if (saveFtpBtn) saveFtpBtn.addEventListener('click', function() {
                var bridgeUrl = urlInput.value.trim();
                if (!bridgeUrl) return;
                var ftpSaveStatus = $('#wiz-ftp-save-status');
                var payload = {};
                var h = $('#wiz-ftp-host');
                var p = $('#wiz-ftp-port');
                var u = $('#wiz-ftp-user');
                var pw = $('#wiz-ftp-pass');
                if (h && h.value) payload.ftpHost = h.value.trim();
                if (p && p.value) payload.ftpPort = parseInt(p.value);
                if (u && u.value) payload.ftpUser = u.value.trim();
                if (pw && pw.value) payload.ftpPass = pw.value;
                var cleanBridgeUrl = bridgeUrl.replace(/\/+$/, '');
                var xhr = new XMLHttpRequest();
                xhr.open('POST', cleanBridgeUrl + '/config', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.timeout = 5000;
                xhr.onload = function() {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) {
                            if (ftpSaveStatus) ftpSaveStatus.innerHTML = '<div class="ftp-wizard-status success">Settings saved! Testing new connection...</div>';
                            NovaAPI.checkFtpBridge(bridgeUrl, function(err2, data2) {
                                if (!err2 && data2) {
                                    onBridgeConnected(bridgeUrl, data2);
                                } else {
                                    if (ftpSaveStatus) ftpSaveStatus.innerHTML = '<div class="ftp-wizard-status error">Settings saved but FTP connection failed. Check Xbox IP.</div>';
                                }
                            });
                        } else {
                            if (ftpSaveStatus) ftpSaveStatus.innerHTML = '<div class="ftp-wizard-status error">Failed to save settings</div>';
                        }
                    } catch(e) {
                        if (ftpSaveStatus) ftpSaveStatus.innerHTML = '<div class="ftp-wizard-status error">Invalid response</div>';
                    }
                };
                xhr.onerror = function() {
                    if (ftpSaveStatus) ftpSaveStatus.innerHTML = '<div class="ftp-wizard-status error">Connection error</div>';
                };
                xhr.send(JSON.stringify(payload));
            });

            fmWizardNav(el);
        } else if (step === 3) {
            var doneBtn = $('#wiz-done');
            var disconnectBtn = $('#wiz-disconnect');
            if (doneBtn) doneBtn.addEventListener('click', function() {
                state.ftpWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
            if (disconnectBtn) disconnectBtn.addEventListener('click', function() {
                NovaAPI.setFtpBridgeUrl('');
                state.ftpBridgeConnected = false;
                state.ftpBridgeUrl = '';
                state.ftpBridgeInfo = null;
                state.ftpBridgeMode = false;
                try { localStorage.removeItem('nova_ftp_bridge_mode'); } catch(e) {}
                state.ftpWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
        }
    }

    function fmWizardNav(el) {
        var prevBtn = $('#wiz-prev');
        var nextBtn = $('#wiz-next');
        if (prevBtn) prevBtn.addEventListener('click', function() {
            state.ftpWizardStep = Math.max(0, (state.ftpWizardStep || 0) - 1);
            renderFtpWizard(el);
        });
        if (nextBtn) nextBtn.addEventListener('click', function() {
            if (this.disabled) return;
            state.ftpWizardStep = (state.ftpWizardStep || 0) + 1;
            renderFtpWizard(el);
        });
    }

    function renderInfoRow(label, value) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">' +
            '<span style="color:var(--text-muted);font-size:12px">' + escapeHtml(label) + '</span>' +
            '<span style="font-size:13px;font-family:monospace;text-align:right;max-width:60%;word-break:break-all">' + escapeHtml(String(value)) + '</span>' +
        '</div>';
    }

    var chevronDownSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    var iconLink = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    var iconBandwidth = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
    var iconDevice = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    var iconChip = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>';
    var iconPlugin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0 6m0 0v8"/><path d="M5 12H2m20 0h-3"/></svg>';
    var iconThread = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>';
    var iconDashlaunch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    var iconProfile = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

    function safeStr(val) {
        if (val == null) return '---';
        if (typeof val === 'object') {
            try { return JSON.stringify(val); } catch(e) { return String(val); }
        }
        return String(val);
    }

    function settingsInfoRow(label, value) {
        return '<div class="settings-info-row"><span class="settings-info-label">' + escapeHtml(String(label)) + '</span><span class="settings-info-value">' + escapeHtml(safeStr(value)) + '</span></div>';
    }

    function settingsCard(id, icon, title, summaryHtml, bodyHtml, startOpen) {
        var openClass = startOpen ? ' open' : '';
        var collapsedClass = startOpen ? '' : ' collapsed';
        return '<div class="settings-card" id="sc-' + id + '">' +
            '<div class="settings-card-header" data-toggle="sc-' + id + '">' +
                '<div class="settings-card-title">' + icon + ' ' + escapeHtml(title) + '</div>' +
                '<div class="settings-card-toggle' + openClass + '">' + chevronDownSvg + '</div>' +
            '</div>' +
            (summaryHtml ? '<div class="settings-card-summary">' + summaryHtml + '</div>' : '') +
            '<div class="settings-card-body' + collapsedClass + '">' + bodyHtml + '</div>' +
        '</div>';
    }

    function formatVersion(v) {
        if (!v) return '---';
        if (typeof v === 'string') return v;
        if (v.number) {
            var n = v.number;
            var ver = (n.major || 0) + '.' + (n.minor || 0) + '.' + (n.build || 0);
            if (n.type != null) ver += ' (type ' + n.type + ')';
            return ver;
        }
        if (v.major != null) return (v.major || 0) + '.' + (v.minor || 0) + '.' + (v.build || 0);
        return String(v);
    }

    function formatBytes2(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getProfileSlots() {
        try {
            var data = localStorage.getItem('nova_profile_slots');
            if (data) {
                var parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed.filter(function(s) { return s !== null; });
            }
        } catch(e) {}
        return [];
    }

    function saveProfileSlots(slots) {
        try {
            localStorage.setItem('nova_profile_slots', JSON.stringify(slots));
        } catch(e) {}
    }

    function deleteProfileSlot(index) {
        var slots = getProfileSlots();
        if (index >= 0 && index < slots.length) {
            slots.splice(index, 1);
            saveProfileSlots(slots);
        }
        var grid = $('#settings-profiles-grid');
        if (grid) renderProfileSlots(grid, slots, false);
    }

    function updateProfileSlot(profile) {
        if (!profile || !(profile.gamertag || profile.Gamertag)) return;
        var gt = profile.gamertag || profile.Gamertag;
        var slots = getProfileSlots();
        var existingIdx = -1;
        for (var i = 0; i < slots.length; i++) {
            if (slots[i] && (slots[i].gamertag === gt || slots[i].Gamertag === gt)) {
                existingIdx = i;
                break;
            }
        }
        var profileData = {
            gamertag: gt,
            gamerscore: profile.gamerscore || profile.Gamerscore || 0,
            xuid: profile.xuid || profile.XUID || '---',
            signedin: profile.signedin || profile.SignedIn || 0,
            index: profile.index != null ? profile.index : 0,
            lastSeen: Date.now()
        };
        if (existingIdx >= 0) {
            slots[existingIdx] = profileData;
        } else {
            slots.push(profileData);
        }
        saveProfileSlots(slots);
    }

    function renderSettings() {
        var el = $('#page-settings');
        var html = '<div class="page-header"><div class="page-title">Console</div></div>';

        html += '<div id="settings-syslink-row" class="settings-grid"></div>';
        html += '<div id="settings-device-row" class="settings-grid"></div>';
        html += '<div id="settings-plugin-row" class="settings-grid"></div>';
        html += '<div id="settings-dashlaunch-row"></div>';
        html += '<div id="settings-temp-row"></div>';

        html += '<div class="settings-section-title">Profiles</div>';
        html += '<div class="settings-grid" id="settings-profiles-grid"></div>';

        html += '<div class="settings-section-title">GODSend CMS</div>';
        html += '<div id="settings-cms-row" class="settings-grid"></div>';

        html += '<div class="settings-section-title">Preferências</div>';
        html += '<div id="settings-preferences-row" class="settings-grid"></div>';

        html += '<div class="settings-actions">' +
            '<button class="btn" id="settings-refresh">Refresh All</button>' +
            '<button class="btn danger" id="settings-logout">Logout</button>' +
        '</div>';

        html += '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px">' +
            '<img src="img/icon.nova.png" alt="" style="width:28px;height:28px;margin-bottom:6px;opacity:0.4"><br>' +
            'Nova WebUI' +
        '</div>';

        el.innerHTML = html;

        $('#settings-refresh').addEventListener('click', function() { refreshAllData(); });
        $('#settings-logout').addEventListener('click', function() {
            NovaAPI.stopAutoRefresh();
            NovaAPI.logout();
            showLogin('Logged out');
        });

        loadSettingsCms();
        loadSettingsPreferences();
        loadSettingsSystemLink();
        loadSettingsDeviceSmc();
        loadSettingsTemperatures();
        loadSettingsPluginThreads();
        loadSettingsDashLaunch();
        loadSettingsProfiles();
    }

    function loadSettingsCms() {
        var row = $('#settings-cms-row');
        if (!row) return;

        var body = '<div id="cms-url-status" style="font-size:12px;margin-bottom:10px"></div>' +
            '<button class="btn" id="cms-test-btn" style="white-space:nowrap">Testar Conexão</button>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Servidor GODSend CMS para login, descrições de jogos e recursos online.</div>';

        var summary = '<span id="cms-status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:#888"></span><span id="cms-status-text">Verificando...</span>';

        row.innerHTML = settingsCard('cms', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', 'GODSend CMS', summary, body, true);

        var testBtn = $('#cms-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', function() {
                updateCmsStatus();
            });
        }

        function updateCmsStatus() {
            var dot = $('#cms-status-dot');
            var text = $('#cms-status-text');
            var statusDiv = $('#cms-url-status');
            if (dot) dot.style.background = '#888';
            if (text) text.textContent = 'Verificando...';
            if (statusDiv) statusDiv.innerHTML = '<span style="color:var(--text-muted)">Testando conexão...</span>';

            NovaAPI.checkOnline(function(online) {
                if (dot) dot.style.background = online ? '#4ade80' : '#ef4444';
                if (text) text.textContent = online ? 'Conectado' : 'Offline';
                if (statusDiv) {
                    statusDiv.innerHTML = online
                        ? '<span style="color:#4ade80">&#10003; Conectado ao servidor CMS</span>'
                        : '<span style="color:#ef4444">&#10007; Não foi possível conectar ao servidor</span>';
                }
            });
        }

        updateCmsStatus();
    }

    function loadSettingsPreferences() {
        var row = $('#settings-preferences-row');
        if (!row) return;

        var timezones = [
            { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
            { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
            { value: 'America/Rio_Branco', label: 'Rio Branco / Acre (GMT-5)' },
            { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
            { value: 'America/New_York', label: 'New York (EST)' },
            { value: 'America/Chicago', label: 'Chicago (CST)' },
            { value: 'America/Denver', label: 'Denver (MST)' },
            { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
            { value: 'America/Mexico_City', label: 'Cidade do México' },
            { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
            { value: 'Europe/London', label: 'Londres (GMT)' },
            { value: 'Europe/Paris', label: 'Paris (CET)' },
            { value: 'Europe/Berlin', label: 'Berlim (CET)' },
            { value: 'Europe/Moscow', label: 'Moscou (MSK)' },
            { value: 'Asia/Tokyo', label: 'Tóquio (JST)' },
            { value: 'Australia/Sydney', label: 'Sydney (AEST)' }
        ];

        var currentTz = getUserTimezone();
        var selectHtml = '<select id="settings-timezone-select" class="room-form-select">';
        timezones.forEach(function(tz) {
            selectHtml += '<option value="' + tz.value + '"' + (currentTz === tz.value ? ' selected' : '') + '>' + escapeHtml(tz.label) + '</option>';
        });
        selectHtml += '</select>';

        var body = '<div class="room-form-field">' +
            '<label>Fuso Horário</label>' +
            selectHtml +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Os horários das salas serão exibidos no fuso horário selecionado.</div>' +
        '</div>';

        var matchedTz = timezones.find(function(t) { return t.value === currentTz; });
        var summary = escapeHtml(matchedTz ? matchedTz.label : currentTz);

        row.innerHTML = settingsCard('prefs', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', 'Fuso Horário', summary, body, true);

        var tzSelect = $('#settings-timezone-select');
        if (tzSelect) {
            tzSelect.addEventListener('change', function() {
                setUserTimezone(this.value);
                var summaryEl = row.querySelector('.settings-card-summary');
                if (summaryEl) {
                    var found = timezones.find(function(t) { return t.value === tzSelect.value; });
                    summaryEl.textContent = found ? found.label : tzSelect.value;
                }
            });
        }

        bindSettingsToggles(row);
    }

    function loadSettingsSystemLink() {
        var row = $('#settings-syslink-row');
        if (!row) return;

        var slHtml = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconLink + ' System LiNK</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';
        var bwHtml = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconBandwidth + ' Bandwidth</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';
        row.innerHTML = slHtml + bwHtml;

        NovaAPI.getSystemLink(function(err, data) {
            var body = '';
            var summary = '';
            if (err || !data) {
                body = '<p style="color:var(--text-muted);font-size:12px">Could not load SystemLink info</p>';
                summary = 'Unavailable';
            } else {
                var enabled = data.enabled ? 'Enabled' : 'Disabled';
                summary = enabled;
                body += settingsInfoRow('Status', enabled);
                if (data.username) body += settingsInfoRow('Username', data.username);
                var xip = data.xboxip || data.xboxIp || data.xbox_ip || '';
                var xmac = data.xboxmac || data.xboxMac || data.xbox_mac || '';
                var gip = data.gatewayip || data.gatewayIp || data.gateway_ip || '';
                var gmac = data.gatewaymac || data.gatewayMac || data.gateway_mac || '';
                var bport = data.broadcastport || data.broadcastPort || data.broadcast_port || '';
                var dport = data.dataport || data.dataPort || data.data_port || '';
                if (xip) body += settingsInfoRow('Xbox IP', xip);
                if (xmac) body += settingsInfoRow('Xbox MAC', xmac);
                if (gip) body += settingsInfoRow('Gateway IP', gip);
                if (gmac) body += settingsInfoRow('Gateway MAC', gmac);
                if (bport) body += settingsInfoRow('Broadcast Port', bport);
                if (dport) body += settingsInfoRow('Data Port', dport);
                if (data.apikey) body += settingsInfoRow('API Key', data.apikey);
            }
            var cardHtml = settingsCard('syslink', iconLink, 'System LiNK', summary, body, false);

            NovaAPI.getSystemLinkBandwidth(function(err2, bw) {
                var bwBody = '';
                var bwSummary = '';
                if (err2 || !bw) {
                    bwBody = '<p style="color:var(--text-muted);font-size:12px">Could not load bandwidth info</p>';
                    bwSummary = 'Unavailable';
                } else {
                    var rate = bw.rate || {};
                    var bytes = bw.bytes || {};
                    bwSummary = '&#8595; ' + (rate.downstream || 0).toFixed(2) + ' / &#8593; ' + (rate.upstream || 0).toFixed(2) + ' KB/s';
                    bwBody += settingsInfoRow('Download Rate', (rate.downstream || 0).toFixed(4) + ' KB/s');
                    bwBody += settingsInfoRow('Upload Rate', (rate.upstream || 0).toFixed(4) + ' KB/s');
                    bwBody += settingsInfoRow('Downloaded', formatBytes2(bytes.downstream || 0));
                    bwBody += settingsInfoRow('Uploaded', formatBytes2(bytes.upstream || 0));
                }
                var bwCardHtml = settingsCard('bandwidth', iconBandwidth, 'Bandwidth', bwSummary, bwBody, false);
                row.innerHTML = cardHtml + bwCardHtml;
                bindSettingsToggles(row);
            });
        });
    }

    function loadSettingsTemperatures() {
        var row = $('#settings-temp-row');
        if (!row) return;
        if (!state.temperature) {
            row.innerHTML = '';
            return;
        }
        var t = state.temperature;
        var cpuTemp = t.cpu || t.CPU || 0;
        var gpuTemp = t.gpu || t.GPU || 0;
        var memTemp = t.memory || t.mem || t.MEM || t.ram || t.RAM || 0;
        row.innerHTML = '<div class="settings-section-title">Temperatures <span class="refresh-indicator live"></span></div>' +
            '<div class="info-grid">' +
                renderTempCard('CPU', cpuTemp) +
                renderTempCard('GPU', gpuTemp) +
                renderTempCard('RAM', memTemp) +
            '</div>';
    }

    function loadSettingsDeviceSmc() {
        var row = $('#settings-device-row');
        if (!row) return;

        var deviceBody = '';
        var deviceSummary = '';
        if (state.systemInfo) {
            var s = state.systemInfo;
            var consoleType = s.ConsoleType || s.consoletype || (s.console && s.console.type) || '---';
            var motherboard = s.Motherboard || s.motherboard || (s.console && s.console.motherboard) || '---';
            var serial = s.ConsoleSerial || s.serial || '---';
            var consoleId = s.ConsoleId || s.consoleid || '---';
            var cpuKey = s.CPUKey || s.cpukey || '---';
            var dvdKey = s.DVDKey || s.dvdkey || '---';
            var kernel = s.Kernel || s.kernel || '';
            if (!kernel && s.version) {
                kernel = (s.version.major || 0) + '.' + (s.version.minor || 0) + '.' + (s.version.build || 0) + '.' + (s.version.qfe || 0);
            }
            deviceSummary = consoleType + ' &middot; ' + motherboard;
            deviceBody += settingsInfoRow('Console Type', consoleType);
            deviceBody += settingsInfoRow('Motherboard', motherboard);
            deviceBody += settingsInfoRow('Serial', serial);
            deviceBody += settingsInfoRow('Console ID', consoleId);
            deviceBody += settingsInfoRow('CPU Key', cpuKey);
            deviceBody += settingsInfoRow('Kernel', kernel || '---');
            deviceBody += settingsInfoRow('DVD Key', dvdKey);
        } else {
            deviceBody = '<p style="color:var(--text-muted);font-size:12px">No device info loaded</p>';
            deviceSummary = 'Loading...';
        }

        var smcBody = '';
        var smcSummary = '';
        if (state.smc) {
            var smc = state.smc;
            var smcKeys = Object.keys(smc);
            var smcVersion = smc.smcversion || smc.SMCVersion || '';
            smcSummary = smcVersion ? 'v' + smcVersion : smcKeys.length + ' entries';
            function flattenSmcObj(prefix, obj) {
                if (obj == null) { smcBody += settingsInfoRow(prefix, '---'); return; }
                if (Array.isArray(obj)) { smcBody += settingsInfoRow(prefix, obj.join(', ')); return; }
                if (typeof obj !== 'object') { smcBody += settingsInfoRow(prefix, obj); return; }
                Object.keys(obj).forEach(function(k) {
                    var label = prefix ? prefix + '.' + k : k;
                    var v = obj[k];
                    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
                        flattenSmcObj(label, v);
                    } else {
                        smcBody += settingsInfoRow(label, safeStr(v));
                    }
                });
            }
            smcKeys.forEach(function(key) {
                flattenSmcObj(key, smc[key]);
            });
        } else {
            smcBody = '<p style="color:var(--text-muted);font-size:12px">No SMC info loaded</p>';
            smcSummary = 'Loading...';
        }

        row.innerHTML = settingsCard('device', iconDevice, 'Device', deviceSummary, deviceBody, false) +
            settingsCard('smc', iconChip, 'SMC', smcSummary, smcBody, false);
        bindSettingsToggles(row);
    }

    function loadSettingsPluginThreads() {
        var row = $('#settings-plugin-row');
        if (!row) return;

        row.innerHTML = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconPlugin + ' Plugin</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>' +
            '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconThread + ' Active Threads</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';

        NovaAPI.getPluginInfo(function(err, data) {
            var pluginBody = '';
            var pluginSummary = '';
            if (err || !data) {
                pluginBody = '<p style="color:var(--text-muted);font-size:12px">Could not load plugin info</p>';
                pluginSummary = 'Unavailable';
            } else {
                var ver = formatVersion(data.version);
                var apiVer = (data.version && data.version.api != null) ? data.version.api : '---';
                pluginSummary = 'v' + ver + ' (API ' + apiVer + ')';
                pluginBody += settingsInfoRow('Version', ver);
                pluginBody += settingsInfoRow('API Version', apiVer);

                if (data.path) {
                    var p = data.path;
                    if (p.root) pluginBody += settingsInfoRow('Root Path', p.root);
                    if (p.user) pluginBody += settingsInfoRow('User Path', p.user);
                    if (p.web) pluginBody += settingsInfoRow('Web Path', p.web);
                    if (p.launcher) pluginBody += settingsInfoRow('Launcher', p.launcher);
                }

                if (data.features) {
                    pluginBody += '<div style="padding-top:8px;font-size:11px;color:var(--text-muted);font-weight:600">FEATURES</div>';
                    pluginBody += '<div class="feature-grid">';
                    var feats = data.features;
                    Object.keys(feats).forEach(function(fk) {
                        var on = feats[fk] ? true : false;
                        pluginBody += '<div class="feature-item"><span class="feature-dot ' + (on ? 'enabled' : 'disabled') + '"></span>' + escapeHtml(fk) + '</div>';
                    });
                    pluginBody += '</div>';
                }
            }
            var pluginHtml = settingsCard('plugin', iconPlugin, 'Plugin', pluginSummary, pluginBody, false);

            NovaAPI.getThreads(function(err2, tdata) {
                var threadBody = '';
                var threadSummary = '';
                var threads = [];
                if (!err2 && tdata) {
                    if (Array.isArray(tdata)) threads = tdata;
                    else if (tdata.id != null) threads = [tdata];
                }

                if (threads.length === 0) {
                    threadBody = '<p style="color:var(--text-muted);font-size:12px">No active threads</p>';
                    threadSummary = 'None';
                } else {
                    threadSummary = threads.length + ' thread' + (threads.length > 1 ? 's' : '');
                    threadBody += '<div class="thread-list">';
                    threads.forEach(function(th) {
                        var stateNames = ['Ready', 'Running', 'Waiting', 'Suspended', 'Terminated'];
                        var stateStr = stateNames[th.state] || ('State ' + (th.state || 0));
                        threadBody += '<div class="thread-item">' +
                            '<span>' + escapeHtml(th.id || '---') + '</span>' +
                            '<span style="color:var(--text-muted)">P:' + (th.priority || 0) + '</span>' +
                            '<span style="color:' + (th.state === 1 ? 'var(--success)' : 'var(--text-secondary)') + '">' + stateStr + '</span>' +
                        '</div>';
                    });
                    threadBody += '</div>';
                }
                var threadHtml = settingsCard('threads', iconThread, 'Active Threads', threadSummary, threadBody, false);

                row.innerHTML = pluginHtml + threadHtml;
                bindSettingsToggles(row);
            });
        });
    }

    function loadSettingsDashLaunch() {
        var row = $('#settings-dashlaunch-row');
        if (!row) return;
        row.innerHTML = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconDashlaunch + ' DashLaunch</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';

        NovaAPI.getDashLaunch(function(err, data) {
            var body = '';
            var summary = '';
            if (err || !data) {
                body = '<p style="color:var(--text-muted);font-size:12px">Could not load DashLaunch settings</p>';
                summary = 'Unavailable';
            } else {
                var ver = '';
                if (data.version) {
                    ver = formatVersion(data.version);
                    if (data.version.kernel) ver += ' (kernel ' + data.version.kernel + ')';
                    summary = 'v' + ver;
                    body += settingsInfoRow('Version', ver);
                }

                var options = data.options || [];
                if (Array.isArray(options) && options.length > 0) {
                    var categories = {};
                    var uncategorized = [];
                    options.forEach(function(opt) {
                        if (typeof opt === 'object' && opt !== null) {
                            var cat = opt.category || opt.Category || 'Other';
                            var name = opt.name || opt.Name || (opt.id != null ? String(opt.id) : '---');
                            var rawVal = opt.value != null ? opt.value : (opt.Value != null ? opt.Value : '---');
                            var val = safeStr(rawVal);
                            if (!categories[cat]) categories[cat] = [];
                            categories[cat].push({ name: name, value: val });
                        } else {
                            uncategorized.push(String(opt));
                        }
                    });

                    Object.keys(categories).forEach(function(cat) {
                        body += '<div class="dl-category">' + escapeHtml(cat) + '</div>';
                        categories[cat].forEach(function(item) {
                            body += '<div class="dl-option-row"><span class="dl-option-name">' + escapeHtml(item.name) + '</span><span class="dl-option-value">' + escapeHtml(String(item.value)) + '</span></div>';
                        });
                    });

                    if (uncategorized.length > 0) {
                        body += '<div class="dl-category">Options</div>';
                        uncategorized.forEach(function(v, i) {
                            body += '<div class="dl-option-row"><span class="dl-option-name">' + i + '</span><span class="dl-option-value">' + escapeHtml(v) + '</span></div>';
                        });
                    }

                    if (!summary) summary = options.length + ' options';
                } else if (typeof data === 'object') {
                    Object.keys(data).forEach(function(key) {
                        if (key === 'version' || key === 'options') return;
                        var val = data[key];
                        if (typeof val === 'object' && val !== null) {
                            body += '<div class="dl-category">' + escapeHtml(key) + '</div>';
                            Object.keys(val).forEach(function(k2) {
                                var v2 = val[k2];
                                if (typeof v2 === 'object' && v2 !== null) {
                                    body += '<div class="dl-option-row"><span class="dl-option-name">' + escapeHtml(k2) + '</span><span class="dl-option-value">' + escapeHtml(JSON.stringify(v2)) + '</span></div>';
                                } else {
                                    body += '<div class="dl-option-row"><span class="dl-option-name">' + escapeHtml(k2) + '</span><span class="dl-option-value">' + escapeHtml(String(v2)) + '</span></div>';
                                }
                            });
                        } else {
                            body += settingsInfoRow(key, val);
                        }
                    });
                }
            }
            row.innerHTML = settingsCard('dashlaunch', iconDashlaunch, 'DashLaunch', summary, body, false);
            bindSettingsToggles(row);
        });
    }

    function loadSettingsProfiles() {
        var grid = $('#settings-profiles-grid');
        if (!grid) return;

        var slots = getProfileSlots();
        renderProfileSlots(grid, slots, true);

        NovaAPI.getProfiles(function(err, data) {
            var profiles = [];
            if (!err && data) {
                if (Array.isArray(data)) profiles = data;
                else if (Array.isArray(data.profiles)) profiles = data.profiles;
                else if (data.gamertag || data.Gamertag) profiles = [data];
            }

            profiles.forEach(function(p, idx) {
                if (p && p.index == null) p.index = idx;
            });

            var activeProfiles = profiles.filter(function(p) {
                return p && (p.gamertag || p.Gamertag);
            });

            activeProfiles.forEach(function(p) {
                updateProfileSlot(p);
            });

            var updatedSlots = getProfileSlots();
            if (!grid) return;
            renderProfileSlots(grid, updatedSlots, false);
        });
    }

    function renderProfileSlots(container, slots, loading) {
        var html = '';
        var deleteSvgSmall = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        if (slots.length === 0 && loading) {
            for (var e = 0; e < 2; e++) {
                html += '<div class="profile-slot">' +
                    '<div class="profile-slot-empty"><div class="loader-spinner" style="margin:0 auto 8px"></div>Carregando...</div>' +
                '</div>';
            }
        } else if (slots.length === 0) {
            for (var e2 = 0; e2 < 2; e2++) {
                html += '<div class="profile-slot">' +
                    '<div class="profile-slot-empty">' + iconProfile + '<br>Logue na sua conta para carregar o perfil</div>' +
                '</div>';
            }
        } else {
            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                var gt = slot.gamertag || '---';
                var isLive = slot.signedin || slot.SignedIn;
                var initial = gt[0] ? gt[0].toUpperCase() : '?';
                var pIdx = slot.index != null ? slot.index : 0;
                var slotXuid = slot.xuid || slot.Xuid || '';
                var imgUrl = NovaAPI.getProfileImageUrl(pIdx);

                html += '<div class="profile-slot' + (isLive ? ' active' : '') + '">' +
                    '<button class="profile-slot-delete" data-profile-delete="' + i + '" title="Remover do histórico">' + deleteSvgSmall + '</button>' +
                    '<div class="profile-slot-avatar-wrap">' +
                        '<img class="profile-slot-avatar" data-profile-slot-img="' + escapeHtml(imgUrl) + '" data-profile-live="' + (isLive ? '1' : '0') + '" data-profile-xuid="' + escapeHtml(slotXuid) + '" alt="" src="img/noboxart.svg">' +
                        '<div class="profile-slot-avatar-fallback" style="display:none">' + escapeHtml(initial) + '</div>' +
                    '</div>' +
                    '<div class="profile-gamertag">' + escapeHtml(gt) + '</div>' +
                    '<div class="profile-detail"><span style="color:var(--text-muted)">Gamerscore</span><span>' + (slot.gamerscore || 0) + '</span></div>' +
                    '<div class="profile-detail"><span style="color:var(--text-muted)">XUID</span><span style="font-family:monospace;font-size:11px">' + escapeHtml(slot.xuid || '---') + '</span></div>' +
                    '<div class="profile-detail"><span style="color:var(--text-muted)">Status</span><span style="color:' + (isLive ? 'var(--success, #22c55e)' : 'var(--text-muted)') + '">' + (isLive ? 'Online' : 'Offline') + '</span></div>' +
                    (slot.lastSeen && !isLive ? '<div class="profile-cached-badge">Salvo em cache</div>' : '') +
                '</div>';
            }
        }
        container.innerHTML = html;

        container.querySelectorAll('[data-profile-delete]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-profile-delete'), 10);
                deleteProfileSlot(idx);
            });
        });

        container.querySelectorAll('.profile-slot-avatar[data-profile-slot-img]').forEach(function(img) {
            var slotUrl = img.getAttribute('data-profile-slot-img');
            var isLive = img.getAttribute('data-profile-live') === '1';
            var slotXuid = img.getAttribute('data-profile-xuid') || '';
            var slotFallback = img.nextElementSibling;
            if (!isLive) {
                img.style.display = 'none';
                if (slotFallback) slotFallback.style.display = 'flex';
                return;
            }
            NovaAPI.loadAuthImage(slotUrl, img, function() {
                if (img.src.indexOf('noboxart') !== -1) {
                    img.style.display = 'none';
                    if (slotFallback) slotFallback.style.display = 'flex';
                }
            }, slotXuid);
        });
    }

    function bindSettingsToggles(parent) {
        var headers = parent.querySelectorAll('.settings-card-header[data-toggle]');
        headers.forEach(function(header) {
            header.addEventListener('click', function() {
                var cardId = this.getAttribute('data-toggle');
                var card = document.getElementById(cardId);
                if (!card) return;
                var body = card.querySelector('.settings-card-body');
                var toggle = this.querySelector('.settings-card-toggle');
                if (!body) return;
                var isCollapsed = body.classList.contains('collapsed');
                if (isCollapsed) {
                    body.classList.remove('collapsed');
                    if (toggle) toggle.classList.add('open');
                } else {
                    body.classList.add('collapsed');
                    if (toggle) toggle.classList.remove('open');
                }
            });
        });
    }

    function refreshAllData() {
        var btn = $('#settings-refresh');
        if (btn) btn.textContent = 'Refreshing...';

        loadInitialData(function() {
            renderSettings();
        });
    }

    function loadCmsConfig() {
    }

    function loadInitialData(callback) {
        var pending = 7;
        function done() {
            pending--;
            if (pending <= 0 && callback) callback();
        }

        loadCmsConfig();

        NovaAPI.getSystemInfo(function(err, data) {
            if (!err) state.systemInfo = data;
            done();
        });

        NovaAPI.getTemperature(function(err, data) {
            if (!err) state.temperature = data;
            done();
        });

        NovaAPI.getMemory(function(err, data) {
            if (!err) state.memory = data;
            done();
        });

        NovaAPI.getSMCInfo(function(err, data) {
            if (!err) state.smc = data;
            done();
        });

        NovaAPI.getProfiles(function(err, data) {
            if (!err && data) {
                var profiles = Array.isArray(data) ? data : (data.profiles || [data]);
                profiles.forEach(function(p, idx) {
                    if (p && p.index == null) p.index = idx;
                });
                var active = profiles.find(function(p) { return p && (p.signedin || p.SignedIn); });
                if (!active && profiles.length > 0) active = profiles[0];
                if (active && (active.gamertag || active.Gamertag)) state.profile = active;
            }
            done();
        });

        NovaAPI.getTitleInfo(function(err, data) {
            if (!err) {
                state.title = data;
                var tid = data ? (data.titleid || data.TitleId || '') : '';
                state.lastTitleId = tid;
                if (!isDashboard(data) && tid) {
                    var saved = null;
                    try { saved = JSON.parse(localStorage.getItem('nova_title_start')); } catch(e) {}
                    if (saved && saved.titleId === tid && saved.startTime) {
                        state.titleStartTime = saved.startTime;
                    } else {
                        state.titleStartTime = Date.now();
                        try { localStorage.setItem('nova_title_start', JSON.stringify({ titleId: tid, startTime: state.titleStartTime })); } catch(e) {}
                    }
                }
            }
            done();
        });

        NovaAPI.getScreencaptureList(function(err, data) {
            if (!err && data) {
                if (Array.isArray(data)) state.screenshots = data;
                else if (data.screenshots) state.screenshots = data.screenshots;
                else if (data.Captures) state.screenshots = data.Captures;
                else state.screenshots = [];
            }
            done();
        });
    }

    function loadGames() {
        NovaAPI.getTitlesJson(function(err, data) {
            if (!err && data) {
                if (Array.isArray(data)) state.games = data;
                else if (data.Games) state.games = data.Games;
                else if (data.titles) state.games = data.titles;
                else state.games = [];
            }
            if (state.currentPage === 'games') renderGames();
            if (state.currentPage === 'home') renderHome();
        });
    }

    function showLogin(statusMsg) {
        hide($('#loading-overlay'));
        hide($('#main-content'));
        hide($('#bottom-nav'));
        show($('#login-screen'));
        var errorEl = $('#login-error');
        if (statusMsg && errorEl) {
            show(errorEl);
            errorEl.textContent = statusMsg;
            errorEl.style.color = statusMsg === 'Logged out' ? 'var(--text-muted)' : 'var(--danger)';
        } else if (errorEl) {
            hide(errorEl);
        }
        var usernameInput = $('#login-username');
        if (usernameInput) usernameInput.focus();
    }

    function showApp() {
        hide($('#loading-overlay'));
        hide($('#login-screen'));
        show($('#main-content'));
        show($('#bottom-nav'));
    }

    function showConnectionError() {
        hide($('#loading-overlay'));
        hide($('#login-screen'));
        show($('#main-content'));
        show($('#bottom-nav'));
        $('#page-home').innerHTML = '<div class="page-header"><div class="page-title">Dashboard</div></div>' +
            '<div class="card" style="text-align:center;padding:32px">' +
                '<p style="color:var(--text-secondary);margin-bottom:16px">Could not connect to console</p>' +
                '<p style="color:var(--text-muted);font-size:12px;margin-bottom:16px">Make sure you are connected to the same network as your Xbox 360</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Retry</button>' +
            '</div>';
    }

    function onLoginSuccess() {
        showApp();
        state.systemInfo = NovaAPI.getCache().system;
        var startPage = getPageFromHash();

        if (isCmsLoggedIn()) {
            loadCmsProfileData();
        }

        loadInitialData(function() {
            navigateTo(startPage);
        });

        loadGames();
        NovaAPI.startAutoRefresh(5000);
    }

    var _listenersRegistered = false;
    function registerNovaListeners() {
        if (_listenersRegistered) return;
        _listenersRegistered = true;

        NovaAPI.on('temperature', function(data) {
            state.temperature = data;
            if (state.currentPage === 'home') renderHome();
            if (state.currentPage === 'settings') loadSettingsTemperatures();
        });

        NovaAPI.on('memory', function(data) {
            state.memory = data;
            if (state.currentPage === 'home') renderHome();
        });

        NovaAPI.on('title', function(data) {
            var newTid = data ? (data.titleid || data.TitleId || '') : '';
            var oldTid = state.lastTitleId || '';
            if (newTid !== oldTid) {
                if (oldTid && state.titleStartTime && isCmsLoggedIn()) {
                    sendGameStats(oldTid, state.titleStartTime);
                }

                if (isDashboard(data)) {
                    state.titleStartTime = null;
                    try { localStorage.removeItem('nova_title_start'); } catch(e) {}
                } else {
                    var saved = null;
                    try { saved = JSON.parse(localStorage.getItem('nova_title_start')); } catch(e) {}
                    if (saved && saved.titleId === newTid && saved.startTime) {
                        state.titleStartTime = saved.startTime;
                    } else {
                        state.titleStartTime = Date.now();
                        try { localStorage.setItem('nova_title_start', JSON.stringify({ titleId: newTid, startTime: state.titleStartTime })); } catch(e) {}
                    }
                }
                state.lastTitleId = newTid;
                screensFilterTid = null;
                try { localStorage.removeItem('nova_screens_filter_tid'); } catch(e) {}

                if (newTid && !isDashboard(data) && state.currentPage === 'games' && state.selectedGame) {
                    var detailTidOnTitle = getGameId(state.selectedGame);
                    if (detailTidOnTitle && detailTidOnTitle.toLowerCase() === newTid.toLowerCase()) {
                        var achSectionOnTitle = $('#achievements-section');
                        if (achSectionOnTitle) loadAchievements(detailTidOnTitle);
                    }
                }
            } else if (!state.titleStartTime && newTid && !isDashboard(data)) {
                var saved2 = null;
                try { saved2 = JSON.parse(localStorage.getItem('nova_title_start')); } catch(e) {}
                if (saved2 && saved2.titleId === newTid && saved2.startTime) {
                    state.titleStartTime = saved2.startTime;
                }
            }
            state.title = data;
            if (state.currentPage === 'home') renderHome();
        });

        NovaAPI.on('notification', function(data) {
            if (!data) return;
            var prevNotif = state.notification;
            state.notification = data;

            if (prevNotif && data.title !== prevNotif.title) {
                if (state.currentPage === 'games' && state.selectedGame) {
                    var detailTid = getGameId(state.selectedGame);
                    var currentTid = getTitleIdFromState();
                    if (detailTid && currentTid && detailTid.toLowerCase() === currentTid.toLowerCase()) {
                        var achSection = $('#achievements-section');
                        if (achSection) loadAchievements(detailTid);
                    }
                }
            }

            if (prevNotif && data.achievements !== prevNotif.achievements) {
                if (state.currentPage === 'games' && state.selectedGame) {
                    var detailTid2 = getGameId(state.selectedGame);
                    var achSection2 = $('#achievements-section');
                    if (detailTid2 && achSection2) loadAchievements(detailTid2);
                }
            }
        });

        var sessionExpiredHandled = false;
        NovaAPI.on('session_expired', function() {
            if (sessionExpiredHandled) return;
            sessionExpiredHandled = true;
            NovaAPI.stopAutoRefresh();
            var remembered = getRememberedCredentials();
            if (remembered) {
                NovaAPI.authenticate(remembered.username, remembered.password, function(err, data) {
                    sessionExpiredHandled = false;
                    if (!err && data && data.token) {
                        NovaAPI.startAutoRefresh(5000);
                    } else {
                        clearRememberedCredentials();
                        NovaAPI.logout();
                        showLogin('Session expired');
                    }
                });
            } else {
                NovaAPI.logout();
                showLogin('Session expired');
            }
        });
    }

    function getRememberedCredentials() {
        try {
            var data = localStorage.getItem('nova_remember');
            if (!data) return null;
            var decoded = JSON.parse(atob(data));
            if (decoded && decoded.u && decoded.p) return { username: decoded.u, password: decoded.p };
        } catch(e) {}
        return null;
    }
    function saveRememberedCredentials(username, password) {
        try { localStorage.setItem('nova_remember', btoa(JSON.stringify({ u: username, p: password }))); } catch(e) {}
    }
    function clearRememberedCredentials() {
        try { localStorage.removeItem('nova_remember'); } catch(e) {}
    }

    function setupLoginForm() {
        var form = $('#login-form');
        if (!form) return;

        var rememberCheckbox = $('#login-remember');
        var remembered = getRememberedCredentials();
        if (remembered) {
            $('#login-username').value = remembered.username;
            $('#login-password').value = remembered.password;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var username = $('#login-username').value.trim();
            var password = $('#login-password').value;
            var errorEl = $('#login-error');
            var btnText = $('#login-btn-text');
            var btnSpinner = $('#login-btn-spinner');
            var submitBtn = $('#login-submit');
            var shouldRemember = rememberCheckbox && rememberCheckbox.checked;

            if (!username) {
                show(errorEl);
                errorEl.textContent = 'Enter your username';
                return;
            }

            hide(errorEl);
            hide(btnText);
            show(btnSpinner);
            submitBtn.disabled = true;

            NovaAPI.authenticate(username, password, function(err, data) {
                show(btnText);
                hide(btnSpinner);
                submitBtn.disabled = false;

                if (err || !data || !data.token) {
                    show(errorEl);
                    errorEl.textContent = 'Invalid username or password';
                    return;
                }

                if (shouldRemember) {
                    saveRememberedCredentials(username, password);
                } else {
                    clearRememberedCredentials();
                }

                NovaAPI.init(function(err2) {
                    if (err2) {
                        if (err2.loginRequired) {
                            show(errorEl);
                            errorEl.textContent = 'Authentication failed';
                            return;
                        }
                        showConnectionError();
                        return;
                    }
                    onLoginSuccess();
                });
            });
        });
    }

    function init() {
        var loaderTimeout = setTimeout(function() {
            hide($('#loading-overlay'));
            showConnectionError();
        }, 10000);

        NovaAPI.init(function(err) {
            clearTimeout(loaderTimeout);

            if (err) {
                if (err.loginRequired) {
                    var remembered = getRememberedCredentials();
                    if (remembered) {
                        NovaAPI.authenticate(remembered.username, remembered.password, function(authErr, authData) {
                            if (!authErr && authData && authData.token) {
                                NovaAPI.init(function(err2) {
                                    if (err2) { showLogin('Session expired'); return; }
                                    onLoginSuccess();
                                });
                            } else {
                                clearRememberedCredentials();
                                NovaAPI.logout();
                                showLogin('Session expired');
                            }
                        });
                    } else if (NovaAPI.isAuthenticated()) {
                        NovaAPI.logout();
                        showLogin('Session expired');
                    } else {
                        showLogin();
                    }
                } else {
                    showConnectionError();
                }
                return;
            }

            onLoginSuccess();
        });

        registerNovaListeners();
        setupLoginForm();

        $$('.nav-item').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                if (this.dataset.page === 'profile') {
                    e.stopPropagation();
                    togglePerfilSubmenu();
                    return;
                }
                navigateTo(this.dataset.page);
            });
        });

        $$('.sidebar-link').forEach(function(link) {
            link.addEventListener('click', function() {
                navigateTo(this.dataset.page);
            });
        });

        $('#sidebar-overlay').addEventListener('click', closeSidebar);
        $('#sidebar-close').addEventListener('click', closeSidebar);

        $('#viewer-close').addEventListener('click', closeImageViewer);
        $('.image-viewer-backdrop').addEventListener('click', closeImageViewer);

        window.addEventListener('hashchange', function() {
            var page = getPageFromHash();
            if (page !== state.currentPage) navigateTo(page, true);
        });

        window.addEventListener('online', function() {
            checkOnlineStatus();
        });
        window.addEventListener('offline', function() {
            setOnlineState(false);
        });

        checkOnlineStatus();
    }

    return { init: init };
})();

document.addEventListener('DOMContentLoaded', App.init);
