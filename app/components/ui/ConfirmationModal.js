import React from 'react';
import Modal from './Modal';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title}>
    <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
    <div className="flex justify-end space-x-4">
      <button 
        onClick={onClose} 
        className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold text-gray-800 dark:text-white transition-colors"
      >
        Cancel
      </button>
      <button 
        onClick={onConfirm} 
        className="px-6 py-3 rounded-lg bg-red-600 dark:bg-red-700 hover:bg-red-500 dark:hover:bg-red-600 font-semibold text-white transition-colors"
      >
        Confirm
      </button>
    </div>
  </Modal>
);

export default ConfirmationModal;