import React, { useState, useEffect } from "react";
interface Props {
  onClose: () => void;
}
const IdeSettings: React.FC<Props> = ({ onClose }) => {
  // Read current rounded corner state from CSS variable
  const [rounded, setRounded] = useState(() => {
    return (
      document.documentElement.style.getPropertyValue("--ide-radius") === "8px"
    );
    return localStorage.getItem("ide-rounded-corners") !== "false";
  });
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--ide-radius",
      rounded ? "8px" : "0px",
    );
    localStorage.setItem("ide-rounded-corners", rounded ? "true" : "false");
  }, [rounded]);
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
          {/* Future settings can go here */}
          <p
            style={{
              fontSize: "11px",
              color: "var(--ide-text-faint)",
              marginTop: "12px",
            }}
          >
            More configuration options will be available in future updates.
          </p>
        </div>
      </div>
    </div>
  );
};
export default IdeSettings;
