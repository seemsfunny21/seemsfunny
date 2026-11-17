/* ===========================================================================
   PEGASUS MOBILE SHELL LAYOUT v1.1.262
   Exact three-zone mobile layout: top fixed, middle scroll exact, bottom ghost.
   ========================================================================== */
(function () {
    'use strict';

    const MID_CLASS = 'pegasus-mobile-mid';
    const TOP_SELECTORS = ['.btn-back', '.header'];
    const MIN_MID_HEIGHT = 120;
    const EDGE_GAP = 2;

    function getViewportHeight() {
        return Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 802);
    }

    function isViewNode(node) {
        return !!(node && node.nodeType === 1 && (node.classList?.contains('view') || node.classList?.contains('view-layer')));
    }

    function getTopNode(view) {
        const children = Array.from(view.children || []);
        return children.find(child => TOP_SELECTORS.some(selector => child.matches?.(selector))) || null;
    }

    function getGhostTop() {
        const ghost = document.getElementById('ghostNavOverlay') || document.querySelector('.ghost-nav-overlay');
        const vh = getViewportHeight();
        // Embedded launcher mode has no ghost navigation; use the available viewport.
        if (document.documentElement.dataset.pegasusInApplications === 'true') return Math.max(0, vh - 6);
        if (!ghost) return Math.max(0, vh - 43);

        const rect = ghost.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.top) || rect.height <= 0) return Math.max(0, vh - 43);

        // The middle zone must end exactly where the fixed ghost buttons begin.
        return Math.max(0, Math.min(vh, Math.floor(rect.top)));
    }

    function ensureMidWrapper(view) {
        if (!isViewNode(view)) return null;
        if (view.id === 'pinModal') return null;

        const topNode = getTopNode(view);
        let mid = Array.from(view.children || []).find(child => child.classList?.contains(MID_CLASS)) || null;

        if (!mid) {
            mid = document.createElement('div');
            mid.className = MID_CLASS;
            mid.setAttribute('data-pegasus-scroll-zone', 'middle');

            if (topNode && topNode.parentNode === view) {
                topNode.insertAdjacentElement('afterend', mid);
            } else if (view.firstChild) {
                view.insertBefore(mid, view.firstChild);
            } else {
                view.appendChild(mid);
            }
        }

        Array.from(view.children || []).forEach(child => {
            if (child === topNode || child === mid) return;
            if (child.classList?.contains(MID_CLASS)) return;
            mid.appendChild(child);
        });

        view.classList.add('pegasus-shell-view');
        return mid;
    }

    function measureView(view) {
        const mid = ensureMidWrapper(view);
        if (!mid) return;

        const topNode = getTopNode(view);
        const viewRect = view.getBoundingClientRect();
        const ghostTop = getGhostTop();

        let midTop = Math.floor(viewRect.top || 0);
        if (topNode) {
            const topRect = topNode.getBoundingClientRect();
            midTop = Math.max(midTop, Math.ceil(topRect.bottom) + EDGE_GAP);
        }

        const height = Math.max(MIN_MID_HEIGHT, Math.floor(ghostTop - midTop - EDGE_GAP));

        view.style.setProperty('--pegasus-shell-ghost-top', `${ghostTop}px`);
        view.style.setProperty('--pegasus-shell-mid-top', `${midTop}px`);
        view.style.setProperty('--pegasus-shell-mid-height', `${height}px`);

        mid.style.height = `${height}px`;
        mid.style.maxHeight = `${height}px`;
        mid.style.minHeight = '0px';
    }

    function applyShellLayout() {
        document.querySelectorAll('.view, .view-layer').forEach(view => {
            ensureMidWrapper(view);
            measureView(view);
        });
    }

    let scheduled = false;
    function scheduleApply() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(() => {
            scheduled = false;
            applyShellLayout();
        });
    }

    function installObserver() {
        if (!document.body || document.body.__pegasusShellLayoutObserver) return;
        document.body.__pegasusShellLayoutObserver = true;

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && isViewNode(mutation.target)) {
                    scheduleApply();
                    return;
                }
                if (!mutation.addedNodes?.length) continue;
                for (const node of mutation.addedNodes) {
                    if (isViewNode(node) || node.querySelector?.('.view, .view-layer')) {
                        scheduleApply();
                        return;
                    }
                    if (node.parentElement && isViewNode(node.parentElement)) {
                        scheduleApply();
                        return;
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    function installViewportListeners() {
        window.addEventListener('resize', scheduleApply, { passive: true });
        window.addEventListener('orientationchange', () => window.setTimeout(scheduleApply, 120), { passive: true });
        window.visualViewport?.addEventListener?.('resize', scheduleApply, { passive: true });
        window.visualViewport?.addEventListener?.('scroll', scheduleApply, { passive: true });
        window.addEventListener('pegasus_mobile_view_opened', scheduleApply, { passive: true });
    }

    window.PegasusMobileShellLayout = {
        version: '1.1.262',
        refresh: applyShellLayout,
        wrapView: ensureMidWrapper,
        measure: measureView
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyShellLayout();
            installObserver();
            installViewportListeners();
            window.setTimeout(applyShellLayout, 0);
            window.setTimeout(applyShellLayout, 150);
            window.setTimeout(applyShellLayout, 450);
        }, { once: true });
    } else {
        applyShellLayout();
        installObserver();
        installViewportListeners();
        window.setTimeout(applyShellLayout, 0);
        window.setTimeout(applyShellLayout, 150);
        window.setTimeout(applyShellLayout, 450);
    }

    console.log('🧱 PEGASUS MOBILE SHELL: Exact ghost boundary active (v1.1.262).');
})();
