import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useOutsideClick } from '../hooks/useOutsideClick';

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
          // Weicherer Hintergrund-Overlay
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full ${sizeClasses[size]} border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden`}
          >
            {/* Header-Bereich */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <button 
                onClick={onClose} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Inhaltsbereich - Scrollbar */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
