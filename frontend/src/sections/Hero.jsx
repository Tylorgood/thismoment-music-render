import { Suspense, lazy } from "react";
import { SITE_CONFIG } from "@/config/site";

const HeroStage3D = lazy(() => import("@/three/HeroStage3D"));

export default function Hero() {
  return (
    <section
      id="top"
      data-testid="hero-section"
      className="relative h-[100vh] min-h-[720px] w-full overflow-hidden"
    >
      {/* 3D canvas layer */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
          <HeroStage3D />
        </Suspense>
      </div>

      {/* Stage curtains */}
      <div className="curtain-left" />
      <div className="curtain-right" />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 20%, rgba(0,0,0,0.55) 75%, #0a0a0a 100%)",
        }}
      />

      {/* Sweeping spotlight overlay for extra drama */}
      <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
        <div
          className="spotlight-anim absolute -top-[10%] left-1/2 w-[60vw] h-[140vh] -translate-x-1/2 origin-top"
          style={{
            background:
              "linear-gradient(180deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0) 70%)",
            filter: "blur(28px)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-[10] h-full flex flex-col justify-end pb-24 md:pb-28 lg:pb-32 px-6 md:px-12 lg:px-24 max-w-[1400px] mx-auto">
        <div className="max-w-3xl">
          <p className="overline mb-6 opacity-0 animate-[fade_1s_.2s_forwards]" style={{ opacity: 0, animation: "fadeUp 900ms 200ms cubic-bezier(.16,1,.3,1) forwards" }}>
            <span className="inline-block w-8 h-px bg-[#D4AF37] align-middle mr-3" />
            A Creative Event & Entertainment Studio
          </p>

          <h1
            className="font-display text-white text-[13vw] md:text-[9vw] lg:text-[7.5vw] leading-[0.95] tracking-tight"
            style={{ opacity: 0, animation: "fadeUp 1000ms 400ms cubic-bezier(.16,1,.3,1) forwards" }}
          >
            This{" "}
            <em className="not-italic text-[#D4AF37]">
              Moment<span className="text-white">.</span>
            </em>
            <br />
            Studio
          </h1>

          <p
            className="mt-8 max-w-xl text-white/70 text-base md:text-lg leading-relaxed"
            style={{ opacity: 0, animation: "fadeUp 1000ms 700ms cubic-bezier(.16,1,.3,1) forwards" }}
          >
            {SITE_CONFIG.brand.tagline}
            <br className="hidden md:block" />
            <span className="text-white/50">
              {SITE_CONFIG.brand.heroSubline}
            </span>
          </p>

          <div
            className="mt-10 flex flex-wrap items-center gap-4"
            style={{ opacity: 0, animation: "fadeUp 1000ms 950ms cubic-bezier(.16,1,.3,1) forwards" }}
          >
            <a
              href="#booking"
              data-testid="hero-cta-book"
              className="btn-gold rounded-sharp px-8 py-4 text-[12px] tracking-widest-plus uppercase font-semibold inline-flex items-center gap-3"
            >
              Book an Event
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </a>
            <a
              href="#shows"
              data-testid="hero-cta-shows"
              className="btn-ghost rounded-sharp px-8 py-4 text-[12px] tracking-widest-plus uppercase font-semibold"
            >
              See Upcoming Shows
            </a>
          </div>
        </div>

        {/* Bottom meta strip */}
        <div className="mt-16 flex items-end justify-between border-t border-white/8 pt-6 text-[11px] tracking-widest-plus uppercase text-white/40">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
            Now Booking · Winter Season
          </div>
          <div className="hidden md:flex items-center gap-8">
            <span>Live · Curated · Cinematic</span>
            <a href="#experience" className="hover:text-[#D4AF37] transition">
              Scroll ↓
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
