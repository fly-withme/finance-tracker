'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Key, AlertCircle, RotateCcw, PiggyBank } from 'lucide-react';

// Inlined theme colors to resolve import error
const jonyColors = {
  background: '#000000',
  cardBackground: '#121212',
  cardBorder: '#282828',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  accent1: '#00ff41', // Changed from blue to neon green
  accent1Alpha: 'rgba(0, 255, 65, 0.1)', // Changed to match neon green
  magenta: '#FF0080',
  magentaAlpha: 'rgba(255, 0, 128, 0.1)',
  red: '#FF453A',
  green: '#30D158'
};

const AuthPage = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login', 'setup', 'reset'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCodeForgotten, setShowCodeForgotten] = useState(false);
  const [codeStatus, setCodeStatus] = useState(''); // '', 'correct', 'incorrect'
  
  // New states for visual feedback on input focus
  const [isPasswordActive, setIsPasswordActive] = useState(false);
  const [isConfirmPasswordActive, setIsConfirmPasswordActive] = useState(false);

  // Dynamically load Dexie.js to avoid build issues
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clean up script tag on component unmount
      document.body.removeChild(script);
    }
  }, []);

  // Auto-setup when both codes match in setup mode
  useEffect(() => {
    if (mode === 'setup' && password.length === 6 && confirmPassword.length === 6 && password === confirmPassword && !loading) {
      const timer = setTimeout(() => {
        handleSetupPassword();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [password, confirmPassword, mode, loading]);

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
    try {
      const encoder = new TextEncoder();
      const saltedPassword = password + 'finance_app_salt_2024';
      console.log('🔐 Hashing input:', saltedPassword);
      
      const data = encoder.encode(saltedPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log('🔐 Generated hash:', hash);
      return hash;
    } catch (error) {
      console.error('❌ Hashing error:', error);
      throw error;
    }
  };

  // Generate random reset code
  const generateResetCode = () => {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  };

  const handleSetupPassword = async () => {
    if (password.length !== 6) {
      setError('Der Code muss genau 6 Stellen haben');
      return;
    }
    
    if (!/^\d{6}$/.test(password)) {
      setError('Der Code darf nur Zahlen enthalten');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Die Codes stimmen nicht überein');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const hashedPassword = await hashPassword(password);
      const resetCode = generateResetCode();
      
      console.log('🔧 SETUP DEBUG:');
      console.log('Password to hash:', password);
      console.log('Generated hash:', hashedPassword);
      
      localStorage.setItem('finance_password_hash', hashedPassword);
      localStorage.setItem('finance_reset_code', resetCode);
      localStorage.setItem('finance_password_setup_date', new Date().toISOString());
      
      const storedHash = localStorage.getItem('finance_password_hash');
      console.log('Stored hash verification:', storedHash);
      console.log('Storage successful:', storedHash === hashedPassword);
      
      alert(`✅ Passwort erfolgreich eingerichtet!\n\n📝 Dein Code: ${password}\n🔑 Reset-Code: ${resetCode}\n\n⚠️ Notiere dir beide Codes sicher!`);
      
      onAuthSuccess();
    } catch (error) {
      console.log('❌ SETUP ERROR:', error);
      setError('Fehler beim Einrichten des Passworts');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (codeToVerify) => {
    if (!codeToVerify || codeToVerify.length !== 6) {
      return;
    }

    setLoading(true);
    setError('');
    setCodeStatus('');

    try {
      const hashedPassword = await hashPassword(codeToVerify);
      const storedHash = localStorage.getItem('finance_password_hash');
      
      console.log('🔍 AUTH DEBUG:');
      console.log('Password entered:', codeToVerify);
      console.log('Generated hash:', hashedPassword);
      console.log('Stored hash:', storedHash);
      console.log('Hashes match:', hashedPassword === storedHash);
      
      if (hashedPassword === storedHash) {
        setCodeStatus('correct');
        setTimeout(() => {
          onAuthSuccess();
        }, 500);
      } else {
        setCodeStatus('incorrect');
        console.log('❌ LOGIN FAILED: Hash mismatch');
        setTimeout(() => {
          setCodeStatus('');
          setPassword('');
        }, 2000);
      }
    } catch (error) {
      console.log('❌ LOGIN ERROR:', error);
      setCodeStatus('incorrect');
      setTimeout(() => setCodeStatus(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    if (typeof window.Dexie === 'undefined') {
        console.error("Dexie library not loaded yet.");
        setError("Ein Fehler ist aufgetreten. Bitte laden Sie die Seite neu.");
        return;
    }
      
    setLoading(true);
    setError('');

    try {
      const db = new window.Dexie('ZenithFinanceDB');
      await db.open();
        
      localStorage.removeItem('finance_password_hash');
      localStorage.removeItem('finance_reset_code');
      localStorage.removeItem('finance_password_setup_date');
      localStorage.removeItem('finance_password_reset_date');
      localStorage.removeItem('finance_authenticated_persistent');
      localStorage.removeItem('finance_auth_timestamp');
      
      sessionStorage.removeItem('finance_authenticated');
      
      await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) {
              await table.clear();
          }
      });

      setMode('setup');
      setPassword('');
      setConfirmPassword('');
      setShowCodeForgotten(false);
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
      <div className="text-center mb-8">
        <ZenithLogo />
        <h1 className="text-3xl font-bold mb-3" style={{ color: jonyColors.textPrimary }}>
          Sicherheit einrichten
        </h1>
        <p className="text-lg" style={{ color: jonyColors.textSecondary }}>
          Richte einen Code für deine Finanz-App ein
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-center gap-3 mb-4">
            {Array.from({ length: 6 }, (_, index) => {
              let borderColor = jonyColors.cardBorder;
              let boxShadow = 'none';
              
              const isComplete = password.length === 6 && confirmPassword.length === 6;
              
              if (isComplete) {
                borderColor = '#00ff41'; // Neon Green
                boxShadow = '0 0 10px rgba(0, 255, 65, 0.3)';
              } else if (password[index] || (isPasswordActive && !password[index])) {
                borderColor = '#ffffff';
              }
              
              return (
                <div
                  key={index}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold cursor-pointer transition-all duration-200"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    border: `2px solid ${borderColor}`,
                    transform: password[index] ? 'scale(1.05)' : 'scale(1)',
                    boxShadow
                  }}
                  onClick={() => document.getElementById('hidden-input-setup')?.focus()}
                >
                  {password[index] ? '●' : ''}
                </div>
              );
            })}
          </div>
          <input
            id="hidden-input-setup"
            type="text"
            value={password}
            onFocus={() => setIsPasswordActive(true)}
            onBlur={() => { if (password.length === 0) setIsPasswordActive(false) }}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
              setPassword(value);
            }}
            className="opacity-0 absolute -z-10"
            maxLength="6"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-4 text-center" style={{ color: jonyColors.textSecondary }}>
            Code bestätigen
          </label>
          <div className="flex justify-center gap-3 mb-4">
            {Array.from({ length: 6 }, (_, index) => {
              let borderColor = jonyColors.cardBorder;
              let boxShadow = 'none';
              
              const isComplete = password.length === 6 && confirmPassword.length === 6;
              
              if (isComplete) {
                borderColor = '#00ff41'; // Neon Green
                boxShadow = '0 0 10px rgba(0, 255, 65, 0.3)';
              } else if (confirmPassword[index] || (isConfirmPasswordActive && !confirmPassword[index])) {
                borderColor = '#ffffff';
              }
              
              return (
                <div
                  key={index}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold cursor-pointer transition-all duration-200"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    border: `2px solid ${borderColor}`,
                    transform: confirmPassword[index] ? 'scale(1.05)' : 'scale(1)',
                    boxShadow
                  }}
                  onClick={() => document.getElementById('hidden-input-confirm')?.focus()}
                >
                  {confirmPassword[index] ? '●' : ''}
                </div>
              );
            })}
          </div>
          <input
            id="hidden-input-confirm"
            type="text"
            value={confirmPassword}
            onFocus={() => setIsConfirmPasswordActive(true)}
            onBlur={() => { if (confirmPassword.length === 0) setIsConfirmPasswordActive(false) }}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
              setConfirmPassword(value);
            }}
            className="opacity-0 absolute -z-10"
            maxLength="6"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm" style={{ color: jonyColors.red }}>
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => setMode('login')}
            className="w-full text-sm transition-colors hover:opacity-80"
            style={{ color: jonyColors.textSecondary }}
          >
            ← Zur Anmeldung zurück
          </button>
        </div>
      </div>
    </div>
  );

  const ZenithLogo = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: jonyColors.accent1Alpha }}>
        <PiggyBank className="w-8 h-8" style={{ color: jonyColors.accent1 }} />
      </div>
    </div>
  );

  const renderLoginMode = () => (
    <div className="text-center">
      <div className="mb-16">
        <ZenithLogo />
        <h1 className="text-6xl font-light" style={{ color: jonyColors.textPrimary }}>
          Anmelden
        </h1>
      </div>

      <div className="flex justify-center gap-6 mb-16">
        {Array.from({ length: 6 }, (_, index) => {
          let borderColor = jonyColors.cardBorder;
          let boxShadow = 'none';
          
          if (codeStatus === 'correct') {
            borderColor = '#00ff41';
            boxShadow = '0 0 20px rgba(0, 255, 65, 0.4)';
          } else if (codeStatus === 'incorrect') {
            borderColor = '#ff0080';
            boxShadow = '0 0 20px rgba(255, 0, 128, 0.4)';
          } else if (password[index] || (isPasswordActive && !password[index])) {
            borderColor = '#ffffff';
          }
          
          return (
            <div
              key={index}
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: jonyColors.cardBackground,
                color: jonyColors.textPrimary,
                border: `3px solid ${borderColor}`,
                transform: password[index] ? 'scale(1.05)' : 'scale(1)',
                boxShadow
              }}
              onClick={() => document.getElementById('hidden-input')?.focus()}
            >
              {password[index] ? '●' : ''}
            </div>
          );
        })}
      </div>

      <input
        id="hidden-input"
        type="text"
        value={password}
        onFocus={() => setIsPasswordActive(true)}
        onBlur={() => { if (password.length === 0) setIsPasswordActive(false) }}
        onChange={(e) => {
          const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
          setPassword(value);
          setError('');
          setCodeStatus('');
          
          if (value.length === 6) {
            setTimeout(() => handleLogin(value), 100);
          }
        }}
        className="opacity-0 absolute -z-10"
        maxLength="6"
        inputMode="numeric"
        autoComplete="off"
        onKeyDown={(e) => e.key === 'Enter' && handleLogin(password)}
      />

      {(error || codeStatus === 'incorrect') && (
        <div className="mb-8">
          <button
            onClick={() => setMode('reset')}
            className="text-lg transition-colors hover:opacity-80"
            style={{ color: jonyColors.textSecondary }}
          >
            Code vergessen?
          </button>
        </div>
      )}
    </div>
  );

  const renderResetMode = () => (
    <div className="space-y-6">
      {!showCodeForgotten ? (
        <>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: jonyColors.magentaAlpha }}>
              <Key className="w-8 h-8" style={{ color: jonyColors.magenta }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: jonyColors.textPrimary }}>
              Code vergessen?
            </h1>
            <p className="text-lg" style={{ color: jonyColors.textSecondary }}>
              Wähle eine Option um fortzufahren
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowCodeForgotten(true)}
              className="w-full font-semibold py-4 px-4 rounded-xl transition-all duration-200 hover:opacity-80 flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#000000',
                color: jonyColors.magenta,
                border: `1px solid ${jonyColors.magenta}`
              }}
            >
              <RotateCcw className="w-4 h-4" />
              App zurücksetzen
            </button>

            <button
              onClick={() => {
                setMode('login');
                setShowCodeForgotten(false);
              }}
              className="w-full text-sm transition-colors hover:opacity-80"
              style={{ color: jonyColors.textSecondary }}
            >
              ← Zurück zur Anmeldung
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: jonyColors.magentaAlpha }}>
              <RotateCcw className="w-8 h-8" style={{ color: jonyColors.magenta }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: jonyColors.textPrimary }}>
              App zurücksetzen
            </h1>
            <p className="text-lg" style={{ color: jonyColors.textSecondary }}>
              Alle Daten werden unwiderruflich gelöscht
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleCompleteReset}
              disabled={loading}
              className="w-full font-semibold py-4 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#000000',
                color: jonyColors.magenta,
                border: `1px solid ${jonyColors.magenta}`
              }}
            >
              <RotateCcw className="w-4 h-4" />
              {loading ? 'Zurücksetzen...' : 'App zurücksetzen'}
            </button>

            <button
              onClick={() => setShowCodeForgotten(false)}
              className="w-full text-sm transition-colors hover:opacity-80"
              style={{ color: jonyColors.textSecondary }}
            >
              ← Zurück
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: jonyColors.background }}>
      <div className="w-full max-w-none px-8">
        {mode === 'setup' && renderSetupMode()}
        {mode === 'login' && renderLoginMode()}
        {mode === 'reset' && renderResetMode()}
      </div>
    </div>
  );
};

export default AuthPage;