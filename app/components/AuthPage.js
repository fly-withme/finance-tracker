'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, Key, AlertCircle, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import Card from './ui/Card';
import { db } from '../utils/db';

const AuthPage = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login', 'setup', 'reset'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: enter code, 2: new password
  const [showCompleteReset, setShowCompleteReset] = useState(false);
  const [showCodeForgotten, setShowCodeForgotten] = useState(false);
  const [completeResetConfirmation, setCompleteResetConfirmation] = useState('');

  // Check if password is already set up
  useEffect(() => {
    const hasPassword = localStorage.getItem('finance_password_hash');
    if (hasPassword) {
      setMode('login');
    } else {
      setMode('setup');
    }
  }, []);

  // Simple hash function for password storage
  const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'finance_app_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Generate random reset code
  const generateResetCode = () => {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  };

  const handleSetupPassword = async () => {
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const hashedPassword = await hashPassword(password);
      const resetCode = generateResetCode();
      
      // Store password hash and reset code
      localStorage.setItem('finance_password_hash', hashedPassword);
      localStorage.setItem('finance_reset_code', resetCode);
      localStorage.setItem('finance_password_setup_date', new Date().toISOString());
      
      // Show reset code to user
      alert(`Passwort erfolgreich eingerichtet!\n\nNotiere dir diesen Reset-Code sicher:\n${resetCode}\n\nDu benötigst ihn, um dein Passwort zurückzusetzen.`);
      
      onAuthSuccess();
    } catch (error) {
      setError('Fehler beim Einrichten des Passworts');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setError('Bitte gib dein Passwort ein');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const hashedPassword = await hashPassword(password);
      const storedHash = localStorage.getItem('finance_password_hash');
      
      if (hashedPassword === storedHash) {
        // Set session
        sessionStorage.setItem('finance_authenticated', 'true');
        onAuthSuccess();
      } else {
        setError('Falsches Passwort');
      }
    } catch (error) {
      setError('Fehler bei der Anmeldung');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetStep === 1) {
      const storedResetCode = localStorage.getItem('finance_reset_code');
      if (resetCode.toUpperCase() === storedResetCode) {
        setResetStep(2);
        setError('');
      } else {
        setError('Ungültiger Reset-Code');
      }
    } else {
      if (password.length < 6) {
        setError('Das neue Passwort muss mindestens 6 Zeichen lang sein');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Die Passwörter stimmen nicht überein');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const hashedPassword = await hashPassword(password);
        const newResetCode = generateResetCode();
        
        localStorage.setItem('finance_password_hash', hashedPassword);
        localStorage.setItem('finance_reset_code', newResetCode);
        localStorage.setItem('finance_password_reset_date', new Date().toISOString());
        
        alert(`Passwort erfolgreich zurückgesetzt!\n\nNeuer Reset-Code:\n${newResetCode}\n\nNotiere ihn dir sicher.`);
        
        setMode('login');
        setResetStep(1);
        setPassword('');
        setConfirmPassword('');
        setResetCode('');
      } catch (error) {
        setError('Fehler beim Zurücksetzen des Passworts');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCompleteReset = async () => {
    if (completeResetConfirmation !== 'KOMPLETT ZURÜCKSETZEN') {
      setError('Bitte gib "KOMPLETT ZURÜCKSETZEN" ein, um fortzufahren');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Clear all localStorage items
      localStorage.removeItem('finance_password_hash');
      localStorage.removeItem('finance_reset_code');
      localStorage.removeItem('finance_password_setup_date');
      localStorage.removeItem('finance_password_reset_date');
      
      // Clear sessionStorage
      sessionStorage.removeItem('finance_authenticated');
      
      // Clear all database tables
      await db.transaction('rw', [
        db.transactions, 
        db.categories, 
        db.accounts, 
        db.settings, 
        db.inbox, 
        db.budgets, 
        db.contacts, 
        db.sharedExpenses, 
        db.savingsGoals, 
        db.subscriptions, 
        db.debts
      ], async () => {
        await db.transactions.clear();
        await db.categories.clear();
        await db.accounts.clear();
        await db.settings.clear();
        await db.inbox.clear();
        await db.budgets.clear();
        await db.contacts.clear();
        await db.sharedExpenses.clear();
        await db.savingsGoals.clear();
        await db.subscriptions.clear();
        await db.debts.clear();
      });

      // Reset all state
      setMode('setup');
      setPassword('');
      setConfirmPassword('');
      setResetCode('');
      setResetStep(1);
      setShowCompleteReset(false);
      setCompleteResetConfirmation('');
      setError('');
      
      alert('Die App wurde komplett zurückgesetzt. Du kannst nun ein neues Passwort einrichten.');
    } catch (error) {
      console.error('Error during complete reset:', error);
      setError('Fehler beim Zurücksetzen der App. Versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const renderSetupMode = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Sicherheit einrichten
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Richte ein Passwort für deine Finanz-App ein
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Neues Passwort
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Passwort bestätigen
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Passwort wiederholen"
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleSetupPassword}
          disabled={loading || !password || !confirmPassword}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
        >
          {loading ? 'Einrichten...' : 'Passwort einrichten'}
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Wichtig:</strong> Du erhältst einen Reset-Code, den du sicher aufbewahren musst. 
            Ohne diesen Code kannst du dein Passwort nicht zurücksetzen!
          </div>
        </div>
      </div>
    </div>
  );

  const renderLoginMode = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Anmeldung
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gib dein Passwort ein, um fortzufahren
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Passwort
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dein Passwort eingeben"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !password}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
        >
          {loading ? 'Anmelden...' : 'Anmelden'}
        </button>

        <button
          onClick={() => setMode('reset')}
          className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition-colors"
        >
          Passwort vergessen?
        </button>
      </div>
    </div>
  );

  const renderResetMode = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Passwort zurücksetzen
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {resetStep === 1 ? 'Gib deinen Reset-Code ein' : 'Wähle ein neues Passwort'}
        </p>
      </div>

      <div className="space-y-4">
        {resetStep === 1 ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reset-Code
            </label>
            <input
              type="text"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXXXX"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Neues Passwort
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Passwort bestätigen
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleResetPassword}
          disabled={loading || (resetStep === 1 ? !resetCode : !password || !confirmPassword)}
          className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
        >
          {loading ? 'Verarbeiten...' : (resetStep === 1 ? 'Code überprüfen' : 'Passwort zurücksetzen')}
        </button>

        <button
          onClick={() => {
            setMode('login');
            setResetStep(1);
            setResetCode('');
            setPassword('');
            setConfirmPassword('');
            setError('');
            setShowCodeForgotten(false);
            setShowCompleteReset(false);
            setCompleteResetConfirmation('');
          }}
          className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition-colors"
        >
          ← Zurück zur Anmeldung
        </button>

        {/* Code forgotten button - only show in step 1 */}
        {resetStep === 1 && !showCodeForgotten && (
          <button
            onClick={() => setShowCodeForgotten(true)}
            className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition-colors"
          >
            Code vergessen?
          </button>
        )}

        {/* Complete Reset Section - only show when code forgotten is clicked */}
        {showCodeForgotten && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800 dark:text-red-300">
                <strong>Achtung:</strong> Du hast sowohl dein Passwort als auch den Reset-Code vergessen?
                <br />Du kannst die App komplett zurücksetzen und neu anfangen.
              </div>
            </div>
          </div>

          {!showCompleteReset ? (
            <button
              onClick={() => setShowCompleteReset(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              App komplett zurücksetzen
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                ⚠️ Dies löscht ALLE deine Daten unwiderruflich!
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Gib "KOMPLETT ZURÜCKSETZEN" ein, um zu bestätigen:
                </label>
                <input
                  type="text"
                  value={completeResetConfirmation}
                  onChange={(e) => setCompleteResetConfirmation(e.target.value)}
                  placeholder="KOMPLETT ZURÜCKSETZEN"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCompleteReset}
                  disabled={loading || completeResetConfirmation !== 'KOMPLETT ZURÜCKSETZEN'}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {loading ? 'Zurücksetzen...' : 'Jetzt zurücksetzen'}
                </button>
                <button
                  onClick={() => {
                    setShowCompleteReset(false);
                    setCompleteResetConfirmation('');
                    setError('');
                  }}
                  className="flex-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          
          <button
            onClick={() => {
              setShowCodeForgotten(false);
              setShowCompleteReset(false);
              setCompleteResetConfirmation('');
              setError('');
            }}
            className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm transition-colors mt-4"
          >
            ← Zurück zum Reset-Code
          </button>
        </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          {mode === 'setup' && renderSetupMode()}
          {mode === 'login' && renderLoginMode()}
          {mode === 'reset' && renderResetMode()}
        </div>
      </Card>
    </div>
  );
};

export default AuthPage;