import React, { useState, useRef, useCallback } from "react";
import { IdeFile } from "./ide-types";
import { useParams } from "react-router-dom";
import http from "@/api/http";

interface Props {
  onClose: () => void;
  onOpenFile: (file: IdeFile, line?: number) => void;
  currentDirectory: string;
}

interface SearchResult {
  name: string;
  path: string;
  line?: number;
  lineContent?: string;
  isDirectory: boolean;
}

const MAX_FILES = 2000;

const IdeSearch: React.FC<Props> = ({
  onClose,
  onOpenFile,
  currentDirectory,
}) => {
  const { id: serverId } = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"filename" | "content">("filename");
  const [targetDir, setTargetDir] = useState(currentDirectory || "/");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [scanned, setScanned] = useState(0);
  const abortRef = useRef(false);

  const stopSearch = () => {
    abortRef.current = true;
  };

  // Recursive search engine
  const searchDir = useCallback(
    async (
      dir: string,
      q: string,
      searchMode: "filename" | "content",
      totalScanned: { count: number },
      found: SearchResult[],
      addResult: (r: SearchResult) => void,
    ): Promise<void> => {
      if (abortRef.current || totalScanned.count > MAX_FILES) return;

      let entries: any[] = [];
      try {
        const { data } = await http.get(
          `/api/client/servers/${serverId}/files/list`,
          {
            params: { directory: dir },
          },
        );
        entries = data.data ?? [];
      } catch {
        return;
      }

      const subDirs: string[] = [];

      for (const entry of entries) {
        if (abortRef.current || totalScanned.count > MAX_FILES) return;

        const entryName: string = entry.attributes.name;
        const isFile: boolean = entry.attributes.is_file !== false;
        const fullPath = dir === "/" ? `/${entryName}` : `${dir}/${entryName}`;

        totalScanned.count++;
        setScanned(totalScanned.count);

        if (!isFile) {
          subDirs.push(fullPath);
          continue;
        }

        if (searchMode === "filename") {
          if (entryName.toLowerCase().includes(q.toLowerCase())) {
            const r = {
              name: entryName,
              path: fullPath,
              isDirectory: false,
            };
            found.push(r);
            addResult(r);
          }
        } else {
          // Content search — only text files
          const ext = entryName.split(".").pop()?.toLowerCase() ?? "";
          const textExts = [
            "txt",
            "log",
            "yml",
            "yaml",
            "json",
            "properties",
            "toml",
            "cfg",
            "conf",
            "ini",
            "sh",
            "bat",
            "js",
            "ts",
            "jsx",
            "tsx",
            "py",
            "java",
            "kt",
            "lua",
            "xml",
            "html",
            "css",
            "md",
          ];
          if (!textExts.includes(ext)) continue;

          try {
            const { data: raw } = await http.get(
              `/api/client/servers/${serverId}/files/contents`,
              {
                params: { file: fullPath },
              },
            );
            const lines = (typeof raw === "string" ? raw : "").split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(q.toLowerCase())) {
                const r = {
                  name: entryName,
                  path: fullPath,
                  line: i + 1,
                  lineContent: lines[i].trim().slice(0, 120),
                  isDirectory: false,
                };
                found.push(r);
                addResult(r);
                break; // One match per file is enough
              }
            }
          } catch {
            /* skip unreadable files */
          }
        }
      }

      // Recurse into subdirectories
      for (const sub of subDirs) {
        if (abortRef.current || totalScanned.count > MAX_FILES) return;
        await searchDir(sub, q, searchMode, totalScanned, found, addResult);
      }
    },
    [serverId],
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    abortRef.current = false;
    setIsSearching(true);
    setResults([]);
    setScanned(0);
    setStatusMsg("Scanning…");

    const totalScanned = { count: 0 };
    const found: SearchResult[] = [];

    const addResult = (r: SearchResult) => {
      setResults((prev) => [...prev, r]);
    };

    const start = Date.now();
    await searchDir(
      targetDir || "/",
      query,
      mode,
      totalScanned,
      found,
      addResult,
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (abortRef.current) {
      setStatusMsg(
        `Stopped — ${found.length} result(s) in ${totalScanned.count} files.`,
      );
    } else if (totalScanned.count > MAX_FILES) {
      setStatusMsg(
        `Limit reached (${MAX_FILES} files). ${found.length} result(s) in ${elapsed}s.`,
      );
    } else {
      setStatusMsg(
        `${found.length} result(s) — ${totalScanned.count} files scanned in ${elapsed}s.`,
      );
    }
    setIsSearching(false);
  };

  return (
    <div className="ide-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ide-modal"
        style={{ width: "640px", maxHeight: "80vh" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ide-modal-header">
          <span className="ide-modal-title">
            <i className="bi bi-search" style={{ marginRight: 8 }}></i>
            Global Search
          </span>
          <button className="ide-modal-close" onClick={onClose}>
            <i className="bi bi-x"></i>
          </button>
        </div>
        <div
          className="ide-modal-body"
          style={{
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
          }}
        >
          {/* Search input */}
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="ide-sidebar__search"
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 13,
              }}
              placeholder={
                mode === "content"
                  ? "Search in file contents…"
                  : "Search file names…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {isSearching ? (
              <button
                type="button"
                className="ide-statusbar__save-btn"
                style={{
                  background: "rgba(244,135,113,.2)",
                  color: "#f48771",
                  padding: "0 14px",
                }}
                onClick={stopSearch}
                title="Stop"
              >
                <i className="bi bi-stop-fill"></i>
              </button>
            ) : (
              <button
                type="submit"
                className="ide-statusbar__save-btn"
                style={{
                  background: "var(--ide-accent)",
                  padding: "0 16px",
                }}
              >
                <i className="bi bi-search"></i>
              </button>
            )}
          </form>

          {/* Options row */}
          <div
            style={{
              display: "flex",
              gap: 16,
              background: "var(--ide-bg)",
              padding: "8px 12px",
              borderRadius: 4,
            }}
          >
            <label
              style={{
                display: "flex",
                gap: 6,
                cursor: "pointer",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <input
                type="radio"
                name="sm"
                checked={mode === "filename"}
                onChange={() => setMode("filename")}
              />
              File Names
            </label>
            <label
              style={{
                display: "flex",
                gap: 6,
                cursor: "pointer",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <input
                type="radio"
                name="sm"
                checked={mode === "content"}
                onChange={() => setMode("content")}
              />
              File Contents
            </label>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ide-text-muted)",
                }}
              >
                Root:
              </span>
              <input
                type="text"
                className="ide-tree-input"
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                style={{ width: 120, fontSize: 12 }}
              />
            </div>
          </div>

          {/* Status */}
          {(isSearching || statusMsg) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                color: "var(--ide-text-muted)",
              }}
            >
              {isSearching && <span className="ide-spinner ide-spinner--sm" />}
              {isSearching
                ? `Scanned ${scanned} files… ${results.length} match(es) found`
                : statusMsg}
            </div>
          )}

          {/* Results */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: 400,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {results.map((r, i) => (
              <div
                key={i}
                className="ide-tree-row"
                style={{
                  padding: "5px 8px",
                  height: "auto",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                onClick={() => {
                  onOpenFile({ name: r.name, path: r.path }, r.line);
                  onClose();
                }}
              >
                <i className="bi bi-file-earmark-code ide-tree-icon"></i>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    gap: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span className="ide-tree-name">{r.name}</span>
                    {r.line && (
                      <span
                        style={{
                          fontSize: 10,
                          background: "var(--ide-active-bg)",
                          padding: "1px 5px",
                          borderRadius: 3,
                          color: "var(--ide-text-muted)",
                        }}
                      >
                        L{r.line}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--ide-text-faint)",
                      fontFamily: "var(--ide-font-mono)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.lineContent ? `"${r.lineContent}"` : r.path}
                  </span>
                </div>
              </div>
            ))}

            {!isSearching && results.length === 0 && query && statusMsg && (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: "var(--ide-text-faint)",
                  fontSize: 12,
                }}
              >
                <i
                  className="bi bi-folder2-open"
                  style={{
                    fontSize: 24,
                    display: "block",
                    marginBottom: 8,
                  }}
                ></i>
                No results found for{" "}
                <strong
                  style={{
                    color: "var(--ide-text-muted)",
                  }}
                >
                  {query}
                </strong>
              </div>
            )}

            {!isSearching && results.length === 0 && !statusMsg && (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: "var(--ide-text-faint)",
                  fontSize: 12,
                }}
              >
                <i
                  className="bi bi-search"
                  style={{
                    fontSize: 24,
                    display: "block",
                    marginBottom: 8,
                  }}
                ></i>
                Enter a search term and press Enter
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeSearch;
