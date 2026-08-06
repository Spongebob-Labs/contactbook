import { useEffect } from "react";

export function usePublicReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document
        .querySelectorAll<HTMLElement>(".public-reveal, .public-draw-path")
        .forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    document
      .querySelectorAll<HTMLElement>(".public-reveal, .public-draw-path")
      .forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);
}
