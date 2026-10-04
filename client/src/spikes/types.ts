/**
 * Interfaces & Type Contracts for Spikes S1–S5 Testbed
 * Milestone D2.1 – D2.5
 */

import type { UserRole } from '@kinesio/shared';

export type SpikeId = 's1-pose' | 's2-telemetry' | 's3-calls' | 's4-persistence';
export type SpikeStatus = 'idle' | 'running' | 'pass' | 'fail';

export interface SpikeLogEntry {
  id: string;
  timestamp: number;
  spikeId: SpikeId | 'system';
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: Record<string, unknown>;
}

export interface S1PoseMetrics {
  instantFps: number;
  sustainedFps: number;
  avgLatencyMs: number;
  totalFrames: number;
  keypointsDetected: number;
  delegateUsed: 'GPU' | 'CPU';
  videoSource: 'webcam' | 'synthetic' | 'reference';
  kneeFlexionDeg?: { L: number | null; R: number | null };
  pass: boolean;
}

export interface S2TelemetryMetrics {
  messagesSent: number;
  messagesReceived: number;
  targetCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  lossPct: number;
  effectiveHz: number;
  durationMs: number;
  pass: boolean;
}

export interface S3CallsMetrics {
  role: UserRole;
  uid: string;
  sessionId: string;
  connectLatencyMs: number;
  audioMuted: boolean;
  videoConnected: boolean;
  containerRendered: boolean;
  pass: boolean;
}

export interface S4PersistenceMetrics {
  sentCount: number;
  retrievedCount: number;
  targetCount: number;
  chronologicalMatch: boolean;
  messageTypesRetrieved: string[];
  retrievalLatencyMs: number;
  pass: boolean;
}

export interface SpikeMetrics {
  s1?: S1PoseMetrics;
  s2?: S2TelemetryMetrics;
  s3?: S3CallsMetrics;
  s4?: S4PersistenceMetrics;
}

export interface SpikeResult {
  id: SpikeId;
  name: string;
  status: SpikeStatus;
  metrics?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  timestamp: number;
}

export interface KillSwitchEvaluationItem {
  spikeId: SpikeId;
  name: string;
  milestone: string;
  criteria: string;
  status: SpikeStatus;
  primaryMetric: string;
  threshold: string;
  actual: string;
  passed: boolean;
}
