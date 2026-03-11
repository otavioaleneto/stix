(function() {
  var mainContent = null;
  var navbarTitle = null;
  var isNavigating = false;
  var pageIntervals = [];
  var pageTimeouts = [];
  var loadedScripts = {};

  var origSetInterval = window.setInterval;
  var origClearInterval = window.clearInterval;
  var origSetTimeout = window.setTimeout;
  var origClearTimeout = window.clearTimeout;

  window.setInterval = function() {
    var id = origSetInterval.apply(window, arguments);
    pageIntervals.push(id);
    return id;
  };
  window.clearInterval = function(id) {
    pageIntervals = pageIntervals.filter(function(i) { return i !== id; });
    return origClearInterval.call(window, id);
  };
  window.setTimeout = function() {
    var id = origSetTimeout.apply(window, arguments);
    pageTimeouts.push(id);
    return id;
  };
  window.clearTimeout = function(id) {
    pageTimeouts = pageTimeouts.filter(function(i) { return i !== id; });
    return origClearTimeout.call(window, id);
  };

  function clearPageTimers() {
    pageIntervals.forEach(function(id) { origClearInterval(id); });
    pageIntervals = [];
    pageTimeouts.forEach(function(id) { origClearTimeout(id); });
    pageTimeouts = [];
  }

  function init() {
    mainContent = document.querySelector('main');
    navbarTitle = document.querySelector('header h1');
    if (!mainContent) return;
    document.querySelectorAll('script[src]').forEach(function(s) {
      loadedScripts[s.src] = true;
    });
    document.addEventListener('click', handleClick);
    window.addEventListener('popstate', handlePopState);
    interceptForms();
  }

  function shouldIntercept(url) {
    if (!url) return false;
    try {
      var parsed = new URL(url, window.location.origin);
      if (parsed.origin !== window.location.origin) return false;
      var path = parsed.pathname;
      if (path.startsWith('/api/')) return false;
      if (path.startsWith('/login')) return false;
      if (path.startsWith('/logout')) return false;
      if (path.startsWith('/install')) return false;
      if (path.startsWith('/plugin/download')) return false;
      if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|zip|pdf|lua)$/i)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function handleClick(e) {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;

    var link = e.target.closest('a');
    if (!link) return;
    if (link.getAttribute('target') === '_blank') return;
    if (link.hasAttribute('download')) return;

    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    var fullUrl = new URL(href, window.location.origin);
    if (!shouldIntercept(fullUrl.href)) return;

    e.preventDefault();
    navigateTo(fullUrl.pathname + fullUrl.search + fullUrl.hash);
  }

  function interceptForms() {
    document.addEventListener('submit', function(e) {
      if (e.defaultPrevented) return;
      var form = e.target;
      if (!form.action) return;
      var actionUrl;
      try { actionUrl = new URL(form.action, window.location.origin); } catch(err) { return; }
      if (!shouldIntercept(actionUrl.href)) return;
      if (form.enctype === 'multipart/form-data') return;

      var method = (form.method || 'GET').toUpperCase();

      if (method === 'GET') {
        e.preventDefault();
        var formData = new FormData(form);
        var params = new URLSearchParams(formData);
        var existingParams = new URLSearchParams(actionUrl.search);
        existingParams.forEach(function(v, k) { if (!params.has(k)) params.set(k, v); });
        var qs = params.toString();
        var url = actionUrl.pathname + (qs ? '?' + qs : '');
        navigateTo(url);
      } else if (method === 'POST') {
        e.preventDefault();
        submitForm(form, actionUrl);
      }
    });
  }

  function submitForm(form, actionUrl) {
    if (isNavigating) return;
    isNavigating = true;
    mainContent.style.opacity = '0.4';
    mainContent.style.transition = 'opacity 0.15s ease';

    var formData = new URLSearchParams(new FormData(form));

    fetch(actionUrl.pathname + actionUrl.search, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-PJAX': 'true'
      },
      body: formData.toString(),
      credentials: 'same-origin',
      redirect: 'follow'
    })
    .then(function(response) {
      var finalUrl = response.url ? new URL(response.url) : null;
      if (finalUrl && finalUrl.pathname === '/login') {
        window.location.href = response.url;
        return null;
      }
      if (finalUrl) {
        history.pushState(null, '', finalUrl.pathname + finalUrl.search + finalUrl.hash);
      }
      return response.text();
    })
    .then(function(html) {
      if (html === null) return;
      swapContent(html);
    })
    .catch(function(err) {
      console.error('[SPA] Form submit error:', err);
      form.submit();
    })
    .finally(function() {
      isNavigating = false;
    });
  }

  function navigateTo(url, isPopState) {
    if (isNavigating) return;
    isNavigating = true;

    mainContent.style.opacity = '0.4';
    mainContent.style.transition = 'opacity 0.15s ease';

    fetch(url, {
      headers: { 'X-PJAX': 'true' },
      credentials: 'same-origin'
    })
    .then(function(response) {
      if (response.redirected) {
        var redirectUrl = new URL(response.url);
        if (redirectUrl.pathname === '/login') {
          window.location.href = response.url;
          return null;
        }
        if (!isPopState) {
          history.pushState(null, '', redirectUrl.pathname + redirectUrl.search + redirectUrl.hash);
        }
      } else {
        if (!isPopState) {
          history.pushState(null, '', url);
        }
      }
      return response.text();
    })
    .then(function(html) {
      if (html === null) return;
      swapContent(html);
    })
    .catch(function(err) {
      console.error('[SPA] Navigation error:', err);
      window.location.href = url;
    })
    .finally(function() {
      isNavigating = false;
    });
  }

  function swapContent(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    var newMain = doc.querySelector('main');
    if (!newMain) {
      window.location.reload();
      return;
    }

    var newTitle = doc.querySelector('title');
    if (newTitle) {
      document.title = newTitle.textContent;
    }

    if (navbarTitle) {
      var newNavTitle = doc.querySelector('header h1');
      if (newNavTitle) {
        navbarTitle.textContent = newNavTitle.textContent;
      }
    }

    clearPageTimers();

    mainContent.innerHTML = newMain.innerHTML;

    mainContent.style.opacity = '1';

    executeScripts(mainContent);

    updateSidebarActive();

    if (typeof window.applySidebarState === 'function') window.applySidebarState();
    if (typeof window.initSidebarToggle === 'function') window.initSidebarToggle();
    if (typeof window.initUserMenu === 'function') window.initUserMenu();

    window.scrollTo(0, 0);
  }

  function executeScripts(container) {
    var links = container.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(function(link) {
      var href = link.href;
      if (href && !loadedScripts[href]) {
        loadedScripts[href] = true;
        var newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = href;
        document.head.appendChild(newLink);
      }
    });

    var styles = container.querySelectorAll('style');
    styles.forEach(function(style) {
      var newStyle = document.createElement('style');
      newStyle.textContent = style.textContent;
      document.head.appendChild(newStyle);
    });

    var scripts = container.querySelectorAll('script');
    scripts.forEach(function(oldScript) {
      if (oldScript.src) {
        var fullSrc = new URL(oldScript.src, window.location.origin).href;
        if (loadedScripts[fullSrc]) return;
        loadedScripts[fullSrc] = true;
      }
      var newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      Array.from(oldScript.attributes).forEach(function(attr) {
        if (attr.name !== 'src') {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  function updateSidebarActive() {
    var path = window.location.pathname;
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var links = sidebar.querySelectorAll('nav a[href]');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      var isActive = false;

      if (href === '/dashboard' && path.startsWith('/dashboard')) isActive = true;
      else if (href !== '/dashboard' && href !== '/' && path.startsWith(href)) isActive = true;

      var classes = link.className;
      if (isActive) {
        classes = classes.replace(/text-gray-400 hover:text-white hover:bg-gray-700\/50/g, 'bg-gray-700 text-white');
      } else {
        classes = classes.replace(/bg-gray-700 text-white/g, 'text-gray-400 hover:text-white hover:bg-gray-700/50');
      }
      link.className = classes;
    });
  }

  function handlePopState() {
    navigateTo(window.location.pathname + window.location.search + window.location.hash, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
