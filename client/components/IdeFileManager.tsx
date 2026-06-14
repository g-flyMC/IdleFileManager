import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import FileTreeSidebar from './FileTreeSidebar';
import FileEditorTabs from './FileEditorTabs';
import IdeConsole from './IdeConsole';
import IdeSettings from './IdeSettings';
import IdeSearch from './IdeSearch';
import { IdeTab, IdeFile } from './ide-types';

interface Props {
  children?: React.ReactNode;
}

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 600;
const MIN_CONSOLE = 80;

/**
 * Scan DOM pour fixed/sticky elements → détecte sidebar gauche + navbar top.
 * Fonctionne avec Nebula (sidebar ~52px icônes) et tout autre layout.
 */
function getOffsets(): { left: number; top: number } {
  let left = 0;
  let top = 0;
  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const s = window.getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'sticky') return;
    const r = el.getBoundingClientRect();
    // Sidebar gauche : ancré à x=0, étroit (< 300px), haut (> 50% viewport)
    if (r.left === 0 && r.width > 20 && r.width < 300 && r.height > window.innerHeight * 0.5) {
      left = Math.max(left, r.width);
    }
    // Navbar top : ancré à y=0, large (> 50% viewport), court (< 120px)
    if (r.top === 0 && r.width > window.innerWidth * 0.5 && r.height > 20 && r.height < 120) {
      top = Math.max(top, r.height);
    }
  });
  return { left: Math.round(left), top: Math.round(top) };
}

const IdeFileManager: React.FC<Props> = ({ children }) => {
  const { id: serverId } = useParams<{ id: string }>();

  // ── Mode Toggle ──
  const [isIdeMode, setIsIdeMode] = useState(() => localStorage.getItem('ide-mode') !== 'false');
  useEffect(() => {
    localStorage.setItem('ide-mode', isIdeMode ? 'true' : 'false');
  }, [isIdeMode]);

  // ── Global CSS init ──
  useEffect(() => {
    const rounded = localStorage.getItem('ide-rounded-corners') !== 'false';
    document.documentElement.style.setProperty('--ide-radius', rounded ? '8px' : '0px');
  }, []);

  // ── Offset détection (Nebula sidebar + top nav) ──
  useEffect(() => {
    if (!isIdeMode) return;
    const apply = () => {
      const { left, top } = getOffsets();
      document.documentElement.style.setProperty('--ide-left-offset', `${left}px`);
      document.documentElement.style.setProperty('--ide-nav-top', `${top}px`);
    };
    // Première passe après un court délai (Nebula render async)
    apply();
    const t = setTimeout(apply, 200);
    window.addEventListener('resize', apply);
    const obs = new MutationObserver(apply);
    obs.observe(document.body, {
      childList: true,
      subtree: false,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', apply);
      obs.disconnect();
      document.documentElement.style.setProperty('--ide-left-offset', '0px');
      document.documentElement.style.setProperty('--ide-nav-top', '57px');
    };
  }, [isIdeMode]);

  // ── Tab Caching ──
  const [tabs, setTabs] = useState<IdeTab[]>(() => {
    try {
      const cached = localStorage.getItem(`ide-tabs-${serverId}`);
      if (cached)
        return JSON.parse(cached).map((t: any) => ({
          ...t,
          content: null,
          isLoading: true,
          isDirty: false,
        }));
    } catch {}
    return [];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => localStorage.getItem(`ide-active-tab-${serverId}`) || null
  );

  useEffect(() => {
    const mini = tabs.map((t) => ({
      id: t.id,
      name: t.name,
      path: t.path,
      pendingLine: t.pendingLine,
    }));
    localStorage.setItem(`ide-tabs-${serverId}`, JSON.stringify(mini));
  }, [tabs, serverId]);

  useEffect(() => {
    if (activeTabId) localStorage.setItem(`ide-active-tab-${serverId}`, activeTabId);
    else localStorage.removeItem(`ide-active-tab-${serverId}`);
  }, [activeTabId, serverId]);

  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [consoleHeight, setConsoleHeight] = useState(200);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [currentDirectory, setCurrentDirectory] = useState('/');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const mainColRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'sidebar' | 'console' | null>(null);

  // ── Resize handlers ──
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      if (dragging.current === 'sidebar' && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setSidebarWidth(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, e.clientX - rect.left)));
      }
      if (dragging.current === 'console' && mainColRef.current) {
        const rect = mainColRef.current.getBoundingClientRect();
        const fromBottom = rect.bottom - e.clientY;
        const maxConsole = rect.height - 120;
        setConsoleHeight(Math.max(MIN_CONSOLE, Math.min(maxConsole, fromBottom)));
      }
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = null;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const onSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = 'sidebar';
    document.body.style.cursor = 'col-resize';
  };
  const onConsoleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = 'console';
    document.body.style.cursor = 'row-resize';
  };

  // ── Tab management ──
  const openFile = useCallback((file: IdeFile, pendingLine?: number) => {
    setTabs((prev) => {
      const ex = prev.find((t) => t.path === file.path);
      if (ex) {
        if (pendingLine) {
          setActiveTabId(ex.id);
          return prev.map((t) => (t.id === ex.id ? { ...t, pendingLine } : t));
        }
        setActiveTabId(ex.id);
        return prev;
      }
      const t: IdeTab = {
        id: `tab-${Date.now()}`,
        name: file.name,
        path: file.path,
        content: null,
        isDirty: false,
        isLoading: true,
        pendingLine,
      };
      setActiveTabId(t.id);
      return [...prev, t];
    });
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) setActiveTabId(next[Math.max(0, idx - 1)]?.id ?? null);
        return next;
      });
    },
    [activeTabId]
  );

  const updateTabContent = useCallback(
    (id: string, content: string) =>
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content, isDirty: true } : t))),
    []
  );

  const markTabSaved = useCallback(
    (id: string) => setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t))),
    []
  );

  const setTabContent = useCallback(
    (id: string, content: string | null) =>
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content, isLoading: false } : t))),
    []
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const consoleActualHeight = consoleOpen ? consoleHeight : 28;

  return (
    <>
      {isIdeMode && (
        <div ref={rootRef} className='ide-root'>
          <aside className='ide-sidebar' style={{ width: sidebarWidth }}>
            <FileTreeSidebar
              currentDirectory={currentDirectory}
              onDirectoryChange={setCurrentDirectory}
              onOpenFile={openFile}
              activeFilePath={activeTab?.path ?? null}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </aside>

          <div className='ide-resizer ide-resizer--col' onMouseDown={onSidebarResize} />

          <main ref={mainColRef} className='ide-main-col'>
            <div
              className='ide-editor-region'
              style={{
                height: `calc(100% - ${consoleActualHeight}px - 1px)`,
              }}
            >
              <FileEditorTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onSelectTab={setActiveTabId}
                onCloseTab={closeTab}
                onUpdateContent={updateTabContent}
                onSaved={markTabSaved}
                onTabContentLoaded={setTabContent}
                onToggleMode={() => setIsIdeMode(false)}
              />
            </div>

            {consoleOpen && <div className='ide-resizer ide-resizer--row' onMouseDown={onConsoleResize} />}

            <div className='ide-console-region' style={{ height: consoleActualHeight }}>
              <div className='ide-console-header'>
                <div className='ide-console-header__tabs'>
                  <span className='ide-console-header__tab ide-console-header__tab--active'>TERMINAL</span>
                </div>
                <div className='ide-console-header__actions'>
                  <button
                    className='ide-console-header__btn'
                    onClick={() => setConsoleOpen((v) => !v)}
                    title={consoleOpen ? 'Collapse' : 'Expand'}
                  >
                    <i className={`bi ${consoleOpen ? 'bi-chevron-down' : 'bi-chevron-up'}`}></i>
                  </button>
                </div>
              </div>
              {consoleOpen && (
                <div className='ide-console-body'>
                  <IdeConsole />
                </div>
              )}
            </div>
          </main>

          {isSettingsOpen && <IdeSettings onClose={() => setIsSettingsOpen(false)} />}
          {isSearchOpen && (
            <IdeSearch
              onClose={() => setIsSearchOpen(false)}
              onOpenFile={openFile}
              currentDirectory={currentDirectory}
            />
          )}
        </div>
      )}

      {!isIdeMode && (
        <div>
          <div className='ide-switch-btn-wrap'>
            <button className='ide-switch-btn' onClick={() => setIsIdeMode(true)}>
              <i className='bi bi-code-slash'></i>
              Ouvrir l'éditeur IDE
            </button>
          </div>
          {children}
        </div>
      )}
    </>
  );
};

export default IdeFileManager;
