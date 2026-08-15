import {
  BarChart3,
  Globe2,
  Link2,
  Mail,
  MonitorSmartphone,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import useReveal from "@/hooks/useReveal";

const pillars = [
  {
    icon: Globe2,
    title: "Owned Home",
    body: "A custom website and domain that gives your brand a polished destination outside rented platforms.",
  },
  {
    icon: Link2,
    title: "Traffic Hub",
    body: "Route fans, clients, offers, bookings, subscriptions, and social traffic through one intentional path.",
  },
  {
    icon: Mail,
    title: "Lead Capture",
    body: "Email capture and inquiry flows that help you build an audience you can actually reach.",
  },
  {
    icon: BarChart3,
    title: "Growth System",
    body: "Analytics, launch copy, and monthly update options so the site keeps moving after it goes live.",
  },
];

const included = [
  { icon: MonitorSmartphone, label: "Custom design" },
  { icon: Link2, label: "Offer pages" },
  { icon: Mail, label: "Email capture" },
  { icon: BarChart3, label: "Analytics setup" },
  { icon: Rocket, label: "Launch kit" },
  { icon: ShieldCheck, label: "Privacy-minded structure" },
];

const packages = [
  {
    name: "Creator Landing Page",
    price: "$750+",
    body: "A premium home base for creators who need something clean, fast, and owned.",
  },
  {
    name: "Creator Campaign Site",
    price: "$1,500+",
    body: "A full launch-ready website with offer strategy, capture paths, and campaign copy.",
  },
  {
    name: "Ongoing Brand OS",
    price: "$300+/mo",
    body: "Monthly updates, offer refreshes, analytics review, and support as the brand grows.",
  },
];

export default function CreatorWebsites() {
  const wrap = useReveal();

  return (
    <section
      id="creator-websites"
      ref={wrap}
      data-testid="creator-websites-section"
      className="relative py-32 lg:py-40 border-t border-white/5 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute right-[-10%] top-0 h-full w-1/2 bg-[linear-gradient(115deg,transparent_0%,rgba(212,175,55,0.12)_42%,transparent_58%)] blur-2xl" />
        <div className="absolute left-0 bottom-0 h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start mb-16">
          <div className="lg:col-span-7 reveal">
            <p className="overline mb-6">Creator websites</p>
            <h2 className="font-display text-white text-4xl md:text-5xl lg:text-7xl leading-[0.96] tracking-tight">
              Premium creator
              <br />
              <span className="italic font-light text-[#D4AF37]">website campaigns.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-8 reveal">
            <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-lg">
              Professional websites and launch campaigns for independent creators who are
              ready to own their brand, guide their audience, and grow from one premium home.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#booking"
                className="btn-gold rounded-sharp px-7 py-4 text-[12px] tracking-widest-plus uppercase font-semibold"
              >
                Build my creator site
              </a>
              <a
                href="#creator-packages"
                className="btn-ghost rounded-sharp px-7 py-4 text-[12px] tracking-widest-plus uppercase font-semibold"
              >
                View packages
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white/8 border border-white/8 reveal">
          <div className="lg:col-span-5 bg-[#0a0a0a] p-8 md:p-10 lg:p-12 min-h-[420px] flex flex-col justify-between">
            <div>
              <p className="overline mb-5">Own your audience</p>
              <h3 className="font-display text-white text-3xl md:text-5xl leading-none">
                Stop renting the first impression.
              </h3>
              <p className="mt-6 text-white/55 leading-relaxed max-w-md">
                Built for performers, artists, nightlife personalities, educators, models,
                niche communities, and creator-led brands that need a more serious front door.
              </p>
            </div>
            <div className="mt-10 border-t border-[#D4AF37]/30 pt-6">
              <p className="text-[#D4AF37] text-[12px] tracking-widest-plus uppercase font-semibold">
                Custom design + launch strategy + conversion paths
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2">
            {pillars.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-[#0d0c0a] p-8 md:p-10 border-b border-r border-white/8 last:border-b-0">
                  <Icon className="h-7 w-7 text-[#D4AF37] mb-8" strokeWidth={1.4} />
                  <h4 className="font-display text-white text-2xl md:text-3xl mb-4">
                    {item.title}
                  </h4>
                  <p className="text-white/55 text-sm md:text-[15px] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-16 reveal">
          <div className="flex items-center gap-5 mb-8">
            <div className="hairline flex-1" />
            <p className="overline whitespace-nowrap">What's included</p>
            <div className="hairline flex-1" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border border-[#D4AF37]/25 divide-x divide-y md:divide-y-0 divide-[#D4AF37]/20">
            {included.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-[#0a0a0a]/90 min-h-[150px] p-5 flex flex-col items-center justify-center text-center">
                  <Icon className="h-7 w-7 text-[#D4AF37] mb-5" strokeWidth={1.4} />
                  <span className="text-white/80 text-[11px] tracking-widest uppercase leading-relaxed">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div id="creator-packages" className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/8 border border-white/8 reveal">
          {packages.map((pkg, index) => (
            <a
              key={pkg.name}
              href="#booking"
              className={`group bg-[#0a0a0a] p-8 md:p-10 min-h-[310px] flex flex-col justify-between lift ${
                index === 1 ? "shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]" : ""
              }`}
            >
              <div>
                <p className="overline mb-5">{index === 1 ? "Signature" : index === 0 ? "Starter" : "Managed"}</p>
                <h4 className="font-display text-white text-3xl md:text-4xl leading-none group-hover:text-[#D4AF37] transition-colors">
                  {pkg.name}
                </h4>
                <p className="font-display text-[#D4AF37] text-4xl mt-7">{pkg.price}</p>
                <p className="text-white/55 text-sm md:text-[15px] leading-relaxed mt-5 max-w-sm">
                  {pkg.body}
                </p>
              </div>
              <span className="mt-8 text-[12px] tracking-widest-plus uppercase text-white/55 group-hover:text-[#D4AF37] transition-colors">
                Inquire now
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
