"use client";

import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';
import Card from './ui/Card';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Cpu, Memory } from 'lucide-react';

const PerformanceDashboard = () => {
  const [stats, setStats] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [systemStatus, setSystemStatus] = useState('good');

  useEffect(() => {
    const updateStats = () => {
      const allStats = performanceMonitor.getAllStats();
      const recs = performanceMonitor.getOptimizationRecommendations();
      const isOverloaded = performanceMonitor.isSystemOverloaded();
      
      setStats(allStats);
      setRecommendations(recs);
      setSystemStatus(isOverloaded ? 'overloaded' : recs.length > 0 ? 'warning' : 'good');
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMemory = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const getStatusIcon = () => {
    switch (systemStatus) {
      case 'good':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'overloaded':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (systemStatus) {
      case 'good':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'overloaded':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            System Performance
          </h3>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className={`font-medium ${getStatusColor()}`}>
              {systemStatus === 'good' ? 'Optimal' : 
               systemStatus === 'warning' ? 'Needs Attention' : 'Overloaded'}
            </span>
          </div>
        </div>

        {/* Performance Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(stats).map(([operation, stat]) => (
            <div key={operation} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                  {operation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h4>
                <div className="flex items-center space-x-1">
                  <Cpu className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-500">{stat.count} runs</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Avg Duration:</span>
                  <span className="text-sm font-mono text-slate-800 dark:text-slate-200">
                    {formatDuration(stat.averageDuration)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Range:</span>
                  <span className="text-sm font-mono text-slate-800 dark:text-slate-200">
                    {formatDuration(stat.minDuration)} - {formatDuration(stat.maxDuration)}
                  </span>
                </div>
                
                {stat.averageMemoryDelta !== 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Memory:</span>
                    <span className="text-sm font-mono text-slate-800 dark:text-slate-200">
                      {stat.averageMemoryDelta > 0 ? '+' : ''}{formatMemory(stat.averageMemoryDelta)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-3 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
              Performance Recommendations
            </h4>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {rec.type === 'SLOW_OPERATION' ? (
                        <TrendingDown className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      ) : (
                        <Memory className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        {rec.message}
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {rec.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data message */}
        {Object.keys(stats).length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No performance data available yet.</p>
            <p className="text-sm mt-1">Upload a document to see performance metrics.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PerformanceDashboard;