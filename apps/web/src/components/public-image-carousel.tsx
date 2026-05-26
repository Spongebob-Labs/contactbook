import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicImage } from "@/lib/public-images";
import { cn } from "@/lib/utils";

export function PublicImageCarousel({
  images,
  className,
}: {
  images: PublicImage[];
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (reducedMotion || isPaused || images.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [images.length, isPaused, reducedMotion]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % images.length);
  };

  return (
    <section
      className={cn("relative overflow-hidden bg-public-charcoal text-public-inverse", className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="ContactBook connection moments"
    >
      <div className="relative h-[34rem]">
        {images.map((image, index) => (
          <article
            key={image.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              index === activeIndex ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={index !== activeIndex}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-cover"
              loading={index === 0 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-public-charcoal/62" />
            <div className="absolute inset-x-0 bottom-0 h-40 rounded-t-[55%] bg-public-charcoal/55" />
            <div className="absolute bottom-8 left-4 right-4 max-w-2xl space-y-3 sm:left-8 sm:right-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-public-mint">
                {image.eyebrow}
              </p>
              <h3 className="font-public-display text-4xl font-normal leading-tight text-public-inverse sm:text-5xl">
                {image.caption}
              </h3>
            </div>
          </article>
        ))}
      </div>

      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-public-inverse/30 bg-public-inverse/12 text-public-inverse backdrop-blur transition-colors hover:bg-public-inverse/20"
          onClick={goToPrevious}
          aria-label="Show previous image"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-public-inverse/30 bg-public-inverse/12 text-public-inverse backdrop-blur transition-colors hover:bg-public-inverse/20"
          onClick={goToNext}
          aria-label="Show next image"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className={cn(
              "h-2.5 rounded-full transition-all",
              index === activeIndex ? "w-8 bg-public-mint" : "w-2.5 bg-public-inverse/45",
            )}
            onClick={() => setActiveIndex(index)}
            aria-label={`Show image ${index + 1}`}
            aria-current={index === activeIndex}
          />
        ))}
      </div>
    </section>
  );
}
