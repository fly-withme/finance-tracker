"use client";

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Target, TrendingUp, Plus, Edit3, Save, X, PiggyBank, Calendar, Euro, Trash2, Info } from 'lucide-react';
import Card from './ui/Card';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const SavingsGoalsPage = () => {
  const savingsGoals = useLiveQuery(() => db.savingsGoals?.toArray(), []) || [];
  const [editingGoal, setEditingGoal] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [flippedCards, setFlippedCards] = useState(new Set());
  const [editForm, setEditForm] = useState({
    title: '',
    targetAmount: '',
    currentAmount: '',
    monthlyAmount: '',
    targetDate: '',
    isEmergencyFund: false
  });

  const emergencyFund = useMemo(() => {
    return savingsGoals.find(goal => goal.isEmergencyFund) || null;
  }, [savingsGoals]);

  const regularGoals = useMemo(() => {
    return savingsGoals.filter(goal => !goal.isEmergencyFund);
  }, [savingsGoals]);

  const calculateProgress = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (progress) => {
    if (progress >= 100) return 'from-green-500 to-green-600';
    if (progress >= 75) return 'from-emerald-500 to-green-500';
    if (progress >= 50) return 'from-yellow-500 to-orange-500';
    if (progress >= 25) return 'from-orange-500 to-red-500';
    return 'from-red-500 to-red-600';
  };

  const calculateMonthsToGoal = (current, target, monthlyAmount) => {
    if (monthlyAmount <= 0) return 0;
    const remaining = target - current;
    return Math.ceil(remaining / monthlyAmount);
  };

  const calculateMonthlyAmount = (current, target, targetDate) => {
    const now = new Date();
    const endDate = new Date(targetDate);
    const monthsRemaining = Math.max(1, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24 * 30)));
    const remaining = target - current;
    return Math.max(0, remaining / monthsRemaining);
  };

  const calculateTargetDate = (current, target, monthlyAmount) => {
    if (monthlyAmount <= 0) return new Date();
    const monthsToGoal = calculateMonthsToGoal(current, target, monthlyAmount);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
    return targetDate;
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal.id);
    setEditForm({
      title: goal.title,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      monthlyAmount: goal.monthlyAmount.toString(),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
      isEmergencyFund: goal.isEmergencyFund
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditForm({
      title: '',
      targetAmount: '',
      currentAmount: '0',
      monthlyAmount: '',
      targetDate: '',
      isEmergencyFund: false
    });
  };

  const handleSave = async () => {
    try {
      const goalData = {
        title: editForm.title,
        targetAmount: parseFloat(editForm.targetAmount) || 0,
        currentAmount: parseFloat(editForm.currentAmount) || 0,
        monthlyAmount: parseFloat(editForm.monthlyAmount) || 0,
        targetDate: editForm.targetDate ? new Date(editForm.targetDate).toISOString() : null,
        isEmergencyFund: editForm.isEmergencyFund,
        updatedAt: new Date().toISOString()
      };

      if (isCreating) {
        goalData.createdAt = new Date().toISOString();
        await db.savingsGoals.add(goalData);
      } else {
        await db.savingsGoals.update(editingGoal, goalData);
      }

      setEditingGoal(null);
      setIsCreating(false);
      setEditForm({ title: '', targetAmount: '', currentAmount: '', monthlyAmount: '', targetDate: '', isEmergencyFund: false });
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleCancel = () => {
    setEditingGoal(null);
    setIsCreating(false);
    setEditForm({ title: '', targetAmount: '', currentAmount: '', monthlyAmount: '', targetDate: '', isEmergencyFund: false });
  };

  const handleDelete = async (goalId) => {
    if (window.confirm('Bist du sicher, dass du dieses Sparziel löschen möchtest?')) {
      try {
        await db.savingsGoals.delete(goalId);
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  const toggleCardFlip = (goalId) => {
    console.log('Card clicked, goalId:', goalId);
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) {
        newSet.delete(goalId);
      } else {
        newSet.add(goalId);
      }
      console.log('Flipped cards:', newSet);
      return newSet;
    });
  };

  const handleInputChange = (field, value) => {
    const newForm = { ...editForm, [field]: value };
    
    const targetAmount = parseFloat(newForm.targetAmount) || 0;
    const currentAmount = parseFloat(newForm.currentAmount) || 0;
    const monthlyAmount = parseFloat(newForm.monthlyAmount) || 0;
    const remaining = targetAmount - currentAmount;
    
    // Intelligente Berechnung basierend auf ausgefüllten Feldern
    if (remaining > 0) {
      // Szenario 1: Zielbetrag, aktueller Betrag und monatlicher Betrag sind ausgefüllt -> Zieldatum berechnen
      if (targetAmount > 0 && monthlyAmount > 0 && field === 'monthlyAmount') {
        const monthsNeeded = Math.ceil(remaining / monthlyAmount);
        const calculatedDate = new Date();
        calculatedDate.setMonth(calculatedDate.getMonth() + monthsNeeded);
        newForm.targetDate = calculatedDate.toISOString().split('T')[0];
      }
      
      // Szenario 2: Zielbetrag, aktueller Betrag und Zieldatum sind ausgefüllt -> monatlicher Betrag berechnen
      else if (targetAmount > 0 && newForm.targetDate && field === 'targetDate') {
        const targetDateObj = new Date(newForm.targetDate);
        const today = new Date();
        const monthsDifference = Math.max(1, Math.ceil((targetDateObj - today) / (1000 * 60 * 60 * 24 * 30)));
        const calculatedMonthly = remaining / monthsDifference;
        newForm.monthlyAmount = Math.max(0, calculatedMonthly).toFixed(2);
      }
      
      // Zusätzliche Aktualisierung wenn sich Zielbetrag oder aktueller Betrag ändert
      else if ((field === 'targetAmount' || field === 'currentAmount') && targetAmount > 0) {
        // Falls Zieldatum schon gesetzt ist, monatlichen Betrag neu berechnen
        if (newForm.targetDate) {
          const targetDateObj = new Date(newForm.targetDate);
          const today = new Date();
          const monthsDifference = Math.max(1, Math.ceil((targetDateObj - today) / (1000 * 60 * 60 * 24 * 30)));
          const calculatedMonthly = remaining / monthsDifference;
          newForm.monthlyAmount = Math.max(0, calculatedMonthly).toFixed(2);
        }
        // Falls monatlicher Betrag schon gesetzt ist, Zieldatum neu berechnen
        else if (monthlyAmount > 0) {
          const monthsNeeded = Math.ceil(remaining / monthlyAmount);
          const calculatedDate = new Date();
          calculatedDate.setMonth(calculatedDate.getMonth() + monthsNeeded);
          newForm.targetDate = calculatedDate.toISOString().split('T')[0];
        }
      }
    }
    
    setEditForm(newForm);
  };


  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Sparziele
              </h1>
            </div>

          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">

          {/* Savings Goals Overview */}
          {(emergencyFund || regularGoals.length > 0) && (
            <div className="p-8 rounded-2xl border mb-8" style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`
            }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.accent1 }}>
                    {formatCurrency((emergencyFund?.currentAmount || 0) + regularGoals.reduce((sum, goal) => sum + goal.currentAmount, 0))}
                  </div>
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Gespart
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                    {formatCurrency((emergencyFund?.targetAmount || 0) + regularGoals.reduce((sum, goal) => sum + goal.targetAmount, 0))}
                  </div>
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Sparziel
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.magenta }}>
                    {formatCurrency((emergencyFund?.monthlyAmount || 0) + regularGoals.reduce((sum, goal) => sum + goal.monthlyAmount, 0))}
                  </div>
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Monatlich
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                    {(emergencyFund ? 1 : 0) + regularGoals.length}
                  </div>
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Aktive Ziele
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Fund Section - only show if fund exists or regular goals exist */}
          {(emergencyFund || regularGoals.length > 0) && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: jonyColors.textPrimary }}>
                <PiggyBank className="w-5 h-5" style={{ color: jonyColors.magenta }} />
                Notgroschen
              </h2>
          
          {emergencyFund ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {flippedCards.has(emergencyFund.id) ? (
                <div 
                  className="p-6 h-72 cursor-pointer rounded-2xl border" 
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCardFlip(emergencyFund.id);
                  }}
                >
                {editingGoal === emergencyFund.id ? (
                  <div className="h-full overflow-y-auto">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>Notgroschen bearbeiten</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ziel</label>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Zielbetrag</label>
                          <input
                            type="number"
                            value={editForm.targetAmount}
                            onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Aktuell</label>
                          <input
                            type="number"
                            value={editForm.currentAmount}
                            onChange={(e) => handleInputChange('currentAmount', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Monatlich</label>
                          <input
                            type="number"
                            value={editForm.monthlyAmount}
                            onChange={(e) => handleInputChange('monthlyAmount', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSave(); }} 
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded transition-colors"
                        >
                          Speichern
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCancel(); }} 
                          className="bg-slate-500 hover:bg-slate-600 text-white px-3 py-1 text-sm rounded transition-colors"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                          <PiggyBank className="w-5 h-5 text-purple-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{emergencyFund.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(emergencyFund); }}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(emergencyFund.id); }}
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Fortschritt</span>
                          <span className="text-xs font-bold text-purple-600">
                            {calculateProgress(emergencyFund.currentAmount, emergencyFund.targetAmount).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-purple-100 dark:bg-purple-900/20 rounded-full h-1.5 mb-2">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${calculateProgress(emergencyFund.currentAmount, emergencyFund.targetAmount)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>{formatCurrency(emergencyFund.currentAmount)}</span>
                          <span>{formatCurrency(emergencyFund.targetAmount)}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Monatlich</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(emergencyFund.monthlyAmount)}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Noch benötigt</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {calculateMonthsToGoal(emergencyFund.currentAmount, emergencyFund.targetAmount, emergencyFund.monthlyAmount)} Mon.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 mt-2">
                        <span>Zurück zur Übersicht</span>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              ) : (
                <div 
                  className="p-6 h-72 cursor-pointer rounded-2xl"
                  style={{
                    background: `linear-gradient(to bottom right, ${jonyColors.magenta}, ${jonyColors.magentaDark})`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCardFlip(emergencyFund.id);
                  }}
                >
                  <div className="flex flex-col justify-center items-center h-full text-center">
                    <PiggyBank className="w-12 h-12 text-white mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">{emergencyFund.title}</h3>
                    <div className="w-full bg-white/20 rounded-full h-3 mb-2 mt-2">
                      <div
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${calculateProgress(emergencyFund.currentAmount, emergencyFund.targetAmount)}%` }}
                      />
                    </div>
                    <p className="text-sm text-white opacity-90">
                      {formatCurrency(emergencyFund.currentAmount)} von {formatCurrency(emergencyFund.targetAmount)}
                    </p>
                    <p className="text-xs text-white opacity-75 mt-1">Klicken für Details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 border-dashed rounded-2xl border" style={{ borderColor: jonyColors.border }}>
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{
                backgroundColor: jonyColors.magentaAlpha
              }}>
                <PiggyBank className="w-8 h-8" style={{ color: jonyColors.magenta }} />
              </div>
              <p className="mb-6 font-medium" style={{ color: jonyColors.textSecondary }}>Erstelle einen Notgroschen für finanzielle Sicherheit</p>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setEditForm({
                    title: 'Notgroschen',
                    targetAmount: '10000',
                    currentAmount: '0',
                    monthlyAmount: '',
                    targetDate: '',
                    isEmergencyFund: true
                  });
                }}
                className="px-6 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: jonyColors.magenta, color: jonyColors.background }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.magentaDark;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.magenta;
                }}
              >
                Notgroschen erstellen
              </button>
            </div>
          </div>
        )}
      </div>
          )}

          {/* Regular Savings Goals - only show if goals exist or emergency fund exists */}
          {(regularGoals.length > 0 || emergencyFund) && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: jonyColors.textPrimary }}>
                <Target className="w-5 h-5" style={{ color: jonyColors.accent1 }} />
                Sparziele
              </h2>

            {isCreating && !editForm.isEmergencyFund && (
              <div className="p-6 mb-6 rounded-2xl border" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: jonyColors.textPrimary }}>Neues Sparziel</h3>
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-600 dark:text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <strong>Smart-Berechnung:</strong> Gib 2 von 3 Werten ein (Zielbetrag + Startbetrag sind Pflicht). 
                  Das System berechnet automatisch das fehlende Feld (Monatsbetrag oder Zieldatum).
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ziel</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="z.B. Neues Auto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Zielbetrag</label>
                  <input
                    type="number"
                    value={editForm.targetAmount}
                    onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Aktueller Betrag</label>
                  <input
                    type="number"
                    value={editForm.currentAmount}
                    onChange={(e) => handleInputChange('currentAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Monatlicher Betrag
                    {editForm.targetDate && editForm.targetAmount && !editForm.monthlyAmount && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">(wird berechnet)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={editForm.monthlyAmount}
                    onChange={(e) => handleInputChange('monthlyAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder={editForm.targetDate && editForm.targetAmount ? "wird automatisch berechnet" : "300"}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Zieldatum
                    {editForm.monthlyAmount && editForm.targetAmount && !editForm.targetDate && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">(wird berechnet)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={editForm.targetDate}
                    onChange={(e) => handleInputChange('targetDate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSave} 
                  className="px-6 py-3 text-white rounded-lg font-medium shadow-lg hover:shadow-xl text-base flex items-center gap-2 transition-all duration-200"
                  style={{ backgroundColor: jonyColors.accent1 }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.greenDark;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.accent1;
                  }}
                >
                  <Save className="w-5 h-5" /> Speichern
                </button>
                <button 
                  onClick={handleCancel} 
                  className="px-6 py-3 text-white rounded-lg font-medium shadow-lg hover:shadow-xl text-base flex items-center gap-2 transition-all duration-200"
                  style={{ backgroundColor: jonyColors.textSecondary }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.border;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.textSecondary;
                  }}
                >
                  <X className="w-5 h-5" /> Abbrechen
                </button>
              </div>
            </div>
              </div>
            )}

            {isCreating && editForm.isEmergencyFund && (
              <div className="p-6 mb-6 rounded-2xl border" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: jonyColors.textPrimary }}>Notgroschen erstellen</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ziel</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="Notgroschen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Zielbetrag</label>
                  <input
                    type="number"
                    value={editForm.targetAmount}
                    onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="10000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Aktueller Betrag</label>
                  <input
                    type="number"
                    value={editForm.currentAmount}
                    onChange={(e) => handleInputChange('currentAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monatlicher Betrag</label>
                  <input
                    type="number"
                    value={editForm.monthlyAmount}
                    onChange={(e) => handleInputChange('monthlyAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSave} 
                  className="px-6 py-3 text-white rounded-lg font-medium shadow-lg hover:shadow-xl text-base flex items-center gap-2 transition-all duration-200"
                  style={{ backgroundColor: jonyColors.accent1 }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.greenDark;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.accent1;
                  }}
                >
                  <Save className="w-5 h-5" /> Speichern
                </button>
                <button 
                  onClick={handleCancel} 
                  className="px-6 py-3 text-white rounded-lg font-medium shadow-lg hover:shadow-xl text-base flex items-center gap-2 transition-all duration-200"
                  style={{ backgroundColor: jonyColors.textSecondary }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.border;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.textSecondary;
                  }}
                >
                  <X className="w-5 h-5" /> Abbrechen
                </button>
              </div>
            </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {regularGoals.map((goal) => (
                <div key={goal.id}>
                  {flippedCards.has(goal.id) ? (
                    <div 
                      className="p-6 h-72 cursor-pointer rounded-2xl border" 
                      style={{
                        backgroundColor: jonyColors.surface,
                        border: `1px solid ${jonyColors.border}`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardFlip(goal.id);
                      }}
                    >
                  {editingGoal === goal.id ? (
                    <div className="h-full overflow-y-auto">
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Sparziel bearbeiten</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ziel</label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => handleInputChange('title', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Zielbetrag</label>
                            <input
                              type="number"
                              value={editForm.targetAmount}
                              onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Aktuell</label>
                            <input
                              type="number"
                              value={editForm.currentAmount}
                              onChange={(e) => handleInputChange('currentAmount', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Monatlich</label>
                            <input
                              type="number"
                              value={editForm.monthlyAmount}
                              onChange={(e) => handleInputChange('monthlyAmount', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Zieldatum</label>
                            <input
                              type="date"
                              value={editForm.targetDate}
                              onChange={(e) => handleInputChange('targetDate', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSave(); }} 
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded transition-colors"
                          >
                            Speichern
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCancel(); }} 
                            className="bg-slate-500 hover:bg-slate-600 text-white px-3 py-1 text-sm rounded transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                            <Target className="w-5 h-5 text-purple-500" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{goal.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(goal); }}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Fortschritt</span>
                            <span className="text-xs font-bold text-purple-600">
                              {calculateProgress(goal.currentAmount, goal.targetAmount).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-purple-100 dark:bg-purple-900/20 rounded-full h-1.5 mb-2">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${calculateProgress(goal.currentAmount, goal.targetAmount)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>{formatCurrency(goal.currentAmount)}</span>
                            <span>{formatCurrency(goal.targetAmount)}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Monatlich</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(goal.monthlyAmount)}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Noch benötigt</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {calculateMonthsToGoal(goal.currentAmount, goal.targetAmount, goal.monthlyAmount)} Mon.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 mt-2">
                          <span>Zurück zur Übersicht</span>
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
              ) : (
                <div 
                  className="p-6 h-72 cursor-pointer rounded-2xl"
                  style={{
                    background: `linear-gradient(to bottom right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCardFlip(goal.id);
                  }}
                >
                  <div className="flex flex-col justify-center items-center h-full text-center">
                    <Target className="w-12 h-12 text-white mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">{goal.title}</h3>
                    <div className="w-full bg-white/20 rounded-full h-3 mb-2 mt-2">
                      <div
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${calculateProgress(goal.currentAmount, goal.targetAmount)}%` }}
                      />
                    </div>
                    <p className="text-sm text-white opacity-90">
                      {formatCurrency(goal.currentAmount)} von {formatCurrency(goal.targetAmount)}
                    </p>
                    <p className="text-xs text-white opacity-75 mt-1">Klicken für Details</p>
                  </div>
                </div>
              )}
            </div>
          ))}
            </div>

            {regularGoals.length === 0 && !isCreating && (
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
                    <Target className="w-12 h-12" style={{ color: jonyColors.background }} />
                  </div>
                  <h2 className="text-3xl font-black mb-4" style={{ color: jonyColors.textPrimary }}>
                    Zeit zu sparen!
                  </h2>
                  <p className="text-lg leading-relaxed" style={{ color: jonyColors.textSecondary }}>
                    Erstelle dein erstes Sparziel und starte in eine finanziell sichere Zukunft.
                  </p>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Fixed Floating Action Button */}
      <button
        onClick={handleCreate}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-110 z-50"
        style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
        title="Neues Sparziel"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default SavingsGoalsPage;