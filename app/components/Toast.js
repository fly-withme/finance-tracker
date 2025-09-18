import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';
import { jonyColors } from '../theme';

const Toast = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onClose={() => removeToast(toast.id)} 
        />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Slide in animation
    requestAnimationFrame(() => setIsVisible(true));
    
    // Auto close after duration
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, toast.duration || 5000);

    return () => clearTimeout(autoCloseTimer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300); // Animation duration
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          backgroundColor: jonyColors.surface,
          borderColor: jonyColors.accent1,
          iconColor: jonyColors.accent1,
          icon: CheckCircle
        };
      case 'error':
        return {
          backgroundColor: jonyColors.surface,
          borderColor: jonyColors.red,
          iconColor: jonyColors.red,
          icon: AlertCircle
        };
      case 'warning':
        return {
          backgroundColor: jonyColors.surface,
          borderColor: jonyColors.orange,
          iconColor: jonyColors.orange,
          icon: AlertTriangle
        };
      case 'info':
      default:
        return {
          backgroundColor: jonyColors.surface,
          borderColor: jonyColors.cardBorder,
          iconColor: jonyColors.textSecondary,
          icon: Info
        };
    }
  };

  const styles = getToastStyles();
  const Icon = styles.icon;

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'translate-x-full opacity-0' : ''}
        flex items-center gap-3 p-4 rounded-xl shadow-lg border min-w-80 max-w-md
      `}
      style={{
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        color: jonyColors.textPrimary
      }}
    >
      <Icon 
        className="w-5 h-5 flex-shrink-0" 
        style={{ color: styles.iconColor }}
      />
      
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-semibold text-sm mb-1" style={{ color: jonyColors.textPrimary }}>
            {toast.title}
          </div>
        )}
        <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
          {toast.message}
        </div>
      </div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
        style={{ color: jonyColors.textSecondary }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;