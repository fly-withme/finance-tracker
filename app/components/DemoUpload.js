import React from 'react';
import { FileText } from 'lucide-react';
import { db } from '../utils/db';

const DemoUpload = ({ onUploadSuccess }) => {
  const handleDemoUpload = async () => {
    // Simulate extracted transactions from a PDF
    const demoTransactions = [
      {
        date: '2025-08-15',
        description: 'Netflix Subscription',
        recipient: 'Netflix International B.V.',
        amount: -15.99,
        account: 'Imported',
        uploadedAt: new Date().toISOString(),
        skipped: 0
      },
      {
        date: '2025-08-14',
        description: 'Gehalt August',
        recipient: 'Tech Solutions GmbH',
        amount: 2500.00,
        account: 'Imported',
        uploadedAt: new Date().toISOString(),
        skipped: 0
      },
      {
        date: '2025-08-12',
        description: 'Einkauf Lebensmittel',
        recipient: 'REWE Markt Berlin',
        amount: -78.45,
        account: 'Imported',
        uploadedAt: new Date().toISOString(),
        skipped: 0
      },
      {
        date: '2025-08-10',
        description: 'Miete August',
        recipient: 'Wohnungsgenossenschaft München eG',
        amount: -800.00,
        account: 'Imported',
        uploadedAt: new Date().toISOString(),
        skipped: 0
      },
      {
        date: '2025-08-09',
        description: 'Premium Abonnement',
        recipient: 'Spotify AB',
        amount: -10.99,
        account: 'Imported',
        uploadedAt: new Date().toISOString(),
        skipped: 0
      }
    ];

    try {
      console.log('Demo: Speichere Transaktionen in Posteingang...');
      await db.inbox.bulkAdd(demoTransactions);
      
      if (onUploadSuccess) {
        onUploadSuccess({
          count: demoTransactions.length,
          timestamp: new Date()
        });
      }
      
      console.log(`${demoTransactions.length} Demo-Transaktionen in Posteingang gespeichert.`);
    } catch (error) {
      console.error('Fehler beim Speichern der Demo-Transaktionen:', error);
    }
  };

  return (
    <button 
      onClick={handleDemoUpload}
      className="btn-sm flex items-center space-x-2 bg-green-600 text-white hover:bg-green-500 transition-colors shadow-lg shadow-green-600/20 ml-2 cursor-pointer"
    >
      <FileText className="w-5 h-5" />
      <span>Demo Upload</span>
    </button>
  );
};

export default DemoUpload;