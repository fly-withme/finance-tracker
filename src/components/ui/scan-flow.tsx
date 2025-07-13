'use client'

import { useState } from 'react';
import { motion } from 'framer-motion';
import { processImageWithOCR } from '@/lib/ocr';
import type { Transaction, ParsedTransaction } from '@/lib/types';
import ReviewView from './review-view';
import { ScanLine } from 'lucide-react';

function ProcessingView() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
        <div className="w-24 h-24 bg-surface rounded-3xl flex items-center justify-center shadow-soft overflow-hidden">
            <motion.div
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
                <ScanLine className="w-24 h-auto text-accent"/>
            </motion.div>
        </div>
        <h2 className="text-xl font-semibold mt-6">Analysiere Transaktionen...</h2>
        <p className="text-secondary-text">Das kann einen Moment dauern.</p>
    </div>
  )
}

export default function ScanFlow({ onCompleteAction, categories }: { onCompleteAction: (newTransactions: Omit<Transaction, 'id' | 'user_id' | 'created_at'>[]) => void, categories: string[] }) {
  const [transactionsForReview, setTransactionsForReview] = useState<ParsedTransaction[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'reviewing'>('idle');

  async function handleImageSelect(file: File | undefined) {
    if (!file) return;
    setStatus('processing');
    const { needsReview } = await processImageWithOCR(file);
    if (needsReview.length > 0) {
      setTransactionsForReview(needsReview);
      setStatus('reviewing');
    } else {
      onCompleteAction([]);
    }
  }

  function handleReviewComplete(reviewedTransactions: Omit<Transaction, 'id' | 'user_id' | 'created_at'>[]) {
    onCompleteAction(reviewedTransactions);
  }
  
  if (status === 'processing') return <ProcessingView />;
  if (status === 'reviewing') return <ReviewView transactions={transactionsForReview} categories={categories} onDoneAction={handleReviewComplete} />;
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      <label className="p-8 border-2 border-dashed border-gray-300 rounded-3xl text-center cursor-pointer hover:border-accent hover:bg-blue-50 transition-colors">
        <p className="font-semibold text-primary-text">Kontoauszug hier ablegen</p>
        <p className="text-sm text-secondary-text mt-1">oder klicken zum Auswählen</p>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleImageSelect(e.target.files?.[0])} />
      </label>
    </div>
  );
}