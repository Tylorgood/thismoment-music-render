import { useState, Suspense, lazy } from "react";
import axios from "axios";
import { toast } from "sonner";
import useReveal from "@/hooks/useReveal";
import { SITE_CONFIG } from "@/config/site";

const SceneAtmosphere = lazy(() => import("@/three/SceneAtmosphere"));

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialState = {
  name: "",
  email: "",
  phone: "",
  event_type: "",
  event_date: "",
  message: "",
};

export default function Booking() {
  const wrap = useReveal();
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.event_type || !form.event_date) {
      toast.error("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/bookings`, form);
      toast.success("Your request is in. We'll be in touch soon.");
      setDone(true);
      setForm(initialState);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again or email us.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="booking"
      ref={wrap}
      data-testid="booking-section"
      className="relative py-32 lg:py-40 border-t border-white/5 overflow-hidden"
    >
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <Suspense fallback={null}>
          <SceneAtmosphere intensity={1.2} sparkleCount={80} />
        </Suspense>
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          {/* Left: Big statement */}
          <div className="lg:col-span-5 reveal">
            <p className="overline mb-6">Booking</p>
            <h2 className="font-display text-white text-5xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
              Let's create
              <br />
              <span className="italic font-light text-[#D4AF37]">the moment.</span>
            </h2>
            <p className="mt-8 text-white/60 text-base md:text-lg leading-relaxed max-w-md">
              Tell us the vibe you're chasing. We'll design the sound, shape the room, and
              hand you a night that can only happen once.
            </p>

            <div className="mt-12 space-y-6 text-sm">
              <div>
                <p className="overline mb-2">Direct</p>
                <a
                  href={SITE_CONFIG.contact.phoneHref}
                  data-testid="contact-phone"
                  className="text-white text-lg hover:text-[#D4AF37] transition-colors"
                >
                  {SITE_CONFIG.contact.phone}
                </a>
              </div>
              <div>
                <p className="overline mb-2">Email</p>
                <a
                  href={SITE_CONFIG.contact.emailHref}
                  data-testid="contact-email"
                  className="text-white text-lg hover:text-[#D4AF37] transition-colors"
                >
                  {SITE_CONFIG.contact.email}
                </a>
              </div>
              <div>
                <p className="overline mb-2">Instagram</p>
                <a
                  href={SITE_CONFIG.social.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white text-lg hover:text-[#D4AF37] transition-colors"
                >
                  {SITE_CONFIG.social.instagram.handle}
                </a>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-7 reveal">
            {done ? (
              <div
                data-testid="booking-success"
                className="border border-[#D4AF37]/40 p-10 md:p-14 bg-[#0d0c0a]"
              >
                <p className="overline mb-4">Received</p>
                <h3 className="font-display text-white text-3xl md:text-4xl mb-4">
                  Thank you.
                </h3>
                <p className="text-white/60 leading-relaxed max-w-md">
                  We've got your request. Someone from the studio will reach out within
                  24 hours to start designing your moment.
                </p>
                <button
                  onClick={() => setDone(false)}
                  className="mt-8 btn-ghost rounded-sharp px-6 py-3 text-[12px] tracking-widest-plus uppercase font-semibold"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                data-testid="booking-form"
                className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8"
              >
                <div className="md:col-span-1">
                  <label className="overline block mb-3">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={update("name")}
                    data-testid="booking-input-name"
                    className="line-input"
                    placeholder="Your full name"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="overline block mb-3">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={update("email")}
                    data-testid="booking-input-email"
                    className="line-input"
                    placeholder="you@domain.com"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="overline block mb-3">Phone</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={update("phone")}
                    data-testid="booking-input-phone"
                    className="line-input"
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="overline block mb-3">Event Type</label>
                  <select
                    required
                    value={form.event_type}
                    onChange={update("event_type")}
                    data-testid="booking-input-event_type"
                    className="line-input appearance-none cursor-pointer"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23D4AF37' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 4px center",
                      paddingRight: "24px",
                    }}
                  >
                    <option value="" disabled style={{ background: "#121110" }}>
                      Select event type
                    </option>
                    {SITE_CONFIG.eventTypes.map((t) => (
                      <option key={t} value={t} style={{ background: "#121110" }}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="overline block mb-3">Event Date</label>
                  <input
                    type="date"
                    required
                    value={form.event_date}
                    onChange={update("event_date")}
                    data-testid="booking-input-event_date"
                    className="line-input"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="overline block mb-3">Message</label>
                  <textarea
                    rows="4"
                    value={form.message}
                    onChange={update("message")}
                    data-testid="booking-input-message"
                    className="line-input resize-none"
                    placeholder="Tell us the vibe you're chasing…"
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-between gap-6 pt-4 flex-wrap">
                  <p className="text-white/40 text-xs max-w-xs">
                    We'll respond within 24 hours. All conversations are private.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="booking-submit-button"
                    className="btn-gold rounded-sharp px-10 py-4 text-[12px] tracking-widest-plus uppercase font-semibold inline-flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Sending…" : "Let's create the moment"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
