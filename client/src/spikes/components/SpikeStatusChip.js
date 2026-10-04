import React from 'react';
import { motion } from 'framer-motion';
export const SpikeStatusChip = ({ status, label, className = '' }) => {
    const getStyleClass = () => {
        switch (status) {
            case 'pass':
                return 'kine-chip-pass';
            case 'fail':
                return 'kine-chip-fail';
            case 'running':
                return 'kine-chip-running';
            case 'idle':
            default:
                return 'kine-chip-idle';
        }
    };
    const displayText = label || status.toUpperCase();
    return (<span className={`kine-chip ${getStyleClass()} ${className}`}>
      {status === 'running' ? (<motion.span className="kine-chip-dot" animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}/>) : (<span className="kine-chip-dot"/>)}
      {displayText}
    </span>);
};
export default SpikeStatusChip;
