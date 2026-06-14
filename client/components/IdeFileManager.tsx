import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import FileTreeSidebar from './FileTreeSidebar';
import FileEditorTabs from './FileEditorTabs';
import IdeConsole from './IdeConsole';
import IdeSettings from './IdeSettings';
import IdeSearch from './IdeSearch';
import { IdeTab, IdeFile, applyTheme } from './ide-types';

interface Props {
  children?: React.ReactNode;
}

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 600;
const MIN_CONSOLE = 80;

function getOffsets(): { left: number; top: number } {
  let left = 0;
  let top = 0;
  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.closest('.ide-root')) return;
    const s = window.getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'sticky') return;
    const r = el.getBoundingClientRect();
    if (r.left === 0 && r.width > 20 && r.width < 300 && r.height > window.innerHeight * 0.5)
      left = Math.max(left, r.width);
    if (r.top === 0 && r.width > window.innerWidth * 0.5 && r.height > 20 && r.height < 120)
      top = Math.max(top, r.height);
  });
  return { left: Math.round(left), top: Math.round(top) };
}

const IdeFileManager: React.FC<Props> = () => {
  const { id: serverId } = useParams<{ id: string }>();
  const history = useHistory();

  const goToFiles = () => history.push(`/server/${serverId}/files`);

  useEffect(() => {
    const rounded = localStorage.getItem('ide-rounded-corners') !== 'false';
    document.documentElement.style.setProperty('--ide-radius', rounded ? '8px' : '0px');
    applyTheme(localStorage.getItem('ide-theme') || 'vs-dark');
    const onThemeChange = () => applyTheme(localStorage.getItem('ide-theme') || 'vs-dark');
    window.addEventListener('ide-theme-change', onThemeChange);
    return () => window.removeEventListener('ide-theme-change', onThemeChange);
  }, []);

  useEffect(() => {
    const apply = () => {
      const { left, top } = getOffsets();
      document.documentElement.style.setProperty('--ide-left-offset', `${left}px`);
      document.documentElement.style.setProperty('--ide-nav-top', `${top}px`);
    };
    apply();
    const t = setTimeout(apply, 200);
    window.addEventListener('resize', apply);
    const obs = new MutationObserver(apply);
    obs.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['style', 'class'] });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', apply);
      obs.disconnect();
    };
  }, []);

  const [tabs, setTabs] = useState<IdeTab[]>(() => {
    try {
      const cached = localStorage.getItem(`ide-tabs-${serverId}`);
      if (cached)
        return JSON.parse(cached).map((t: any) => ({ ...t, content: null, isLoading: true, isDirty: false }));
    } catch {}
    return [];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => localStorage.getItem(`ide-active-tab-${serverId}`) || null
  );

  useEffect(() => {
    localStorage.setItem(`ide-tabs-${serverId}`, JSON.stringify(tabs.map((t) => ({ id: t.id, name: t.name, path: t.path, pendingLine: t.pendingLine }))));
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

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      if (dragging.current === 'sidebar' && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setSidebarWidth(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, e.clientX - rect.left)));
      }
      if (dragging.current === 'console' && mainColRef.current) {
        const rect = mainColRef.current.getBoundingClientRect();
        setConsoleHeight(Math.max(MIN_CONSOLE, Math.min(rect.height - 120, rect.bottom - e.clientY)));
      }
    };
    const up = () => { if (dragging.current) { dragging.current = null; document.body.style.cursor = ''; } };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const openFile = useCallback((file: IdeFile, pendingLine?: number) => {
    setTabs((prev) => {
      const ex = prev.find((t) => t.path === file.path);
      if (ex) { setActiveTabId(ex.id); return pendingLine ? prev.map((t) => (t.id === ex.id ? { ...t, pendingLine } : t)) : prev; }
      const t: IdeTab = { id: `tab-${Date.now()}`, name: file.name, path: file.path, content: null, isDirty: false, isLoading: true, pendingLine };
      setActiveTabId(t.id);
      return [...prev, t];
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) setActiveTabId(next[Math.max(0, idx - 1)]?.id ?? null);
      return next;
    });
  }, [activeTabId]);

  const updateTabContent = useCallback((id: string, content: string) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content, isDirty: true } : t))), []);

  const markTabSaved = useCallback((id: string) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t))), []);

  const setTabContent = useCallback((id: string, content: string | null) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content, isLoading: false } : t))), []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const consoleActualHeight = consoleOpen ? consoleHeight : 28;

  return (
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

      <div className='ide-resizer ide-resizer--col' onMouseDown={(e) => { e.preventDefault(); dragging.current = 'sidebar'; document.body.style.cursor = 'col-resize'; }} />

      <main ref={mainColRef} className='ide-main-col'>
        <div className='ide-editor-region' style={{ height: `calc(100% - ${consoleActualHeight}px - 1px)` }}>
          <FileEditorTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={closeTab}
            onUpdateContent={updateTabContent}
            onSaved={markTabSaved}
            onTabContentLoaded={setTabContent}
            onToggleMode={goToFiles}
          />
        </div>

        {consoleOpen && <div className='ide-resizer ide-resizer--row' onMouseDown={(e) => { e.preventDefault(); dragging.current = 'console'; document.body.style.cursor = 'row-resize'; }} />}

        <div className='ide-console-region' style={{ height: consoleActualHeight }}>
          <div className='ide-console-header'>
            <div className='ide-console-header__tabs'>
              <span className='ide-console-header__tab ide-console-header__tab--active'>TERMINAL</span>
            </div>
            <div className='ide-console-header__actions'>
              <button className='ide-console-header__btn' onClick={() => setConsoleOpen((v) => !v)}>
                <i className={`bi ${consoleOpen ? 'bi-chevron-down' : 'bi-chevron-up'}`}></i>
              </button>
            </div>
          </div>
          {consoleOpen && <div className='ide-console-body'><IdeConsole /></div>}
        </div>
      </main>

      {isSettingsOpen && <IdeSettings onClose={() => setIsSettingsOpen(false)} />}
      {isSearchOpen && <IdeSearch onClose={() => setIsSearchOpen(false)} onOpenFile={openFile} currentDirectory={currentDirectory} />}
    </div>
  );
};

export default IdeFileManager;
