export enum EAnimation {
    None = "none",
    FadeUp = "fade-up",
    FadeIn = "fade-in",
    ZoomIn = "zoom-in",
    SlideLeft = "slide-left",
    SlideRight = "slide-right",
    // Dramatic entrance animations (2026-05-17) — meant for hero / feature
    // blocks where one big motion per fold is the design intent. Stacking
    // them across an entire page reads as chaotic; use sparingly.
    FlyInLeft = "fly-in-left",
    FlyInRight = "fly-in-right",
    SlamDown = "slam-down",
    RocketUp = "rocket-up",
    SwingIn = "swing-in",
    FlipInX = "flip-in-x",
    FlipInY = "flip-in-y",
    SpinZoomIn = "spin-zoom-in",
    BlurFocus = "blur-focus",
    ShakeIn = "shake-in",
}

export default EAnimation
