import useReveal from "@/hooks/useReveal";

const images = [
  {
    src: "https://images.unsplash.com/photo-1558620013-a08999547a36?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxsaXZlJTIwc3RhZ2UlMjBzcG90bGlnaHQlMjBkYXJrfGVufDB8fHx8MTc4MzE3NzU0M3ww&ixlib=rb-4.1.0&q=85&w=1600",
    alt: "Live stage with dramatic spotlights",
    span: "md:col-span-8 md:row-span-2",
  },
  {
    src: "https://images.unsplash.com/photo-1541126274323-dbac58d14741?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwyfHxkaiUyMHBlcmZvcm1pbmclMjBkYXJrfGVufDB8fHx8MTc4MzE3NzU0M3ww&ixlib=rb-4.1.0&q=85&w=1200",
    alt: "DJ set in amber light",
    span: "md:col-span-4",
  },
  {
    src: "https://images.unsplash.com/photo-1764255510960-deee566a91f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBldmVudCUyMHBhcnR5JTIwZGFya3xlbnwwfHx8fDE3ODMxNzc1NDN8MA&ixlib=rb-4.1.0&q=85&w=1200",
    alt: "Luxury private dinner under a disco ball",
    span: "md:col-span-4",
  },
  {
    src: "https://images.unsplash.com/photo-1657208431551-cbf415b8ef26?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxsaXZlJTIwc3RhZ2UlMjBzcG90bGlnaHQlMjBkYXJrfGVufDB8fHx8MTc4MzE3NzU0M3ww&ixlib=rb-4.1.0&q=85&w=1200",
    alt: "Concert crowd silhouettes",
    span: "md:col-span-6",
  },
  {
    src: "https://images.unsplash.com/photo-1767050190883-29d644fa5b99?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBldmVudCUyMHBhcnR5JTIwZGFya3xlbnwwfHx8fDE3ODMxNzc1NDN8MA&ixlib=rb-4.1.0&q=85&w=1200",
    alt: "Elegant table with candles",
    span: "md:col-span-6",
  },
  {
    src: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    alt: "Stage lighting from above",
    span: "md:col-span-4",
  },
  {
    src: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    alt: "Concert lights",
    span: "md:col-span-4",
  },
  {
    src: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    alt: "Champagne toast",
    span: "md:col-span-4",
  },
];

export default function Gallery() {
  const wrap = useReveal();
  return (
    <section
      id="gallery"
      ref={wrap}
      data-testid="gallery-section"
      className="relative py-32 lg:py-40 border-t border-white/5 bg-[#080808]"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="flex items-end justify-between mb-16 gap-10 flex-wrap">
          <div className="reveal">
            <p className="overline mb-6">Gallery</p>
            <h2 className="font-display text-white text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-tight max-w-2xl">
              Frames from the room.
            </h2>
          </div>
          <p className="max-w-sm text-white/50 text-sm md:text-[15px] leading-relaxed reveal">
            A living archive of the shows we've built, the nights we've hosted, and the
            moments we've made together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-[220px] md:auto-rows-[240px] gap-3 md:gap-4">
          {images.map((im, i) => (
            <div
              key={i}
              data-testid={`gallery-item-${i}`}
              className={`relative overflow-hidden group bg-neutral-900 reveal ${im.span}`}
            >
              <img
                src={im.src}
                alt={im.alt}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-110"
                style={{ filter: "brightness(0.7) contrast(1.08) saturate(0.9)" }}
              />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.75) 100%)",
                }}
              />
              <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                <p className="text-[11px] tracking-widest-plus uppercase text-[#D4AF37]">
                  · TMS
                </p>
                <p className="text-white text-sm mt-1">{im.alt}</p>
              </div>
              <div
                className="absolute inset-0 border border-transparent group-hover:border-[#D4AF37]/40 transition-colors duration-500 pointer-events-none"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
