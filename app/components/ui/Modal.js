import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useOutsideClick } from '../hooks/useOutsideClick';

const Modal = ({ isOpen, onClose, title, children, size = 'default' }) => {
  const modalRef = useRef();
  useOutsideClick(modalRef, onClose);

  const sizeClasses = {
    default: 'max-w-2xl',
    large: 'max-w-4xl',
    small: 'max-w-md'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Weicherer Hintergrund-Overlay
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            // Helles Design für das Modal-Panel
            className={`bg-white rounded-2xl shadow-xl w-full ${sizeClasses[size]} border border-slate-200`}
          >
            {/* Header-Bereich */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <button 
                onClick={onClose} 
                className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Inhaltsbereich */}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
