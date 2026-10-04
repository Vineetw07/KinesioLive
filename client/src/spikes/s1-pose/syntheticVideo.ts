/**
 * Synthetic Procedural Video Stream Generator
 * Tier 3 Fallback: Renders an articulated human figure performing squats onto an HTML Canvas,
 * converting it to a MediaStream via canvas.captureStream(30) for deterministic evaluation
 * without hardware camera access.
 */

export class ProceduralHumanVideoGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private phaseAngle = 0;

  constructor(width = 640, height = 480) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for procedural video generator');
    this.ctx = ctx;
  }

  public start(): MediaStream {
    if (this.isRunning && this.stream) {
      return this.stream;
    }

    this.isRunning = true;
    let lastTime = performance.now();

    const renderLoop = (time: number) => {
      if (!this.isRunning) return;
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // 0.5 Hz squat cycle
      this.phaseAngle += dt * Math.PI; // 1 full squat every 2 seconds
      this.drawHumanoid(this.phaseAngle);

      this.animId = requestAnimationFrame(renderLoop);
    };

    this.animId = requestAnimationFrame(renderLoop);
    this.stream = this.canvas.captureStream(30);
    return this.stream;
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Draws a realistic high-contrast human figure in athletic attire performing squats.
   * MediaPipe BlazePose relies on high contrast limb contours against background.
   */
  private drawHumanoid(angle: number): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Background: Gym floor & wall
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, height * 0.75, width, height * 0.25); // Floor

    // Grid floor perspective
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.75);
      ctx.lineTo(x + (x - width / 2) * 0.5, height);
      ctx.stroke();
    }

    // Squat kinematics calculation
    // Normalized squat depth: 0 = standing, 1 = deep squat
    const squatDepth = 0.5 + 0.5 * Math.sin(angle); // Oscillates 0 to 1

    const centerX = width * 0.5;
    const groundY = height * 0.78;

    // Standing baseline heights
    const headRadius = 26;
    const standingHipY = groundY - 170;
    const squatHipDescent = squatDepth * 55;
    const hipY = standingHipY + squatHipDescent;

    const shoulderY = hipY - 110;
    const headY = shoulderY - 50;

    // Feet fixed on ground
    const footSpread = 50;
    const leftFootX = centerX - footSpread;
    const rightFootX = centerX + footSpread;
    const footY = groundY;

    // Knees flex outward and lower
    const kneeSpread = footSpread + squatDepth * 28;
    const kneeY = hipY + 75 - squatDepth * 20;
    const leftKneeX = centerX - kneeSpread;
    const rightKneeX = centerX + kneeSpread;

    const hipSpread = 32;
    const leftHipX = centerX - hipSpread;
    const rightHipX = centerX + hipSpread;

    const shoulderSpread = 46;
    const leftShoulderX = centerX - shoulderSpread;
    const rightShoulderX = centerX + shoulderSpread;

    // Arms extended forward in counter-balance squat pose
    const leftElbowX = leftShoulderX - 20;
    const rightElbowX = rightShoulderX + 20;
    const elbowY = shoulderY + 30;

    const leftWristX = leftShoulderX - 10;
    const rightWristX = rightShoulderX + 10;
    const wristY = shoulderY - 10 + squatDepth * 20;

    // --- Render Figure with Natural Human Proportions ---
    // Limbs color: High-contrast athletic skin/wear
    const skinColor = '#fcd34d';
    const shirtColor = '#06b6d4';
    const shortsColor = '#3b82f6';
    const shoeColor = '#f43f5e';

    // 1. Torso
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.moveTo(leftShoulderX, shoulderY);
    ctx.lineTo(rightShoulderX, shoulderY);
    ctx.lineTo(rightHipX + 8, hipY + 10);
    ctx.lineTo(leftHipX - 8, hipY + 10);
    ctx.closePath();
    ctx.fill();

    // 2. Shorts / Pelvis
    ctx.fillStyle = shortsColor;
    ctx.beginPath();
    ctx.moveTo(leftHipX - 10, hipY);
    ctx.lineTo(rightHipX + 10, hipY);
    ctx.lineTo(rightHipX + 12, hipY + 35);
    ctx.lineTo(centerX, hipY + 25);
    ctx.lineTo(leftHipX - 12, hipY + 35);
    ctx.closePath();
    ctx.fill();

    // Helper for fleshy limbs
    const drawLimb = (x1: number, y1: number, x2: number, y2: number, width: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // 3. Legs (Thighs & Calves)
    // Left leg
    drawLimb(leftHipX, hipY + 20, leftKneeX, kneeY, 26, skinColor);
    drawLimb(leftKneeX, kneeY, leftFootX, footY, 20, skinColor);
    // Right leg
    drawLimb(rightHipX, hipY + 20, rightKneeX, kneeY, 26, skinColor);
    drawLimb(rightKneeX, kneeY, rightFootX, footY, 20, skinColor);

    // 4. Shoes / Feet
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(leftFootX - 8, footY, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightFootX + 8, footY, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Arms
    drawLimb(leftShoulderX, shoulderY + 5, leftElbowX, elbowY, 16, skinColor);
    drawLimb(leftElbowX, elbowY, leftWristX, wristY, 14, skinColor);
    drawLimb(rightShoulderX, shoulderY + 5, rightElbowX, elbowY, 16, skinColor);
    drawLimb(rightElbowX, elbowY, rightWristX, wristY, 14, skinColor);

    // 6. Neck & Head
    drawLimb(centerX, shoulderY, centerX, headY + 12, 14, skinColor);

    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(centerX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(centerX, headY - 6, headRadius, Math.PI, Math.PI * 2);
    ctx.fill();

    // Simple facial features
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(centerX - 8, headY + 2, 3, 0, Math.PI * 2);
    ctx.arc(centerX + 8, headY + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Biomechanical Angle Visualizer HUD on canvas
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    const kneeAngle = Math.round(180 - squatDepth * 85);
    ctx.fillText(`Knee Flexion: ~${kneeAngle}° (Squat Depth: ${(squatDepth * 100).toFixed(0)}%)`, 20, 30);
    ctx.fillText(`Procedural Canvas Stream (30 FPS)`, 20, 48);
  }
}
