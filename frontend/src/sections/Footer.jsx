import { SITE_CONFIG } from "@/config/site";

export default function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="relative border-t border-white/5 pt-24 lg:pt-32 pb-10 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 mb-16">
          <div className="lg:col-span-6">
            <p className="overline mb-6">The Studio</p>
            <h3 className="font-display text-white text-4xl md:text-5xl lg:text-6xl leading-[1] tracking-tight">
              This is your moment.
              <br />
              <span className="text-[#D4AF37] italic font-light">Own the room.</span>
            </h3>
          </div>
          <div className="lg:col-span-3">
            <p className="overline mb-4">Contact</p>
            <a
              href={SITE_CONFIG.contact.phoneHref}
              className="block text-white/80 hover:text-[#D4AF37] transition mb-2"
            >
              {SITE_CONFIG.contact.phone}
            </a>
            <a
              href={SITE_CONFIG.contact.emailHref}
              className="block text-white/80 hover:text-[#D4AF37] transition mb-2"
            >
              {SITE_CONFIG.contact.email}
            </a>
            <p className="text-white/40 text-sm">{SITE_CONFIG.contact.location}</p>
          </div>
          <div className="lg:col-span-3">
            <p className="overline mb-4">Social</p>
            <a
              href={SITE_CONFIG.social.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-white/80 hover:text-[#D4AF37] transition mb-2"
              data-testid="footer-instagram"
            >
              Instagram → {SITE_CONFIG.social.instagram.handle}
            </a>
            <a
              href={SITE_CONFIG.social.tiktok.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-white/80 hover:text-[#D4AF37] transition mb-2"
            >
              TikTok → {SITE_CONFIG.social.tiktok.handle}
            </a>
            <a
              href="#booking"
              className="inline-block mt-4 btn-ghost rounded-sharp px-5 py-2.5 text-[11px] tracking-widest-plus uppercase font-semibold"
            >
              Book →
            </a>
          </div>
        </div>

        {/* Massive Wordmark */}
        <div className="relative -mb-6 select-none">
          <p
            className="font-display text-white/[0.08] leading-none tracking-tighter whitespace-nowrap"
            style={{ fontSize: "clamp(72px, 15vw, 260px)" }}
          >
            This Moment
          </p>
        </div>

        <div className="hairline my-8" />

        <div className="flex flex-wrap gap-6 items-center justify-between text-[11px] tracking-widest-plus uppercase text-white/40">
          <p data-testid="footer-copyright">
            © {new Date().getFullYear()} {SITE_CONFIG.brand.name}. All rights reserved.
          </p>
          <p>Crafted for the moments that define you.</p>
        </div>
      </div>
    </footer>
  );
}
