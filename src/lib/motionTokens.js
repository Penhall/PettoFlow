export const MOTION_EASING_STANDARD = [0.2, 0, 0, 1]

export const MOTION_TIMINGS = {
  quick: 0.18,
  overlay: 0.22,
}

export const MOTION_TRANSITIONS = {
  fade: {
    duration: MOTION_TIMINGS.quick,
    ease: MOTION_EASING_STANDARD,
  },
  overlay: {
    duration: MOTION_TIMINGS.overlay,
    ease: MOTION_EASING_STANDARD,
  },
  modal: {
    duration: MOTION_TIMINGS.quick,
    ease: MOTION_EASING_STANDARD,
  },
}
