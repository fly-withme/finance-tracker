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
import { jonyColors } from '../theme';

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
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.red }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Schulden
              </h1>
              <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ backgroundColor: jonyColors.redAlpha, color: jonyColors.red }}>
                {summary.debtCount}
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl text-base"
              style={{ backgroundColor: jonyColors.red, color: jonyColors.background }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = jonyColors.redDark;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = jonyColors.red;
              }}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Neue Schulden</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          {/* Summary Overview */}
          {summary.debtCount > 0 && (
            <div className="mb-6">
              <div className="rounded-2xl p-6 border" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.red }}>
                      {formatCurrency(summary.totalDebt)}
                    </div>
                    <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      Gesamtschulden
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                      {formatCurrency(summary.totalMonthlyPayments)}
                    </div>
                    <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      Monatliche Rate
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.accent1 }}>
                      {formatCurrency(summary.totalPaid)}
                    </div>
                    <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      Bereits bezahlt
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                      {summary.debtCount}
                    </div>
                    <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      Aktive Schulden
                    </div>
                  </div>
                </div>
                
                {summary.highInterestDebts > 0 && (
                  <div className="mt-4 p-3 rounded-lg border" style={{
                    backgroundColor: jonyColors.orangeAlpha,
                    border: `1px solid ${jonyColors.orange}`
                  }}>
                    <div className="flex items-center gap-2" style={{ color: jonyColors.orange }}>
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
          <div className="p-8 rounded-2xl border" style={{
            backgroundColor: jonyColors.surface,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>Schulden Übersicht</h3>
                <p className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>Deine Kredite und Schulden im Überblick</p>
              </div>
            </div>

            {debtData.length > 0 ? (
              <div className="space-y-6">
                {debtData.map((debt) => {
                  const TypeIcon = getDebtTypeIcon(debt.type);
                  return (
                    <div key={debt.id} className="group relative p-6 rounded-2xl border" style={{
                      backgroundColor: jonyColors.surface,
                      border: `1px solid ${jonyColors.border}`
                    }}>
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{
                              background: `linear-gradient(to bottom right, ${jonyColors.red}, ${jonyColors.redDark})`
                            }}>
                              <TypeIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-xl" style={{ color: jonyColors.textPrimary }}>
                                {debt.name}
                              </h3>
                              <div className="flex items-center gap-2 text-sm" style={{ color: jonyColors.textSecondary }}>
                                <span>{getDebtTypeName(debt.type)}</span>
                                {debt.creditor && (
                                  <>
                                    <span>•</span>
                                    <span>{debt.creditor}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className="font-semibold" style={{ color: jonyColors.red }}>
                                  {formatCurrency(debt.remainingAmount)} verbleibt
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => setEditingDebt(debt)}
                            className="p-2 rounded-xl transition-all duration-200 hover:scale-105"
                            style={{ backgroundColor: jonyColors.magentaAlpha, color: jonyColors.magenta }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = jonyColors.magenta;
                              e.target.style.color = jonyColors.background;
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = jonyColors.magentaAlpha;
                              e.target.style.color = jonyColors.magenta;
                            }}
                            title="Bearbeiten"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDebt(debt.id)}
                            className="p-2 rounded-xl transition-all duration-200 hover:scale-105"
                            style={{ backgroundColor: jonyColors.redAlpha, color: jonyColors.red }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = jonyColors.red;
                              e.target.style.color = jonyColors.background;
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = jonyColors.redAlpha;
                              e.target.style.color = jonyColors.red;
                            }}
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
                            <div className="text-sm mb-1" style={{ color: jonyColors.textSecondary }}>Monatliche Rate:</div>
                            <div className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>
                              {formatCurrency(debt.monthlyPayment)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm mb-1" style={{ color: jonyColors.textSecondary }}>Laufzeit verbleibt:</div>
                            <div className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>
                              {debt.isNeverEnding ? (
                                <span style={{ color: jonyColors.red }}>Rate zu niedrig</span>
                              ) : debt.yearsRemaining > 0 ? (
                                `${debt.yearsRemaining} Jahre ${debt.monthsRemainingDisplay} Monate`
                              ) : (
                                `${debt.monthsRemainingDisplay} Monate`
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm mb-1" style={{ color: jonyColors.textSecondary }}>Abbezahlt bis:</div>
                            <div className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>
                              {debt.isNeverEnding ? (
                                <span style={{ color: jonyColors.red }}>-</span>
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
                          <div className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>
                            {formatCurrency(debt.paidAmount)} von {formatCurrency(debt.totalAmount)} bezahlt
                          </div>
                          <div className="text-sm font-semibold" style={{ color: jonyColors.accent1 }}>
                            {debt.progressPercentage.toFixed(1)}%
                          </div>
                        </div>
                        <div className="w-full rounded-full h-3 shadow-inner mb-4" style={{ backgroundColor: jonyColors.cardBackground }}>
                          <div 
                            className="h-3 rounded-full transition-all duration-700 shadow-sm"
                            style={{ 
                              width: `${Math.min(100, debt.progressPercentage)}%`,
                              background: `linear-gradient(to right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                            }}
                          ></div>
                        </div>
                        
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="backdrop-blur-sm rounded-3xl border p-12 shadow-lg text-center" style={{
                  backgroundColor: jonyColors.surfaceAlpha,
                  border: `1px solid ${jonyColors.border}`
                }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{
                    background: `linear-gradient(to bottom right, ${jonyColors.red}, ${jonyColors.redDark})`
                  }}>
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-bold mb-3" style={{ color: jonyColors.textPrimary }}>Keine Schulden</h4>
                  <p className="font-medium mb-6 max-w-sm" style={{ color: jonyColors.textSecondary }}>
                    Du hast keine Schulden eingetragen. Füge deine Kredite und Schulden hinzu, um sie zu verwalten.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                    style={{
                      background: `linear-gradient(to right, ${jonyColors.red}, ${jonyColors.redDark})`,
                      color: jonyColors.background
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    Erste Schulden hinzufügen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Create Debt Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <div className="rounded-2xl max-w-lg w-full p-6 shadow-xl" style={{ backgroundColor: jonyColors.surface }}>
                <h2 className="text-xl font-bold mb-6" style={{ color: jonyColors.textPrimary }}>Neue Schulden hinzufügen</h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                        Name
                      </label>
                      <input
                        type="text"
                        value={newDebt.name}
                        onChange={(e) => setNewDebt(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="z.B. Autokredit"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          borderColor: jonyColors.border,
                          '--tw-ring-color': jonyColors.red
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                        Typ
                      </label>
                      <select
                        value={newDebt.type}
                        onChange={(e) => setNewDebt(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          borderColor: jonyColors.border,
                          '--tw-ring-color': jonyColors.red
                        }}
                      >
                        <option value="loan">Kredit</option>
                        <option value="credit_card">Kreditkarte</option>
                        <option value="mortgage">Hypothek</option>
                      </select>
                    </div>
                  </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                      Ursprungsbetrag
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newDebt.totalAmount}
                        onChange={(e) => setNewDebt(prev => ({ ...prev, totalAmount: e.target.value }))}
                        placeholder="25000"
                        className="w-full px-3 py-2 pr-8 border rounded-lg focus:ring-2 transition-colors"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          borderColor: jonyColors.border,
                          '--tw-ring-color': jonyColors.red
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: jonyColors.textTertiary }}>€</span>
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
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textSecondary
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.border;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.cardBackground;
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateDebt}
                  disabled={!newDebt.name || !newDebt.totalAmount}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: jonyColors.red, color: jonyColors.background }}
                  onMouseEnter={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.backgroundColor = jonyColors.redDark;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.backgroundColor = jonyColors.red;
                    }
                  }}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Edit Debt Modal */}
          {editingDebt && (
            <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <div className="backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border" style={{
                backgroundColor: jonyColors.surfaceAlpha,
                border: `1px solid ${jonyColors.border}`
              }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{
                    background: `linear-gradient(to bottom right, ${jonyColors.red}, ${jonyColors.redDark})`
                  }}>
                    <Edit className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
                      Schulden bearbeiten
                    </h2>
                    <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      {editingDebt.name} anpassen
                    </p>
                  </div>
                </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                    Aktueller Betrag
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={editingDebt.currentAmount}
                      onChange={(e) => setEditingDebt(prev => ({ ...prev, currentAmount: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 text-base font-medium transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.border,
                        '--tw-ring-color': jonyColors.red
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: jonyColors.textSecondary }}>
                    Noch zu tilgender Betrag
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                    Zusätzliche Abbuchung erfassen
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 text-base font-medium transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.accent1Alpha,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.accent1,
                        '--tw-ring-color': jonyColors.accent1
                      }}
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
                  <p className="text-xs mt-1" style={{ color: jonyColors.accent1 }}>
                    Betrag wird automatisch vom aktuellen Betrag abgezogen
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                    Monatliche Rate
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={editingDebt.monthlyPayment}
                      onChange={(e) => setEditingDebt(prev => ({ ...prev, monthlyPayment: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 text-base font-medium transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.border,
                        '--tw-ring-color': jonyColors.red
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setEditingDebt(null)}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textSecondary
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.border;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.cardBackground;
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleEditDebt(editingDebt)}
                  className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  style={{
                    background: `linear-gradient(to right, ${jonyColors.red}, ${jonyColors.redDark})`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default DebtPage;