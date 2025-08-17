"use client";

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import Card from './ui/Card';
import { Database, Eye, EyeOff, Trash2, CheckCircle } from 'lucide-react';

const formatCurrency = (amount) => amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const InboxDebugViewer = () => {
  const [showRaw, setShowRaw] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const allInboxTransactions = useLiveQuery(() => db.inbox.orderBy('uploadedAt').reverse().toArray(), []) || [];
  const activeTransactions = allInboxTransactions.filter(tx => !tx.skipped);
  const skippedTransactions = allInboxTransactions.filter(tx => tx.skipped);

  const clearInbox = async () => {
    if (confirm('Alle Inbox-Transaktionen löschen?')) {
      await db.inbox.clear();
    }
  };

  const deleteTransaction = async (id) => {
    await db.inbox.delete(id);
  };

  const stats = {
    total: allInboxTransactions.length,
    active: activeTransactions.length,
    skipped: skippedTransactions.length,
    withCategory: allInboxTransactions.filter(tx => tx.category && tx.category !== 'null').length,
    withoutCategory: allInboxTransactions.filter(tx => !tx.category || tx.category === 'null').length
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center">
            <Database className="w-6 h-6 mr-2" />
            Inbox Debug Viewer
          </h2>
          <button
            onClick={clearInbox}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Inbox leeren
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.total}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Gesamt</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.active}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Aktiv</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.skipped}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Übersprungen</div>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.withCategory}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Mit Kategorie</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.withoutCategory}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Ohne Kategorie</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm ${
              showRaw 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            Raw Data {showRaw ? 'ausblenden' : 'anzeigen'}
          </button>
          
          <button
            onClick={() => setShowSkipped(!showSkipped)}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm ${
              showSkipped 
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' 
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {showSkipped ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            Übersprungene {showSkipped ? 'ausblenden' : 'anzeigen'}
          </button>
        </div>
      </Card>

      {/* Active Transactions */}
      {activeTransactions.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            Aktive Transaktionen ({activeTransactions.length})
          </h3>
          <div className="space-y-3">
            {activeTransactions.map((tx, index) => (
              <div key={tx.id || index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-4">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {tx.recipient || 'Unbekannter Empfänger'}
                    </div>
                    <div className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(tx.amount)}
                    </div>
                    {tx.category && tx.category !== 'null' && (
                      <div className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-sm">
                        🤖 {tx.category}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTransaction(tx.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Datum:</strong> {tx.date}</div>
                  <div><strong>Beschreibung:</strong> {tx.description || 'Keine Beschreibung'}</div>
                  <div><strong>Konto:</strong> {tx.account || 'Unbekannt'}</div>
                  <div><strong>Upload:</strong> {new Date(tx.uploadedAt).toLocaleString('de-DE')}</div>
                </div>

                {showRaw && (
                  <details className="mt-3">
                    <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer">Raw Data anzeigen</summary>
                    <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-x-auto">
                      {JSON.stringify(tx, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Skipped Transactions */}
      {showSkipped && skippedTransactions.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 text-yellow-600 dark:text-yellow-400">
            Übersprungene Transaktionen ({skippedTransactions.length})
          </h3>
          <div className="space-y-3">
            {skippedTransactions.map((tx, index) => (
              <div key={tx.id || index} className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {tx.recipient || 'Unbekannter Empfänger'}
                    </div>
                    <div className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTransaction(tx.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {tx.description || 'Keine Beschreibung'} • {tx.date}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {allInboxTransactions.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Database className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">
              Keine Transaktionen in der Inbox
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Lade einen Kontoauszug hoch, um Transaktionen hier zu sehen.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default InboxDebugViewer;