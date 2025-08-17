"use client";

import React, { useState, useEffect } from 'react';
import { uploadLogger } from '../utils/uploadLogger';
import Card from './ui/Card';
import { Download, RefreshCw, Trash2, FileText, AlertCircle, CheckCircle, Info, Bug } from 'lucide-react';

const UploadLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  useEffect(() => {
    const updateLogs = () => {
      setLogs([...uploadLogger.logs]);
      setCurrentSession(uploadLogger.getSessionSummary());
    };

    updateLogs();
    const interval = setInterval(updateLogs, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const getLogIcon = (level) => {
    switch (level) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'DEBUG':
        return <Bug className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-green-600 dark:text-green-400';
      case 'ERROR':
        return 'text-red-600 dark:text-red-400';
      case 'WARNING':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'DEBUG':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  const filteredLogs = showDebugLogs 
    ? logs.slice(-50) // Show last 50 logs
    : logs.filter(log => log.level !== 'DEBUG').slice(-30); // Show last 30 non-debug logs

  const recentSessions = uploadLogger.getRecentSessions();

  return (
    <div className="space-y-6">
      {/* Current Session Status */}
      {currentSession && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Aktuelle Upload-Session
            </h3>
            <div className="text-sm text-slate-500">
              {Math.round(currentSession.duration / 1000)}s
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {currentSession.filename}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Datei</div>
            </div>
            
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {currentSession.steps}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Schritte</div>
            </div>
            
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {currentSession.stats.foundTransactions}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Transaktionen</div>
            </div>
            
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className={`text-lg font-bold ${currentSession.errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {currentSession.errors}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Fehler</div>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Sessions Summary */}
      {recentSessions.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Letzte Upload-Sessions
          </h3>
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  {session.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {session.filename}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {session.transactions} Transaktionen, {Math.round(session.duration / 1000)}s
                    </div>
                  </div>
                </div>
                {session.errors > 0 && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {session.errors} Fehler
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Log Viewer */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Upload-Logs
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDebugLogs(!showDebugLogs)}
              className={`px-3 py-1 text-sm rounded-md ${
                showDebugLogs 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              Debug-Logs {showDebugLogs ? 'ausblenden' : 'anzeigen'}
            </button>
            <button
              onClick={() => uploadLogger.exportLogs()}
              className="p-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              title="Logs exportieren"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                uploadLogger.clearLogs();
                setLogs([]);
              }}
              className="p-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              title="Logs löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setLogs([...uploadLogger.logs]);
                setCurrentSession(uploadLogger.getSessionSummary());
              }}
              className="p-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              title="Aktualisieren"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-96 overflow-y-auto bg-slate-900 dark:bg-slate-950 rounded-lg p-4 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              Keine Logs verfügbar. Lade ein Dokument hoch, um Logs zu sehen.
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={index} className="flex items-start space-x-2 py-1">
                <div className="flex-shrink-0 mt-0.5">
                  {getLogIcon(log.level)}
                </div>
                <div className="flex-shrink-0 text-xs text-slate-400">
                  {new Date(log.timestamp).toLocaleTimeString('de-DE')}
                </div>
                <div className={`flex-1 ${getLogColor(log.level)}`}>
                  {log.message}
                </div>
                {log.data && (
                  <div className="flex-shrink-0 text-xs text-slate-500">
                    📊
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {filteredLogs.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            Zeige {filteredLogs.length} Logs • {showDebugLogs ? 'Alle Logs' : 'Nur wichtige Logs'}
          </div>
        )}
      </Card>
    </div>
  );
};

export default UploadLogViewer;