(function () {
    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function initThemeToggle() {
        var button = document.querySelector('.theme-toggle');
        if (!button) return;

        var sun = button.querySelector('.theme-icon-sun');
        var moon = button.querySelector('.theme-icon-moon');

        function isDark() {
            var theme = document.documentElement.dataset.theme;
            if (theme === 'dark') return true;
            if (theme === 'light') return false;
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        function paint() {
            var dark = isDark();
            if (sun) sun.style.display = dark ? 'none' : 'block';
            if (moon) moon.style.display = dark ? 'block' : 'none';
        }

        paint();
        button.addEventListener('click', function () {
            var next = isDark() ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try {
                localStorage.setItem('theme', next);
            } catch (err) {
                // Ignore storage failures in privacy-restricted browsers.
            }
            paint();
        });
    }

    function initTypewriter() {
        var title = document.getElementById('typewriter-title');
        if (!title || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        var lines = Array.prototype.slice.call(title.querySelectorAll('span'));
        var queue = [];
        lines.forEach(function (line) {
            var text = line.textContent || '';
            line.textContent = '';
            for (var i = 0; i < text.length; i++) {
                queue.push({ line: line, char: text[i] });
            }
        });

        var cursor = document.createElement('span');
        cursor.className = 'type-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        cursor.textContent = '_';
        if (lines.length) lines[0].appendChild(cursor);

        var index = 0;
        function typeNext() {
            if (index >= queue.length) return;
            var item = queue[index];
            if (cursor.parentNode !== item.line) item.line.appendChild(cursor);
            cursor.before(document.createTextNode(item.char === ' ' ? '\u00a0' : item.char));
            index += 1;
            window.setTimeout(typeNext, 45);
        }
        window.setTimeout(typeNext, 120);
    }

    function initTagFilter() {
        var bar = document.querySelector('.tag-filter[data-client]');
        var list = document.getElementById('note-list');
        if (!bar || !list) return;

        var rows = Array.prototype.slice.call(list.querySelectorAll('.note-row'));
        var links = Array.prototype.slice.call(bar.querySelectorAll('[data-tag]'));
        var empty = document.getElementById('filter-empty');

        function apply(tag) {
            var known = !tag || links.some(function (link) {
                return link.getAttribute('data-tag') === tag;
            });
            if (!known) tag = '';
            var visible = 0;
            rows.forEach(function (row) {
                var tags = (row.getAttribute('data-tags') || '').split(/\s+/).filter(Boolean);
                var show = !tag || tags.indexOf(tag) !== -1;
                row.hidden = !show;
                if (show) visible += 1;
            });
            links.forEach(function (link) {
                link.setAttribute('aria-pressed', (link.getAttribute('data-tag') || '') === tag ? 'true' : 'false');
            });
            if (empty) empty.hidden = visible > 0;
            var url = new URL(window.location.href);
            if (tag) url.searchParams.set('tag', tag);
            else url.searchParams.delete('tag');
            history.replaceState(null, '', url.pathname + url.search + url.hash);
        }

        bar.addEventListener('click', function (event) {
            var link = event.target.closest('[data-tag]');
            if (!link || !bar.contains(link)) return;
            event.preventDefault();
            var tag = link.getAttribute('data-tag') || '';
            if (tag && link.getAttribute('aria-pressed') === 'true') tag = '';
            apply(tag);
        });

        apply(new URL(window.location.href).searchParams.get('tag') || '');
    }

    function initSearch() {
        var dialog = document.getElementById('search-dialog');
        var button = document.querySelector('.search-toggle');
        var input = document.getElementById('search-input');
        var results = document.getElementById('search-results');
        var empty = document.getElementById('search-empty');
        var indexNode = document.getElementById('note-index');
        if (!dialog || !input || !results || !indexNode) return;

        var notes = [];
        try { notes = JSON.parse(indexNode.textContent || '[]'); } catch (err) { notes = []; }
        var selected = 0;
        var matches = notes.slice();
        var previousFocus = null;

        function isOpen() { return !dialog.hidden; }

        function haystack(note) {
            return [note.title, note.tldr, note.tags, note.id, note.text].join(' ').toLowerCase();
        }

        function escapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, function (ch) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
            });
        }

        function highlight(value, query) {
            var safe = escapeHtml(value);
            if (!query) return safe;
            var pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return safe.replace(new RegExp(pattern, 'ig'), function (match) {
                return '<mark>' + match + '</mark>';
            });
        }

        function snippet(note, query) {
            var source = (note.text || note.tldr || '').replace(/\s+/g, ' ').trim();
            if (!source) return '';
            if (!query) return source.slice(0, 72);
            var at = source.toLowerCase().indexOf(query);
            if (at < 0) return '';
            var start = Math.max(0, at - 28);
            var end = Math.min(source.length, at + query.length + 42);
            return (start > 0 ? '…' : '') + source.slice(start, end) + (end < source.length ? '…' : '');
        }

        function render() {
            var query = input.value.trim().toLowerCase();
            matches = notes.filter(function (note) {
                return !query || haystack(note).indexOf(query) !== -1;
            });
            if (selected >= matches.length) selected = 0;
            results.innerHTML = '';
            matches.forEach(function (note, index) {
                var item = document.createElement('li');
                var link = document.createElement('a');
                link.href = note.href;
                if (index === selected) link.setAttribute('aria-selected', 'true');
                var body = document.createElement('span');
                body.className = 'search-hit-body';
                var title = document.createElement('span');
                title.className = 'search-hit-title';
                title.innerHTML = highlight(note.title, query);
                body.appendChild(title);
                var metaText = [note.date, note.tags].filter(Boolean).join(' · ');
                if (metaText) {
                    var meta = document.createElement('span');
                    meta.className = 'search-hit-meta';
                    meta.textContent = metaText;
                    body.appendChild(meta);
                }
                var excerpt = snippet(note, query);
                if (excerpt) {
                    var preview = document.createElement('span');
                    preview.className = 'search-hit-snippet';
                    preview.innerHTML = highlight(excerpt, query);
                    body.appendChild(preview);
                }
                link.appendChild(body);
                item.appendChild(link);
                results.appendChild(item);
            });
            if (empty) empty.hidden = matches.length > 0 || query === '';
            var current = results.querySelector('[aria-selected="true"]');
            if (current) current.scrollIntoView({ block: 'nearest' });
        }

        function open() {
            if (isOpen()) {
                input.focus();
                return;
            }
            previousFocus = document.activeElement;
            dialog.hidden = false;
            if (button) button.setAttribute('aria-expanded', 'true');
            render();
            input.focus();
            input.select();
        }

        function close() {
            if (!isOpen()) return;
            dialog.hidden = true;
            if (button) button.setAttribute('aria-expanded', 'false');
            if (previousFocus && previousFocus.focus) previousFocus.focus();
        }

        if (button) button.addEventListener('click', open);
        dialog.addEventListener('click', function (event) {
            if (event.target.closest('[data-search-close]')) close();
        });
        input.addEventListener('input', function () {
            selected = 0;
            render();
        });
        input.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!matches.length) return;
                selected = (selected + 1) % matches.length;
                render();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (!matches.length) return;
                selected = (selected - 1 + matches.length) % matches.length;
                render();
            } else if (event.key === 'Enter') {
                var note = matches[selected] || matches[0];
                if (!note) return;
                event.preventDefault();
                window.location.href = note.href;
            }
        });

        document.addEventListener('keydown', function (event) {
            var key = (event.key || '').toLowerCase();
            if ((event.metaKey || event.ctrlKey) && key === 'k' && !event.altKey) {
                event.preventDefault();
                if (isOpen()) close();
                else open();
                return;
            }
            if (event.key === 'Escape' && isOpen()) {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        }, true);
    }

    function initArticleCopy() {
        var button = document.getElementById('article-copy');
        var source = document.getElementById('article-copy-source');
        var toast = document.getElementById('copy-toast');
        if (!button || !source || !toast) return;

        var payload;
        try {
            payload = JSON.parse(source.textContent || '{}');
        } catch (err) {
            button.hidden = true;
            return;
        }

        var title = String(payload.title || '').replace(/\s+/g, ' ').trim();
        var content = String(payload.content || '').trim();
        var markdown = (title ? '# ' + title + '\n\n' : '') + content + '\n';
        var feedbackTimer = null;
        var toastTimer = null;

        function fallbackCopy(text) {
            return new Promise(function (resolve, reject) {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    if (!document.execCommand('copy')) throw new Error('copy command failed');
                    resolve();
                } catch (err) {
                    reject(err);
                } finally {
                    textarea.remove();
                }
            });
        }

        function writeClipboard(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text).catch(function () {
                    return fallbackCopy(text);
                });
            }
            return fallbackCopy(text);
        }

        function showToast(message) {
            toast.textContent = message;
            toast.hidden = false;
            window.requestAnimationFrame(function () { toast.classList.add('visible'); });
            if (toastTimer) window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(function () {
                toast.classList.remove('visible');
                window.setTimeout(function () { toast.hidden = true; }, 220);
            }, 1800);
        }

        button.addEventListener('click', function () {
            writeClipboard(markdown).then(function () {
                var copiedLabel = button.getAttribute('data-copied-label') || 'Copied';
                button.classList.remove('copied');
                void button.offsetWidth;
                button.classList.add('copied');
                button.setAttribute('aria-label', copiedLabel);
                button.title = copiedLabel;
                showToast(copiedLabel);
                if (feedbackTimer) window.clearTimeout(feedbackTimer);
                feedbackTimer = window.setTimeout(function () {
                    var copyLabel = button.getAttribute('data-copy-label') || 'Copy article';
                    button.classList.remove('copied');
                    button.setAttribute('aria-label', copyLabel);
                    button.title = copyLabel;
                }, 1500);
            }).catch(function () {
                showToast(button.getAttribute('data-copy-error') || 'Copy failed');
            });
        });
    }

    function markParentHeadings() {
        var article = document.querySelector('main article');
        if (!article) return;

        var parent = '';
        article.querySelectorAll('h2, h3').forEach(function (heading) {
            if (heading.tagName === 'H2') {
                parent = heading.textContent.replace(/\s+/g, ' ').trim();
                return;
            }
            if (parent) heading.setAttribute('data-parent-heading', parent);
        });
    }

    function setSectionOpen(section, open) {
        if (!section) return;
        section.classList.toggle('is-collapsed', !open);
        var heading = section.querySelector(':scope > .fold-heading');
        if (heading) heading.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function expandArticleSection(heading) {
        var section = heading && heading.closest('.fold-section');
        while (section) {
            setSectionOpen(section, true);
            section = section.parentElement.closest('.fold-section');
        }
    }

    function initArticleHierarchy() {
        var content = document.querySelector('.article-content');
        if (!content) return;

        var headings = Array.prototype.slice.call(content.querySelectorAll('h1, h2, h3'));
        if (!headings.length) return;

        var topLevel = Math.min.apply(null, headings.map(function (heading) {
            return Number(heading.tagName.slice(1));
        }));
        headings.forEach(function (heading) {
            if (Number(heading.tagName.slice(1)) === topLevel) heading.classList.add('sec-numbered');
        });

        for (var index = headings.length - 1; index >= 0; index -= 1) {
            var heading = headings[index];
            var level = Number(heading.tagName.slice(1));
            var section = document.createElement('section');
            section.className = 'fold-section';
            section.setAttribute('data-fold-level', String(level));
            var body = document.createElement('div');
            body.className = 'fold-body';

            heading.parentNode.insertBefore(section, heading);
            section.appendChild(heading);
            heading.classList.add('fold-heading');
            heading.setAttribute('tabindex', '0');
            heading.setAttribute('aria-expanded', 'true');
            section.appendChild(body);

            var current = section.nextSibling;
            while (current) {
                var boundary = current.nodeType === 1 &&
                    current.classList.contains('fold-section') &&
                    Number(current.getAttribute('data-fold-level')) <= level;
                if (boundary) break;
                var next = current.nextSibling;
                body.appendChild(current);
                current = next;
            }
        }

        function toggleHeading(heading) {
            var section = heading.closest('.fold-section');
            if (!section) return;
            setSectionOpen(section, section.classList.contains('is-collapsed'));
            updateFoldToggle();
            window.dispatchEvent(new Event('scroll'));
        }

        var foldToggle = document.getElementById('fold-toggle');

        function updateFoldToggle() {
            if (!foldToggle) return;
            var sections = Array.prototype.slice.call(content.querySelectorAll('.fold-section'));
            if (!sections.length) {
                foldToggle.hidden = true;
                return;
            }
            var anyOpen = sections.some(function (section) {
                return !section.classList.contains('is-collapsed');
            });
            var icon = foldToggle.querySelector('.fold-icon');
            var label = anyOpen ? foldToggle.getAttribute('data-collapse-label') : foldToggle.getAttribute('data-expand-label');
            foldToggle.hidden = false;
            foldToggle.setAttribute('aria-expanded', anyOpen ? 'true' : 'false');
            foldToggle.setAttribute('aria-label', label || '');
            foldToggle.title = label || '';
            if (icon) icon.textContent = anyOpen ? '⊟' : '⊞';
        }

        if (foldToggle) {
            foldToggle.addEventListener('click', function () {
                var sections = Array.prototype.slice.call(content.querySelectorAll('.fold-section'));
                var anyOpen = sections.some(function (section) {
                    return !section.classList.contains('is-collapsed');
                });
                sections.forEach(function (section) { setSectionOpen(section, !anyOpen); });
                updateFoldToggle();
                window.dispatchEvent(new Event('scroll'));
            });
        }
        updateFoldToggle();

        content.addEventListener('click', function (event) {
            var heading = event.target.closest('.fold-heading');
            if (!heading || !content.contains(heading) || event.target.closest('a')) return;
            toggleHeading(heading);
        });
        content.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            var heading = event.target.closest('.fold-heading');
            if (!heading || !content.contains(heading) || event.target.closest('a')) return;
            event.preventDefault();
            toggleHeading(heading);
        });
    }

    function initTocSpy() {
        var toc = document.getElementById('TableOfContents');
        var shell = document.querySelector('.page-toc');
        var pane = shell && shell.querySelector('.toc-pane');
        var rail = shell && shell.querySelector('.toc-rail');
        var pin = shell && shell.querySelector('.toc-pin');
        if (!toc || !shell || !pane || !rail) return;

        var items = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]')).map(function (link) {
            var raw = link.getAttribute('href').slice(1);
            var id = raw;
            try { id = decodeURIComponent(raw); } catch (err) { id = raw; }
            var heading = document.getElementById(id);
            return heading ? { link: link, li: link.parentElement, heading: heading, id: id } : null;
        }).filter(Boolean);
        if (!items.length) return;

        var sectionNo = 0;
        items.forEach(function (item) {
            var label = item.link.textContent.replace(/\s+/g, ' ').trim();
            item.link.setAttribute('aria-label', label);
            if (!item.heading.classList.contains('sec-numbered') || item.link.querySelector('.toc-sec-num')) return;
            sectionNo += 1;
            var number = document.createElement('span');
            number.className = 'toc-sec-num';
            number.setAttribute('aria-hidden', 'true');
            number.textContent = String(sectionNo).padStart(2, '0');
            item.link.insertBefore(number, item.link.firstChild);
        });

        var groups = [];
        Array.prototype.slice.call(toc.querySelectorAll('li')).forEach(function (item) {
            var childList = Array.prototype.slice.call(item.children).find(function (child) {
                return child.tagName === 'UL';
            });
            if (!childList) return;
            item.classList.add('toc-group');
            var wrap = document.createElement('div');
            wrap.className = 'toc-sub-wrap';
            item.insertBefore(wrap, childList);
            wrap.appendChild(childList);
            groups.push(item);
        });

        var rootList = toc.querySelector(':scope > ul');
        var roots = rootList ? Array.prototype.slice.call(rootList.children).filter(function (item) {
            return item.tagName === 'LI';
        }) : [];

        rail.innerHTML = '';
        roots.forEach(function (root) {
            var link = Array.prototype.slice.call(root.children).find(function (child) {
                return child.tagName === 'A';
            });
            if (!link) return;
            var tick = document.createElement('button');
            tick.type = 'button';
            tick.className = 'toc-rail-tick';
            tick.setAttribute('data-target', link.getAttribute('href').slice(1));
            var label = link.getAttribute('aria-label') || link.textContent.trim();
            tick.setAttribute('aria-label', label);
            tick.title = label;
            rail.appendChild(tick);
        });
        var tickCount = rail.querySelectorAll('.toc-rail-tick').length;
        shell.style.setProperty('--toc-rail-height', Math.max(64, 20 + tickCount * 11 + Math.max(0, tickCount - 1) * 5) + 'px');

        function setPinned(pinned) {
            shell.classList.toggle('is-pinned', pinned);
            if (!pin) return;
            var label = pinned ? pin.getAttribute('data-unpin-label') : pin.getAttribute('data-pin-label');
            pin.setAttribute('aria-expanded', pinned ? 'true' : 'false');
            pin.setAttribute('aria-label', label || '');
            pin.title = label || '';
        }

        var pinned = false;
        try { pinned = localStorage.getItem('agora-toc-pinned') === 'true'; } catch (err) { pinned = false; }
        setPinned(pinned);
        if (pin) {
            pin.addEventListener('click', function () {
                pinned = !shell.classList.contains('is-pinned');
                setPinned(pinned);
                try { localStorage.setItem('agora-toc-pinned', String(pinned)); } catch (err) { /* ignore */ }
            });
        }

        var current = null;

        function keepCurrentVisible(item) {
            if (!item || pane.scrollHeight <= pane.clientHeight + 1) return;
            var paneRect = pane.getBoundingClientRect();
            var linkRect = item.link.getBoundingClientRect();
            if (linkRect.top < paneRect.top + 44) pane.scrollTop -= paneRect.top + 44 - linkRect.top;
            else if (linkRect.bottom > paneRect.bottom - 12) pane.scrollTop += linkRect.bottom - (paneRect.bottom - 12);
        }

        function paint(item) {
            if (!item) return;
            current = item;
            items.forEach(function (candidate) {
                var active = candidate === item;
                candidate.li.classList.toggle('active', active);
                if (active) candidate.link.setAttribute('aria-current', 'location');
                else candidate.link.removeAttribute('aria-current');
            });
            groups.forEach(function (group) {
                group.classList.toggle('is-expanded', group.contains(item.li));
            });

            var root = roots.find(function (candidate) { return candidate.contains(item.li); });
            var rootLink = root && Array.prototype.slice.call(root.children).find(function (child) {
                return child.tagName === 'A';
            });
            var rootTarget = rootLink ? rootLink.getAttribute('href').slice(1) : '';
            Array.prototype.slice.call(rail.querySelectorAll('.toc-rail-tick')).forEach(function (tick) {
                tick.classList.toggle('active', tick.getAttribute('data-target') === rootTarget);
            });
            window.requestAnimationFrame(function () { keepCurrentVisible(item); });
        }

        function findCurrent() {
            var threshold = Math.min(220, Math.max(104, window.innerHeight * 0.22));
            var visibleItems = items.filter(function (item) {
                return item.heading.getClientRects().length > 0;
            });
            var candidate = visibleItems[0] || items[0];
            visibleItems.forEach(function (item) {
                if (item.heading.getBoundingClientRect().top <= threshold) candidate = item;
            });
            return candidate;
        }

        var frame = null;
        function update() {
            frame = null;
            var next = findCurrent();
            if (next !== current) paint(next);
        }
        function scheduleUpdate() {
            if (frame !== null) return;
            frame = window.requestAnimationFrame(update);
        }
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate, { passive: true });
        paint(findCurrent());

        function goTo(id) {
            var item = items.find(function (candidate) { return candidate.id === id; });
            if (!item) return;
            expandArticleSection(item.heading);
            item.heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            try { history.replaceState(null, '', '#' + encodeURIComponent(id)); } catch (err) { /* ignore */ }
            paint(item);
        }

        toc.addEventListener('click', function (event) {
            var link = event.target.closest('a[href^="#"]');
            if (!link || !toc.contains(link)) return;
            event.preventDefault();
            var raw = link.getAttribute('href').slice(1);
            try { goTo(decodeURIComponent(raw)); } catch (err) { goTo(raw); }
        });
        rail.addEventListener('click', function (event) {
            var tick = event.target.closest('.toc-rail-tick[data-target]');
            if (!tick) return;
            var raw = tick.getAttribute('data-target');
            try { goTo(decodeURIComponent(raw)); } catch (err) { goTo(raw); }
        });
    }

    function initArticleMenu() {
        var button = document.getElementById('menu-button');
        var toc = document.querySelector('.page-toc');
        if (!button || !toc) return;

        function setOpen(open) {
            document.body.classList.toggle('menu-open', open);
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        button.addEventListener('click', function () {
            setOpen(!document.body.classList.contains('menu-open'));
        });

        toc.addEventListener('click', function (event) {
            if (event.target.closest('a')) setOpen(false);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') setOpen(false);
        });
    }

    ready(function () {
        initThemeToggle();
        initTypewriter();
        initTagFilter();
        initSearch();
        initArticleCopy();
        markParentHeadings();
        initArticleHierarchy();
        initTocSpy();
        initArticleMenu();
    });
})();
