import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { jonyColors } from '../../theme';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md border" style={{ 
        backgroundColor: jonyColors.surface, 
        border: `1px solid ${jonyColors.border}` 
      }}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                backgroundColor: jonyColors.redAlpha
              }}>
                <AlertTriangle className="w-6 h-6" style={{ color: jonyColors.red }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: jonyColors.textPrimary }}>
                  {title}
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ 
              backgroundColor: jonyColors.cardBackground,
              color: jonyColors.textSecondary
            }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = jonyColors.border;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = jonyColors.cardBackground;
              }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          
          {/* Action Buttons */}
          <div className="flex justify-center">
            <button
              onClick={onConfirm}
              className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:opacity-80"
              style={{
                backgroundColor: 'transparent',
                color: jonyColors.red,
                border: `1px solid ${jonyColors.red}`
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;