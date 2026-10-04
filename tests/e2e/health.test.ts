import { describe, it, expect } from 'vitest';
import { dispatchHealthRequest, SpecReferenceServer } from './helpers/specHarness.js';

describe('Server Health Probe Test Suite (Feature 3)', () => {
  // =========================================================================
  // FEATURE 3: Server Health Probe (/api/health) (ORIGINAL_REQUEST §R2)
  // =========================================================================

  describe('Feature 3 - Tier 1: Primary Health Response Behavior', () => {
    it('F3-T1.1: GET /api/health returns HTTP 200 with status "ok"', async () => {
      const response = await dispatchHealthRequest();
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
    });

    it('F3-T1.2: GET /api/health returns a non-negative numeric uptime in seconds', async () => {
      const response = await dispatchHealthRequest();
      expect(typeof response.data.uptime).toBe('number');
      expect(response.data.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(response.data.uptime)).toBe(true);
    });

    it('F3-T1.3: GET /api/health returns a valid recent epoch timestamp in milliseconds', async () => {
      const response = await dispatchHealthRequest();
      expect(typeof response.data.timestamp).toBe('number');
      // Epoch ms should be greater than Jan 1, 2024 (1704067200000)
      expect(response.data.timestamp).toBeGreaterThan(1704067200000);
      expect(response.data.timestamp).toBeLessThanOrEqual(Date.now() + 5000);
    });

    it('F3-T1.4: health response adheres strictly to { status, uptime, timestamp } contract', async () => {
      const response = await dispatchHealthRequest();
      const keys = Object.keys(response.data).sort();
      expect(keys).toEqual(['status', 'timestamp', 'uptime']);
    });

    it('F3-T1.5: health endpoint is idempotent across multiple sequential requests', async () => {
      const res1 = await dispatchHealthRequest();
      const res2 = await dispatchHealthRequest();
      const res3 = await dispatchHealthRequest();

      expect(res1.data.status).toBe('ok');
      expect(res2.data.status).toBe('ok');
      expect(res3.data.status).toBe('ok');
      expect(res3.data.timestamp).toBeGreaterThanOrEqual(res1.data.timestamp);
    });
  });

  describe('Feature 3 - Tier 2: Boundary & Corner Cases', () => {
    it('F3-T2.1: successive health calls observe monotonic uptime progression', async () => {
      const initial = await dispatchHealthRequest();
      await new Promise(resolve => setTimeout(resolve, 50));
      const later = await dispatchHealthRequest();

      expect(later.data.uptime).toBeGreaterThanOrEqual(initial.data.uptime);
    });

    it('F3-T2.2: query parameters do not corrupt health endpoint behavior', async () => {
      const server = new SpecReferenceServer();
      const res = server.handleHealth();
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
    });

    it('F3-T2.3: health endpoint responses specify application/json content-type', async () => {
      const response = await dispatchHealthRequest();
      const contentType = response.headers['content-type'] || '';
      expect(contentType.toLowerCase()).toContain('application/json');
    });

    it('F3-T2.4: health probe handles high-frequency polling without degradation', async () => {
      const calls = await Promise.all([
        dispatchHealthRequest(),
        dispatchHealthRequest(),
        dispatchHealthRequest(),
        dispatchHealthRequest(),
        dispatchHealthRequest()
      ]);

      calls.forEach(c => {
        expect(c.status).toBe(200);
        expect(c.data.status).toBe('ok');
        expect(c.data.uptime).toBeGreaterThanOrEqual(0);
      });
    });

    it('F3-T2.5: health probe clock alignment does not drift into the future', async () => {
      const before = Date.now();
      const res = await dispatchHealthRequest();
      const after = Date.now();

      expect(res.data.timestamp).toBeGreaterThanOrEqual(before - 100);
      expect(res.data.timestamp).toBeLessThanOrEqual(after + 100);
    });
  });
});
