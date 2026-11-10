"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ProductImageGallery } from "@/components/ProductImageGallery";

export type ProductPhoto = { src: string; thumb: string };

const THUMB_PHOTO = 144;
const THUMB_FRAME = 12;
const THUMB_PREVIEW = THUMB_PHOTO + THUMB_FRAME * 2;

function placeThumbPreview(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const gap = 8;
  let left = rect.left - THUMB_PREVIEW - gap;
  let top = rect.bottom - THUMB_PREVIEW;
  if (left < 8) left = Math.min(rect.right + gap, window.innerWidth - THUMB_PREVIEW - 8);
  if (top < 8) top = 8;
  return { left, top };
}

/**
 * First product photo as a 64×72 thumbnail. Hover floats the full photo.
 * Click opens the view-only gallery. With `reserve`, a product with no photo
 * keeps an empty 64×72 slot so the names in a list still line up.
 */
export function ProductThumb({
  title,
  images,
  reserve = false,
}: {
  title: string;
  images: ProductPhoto[];
  reserve?: boolean;
}) {
  const [hoverBox, setHoverBox] = useState<{ left: number; top: number } | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const thumb = images[0];

  if (!thumb) {
    return reserve ? <span className="inline-block h-[72px] w-16 shrink-0" aria-hidden /> : null;
  }

  return (
    <>
      <button
        type="button"
        className="h-[72px] w-16 shrink-0 cursor-pointer overflow-hidden rounded border border-stone-300 bg-white"
        aria-label={`Photos for ${title}`}
        title="Click to view more pictures"
        onMouseEnter={(e) => setHoverBox(placeThumbPreview(e.currentTarget))}
        onMouseLeave={() => setHoverBox(null)}
        onClick={() => {
          setHoverBox(null);
          setPhotosOpen(true);
        }}
      >
        <img src={thumb.thumb || thumb.src} alt="" className="h-full w-full object-cover" />
      </button>
      {hoverBox && !photosOpen ? (
        <ThumbPreview src={thumb.src} alt={title} box={hoverBox} onHide={() => setHoverBox(null)} />
      ) : null}
      {photosOpen ? (
        <PhotoWindow title={title} images={images} onClose={() => setPhotosOpen(false)} />
      ) : null}
    </>
  );
}

function ThumbPreview({
  src,
  alt,
  box,
  onHide,
}: {
  src: string;
  alt: string;
  box: { left: number; top: number };
  onHide: () => void;
}) {
  useEffect(() => {
    window.addEventListener("scroll", onHide, true);
    return () => window.removeEventListener("scroll", onHide, true);
  }, [onHide]);

  return createPortal(
    <div
      className="pointer-events-none fixed z-30 p-3 shadow-md"
      style={{
        left: box.left,
        top: box.top,
        width: THUMB_PREVIEW,
        height: THUMB_PREVIEW,
        background: "radial-gradient(circle, #ffffff 58%, #f5f5f4 76%, #d6d3d1 100%)",
      }}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}

function PhotoWindow({
  title,
  images,
  onClose,
}: {
  title: string;
  images: ProductPhoto[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-transparent"
        aria-label="Close photos"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-[70] flex max-h-[90vh] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-3 py-3">
          <h2 className="min-w-0 truncate text-sm font-medium">{title}</h2>
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-200"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ProductImageGallery images={images} alt={title} panel />
        </div>
      </div>
    </>,
    document.body,
  );
}
