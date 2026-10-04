import { Transition } from "framer-motion";

export const springPresets = {
  /** Snappy micro-interactions (buttons, pills, toggle switches) */
  snappy: {
    type: "spring",
    stiffness: 420,
    damping: 30,
  } as Transition,

  /** Fluid layout animations (cards, bento tiles, navigation sliders) */
  layout: {
    type: "spring",
    stiffness: 300,
    damping: 28,
  } as Transition,

  /** Gentle entry transitions (modals, dropdown popovers, tooltips) */
  gentle: {
    type: "spring",
    stiffness: 200,
    damping: 24,
  } as Transition,

  /** 10Hz Telemetry Value Damper (smoothing raw coordinates into 60fps movement) */
  telemetry: {
    type: "spring",
    stiffness: 140,
    damping: 18,
  } as Transition,
};

export type SpringPresetName = keyof typeof springPresets;
