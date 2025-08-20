import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Plus, X, Calculator, DollarSign, AlertTriangle } from 'lucide-react';
import { db } from '../utils/db';

const formatCurrency = (amount) => amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const SharedExpenseSelector = ({ 
  transactionAmount, 
  onSharedExpenseChange, 
  initialSharedWith = [],
  className = '',
  isMinimal = false
}) => {
  const contacts = useLiveQuery(() => db.contacts.toArray(), []) || [];
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [splitType, setSplitType] = useState('equal');
  const [newContactName, setNewContactName] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);

  const totalAmount = Math.abs(transactionAmount || 0);

  useEffect(() => {
    if (initialSharedWith.length > 0) {
      setSelectedContacts(initialSharedWith);
      setIsExpanded(true);
    }
  }, [initialSharedWith]);

  useEffect(() => {
    // Benachrichtige Parent Component über Änderungen
    if (selectedContacts.length > 0) {
      onSharedExpenseChange({
        sharedWith: selectedContacts,
        splitType: splitType,
        splitDetails: {
          totalAmount,
          contactShares: selectedContacts.reduce((acc, contact) => {
            acc[contact.name] = contact.amount || 0;
            return acc;
          }, {})
        }
      });
    } else {
      onSharedExpenseChange(null);
    }
  }, [selectedContacts, splitType, totalAmount]); // onSharedExpenseChange entfernt um Schleife zu vermeiden

  const addContact = async (contactName) => {
    const existingContact = contacts.find(c => c.name.toLowerCase() === contactName.toLowerCase());
    
    let contact;
    if (existingContact) {
      contact = existingContact;
    } else {
      // Neue Farbe für neuen Kontakt
      const colors = ['#4F46E5', '#7C3AED', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
      const newColor = colors[contacts.length % colors.length];
      
      const newContact = { name: contactName, color: newColor };
      await db.contacts.add(newContact);
      contact = { ...newContact, id: Date.now() }; // Temporäre ID für UI
    }

    const contactWithShare = {
      ...contact,
      amount: splitType === 'equal' ? totalAmount / (selectedContacts.length + 2) : 0 // +2 für dich und den neuen Kontakt
    };

    setSelectedContacts(prev => [...prev, contactWithShare]);
    
    // Bei equal split alle Beträge neu berechnen
    if (splitType === 'equal') {
      const newCount = selectedContacts.length + 2; // +2 für dich und den neuen Kontakt
      const sharePerPerson = totalAmount / newCount;
      
      setSelectedContacts(prev => prev.map(contact => ({
        ...contact,
        amount: sharePerPerson
      })));
    }
  };

  const removeContact = (contactName) => {
    setSelectedContacts(prev => {
      const updated = prev.filter(c => c.name !== contactName);
      
      // Bei equal split Beträge neu berechnen
      if (splitType === 'equal' && updated.length > 0) {
        const newCount = updated.length + 1; // +1 für dich
        const sharePerPerson = totalAmount / newCount;
        return updated.map(contact => ({ ...contact, amount: sharePerPerson }));
      }
      
      return updated;
    });
  };

  const updateContactAmount = (contactName, amount) => {
    setSelectedContacts(prev => 
      prev.map(contact => 
        contact.name === contactName 
          ? { ...contact, amount: parseFloat(amount) || 0 }
          : contact
      )
    );
  };

  const handleSplitTypeChange = (newSplitType) => {
    setSplitType(newSplitType);
    
    if (newSplitType === 'equal' && selectedContacts.length > 0) {
      const sharePerPerson = totalAmount / (selectedContacts.length + 1); // +1 für dich
      setSelectedContacts(prev => 
        prev.map(contact => ({ ...contact, amount: sharePerPerson }))
      );
    }
  };

  const handleAddNewContact = async () => {
    if (newContactName.trim()) {
      await addContact(newContactName.trim());
      setNewContactName('');
      setShowAddContact(false);
    }
  };

  const yourShare = totalAmount - selectedContacts.reduce((sum, contact) => sum + (contact.amount || 0), 0);
  const isValidSplit = Math.abs(yourShare + selectedContacts.reduce((sum, c) => sum + c.amount, 0) - totalAmount) < 0.01;

  // Skip the collapse logic for minimal mode
  if (!isExpanded && !isMinimal) {
    return (
      <div className={`${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-sm"
        >
          <Users className="w-4 h-4" />
          <span>Ausgabe teilen</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`${className} ${isMinimal ? 'p-0' : 'p-4'}`}>
      {/* Split Type Selector - Simplified for minimal */}
      <div className={`flex gap-1 ${isMinimal ? 'mb-3 p-1' : 'mb-4 p-1'} bg-slate-100 rounded-lg`}>
        <button
          onClick={() => handleSplitTypeChange('equal')}
          className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors font-medium ${
            splitType === 'equal' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Gleichmäßig
        </button>
        <button
          onClick={() => handleSplitTypeChange('custom')}
          className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors font-medium ${
            splitType === 'custom' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Angepasst
        </button>
      </div>

      {/* Contact Selector */}
      <div className={isMinimal ? 'mb-3' : 'mb-4'}>
        {!isMinimal && <label className="block text-sm font-medium text-slate-700 mb-2">Personen hinzufügen</label>}
        
        {/* Available Contacts */}
        {contacts.filter(contact => !selectedContacts.find(sc => sc.name === contact.name)).length > 0 && (
          <div className={`${isMinimal ? 'grid grid-cols-3 gap-1 mb-2' : 'grid grid-cols-2 gap-2 mb-3'}`}>
            {contacts.filter(contact => !selectedContacts.find(sc => sc.name === contact.name)).slice(0, isMinimal ? 6 : 10).map(contact => (
              <button
                key={contact.id}
                onClick={() => addContact(contact.name)}
                className={`flex items-center gap-2 ${isMinimal ? 'px-2 py-1.5' : 'px-3 py-2'} bg-slate-50 border border-slate-200 rounded-lg text-sm hover:bg-slate-100 transition-colors text-left`}
              >
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: contact.color }}
                ></div>
                <span className="truncate text-xs">{contact.name}</span>
              </button>
            ))}
          </div>
        )}
        
        {!showAddContact ? (
          <button
            onClick={() => setShowAddContact(true)}
            className={`w-full flex items-center justify-center gap-2 ${isMinimal ? 'px-3 py-1.5' : 'px-3 py-2'} bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors border border-indigo-200`}
          >
            <Plus className="w-3 h-3" />
            Person hinzufügen
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNewContact()}
              placeholder="Name eingeben"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
            <button
              onClick={handleAddNewContact}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setShowAddContact(false);
                setNewContactName('');
              }}
              className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Selected Contacts with amounts */}
      {selectedContacts.length > 0 && (
        <div className={isMinimal ? 'space-y-2' : 'space-y-3'}>
          {!isMinimal && (
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">Aufteilung</h4>
              <span className="text-xs text-slate-500">{formatCurrency(totalAmount)}</span>
            </div>
          )}
          
          <div className={isMinimal ? 'space-y-1' : 'space-y-2'}>
            {selectedContacts.map(contact => (
              <div key={contact.name} className={`flex items-center gap-2 ${isMinimal ? 'p-2' : 'p-3'} bg-slate-50 rounded-lg border border-slate-200`}>
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: contact.color }}
                ></div>
                <span className={`flex-1 ${isMinimal ? 'text-xs' : 'text-sm'} font-medium text-slate-800`}>{contact.name}</span>
                
                {splitType === 'custom' ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">€</span>
                    <input
                      type="number"
                      step="0.01"
                      value={contact.amount || ''}
                      onChange={(e) => updateContactAmount(contact.name, e.target.value)}
                      className={`${isMinimal ? 'w-12' : 'w-16'} px-1 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className={`${isMinimal ? 'text-xs' : 'text-sm'} font-semibold text-slate-700`}>
                    {isMinimal ? `${contact.amount?.toFixed(0)}€` : formatCurrency(contact.amount || 0)}
                  </span>
                )}
                
                <button
                  onClick={() => removeContact(contact.name)}
                  className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            
            {/* Your share */}
            <div className={`flex items-center gap-2 ${isMinimal ? 'p-2' : 'p-3'} bg-indigo-50 rounded-lg border border-indigo-200`}>
              <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></div>
              <span className={`flex-1 ${isMinimal ? 'text-xs' : 'text-sm'} font-semibold text-indigo-800`}>Du</span>
              <span className={`${isMinimal ? 'text-xs' : 'text-sm'} font-bold text-indigo-700`}>
                {isMinimal ? `${yourShare?.toFixed(0)}€` : formatCurrency(yourShare)}
              </span>
            </div>
          </div>
          
          {!isValidSplit && (
            <div className={`flex items-center gap-2 ${isMinimal ? 'text-xs' : 'text-xs'} text-red-600 bg-red-50 ${isMinimal ? 'p-2' : 'p-3'} rounded-lg border border-red-200`}>
              <AlertTriangle className={`${isMinimal ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
              <span>Beträge stimmen nicht überein</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SharedExpenseSelector;