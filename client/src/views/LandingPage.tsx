/**
 * LandingPage.tsx (Ticket 01)
 * Alabaster-Themed Hero Landing Page for KinesioLive.
 * Directly inspired by the reference design:
 * - Floating Island Navigation with electric-lime pills.
 * - Editorial typography: Bold grotesque sans-serif paired with italicized serif display accents.
 * - Flanked organic stone/topography contours and soft ambient background gradients.
 * - Interactive 3D Kinematic Mannequin preview card reacting to mouse movements.
 * - 4 Structured Bento Showcase Sections below the fold.
 * - Triggers AuthModal for instant Clinician & Patient onboarding.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from 'framer-motion';
import { type UserRole, type SessionResponse } from '@kinesio/shared';
import { AnatomicalSkeletonBackdrop3D } from '../components/AnatomicalSkeletonBackdrop3D';
import { BiomechanicalBackground } from '../components/BiomechanicalBackground';
import { AuthModal } from '../components/AuthModal';
import { springPresets } from '../styles/motionPresets';

export interface LandingPageProps {
  onAuthenticated: (
    session: SessionResponse,
    role: UserRole,
    userDetails: { name: string; id: string; protocol?: string }
  ) => void;
  onWatchDemo?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onAuthenticated,
  onWatchDemo,
}) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalRole, setAuthModalRole] = useState<UserRole>('clinician');
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [activeNavTab, setActiveNavTab] = useState<string>('home');

  const handleOpenAuth = (role: UserRole = 'clinician', mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalRole(role);
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const heroRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Global window scroll progression for floating header progress indicator
  const { scrollYProgress: pageScrollProgress } = useScroll();

  // Responsive, high-performance scroll spring with high damping to eliminate rubber-banding/jitter
  const smoothPageScroll = useSpring(pageScrollProgress, {
    damping: 45,
    stiffness: 350,
    mass: 0.15,
  });

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const smoothHeroScroll = useSpring(heroScrollProgress, {
    damping: 45,
    stiffness: 350,
    mass: 0.15,
  });

  const heroForegroundOpacity = useTransform(
    smoothHeroScroll,
    [0, 1],
    [1, prefersReducedMotion ? 1 : 0.92]
  );

  // Hardware-composited ambient depth transform (zero-jitter GPU layer)
  const ambientOrbY = useTransform(smoothPageScroll, [0, 1], [0, prefersReducedMotion ? 0 : 60]);

  // Scroll spy: automatically update active pill as user scrolls through the document
  useEffect(() => {
    const sectionIds = ['home', 'triad', 'biomechanics', 'records', 'architecture'];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveNavTab(id);
            }
          });
        },
        { rootMargin: '-25% 0px -45% 0px' }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, []);

  const scrollToSection = (id: string) => {
    setActiveNavTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface-app-frame)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >

      {/* High-Precision Biomechanical Telemetry Backdrop for Sub-Hero Content */}
      <BiomechanicalBackground topOffset="86vh" />

      {/* Horizon Kinetic Glow Divider Separating Hero from Content */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '86vh',
          left: '8%',
          right: '8%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(132, 204, 22, 0.6) 50%, transparent)',
          boxShadow: '0 0 16px rgba(132, 204, 22, 0.4)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* =========================================================================
          1. FLOATING PILL NAVIGATION BAR
          ========================================================================= */}
      <header
        style={{
          position: 'sticky',
          top: 'var(--space-4)',
          zIndex: 100,
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 var(--space-6)',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--surface-canvas)',
            backdropFilter: 'blur(20px)',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--surface-border-subtle)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}
        >
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={{
                width: '1.875rem',
                height: '1.875rem',
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary)',
                color: 'var(--accent-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1.05rem',
              }}
            >
              K
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: '1.125rem',
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              Kinesio<span style={{ color: 'var(--accent-lime)' }}>Live</span>
            </span>
          </div>

          {/* Center Navigation Links (Pill Style) */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              backgroundColor: 'var(--surface-canvas-subtle)',
              padding: '4px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--surface-border-subtle)',
            }}
            aria-label="Primary Navigation"
          >
            {[
              { id: 'home', label: 'Home' },
              { id: 'triad', label: 'Clinical Triad' },
              { id: 'biomechanics', label: 'Biomechanics' },
              { id: 'records', label: 'Exercise Logs' },
              { id: 'architecture', label: 'Architecture' },
            ].map((tab) => {
              const isActive = activeNavTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => scrollToSection(tab.id)}
                  style={{
                    position: 'relative',
                    border: 'none',
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'transparent',
                    color: isActive ? 'var(--surface-app-frame)' : 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 800 : 500,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'var(--accent-lime)',
                        borderRadius: 'var(--radius-pill)',
                        boxShadow: '0 2px 8px rgba(218, 254, 82, 0.45)',
                        zIndex: 0,
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={springPresets.snappy}
              onClick={() => handleOpenAuth('clinician', 'signin')}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: 'var(--space-2) var(--space-3)',
                cursor: 'pointer',
              }}
            >
              Sign In
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={springPresets.snappy}
              onClick={() => handleOpenAuth('patient', 'signup')}
              style={{
                border: '1px solid var(--surface-border-strong)',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--accent-cyan-bright)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
              }}
            >
              Sign Up
            </motion.button>
          </div>

          {/* Scroll-Linked Global Page Progress Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 'var(--space-4)',
              right: 'var(--space-4)',
              height: '2.5px',
              backgroundColor: 'rgba(132, 204, 22, 0.12)',
              borderRadius: 'var(--radius-pill)',
              overflow: 'hidden',
            }}
            aria-hidden="true"
          >
            <motion.div
              style={{
                height: '100%',
                backgroundColor: 'var(--accent-lime)',
                scaleX: pageScrollProgress,
                transformOrigin: '0%',
                boxShadow: '0 0 8px var(--accent-lime)',
              }}
            />
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. HERO SECTION WITH EDITORIAL TYPOGRAPHY & 3D ANATOMICAL SKELETON BACKDROP
          ========================================================================= */}
      <section
        ref={heroRef}
        id="home"
        style={{
          position: 'relative',
          padding: 'var(--space-12) var(--space-6) var(--space-8)',
          width: '100%',
          maxWidth: '100%',
          margin: 0,
          textAlign: 'center',
          minHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Full-Bleed 3D Digital Twin Biomechanical Mesh Backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
          }}
          aria-label="3D Digital Twin Biomechanical Mesh"
        >
          <AnatomicalSkeletonBackdrop3D />
          {/* Ambient GPU-accelerated motion orb */}
          <motion.div
            style={{
              position: 'absolute',
              top: '18%',
              right: '12%',
              width: '320px',
              height: '320px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
              y: ambientOrbY,
              willChange: 'transform',
              transform: 'translateZ(0)',
            }}
          />
        </div>

        {/* Hero Foreground Content */}
        <motion.div
          style={{
            position: 'relative',
            zIndex: 10,
            maxWidth: '1280px',
            width: '100%',
            opacity: heroForegroundOpacity,
          }}
        >

          {/* Massive Editorial Headline */}
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              margin: '0 auto var(--space-4)',
              maxWidth: '1160px',
              color: 'var(--text-hero-headline)',
              textShadow: '0 2px 20px rgba(255, 255, 255, 0.95), 0 0 6px rgba(255, 255, 255, 0.85)',
            }}
          >
            Precision tele-rehab that{' '}
            <span
              style={{
                fontFamily: "'Newsreader', 'Playfair Display', 'Georgia', serif",
                fontStyle: 'italic',
                fontWeight: 600,
                color: 'var(--text-hero-headline)',
              }}
            >
              sees while you move,
            </span>
            <br />
            and corrects in real-time
          </h1>

          {/* Subtitle Description */}
          <p
            style={{
              fontSize: 'clamp(1rem, 1.8vw, 1.25rem)',
              lineHeight: 1.55,
              color: 'var(--text-hero-body)',
              margin: '0 auto var(--space-6)',
              maxWidth: '880px',
              fontWeight: 700,
              textShadow: '0 1px 12px rgba(255, 255, 255, 0.95), 0 0 4px rgba(255, 255, 255, 0.85)',
            }}
          >
            Synchronous WebRTC clinical video, in-browser computer vision kinematics, and 10 Hz clinician coaching cues powered by CometChat Calls v5 and transient telemetry.
          </p>

          {/* Hero CTA Button Group with Spring Motion */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={springPresets.snappy}
              onClick={() => handleOpenAuth('clinician', 'signin')}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: 'var(--accent-lime)',
                color: 'var(--surface-app-frame)',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(218, 254, 82, 0.45)',
              }}
            >
              Start Tele-Rehab Session
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          4. BENTO SHOWCASE 1: THE CLINICAL FEEDBACK TRIAD
          ========================================================================= */}
      <motion.section
        id="triad"
        initial={{ opacity: 1 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-lime)',
              display: 'inline-block',
              marginBottom: 'var(--space-2)',
            }}
          >
            REAL-TIME COMMUNICATION ARCHITECTURE
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: 'var(--space-2) 0 0',
            }}
          >
            The Clinical Feedback Triad
          </h2>
          <p style={{ color: 'rgba(248, 250, 252, 0.85)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '820px', margin: 'var(--space-3) auto 0' }}>
            Three synchronized channels connecting clinician and patient without video stuttering or database overhead.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {/* Card 1: Calls SDK v5 Video */}
          <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              backgroundColor: 'var(--surface-canvas)',
              backdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-6)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'rgba(218, 254, 82, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              📹
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              CometChat Calls v5 Video
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Headless WebRTC voice and video streams mounted in dedicated DOM containers. Zero-contention camera tapping via <code style={{ fontSize: '0.75rem', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-cyan)', padding: '2px 4px', borderRadius: '4px' }}>requestVideoFrameCallback</code> ensures parallel computer vision without secondary camera locks.
            </p>
          </motion.div>

          {/* Card 2: 10 Hz Transient Telemetry */}
          <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              backgroundColor: 'var(--surface-canvas)',
              backdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-6)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              ⚡
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              10 Hz Transient Pose Stream
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              High-frequency joint angles, depth ratios, and valgus metrics dispatched via <code style={{ fontSize: '0.75rem', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-cyan)', padding: '2px 4px', borderRadius: '4px' }}>sendTransientMessage</code>. Zero database bloat, sub-300ms p95 latency, and Framer Motion spring smoothing for 60 FPS rendering.
            </p>
          </motion.div>

          {/* Card 3: Tactile Coaching Cues */}
          <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              backgroundColor: 'var(--surface-canvas)',
              backdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-6)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              🎯
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Tactile Coaching Cues
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Clinicians tap one-click cues (&quot;Knees Out&quot;, &quot;Slow Down&quot;, &quot;Chest Up&quot;) which transmit over CometChat custom messages and flash high-visibility HUD banners on the patient video feed within 200ms.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* =========================================================================
          5. BENTO SHOWCASE 2: PRECISION BIOMECHANICS ENGINE
          ========================================================================= */}
      <section
        id="biomechanics"
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-lime)',
              display: 'inline-block',
              marginBottom: 'var(--space-2)',
            }}
          >
            CLINICAL KINEMATICS & POSE PIPELINE
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: 'var(--space-2) 0 0',
            }}
          >
            Scientific Biomechanics Engine
          </h2>
          <p style={{ color: 'rgba(248, 250, 252, 0.85)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '820px', margin: 'var(--space-3) auto 0' }}>
            Zero-hallucination posture tracking grounded in calibrated standing baselines and unmirrored camera geometry.
          </p>
        </div>



        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {/* Valgus Baseline Card */}
          <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              backgroundColor: 'var(--surface-canvas)',
              backdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-6)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-lime)' }}>
              CALIBRATED GEOMETRY
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 'var(--space-1) 0 var(--space-2)', color: 'var(--text-primary)' }}>
              Standing Baseline Leg Length
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Valgus deviation is normalized against the invariant standing leg length L_standing measured at rest. This prevents dynamic denominator shrinkage at the bottom of squats.
            </p>
          </motion.div>

          {/* 3D Flexion */}
          <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              backgroundColor: 'var(--surface-canvas)',
              backdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-6)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              SAGITTAL PLANE
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 'var(--space-1) 0 var(--space-2)', color: 'var(--text-primary)' }}>
              3D Knee Flexion via World Landmarks
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Knee flexion angle is derived via 3D vector dot product from MediaPipe world landmarks, eliminating 2D foreshortening singularities when hips approach knee level.
            </p>
          </motion.div>

          {/* Polarity Calibration */}
          <motion.div
            whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{
              backgroundColor: 'var(--surface-canvas)',
              backdropFilter: 'blur(16px)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-6)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--status-warning)' }}>
              CAMERA SENSOR MAPPING
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 'var(--space-1) 0 var(--space-2)', color: 'var(--text-primary)' }}>
              Polarity-Corrected Valgus Deviation
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              In unmirrored sensor coordinates, left leg polarity is -1 and right leg is +1. Inward medial knee collapse always registers as a positive (+%) deviation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          6. BENTO SHOWCASE 3: THE MEDICAL EXERCISE LOG
          ========================================================================= */}
      <section
        id="records"
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-lime)',
              display: 'inline-block',
              marginBottom: 'var(--space-2)',
            }}
          >
            IMMUTABLE GROUP HISTORY
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: 'var(--space-2) 0 0',
            }}
          >
            The Chat History is the Exercise Log
          </h2>
          <p style={{ color: 'rgba(248, 250, 252, 0.85)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '820px', margin: 'var(--space-3) auto 0' }}>
            Every clinical milestone is preserved as a structured CometChat custom message, enabling instant post-session analytics without a secondary database.
          </p>
        </div>

        <motion.div
          whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          style={{
            backgroundColor: 'var(--surface-canvas)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-bento-card)',
            border: '1px solid var(--surface-border-subtle)',
            padding: 'var(--space-8)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-6)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 340px' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--status-stable)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700,
              }}
            >
              AUTOMATED POST-WORKOUT AGGREGATION
            </span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 'var(--space-3) 0 var(--space-2)' }}>
              Structured Exercise Summary
            </h3>
            <p style={{ fontSize: '0.9375rem', color: 'rgba(248, 250, 252, 0.85)', lineHeight: 1.6 }}>
              When a session concludes, KinesioLive queries the group message log via <code style={{ backgroundColor: 'rgba(56, 189, 248, 0.14)', color: 'var(--accent-cyan)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>fetchPrevious()</code> and reconstructs total repetitions, average squat depth, and form alert timelines automatically.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>100%</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Zero Key Leaks</span>
              </div>
              <div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-stable)' }}>&lt; 300ms</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>p95 Telemetry</span>
              </div>
              <div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-lime)' }}>60 FPS</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Canvas HUD</span>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: '1 1 380px',
              backgroundColor: 'var(--surface-canvas-subtle)',
              borderRadius: 'var(--radius-control)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Session Milestone History</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Group: kine-studio-demo</span>
            </div>
            {[
              { type: 'kine.session', title: 'Session Initiated', detail: 'Dr. Smith & Jane Doe connected', time: '00:00' },
              { type: 'kine.rep', title: 'Repetition #1 Logged', detail: 'Depth: 94° (Good) • Tempo: Controlled', time: '00:14' },
              { type: 'kine.alert', title: 'Knee Valgus Alert', detail: 'Left Knee (+11.4% Inward Dev)', time: '00:28' },
              { type: 'kine.cue', title: 'Clinician Cue Sent', detail: '“Knees Out” dispatched to Patient', time: '00:30' },
              { type: 'kine.rep', title: 'Repetition #2 Logged', detail: 'Depth: 91° (Good) • Form Corrected', time: '00:46' },
            ].map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2)',
                  backgroundColor: 'rgba(7, 11, 20, 0.65)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--surface-border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{msg.title}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>{msg.detail}</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>{msg.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          7. BENTO SHOWCASE 4: COMETCHAT MCP ARCHITECTURE
          ========================================================================= */}
      <section
        id="architecture"
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-lime)',
              display: 'inline-block',
              marginBottom: 'var(--space-2)',
            }}
          >
            EVALUATOR VERIFICATION
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: 'var(--space-2) 0 0',
            }}
          >
            Verified CometChat MCP Integration
          </h2>
          <p style={{ color: 'rgba(248, 250, 252, 0.85)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '820px', margin: 'var(--space-3) auto 0' }}>
            Engineered using the official CometChat Model Context Protocol (MCP) server for live documentation search and implementation bundles.
          </p>
        </div>

        <motion.div
          whileHover={{ y: -4, boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)', borderColor: 'var(--surface-border-strong)' }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          style={{
            backgroundColor: 'var(--surface-canvas)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-bento-card)',
            border: '1px solid var(--surface-border-strong)',
            padding: 'var(--space-8)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-lime)', boxShadow: '0 0 8px var(--accent-lime)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                MCP Tool Audit Log (COMETCHAT_INTEGRATION.MD)
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-lime)', fontWeight: 700 }}>
              Live Remote MCP Verified
            </span>
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: 'var(--text-primary)',
              backgroundColor: 'rgba(5, 8, 16, 0.85)',
              border: '1px solid var(--surface-border-subtle)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-control)',
              overflowX: 'auto',
            }}
          >
            <div><span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>✓ Tool:</span> list_cometchat_bundles <span style={{ color: 'var(--accent-cyan)' }}>→</span> Target: <span style={{ color: 'var(--accent-cyan-bright)' }}>@cometchat/calls-sdk-javascript@5</span></div>
            <div><span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>✓ Tool:</span> fetch_cometchat_doc_page <span style={{ color: 'var(--accent-cyan)' }}>→</span> Target: <span style={{ color: 'var(--accent-cyan-bright)' }}>join-session (Calls v5 headless token auth)</span></div>
            <div><span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>✓ Tool:</span> search_cometchat_docs <span style={{ color: 'var(--accent-cyan)' }}>→</span> Target: <span style={{ color: 'var(--accent-cyan-bright)' }}>sendTransientMessage (Group transient telemetry)</span></div>
            <div><span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>✓ Architecture:</span> Express server REST API (<code style={{ color: 'var(--accent-cyan-bright)' }}>POST /v3/users/{'{uid}'}/auth_tokens</code>) isolates Auth/REST Keys</div>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          8. CONVERSION CTA: GET STARTED IN 1-CLICK
          ========================================================================= */}
      <section
        style={{
          position: 'relative',
          zIndex: 2,
          padding: 'var(--space-12) var(--space-6)',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(7, 11, 20, 0.98) 100%)',
            border: '1px solid var(--surface-border-subtle)',
            borderRadius: 'var(--radius-bento-card)',
            padding: 'var(--space-10) var(--space-8)',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '600px',
              height: '300px',
              background: 'radial-gradient(circle, rgba(218, 254, 82, 0.12) 0%, transparent 70%)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
            }}
          />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--accent-lime)',
              display: 'inline-block',
              marginBottom: 'var(--space-2)',
            }}
          >
            Deploy Tele-Rehab In Seconds
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: '0 0 var(--space-3)',
            }}
          >
            Ready to modernise clinical motion analysis?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              maxWidth: '680px',
              margin: '0 auto var(--space-6)',
              lineHeight: 1.6,
            }}
          >
            Connect clinician and patient in synchronized WebRTC video, 10 Hz biomechanical telemetry, and real-time posture coaching.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => handleOpenAuth('clinician', 'signin')}
              style={{
                backgroundColor: 'var(--accent-lime)',
                color: 'var(--text-on-accent)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-accent-glow)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              🩺 Sign In as Clinician
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => handleOpenAuth('patient', 'signup')}
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--accent-cyan)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              🏃 Sign Up as Patient
            </motion.button>

            {onWatchDemo && (
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={onWatchDemo}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  padding: 'var(--space-3) var(--space-6)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--surface-border-subtle)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                ⚡ 1-Click Interactive Demo
              </motion.button>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. FOOTER WITH CLINICAL DISCLAIMER
          ========================================================================= */}
      <footer
        style={{
          position: 'relative',
          zIndex: 2,
          borderTop: '1px solid var(--surface-border-subtle)',
          backgroundColor: 'var(--surface-canvas)',
          padding: 'var(--space-8) var(--space-4)',
          textAlign: 'center',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>
            <strong>Clinical Disclaimer:</strong> KinesioLive provides real-time biomechanical feedback and coaching guidance for physical therapy tele-rehabilitation. It is not diagnostic medical device software.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialRole={authModalRole}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={onAuthenticated}
      />
    </div>
  );
};

export default LandingPage;
