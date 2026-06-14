import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import http from "@/api/http";

// ── ANSI color parser ────────────────────────────────────────────────────────
const ANSI_FG: Record<string, string> = {
  "30": "#4c4c4c",
  "31": "#cc0000",
  "32": "#4e9a06",
  "33": "#c4a000",
  "34": "#3465a4",
  "35": "#75507b",
  "36": "#06989a",
  "37": "#d3d7cf",
  "90": "#555753",
  "91": "#ef2929",
  "92": "#8ae234",
  "93": "#fce94f",
  "94": "#729fcf",
  "95": "#ad7fa8",
  "96": "#34e2e2",
  "97": "#eeeeec",
};

interface Span {
  text: string;
  style: React.CSSProperties;
}

function parseAnsi(raw: string): Span[] {
  // ── Step 1: Handle carriage returns
  // A real terminal overwrites chars before \r. We emulate this:
  // split on \r and keep only the last non-empty segment.
  let base = raw;
  if (base.includes("\r")) {
    const parts = base.split("\r");
    // Walk backwards to find the segment with meaningful content
    base = parts[parts.length - 1];
    if (!base.trim()) base = parts[parts.length - 2] ?? base;
  }

  // ── Step 2: Strip all CSI sequences that aren't colour codes (cursor moves, erase, etc.)
  // eslint-disable-next-line no-control-regex
  let cleaned = base.replace(/\x1b\[[0-9;]*[A-HJ-Z]/g, ""); // Keep only 'm' codes
  // Also clean private-mode sequences like \x1b[?25h
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/\x1b\[[?!][0-9;]*[a-zA-Z]/g, "");

  // ── Step 3: If the line still starts with junk before a timestamp bracket,
  // strip everything up to the first '[' (catches '>....' artifacts)
  // Only do this if the line looks like a server log
  if (/^[^\[\]\x1b]{0,20}\[\d{2}:\d{2}:\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/^[^\[]*/, "");
  }

  // ── Step 4: Parse colour codes
  const out: Span[] = [];
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let cur: React.CSSProperties = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > last)
      out.push({ text: cleaned.slice(last, m.index), style: { ...cur } });
    const codes = m[1].split(";").filter(Boolean);
    if (!codes.length) {
      cur = {};
    } else {
      codes.forEach((c) => {
        if (c === "0") {
          cur = {};
        } else if (c === "1") cur = { ...cur, fontWeight: "bold" };
        else if (c === "3") cur = { ...cur, fontStyle: "italic" };
        else if (c === "4") cur = { ...cur, textDecoration: "underline" };
        else if (c === "22") {
          const { fontWeight: _fw, ...rest } = cur;
          cur = rest;
        } else if (c in ANSI_FG) cur = { ...cur, color: ANSI_FG[c] };
        else {
          const n = parseInt(c, 10);
          if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) {
            const fgKey = String(n - 10);
            if (fgKey in ANSI_FG)
              cur = {
                ...cur,
                backgroundColor: ANSI_FG[fgKey] + "55",
              };
          }
        }
      });
    }
    last = m.index + m[0].length;
  }
  // Strip any stray escape bytes left in the remainder
  // eslint-disable-next-line no-control-regex
  const remainder = cleaned
    .slice(last)
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b/g, "");
  if (remainder.length > 0) out.push({ text: remainder, style: { ...cur } });
  return out;
}

// Strip any remaining escape sequences that aren't colour codes
function cleanLine(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s
    .replace(/\x1b\[[^m]*m/g, "")
    .replace(/\x1b\[[\d;]*[a-zA-Z]/g, "")
    .replace(/\r/g, "");
}

interface LogLine {
  id: number;
  raw: string;
}
let lid = 0;

const IdeConsole: React.FC = () => {
  const { id: serverId } = useParams<{ id: string }>();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const wsRef = useRef<WebSocket | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = useCallback(
    (raw: string) =>
      setLines((prev) => [...prev.slice(-3000), { id: lid++, raw }]),
    [],
  );

  const autoScroll = () => {
    // Prevent scroll if user is selecting text
    if (window.getSelection()?.toString() !== "") return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(autoScroll, [lines]);

  // ── WebSocket connect ────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    push("\x1b[90mConnecting to server…\x1b[0m");
    try {
      const { data } = await http.get(
        `/api/client/servers/${serverId}/websocket`,
      );
      const { socket: url, token } = data.data;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () =>
        ws.send(JSON.stringify({ event: "auth", args: [token] }));

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          switch (msg.event) {
            case "auth success":
              setConnected(true);
              push("\x1b[92mConnected.\x1b[0m");
              ws.send(
                JSON.stringify({
                  event: "send logs",
                  args: [null],
                }),
              );
              break;
            case "console output":
              ((msg.args as string[]) ?? []).forEach((line) => push(line));
              break;
            case "status":
              push(`\x1b[90m[server: ${msg.args?.[0]}]\x1b[0m`);
              break;
            case "token expiring":
            case "token expired":
              http.get(`/api/client/servers/${serverId}/websocket`).then((r) =>
                ws.send(
                  JSON.stringify({
                    event: "auth",
                    args: [r.data.data.token],
                  }),
                ),
              );
              break;
          }
        } catch {
          /* non-JSON */
        }
      };

      ws.onerror = () => {
        push("\x1b[91mWebSocket error.\x1b[0m");
        setConnected(false);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          setConnected(false);
          push("\x1b[90mDisconnected.\x1b[0m");
        }
      };
    } catch (e) {
      push(`\x1b[91mFailed to connect: ${e}\x1b[0m`);
    }
  }, [serverId, push]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  // ── Send command ─────────────────────────────────────────────────────────
  const send = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ event: "send command", args: [cmd] }));
    setHistory((prev) => [cmd, ...prev.slice(0, 99)]);
    setHistIdx(-1);
    setInput("");
  }, [input]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(i);
      setInput(history[i] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = Math.max(histIdx - 1, -1);
      setHistIdx(i);
      setInput(i === -1 ? "" : history[i]);
      return;
    }
  };

  const copyLogs = () => {
    const rawLogs = lines.map((l) => cleanLine(l.raw)).join("\n");
    navigator.clipboard.writeText(rawLogs);
  };

  return (
    <div className="ide-console">
      <div
        ref={bodyRef}
        className="ide-console-output"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l) => {
          const spans = parseAnsi(l.raw);
          return (
            <div key={l.id} className="ide-console-line">
              {spans.map((s, i) => (
                <span key={i} style={s.style}>
                  {s.text}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="ide-console-input-row">
        <span className="ide-console-prompt">
          <i className="bi bi-chevron-right"></i>
        </span>
        <input
          ref={inputRef}
          className="ide-console-input"
          type="text"
          value={input}
          placeholder={connected ? "Send a command…" : "Not connected"}
          disabled={!connected}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
        <button
          className="ide-console-btn"
          onClick={copyLogs}
          title="Copy Logs"
        >
          <i className="bi bi-clipboard"></i>
        </button>
        <button
          className="ide-console-btn"
          onClick={() => setLines([])}
          title="Clear"
        >
          <i className="bi bi-trash3"></i>
        </button>
        <button className="ide-console-btn" onClick={connect} title="Reconnect">
          <i className="bi bi-arrow-clockwise"></i>
        </button>
        <div
          className={`ide-console-dot ${connected ? "ide-console-dot--ok" : "ide-console-dot--err"}`}
          title={connected ? "Connected" : "Disconnected"}
        />
      </div>
    </div>
  );
};

export default IdeConsole;
