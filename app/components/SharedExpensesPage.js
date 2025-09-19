import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

// Icons from Lucide React
import {
  Users,
  Plus,
  ArrowRight,
  ArrowLeft,
  X,
  Trash2,
  DollarSign,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);

// Neon color mapping for person initials (same as inbox)
const getNeonPersonColor = (personName) => {
  const neonColors = [
    jonyColors.accent1,     // Neon green
    jonyColors.accent2,     // Neon cyan  
    jonyColors.magenta,     // Neon magenta
    jonyColors.orange,      // Orange
    jonyColors.greenMedium, // Medium green
    jonyColors.magentaLight // Light magenta
  ];
  
  // Create consistent color mapping based on name hash
  let hash = 0;
  for (let i = 0; i < personName.length; i++) {
    hash = personName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return neonColors[Math.abs(hash) % neonColors.length];
};

const SharedExpensesPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSharedExpense, setNewSharedExpense] = useState({
    description: '',
    totalAmount: '',
    sharedWith: [],
    splitType: 'equal',
  });
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [showTransactionHistory, setShowTransactionHistory] = useState({});
  const [selectedPersonHistory, setSelectedPersonHistory] = useState(null);

  // Load contacts from database
  const allContacts = useLiveQuery(() => db.contacts.toArray(), []) || [];

  const frequentContacts = allContacts.slice(0, 3);
  const personSuggestions = allContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(personSearch.toLowerCase()) &&
      !newSharedExpense.sharedWith.some((s) => s.name === c.name)
  );

  // Live data
  const sharedExpenses =
    useLiveQuery(() => db.sharedExpenses.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthlyData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // Get relevant shared expenses from sharedExpenses table
    const relevantExpenses = sharedExpenses.filter(
      (expense) =>
        new Date(expense.date) >= monthStart &&
        new Date(expense.date) <= monthEnd
    );

    // Get relevant shared transactions from transactions table  
    const relevantSharedTransactions = transactions.filter(
      (transaction) => {
        if (!transaction.sharedWith || !Array.isArray(transaction.sharedWith) || transaction.sharedWith.length === 0) {
          return false;
        }
        const transactionDate = new Date(transaction.date);
        return transactionDate >= monthStart && transactionDate <= monthEnd;
      }
    );

    // Gruppiere Ausgaben nach Personen
    const personGroups = {};

    // Process shared expenses from sharedExpenses table
    relevantExpenses.forEach((expense) => {
      const paidByMe = expense.paidBy === 'Me';

      expense.sharedWith.forEach((person) => {
        if (!personGroups[person.name]) {
          personGroups[person.name] = {
            name: person.name,
            color: getNeonPersonColor(person.name),
            totalOwed: 0,
            totalPaid: 0,
            transactions: [],
          };
        }

        const group = personGroups[person.name];
        
        if (paidByMe) {
          // Ich habe bezahlt - die Person schuldet mir Geld
          group.totalOwed += person.amount;
        } else {
          // Die Person hat bezahlt - ich schulde ihr Geld  
          group.totalPaid += person.amount;
        }

        // Füge Transaktion zur Historie hinzu
        group.transactions.push({
          ...expense,
          personAmount: person.amount,
          paidByMe,
          source: 'sharedExpense'
        });
      });
    });

    // Process shared transactions from transactions table
    relevantSharedTransactions.forEach((transaction) => {
      // For shared transactions, I always paid (since they're my transactions split with others)
      const paidByMe = true;
      
      transaction.sharedWith.forEach((person) => {
        if (!person || !person.name) return; // Skip invalid persons
        
        if (!personGroups[person.name]) {
          personGroups[person.name] = {
            name: person.name,
            color: getNeonPersonColor(person.name),
            totalOwed: 0,
            totalPaid: 0,
            transactions: [],
          };
        }

        const group = personGroups[person.name];
        
        // Calculate person's share of the transaction
        // If amount is provided use it, otherwise split equally
        const totalSharers = transaction.sharedWith.length + 1; // +1 for me
        const personAmount = person.amount || Math.abs(transaction.amount) / totalSharers;
        
        // Ich habe bezahlt - die Person schuldet mir Geld  
        group.totalOwed += personAmount;

        // Füge Transaktion zur Historie hinzu
        group.transactions.push({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description || transaction.recipient || 'Geteilte Ausgabe',
          totalAmount: Math.abs(transaction.amount),
          personAmount: personAmount,
          paidByMe,
          source: 'transaction',
          category: transaction.category
        });
      });
    });

    // Konvertiere zu Array und berechne Netto-Beträge
    const data = Object.values(personGroups).map((group) => {
      const netAmount = group.totalOwed - group.totalPaid;
      
      return {
        ...group,
        netAmount, // Positiv = sie schulden mir, Negativ = ich schulde ihnen
        status: netAmount > 0 ? 'outstanding' : netAmount < 0 ? 'Iowe' : 'settled',
        absoluteAmount: Math.abs(netAmount),
      };
    });

    const summary = {
      iOwe: data
        .filter((d) => d.status === 'Iowe')
        .reduce((sum, d) => sum + d.absoluteAmount, 0),
      theyOweMe: data
        .filter((d) => d.status === 'outstanding')
        .reduce((sum, d) => sum + d.absoluteAmount, 0),
    };

    return { data, summary };
  }, [sharedExpenses, transactions, currentDate]);

  const toggleContactInShare = (contact) => {
    let newSharedWith = [...newSharedExpense.sharedWith];
    const isSelected = newSharedWith.some((c) => c.name === contact.name);

    if (isSelected) {
      newSharedWith = newSharedWith.filter((c) => c.name !== contact.name);
    } else {
      newSharedWith.push(contact);
    }
    setNewSharedExpense((prev) => ({ ...prev, sharedWith: newSharedWith }));
  };

  const handleAddPerson = async (name) => {
    const trimmedName = name.trim();
    if (
      !trimmedName ||
      newSharedExpense.sharedWith.some((c) => c.name === trimmedName)
    ) {
      setPersonSearch('');
      return;
    }
    
    let contact = allContacts.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (!contact) {
      // Create new contact in database
      contact = {
        name: trimmedName,
        color: getNeonPersonColor(trimmedName),
        createdAt: new Date().toISOString()
      };
      await db.contacts.add(contact);
    }

    toggleContactInShare(contact);
    setPersonSearch('');
    setShowPersonSuggestions(false);
  };

  const handleCreateSharedExpense = async () => {
    if (
      !newSharedExpense.description ||
      !newSharedExpense.totalAmount ||
      newSharedExpense.sharedWith.length === 0
    )
      return;

    const expense = {
      ...newSharedExpense,
      totalAmount: parseFloat(newSharedExpense.totalAmount),
      date: new Date().toISOString(),
      paidBy: 'Me', // Assuming for now that I always paid
      settledAmount: 0,
    };

    // Equal split calculation
    if (expense.splitType === 'equal') {
      const myShare = expense.totalAmount / (expense.sharedWith.length + 1);
      expense.sharedWith = expense.sharedWith.map((p) => ({
        ...p,
        amount: myShare,
      }));
    }

    setProcessingId('create');

    try {
      await db.sharedExpenses.add(expense);
      setShowCreateModal(false);
      setNewSharedExpense({
        description: '',
        totalAmount: '',
        sharedWith: [],
        splitType: 'equal',
      });
    } catch (error) {
      console.error('Error adding shared expense:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSettleUp = async (expenseId, amount, personName) => {
    setProcessingId(expenseId);
    try {
      const expense = await db.sharedExpenses.get(expenseId);
      if (!expense) return;

      const newSettledAmount = expense.settledAmount + amount;
      await db.sharedExpenses.update(expenseId, {
        settledAmount: newSettledAmount,
      });
    } catch (error) {
      console.error('Error settling up:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateMyShare = (personName, newAmount) => {
    setNewSharedExpense((prev) => ({
      ...prev,
      sharedWith: prev.sharedWith.map((p) =>
        p.name === personName
          ? { ...p, amount: parseFloat(newAmount) || 0 }
          : p
      ),
    }));
  };

  const myCalculatedShare = useMemo(() => {
    const totalSharedAmount = newSharedExpense.sharedWith.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    const myAmount =
      parseFloat(newSharedExpense.totalAmount) - totalSharedAmount;
    return myAmount >= 0 ? myAmount : 0;
  }, [newSharedExpense.totalAmount, newSharedExpense.sharedWith]);

  const renderInitial = (name) => {
    return name.charAt(0).toUpperCase();
  };
  
  const getRandomColor = () => {
    const colors = [jonyColors.accent1, jonyColors.accent2, jonyColors.magenta];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  };

  // Get transaction history with a specific person
  const getTransactionHistoryWithPerson = (personName) => {
    // Get all shared expenses involving this person
    const sharedExpensesWithPerson = sharedExpenses.filter(expense => 
      expense.sharedWith.some(p => p.name === personName)
    );

    // Get all shared transactions involving this person
    const sharedTransactionsWithPerson = transactions.filter(transaction =>
      transaction.sharedWith && 
      Array.isArray(transaction.sharedWith) && 
      transaction.sharedWith.some(p => p && p.name === personName)
    );

    // Get all regular transactions that might involve this person (based on recipient)
    const regularTransactionsWithPerson = transactions.filter(transaction => 
      transaction.recipient && transaction.recipient.toLowerCase().includes(personName.toLowerCase())
    );

    // Combine and format the history
    const combinedHistory = [
      // Shared expenses from sharedExpenses table
      ...sharedExpensesWithPerson.map(expense => ({
        id: expense.id,
        type: 'shared_expense',
        date: expense.date,
        description: expense.description,
        amount: expense.totalAmount,
        personShare: expense.sharedWith.find(p => p.name === personName)?.amount || 0,
        paidByMe: expense.paidBy === 'Me',
        settled: expense.settledAmount > 0
      })),
      // Shared transactions from transactions table
      ...sharedTransactionsWithPerson.map(transaction => {
        const person = transaction.sharedWith.find(p => p && p.name === personName);
        const totalSharers = transaction.sharedWith.length + 1; // +1 for me
        const personShare = person?.amount || Math.abs(transaction.amount) / totalSharers;
        
        return {
          id: transaction.id,
          type: 'shared_transaction',
          date: transaction.date,
          description: transaction.description || transaction.recipient || 'Geteilte Ausgabe',
          amount: Math.abs(transaction.amount),
          personShare: personShare,
          paidByMe: true, // I always paid for my transactions
          settled: false, // Shared transactions are not settled via this system
          category: transaction.category
        };
      }),
      // Regular transactions that might involve this person
      ...regularTransactionsWithPerson.map(transaction => ({
        id: transaction.id,
        type: 'transaction',
        date: transaction.date,
        description: transaction.description,
        recipient: transaction.recipient,
        amount: transaction.amount,
        account: transaction.account
      }))
    ];

    // Sort by date (newest first)
    return combinedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const toggleTransactionHistory = (personName) => {
    setShowTransactionHistory(prev => ({
      ...prev,
      [personName]: !prev[personName]
    }));
    
    if (!showTransactionHistory[personName]) {
      setSelectedPersonHistory(personName);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="px-6 py-8 mb-2">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Geteilte Ausgaben
              </h1>
              {sharedExpenses.length > 0 && (
                <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ backgroundColor: jonyColors.accent1Alpha, color: jonyColors.accent1 }}>
                  {sharedExpenses.length}
                </div>
              )}
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousMonth}
                className="p-3 rounded-full transition-all duration-200 hover:scale-105 focus:outline-none"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                  // Also style the icon inside
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                  // Reset icon color
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.textSecondary;
                }}
                title="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5 pointer-events-none transition-colors duration-200" style={{ color: jonyColors.textSecondary }} />
              </button>
              <div className="font-semibold text-center" style={{ color: jonyColors.textPrimary, minWidth: '200px', fontSize: '20px' }}>
                {currentDate.toLocaleDateString('de-DE', {
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <button
                onClick={goToNextMonth}
                className="p-3 rounded-full transition-all duration-200 hover:scale-105 focus:outline-none"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                  // Also style the icon inside
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                  // Reset icon color
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.textSecondary;
                }}
                title="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5 pointer-events-none transition-colors duration-200" style={{ color: jonyColors.textSecondary }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">

          {sharedExpenses.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center p-12 rounded-3xl border-2" style={{
                backgroundColor: jonyColors.surface,
                border: `2px solid ${jonyColors.border}`,
                width: '400px',
                minHeight: '300px'
              }}>
                <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl" style={{
                  backgroundColor: jonyColors.accent1
                }}>
                  <Users className="w-12 h-12" style={{ color: jonyColors.background }} />
                </div>
                <h2 className="text-3xl font-black mb-4" style={{ color: jonyColors.textPrimary }}>
                  Keine geteilten Ausgaben
                </h2>
                <p className="text-lg leading-relaxed" style={{ color: jonyColors.textSecondary }}>
                  Erstelle deine erste geteilte Ausgabe, um den Überblick zu behalten, wer dir was schuldet.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                <div>
                  <div className="text-3xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                    {formatCurrency(monthlyData.summary.theyOweMe)}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                    Dir wird geschuldet
                  </div>
                  <div className="text-xs mt-1" style={{ color: jonyColors.textSecondary }}>
                    Insgesamt ausstehend
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                <div>
                  <div className="text-3xl font-bold mb-2" style={{ color: jonyColors.magenta }}>
                    {formatCurrency(monthlyData.summary.iOwe)}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                    Du schuldest
                  </div>
                  <div className="text-xs mt-1" style={{ color: jonyColors.textSecondary }}>
                    Insgesamt offen
                  </div>
                </div>
              </div>
            </div>
          )}

          {monthlyData.data.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-6" style={{ color: jonyColors.textPrimary }}>
                Ausgaben dieses Monats
              </h2>
              <div className="space-y-6">
                {monthlyData.data.map((person) => (
                  <div
                    key={person.name}
                    className="rounded-2xl p-6 border"
                    style={{ backgroundColor: jonyColors.surface, border: `1px solid ${jonyColors.border}` }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg`}
                          style={{ backgroundColor: person.color, color: jonyColors.background }}
                        >
                          {renderInitial(person.name)}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>
                            {person.name}
                          </h3>
                          <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                            {person.transactions.length} Transaktion{person.transactions.length !== 1 ? 'en' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                          {formatCurrency(person.absoluteAmount)}
                        </div>
                        {person.status === 'outstanding' ? (
                          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: jonyColors.accent1 }}>
                            <ArrowUp className="w-4 h-4" />
                            <span>Schuldet dir</span>
                          </div>
                        ) : person.status === 'Iowe' ? (
                          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: jonyColors.magenta }}>
                            <ArrowDown className="w-4 h-4" />
                            <span>Du schuldest</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: jonyColors.textSecondary }}>
                            <span>Ausgeglichen</span>
                          </div>
                        )}
                      </div>
                  </div>

                    <div className="flex items-center gap-3 pt-4" style={{ borderTop: `1px solid ${jonyColors.border}` }}>
                      <button
                        onClick={() => toggleTransactionHistory(person.name)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textSecondary
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = jonyColors.accent1Alpha;
                          e.target.style.color = jonyColors.accent1;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = jonyColors.cardBackground;
                          e.target.style.color = jonyColors.textSecondary;
                        }}
                      >
                        <History className="w-4 h-4" />
                        <span>Historie anzeigen</span>
                        {showTransactionHistory[person.name] ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                        }
                      </button>
                      
                      {person.status !== 'settled' && (
                        <button
                          onClick={() =>
                            handleSettleUp(
                              person.transactions[0]?.id || 'manual', 
                              person.absoluteAmount,
                              person.name
                            )
                          }
                          disabled={processingId === person.name}
                          className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                          style={{
                            backgroundColor: jonyColors.accent2Alpha,
                            color: jonyColors.accent2
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = jonyColors.accent2;
                            e.target.style.color = jonyColors.background;
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = jonyColors.accent2Alpha;
                            e.target.style.color = jonyColors.accent2;
                          }}
                        >
                          Ausgleichen
                        </button>
                      )}
                    </div>

                    {/* Transaction History */}
                    {showTransactionHistory[person.name] && (
                      <div className="mt-4 p-4 rounded-xl border" style={{
                        backgroundColor: jonyColors.cardBackground,
                        border: `1px solid ${jonyColors.cardBorder}`
                      }}>
                        <div className="flex items-center gap-2 mb-4">
                          <History className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                          <h4 className="font-semibold" style={{ color: jonyColors.textPrimary }}>
                            Transaktionshistorie mit {person.name}
                          </h4>
                        </div>
                      
                        <div className="space-y-3">
                          {person.transactions.map((transaction, index) => (
                            <div key={`${transaction.id}-${index}`} className="flex items-center justify-between p-3 rounded-lg" style={{
                              backgroundColor: jonyColors.surface
                            }}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold`} style={{ 
                                  backgroundColor: person.color,
                                  color: jonyColors.background
                                }}>
                                  {transaction.paidByMe ? '←' : '→'}
                                </div>
                                <div>
                                  <p className="font-medium" style={{ color: jonyColors.textPrimary }}>
                                    {transaction.description}
                                  </p>
                                  <p className="text-xs" style={{ color: jonyColors.textSecondary }}>
                                    {new Date(transaction.date).toLocaleDateString('de-DE')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold" style={{
                                  color: transaction.paidByMe ? jonyColors.accent1 : jonyColors.magenta
                                }}>
                                  {formatCurrency(transaction.personAmount)}
                                </p>
                                <p className="text-xs" style={{ color: jonyColors.textSecondary }}>
                                  {transaction.paidByMe ? 'Schuldet dir' : 'Du schuldest'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {monthlyData.data.length === 0 && sharedExpenses.length > 0 && (
            <div className="mt-8 text-center py-16 border-2 border-dashed rounded-2xl" style={{
              borderColor: jonyColors.border
            }}>
              <Users className="w-12 h-12 mx-auto" style={{ color: jonyColors.textSecondary }} />
              <h3 className="mt-4 text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                Keine geteilten Ausgaben für diesen Monat
              </h3>
              <p className="mt-1 text-sm" style={{ color: jonyColors.textSecondary }}>
                Wähle einen anderen Monat oder erstelle eine neue Ausgabe.
              </p>
            </div>
          )}
      </div>

      {/* Fixed Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-110 z-50"
        style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
        title="Neue Ausgabe"
      >
        <Plus className="w-6 h-6" />
      </button>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="rounded-2xl max-w-md w-full p-8 shadow-2xl" style={{ backgroundColor: jonyColors.surface }}>
              <h2 className="text-xl font-semibold mb-8 text-center" style={{ color: jonyColors.textPrimary }}>Geteilte Ausgabe hinzufügen</h2>
              
              <div className="space-y-5">
                <div>
                  <input
                    type="text"
                    value={newSharedExpense.description}
                    onChange={(e) =>
                      setNewSharedExpense((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Beschreibung (z.B. Essen gehen mit Freunden)"
                    className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`,
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    step="0.01"
                    value={newSharedExpense.totalAmount}
                    onChange={(e) =>
                      setNewSharedExpense((prev) => ({
                        ...prev,
                        totalAmount: e.target.value,
                      }))
                    }
                    placeholder="Gesamtbetrag (€)"
                    className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`,
                      outline: 'none'
                    }}
                  />
                </div>

              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    onFocus={() => setShowPersonSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleAddPerson(personSearch)
                    }
                    placeholder="Person hinzufügen..."
                    className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`,
                      outline: 'none'
                    }}
                  />
                  {showPersonSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {personSuggestions.map((person) => (
                        <div
                          key={person.name}
                          onClick={() => handleAddPerson(person.name)}
                          className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm"
                        >
                          {person.name}
                        </div>
                      ))}
                      {personSearch &&
                        !allContacts.some(
                          (c) => c.name.toLowerCase() === personSearch.toLowerCase()
                        ) && (
                          <div
                            onClick={() => handleAddPerson(personSearch)}
                            className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4 text-indigo-500" />
                            <span className="font-semibold">
                              "{personSearch}" hinzufügen
                            </span>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                  {newSharedExpense.sharedWith.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium mb-2" style={{ color: jonyColors.textSecondary }}>
                        Kontakte
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {newSharedExpense.sharedWith.map((person) => (
                          <div
                            key={person.name}
                            className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
                            style={{
                              backgroundColor: jonyColors.accent1Alpha,
                              color: jonyColors.accent1
                            }}
                          >
                            {person.name}
                            <button
                              onClick={() => toggleContactInShare(person)}
                              className="ml-1 transition-colors duration-200"
                              style={{ color: jonyColors.accent1 }}
                              onMouseEnter={(e) => {
                                e.target.style.color = jonyColors.red;
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.color = jonyColors.accent1;
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
                    Aufteilung
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() =>
                        setNewSharedExpense((prev) => ({
                          ...prev,
                          splitType: 'equal',
                        }))
                      }
                      className="flex-1 px-4 py-2 rounded-xl border-2 transition-colors"
                      style={{
                        backgroundColor: newSharedExpense.splitType === 'equal' ? jonyColors.accent1Alpha : jonyColors.cardBackground,
                        borderColor: newSharedExpense.splitType === 'equal' ? jonyColors.accent1 : jonyColors.cardBorder,
                        color: newSharedExpense.splitType === 'equal' ? jonyColors.accent1 : jonyColors.textSecondary
                      }}
                    >
                      Gleich
                    </button>
                    <button
                      onClick={() =>
                        setNewSharedExpense((prev) => ({
                          ...prev,
                          splitType: 'custom',
                        }))
                      }
                      className="flex-1 px-4 py-2 rounded-xl border-2 transition-colors"
                      style={{
                        backgroundColor: newSharedExpense.splitType === 'custom' ? jonyColors.accent1Alpha : jonyColors.cardBackground,
                        borderColor: newSharedExpense.splitType === 'custom' ? jonyColors.accent1 : jonyColors.cardBorder,
                        color: newSharedExpense.splitType === 'custom' ? jonyColors.accent1 : jonyColors.textSecondary
                      }}
                    >
                      Individuell
                    </button>
                  </div>
                </div>

              {newSharedExpense.splitType === 'custom' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: jonyColors.cardBackground }}>
                    <span className="font-semibold" style={{ color: jonyColors.textPrimary }}>Dein Anteil</span>
                    <span className="font-bold text-lg" style={{ color: jonyColors.textPrimary }}>
                      {formatCurrency(myCalculatedShare)}
                    </span>
                  </div>
                  {newSharedExpense.sharedWith.map((person) => (
                    <div
                      key={person.name}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{ backgroundColor: jonyColors.cardBackground }}
                    >
                      <span className="font-semibold" style={{ color: jonyColors.textPrimary }}>{person.name}</span>
                      <input
                        type="number"
                        value={person.amount}
                        onChange={(e) =>
                          handleUpdateMyShare(person.name, e.target.value)
                        }
                        className="w-32 px-4 py-3 text-right rounded-xl text-base transition-all duration-200"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          border: `1px solid ${jonyColors.border}`,
                          outline: 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-4 rounded-xl font-medium transition-all duration-200"
                  style={{
                    backgroundColor: 'transparent',
                    color: jonyColors.textSecondary,
                    border: `1px solid ${jonyColors.border}`
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateSharedExpense}
                  disabled={
                    processingId === 'create' || !newSharedExpense.description || !newSharedExpense.totalAmount
                  }
                  className="flex-1 px-6 py-4 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: jonyColors.accent1, 
                    color: '#000000',
                    border: 'none'
                  }}
                >
                  {processingId === 'create' ? 'Erstelle...' : 'Hinzufügen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedExpensesPage;