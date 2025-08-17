import React, { useState, useEffect } from 'react';
import { ollamaService } from '../utils/ollamaService.js';

export default function LLMDebugDashboard() {
  const [ollama, setOllama] = useState({
    available: false,
    models: [],
    currentModel: '',
    loading: true
  });
  
  const [testData, setTestData] = useState({
    input: `15.08.2024 Überweisung Von ING-DiBa AG An REWE SAGT DANKE 1234567 -45.67 EUR
16.08.2024 SEPA-Lastschrift Netflix Europe B.V. DE89 3704 0044 0532 0130 00 -9.99 EUR
17.08.2024 Gehalt Musterfirma GmbH +2500.00 EUR
18.08.2024 Kartenzahlung LIDL SAGT DANKE 7890 -23.45 EUR`,
    output: '',
    processing: false,
    bankType: 'ING'
  });

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const available = await ollamaService.checkAvailability();
      const models = await ollamaService.getAvailableModels ? 
        await ollamaService.getAvailableModels() : [];
      
      setOllama({
        available,
        models,
        currentModel: ollamaService.model,
        loading: false
      });
    } catch (error) {
      console.error('Ollama check failed:', error);
      setOllama(prev => ({ ...prev, loading: false, available: false }));
    }
  };

  const testExtraction = async () => {
    if (!ollama.available) return;
    
    setTestData(prev => ({ ...prev, processing: true, output: '' }));
    
    try {
      const result = await ollamaService.parseBankStatement(testData.input, testData.bankType);
      setTestData(prev => ({ 
        ...prev, 
        output: JSON.stringify(result, null, 2),
        processing: false 
      }));
    } catch (error) {
      setTestData(prev => ({ 
        ...prev, 
        output: `Error: ${error.message}`,
        processing: false 
      }));
    }
  };

  const testDifferentBanks = async () => {
    const testCases = [
      { 
        bank: 'Sparkasse', 
        text: `14.08.2024 Kartenzahlung REWE Markt 1234 14.08.2024 14:32 -34.56 EUR` 
      },
      { 
        bank: 'DKB', 
        text: `15.08.2024 Lastschrift PayPal Europe Sarl et Cie Netflix -9.99 EUR` 
      },
      { 
        bank: 'N26', 
        text: `16/08/2024 Card Payment Amazon EU SARL -67.89 EUR` 
      }
    ];

    for (const testCase of testCases) {
      console.log(`Testing ${testCase.bank}:`, testCase.text);
      try {
        const result = await ollamaService.parseBankStatement(testCase.text, testCase.bank);
        console.log(`${testCase.bank} Result:`, result);
      } catch (error) {
        console.error(`${testCase.bank} Error:`, error);
      }
    }
  };

  if (ollama.loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">LLM Debug Dashboard</h3>
        <div className="text-gray-600 dark:text-gray-400">Loading Ollama status...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        🤖 LLM Debug Dashboard
      </h3>

      {/* Ollama Status */}
      <div className="border rounded-lg p-4 dark:border-gray-700">
        <h4 className="font-medium mb-2">Ollama Status</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ollama.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>{ollama.available ? 'Verfügbar' : 'Nicht verfügbar'}</span>
          </div>
          
          {ollama.available && (
            <>
              <div><strong>Aktuelles Modell:</strong> {ollama.currentModel}</div>
              <div><strong>Verfügbare Modelle:</strong> {ollama.models.join(', ')}</div>
            </>
          )}
          
          {!ollama.available && (
            <div className="text-red-600 dark:text-red-400">
              <p>Ollama ist nicht verfügbar. Installation:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Gehe zu <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline">ollama.ai</a></li>
                <li>Lade Ollama herunter und installiere es</li>
                <li>Führe aus: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ollama pull qwen2.5</code></li>
                <li>Starte die App neu</li>
              </ol>
            </div>
          )}
        </div>
        
        <button 
          onClick={checkOllamaStatus}
          className="mt-3 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Status prüfen
        </button>
      </div>

      {/* Test Interface */}
      {ollama.available && (
        <div className="border rounded-lg p-4 dark:border-gray-700">
          <h4 className="font-medium mb-3">Extraktion testen</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Bank-Typ:</label>
              <select 
                value={testData.bankType}
                onChange={(e) => setTestData(prev => ({ ...prev, bankType: e.target.value }))}
                className="w-full p-2 border rounded dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="ING">ING</option>
                <option value="Sparkasse">Sparkasse</option>
                <option value="DKB">DKB</option>
                <option value="Deutsche Bank">Deutsche Bank</option>
                <option value="N26">N26</option>
                <option value="Unknown">Unbekannt</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Test-Daten:</label>
              <textarea
                value={testData.input}
                onChange={(e) => setTestData(prev => ({ ...prev, input: e.target.value }))}
                className="w-full h-32 p-2 border rounded font-mono text-sm dark:border-gray-600 dark:bg-gray-700"
                placeholder="Füge Bankauszug-Text hier ein..."
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={testExtraction}
                disabled={testData.processing}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {testData.processing ? 'Verarbeite...' : 'Extrahieren'}
              </button>
              
              <button
                onClick={testDifferentBanks}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Verschiedene Banken testen
              </button>
            </div>
            
            {testData.output && (
              <div>
                <label className="block text-sm font-medium mb-1">Ergebnis:</label>
                <pre className="w-full h-40 p-2 bg-gray-100 dark:bg-gray-700 border rounded text-sm overflow-auto">
                  {testData.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Monitoring */}
      <div className="border rounded-lg p-4 dark:border-gray-700">
        <h4 className="font-medium mb-2">Performance Insights</h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <div>• qwen2.5:latest - Beste Genauigkeit für strukturierte Daten</div>
          <div>• phi3:latest - Schnellste Verarbeitung</div>
          <div>• mistral:7b - Ausgewogen zwischen Geschwindigkeit und Qualität</div>
        </div>
      </div>
    </div>
  );
}