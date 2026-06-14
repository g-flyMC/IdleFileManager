import React, { useState, useEffect } from "react";
import { THEMES, applyTheme } from "./ide-types";

interface Props {
  onClose: () => void;
}

const IdeSettings: React.FC<Props> = ({ onClose }) => {
  const [rounded, setRounded] = useState(() => {
    return localStorage.getItem("ide-rounded-corners") !== "false";
  });

  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem("ide-theme") || "vs-dark";
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--ide-radius",
      rounded ? "8px" : "0px"
    );
    localStorage.setItem("ide-rounded-corners", rounded ? "true" : "false");
  }, [rounded]);

  const handleThemeChange = (newTheme: string) => {
    setThemeName(newTheme);
    localStorage.setItem("ide-theme", newTheme);
    applyTheme(newTheme);
    window.dispatchEvent(new Event("ide-theme-change"));
  };

  return (
    <div className="ide-modal-backdrop" onMouseDown={onClose}>
      <div className="ide-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ide-modal-header">
          <span className="ide-modal-title">Settings</span>
          <button className="ide-modal-close" onClick={onClose}>
            <i className="bi bi-x"></i>
          </button>
        </div>
        <div className="ide-modal-body">
          <div className="ide-setting-row">
            <span>Rounded Corners</span>
            <input
              type="checkbox"
              className="ide-toggle"
              checked={rounded}
              onChange={(e) => setRounded(e.target.checked)}
            />
          </div>
          
          <div className="ide-setting-row" style={{ marginTop: '8px' }}>
            <span>Color Theme</span>
            <select
              value={themeName}
              onChange={(e) => handleThemeChange(e.target.value)}
              style={{
                background: 'var(--ide-bg)',
                color: 'var(--ide-text)',
                border: '1px solid var(--ide-border)',
                borderRadius: 'var(--ide-radius)',
                padding: '4px 8px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="vs-dark">VS Dark</option>
              <option value="vs-light">VS Light</option>
              <option value="dracula">Dracula</option>
              <option value="one-dark">One Dark Pro</option>
              <option value="github-dark">GitHub Dark</option>
              <option value="monokai">Monokai</option>
            </select>
          </div>
          
          <p
            style={{
              fontSize: "11px",
              color: "var(--ide-text-faint)",
              marginTop: "12px",
            }}
          >
            Settings are saved automatically to your browser storage.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IdeSettings;
