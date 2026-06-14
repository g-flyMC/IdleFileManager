import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  IdeFile,
  IdeDirectoryEntry,
  IdeTreeEntry,
  getFileIconClass,
} from "./ide-types";
import http from "@/api/http";
import { useParams } from "react-router-dom";

interface Props {
  currentDirectory: string;
  onDirectoryChange: (dir: string) => void;
  onOpenFile: (file: IdeFile) => void;
  activeFilePath: string | null;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

const FileTreeSidebar: React.FC<Props> = ({
  currentDirectory,
  onDirectoryChange,
  onOpenFile,
  activeFilePath,
  onOpenSearch,
  onOpenSettings,
}) => {
  const { id: serverId } = useParams<{ id: string }>();
  const [tree, setTree] = useState<IdeTreeEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/"]));
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: IdeTreeEntry;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState<{
    type: "file" | "dir";
    parentPath: string;
  } | null>(null);
  const [createValue, setCreateValue] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── API helpers ──────────────────────────────────────────────────────────
  const fetchDirectory = useCallback(
    async (path: string): Promise<IdeTreeEntry[]> => {
      try {
        const { data } = await http.get(
          `/api/client/servers/${serverId}/files/list`,
          { params: { directory: path } },
        );
        const items = (data.data ?? []).map(
          (f: any): IdeTreeEntry => ({
            name: f.attributes.name,
            path:
              path === "/"
                ? `/${f.attributes.name}`
                : `${path}/${f.attributes.name}`,
            isDirectory: f.attributes.is_file === false,
            size: f.attributes.size,
            modifiedAt: f.attributes.modified_at,
            ...(f.attributes.is_file === false
              ? { children: undefined, isExpanded: false }
              : {}),
          }),
        );

        // Sort: directories first, then alphabetical
        return items.sort((a: IdeTreeEntry, b: IdeTreeEntry) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });
      } catch {
        return [];
      }
    },
    [serverId],
  );

  const refreshDirectory = useCallback(
    async (path: string) => {
      setLoading((prev) => new Set(prev).add(path));
      const children = await fetchDirectory(path);
      if (path === "/") {
        setTree(children);
      } else {
        const inject = (nodes: IdeTreeEntry[]): IdeTreeEntry[] =>
          nodes.map((n) => {
            if (!n.isDirectory) return n;
            if (n.path === path) return { ...n, children };
            if (n.children) return { ...n, children: inject(n.children) };
            return n;
          });
        setTree((prev) => inject(prev));
      }
      setLoading((prev) => {
        const s = new Set(prev);
        s.delete(path);
        return s;
      });
    },
    [fetchDirectory],
  );

  useEffect(() => {
    refreshDirectory("/");
  }, [refreshDirectory]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const h = () => setContextMenu(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [contextMenu]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const toggleDir = useCallback(
    async (entry: IdeDirectoryEntry) => {
      const open = expanded.has(entry.path);
      if (open) {
        setExpanded((prev) => {
          const s = new Set(prev);
          s.delete(entry.path);
          return s;
        });
        return;
      }
      setExpanded((prev) => new Set(prev).add(entry.path));
      if (!entry.children) await refreshDirectory(entry.path);
    },
    [expanded, refreshDirectory],
  );

  const openFile = useCallback(
    (file: IdeFile) => onOpenFile({ ...file, content: undefined }),
    [onOpenFile],
  );

  const submitRename = async (entry: IdeTreeEntry, name: string) => {
    setRenaming(null);
    if (!name || name === entry.name) return;
    const parent = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
    try {
      await http.put(`/api/client/servers/${serverId}/files/rename`, {
        root: parent,
        files: [{ from: entry.name, to: name }],
      });
      await refreshDirectory(parent);
    } catch {
      window.alert("Rename failed.");
    }
  };

  const submitCreate = async () => {
    if (!creating || !createValue) {
      setCreating(null);
      return;
    }
    try {
      if (creating.type === "dir") {
        await http.post(`/api/client/servers/${serverId}/files/create-folder`, {
          root: creating.parentPath,
          name: createValue,
        });
      } else {
        const full =
          creating.parentPath === "/"
            ? `/${createValue}`
            : `${creating.parentPath}/${createValue}`;
        await http.post(`/api/client/servers/${serverId}/files/write`, "", {
          params: { file: full },
          headers: { "Content-Type": "text/plain" },
        });
      }
      if (!expanded.has(creating.parentPath))
        setExpanded((prev) => new Set(prev).add(creating.parentPath));
      await refreshDirectory(creating.parentPath);
    } catch {
      window.alert("Creation failed.");
    }
    setCreating(null);
    setCreateValue("");
  };

  const deleteItem = async (entry: IdeTreeEntry) => {
    if (!window.confirm(`Delete "${entry.name}"?`)) return;
    const parent = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
    try {
      await http.post(`/api/client/servers/${serverId}/files/delete`, {
        root: parent,
        files: [entry.name],
      });
      await refreshDirectory(parent);
    } catch {
      window.alert("Delete failed.");
    }
  };

  const startCreate = (type: "file" | "dir") => {
    setCreating({ type, parentPath: currentDirectory });
    setCreateValue("");
    if (!expanded.has(currentDirectory))
      setExpanded((prev) => new Set(prev).add(currentDirectory));
  };

  // ── Flatten tree ──────────────────────────────────────────────────────────
  const flatten = useCallback(
    (
      nodes: IdeTreeEntry[],
      depth = 0,
    ): Array<IdeTreeEntry & { depth: number }> => {
      const out: Array<IdeTreeEntry & { depth: number }> = [];
      for (const n of nodes) {
        out.push({ ...n, depth });
        if (n.isDirectory && expanded.has(n.path) && n.children)
          out.push(...flatten(n.children, depth + 1));
      }
      return out;
    },
    [expanded],
  );

  const flatNodes = flatten(tree).filter(
    (n) => search === "" || n.name.toLowerCase().includes(search.toLowerCase()),
  );

  const breadcrumbs = currentDirectory
    .split("/")
    .filter(Boolean)
    .reduce<{ label: string; path: string }[]>(
      (acc, seg, i, arr) => [
        ...acc,
        { label: seg, path: "/" + arr.slice(0, i + 1).join("/") },
      ],
      [{ label: "~", path: "/" }],
    );

  const createIconClass = (type: "file" | "dir") =>
    type === "dir" ? "bi bi-folder-fill" : "bi bi-file-earmark";

  return (
    <div ref={sidebarRef} className="ide-sidebar__inner">
      {/* Header */}
      <div className="ide-sidebar__header">
        <span className="ide-sidebar__title">EXPLORER</span>
        <div className="ide-sidebar__actions">
          <button
            className="ide-sidebar__action-btn"
            title="Global Search"
            onClick={onOpenSearch}
          >
            <i className="bi bi-search"></i>
          </button>
          <button
            className="ide-sidebar__action-btn"
            title="Settings"
            onClick={onOpenSettings}
          >
            <i className="bi bi-gear"></i>
          </button>
          <span
            style={{
              borderLeft: "1px solid var(--ide-border)",
              margin: "0 2px",
              height: "12px",
            }}
          ></span>
          <button
            className="ide-sidebar__action-btn"
            title="New file"
            onClick={() => startCreate("file")}
          >
            <i className="bi bi-file-earmark-plus"></i>
          </button>
          <button
            className="ide-sidebar__action-btn"
            title="New folder"
            onClick={() => startCreate("dir")}
          >
            <i className="bi bi-folder-plus"></i>
          </button>
          <button
            className="ide-sidebar__action-btn"
            title="Refresh"
            onClick={() => refreshDirectory(currentDirectory)}
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="ide-sidebar__search-wrap">
        <i className="bi bi-search ide-sidebar__search-icon"></i>
        <input
          className="ide-sidebar__search"
          type="text"
          placeholder="Filter files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="ide-sidebar__search-clear"
            onClick={() => setSearch("")}
          >
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="ide-sidebar__breadcrumbs">
        {breadcrumbs.map((bc, i) => (
          <React.Fragment key={bc.path}>
            <button
              className="ide-sidebar__bc-seg"
              onClick={() => onDirectoryChange(bc.path)}
            >
              {bc.label}
            </button>
            {i < breadcrumbs.length - 1 && (
              <span className="ide-sidebar__bc-sep">/</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Tree */}
      <div className="ide-sidebar__tree">
        {/* Create input at root */}
        {creating?.parentPath === "/" && (
          <div className="ide-tree-row" style={{ paddingLeft: 24 }}>
            <i
              className={`ide-tree-icon ${createIconClass(creating.type)}`}
            ></i>
            <input
              autoFocus
              className="ide-tree-input"
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              onBlur={submitCreate}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") setCreating(null);
              }}
            />
          </div>
        )}

        {loading.has("/") && flatNodes.length === 0 ? (
          <div className="ide-sidebar__empty">
            <span className="ide-spinner" /> Loading…
          </div>
        ) : flatNodes.length === 0 && !creating ? (
          <div className="ide-sidebar__empty">Empty folder</div>
        ) : (
          flatNodes.map((node) => (
            <React.Fragment key={node.path}>
              <div
                className={[
                  "ide-tree-row",
                  activeFilePath === node.path ? "ide-tree-row--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ paddingLeft: 8 + node.depth * 16 }}
                onClick={() => {
                  if (renaming === node.path) return;
                  if (node.isDirectory) {
                    toggleDir(node as IdeDirectoryEntry);
                    onDirectoryChange(node.path);
                  } else openFile(node as IdeFile);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    entry: node,
                  });
                }}
                title={node.path}
              >
                {node.isDirectory && (
                  <span
                    className={`ide-tree-chevron${expanded.has(node.path) ? " ide-tree-chevron--open" : ""}`}
                  >
                    ›
                  </span>
                )}

                {loading.has(node.path) ? (
                  <span className="ide-spinner ide-spinner--sm" />
                ) : (
                  <i className={`ide-tree-icon ${getFileIconClass(node)}`}></i>
                )}

                {renaming === node.path ? (
                  <input
                    autoFocus
                    className="ide-tree-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(node, renameValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(node, renameValue);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="ide-tree-name">{node.name}</span>
                )}

                {!node.isDirectory &&
                  (node as IdeFile).size !== undefined &&
                  renaming !== node.path && (
                    <span className="ide-tree-size">
                      {formatBytes((node as IdeFile).size!)}
                    </span>
                  )}
              </div>

              {/* Create input under directory */}
              {creating?.parentPath === node.path &&
                expanded.has(node.path) && (
                  <div
                    className="ide-tree-row"
                    style={{
                      paddingLeft: 8 + (node.depth + 1) * 16,
                    }}
                  >
                    <i
                      className={`ide-tree-icon ${createIconClass(creating.type)}`}
                    ></i>
                    <input
                      autoFocus
                      className="ide-tree-input"
                      value={createValue}
                      onChange={(e) => setCreateValue(e.target.value)}
                      onBlur={submitCreate}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitCreate();
                        if (e.key === "Escape") setCreating(null);
                      }}
                    />
                  </div>
                )}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="ide-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.entry.isDirectory && (
            <button
              className="ide-context-menu__item"
              onClick={() => {
                openFile(contextMenu.entry as IdeFile);
                setContextMenu(null);
              }}
            >
              <i className="bi bi-box-arrow-up-right"></i> Open
            </button>
          )}
          <button
            className="ide-context-menu__item"
            onClick={() => {
              setCreating({
                type: "file",
                parentPath: contextMenu.entry.isDirectory
                  ? contextMenu.entry.path
                  : contextMenu.entry.path.substring(
                      0,
                      contextMenu.entry.path.lastIndexOf("/"),
                    ) || "/",
              });
              setCreateValue("");
              setContextMenu(null);
            }}
          >
            <i className="bi bi-file-earmark-plus"></i> New file here
          </button>
          <button
            className="ide-context-menu__item"
            onClick={() => {
              setCreating({
                type: "dir",
                parentPath: contextMenu.entry.isDirectory
                  ? contextMenu.entry.path
                  : contextMenu.entry.path.substring(
                      0,
                      contextMenu.entry.path.lastIndexOf("/"),
                    ) || "/",
              });
              setCreateValue("");
              setContextMenu(null);
            }}
          >
            <i className="bi bi-folder-plus"></i> New folder here
          </button>
          <button
            className="ide-context-menu__item"
            onClick={() => {
              setRenaming(contextMenu.entry.path);
              setRenameValue(contextMenu.entry.name);
              setContextMenu(null);
            }}
          >
            <i className="bi bi-pencil"></i> Rename
          </button>
          <button
            className="ide-context-menu__item"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.entry.path);
              setContextMenu(null);
            }}
          >
            <i className="bi bi-clipboard"></i> Copy path
          </button>
          <hr
            style={{
              margin: "3px 0",
              border: "none",
              borderTop: "1px solid var(--ide-border)",
            }}
          />
          <button
            className="ide-context-menu__item ide-context-menu__item--danger"
            onClick={() => {
              deleteItem(contextMenu.entry);
              setContextMenu(null);
            }}
          >
            <i className="bi bi-trash3"></i> Delete
          </button>
        </div>
      )}
    </div>
  );
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}K`;
  return `${(b / (1024 * 1024)).toFixed(1)}M`;
}

export default FileTreeSidebar;
