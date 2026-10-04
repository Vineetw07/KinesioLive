/**
 * Statistical Utilities for Telemetry & Benchmark Latency Analysis
 */
export function calculatePercentile(values, percentile) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) {
        return sorted[lower];
    }
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
export function calculateAverage(values) {
    if (values.length === 0)
        return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}
export function round(val, decimals = 1) {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
}
