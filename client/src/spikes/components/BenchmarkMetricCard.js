import React from 'react';
export const BenchmarkMetricCard = ({ title, value, unit, threshold, status = 'idle', subtext, }) => {
    const getCardClass = () => {
        switch (status) {
            case 'pass':
                return 'kine-metric-card kine-metric-card-pass';
            case 'fail':
                return 'kine-metric-card kine-metric-card-fail';
            case 'running':
                return 'kine-metric-card kine-metric-card-running';
            default:
                return 'kine-metric-card';
        }
    };
    return (<div className={getCardClass()}>
      <span className="kine-metric-title">{title}</span>
      <div className="kine-metric-val-wrap">
        <span className="kine-metric-value">{value}</span>
        {unit && <span className="kine-metric-unit">{unit}</span>}
      </div>
      {threshold && <span className="kine-metric-threshold">Target: {threshold}</span>}
      {subtext && (<span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
          {subtext}
        </span>)}
    </div>);
};
export default BenchmarkMetricCard;
