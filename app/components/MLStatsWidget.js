'use client';

import React, { useState } from 'react';
import { Brain, TrendingUp, Target, Zap, BarChart3, CheckCircle2 } from 'lucide-react';
import Card from './ui/Card';
import { jonyColors } from '../theme';

const MLStatsWidget = ({ enhancedClassifier, useEnhancedML }) => {
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (metricType, event) => {
    setHoveredMetric(metricType);
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseMove = (event) => {
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredMetric(null);
  };

  const getTooltipContent = (metricType, stats) => {
    switch (metricType) {
      case 'accuracy':
        return {
          title: '🎯 Neural Precision',
          description: 'Machine Learning Accuracy Score',
          details: `${stats.accuracy}% Precision Rate • Auto-Classification Engine`
        };
      case 'learningEvents':
        return {
          title: '🧠 Training Cycles',
          description: 'Adaptive Learning Events',
          details: `${stats.totalLearningEvents.toLocaleString()} Neural Updates • Continuous Optimization`
        };
      default:
        return null;
    }
  };
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
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
          background: `linear-gradient(to bottom right, ${jonyColors.accent1}, ${jonyColors.accent2})`
        }}>
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Smart ML-System</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Erweiterte Kategorisierung aktiv</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div 
          className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: jonyColors.cardBackground,
            border: `1px solid ${jonyColors.cardBorder}`
          }}
          onMouseEnter={(e) => handleMouseEnter('accuracy', e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4" style={{ color: jonyColors.accent1 }} />
            <span className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>Genauigkeit</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
            {stats.accuracy}%
          </div>
        </div>

        <div 
          className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: jonyColors.cardBackground,
            border: `1px solid ${jonyColors.cardBorder}`
          }}
          onMouseEnter={(e) => handleMouseEnter('learningEvents', e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: jonyColors.accent2 }} />
            <span className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>Lern-Events</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
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
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></span>
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
      <div className="rounded-lg p-3" style={{
        backgroundColor: jonyColors.greenAlpha,
        border: `1px solid ${jonyColors.accent1}33`
      }}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: jonyColors.accent1 }} />
          <span className="text-sm font-medium" style={{ color: jonyColors.accent1 }}>
            Smart ML aktiv
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: jonyColors.accent1 }}>
          Das System lernt kontinuierlich aus deinen Kategorisierungen
        </p>
      </div>

      {/* Tooltip */}
      {hoveredMetric && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div style={{
            backgroundColor: jonyColors.cardBackground,
            border: `1px solid ${jonyColors.accent1}`,
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: `0 0 20px ${jonyColors.accent1}33, 0 12px 40px rgba(0, 0, 0, 0.8)`,
            color: jonyColors.textPrimary,
            fontSize: '14px',
            fontWeight: '500',
            maxWidth: '280px',
            backdropFilter: 'blur(8px)'
          }}>
            {(() => {
              const tooltipContent = getTooltipContent(hoveredMetric, stats);
              return tooltipContent ? (
                <>
                  <p style={{ 
                    color: jonyColors.accent1, 
                    margin: '0 0 8px 0',
                    fontWeight: '700',
                    fontSize: '15px',
                    textShadow: `0 0 8px ${jonyColors.accent1}66`
                  }}>
                    {tooltipContent.title}
                  </p>
                  <p style={{ 
                    color: jonyColors.textSecondary,
                    margin: '0 0 8px 0',
                    fontSize: '12px',
                    fontWeight: '400',
                    letterSpacing: '0.5px'
                  }}>
                    {tooltipContent.description}
                  </p>
                  <p style={{ 
                    color: jonyColors.textPrimary,
                    margin: '0',
                    fontSize: '13px',
                    fontWeight: '600',
                    fontFamily: 'monospace',
                    letterSpacing: '0.3px'
                  }}>
                    {tooltipContent.details}
                  </p>
                </>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </Card>
  );
};

export default MLStatsWidget;