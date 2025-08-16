import React from 'react';
import { Clock, Zap, Target, CheckCircle } from 'lucide-react';

const ProcessingStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-medium text-gray-300 mb-3">Processing Summary</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-xs text-gray-400">Processing Time</div>
            <div className="text-sm font-medium text-white">{stats.processingTime}ms</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-green-400" />
          <div>
            <div className="text-xs text-gray-400">Method</div>
            <div className="text-sm font-medium text-white">{stats.method}</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-yellow-400" />
          <div>
            <div className="text-xs text-gray-400">Auto-Labeled</div>
            <div className="text-sm font-medium text-white">
              {stats.autoLabeled || 0}/{stats.total || 0}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-xs text-gray-400">Ready to Review</div>
            <div className="text-sm font-medium text-white">
              {stats.total || 0} transactions
            </div>
          </div>
        </div>
      </div>
      
      {stats.categories && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Categories Found:</div>
          <div className="flex flex-wrap gap-1">
            {stats.categories.slice(0, 6).map(category => (
              <span 
                key={category}
                className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded"
              >
                {category}
              </span>
            ))}
            {stats.categories.length > 6 && (
              <span className="px-2 py-1 bg-gray-700 text-xs text-gray-400 rounded">
                +{stats.categories.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingStats;