// Shared TypeScript types for the IDE File Manager extension

// ── File & Directory Types ───────────────────────────────────────────

export interface IdeFile {
  name: string;
  path: string;
  content?: string; // undefined = not yet loaded
  size?: number;
  modifiedAt?: string;
  isDirectory: false;
}

export interface IdeDirectoryEntry {
  name: string;
  path: string;
  isDirectory: true;
  children?: IdeTreeEntry[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export type IdeTreeEntry = IdeFile | IdeDirectoryEntry;

export interface IdeTab {
  id: string;
  name: string;
  path: string;
  content: string | null; // null = currently loading
  isDirty: boolean;
  isLoading: boolean;
  pendingLine?: number; // scroll editor to this line after load
}

// ── Language Detection ───────────────────────────────────────────────

export type FileModeLanguage =
  | "plaintext"
  | "javascript"
  | "typescript"
  | "json"
  | "yaml"
  | "xml"
  | "html"
  | "css"
  | "php"
  | "python"
  | "bash"
  | "ini"
  | "properties"
  | "markdown"
  | "java"
  | "lua"
  | "sql"
  | "toml"
  | "dockerfile"
  | "rust"
  | "go"
  | "csharp"
  | "cpp";

export const EXTENSION_TO_LANGUAGE: Record<string, FileModeLanguage> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  php: "php",
  py: "python",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ini: "ini",
  properties: "properties",
  conf: "ini",
  cfg: "ini",
  env: "ini",
  md: "markdown",
  txt: "plaintext",
  java: "java",
  lua: "lua",
  sql: "sql",
  toml: "toml",
  dockerfile: "dockerfile",
  rs: "rust",
  go: "go",
  cs: "csharp",
  cpp: "cpp",
  c: "cpp",
  h: "cpp",
  hpp: "cpp",
  log: "plaintext",
  csv: "plaintext",
};

export function getLanguage(filename: string): FileModeLanguage {
  const lower = filename.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  const ext = lower.split(".").pop() ?? "";
  return EXTENSION_TO_LANGUAGE[ext] ?? "plaintext";
}

// ── Language Color Scheme ────────────────────────────────────────────
// Returns a CSS class name for the language-specific color theme

export const LANGUAGE_COLOR_CLASS: Record<FileModeLanguage, string> = {
  javascript: "ide-lang--js",
  typescript: "ide-lang--ts",
  json: "ide-lang--json",
  yaml: "ide-lang--yaml",
  xml: "ide-lang--xml",
  html: "ide-lang--html",
  css: "ide-lang--css",
  php: "ide-lang--php",
  python: "ide-lang--python",
  bash: "ide-lang--bash",
  ini: "ide-lang--ini",
  properties: "ide-lang--ini",
  markdown: "ide-lang--md",
  plaintext: "ide-lang--plain",
  java: "ide-lang--java",
  lua: "ide-lang--lua",
  sql: "ide-lang--sql",
  toml: "ide-lang--toml",
  dockerfile: "ide-lang--docker",
  rust: "ide-lang--rust",
  go: "ide-lang--go",
  csharp: "ide-lang--csharp",
  cpp: "ide-lang--cpp",
};

export function getLangColorClass(filename: string): string {
  return LANGUAGE_COLOR_CLASS[getLanguage(filename)] ?? "ide-lang--plain";
}

// ── Binary / Incompatible File Detection ─────────────────────────────

const BINARY_EXTENSIONS = new Set([
  // Archives
  "zip",
  "tar",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "tgz",
  // Images
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "ico",
  "webp",
  "svg",
  "tiff",
  "tif",
  // Audio/Video
  "mp3",
  "mp4",
  "wav",
  "ogg",
  "avi",
  "mkv",
  "mov",
  "flac",
  "webm",
  // Executables & compiled
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "o",
  "class",
  "jar",
  "war",
  "pyc",
  "pyo",
  "wasm",
  // Database
  "db",
  "sqlite",
  "sqlite3",
  "mdb",
  // Documents
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  // Fonts
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
  // Other binary
  "dat",
  "iso",
  "img",
  "dmg",
]);

export function isBinaryFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (
    ext === "jar" ||
    ext === "zip" ||
    ext === "tar" ||
    ext === "gz" ||
    ext === "rar"
  )
    return true;
  if (
    ext === "exe" ||
    ext === "dll" ||
    ext === "so" ||
    ext === "dylib" ||
    ext === "bin"
  )
    return true;
  if (ext === "db" || ext === "sqlite" || ext === "sqlite3") return true;
  if (ext === "pdf" || ext === "doc" || ext === "docx") return true;
  if (ext === "mp3" || ext === "ogg" || ext === "wav") return true;
  return false;
}

export function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext);
}

export function isVideo(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "ogg", "mov", "avi"].includes(ext);
}

export function getBinaryTypeLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const labels: Record<string, string> = {
    zip: "Archive ZIP",
    tar: "Archive TAR",
    gz: "Archive GZ",
    "7z": "Archive 7z",
    rar: "Archive RAR",
    png: "Image PNG",
    jpg: "Image JPEG",
    jpeg: "Image JPEG",
    gif: "Image GIF",
    webp: "Image WebP",
    svg: "Image SVG",
    mp3: "Audio MP3",
    mp4: "Video MP4",
    wav: "Audio WAV",
    mkv: "Video MKV",
    exe: "Executable",
    dll: "Library DLL",
    jar: "Java Archive",
    class: "Java Class",
    db: "Database",
    sqlite: "SQLite DB",
    sqlite3: "SQLite DB",
    pdf: "Document PDF",
    doc: "Document Word",
    ttf: "Font TTF",
    otf: "Font OTF",
    woff: "Font WOFF",
  };
  return labels[ext] ?? "Binary file";
}

// ── File Icons ───────────────────────────────────────────────────────

export function getFileIconClass(entry: IdeTreeEntry): string {
  if (entry.isDirectory) return "bi bi-folder-fill";
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    js: "bi bi-filetype-js",
    mjs: "bi bi-filetype-js",
    cjs: "bi bi-filetype-js",
    ts: "bi bi-filetype-tsx",
    tsx: "bi bi-filetype-tsx",
    jsx: "bi bi-filetype-jsx",
    json: "bi bi-filetype-json",
    yml: "bi bi-filetype-yml",
    yaml: "bi bi-filetype-yml",
    toml: "bi bi-file-earmark-code",
    php: "bi bi-filetype-php",
    py: "bi bi-filetype-py",
    html: "bi bi-filetype-html",
    css: "bi bi-filetype-css",
    scss: "bi bi-filetype-scss",
    less: "bi bi-filetype-scss",
    sh: "bi bi-filetype-sh",
    bash: "bi bi-filetype-sh",
    zsh: "bi bi-filetype-sh",
    md: "bi bi-filetype-md",
    txt: "bi bi-filetype-txt",
    png: "bi bi-file-image",
    jpg: "bi bi-file-image",
    jpeg: "bi bi-file-image",
    gif: "bi bi-file-image",
    svg: "bi bi-file-image",
    webp: "bi bi-file-image",
    zip: "bi bi-file-zip",
    tar: "bi bi-file-zip",
    gz: "bi bi-file-zip",
    "7z": "bi bi-file-zip",
    rar: "bi bi-file-zip",
    log: "bi bi-file-earmark-text",
    csv: "bi bi-filetype-csv",
    env: "bi bi-file-earmark-lock",
    conf: "bi bi-gear",
    cfg: "bi bi-gear",
    ini: "bi bi-gear",
    xml: "bi bi-filetype-xml",
    jar: "bi bi-filetype-java",
    class: "bi bi-filetype-java",
    java: "bi bi-filetype-java",
    lua: "bi bi-file-earmark-code",
    sql: "bi bi-filetype-sql",
    rs: "bi bi-file-earmark-code",
    go: "bi bi-file-earmark-code",
    cs: "bi bi-filetype-cs",
    cpp: "bi bi-file-earmark-code",
    c: "bi bi-file-earmark-code",
    h: "bi bi-file-earmark-code",
    dockerfile: "bi bi-box",
    pdf: "bi bi-filetype-pdf",
    exe: "bi bi-file-earmark-binary",
    dll: "bi bi-file-earmark-binary",
    mp3: "bi bi-file-music",
    mp4: "bi bi-file-play",
    wav: "bi bi-file-music",
    ttf: "bi bi-file-font",
    otf: "bi bi-file-font",
    woff: "bi bi-file-font",
    db: "bi bi-database",
    sqlite: "bi bi-database",
    sqlite3: "bi bi-database",
  };
  return icons[ext] ?? "bi bi-file-earmark";
}

// ── Utilities ────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── CRUD Types ───────────────────────────────────────────────────────

export interface CreateItemPayload {
  name: string;
  directory: string; // parent directory path
}

export interface RenamePayload {
  renameFrom: string;
  renameTo: string;
}

export interface DeletePayload {
  root: string; // parent directory
  files: string[]; // filenames (not full paths)
}
