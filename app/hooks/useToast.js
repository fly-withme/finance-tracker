import { useState, useCallback } from 'react';

let toastId = 0;

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = ++toastId;
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      ...toast
    };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, title, options = {}) => {
    return addToast({
      type: 'success',
      message,
      title,
      duration: 4000,
      ...options
    });
  }, [addToast]);

  const error = useCallback((message, title, options = {}) => {
    return addToast({
      type: 'error',
      message,
      title,
      duration: 6000,
      ...options
    });
  }, [addToast]);

  const warning = useCallback((message, title, options = {}) => {
    return addToast({
      type: 'warning',
      message,
      title,
      duration: 5000,
      ...options
    });
  }, [addToast]);

  const info = useCallback((message, title, options = {}) => {
    return addToast({
      type: 'info',
      message,
      title,
      duration: 4000,
      ...options
    });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
};