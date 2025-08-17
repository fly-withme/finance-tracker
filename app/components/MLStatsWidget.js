'use client';

import React from 'react';
import { Brain, TrendingUp, Target, Zap, BarChart3, CheckCircle2 } from 'lucide-react';
import Card from './ui/Card';

const MLStatsWidget = ({ enhancedClassifier, useEnhancedML }) => {
  if (!enhancedClassifier || !useEnhancedML) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">ML-System</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Klassisches System aktiv</p>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Das erweiterte ML-System ist nicht verfügbar oder deaktiviert.
        </p>
      </Card>
    );
  }

  const stats = enhancedClassifier.getDetailedStats();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Smart ML-System</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Erweiterte Kategorisierung aktiv</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Genauigkeit</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {stats.accuracy}%
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Lern-Events</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {stats.totalLearningEvents.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Speicher-Nutzung
        </h4>
        <div className="space-y-2">
          {Object.entries(stats.memoryUsage).map(([type, count]) => (
            <div key={type} className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                {type === 'patterns' ? 'Muster' :
                 type === 'recipients' ? 'Empfänger' :
                 type === 'amounts' ? 'Beträge' :
                 type === 'time' ? 'Zeit' :
                 type === 'negative' ? 'Negative' : type}
              </span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Categories */}
      {stats.categoryStats && stats.categoryStats.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Top Kategorien
          </h4>
          <div className="space-y-2">
            {stats.categoryStats.slice(0, 5).map((cat, index) => (
              <div key={cat.category} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{cat.category}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {cat.count}x
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {Math.round(cat.frequency * 100)}% Nutzung
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Indicator */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-300">
            Smart ML aktiv
          </span>
        </div>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          Das System lernt kontinuierlich aus deinen Kategorisierungen
        </p>
      </div>
    </Card>
  );
};

export default MLStatsWidget;