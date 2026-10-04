/**
 * Synthetic Procedural Video Stream Generator
 * Tier 3 Fallback: Renders an articulated human figure performing squats onto an HTML Canvas,
 * converting it to a MediaStream via canvas.captureStream(30) for deterministic evaluation
 * without hardware camera access.
 */
export declare class ProceduralHumanVideoGenerator {
    private canvas;
    private ctx;
    private animId;
    private stream;
    private isRunning;
    private phaseAngle;
    constructor(width?: number, height?: number);
    start(): MediaStream;
    stop(): void;
    /**
     * Draws a realistic high-contrast human figure in athletic attire performing squats.
     * MediaPipe BlazePose relies on high contrast limb contours against background.
     */
    private drawHumanoid;
}
//# sourceMappingURL=syntheticVideo.d.ts.map