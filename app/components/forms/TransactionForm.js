import React, { useState, useCallback, useMemo } from 'react';
import { Tag, Euro, Calendar, FileText, X, Plus, Users } from 'lucide-react';
import AutocompleteCategorySelector from '../AutocompleteCategorySelector';
import { db } from '../../utils/db';
import { jonyColors } from '../../theme';

// --- Hilfskomponenten für das UI ---

const Avatar = ({ name }) => {
  let initials = '?';
  try {
    const safeName = String(name || '');
    if (safeName && safeName.trim()) {
      initials = safeName.trim().split(' ')
        .map(n => n && n[0] ? n[0].toUpperCase() : '')
        .filter(Boolean)
        .slice(0, 2)
        .join('') || '?';
    }
  } catch (error) {
    console.warn('Error generating initials for name:', name, error);
    initials = '?';
  }
  
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: jonyColors.cardBorder, color: jonyColors.textSecondary }}
    >
      {initials}
    </div>
  );
};

const SplitStatus = ({ remaining, userShare, currency = '€' }) => {
  const isReady = Math.abs(remaining) < 0.01; // Toleranz für Fließkommazahlen
  if (isReady) {
    return (
      <p className="text-xs" style={{ color: jonyColors.accent1 }}>
        ✅ Alles aufgeteilt. Dein Anteil beträgt {userShare.toFixed(2)}{currency}.
      </p>
    );
  }
  if (remaining > 0) {
    return (
      <p className="text-xs" style={{ color: jonyColors.orange }}>
        🟠 Es verbleiben noch {remaining.toFixed(2)}{currency} zum Aufteilen.
      </p>
    );
  }
  return (
    <p className="text-xs" style={{ color: jonyColors.magenta }}>
      🔴 Du hast {Math.abs(remaining).toFixed(2)}{currency} zu viel zugeordnet.
    </p>
  );
};

// Modal für Kosten aufteilen - minimalistisches Dashboard-Design
const SplitExpenseModal = ({ 
  isOpen, 
  onClose, 
  amount, 
  splitConfig, 
  setSplitConfig,
  userShare,
  participantShares,
  remainingAmount,
  transaction,
  formAmount 
}) => {
  if (!isOpen) return null;

  // Berechne die Anteile basierend auf dem amount Parameter (der sollte der richtige sein)
  const numParticipants = splitConfig.participants.length + 1;
  let modalUserShare = 0;
  let modalParticipantShares = {};

  if (splitConfig.splitType === 'EQUAL') {
    const share = amount > 0 && numParticipants > 0 ? amount / numParticipants : 0;
    modalUserShare = share;
    splitConfig.participants.forEach(p => modalParticipantShares[p] = share);
  } else { // AMOUNT
    let assignedByOthers = 0;
    splitConfig.participants.forEach(p => {
      const customAmount = parseFloat(splitConfig.customAmounts[p]) || 0;
      modalParticipantShares[p] = customAmount;
      assignedByOthers += customAmount;
    });
    modalUserShare = amount - assignedByOthers;
  }

  const addParticipant = () => {
    const newParticipant = `Person ${splitConfig.participants.length + 1}`;
    setSplitConfig(prev => ({ 
      ...prev, 
      participants: [...prev.participants, newParticipant],
      isSplitting: true 
    }));
  };
  
  const removeParticipant = (nameToRemove) => {
    setSplitConfig(prev => {
      const newParticipants = prev.participants.filter(p => p !== nameToRemove);
      return {
        ...prev,
        participants: newParticipants,
        customAmounts: Object.fromEntries(Object.entries(prev.customAmounts).filter(([name]) => name !== nameToRemove)),
        isSplitting: newParticipants.length > 0
      };
    });
  };

  const handleSplitTypeChange = (type) => setSplitConfig(prev => ({ ...prev, splitType: type }));
  
  const handleCustomAmountChange = (name, amount) => {
    setSplitConfig(prev => ({
        ...prev,
        customAmounts: { ...prev.customAmounts, [name]: amount }
    }));
  };
  
  const handleParticipantNameChange = (index, newName) => {
    const oldName = splitConfig.participants[index];
    const newParticipants = [...splitConfig.participants];
    newParticipants[index] = newName;

    const newCustomAmounts = { ...splitConfig.customAmounts };
    if (oldName in newCustomAmounts) {
      newCustomAmounts[newName] = newCustomAmounts[oldName];
      delete newCustomAmounts[oldName];
    }

    setSplitConfig(prev => ({
      ...prev,
      participants: newParticipants,
      customAmounts: newCustomAmounts
    }));
  };

  const handleConfirm = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
         style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" 
           style={{ 
             backgroundColor: jonyColors.surface,
             border: `1px solid ${jonyColors.border}`,
             boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
           }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" 
             style={{ borderColor: jonyColors.border }}>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5" style={{ color: jonyColors.textSecondary }} />
            <h2 className="text-lg font-medium" style={{ color: jonyColors.textPrimary }}>
              Kosten aufteilen
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl transition-all duration-200 hover:bg-opacity-80"
            style={{ backgroundColor: jonyColors.cardBackground }}
          >
            <X className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Betrag Anzeige */}
          <div className="text-center p-4 rounded-2xl" 
               style={{ backgroundColor: jonyColors.cardBackground }}>
            <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
              Aufzuteilender Betrag
            </div>
            <div className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
              {amount}€
            </div>
          </div>

          {/* Split-Type Auswahl */}
          <div className="flex gap-2 p-1 rounded-xl" 
               style={{ backgroundColor: jonyColors.cardBackground }}>
            <button 
              onClick={() => handleSplitTypeChange('EQUAL')} 
              className="flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all"
              style={{
                backgroundColor: splitConfig.splitType === 'EQUAL' ? jonyColors.textSecondary : 'transparent',
                color: splitConfig.splitType === 'EQUAL' ? jonyColors.surface : jonyColors.textSecondary
              }}
            >
              Gleichmäßig
            </button>
            <button 
              onClick={() => handleSplitTypeChange('AMOUNT')} 
              className="flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all"
              style={{
                backgroundColor: splitConfig.splitType === 'AMOUNT' ? jonyColors.textSecondary : 'transparent',
                color: splitConfig.splitType === 'AMOUNT' ? jonyColors.surface : jonyColors.textSecondary
              }}
            >
              Eigene Beträge
            </button>
          </div>

          {/* Personen Liste */}
          <div className="space-y-3">
            
            {/* Du */}
            <div className="flex items-center gap-4 p-4 rounded-2xl" 
                 style={{ backgroundColor: jonyColors.cardBackground }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium" 
                   style={{ backgroundColor: jonyColors.border, color: jonyColors.textPrimary }}>
                Du
              </div>
              <div className="flex-grow">
                <div className="font-medium" style={{ color: jonyColors.textPrimary }}>Du</div>
                <div className="text-xs" style={{ color: jonyColors.textSecondary }}>Bezahlt</div>
              </div>
              <div className="text-right">
                <div className="font-medium" style={{ color: jonyColors.textPrimary }}>
                  {modalUserShare.toFixed(2)}€
                </div>
                <div className="text-xs" style={{ color: jonyColors.textSecondary }}>Anteil</div>
              </div>
            </div>

            {/* Andere Personen */}
            {splitConfig.participants.map((p, i) => {
              // Prüfe ob diese Person bereits bezahlt hat
              const isSettled = transaction?.settledWithPersons?.includes(p);
              
              return (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl" 
                     style={{ 
                       backgroundColor: jonyColors.cardBackground,
                       opacity: isSettled ? 0.6 : 1 
                     }}>
                  <Avatar name={p} />
                  <div className="flex-grow">
                    <input 
                      type="text" 
                      value={p} 
                      onChange={(e) => handleParticipantNameChange(i, e.target.value)} 
                      className="w-full font-medium bg-transparent focus:outline-none p-1 rounded-lg" 
                      style={{ color: jonyColors.textPrimary }}
                      placeholder="Name eingeben..."
                      disabled={isSettled}
                    />
                    <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                      {isSettled ? 'Bereits bezahlt' : 'Schuldet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {splitConfig.splitType === 'EQUAL' ? (
                      <div className="text-right">
                        <div className="font-medium" style={{ 
                          color: isSettled ? jonyColors.accent1 : jonyColors.textPrimary 
                        }}>
                          {modalParticipantShares[p]?.toFixed(2) || '0.00'}€
                        </div>
                        <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                          {isSettled ? 'Bezahlt' : 'Anteil'}
                        </div>
                      </div>
                    ) : (
                      <input 
                        type="number" 
                        step="0.01" 
                        value={splitConfig.customAmounts[p] || ''} 
                        onChange={(e) => handleCustomAmountChange(p, e.target.value)} 
                        className="w-20 text-right font-medium rounded-lg px-2 py-1 focus:outline-none" 
                        style={{
                          backgroundColor: jonyColors.surface, 
                          color: isSettled ? jonyColors.accent1 : jonyColors.textPrimary, 
                          border: `1px solid ${jonyColors.border}`
                        }}
                        placeholder="0.00"
                        disabled={isSettled}
                      />
                    )}
                    {!isSettled && (
                      <button 
                        onClick={() => removeParticipant(p)}
                        className="p-1 rounded-lg transition-all duration-200 hover:bg-opacity-80"
                        style={{ backgroundColor: jonyColors.surface }}
                      >
                        <X className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                      </button>
                    )}
                    {isSettled && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" 
                           style={{ backgroundColor: jonyColors.accent1Alpha }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Person hinzufügen */}
            <button 
              onClick={addParticipant} 
              className="w-full flex items-center gap-3 justify-center p-4 rounded-2xl border border-dashed transition-all hover:bg-opacity-50" 
              style={{
                borderColor: jonyColors.border, 
                color: jonyColors.textSecondary,
                backgroundColor: 'transparent'
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Person hinzufügen</span>
            </button>
          </div>

          {/* Status */}
          <div className="p-4 rounded-2xl border" 
               style={{ 
                 backgroundColor: jonyColors.cardBackground,
                 borderColor: Math.abs(remainingAmount) < 0.01 ? jonyColors.border : jonyColors.orangeLight
               }}>
            <SplitStatus remaining={remainingAmount} userShare={modalUserShare} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t" style={{ borderColor: jonyColors.border }}>
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-medium transition-all duration-200"
            style={{
              backgroundColor: jonyColors.textSecondary,
              color: jonyColors.surface
            }}
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Hauptkomponente ---

const INCOME_CATEGORY_NAME = 'Income'; // Oder 'Einnahme', je nachdem was in Ihrer DB steht

// Smart income detection keywords
const INCOME_KEYWORDS = [
  'einkommen', 'gehalt', 'lohn', 'salary', 'rückzahlung', 'rückerstattung', 'refund',
  'geschenk', 'gift', 'unterhalt', 'alimente', 'kindergeld', 'kinderzuschlag',
  'bafög', 'stipendium', 'bonus', 'prämie', 'zinsen', 'dividende', 'rente',
  'pension', 'arbeitslosengeld', 'krankengeld', 'urlaubsgeld', 'weihnachtsgeld',
  'trinkgeld', 'provision', 'honorar', 'nebenjob', 'verkauf', 'erstattung',
  'gutschrift', 'überweisung erhalten', 'geld bekommen', 'zahlung erhalten'
];

// Categories that are always considered income
const INCOME_CATEGORY_NAMES = [
  'gehalt', 'einkommen', 'rückzahlung', 'geschenk', 'elterngeld', 'kindergeld',
  'staatliche unterstützung', 'arbeitslosengeld', 'krankengeld', 'rente',
  'pension', 'bafög', 'stipendium', 'bonus', 'prämie', 'zinsen', 'dividende',
  'unterhalt', 'urlaubsgeld', 'weihnachtsgeld', 'trinkgeld', 'provision',
  'honorar', 'nebenjob', 'erstattung', 'gutschrift', 'income', 'salary',
  'refund', 'gift', 'allowance', 'benefit', 'grant', 'pension'
];

const detectIncome = (recipient, description, category) => {
  const text = `${recipient || ''} ${description || ''}`.toLowerCase();
  const categoryLower = (category || '').toLowerCase();
  
  // Check if category name itself indicates income
  const isCategoryIncome = INCOME_CATEGORY_NAMES.some(incomeCat => 
    categoryLower.includes(incomeCat) || incomeCat.includes(categoryLower)
  );
  
  // Check if text contains income keywords
  const isKeywordIncome = INCOME_KEYWORDS.some(keyword => text.includes(keyword));
  
  return isCategoryIncome || isKeywordIncome;
};

const TransactionForm = ({ transaction, onSave, onCancel, categories, accounts }) => {
  const [formData, setFormData] = useState({
    description: transaction?.description || '',
    recipient: transaction?.recipient || '',
    amount: transaction ? Math.abs(transaction.amount) : '',
    date: transaction?.date || new Date().toISOString().slice(0, 10),
    category: transaction?.category || categories.find(c => c.name !== INCOME_CATEGORY_NAME)?.name || '',
    account: transaction?.account || accounts[0]?.name || '',
  });

  const [showSplitModal, setShowSplitModal] = useState(false);

  const [splitConfig, setSplitConfig] = useState(() => {
    // Handle existing shared expense data
    if (transaction?.sharedWith?.length > 0) {
      const participants = transaction.sharedWith.map(person => 
        typeof person === 'string' ? person : person.name
      );
      const customAmounts = {};
      if (transaction.sharedWith[0]?.amount !== undefined) {
        // If we have person objects with amounts, use those
        transaction.sharedWith.forEach(person => {
          if (typeof person === 'object' && person.name) {
            customAmounts[person.name] = person.amount;
          }
        });
      } else if (transaction.splitDetails) {
        // Fall back to splitDetails
        Object.assign(customAmounts, transaction.splitDetails);
      }
      
      return {
        isSplitting: true,
        splitType: transaction.splitType || 'EQUAL',
        participants: participants,
        customAmounts: customAmounts,
      };
    }
    
    return {
      isSplitting: false,
      splitType: 'EQUAL',
      participants: [],
      customAmounts: {},
    };
  });
  
  const isIncome = detectIncome(formData.recipient, formData.description, formData.category);

  const { userShare, participantShares, remainingAmount } = useMemo(() => {
    // Für existierende Transaktionen mit originalAmount, verwende das für Split-Berechnung
    // Für neue Transaktionen, verwende formData.amount
    const inputAmount = parseFloat(formData.amount) || 0;
    const originalAmount = transaction?.originalAmount;
    
    // Verwende originalAmount für Split-Berechnung wenn vorhanden, sonst inputAmount
    const totalAmount = originalAmount || inputAmount;
    
    if (!splitConfig.isSplitting) return { userShare: inputAmount, participantShares: {}, remainingAmount: 0 };
    
    const numParticipants = splitConfig.participants.length + 1;
    let currentUserShare = 0;
    let otherParticipantShares = {};
    let totalAssigned = 0;

    if (splitConfig.splitType === 'EQUAL') {
      const share = totalAmount > 0 && numParticipants > 0 ? totalAmount / numParticipants : 0;
      currentUserShare = share;
      splitConfig.participants.forEach(p => otherParticipantShares[p] = share);
      totalAssigned = totalAmount;
    } else { // AMOUNT
      let assignedByOthers = 0;
      splitConfig.participants.forEach(p => {
        const customAmount = parseFloat(splitConfig.customAmounts[p]) || 0;
        otherParticipantShares[p] = customAmount;
        assignedByOthers += customAmount;
      });
      currentUserShare = totalAmount - assignedByOthers;
      totalAssigned = assignedByOthers + currentUserShare;
    }
    return { userShare: currentUserShare, participantShares: otherParticipantShares, remainingAmount: totalAmount - totalAssigned };
  }, [formData.amount, splitConfig, transaction?.originalAmount]);

  const handleChange = (e) => {
    const newData = { ...formData, [e.target.name]: e.target.value };
    
    // Smart income detection when recipient or description changes
    if (e.target.name === 'recipient' || e.target.name === 'description') {
      const isIncomeDetected = detectIncome(newData.recipient, newData.description, newData.category);
      if (isIncomeDetected && newData.category !== INCOME_CATEGORY_NAME) {
        // Find or create income category
        const incomeCategory = categories.find(c => c.name === INCOME_CATEGORY_NAME || c.name.toLowerCase().includes('income') || c.name.toLowerCase().includes('einnahme'));
        if (incomeCategory) {
          newData.category = incomeCategory.name;
        }
      }
    }
    
    setFormData(newData);
  };
  const handleCategorySelect = (name) => {
    const newData = { ...formData, category: name };
    
    // Smart income detection when category changes
    const isIncomeDetected = detectIncome(newData.recipient, newData.description, newData.category);
    if (isIncomeDetected && name !== INCOME_CATEGORY_NAME) {
      const incomeCategory = categories.find(c => c.name === INCOME_CATEGORY_NAME || c.name.toLowerCase().includes('income') || c.name.toLowerCase().includes('einnahme'));
      if (incomeCategory) {
        newData.category = incomeCategory.name;
      }
    }
    
    setFormData(newData);
  };
  
  const toggleSplit = () => {
    setSplitConfig(prev => ({
      ...prev,
      isSplitting: false,
      participants: [],
      customAmounts: {},
    }));
  };
  
  const handleCreateCategory = async (categoryName) => {
    try {
      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];
      const newCategory = { name: categoryName, color: colors[Math.floor(Math.random() * colors.length)] };
      await db.categories.add(newCategory);
      setFormData(prev => ({ ...prev, category: categoryName }));
      return newCategory;
    } catch (error) { console.error('Error creating category:', error); throw error; }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const finalAmount = isIncome ? Math.abs(parseFloat(formData.amount)) : -Math.abs(parseFloat(formData.amount));
    
    let transactionData = { ...formData, amount: finalAmount };
    
    // Preserve the ID if this is an edit operation
    if (transaction && transaction.id) {
      transactionData.id = transaction.id;
    }
    
    if (!isIncome && splitConfig.isSplitting && Math.abs(remainingAmount) < 0.01) {
      // Create proper shared expense structure with person objects
      const sharedWithPersons = splitConfig.participants.map((participantName) => {
        const amount = splitConfig.splitType === 'EQUAL' 
          ? participantShares[participantName] || 0
          : parseFloat(splitConfig.customAmounts[participantName]) || 0;
        
        // Generate color based on name hash (same logic as SharedExpensesPage)
        const neonColors = [
          jonyColors.accent1,     // Neon green
          jonyColors.accent2,     // Neon cyan  
          jonyColors.magenta,     // Neon magenta
          jonyColors.orange,      // Orange
          jonyColors.greenMedium, // Medium green
          jonyColors.magentaLight // Light magenta
        ];
        
        let hash = 0;
        for (let i = 0; i < participantName.length; i++) {
          hash = participantName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = neonColors[Math.abs(hash) % neonColors.length];
        
        return {
          name: participantName,
          amount: amount,
          color: color
        };
      });
      
      transactionData = {
        ...transactionData,
        sharedWith: sharedWithPersons,
        splitType: splitConfig.splitType,
        splitDetails: splitConfig.splitType === 'EQUAL' ? participantShares : splitConfig.customAmounts,
      };
    }
    onSave(transactionData);
  };
  
  const IconWrapper = ({ children }) => (
    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
      {children}
    </span>
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" style={{ color: jonyColors.textPrimary }}>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div>
          <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Empfänger/Beschreibung</label>
          <div className="relative">
            <IconWrapper><FileText className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
            <input type="text" name="recipient" placeholder="Wer hat das Geld erhalten?" value={formData.recipient} onChange={handleChange} className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary, '--tw-ring-color': jonyColors.accent1 }} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Beschreibung (optional)</label>
            <div className="relative">
              <IconWrapper><FileText className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
              <input type="text" name="description" placeholder="Zusätzliche Details..." value={formData.description} onChange={handleChange} className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary, '--tw-ring-color': jonyColors.accent1 }} />
            </div>
          </div>
          <div>
            <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Betrag</label>
            <div className="relative">
              <IconWrapper><Euro className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
              <input type="number" step="0.01" name="amount" placeholder="0,00" value={formData.amount} onChange={handleChange} required className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: isIncome ? jonyColors.accent1 : jonyColors.textPrimary, '--tw-ring-color': jonyColors.accent1 }} />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Kategorie</label>
          <div className="relative">
            <IconWrapper><Tag className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
            <AutocompleteCategorySelector categories={categories} selected={formData.category} onSelect={handleCategorySelect} onCreateCategory={handleCreateCategory} defaultValue={formData.category} inputClassName="pl-10" />
          </div>
        </div>

        <div>
          <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Datum</label>
          <div className="relative">
            <IconWrapper><Calendar className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: 'white', colorScheme: 'dark', '--tw-ring-color': jonyColors.accent1 }} />
          </div>
        </div>

        {!isIncome && (
          <div>
            {!splitConfig.isSplitting ? (
              <button 
                type="button" 
                onClick={() => {
                  // Wenn noch keine Personen vorhanden sind, füge automatisch eine hinzu
                  if (splitConfig.participants.length === 0) {
                    setSplitConfig(prev => ({ 
                      ...prev, 
                      participants: ['Person 1'],
                      isSplitting: true 
                    }));
                  }
                  setShowSplitModal(true);
                }} 
                className="w-full flex items-center gap-3 justify-center py-4 rounded-2xl transition-all hover:bg-opacity-50 border border-dashed" 
                style={{ 
                  backgroundColor: 'transparent', 
                  borderColor: jonyColors.border, 
                  color: jonyColors.textSecondary 
                }}
              >
                <Users className="w-5 h-5" style={{ color: jonyColors.textSecondary }}/>
                <div className="text-left">
                  <div className="font-medium text-sm">Mit anderen teilen</div>
                  <div className="text-xs opacity-75">Kosten aufteilen und Rückzahlungen verwalten</div>
                </div>
              </button>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-2xl" 
                   style={{ 
                     backgroundColor: jonyColors.cardBackground, 
                     border: `1px solid ${jonyColors.border}` 
                   }}>
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" style={{ color: jonyColors.textSecondary }} />
                  <div>
                    <div className="font-medium" style={{ color: jonyColors.textPrimary }}>
                      Mit {splitConfig.participants.length} Person{splitConfig.participants.length !== 1 ? 'en' : ''} geteilt
                    </div>
                    <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                      Dein Anteil: {userShare.toFixed(2)}€
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowSplitModal(true)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ 
                      backgroundColor: jonyColors.surface, 
                      color: jonyColors.textSecondary 
                    }}
                  >
                    Bearbeiten
                  </button>
                  <button 
                    type="button" 
                    onClick={toggleSplit}
                    className="p-1 rounded-lg transition-all hover:bg-opacity-80" 
                    style={{ backgroundColor: jonyColors.surface }}
                  >
                    <X className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105" style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary, border: `1px solid ${jonyColors.cardBorder}` }}>
            Abbrechen
          </button>
          <button type="submit" className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 hover:opacity-90 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: jonyColors.accent1, color: 'black' }} disabled={Math.abs(remainingAmount) > 0.01}>
            Speichern
          </button>
        </div>
      </form>

      {/* Modal für Kosten aufteilen */}
      <SplitExpenseModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        amount={transaction?.originalAmount || parseFloat(formData.amount) || 0}
        splitConfig={splitConfig}
        setSplitConfig={setSplitConfig}
        userShare={userShare}
        participantShares={participantShares}
        remainingAmount={remainingAmount}
        transaction={transaction}
        formAmount={parseFloat(formData.amount) || 0}
      />
    </div>
  );
};

export default TransactionForm;