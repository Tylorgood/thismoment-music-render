import { useEffect, useRef } from "react";

/**
 * useReveal - Adds `is-visible` to `.reveal` elements as they enter viewport.
 * Falls back to auto-reveal after mount so nothing stays permanently hidden.
 */
export function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll(".reveal");

    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      targets.forEach((t) => t.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((t) => io.observe(t));

    // Safety net: reveal any target still hidden after 900ms
    const timer = setTimeout(() => {
      targets.forEach((t) => {
        if (!t.classList.contains("is-visible")) {
          t.classList.add("is-visible");
        }
      });
    }, 900);

    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return ref;
}

export default useReveal;
