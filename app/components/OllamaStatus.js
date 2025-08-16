import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle, XCircle, Download, ExternalLink } from 'lucide-react';
import { ollamaService } from '../utils/ollamaService';

const OllamaStatus = () => {
  const [status, setStatus] = useState('checking'); // 'checking', 'available', 'unavailable'
  const [model, setModel] = useState(null);

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const isAvailable = await ollamaService.checkAvailability();
      if (isAvailable) {
        setStatus('available');
        setModel(ollamaService.model);
      } else {
        setStatus('unavailable');
      }
    } catch (error) {
      setStatus('unavailable');
    }
  };

  if (status === 'checking') {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-400">
        <Bot className="w-4 h-4 animate-pulse" />
        <span>Checking AI status...</span>
      </div>
    );
  }

  if (status === 'available') {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
      <div className="flex items-start space-x-3">
        <XCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium text-blue-400 mb-2">
            Verbesserte PDF-Auslesung verfügbar
          </h4>
          <p className="text-sm text-gray-300 mb-3">
            Installiere Ollama für deutlich bessere und genauere Extraktion von Bankdaten aus PDFs.
          </p>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>1. Installiere Ollama von</span>
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                <span>ollama.ai</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>2. Führe aus: <code className="px-1 py-0.5 bg-gray-800 rounded text-blue-300">ollama pull llama3.2</code></span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>3. Starte die App neu</span>
            </div>
          </div>
          <button
            onClick={checkOllamaStatus}
            className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            Status prüfen
          </button>
        </div>
      </div>
    </div>
  );
};

export default OllamaStatus;