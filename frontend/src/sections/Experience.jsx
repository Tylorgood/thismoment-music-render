import { Suspense, lazy } from "react";
import useReveal from "@/hooks/useReveal";

const SceneAtmosphere = lazy(() => import("@/three/SceneAtmosphere"));

const scenes = [
  {
    n: "01",
    title: "Live Performance Stage",
    body: "From intimate acoustic sets to full-scale productions — we craft the sound, the light and the atmosphere so every note lands as an event.",
    img: "https://images.unsplash.com/photo-1541126274323-dbac58d14741?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwyfHxkaiUyMHBlcmZvcm1pbmclMjBkYXJrfGVufDB8fHx8MTc4MzE3NzU0M3ww&ixlib=rb-4.1.0&q=85&w=1400",
    color: "#D4AF37",
  },
  {
    n: "02",
    title: "Private Party / Lounge",
    body: "Velvet rooms, hand-picked playlists and low-lit booths. A private world designed for the people you trust and the nights you'll remember.",
    img: "https://images.unsplash.com/photo-1764255510960-deee566a91f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBldmVudCUyMHBhcnR5JTIwZGFya3xlbnwwfHx8fDE3ODMxNzc1NDN8MA&ixlib=rb-4.1.0&q=85&w=1400",
    color: "#B78E2C",
  },
  {
    n: "03",
    title: "Event Hosting",
    body: "Full-service hosting for weddings, brand nights and celebrations — hospitality choreography that feels effortless from arrival to encore.",
    img: "https://images.unsplash.com/photo-1657208431551-cbf415b8ef26?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxsaXZlJTIwc3RhZ2UlMjBzcG90bGlnaHQlMjBkYXJrfGVufDB8fHx8MTc4MzE3NzU0M3ww&ixlib=rb-4.1.0&q=85&w=1400",
    color: "#E8C14A",
  },
  {
    n: "04",
    title: "Creative Production",
    body: "Concept, direction and on-site production. We build the moment end-to-end — narrative, staging, lighting, sound, film.",
    img: "https://images.unsplash.com/photo-1767050190883-29d644fa5b99?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBldmVudCUyMHBhcnR5JTIwZGFya3xlbnwwfHx8fDE3ODMxNzc1NDN8MA&ixlib=rb-4.1.0&q=85&w=1400",
    color: "#D4AF37",
  },
];

export default function Experience() {
  const wrap = useReveal();

  return (
    <section
      id="experience"
      ref={wrap}
      data-testid="experience-section"
      className="relative py-32 lg:py-40 overflow-hidden"
    >
      {/* Ambient 3D block */}
      <div className="absolute inset-0 opacity-70 pointer-events-none">
        <Suspense fallback={null}>
          <SceneAtmosphere intensity={0.7} sparkleCount={40} />
        </Suspense>
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="max-w-3xl mb-24 reveal">
          <p className="overline mb-6">Experience</p>
          <h2 className="font-display text-white text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-tight">
            Step inside the room.
            <br />
            <span className="text-white/50 italic font-light">Every moment, a scene.</span>
          </h2>
        </div>

        <div className="space-y-32 lg:space-y-40">
          {scenes.map((s, i) => (
            <div
              key={s.n}
              className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div className="lg:col-span-6 reveal">
                <div className="relative group overflow-hidden aspect-[4/5] lg:aspect-[5/6] bg-neutral-950">
                  <img
                    src={s.img}
                    alt={s.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
                    style={{ filter: "brightness(0.72) contrast(1.05) saturate(0.95)" }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(10,10,10,0.85) 100%)",
                    }}
                  />
                  <div className="absolute top-6 left-6 font-display text-[#D4AF37] text-2xl md:text-3xl">
                    {s.n}
                    <span className="text-white/40">/04</span>
                  </div>
                  <div
                    className="absolute -bottom-0 left-0 right-0 h-24 pointer-events-none"
                    style={{
                      background: `linear-gradient(180deg, transparent, ${s.color}20 100%)`,
                    }}
                  />
                </div>
              </div>

              <div className="lg:col-span-6 lg:pl-6 xl:pl-16 reveal">
                <p className="overline mb-5">Scene {s.n}</p>
                <h3 className="font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-6">
                  {s.title}
                </h3>
                <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-lg">
                  {s.body}
                </p>
                <div className="mt-8 flex items-center gap-4 text-[12px] tracking-widest-plus uppercase text-[#D4AF37]">
                  <span className="w-8 h-px bg-[#D4AF37]" />
                  <a href="#booking" className="hover:text-white transition-colors">
                    Inquire
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
