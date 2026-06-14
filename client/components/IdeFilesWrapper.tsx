import React from 'react';
import { useParams, useHistory } from 'react-router-dom';

interface Props {
  children?: React.ReactNode;
}

const IdeFilesWrapper: React.FC<Props> = ({ children }) => {
  const { id: serverId } = useParams<{ id: string }>();
  const history = useHistory();

  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton fixe top-right, hors du flux ptero */}
      <button
        onClick={() => history.push(`/server/${serverId}/ide`)}
        style={{
          position: 'fixed',
          top: '14px',
          right: '20px',
          zIndex: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          background: 'linear-gradient(135deg, #0078d4 0%, #005fa3 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,120,212,0.45)',
          transition: 'transform 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,120,212,0.55)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = '';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(0,120,212,0.45)';
        }}
      >
        <i className='bi bi-code-slash'></i>
        Open IDE
      </button>
      {children}
    </div>
  );
};

export default IdeFilesWrapper;
