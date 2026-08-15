import useReveal from "@/hooks/useReveal";

const services = [
  {
    key: "live-shows",
    n: "01",
    title: "Live Shows",
    body: "Curated live performances — DJs, bands, immersive audio-visual sets. From house shows to full theatrical residencies.",
  },
  {
    key: "private-events",
    n: "02",
    title: "Private Events",
    body: "Weddings, birthdays, dinners. Intimate productions designed for the people you love and the story you're telling.",
  },
  {
    key: "event-hosting",
    n: "03",
    title: "Event Hosting",
    body: "On-mic hosts, MCs and program directors who choreograph the room, honor your guests, and hit every cue on time.",
  },
  {
    key: "creative-production",
    n: "04",
    title: "Creative Production",
    body: "Concept-to-cameras. Staging, lighting design, sound engineering, and on-site film — one team, one vision.",
  },
  {
    key: "promotional-support",
    n: "05",
    title: "Promotional Support",
    body: "Content capture, social rollouts, and creative campaigns that keep the room full and the momentum alive.",
  },
];

export default function Services() {
  const wrap = useReveal();

  return (
    <section
      id="services"
      ref={wrap}
      data-testid="services-section"
      className="relative py-32 lg:py-40 border-t border-white/5"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20">
          <div className="lg:col-span-7 reveal">
            <p className="overline mb-6">Services</p>
            <h2 className="font-display text-white text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-tight">
              A house of specialists,
              <br />
              <span className="italic font-light text-white/60">built for the room.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-8 reveal">
            <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-md">
              Whether it's an intimate dinner for twelve or a headlining night for twelve
              hundred — every service is scaled to the moment and delivered with the same
              cinematic attention.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {services.map((s) => (
            <a
              key={s.key}
              href="#booking"
              data-testid={`service-card-${s.key}`}
              className="group relative bg-[#0a0a0a] p-8 lg:p-10 min-h-[280px] flex flex-col justify-between lift reveal hover:bg-[#111110]"
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-[#D4AF37] text-2xl">{s.n}</span>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white/40 group-hover:text-[#D4AF37] transition-all duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
                >
                  <path
                    d="M7 17L17 7M17 7H9M17 7v8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-white text-2xl md:text-3xl mb-4 group-hover:text-[#D4AF37] transition-colors duration-500">
                  {s.title}
                </h3>
                <p className="text-white/55 text-sm md:text-[15px] leading-relaxed max-w-sm">
                  {s.body}
                </p>
              </div>

              <div
                className="absolute left-0 right-0 bottom-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, #D4AF37 50%, transparent)",
                }}
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
