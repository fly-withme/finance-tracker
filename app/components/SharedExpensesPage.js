import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';

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
} from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);

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

  // MOCK DATA: In a real app, this would come from a user contacts table.
  const allContacts = useMemo(
    () => [
      { name: 'Lukas', color: '#6366F1' },
      { name: 'Lotta', color: '#EC4899' },
      { name: 'Simon', color: '#10B981' },
      { name: 'Anna M.', color: '#F59E0B' },
      { name: 'Max K.', color: '#3B82F6' },
      { name: 'Julia', color: '#EF4444' },
      { name: 'Chris', color: '#A855F7' },
      { name: 'Tina', color: '#F472B6' },
    ],
    []
  );

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

    const relevantExpenses = sharedExpenses.filter(
      (expense) =>
        new Date(expense.date) >= monthStart &&
        new Date(expense.date) <= monthEnd
    );

    const data = relevantExpenses.map((expense) => {
      const paidByMe = expense.paidBy === 'Me';
      const myShare = paidByMe
        ? expense.totalAmount -
          expense.sharedWith.reduce((sum, p) => sum + p.amount, 0)
        : expense.sharedWith.find((p) => p.name === 'Me')?.amount || 0;

      const totalPaidByOthers = expense.sharedWith.reduce((sum, p) => sum + p.amount, 0);

      let status = '';
      if (paidByMe) {
        status = 'outstanding'; // Others owe me
      } else if (!paidByMe && myShare > 0) {
        status = 'Iowe'; // I owe someone
      } else {
        status = 'settled'; // Should not happen often
      }

      return {
        ...expense,
        myShare,
        totalPaidByOthers,
        status,
        progress: paidByMe
          ? (expense.settledAmount / totalPaidByOthers) * 100
          : (expense.settledAmount / myShare) * 100,
      };
    });

    const summary = {
      iOwe: data
        .filter((d) => d.status === 'Iowe')
        .reduce((sum, d) => sum + d.myShare, 0),
      theyOweMe: data
        .filter((d) => d.status === 'outstanding')
        .reduce(
          (sum, d) => sum + d.totalPaidByOthers - d.settledAmount,
          0
        ),
    };

    return { data, summary };
  }, [sharedExpenses, currentDate]);

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

  const handleAddPerson = (name) => {
    const trimmedName = name.trim();
    if (
      !trimmedName ||
      newSharedExpense.sharedWith.some((c) => c.name === trimmedName)
    ) {
      setPersonSearch('');
      return;
    }
    const existingContact = allContacts.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    const newContact = existingContact
      ? existingContact
      : {
          name: trimmedName,
          color: `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, '0')}`,
        };

    toggleContactInShare(newContact);
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
    const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#A855F7', '#F472B6'];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        <header className="mb-8">
          {/* Geänderter Header mit Grid-Layout für drei Spalten */}
          <div className="grid grid-cols-3 items-center">
            {/* Linke Spalte: Titel */}
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Geteilte Ausgaben
              </h1>
              {sharedExpenses.length > 0 && (
                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-full">
                  {sharedExpenses.length}
                </div>
              )}
            </div>

            {/* Mittlere Spalte: Monats-Toggle, zentriert */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={goToPreviousMonth}
                  className="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 p-3 rounded-full transition-colors"
                  title="Vorheriger Monat"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-2 min-w-[180px] text-center">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-2xl tracking-wide">
                    {currentDate.toLocaleDateString('de-DE', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <button
                  onClick={goToNextMonth}
                  className="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 p-3 rounded-full transition-colors"
                  title="Nächster Monat"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rechte Spalte: Button, ausgerichtet am Ende */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Neue Ausgabe</span>
              </button>
            </div>
          </div>
        </header>

        {sharedExpenses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center flex flex-col items-center shadow-lg">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">
              Keine geteilten Ausgaben
            </h4>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 max-w-sm">
              Erstelle deine erste geteilte Ausgabe, um den Überblick zu behalten, wer dir was schuldet.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Erste Ausgabe erstellen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <ArrowUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    Dir wird geschuldet
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Insgesamt ausstehend
                  </p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(monthlyData.summary.theyOweMe)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <ArrowDown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    Du schuldest
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Insgesamt offen
                  </p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(monthlyData.summary.iOwe)}
              </p>
            </div>
          </div>
        )}

        {monthlyData.data.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
              Ausgaben dieses Monats
            </h2>
            <div className="space-y-6">
              {monthlyData.data.map((expense) => (
                <div
                  key={expense.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                          {expense.description}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Total: {formatCurrency(expense.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {expense.paidBy === 'Me' ? (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-semibold">
                          <DollarSign className="w-4 h-4" />
                          <span className="hidden sm:inline">Dir wird geschuldet</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-semibold">
                          <DollarSign className="w-4 h-4" />
                          <span className="hidden sm:inline">Du schuldest</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {expense.sharedWith.map((person) => (
                      <div
                        key={person.name}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md`}
                            style={{ backgroundColor: getRandomColor() }}
                          >
                            {renderInitial(person.name)}
                          </div>
                          <div>
                            <p className="font-semibold">{person.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatCurrency(person.amount)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Offen: {formatCurrency(person.amount - (expense.settledAmount || 0))}
                          </span>
                          <button
                            onClick={() =>
                              handleSettleUp(
                                expense.id,
                                person.amount,
                                person.name
                              )
                            }
                            disabled={processingId === expense.id}
                            className="ml-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors duration-200 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                          >
                            Begleichen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-sm font-medium mb-2">
                      <span className="text-slate-600 dark:text-slate-300">Fortschritt</span>
                      <span className="text-slate-800 dark:text-slate-200 font-bold">
                        {Math.min(100, expense.progress).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, expense.progress)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  Neue geteilte Ausgabe
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Erfasse eine Ausgabe und teile sie mit anderen.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={newSharedExpense.description}
                  onChange={(e) =>
                    setNewSharedExpense((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Essen gehen mit Freunden..."
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Gesamtbetrag
                </label>
                <input
                  type="number"
                  value={newSharedExpense.totalAmount}
                  onChange={(e) =>
                    setNewSharedExpense((prev) => ({
                      ...prev,
                      totalAmount: e.target.value,
                    }))
                  }
                  placeholder="50.00"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Geteilt mit
                  </label>
                  {newSharedExpense.sharedWith.length > 0 && (
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Du und {newSharedExpense.sharedWith.length} Person(en)
                    </div>
                  )}
                </div>
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    onFocus={() => setShowPersonSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleAddPerson(personSearch)
                    }
                    placeholder="Person suchen oder hinzufügen..."
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-white/80 dark:bg-slate-700/80"
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
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                      Kontakte
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {newSharedExpense.sharedWith.map((person) => (
                        <div
                          key={person.name}
                          className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/50 rounded-full text-indigo-700 dark:text-indigo-300 text-sm font-medium"
                        >
                          {person.name}
                          <button
                            onClick={() => toggleContactInShare(person)}
                            className="ml-1 text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
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
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
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
                    className={`flex-1 px-4 py-2 rounded-xl border-2 transition-colors ${
                      newSharedExpense.splitType === 'equal'
                        ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
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
                    className={`flex-1 px-4 py-2 rounded-xl border-2 transition-colors ${
                      newSharedExpense.splitType === 'custom'
                        ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    Individuell
                  </button>
                </div>
              </div>

              {newSharedExpense.splitType === 'custom' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900">
                    <span className="font-semibold">Dein Anteil</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(myCalculatedShare)}
                    </span>
                  </div>
                  {newSharedExpense.sharedWith.map((person) => (
                    <div
                      key={person.name}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900"
                    >
                      <span className="font-semibold">{person.name}</span>
                      <input
                        type="number"
                        value={person.amount}
                        onChange={(e) =>
                          handleUpdateMyShare(person.name, e.target.value)
                        }
                        className="w-32 px-2 py-1 text-right border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateSharedExpense}
                disabled={
                  processingId === 'create' || !newSharedExpense.description || !newSharedExpense.totalAmount
                }
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === 'create' ? 'Erstelle...' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedExpensesPage;