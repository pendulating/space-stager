// components/Map/ClickPopover.jsx
import React, { useMemo } from 'react';

function computeQuantileEdges(sortedVals, bins) {
  const n = sortedVals.length;
  if (n === 0) return [];
  const edges = [];
  for (let i = 0; i <= bins; i++) {
    const p = i / bins; // 0..1
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      edges.push(sortedVals[lo]);
    } else {
      const w = idx - lo;
      const val = sortedVals[lo] * (1 - w) + sortedVals[hi] * w;
      edges.push(val);
    }
  }
  return edges;
}

function computeQuantileHistogram(values, bins = 10) {
  if (!Array.isArray(values) || values.length === 0) return { counts: [], edges: [] };
  const filtered = values.filter(v => isFinite(v)).slice().sort((a, b) => a - b);
  if (filtered.length === 0) return { counts: [], edges: [] };
  const edges = computeQuantileEdges(filtered, bins);
  // count per quantile bin
  const counts = new Array(bins).fill(0);
  const lastIdx = bins - 1;
  for (const v of filtered) {
    // find first edge > v (upper bound), then subtract 1
    let i = 0;
    while (i < bins && v >= edges[i + 1]) i++;
    if (i < 0) i = 0;
    if (i > lastIdx) i = lastIdx; // include max in last bin
    counts[i] += 1;
  }
  return { counts, edges };
}

function findBinIndex(edges, value) {
  if (!edges || edges.length < 2 || !isFinite(value)) return -1;
  const bins = edges.length - 1;
  if (value <= edges[0]) return 0;
  if (value >= edges[edges.length - 1]) return bins - 1;
  let i = 0;
  while (i < bins && value >= edges[i + 1]) i++;
  if (i < 0) i = 0;
  if (i >= bins) i = bins - 1;
  return i;
}

const MiniHistogram = ({ values = [], currentValue = null, bins = 10, barWidth = 6, barGap = 2, height = 28, color = '#94a3b8', highlightColor = '#2563eb' }) => {
  const { counts, edges } = useMemo(() => computeQuantileHistogram(values, bins), [values, bins]);
  const maxCount = useMemo(() => (counts.length ? Math.max(...counts) : 0), [counts]);
  const currentIndex = useMemo(() => findBinIndex(edges, typeof currentValue === 'number' ? currentValue : Number(currentValue)), [edges, currentValue]);
  if (!counts.length || maxCount === 0) return null;

  return (
    <div className="flex items-end" style={{ height }}>
      {counts.map((c, i) => {
        const h = Math.max(2, Math.round((c / maxCount) * height));
        const isCurrent = i === currentIndex;
        return (
          <div
            key={i}
            title={`${c} areas`}
            style={{
              width: barWidth,
              height: h,
              marginRight: i === counts.length - 1 ? 0 : barGap,
              backgroundColor: isCurrent ? highlightColor : color,
              opacity: isCurrent ? 1 : 0.65,
              borderRadius: 2
            }}
          />
        );
      })}
    </div>
  );
};

const ClickPopover = ({ tooltip, stats, distributions, onFocus, onClose }) => {
  if (!tooltip || !tooltip.visible || !tooltip.content) return null;
  const avgValues = distributions?.avg || [];
  const totalValues = distributions?.total || [];
  const hasAvg = stats && typeof stats.a === 'number' && isFinite(stats.a);
  const hasTotal = stats && typeof stats.t === 'number' && isFinite(stats.t);

  return (
    <div 
      className="absolute z-50 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-xs transition-all duration-200 ease-out"
      style={{ 
        left: tooltip.x + 10, 
        top: tooltip.y + 10,
        transform: 'translateY(0) scale(1)',
        opacity: 1,
        animation: 'popover-bounce-in 200ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); }}
    >
      {/* Text fields */}
      {tooltip.content.map((field, index) => (
        <div key={index} className="text-xs mb-0.5">
          <span className="font-medium text-gray-700 dark:text-gray-200">{field.label}:</span>
          <span className="text-gray-600 dark:text-gray-300 ml-1">{field.value}</span>
        </div>
      ))}

      {/* Charts + numeric values only (no duplicate text rows) */}
      {(hasAvg || hasTotal) && (
        <div className="mt-2 space-y-2">
          {hasAvg && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                <span>Avg events/year</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{stats.a.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              </div>
              <MiniHistogram values={avgValues} currentValue={stats.a} />
            </div>
          )}
          {hasTotal && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                <span>Total since 2023</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{Math.round(stats.t).toLocaleString()}</span>
              </div>
              <MiniHistogram values={totalValues} currentValue={stats.t} />
            </div>
          )}
        </div>
      )}

      {/* Data availability notice when no stats */}
      {(!hasAvg && !hasTotal) && (
        <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
          Park usage stats are not available for this zone.
        </div>
      )}

      {/* Actions: Focus (green arrow) and Close (blue X) */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-2">
        <button
          type="button"
          title="Close"
          aria-label="Close popover"
          onClick={onClose}
          className="group inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transform transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:scale-105 hover:shadow-lg active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 8.586l3.536-3.536a1 1 0 111.414 1.414L11.414 10l3.536 3.536a1 1 0 11-1.414 1.414L10 11.414l-3.536 3.536a1 1 0 11-1.414-1.414L8.586 10 5.05 6.464a1 1 0 111.414-1.414L10 8.586z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          title="Focus on this area"
          aria-label="Focus on this area"
          onClick={onFocus}
          className="group inline-flex items-center justify-center px-2.5 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium shadow focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 transform transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
        >
          <span className="mr-1">Focus</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 transform transition-transform duration-150 ease-out group-hover:translate-x-0.5">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h9.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ClickPopover;


