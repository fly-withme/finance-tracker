import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

// Unified icon system
import { 
  CheckCircle, Trash2, ArrowLeft, Plus, X, Building, Calendar, 
  Wallet, SkipForward, Tag, Users, Sparkles, Clock, TrendingUp,
  AlertCircle, Search, Brain, Send, Target, Receipt, User, Crown, 
  Flame, CreditCard, ChevronRight, Zap
} from 'lucide-react';

import AutocompleteCategorySelector from './AutocompleteCategorySelector';

const formatCurrency = (amount) => 
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const InboxPage = ({ categories, classifier, enhancedClassifier, useEnhancedML }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const allInboxTransactions = useLiveQuery(() => 
    isClient ? db.inbox.orderBy('uploadedAt').reverse().toArray() : [], [isClient]
  );

  if (!isClient || !allInboxTransactions) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: jonyColors.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p style={{ color: jonyColors.textSecondary }}>Lade Transaktionen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
              Posteingang (Test)
            </h1>
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center" style={{ minHeight: '500px' }}>
            <div className="text-center p-12 rounded-3xl border-2 max-w-md" style={{
              backgroundColor: jonyColors.surface,
              border: `2px solid ${jonyColors.border}`
            }}>
              <h2 className="text-2xl font-bold mb-4" style={{ color: jonyColors.textPrimary }}>
                Test Version
              </h2>
              <p className="text-lg" style={{ color: jonyColors.textSecondary }}>
                Dies ist eine vereinfachte Version der InboxPage um Syntax-Probleme zu debuggen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;