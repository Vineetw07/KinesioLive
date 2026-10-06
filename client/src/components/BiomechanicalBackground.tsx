import React from 'react';

export interface BiomechanicalBackgroundProps {
  topOffset?: string | number;
  className?: string;
  imageSrc?: string;
}

/**
 * BiomechanicalBackground (Dark Bluish Theme)
 * High-precision medical engineering telemetry backdrop.
 * - Layered cybernetic dark navy background (/assets/dark_telemetry_bg.jpg).
 * - Dual-layer SVG precision grid (32px minor dot matrix + 128px major blueprint coordinate grid).
 * - Precision luminous crosshairs (+), corner datum calipers, and kinematic angle guides.
 * - Luminous clinical ambient lighting auras (Electric Lime #84CC16, Cyan Telemetry #06B6D4).
 * - Margin telemetry annotations ([REF-SYSTEM: ISO-13485], [SAGITTAL PLANE 3D], [10Hz TELEMETRY]).
 * - Non-interactive (pointerEvents: none), 100% accessible (aria-hidden: true).
 */
export const BiomechanicalBackground: React.FC<BiomechanicalBackgroundProps> = ({
  topOffset = 0,
  imageSrc = '/assets/dark_telemetry_bg.jpg',
}) => {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: topOffset,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        backgroundColor: 'var(--surface-canvas)',
      }}
    >
      {/* Layer 0: High-End Cinematic Dark Bluish Background Wallpaper */}
      {imageSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.38,
            mixBlendMode: 'luminosity',
            filter: 'contrast(1.15) brightness(0.9)',
          }}
        />
      )}

      {/* Layer 1: Ambient Triad Atmospheric Luminous Lighting Glows */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 850px 550px at 15% 15%, rgba(6, 182, 212, 0.12) 0%, transparent 72%),
            radial-gradient(ellipse 900px 650px at 85% 45%, rgba(132, 204, 22, 0.10) 0%, transparent 75%),
            radial-gradient(ellipse 750px 550px at 25% 85%, rgba(99, 102, 241, 0.08) 0%, transparent 70%),
            radial-gradient(circle 600px at 50% 50%, rgba(7, 11, 20, 0.65) 0%, transparent 90%)
          `,
        }}
      />

      {/* Layer 2: Precision SVG Telemetry Grid & Crosshairs */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.9,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Minor 32px Dot-Mesh Pattern */}
          <pattern
            id="kine-minor-dots-dark"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="16" cy="16" r="1.1" fill="rgba(56, 189, 248, 0.12)" />
          </pattern>

          {/* Major 128px Technical Grid with Center Crosshair */}
          <pattern
            id="kine-major-grid-dark"
            width="128"
            height="128"
            patternUnits="userSpaceOnUse"
          >
            {/* Fine coordinate lines */}
            <path
              d="M 128 0 L 0 0 0 128"
              fill="none"
              stroke="rgba(56, 189, 248, 0.08)"
              strokeWidth="1"
            />
            {/* Precision Crosshair (+) at Origin */}
            <path
              d="M 0 6 L 0 -6 M -6 0 L 6 0"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth="1.2"
            />
            {/* Secondary Crosshair (+) at Center (64, 64) */}
            <path
              d="M 64 68 L 64 60 M 60 64 L 68 64"
              stroke="rgba(132, 204, 22, 0.45)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Fill Background Patterns */}
        <rect width="100%" height="100%" fill="url(#kine-minor-dots-dark)" />
        <rect width="100%" height="100%" fill="url(#kine-major-grid-dark)" />
      </svg>

      {/* Layer 3: Engineering Perimeter Watermarks & Coordinate Ticks */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '28px',
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: '0.625rem',
          letterSpacing: '0.14em',
          color: 'rgba(148, 163, 184, 0.6)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: 'var(--accent-lime)', fontWeight: 800 }}>+</span>
        <span>REF: ISO-13485 // KINESIOLIVE TELEMETRY MESH</span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '28px',
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: '0.625rem',
          letterSpacing: '0.14em',
          color: 'rgba(148, 163, 184, 0.6)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>LAT: 34.0522° // 10Hz TRANSIENT POSE</span>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>+</span>
      </div>

      {/* Layer 4: Subtle Biomechanical Joint Angle Indicator Watermark (Center Left) */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '2%',
          opacity: 0.35,
          transform: 'translateY(-50%)',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <circle cx="70" cy="70" r="58" stroke="rgba(56, 189, 248, 0.3)" strokeDasharray="3 4" strokeWidth="1" />
          <circle cx="70" cy="70" r="38" stroke="rgba(132, 204, 22, 0.7)" strokeWidth="1.2" />
          <line x1="70" y1="12" x2="70" y2="128" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />
          <line x1="12" y1="70" x2="128" y2="70" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />
          <path d="M 70 70 L 105 35" stroke="rgba(6, 182, 212, 0.9)" strokeWidth="1.5" />
          <text x="74" y="58" fill="rgba(248, 250, 252, 0.75)" fontSize="9" fontFamily="monospace">90.0°</text>
        </svg>
      </div>

      {/* Layer 5: Subtle Biomechanical Depth Ratio Indicator Watermark (Center Right) */}
      <div
        style={{
          position: 'absolute',
          top: '65%',
          right: '2%',
          opacity: 0.35,
          transform: 'translateY(-50%)',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <rect x="25" y="25" width="90" height="90" rx="12" stroke="rgba(56, 189, 248, 0.3)" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="25" y1="70" x2="115" y2="70" stroke="rgba(132, 204, 22, 0.7)" strokeWidth="1.2" />
          <circle cx="70" cy="70" r="4" fill="rgba(6, 182, 212, 0.9)" />
          <text x="32" y="64" fill="rgba(248, 250, 252, 0.75)" fontSize="8" fontFamily="monospace">VALGUS &lt; 8%</text>
          <text x="32" y="82" fill="rgba(248, 250, 252, 0.75)" fontSize="8" fontFamily="monospace">Z-CALIB: OK</text>
        </svg>
      </div>
    </div>
  );
};
