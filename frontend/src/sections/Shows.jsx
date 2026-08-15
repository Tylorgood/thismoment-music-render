import useReveal from "@/hooks/useReveal";
import { SITE_CONFIG } from "@/config/site";

export default function Shows() {
  const wrap = useReveal();

  return (
    <section
      id="shows"
      ref={wrap}
      data-testid="shows-section"
      className="relative py-32 lg:py-40 border-t border-white/5"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
          <div className="lg:col-span-7 reveal">
            <p className="overline mb-6">Upcoming</p>
            <h2 className="font-display text-white text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-tight">
              The season ahead.
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-8 reveal">
            <p className="text-white/60 text-[15px] leading-relaxed max-w-md">
              Selected upcoming productions. Some are private — reach out for access.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-white/8 border-y border-white/8">
          {SITE_CONFIG.upcomingShows.map((show, i) => (
            <li
              key={i}
              data-testid={`show-row-${i}`}
              className="group grid grid-cols-12 gap-4 items-center py-6 md:py-8 cursor-pointer hover:bg-white/[0.02] transition-colors duration-500 reveal"
            >
              <div className="col-span-2 md:col-span-1 font-display text-[#D4AF37] text-xl md:text-2xl">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-10 md:col-span-5">
                <h3 className="font-display text-white text-xl md:text-3xl group-hover:text-[#D4AF37] transition-colors duration-500">
                  {show.title}
                </h3>
              </div>
              <div className="col-span-6 md:col-span-3 text-white/60 text-sm md:text-base">
                {show.city}
              </div>
              <div className="col-span-4 md:col-span-2 text-white/70 text-sm md:text-base tabular-nums">
                {show.date}
              </div>
              <div className="col-span-2 md:col-span-1 text-right">
                <span className="text-[10px] tracking-widest-plus uppercase text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-1 whitespace-nowrap">
                  {show.status}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-center gap-6">
          <a
            href="#booking"
            data-testid="shows-cta-inquire"
            className="btn-gold rounded-sharp px-8 py-4 text-[12px] tracking-widest-plus uppercase font-semibold"
          >
            Request Access
          </a>
          <span className="text-white/50 text-sm">Guest list & private inquiries →</span>
        </div>
      </div>
    </section>
  );
}
