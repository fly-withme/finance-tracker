import React, { useState, useCallback, useMemo } from 'react';
import { Tag, Euro, Calendar, Building, FileText, X, Plus } from 'lucide-react';
import AutocompleteCategorySelector from '../AutocompleteCategorySelector';
import { db } from '../../utils/db';
import { jonyColors } from '../../theme';

// --- Hilfskomponenten für das UI ---

const Avatar = ({ name }) => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
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

// --- Hauptkomponente ---

const INCOME_CATEGORY_NAME = 'Income'; // Oder 'Einnahme', je nachdem was in Ihrer DB steht

const TransactionForm = ({ transaction, onSave, onCancel, categories, accounts }) => {
  const [formData, setFormData] = useState({
    description: transaction?.description || '',
    amount: transaction ? Math.abs(transaction.amount) : '',
    date: transaction?.date || new Date().toISOString().slice(0, 10),
    category: transaction?.category || categories.find(c => c.name !== INCOME_CATEGORY_NAME)?.name || '',
    account: transaction?.account || accounts[0]?.name || '',
  });

  const [splitConfig, setSplitConfig] = useState({
    isSplitting: transaction?.sharedWith?.length > 0 || false,
    splitType: transaction?.splitType || 'EQUAL',
    participants: transaction?.sharedWith || [],
    customAmounts: transaction?.splitDetails || {},
  });
  
  const isIncome = formData.category === INCOME_CATEGORY_NAME;

  const { userShare, participantShares, remainingAmount } = useMemo(() => {
    const totalAmount = parseFloat(formData.amount) || 0;
    if (!splitConfig.isSplitting) return { userShare: totalAmount, participantShares: {}, remainingAmount: 0 };
    
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
  }, [formData.amount, splitConfig]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleCategorySelect = (name) => setFormData(prev => ({ ...prev, category: name }));
  
  const toggleSplit = () => {
    setSplitConfig(prev => {
        const newState = !prev.isSplitting;
        return {
            ...prev,
            isSplitting: newState,
            participants: newState && prev.participants.length === 0 ? ['Person 1'] : (newState ? prev.participants : []),
            customAmounts: newState ? prev.customAmounts : {},
        }
    });
  };
  
  const addParticipant = () => {
    const newParticipant = `Person ${splitConfig.participants.length + 1}`;
    setSplitConfig(prev => ({ ...prev, participants: [...prev.participants, newParticipant] }));
  };
  
  const removeParticipant = (nameToRemove) => {
    setSplitConfig(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== nameToRemove),
      customAmounts: Object.fromEntries(Object.entries(prev.customAmounts).filter(([name]) => name !== nameToRemove))
    }));
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
    
    if (!isIncome && splitConfig.isSplitting && Math.abs(remainingAmount) < 0.01) {
      transactionData = {
        ...transactionData,
        sharedWith: splitConfig.participants,
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
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3">
            <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Beschreibung</label>
            <div className="relative">
              <IconWrapper><FileText className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
              <input type="text" name="description" placeholder="Wofür war das Geld?" value={formData.description} onChange={handleChange} className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary, '--tw-ring-color': jonyColors.accent1 }} />
            </div>
          </div>
          <div className="md:col-span-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Datum</label>
            <div className="relative">
              <IconWrapper><Calendar className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: 'white', colorScheme: 'dark', '--tw-ring-color': jonyColors.accent1 }} />
            </div>
          </div>
          <div>
            <label className="block text-2xs font-medium mb-1.5" style={{ color: jonyColors.textSecondary }}>Konto</label>
            <div className="relative">
              <IconWrapper><Building className="w-4 h-4" style={{ color: jonyColors.textSecondary }} /></IconWrapper>
              <select name="account" value={formData.account} onChange={handleChange} className="w-full pl-10 pr-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all appearance-none" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary, '--tw-ring-color': jonyColors.accent1 }}>
                {accounts.map(a => (<option key={a.id} value={a.name}>{a.name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {!isIncome && (
          <div>
            {!splitConfig.isSplitting ? (
              <button type="button" onClick={toggleSplit} className="w-full flex items-center gap-2 justify-center py-3 rounded-xl transition-all hover:opacity-80" style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}`}}>
                <Plus className="w-4 h-4" style={{ color: jonyColors.textSecondary }}/>
                <span className="text-sm font-semibold" style={{ color: jonyColors.textSecondary }}>Ausgabe teilen</span>
              </button>
            ) : (
              <div className="w-full rounded-xl p-4 space-y-4" style={{ backgroundColor: jonyColors.surface, border: `1px solid ${jonyColors.cardBorder}` }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">Geteilt mit <button type="button" onClick={toggleSplit}><X className="w-4 h-4" style={{color: jonyColors.textSecondary}} /></button></h3>
                  <div className="flex items-center gap-1 p-1 rounded-lg" style={{backgroundColor: jonyColors.cardBackground}}>
                    <button type="button" onClick={() => handleSplitTypeChange('EQUAL')} className="px-2 py-1 text-xs rounded-md transition-colors" style={{backgroundColor: splitConfig.splitType === 'EQUAL' ? jonyColors.accent1 : 'transparent', color: splitConfig.splitType === 'EQUAL' ? 'black' : jonyColors.textSecondary}}>Gleichmäßig</button>
                    <button type="button" onClick={() => handleSplitTypeChange('AMOUNT')} className="px-2 py-1 text-xs rounded-md transition-colors" style={{backgroundColor: splitConfig.splitType === 'AMOUNT' ? jonyColors.accent1 : 'transparent', color: splitConfig.splitType === 'AMOUNT' ? 'black' : jonyColors.textSecondary}}>Nach Betrag</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name="Du" />
                    <div className="flex-grow"><p className="text-sm font-semibold">Du</p><p className="text-xs" style={{color: jonyColors.textSecondary}}>Bezahlt: {(parseFloat(formData.amount) || 0).toFixed(2)}€</p></div>
                    <div className="text-sm font-semibold text-right">{userShare.toFixed(2)}€</div>
                  </div>

                  {splitConfig.participants.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Avatar name={p} />
                      <input type="text" value={p} onChange={(e) => handleParticipantNameChange(i, e.target.value)} className="flex-grow text-sm bg-transparent focus:outline-none p-1 rounded-md focus:ring-1" style={{'--tw-ring-color': jonyColors.accent1}}/>
                      {splitConfig.splitType === 'EQUAL' ? (
                         <div className="text-sm text-right w-24" style={{color: jonyColors.textSecondary}}>{participantShares[p]?.toFixed(2) || '0.00'}€</div>
                      ) : (
                        <input type="number" step="0.01" value={splitConfig.customAmounts[p] || ''} onChange={(e) => handleCustomAmountChange(p, e.target.value)} className="w-24 text-right bg-transparent rounded-lg px-2 py-1 focus:outline-none" style={{backgroundColor: jonyColors.cardBackground}}/>
                      )}
                      <button type="button" onClick={() => removeParticipant(p)}><X className="w-4 h-4" style={{color: jonyColors.textSecondary}} /></button>
                    </div>
                  ))}
                  
                  <button type="button" onClick={addParticipant} className="w-full flex items-center gap-2 text-sm p-2 rounded-lg hover:opacity-80 transition-opacity" style={{color: jonyColors.textSecondary}}>
                    <Plus className="w-4 h-4"/> Person hinzufügen
                  </button>
                </div>
                
                <div className="pt-2 border-t" style={{borderColor: jonyColors.cardBorder}}>
                  <SplitStatus remaining={remainingAmount} userShare={userShare} />
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
    </div>
  );
};

export default TransactionForm;