"use client";

import { useEffect, useState } from "react";

export type GalleryImage = { src: string; thumb: string };

export function ProductImageGallery({
  images,
  alt,
  onRemove,
  tall = false,
  panel = false,
}: {
  images: GalleryImage[];
  alt: string;
  onRemove?: (index: number) => void;
  tall?: boolean;
  /** Inventory photo window: larger thumbs in a left column, large picture beside them. */
  panel?: boolean;
}) {
  const [active, setActive] = useState(0);
  const imageKey = images.map((img) => img.src).join("|");
  useEffect(() => {
    setActive(0);
  }, [imageKey]);

  if (!images.length) return null;
  const index = Math.min(active, images.length - 1);
  const current = images[index];

  const thumbClass = panel ? "h-36 w-36" : tall ? "h-24 w-24" : "h-14 w-full";

  return (
    <div className={tall && !panel ? "flex flex-col gap-2" : "flex min-h-0 items-start gap-3"}>
      <div
        className={
          panel
            ? "flex max-h-[min(64vh,32rem)] w-40 shrink-0 flex-col gap-2 overflow-y-auto border-r border-stone-300 pr-3"
            : tall
              ? "flex max-h-80 w-full flex-col gap-1 overflow-y-auto"
              : "flex max-h-64 w-14 shrink-0 flex-col gap-1 overflow-y-auto"
        }
      >
        {images.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            className={`shrink-0 cursor-pointer overflow-hidden rounded border bg-white ${thumbClass} ${
              i === index ? "border-stone-900" : "border-stone-300"
            }`}
            aria-label={`Photo ${i + 1}`}
            onClick={() => setActive(i)}
          >
            <img
              src={img.thumb || img.src}
              alt=""
              className={`${thumbClass} object-cover`}
            />
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <img
          src={current.src}
          alt={alt}
          className={`w-full rounded bg-white object-contain ${tall || panel ? "max-h-[min(64vh,32rem)]" : "max-h-64"}`}
        />
        {onRemove ? (
          <button
            type="button"
            className="mt-1 text-xs text-stone-500 hover:text-red-800"
            onClick={() => onRemove?.(index)}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
