/**
 * tests/uiOverhaul.test.ts
 * Verification suite for UI Overhaul (Tickets 01 & 02).
 * Validates landing page contracts, auth session routing, lobby initialization,
 * and production build integrity.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CLINICIAN_UID,
  PATIENT_UID,
  SCHEMA_VERSION,
  type SessionResponse,
} from '../shared/src/index.js';
import { parseSessionParams } from '../client/src/utils/sessionGuard.js';

describe('UI Overhaul Verification Suite (Tickets 01 & 02)', () => {
  describe('Session Routing & Deep-Link Parameters', () => {
    it('correctly parses clinician lobby deep-links', () => {
      const parsed = parseSessionParams('?role=clinician&session=kine-studio-demo');
      expect(parsed.isValid).toBe(true);
      expect(parsed.role).toBe('clinician');
      expect(parsed.sessionId).toBe('kine-studio-demo');
    });

    it('correctly parses patient lobby deep-links with custom room', () => {
      const parsed = parseSessionParams('?role=patient&session=kine-room-99');
      expect(parsed.isValid).toBe(true);
      expect(parsed.role).toBe('patient');
      expect(parsed.sessionId).toBe('kine-room-99');
    });
  });

  describe('Contract and Credentials Integrity', () => {
    it('enforces deterministic demo user constants', () => {
      expect(CLINICIAN_UID).toBe('dr-demo');
      expect(PATIENT_UID).toBe('pt-demo');
      expect(SCHEMA_VERSION).toBe(1);
    });

    it('validates SessionResponse contract compatibility', () => {
      const mockSession: SessionResponse = {
        sessionId: 'kine-test-room',
        authToken: 'auth_token_mock',
        uid: CLINICIAN_UID,
        appId: 'mock-app-id',
        region: 'us',
      };
      expect(mockSession.uid).toBe(CLINICIAN_UID);
      expect(mockSession.sessionId).toBe('kine-test-room');
      expect(mockSession.authToken).toBeDefined();
    });
  });

  describe('Component Architecture on Disk', () => {
    it('verifies AnatomicalSkeletonBackdrop3D component exists with medical wireframe fidelity', () => {
      const filePath = path.resolve(__dirname, '../client/src/components/AnatomicalSkeletonBackdrop3D.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('AnatomicalSkeletonBackdrop3D');
      expect(content).toContain('vertebraeCount');
      expect(content).toContain('craniumRings');
      expect(content).toContain('drawGlowingJoint');
      expect(content).toContain('draw3DPolygon');
      expect(content).toContain('TELE-REHAB ACTIVE');
      expect(content).toContain('KNEE FLEXION');
    });

    it('verifies KinematicMannequin3D component exists on disk', () => {
      const filePath = path.resolve(__dirname, '../client/src/components/KinematicMannequin3D.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('KinematicMannequin3D');
      expect(content).toContain('Knees Out');
    });

    it('verifies AuthModal component exists with 1-click quick access', () => {
      const filePath = path.resolve(__dirname, '../client/src/components/AuthModal.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('AuthModal');
      expect(content).toContain('Instant Evaluator 1-Click Access');
      expect(content).toContain('Dr. Smith (Clinician)');
      expect(content).toContain('Jane Doe (Patient)');
    });

    it('verifies LandingPage component exists with 4 bento sections and 3D digital twin', () => {
      const filePath = path.resolve(__dirname, '../client/src/views/LandingPage.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('LandingPage');
      expect(content).toContain('AnatomicalSkeletonBackdrop3D');
      expect(content).toContain('The Clinical Feedback Triad');
      expect(content).toContain('Scientific Biomechanics Engine');
      expect(content).toContain('3D Digital Twin Biomechanical Mesh');
      expect(content).toContain('Verified CometChat MCP Integration');
      // Ensure footer branding line requested for removal is gone
      expect(content).not.toContain('Built for CometChat #ZeroToChat');
    });

    it('verifies LandingPage includes full-page scroll animations, ambient motion, and sliding nav pills', () => {
      const filePath = path.resolve(__dirname, '../client/src/views/LandingPage.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('useScroll');
      expect(content).toContain('useTransform');
      expect(content).toContain('useSpring');
      expect(content).toContain('useReducedMotion');
      expect(content).toContain('smoothHeroScroll');
      expect(content).toContain('smoothPageScroll');
      expect(content).toContain('ambientOrbY');
      expect(content).toContain('layoutId="activeNavPill"');
      expect(content).toContain('whileInView');
    });

    it('verifies ClinicianLobby and PatientLobby components exist', () => {
      const clinicianLobbyPath = path.resolve(__dirname, '../client/src/views/ClinicianLobby.tsx');
      const patientLobbyPath = path.resolve(__dirname, '../client/src/views/PatientLobby.tsx');
      expect(fs.existsSync(clinicianLobbyPath)).toBe(true);
      expect(fs.existsSync(patientLobbyPath)).toBe(true);

      const clinicianContent = fs.readFileSync(clinicianLobbyPath, 'utf-8');
      expect(clinicianContent).toContain('Verified Medical Credential');
      expect(clinicianContent).toContain('Certificate of Orthopedic Specialization');

      const patientContent = fs.readFileSync(patientLobbyPath, 'utf-8');
      expect(patientContent).toContain('Rehabilitation Record');
      expect(patientContent).toContain('Camera');
      expect(patientContent).toContain('Pre-Flight Patient Orientation');
    });

    it('verifies App.tsx routes to landing, lobby, and studio without spikes tab in navigation', () => {
      const appPath = path.resolve(__dirname, '../client/src/App.tsx');
      expect(fs.existsSync(appPath)).toBe(true);
      const content = fs.readFileSync(appPath, 'utf-8');
      expect(content).toContain('LandingPage');
      expect(content).toContain('ClinicianLobby');
      expect(content).toContain('PatientLobby');
      // Ensure Spikes Testbed is completely removed from navigation
      expect(content).not.toContain("currentTab === 'spikes'");
      expect(content).not.toContain("<SpikesHarness");
    });

    it('verifies Patient view mounts dynamic 2D canvas skeleton overlay for live pose tracking', () => {
      const patientPath = path.resolve(__dirname, '../client/src/views/Patient.tsx');
      expect(fs.existsSync(patientPath)).toBe(true);
      const content = fs.readFileSync(patientPath, 'utf-8');
      expect(content).toContain('canvasRef');
      expect(content).toContain('syncCanvasToVideo');
      expect(content).toContain('renderCanvasOverlay');
      // Must track individual video element rather than assuming full container bounds
      expect(content).toContain('computeCanvasOverlayBounds');
      expect(content).toContain('findPatientVideoElement');
    });

    it('verifies client production build bundle exists and is valid', () => {
      const distIndexHtml = path.resolve(__dirname, '../client/dist/index.html');
      expect(fs.existsSync(distIndexHtml)).toBe(true);
      const htmlContent = fs.readFileSync(distIndexHtml, 'utf-8');
      expect(htmlContent).toContain('<div id="root"></div>');
    });
  });
});
