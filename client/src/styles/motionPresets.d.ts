import { Transition } from "framer-motion";
export declare const springPresets: {
    /** Snappy micro-interactions (buttons, pills, toggle switches) */
    snappy: Transition;
    /** Fluid layout animations (cards, bento tiles, navigation sliders) */
    layout: Transition;
    /** Gentle entry transitions (modals, dropdown popovers, tooltips) */
    gentle: Transition;
    /** 10Hz Telemetry Value Damper (smoothing raw coordinates into 60fps movement) */
    telemetry: Transition;
};
export type SpringPresetName = keyof typeof springPresets;
//# sourceMappingURL=motionPresets.d.ts.map