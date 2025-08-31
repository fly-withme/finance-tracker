'use client';

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  CreditCard,
  Plus, 
  Edit, 
  Trash2, 
  TrendingDown,
  AlertTriangle,
  Calendar,
  Euro,
  Percent,
  Building,
  ChevronDown
} from 'lucide-react';
import Card from './ui/Card';
import { db } from '../utils/db';

const formatCurrency = (amount) => {
  if (isNaN(amount) || !isFinite(amount)) {
    return '0,00 €';
  }
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

const DebtPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [newDebt, setNewDebt] = useState({
    name: '',
    totalAmount: '',
    currentAmount: '',
    paidAmount: '',
    monthlyPayment: '',
    interestRate: '',
    creditor: '',
    startDate: '',
    type: 'loan'
  });

  // Live data
  const debts = useLiveQuery(() => db.debts.toArray(), []) || [];

  // Debt calculations
  const debtData = useMemo(() => {
    return debts.map(debt => {
      const remainingAmount = parseFloat(debt.currentAmount) || 0;
      const monthlyPayment = parseFloat(debt.monthlyPayment) || 0;
      const interestRate = parseFloat(debt.interestRate) || 0;
      const totalAmount = parseFloat(debt.totalAmount) || 0;
      
      // Calculate months remaining (simple calculation without compound interest)
      let monthsRemaining = 0;
      if (monthlyPayment > 0 && remainingAmount > 0) {
        if (interestRate > 0) {
          // Approximation with interest
          const monthlyInterestRate = interestRate / 100 / 12;
          if (monthlyPayment > remainingAmount * monthlyInterestRate) {
            monthsRemaining = Math.ceil(
              Math.log(1 + (remainingAmount * monthlyInterestRate) / monthlyPayment) /
              Math.log(1 + monthlyInterestRate)
            );
          } else {
            monthsRemaining = 999; // Never ending if payment is too low
          }
        } else {
          // Simple calculation without interest
          monthsRemaining = Math.ceil(remainingAmount / monthlyPayment);
        }
      }
      
      const yearsRemaining = Math.floor(monthsRemaining / 12);
      const monthsRemainingDisplay = monthsRemaining % 12;
      
      const paidAmount = totalAmount - remainingAmount;
      const progressPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
      
      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + monthsRemaining);
      
      return {
        ...debt,
        remainingAmount,
        monthlyPayment,
        interestRate,
        totalAmount,
        paidAmount,
        progressPercentage,
        monthsRemaining,
        yearsRemaining,
        monthsRemainingDisplay,
        payoffDate,
        isNeverEnding: monthsRemaining >= 999
      };
    });
  }, [debts]);

  // Summary calculations
  const summary = useMemo(() => {
    const totalDebt = debtData.reduce((sum, debt) => sum + debt.remainingAmount, 0);
    const totalMonthlyPayments = debtData.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
    const totalOriginalAmount = debtData.reduce((sum, debt) => sum + debt.totalAmount, 0);
    const totalPaid = debtData.reduce((sum, debt) => sum + debt.paidAmount, 0);
    const highInterestDebts = debtData.filter(debt => debt.interestRate > 10).length;
    
    return {
      totalDebt,
      totalMonthlyPayments,
      totalOriginalAmount,
      totalPaid,
      highInterestDebts,
      debtCount: debtData.length
    };
  }, [debtData]);

  const handleCreateDebt = async () => {
    try {
      const currentAmount = parseFloat(newDebt.currentAmount) || parseFloat(newDebt.totalAmount) || 0;
      
      await db.debts.add({
        name: newDebt.name,
        totalAmount: parseFloat(newDebt.totalAmount) || 0,
        currentAmount: currentAmount,
        monthlyPayment: parseFloat(newDebt.monthlyPayment) || 0,
        interestRate: parseFloat(newDebt.interestRate) || 0,
        creditor: newDebt.creditor,
        startDate: newDebt.startDate,
        type: newDebt.type,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      setNewDebt({
        name: '',
        totalAmount: '',
        currentAmount: '',
        paidAmount: '',
        monthlyPayment: '',
        interestRate: '',
        creditor: '',
        startDate: '',
        type: 'loan'
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating debt:', error);
    }
  };

  const handleEditDebt = async (debt) => {
    try {
      await db.debts.update(debt.id, {
        name: debt.name,
        totalAmount: parseFloat(debt.totalAmount) || 0,
        currentAmount: parseFloat(debt.currentAmount) || 0,
        monthlyPayment: parseFloat(debt.monthlyPayment) || 0,
        interestRate: parseFloat(debt.interestRate) || 0,
        creditor: debt.creditor,
        startDate: debt.startDate,
        type: debt.type,
        updatedAt: Date.now()
      });
      
      setEditingDebt(null);
    } catch (error) {
      console.error('Error updating debt:', error);
    }
  };

  const handleDeleteDebt = async (debtId) => {
    try {
      await db.debts.delete(debtId);
    } catch (error) {
      console.error('Error deleting debt:', error);
    }
  };

  const getDebtTypeIcon = (type) => {
    switch (type) {
      case 'credit_card':
        return CreditCard;
      case 'loan':
        return Euro;
      case 'mortgage':
        return Building;
      default:
        return CreditCard;
    }
  };

  const getDebtTypeName = (type) => {
    switch (type) {
      case 'credit_card':
        return 'Kreditkarte';
      case 'loan':
        return 'Kredit';
      case 'mortgage':
        return 'Hypothek';
      default:
        return 'Schulden';
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        {/* Page Header matching BudgetPage style */}
        <header className="mb-8">
          <div className="grid grid-cols-3 items-center">
            {/* Left column: Title */}
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Schulden</h1>
              <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-full">
                {summary.debtCount}
              </div>
            </div>

            {/* Middle column: empty for consistency */}
            <div></div>

            {/* Right column: Action button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Neue Schulden</span>
              </button>
            </div>
          </div>
        </header>

        {/* Summary Overview */}
        {summary.debtCount > 0 && (
          <div className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                    {formatCurrency(summary.totalDebt)}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Gesamtschulden
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">
                    {formatCurrency(summary.totalMonthlyPayments)}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Monatliche Rate
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {formatCurrency(summary.totalPaid)}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Bereits bezahlt
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">
                    {summary.debtCount}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Aktive Schulden
                  </div>
                </div>
              </div>
              
              {summary.highInterestDebts > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {summary.highInterestDebts} Schuld(en) mit hohen Zinsen (&gt;10%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debts Overview */}
        <Card className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">Schulden Übersicht</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Deine Kredite und Schulden im Überblick</p>
              </div>
            </div>

            {debtData.length > 0 ? (
              <div className="space-y-6">
                {debtData.map((debt) => {
                  const TypeIcon = getDebtTypeIcon(debt.type);
                  return (
                    <div key={debt.id} className="group relative p-6 rounded-2xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                              <TypeIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200">
                                {debt.name}
                              </h3>
                              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <span>{getDebtTypeName(debt.type)}</span>
                                {debt.creditor && (
                                  <>
                                    <span>•</span>
                                    <span>{debt.creditor}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  {formatCurrency(debt.remainingAmount)} verbleibt
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => setEditingDebt(debt)}
                            className="btn-icon bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/70 hover:scale-105 transition-all duration-200"
                            title="Bearbeiten"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDebt(debt.id)}
                            className="btn-icon bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70 hover:scale-105 transition-all duration-200"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div className="mb-6">
                        <div className="grid grid-cols-3 gap-6 text-center">
                          <div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Monatliche Rate:</div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(debt.monthlyPayment)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Laufzeit verbleibt:</div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                              {debt.isNeverEnding ? (
                                <span className="text-red-600 dark:text-red-400">Rate zu niedrig</span>
                              ) : debt.yearsRemaining > 0 ? (
                                `${debt.yearsRemaining} Jahre ${debt.monthsRemainingDisplay} Monate`
                              ) : (
                                `${debt.monthsRemainingDisplay} Monate`
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Abbezahlt bis:</div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                              {debt.isNeverEnding ? (
                                <span className="text-red-600 dark:text-red-400">-</span>
                              ) : (
                                debt.payoffDate.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                            {formatCurrency(debt.paidAmount)} von {formatCurrency(debt.totalAmount)} bezahlt
                          </div>
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {debt.progressPercentage.toFixed(1)}%
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 shadow-inner mb-4">
                          <div 
                            className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-700 shadow-sm"
                            style={{ width: `${Math.min(100, debt.progressPercentage)}%` }}
                          ></div>
                        </div>
                        
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl border border-white/60 dark:border-slate-700/60 p-12 shadow-lg text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Keine Schulden</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 max-w-sm">
                    Du hast keine Schulden eingetragen. Füge deine Kredite und Schulden hinzu, um sie zu verwalten.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Erste Schulden hinzufügen
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Create Debt Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Neue Schulden hinzufügen</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newDebt.name}
                      onChange={(e) => setNewDebt(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="z.B. Autokredit"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Typ
                    </label>
                    <select
                      value={newDebt.type}
                      onChange={(e) => setNewDebt(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="loan">Kredit</option>
                      <option value="credit_card">Kreditkarte</option>
                      <option value="mortgage">Hypothek</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Ursprungsbetrag
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newDebt.totalAmount}
                        onChange={(e) => setNewDebt(prev => ({ ...prev, totalAmount: e.target.value }))}
                        placeholder="25000"
                        className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Bereits abbezahlt (optional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newDebt.paidAmount || ''}
                        onChange={(e) => {
                          const paid = parseFloat(e.target.value) || 0;
                          const total = parseFloat(newDebt.totalAmount) || 0;
                          const current = Math.max(0, total - paid);
                          setNewDebt(prev => ({ 
                            ...prev, 
                            paidAmount: e.target.value,
                            currentAmount: current.toString()
                          }));
                        }}
                        placeholder="5000"
                        className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Aktuell verbleibt: {formatCurrency(Math.max(0, (parseFloat(newDebt.totalAmount) || 0) - (parseFloat(newDebt.paidAmount) || 0)))}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Monatliche Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newDebt.monthlyPayment}
                        onChange={(e) => setNewDebt(prev => ({ ...prev, monthlyPayment: e.target.value }))}
                        placeholder="350"
                        className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Zinssatz (optional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={newDebt.interestRate}
                        onChange={(e) => setNewDebt(prev => ({ ...prev, interestRate: e.target.value }))}
                        placeholder="4.5"
                        className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Gläubiger (optional)
                  </label>
                  <input
                    type="text"
                    value={newDebt.creditor}
                    onChange={(e) => setNewDebt(prev => ({ ...prev, creditor: e.target.value }))}
                    placeholder="z.B. Deutsche Bank"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Startdatum (optional)
                  </label>
                  <input
                    type="date"
                    value={newDebt.startDate}
                    onChange={(e) => setNewDebt(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{paddingTop: '15px', paddingBottom: '15px', paddingLeft: '25px', paddingRight: '25px'}}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateDebt}
                  disabled={!newDebt.name || !newDebt.totalAmount}
                  style={{paddingTop: '15px', paddingBottom: '15px', paddingLeft: '25px', paddingRight: '25px'}}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Debt Modal */}
        {editingDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-slate-700/50">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    Schulden bearbeiten
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {editingDebt.name} anpassen
                  </p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Aktueller Betrag
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      value={editingDebt.currentAmount}
                      onChange={(e) => setEditingDebt(prev => ({ ...prev, currentAmount: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Noch zu tilgender Betrag
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Zusätzliche Abbuchung erfassen
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 border-2 border-green-200 dark:border-green-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-green-50/50 dark:bg-green-900/20 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                      onChange={(e) => {
                        const additionalPayment = parseFloat(e.target.value) || 0;
                        if (additionalPayment > 0) {
                          const newCurrentAmount = Math.max(0, parseFloat(editingDebt.currentAmount) - additionalPayment);
                          setEditingDebt(prev => ({ 
                            ...prev, 
                            currentAmount: newCurrentAmount.toString(),
                            additionalPayment: additionalPayment
                          }));
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Betrag wird automatisch vom aktuellen Betrag abgezogen
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Monatliche Rate
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      value={editingDebt.monthlyPayment}
                      onChange={(e) => setEditingDebt(prev => ({ ...prev, monthlyPayment: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setEditingDebt(null)}
                  style={{paddingTop: '15px', paddingBottom: '15px', paddingLeft: '25px', paddingRight: '25px'}}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleEditDebt(editingDebt)}
                  style={{paddingTop: '15px', paddingBottom: '15px', paddingLeft: '25px', paddingRight: '25px'}}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtPage;