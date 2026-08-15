import { useEffect, useState } from "react";
import { SITE_CONFIG } from "@/config/site";

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Experience", href: "#experience" },
    { label: "Services", href: "#services" },
    { label: "Creator Sites", href: "#creator-websites" },
    { label: "Gallery", href: "#gallery" },
    { label: "Shows", href: "#shows" },
    { label: "Book", href: "#booking" },
  ];

  return (
    <header
      data-testid="site-navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "backdrop-blur-xl bg-black/60 border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-10 lg:px-16 py-5">
        <a
          data-testid="nav-logo"
          href="#top"
          className="flex items-center gap-3 group"
        >
          <span className="w-8 h-8 border border-[#D4AF37]/50 flex items-center justify-center">
            <span className="font-display text-[#D4AF37] text-lg leading-none">T</span>
          </span>
          <span className="font-display text-white text-lg md:text-xl tracking-tight">
            {SITE_CONFIG.brand.name}
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-9">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
              className="text-[13px] tracking-widest-plus uppercase text-white/70 hover:text-[#D4AF37] transition-colors duration-300"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          data-testid="nav-cta-book"
          href="#booking"
          className="hidden md:inline-flex btn-gold rounded-sharp px-5 py-2.5 text-[12px] tracking-widest-plus uppercase font-semibold"
        >
          Book an Event
        </a>

        <button
          data-testid="nav-mobile-toggle"
          className="md:hidden text-white/80 p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span className="block w-6 h-[1.5px] bg-white mb-1.5"></span>
          <span className="block w-6 h-[1.5px] bg-white mb-1.5"></span>
          <span className="block w-4 h-[1.5px] bg-[#D4AF37]"></span>
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-black/95 backdrop-blur-xl border-t border-white/5">
          <div className="px-6 py-6 flex flex-col gap-5">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm tracking-widest-plus uppercase text-white/80"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#booking"
              onClick={() => setOpen(false)}
              className="btn-gold rounded-sharp px-5 py-3 text-center text-[12px] tracking-widest-plus uppercase font-semibold"
            >
              Book an Event
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
