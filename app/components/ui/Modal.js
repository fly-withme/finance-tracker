import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useOutsideClick } from '../hooks/useOutsideClick';
import { jonyColors } from '../../theme';

const Modal = ({ isOpen, onClose, title, children, size = 'default' }) => {
  const modalRef = useRef();
  useOutsideClick(modalRef, onClose);

  const sizeClasses = {
    default: 'max-w-2xl max-h-[90vh]',
    large: 'max-w-4xl max-h-[95vh]',
    small: 'max-w-md max-h-[80vh]'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`rounded-2xl shadow-xl w-full ${sizeClasses[size]} flex flex-col overflow-hidden`}
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.cardBorder}`
            }}
          >
            {/* Header-Bereich */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${jonyColors.cardBorder}` }}>
              <h3 className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>{title}</h3>
              <button 
                onClick={onClose} 
                className="p-2 rounded-full transition-all duration-200 hover:scale-110"
                style={{
                  color: jonyColors.textSecondary,
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = jonyColors.textSecondary;
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Inhaltsbereich - Scrollbar */}
            <div className="flex-1 overflow-y-auto p-0" style={{ backgroundColor: jonyColors.surface, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
