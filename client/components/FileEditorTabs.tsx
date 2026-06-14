import React, { useEffect, useRef, useCallback, useState } from 'react';
import { IdeTab, getLanguage, isBinaryFile, getBinaryTypeLabel, isImage, isVideo } from './ide-types';
import http from '@/api/http';
import { useParams } from 'react-router-dom';

declare global {
  interface Window {
    monaco: any;
  }
}

interface Props {
  tabs: IdeTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onSaved: (id: string) => void;
  onTabContentLoaded: (id: string, content: string | null) => void;
  onToggleMode: () => void;
}

const MediaViewer: React.FC<{
  serverId: string;
  path: string;
  fileName: string;
}> = ({ serverId, path, fileName }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    http
      .get(`/api/client/servers/${serverId}/files/download`, {
        params: { file: path },
      })
      .then((res) => setUrl(res.data.attributes?.url ?? res.data.data?.url ?? res.data.url ?? res.data))
      .catch(() => setUrl('error'));
  }, [serverId, path]);
  if (!url)
    return (
      <div className='ide-editor-loading'>
        <span className='ide-spinner' />
        <span>Loading media…</span>
      </div>
    );
  if (url === 'error') return <div className='ide-editor-incompatible'>Failed to load media URL.</div>;
  if (isVideo(fileName)) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111',
        }}
      >
        <video
          src={url}
          controls
          style={{
            maxWidth: '90%',
            maxHeight: '90%',
            outline: 'none',
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111',
        overflow: 'auto',
        padding: '20px',
      }}
    >
      <img
        src={url}
        alt={fileName}
        style={{
          maxWidth: '100%',
          objectFit: 'contain',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
};

const MONACO_CDN = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs';
const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/';

const LANG_MAP: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  json: 'json',
  yaml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  php: 'php',
  python: 'python',
  bash: 'shell',
  ini: 'ini',
  properties: 'ini',
  markdown: 'markdown',
  plaintext: 'plaintext',
  java: 'java',
  lua: 'lua',
  sql: 'sql',
  toml: 'ini',
  dockerfile: 'dockerfile',
  rust: 'rust',
  go: 'go',
  csharp: 'csharp',
  cpp: 'cpp',
};

let monacoReady: Promise<void> | null = null;
function loadMonaco(): Promise<void> {
  if (monacoReady) return monacoReady;
  monacoReady = new Promise<void>((resolve, reject) => {
    if ((window as any).monaco) {
      resolve();
      return;
    }
    (window as any).MonacoEnvironment = {
      getWorkerUrl(_: string, _label: string) {
        const workerUrl = `${MONACO_CDN}/base/worker/workerMain.js`;
        const blob = new Blob([`self.MonacoEnvironment={baseUrl:'${MONACO_BASE}'};importScripts('${workerUrl}');`], {
          type: 'application/javascript',
        });
        return URL.createObjectURL(blob);
      },
    };
    const s = document.createElement('script');
    s.src = `${MONACO_CDN}/loader.js`;
    s.onload = () => {
      const amd = (window as any).require;
      amd.config({ paths: { vs: MONACO_CDN } });
      amd(['vs/editor/editor.main'], () => resolve(), reject);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return monacoReady;
}

const FileEditorTabs: React.FC<Props> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onUpdateContent,
  onSaved,
  onTabContentLoaded,
  onToggleMode,
}) => {
  const { id: serverId } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const models = useRef<Map<string, any>>(new Map());
  const suppressChange = useRef(false);

  const [ready, setReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [theme, setTheme] = useState('vs-dark');

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // ── 1. Load Monaco ──
  useEffect(() => {
    loadMonaco()
      .then(() => setReady(true))
      .catch(console.error);
  }, []);

  // ── 2. Create editor once ──
  useEffect(() => {
    if (!ready || !containerRef.current || editorRef.current) return;
    const monaco = (window as any).monaco;
    const editor = monaco.editor.create(containerRef.current, {
      theme,
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: { top: 12, bottom: 12 },
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    });
    editorRef.current = editor;
    editor.onDidChangeModelContent(() => {
      if (suppressChange.current) return;
      const tabId = (editor as any).__tabId as string | undefined;
      if (tabId) onUpdateContent(tabId, editor.getValue());
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => doSave());
    return () => {
      models.current.forEach((m) => m.dispose());
      editor.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── 3. Switch model on tab change ──
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready || !activeTab) return;
    if (activeTab.isLoading || activeTab.content === null) return;
    const monaco = (window as any).monaco;
    const lang = LANG_MAP[getLanguage(activeTab.name)] ?? 'plaintext';
    let model = models.current.get(activeTab.path);
    if (!model) {
      model = monaco.editor.createModel(activeTab.content, lang);
      models.current.set(activeTab.path, model);
    } else {
      if (model.getValue() !== activeTab.content) {
        suppressChange.current = true;
        model.setValue(activeTab.content);
        suppressChange.current = false;
      }
      monaco.editor.setModelLanguage(model, lang);
    }
    (editor as any).__tabId = activeTab.id;
    if (editor.getModel() !== model) editor.setModel(model);
  }, [activeTab?.id, activeTab?.isLoading, activeTab?.content, ready]);

  // Theme change
  useEffect(() => {
    if (!ready) return;
    (window as any).monaco?.editor.setTheme(theme);
  }, [theme, ready]);

  // Dispose closed tab models
  useEffect(() => {
    const open = new Set(tabs.map((t) => t.path));
    models.current.forEach((m, path) => {
      if (!open.has(path)) {
        m.dispose();
        models.current.delete(path);
      }
    });
  }, [tabs]);

  // ── 4. Load file content ──
  useEffect(() => {
    if (!activeTab?.isLoading) return;
    if (isBinaryFile(activeTab.name)) {
      onTabContentLoaded(activeTab.id, null);
      return;
    }
    http
      .get(`/api/client/servers/${serverId}/files/contents`, {
        params: { file: activeTab.path },
        responseType: 'text',
        transformResponse: [(d) => d],
      })
      .then(({ data }) => {
        onTabContentLoaded(activeTab.id, data as unknown as string);
      })
      .catch(() => {
        onTabContentLoaded(activeTab.id, `// Error loading file: ${activeTab.path}`);
      });
  }, [activeTab?.id, activeTab?.isLoading]);

  useEffect(() => {
    setSaveStatus('idle');
  }, [activeTabId]);

  // ── 5. Save ──
  const doSave = useCallback(async () => {
    const tab = activeTab;
    if (!tab || isBinaryFile(tab.name)) return;
    const content = editorRef.current?.getValue() ?? tab.content ?? '';
    setIsSaving(true);
    try {
      await http.post(`/api/client/servers/${serverId}/files/write`, content, {
        params: { file: tab.path },
        headers: { 'Content-Type': 'text/plain' },
      });
      onSaved(tab.id);
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('err');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, serverId, onSaved]);

  const handleTabMouse = (e: React.MouseEvent, id: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onCloseTab(id);
    }
  };

  const lang = activeTab ? getLanguage(activeTab.name) : 'plaintext';
  const isBinary = activeTab ? isBinaryFile(activeTab.name) : false;
  const lineCount = activeTab?.content?.split('\n').length ?? 0;
  const showEditor = activeTab && !activeTab.isLoading && !isBinary;

  return (
    <div className='ide-editor-panel'>
      {/* ── Tab bar ── */}
      {tabs.length > 0 ? (
        <div className='ide-tabbar'>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={[
                'ide-tab',
                tab.id === activeTabId ? 'ide-tab--active' : '',
                tab.isDirty ? 'ide-tab--dirty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectTab(tab.id)}
              onMouseDown={(e) => handleTabMouse(e, tab.id)}
              title={tab.path}
            >
              <span className='ide-tab__name'>{tab.name}</span>
              {tab.isDirty && <span className='ide-tab__dot' />}
              <button
                className='ide-tab__close'
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                title='Close'
              >
                <i className='bi bi-x'></i>
              </button>
            </div>
          ))}
          <div className='ide-tabbar__spacer' />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 12px',
              borderLeft: '1px solid var(--ide-border)',
            }}
          >
            <button
              className='ide-statusbar__save-btn'
              onClick={onToggleMode}
              style={{
                background: 'var(--ide-panel-bg)',
                border: '1px solid var(--ide-border)',
                marginRight: '8px',
              }}
              title='Switch to Classic Mode'
            >
              <i className='bi bi-box-arrow-right'></i>
            </button>
            <button
              className='ide-statusbar__save-btn'
              onClick={() =>
                http.post(`/api/client/servers/${serverId}/power`, {
                  signal: 'start',
                })
              }
              style={{
                background: 'rgba(78,201,148,.2)',
                color: '#4ec994',
              }}
              title='Start Server'
            >
              <i className='bi bi-play-fill'></i>
            </button>
            <button
              className='ide-statusbar__save-btn'
              onClick={() =>
                http.post(`/api/client/servers/${serverId}/power`, {
                  signal: 'restart',
                })
              }
              style={{
                background: 'rgba(52,101,164,.2)',
                color: '#729fcf',
              }}
              title='Restart Server'
            >
              <i className='bi bi-arrow-clockwise'></i>
            </button>
            <button
              className='ide-statusbar__save-btn'
              onClick={() =>
                http.post(`/api/client/servers/${serverId}/power`, {
                  signal: 'stop',
                })
              }
              style={{
                background: 'rgba(244,135,113,.2)',
                color: '#f48771',
              }}
              title='Stop Server'
            >
              <i className='bi bi-stop-fill'></i>
            </button>
          </div>
        </div>
      ) : (
        <div className='ide-tabbar'>
          <span className='ide-tabbar__hint'>Open a file from the explorer to start editing</span>
          <div className='ide-tabbar__spacer' />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 12px',
              borderLeft: '1px solid var(--ide-border)',
            }}
          >
            <button
              className='ide-statusbar__save-btn'
              onClick={onToggleMode}
              style={{
                background: 'var(--ide-panel-bg)',
                border: '1px solid var(--ide-border)',
                marginRight: '8px',
              }}
              title='Switch to Classic Mode'
            >
              <i className='bi bi-box-arrow-right'></i>
            </button>
            <button
              className='ide-statusbar__save-btn'
              onClick={() =>
                http.post(`/api/client/servers/${serverId}/power`, {
                  signal: 'start',
                })
              }
              style={{
                background: 'rgba(78,201,148,.2)',
                color: '#4ec994',
              }}
              title='Start Server'
            >
              <i className='bi bi-play-fill'></i>
            </button>
            <button
              className='ide-statusbar__save-btn'
              onClick={() =>
                http.post(`/api/client/servers/${serverId}/power`, {
                  signal: 'restart',
                })
              }
              style={{
                background: 'rgba(52,101,164,.2)',
                color: '#729fcf',
              }}
              title='Restart Server'
            >
              <i className='bi bi-arrow-clockwise'></i>
            </button>
            <button
              className='ide-statusbar__save-btn'
              onClick={() =>
                http.post(`/api/client/servers/${serverId}/power`, {
                  signal: 'stop',
                })
              }
              style={{
                background: 'rgba(244,135,113,.2)',
                color: '#f48771',
              }}
              title='Stop Server'
            >
              <i className='bi bi-stop-fill'></i>
            </button>
          </div>
        </div>
      )}

      {/* ── Editor area ── */}
      <div className='ide-editor-area'>
        <div ref={containerRef} className='ide-monaco-container' style={{ display: showEditor ? 'block' : 'none' }} />
        {!activeTab && (
          <div className='ide-editor-welcome'>
            <div className='ide-editor-welcome__inner'>
              <i className='bi bi-code-slash ide-editor-welcome__icon'></i>
              <p className='ide-editor-welcome__title'>No file open</p>
              <p className='ide-editor-welcome__sub'>Select a file from the explorer on the left.</p>
            </div>
          </div>
        )}
        {activeTab?.isLoading && (
          <div className='ide-editor-loading'>
            <span className='ide-spinner ide-spinner--lg' />
            <span>Loading {activeTab.name}…</span>
          </div>
        )}
        {activeTab && !activeTab.isLoading && isBinary && (isImage(activeTab.name) || isVideo(activeTab.name)) && (
          <MediaViewer serverId={serverId!} path={activeTab.path} fileName={activeTab.name} />
        )}
        {activeTab && !activeTab.isLoading && isBinary && !isImage(activeTab.name) && !isVideo(activeTab.name) && (
          <div className='ide-editor-incompatible'>
            <i className='bi bi-file-earmark-binary ide-editor-incompatible__icon'></i>
            <h2 className='ide-editor-incompatible__title'>Binary file</h2>
            <p className='ide-editor-incompatible__desc'>
              <strong>{activeTab.name}</strong> is a binary file ({getBinaryTypeLabel(activeTab.name)}) and cannot be
              displayed.
            </p>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {activeTab && (
        <div className='ide-statusbar'>
          <span className='ide-statusbar__path'>{activeTab.path}</span>
          <div className='ide-statusbar__right'>
            {saveStatus === 'ok' && <span className='ide-statusbar__badge ide-statusbar__badge--ok'>Saved</span>}
            {saveStatus === 'err' && (
              <span className='ide-statusbar__badge ide-statusbar__badge--err'>Save failed</span>
            )}
            {activeTab.isDirty && !isBinary && (
              <button className='ide-statusbar__save-btn' onClick={doSave} disabled={isSaving}>
                <i className='bi bi-floppy'></i>
                {isSaving ? ' Saving…' : ' Save  Ctrl+S'}
              </button>
            )}
            <span className='ide-statusbar__lang'>{lang}</span>
            {!isBinary && (
              <span className='ide-statusbar__lines'>
                {lineCount} {lineCount === 1 ? 'line' : 'lines'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileEditorTabs;
