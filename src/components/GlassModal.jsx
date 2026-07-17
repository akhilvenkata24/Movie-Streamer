import React from 'react';

export function GlassModal({ isOpen, title, description, children, showClose = false, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={showClose ? onClose : undefined}>
      <div 
        className="modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {title && <h2 className="modal-title text-gradient">{title}</h2>}
        {description && <p className="modal-desc">{description}</p>}
        <div className="modal-body">
          {children}
        </div>
        {showClose && (
          <button className="btn btn-secondary touch-no-zoom" style={{ marginTop: '16px' }} onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
