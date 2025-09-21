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
  const [splitSettings, setSplitSettings] = useState({}); // Format: { personName: { myShare: number, showSplitControl: boolean } }

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

  // Prüfe ob überhaupt geteilte Ausgaben existieren (sowohl in sharedExpenses als auch in transactions)
  const hasAnySharedExpenses = useMemo(() => {
    const hasSharedExpenses = sharedExpenses.length > 0;
    const hasSharedTransactions = transactions.some(t => 
      t.sharedWith && Array.isArray(t.sharedWith) && t.sharedWith.length > 0
    );
    return hasSharedExpenses || hasSharedTransactions;
  }, [sharedExpenses, transactions]);

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
        // Überspringe ausgeglichene Ausgaben für diese spezifische Person
        const isSettledWithThisPerson = expense.settledWithPersons && 
                                       expense.settledWithPersons.includes(person.name);
        if (isSettledWithThisPerson) return;
        
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
        
        if (paidByMe && !expense.paidByThem) {
          // Ich habe bezahlt - die Person schuldet mir Geld (nur wenn sie noch nicht bezahlt hat)
          group.totalOwed += person.amount;
        } else if (!paidByMe) {
          // Die Person hat bezahlt - ich schulde ihr Geld  
          group.totalPaid += person.amount;
        }

        // Füge Transaktion zur Historie hinzu
        group.transactions.push({
          ...expense,
          personAmount: person.amount,
          paidByMe,
          source: 'sharedExpense',
          isFromSharedExpenses: true,
          settledWithPersons: expense.settledWithPersons
        });
      });
    });

    // Process shared transactions from transactions table
    relevantSharedTransactions.forEach((transaction) => {
      // For shared transactions, I always paid (since they're my transactions split with others)
      const paidByMe = true;
      
      transaction.sharedWith.forEach((person) => {
        if (!person || !person.name) return; // Skip invalid persons
        
        // Überspringe ausgeglichene Transaktionen für diese spezifische Person
        const isSettledWithThisPerson = transaction.settledWithPersons && 
                                       transaction.settledWithPersons.includes(person.name);
        if (isSettledWithThisPerson) return;
        
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
        
        // Ich habe bezahlt - die Person schuldet mir Geld (nur wenn sie noch nicht bezahlt hat)
        if (!transaction.paidByThem) {
          group.totalOwed += personAmount;
        }

        // Füge Transaktion zur Historie hinzu
        group.transactions.push({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description || transaction.recipient || 'Geteilte Ausgabe',
          totalAmount: Math.abs(transaction.amount),
          personAmount: personAmount,
          paidByMe,
          source: 'transaction',
          category: transaction.category,
          isFromSharedExpenses: false,
          settledWithPersons: transaction.settledWithPersons
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

  // Funktion für einzelne Ausgaben begleichen - KORREKTE LOGIK
  const handleMarkSingleExpenseAsPaid = async (expenseId, personName, isSharedExpense = true) => {
    setProcessingId(`single-${expenseId}-${personName}`);
    try {
      if (isSharedExpense) {
        // Für SharedExpenses: Nur als settled markieren
        const expense = sharedExpenses.find(e => e.id === expenseId);
        if (!expense) return;
        
        const currentSettledWith = expense.settledWithPersons || [];
        const updatedSettledWith = [...currentSettledWith];
        if (!updatedSettledWith.includes(personName)) {
          updatedSettledWith.push(personName);
        }
        await db.sharedExpenses.update(expense.id, { settledWithPersons: updatedSettledWith });
        
      } else {
        // Für normale Transaktionen: Betrag der ursprünglichen Transaktion reduzieren
        const transaction = transactions.find(t => t.id === expenseId);
        if (!transaction) return;
        
        // Finde den Anteil der Person
        const person = transaction.sharedWith.find(p => p.name === personName);
        let personShare = person?.amount;
        
        // Fallback: Wenn kein spezifischer Betrag definiert ist, muss das Transaction-System dies definieren
        // Für jetzt: Warnung und einfache gleichmäßige Aufteilung
        if (!personShare) {
          console.warn('Person amount not defined, using equal split. Transaction:', transaction.id, 'Person:', personName);
          const totalSharers = transaction.sharedWith.length + 1; // +1 für mich
          personShare = Math.abs(transaction.amount) / totalSharers;
        }
        
        // Reduziere den Betrag der ursprünglichen Transaktion
        const newAmount = transaction.amount + personShare; // Da amount negativ ist, addieren wir
        
        // Markiere Person als settled
        const currentSettledWith = transaction.settledWithPersons || [];
        const updatedSettledWith = [...currentSettledWith];
        if (!updatedSettledWith.includes(personName)) {
          updatedSettledWith.push(personName);
        }
        
        // Speichere den ursprünglichen Betrag beim ersten Settlement
        const updateData = { 
          amount: newAmount,
          settledWithPersons: updatedSettledWith 
        };
        
        // Wenn noch kein originalAmount gesetzt ist, speichere den aktuellen Betrag als original
        if (!transaction.originalAmount) {
          updateData.originalAmount = transaction.amount;
        }
        
        // Update die Transaktion
        await db.transactions.update(transaction.id, updateData);
      }
      
    } catch (error) {
      console.error('Fehler beim Begleichen der einzelnen Ausgabe:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsPaid = async (personName) => {
    setProcessingId(`paid-${personName}`);
    try {
      // Finde alle aktuell sichtbaren, noch nicht ausgeglichenen Ausgaben für diese Person
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      // SharedExpenses für diese Person
      const relevantExpenses = sharedExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const isInMonth = expenseDate >= monthStart && expenseDate <= monthEnd;
        const involvesThisPerson = expense.sharedWith.some(p => p.name === personName);
        const notSettledWithThisPerson = !expense.settledWithPersons || !expense.settledWithPersons.includes(personName);
        
        return isInMonth && involvesThisPerson && notSettledWithThisPerson;
      });

      // Normale Transaktionen mit sharedWith für diese Person
      const relevantTransactions = transactions.filter(transaction => {
        if (!transaction.sharedWith || !Array.isArray(transaction.sharedWith)) return false;
        const transactionDate = new Date(transaction.date);
        const isInMonth = transactionDate >= monthStart && transactionDate <= monthEnd;
        const involvesThisPerson = transaction.sharedWith.some(p => p && p.name === personName);
        const notSettledWithThisPerson = !transaction.settledWithPersons || !transaction.settledWithPersons.includes(personName);
        
        return isInMonth && involvesThisPerson && notSettledWithThisPerson;
      });

      // Begleiche alle SharedExpenses für diese Person
      for (const expense of relevantExpenses) {
        await handleMarkSingleExpenseAsPaid(expense.id, personName, true);
      }

      // Begleiche alle normalen Transaktionen für diese Person
      for (const transaction of relevantTransactions) {
        await handleMarkSingleExpenseAsPaid(transaction.id, personName, false);
      }

    } catch (error) {
      console.error('Error marking as paid:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSettleUp = async (expenseId, amount, personName) => {
    setProcessingId(expenseId);
    try {
      // Finde alle Transaktionen für diese Person im aktuellen Monat
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      // Finde alle relevanten geteilten Transaktionen für diese Person
      const relevantSharedTransactions = transactions.filter(transaction => {
        if (!transaction.sharedWith || !Array.isArray(transaction.sharedWith)) return false;
        const transactionDate = new Date(transaction.date);
        return transactionDate >= monthStart && 
               transactionDate <= monthEnd &&
               transaction.sharedWith.some(p => p && p.name === personName);
      });

      // Für jede geteilte Transaktion: Erstelle eine neue "mein Anteil" Transaktion
      const myShareTransactions = [];
      
      for (const sharedTransaction of relevantSharedTransactions) {
        const person = sharedTransaction.sharedWith.find(p => p && p.name === personName);
        const totalSharers = sharedTransaction.sharedWith.length + 1; // +1 für mich
        const myShare = person?.amount || Math.abs(sharedTransaction.amount) / totalSharers;
        
        // Erstelle neue Transaktion für erhaltenen Betrag
        const myShareTransaction = {
          date: new Date().toISOString(),
          description: `Von ${personName} erhalten: ${sharedTransaction.description || sharedTransaction.recipient || 'Geteilte Ausgabe'}`,
          recipient: personName,
          amount: myShare, // Positiver Betrag = Einnahme
          category: sharedTransaction.category,
          account: sharedTransaction.account,
          settledFromSharedExpense: true,
          originalSharedTransactionId: sharedTransaction.id,
          createdAt: new Date().toISOString()
        };
        
        myShareTransactions.push(myShareTransaction);
      }

      // Finde relevante SharedExpenses für diese Person
      const relevantSharedExpenses = sharedExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= monthStart && 
               expenseDate <= monthEnd &&
               expense.sharedWith.some(p => p.name === personName);
      });

      // Für jede SharedExpense: Erstelle eine neue "mein Anteil" Transaktion
      for (const expense of relevantSharedExpenses) {
        const person = expense.sharedWith.find(p => p.name === personName);
        const myShare = person?.amount || 0;
        
        if (myShare > 0) {
          const myShareTransaction = {
            date: new Date().toISOString(),
            description: `Von ${personName} erhalten: ${expense.description}`,
            recipient: personName,
            amount: myShare, // Positiver Betrag = Einnahme
            category: 'Geteilte Ausgaben',
            account: 'Shared Settlement',
            settledFromSharedExpense: true,
            originalSharedExpenseId: expense.id,
            createdAt: new Date().toISOString()
          };
          
          myShareTransactions.push(myShareTransaction);
        }
      }

      // Füge alle "mein Anteil" Transaktionen zur Datenbank hinzu
      if (myShareTransactions.length > 0) {
        await db.transactions.bulkAdd(myShareTransactions);
      }

      // Markiere die ursprünglichen geteilten Transaktionen als "ausgeglichen" für diese spezifische Person
      const transactionUpdates = relevantSharedTransactions.map(t => {
        const currentSettledWith = t.settledWithPersons || [];
        const updatedSettledWith = [...currentSettledWith];
        if (!updatedSettledWith.includes(personName)) {
          updatedSettledWith.push(personName);
        }
        return db.transactions.update(t.id, { settledWithPersons: updatedSettledWith });
      });
      
      const expenseUpdates = relevantSharedExpenses.map(e => {
        const currentSettledWith = e.settledWithPersons || [];
        const updatedSettledWith = [...currentSettledWith];
        if (!updatedSettledWith.includes(personName)) {
          updatedSettledWith.push(personName);
        }
        return db.sharedExpenses.update(e.id, { settledWithPersons: updatedSettledWith });
      });

      await Promise.all([...transactionUpdates, ...expenseUpdates]);

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
        settled: expense.settledAmount > 0,
        isFromSharedExpenses: true,
        settledWithPersons: expense.settledWithPersons
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
          category: transaction.category,
          isFromSharedExpenses: false,
          settledWithPersons: transaction.settledWithPersons
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

  const toggleSplitControl = (personName, totalAmount) => {
    setSplitSettings(prev => ({
      ...prev,
      [personName]: {
        myShare: prev[personName]?.myShare || totalAmount / 2, // Default: 50% Split
        showSplitControl: !prev[personName]?.showSplitControl
      }
    }));
  };

  const updateMyShare = (personName, newShare) => {
    setSplitSettings(prev => ({
      ...prev,
      [personName]: {
        ...prev[personName],
        myShare: newShare
      }
    }));
  };

  // Prüfe ob eine Person vollständig bezahlt/ausgeglichen hat (nur für aktuell sichtbare Transaktionen)
  const getPersonPaymentStatus = (personName) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // Finde nur aktuell sichtbare/relevante Transaktionen (noch nicht ausgeglichene)
    const visibleSharedTransactions = transactions.filter(transaction => {
      if (!transaction.sharedWith || !Array.isArray(transaction.sharedWith)) return false;
      const transactionDate = new Date(transaction.date);
      const isInMonth = transactionDate >= monthStart && transactionDate <= monthEnd;
      const involvesThisPerson = transaction.sharedWith.some(p => p && p.name === personName);
      const notSettledWithThisPerson = !transaction.settledWithPersons || !transaction.settledWithPersons.includes(personName);
      
      return isInMonth && involvesThisPerson && notSettledWithThisPerson;
    });

    const visibleSharedExpenses = sharedExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const isInMonth = expenseDate >= monthStart && expenseDate <= monthEnd;
      const involvesThisPerson = expense.sharedWith.some(p => p.name === personName);
      const notSettledWithThisPerson = !expense.settledWithPersons || !expense.settledWithPersons.includes(personName);
      
      return isInMonth && involvesThisPerson && notSettledWithThisPerson;
    });

    // Prüfe ob alle sichtbaren Transaktionen als bezahlt markiert sind
    const allVisibleTransactionsPaid = visibleSharedTransactions.length === 0 || 
      visibleSharedTransactions.every(t => t.paidByThem === true);
    
    const allVisibleExpensesPaid = visibleSharedExpenses.length === 0 || 
      visibleSharedExpenses.every(e => e.paidByThem === true);

    const hasVisibleTransactions = visibleSharedTransactions.length > 0 || visibleSharedExpenses.length > 0;

    return {
      fullyPaid: allVisibleTransactionsPaid && allVisibleExpensesPaid && hasVisibleTransactions,
      hasTransactions: hasVisibleTransactions
    };
  };

  const applyCustomSplit = async (personName, myShare, totalAmount) => {
    setProcessingId(`split-${personName}`);
    try {
      // Ähnlich wie handleSettleUp, aber mit custom Split-Anteil
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      // Finde relevante geteilte Transaktionen für diese Person
      const relevantSharedTransactions = transactions.filter(transaction => {
        if (!transaction.sharedWith || !Array.isArray(transaction.sharedWith)) return false;
        const transactionDate = new Date(transaction.date);
        return transactionDate >= monthStart && 
               transactionDate <= monthEnd &&
               transaction.sharedWith.some(p => p && p.name === personName);
      });

      // Finde relevante SharedExpenses für diese Person
      const relevantSharedExpenses = sharedExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= monthStart && 
               expenseDate <= monthEnd &&
               expense.sharedWith.some(p => p.name === personName);
      });

      // Erstelle "mein Anteil" Transaktionen mit custom Split
      const myShareTransactions = [];
      
      for (const sharedTransaction of relevantSharedTransactions) {
        const myShareTransaction = {
          date: new Date().toISOString(),
          description: `Von ${personName} erhalten (${Math.round(myShare/Math.abs(sharedTransaction.amount)*100)}%): ${sharedTransaction.description || sharedTransaction.recipient || 'Geteilte Ausgabe'}`,
          recipient: personName,
          amount: myShare, // Positiver Betrag = Einnahme
          category: sharedTransaction.category,
          account: sharedTransaction.account,
          settledFromSharedExpense: true,
          originalSharedTransactionId: sharedTransaction.id,
          customSplitPercentage: myShare/Math.abs(sharedTransaction.amount)*100,
          createdAt: new Date().toISOString()
        };
        
        myShareTransactions.push(myShareTransaction);
      }

      for (const expense of relevantSharedExpenses) {
        const myShareTransaction = {
          date: new Date().toISOString(),
          description: `Von ${personName} erhalten (${Math.round(myShare/expense.totalAmount*100)}%): ${expense.description}`,
          recipient: personName,
          amount: myShare, // Positiver Betrag = Einnahme
          category: 'Geteilte Ausgaben',
          account: 'Shared Settlement',
          settledFromSharedExpense: true,
          originalSharedExpenseId: expense.id,
          customSplitPercentage: myShare/expense.totalAmount*100,
          createdAt: new Date().toISOString()
        };
        
        myShareTransactions.push(myShareTransaction);
      }

      // Füge alle "mein Anteil" Transaktionen zur Datenbank hinzu
      if (myShareTransactions.length > 0) {
        await db.transactions.bulkAdd(myShareTransactions);
      }

      // Markiere die ursprünglichen geteilten Transaktionen als "ausgeglichen" für diese spezifische Person
      const transactionUpdates = relevantSharedTransactions.map(t => {
        const currentSettledWith = t.settledWithPersons || [];
        const updatedSettledWith = [...currentSettledWith];
        if (!updatedSettledWith.includes(personName)) {
          updatedSettledWith.push(personName);
        }
        return db.transactions.update(t.id, { settledWithPersons: updatedSettledWith });
      });
      
      const expenseUpdates = relevantSharedExpenses.map(e => {
        const currentSettledWith = e.settledWithPersons || [];
        const updatedSettledWith = [...currentSettledWith];
        if (!updatedSettledWith.includes(personName)) {
          updatedSettledWith.push(personName);
        }
        return db.sharedExpenses.update(e.id, { settledWithPersons: updatedSettledWith });
      });

      await Promise.all([...transactionUpdates, ...expenseUpdates]);

      // Verstecke Split-Control nach erfolgreichem Anwenden
      setSplitSettings(prev => ({
        ...prev,
        [personName]: {
          ...prev[personName],
          showSplitControl: false
        }
      }));

    } catch (error) {
      console.error('Error applying custom split:', error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: ${jonyColors.accent1};
          border: 2px solid ${jonyColors.background};
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: ${jonyColors.accent1};
          border: 2px solid ${jonyColors.background};
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
      `}</style>
      <div className="px-6 py-8 mb-2">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Geteilte Ausgaben
              </h1>
              {hasAnySharedExpenses && (
                <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ backgroundColor: jonyColors.accent1Alpha, color: jonyColors.accent1 }}>
                  {sharedExpenses.length + transactions.filter(t => t.sharedWith && Array.isArray(t.sharedWith) && t.sharedWith.length > 0).length}
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

          {!hasAnySharedExpenses ? (
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
                        {(() => {
                          const paymentStatus = getPersonPaymentStatus(person.name);
                          const isPaid = paymentStatus.fullyPaid && paymentStatus.hasTransactions;
                          const avatarColor = isPaid ? jonyColors.greenMedium : jonyColors.magenta;
                          
                          return (
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg transition-all duration-300`}
                                style={{ backgroundColor: avatarColor, color: jonyColors.background }}
                              >
                                {renderInitial(person.name)}
                              </div>
                              {isPaid && (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: jonyColors.greenMedium }}></div>
                                  <span className="text-xs font-semibold" style={{ color: jonyColors.greenMedium }}>
                                    Bezahlt
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                      
                      {(() => {
                        const paymentStatus = getPersonPaymentStatus(person.name);
                        const isPaid = paymentStatus.fullyPaid && paymentStatus.hasTransactions;
                        
                        if (isPaid) {
                          return (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{
                              backgroundColor: jonyColors.greenAlpha,
                              border: `1px solid ${jonyColors.greenMedium}`
                            }}>
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: jonyColors.greenMedium }}></div>
                              <span className="text-sm font-semibold" style={{ color: jonyColors.greenMedium }}>
                                Vollständig beglichen
                              </span>
                            </div>
                          );
                        }
                        
                        if (person.status !== 'settled') {
                          return (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(person.name)}
                                disabled={processingId === `paid-${person.name}`}
                                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                                style={{
                                  backgroundColor: jonyColors.greenAlpha,
                                  color: jonyColors.greenMedium
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = jonyColors.greenMedium;
                                  e.target.style.color = jonyColors.background;
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = jonyColors.greenAlpha;
                                  e.target.style.color = jonyColors.greenMedium;
                                }}
                              >
                                {processingId === `paid-${person.name}` ? 'Wird gespeichert...' : 'Hat bezahlt'}
                              </button>
                              <button
                                onClick={() => toggleSplitControl(person.name, person.absoluteAmount)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                                style={{
                                  backgroundColor: splitSettings[person.name]?.showSplitControl ? jonyColors.orange : jonyColors.accent2Alpha,
                                  color: splitSettings[person.name]?.showSplitControl ? jonyColors.background : jonyColors.accent2
                                }}
                                onMouseEnter={(e) => {
                                  if (!splitSettings[person.name]?.showSplitControl) {
                                    e.target.style.backgroundColor = jonyColors.accent2;
                                    e.target.style.color = jonyColors.background;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!splitSettings[person.name]?.showSplitControl) {
                                    e.target.style.backgroundColor = jonyColors.accent2Alpha;
                                    e.target.style.color = jonyColors.accent2;
                                  }
                                }}
                              >
                                {splitSettings[person.name]?.showSplitControl ? 'Split schließen' : 'Split anpassen'}
                              </button>
                            </>
                          );
                        }
                        
                        return null;
                      })()}
                    </div>

                    {/* Minimalistisches Split Control */}
                    {splitSettings[person.name]?.showSplitControl && (
                      <div className="mt-4 p-4 rounded-xl" style={{
                        backgroundColor: jonyColors.surface,
                        border: `1px solid ${jonyColors.cardBorder}`
                      }}>
                        <div className="space-y-3">
                          {/* Kompakte Header-Zeile */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>
                              Mein Anteil von {formatCurrency(person.absoluteAmount)}
                            </span>
                            <span className="text-xs" style={{ color: jonyColors.textSecondary }}>
                              {Math.round(((splitSettings[person.name]?.myShare || person.absoluteAmount / 2) / person.absoluteAmount) * 100)}%
                            </span>
                          </div>
                          
                          {/* Kompakte Eingabe-Zeile */}
                          <div className="flex items-center gap-3">
                            {/* Direkte Betragseingabe */}
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max={person.absoluteAmount}
                                step="0.01"
                                value={splitSettings[person.name]?.myShare || person.absoluteAmount / 2}
                                onChange={(e) => updateMyShare(person.name, parseFloat(e.target.value) || 0)}
                                className="w-20 px-3 py-2 text-sm rounded-lg border transition-all duration-200"
                                style={{
                                  backgroundColor: jonyColors.cardBackground,
                                  color: jonyColors.textPrimary,
                                  border: `1px solid ${jonyColors.cardBorder}`,
                                  outline: 'none'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = jonyColors.accent1;
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = jonyColors.cardBorder;
                                }}
                              />
                              <span className="text-sm" style={{ color: jonyColors.textSecondary }}>€</span>
                            </div>
                            
                            {/* Kompakter Slider */}
                            <input
                              type="range"
                              min="0"
                              max={person.absoluteAmount}
                              step="0.01"
                              value={splitSettings[person.name]?.myShare || person.absoluteAmount / 2}
                              onChange={(e) => updateMyShare(person.name, parseFloat(e.target.value))}
                              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer slider"
                              style={{
                                background: `linear-gradient(to right, ${jonyColors.accent1} 0%, ${jonyColors.accent1} ${((splitSettings[person.name]?.myShare || person.absoluteAmount / 2) / person.absoluteAmount) * 100}%, ${jonyColors.cardBorder} ${((splitSettings[person.name]?.myShare || person.absoluteAmount / 2) / person.absoluteAmount) * 100}%, ${jonyColors.cardBorder} 100%)`
                              }}
                            />
                            
                            {/* Kompakter Apply Button */}
                            <button
                              onClick={() => applyCustomSplit(
                                person.name, 
                                splitSettings[person.name]?.myShare || person.absoluteAmount / 2,
                                person.absoluteAmount
                              )}
                              disabled={processingId === `split-${person.name}`}
                              className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap"
                              style={{
                                backgroundColor: jonyColors.accent1,
                                color: jonyColors.background
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = jonyColors.greenMedium;
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = jonyColors.accent1;
                              }}
                            >
                              {processingId === `split-${person.name}` ? 'Wird gespeichert...' : 'Anwenden'}
                            </button>
                          </div>
                          
                          {/* Schnelle Prozent-Buttons */}
                          <div className="flex gap-2 justify-center">
                            {[25, 50, 75].map(percent => (
                              <button
                                key={percent}
                                onClick={() => updateMyShare(person.name, (person.absoluteAmount * percent) / 100)}
                                className="px-3 py-1 text-xs rounded-md transition-all duration-200"
                                style={{
                                  backgroundColor: jonyColors.cardBackground,
                                  color: jonyColors.textSecondary,
                                  border: `1px solid ${jonyColors.cardBorder}`
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                                  e.target.style.borderColor = jonyColors.accent1;
                                  e.target.style.color = jonyColors.accent1;
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = jonyColors.cardBackground;
                                  e.target.style.borderColor = jonyColors.cardBorder;
                                  e.target.style.color = jonyColors.textSecondary;
                                }}
                              >
                                {percent}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

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
                          {person.transactions.map((transaction, index) => {
                            // Check if this specific transaction is already settled with this person
                            const isTransactionSettled = transaction.settledWithPersons && 
                                                        transaction.settledWithPersons.includes(person.name);
                            
                            return (
                              <div key={`${transaction.id}-${index}`} className="flex items-center justify-between p-3 rounded-lg" style={{
                                backgroundColor: jonyColors.surface,
                                opacity: isTransactionSettled ? 0.5 : 1
                              }}>
                                <div className="flex items-center gap-3">
                                  {(() => {
                                    const paymentStatus = getPersonPaymentStatus(person.name);
                                    const isPaid = paymentStatus.fullyPaid && paymentStatus.hasTransactions;
                                    const avatarColor = isPaid ? jonyColors.greenMedium : jonyColors.magenta;
                                    
                                    return (
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300`} style={{ 
                                        backgroundColor: avatarColor,
                                        color: jonyColors.background
                                      }}>
                                        {transaction.paidByMe ? '←' : '→'}
                                      </div>
                                    );
                                  })()}
                                  <div>
                                    <p className="font-medium" style={{ color: jonyColors.textPrimary }}>
                                      {transaction.description}
                                      {isTransactionSettled && <span style={{ color: jonyColors.accent1 }}> ✓</span>}
                                    </p>
                                    <p className="text-xs" style={{ color: jonyColors.textSecondary }}>
                                      {new Date(transaction.date).toLocaleDateString('de-DE')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
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
                                  
                                  {/* Button für einzelne Ausgabe begleichen */}
                                  {!isTransactionSettled && transaction.paidByMe && (
                                    <button
                                      onClick={() => handleMarkSingleExpenseAsPaid(
                                        transaction.id, 
                                        person.name, 
                                        transaction.isFromSharedExpenses || false
                                      )}
                                      disabled={processingId === `single-${transaction.id}-${person.name}`}
                                      className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105"
                                      style={{
                                        backgroundColor: jonyColors.accent1,
                                        color: jonyColors.background,
                                        opacity: processingId === `single-${transaction.id}-${person.name}` ? 0.5 : 1
                                      }}
                                    >
                                      {processingId === `single-${transaction.id}-${person.name}` ? '...' : 'Bezahlt'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {monthlyData.data.length === 0 && hasAnySharedExpenses && (
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