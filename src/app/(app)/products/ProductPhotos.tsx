"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Busy } from "@/components/WorkingBeside";
import { Btn } from "@/components/ui";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import {
  loadProductImages,
  saveProductImages,
  searchCatalogImages,
  type CatalogHit,
  type CatalogImage,
} from "./image-actions";

type DraftImage = {
  id: string | null;
  src: string;
  thumb: string;
  srcPath: string;
  thumbPath: string | null;
};

function pathsKey(list: { srcPath: string }[]) {
  return list.map((img) => img.srcPath).join("\n");
}

export function ProductPhotos({
  productId,
  lotNo,
  onDirtyChange,
  saveRef,
  pickerOpenRef,
  children,
}: {
  productId: string;
  lotNo: string;
  onDirtyChange: (dirty: boolean) => void;
  saveRef: { current: () => Promise<string | null> };
  pickerOpenRef: { current: boolean };
  children: (picker: ReactNode) => ReactNode;
}) {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [savedKey, setSavedKey] = useState("");
  const [query, setQuery] = useState(lotNo);
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [picked, setPicked] = useState<CatalogImage[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const touched = useRef(false);
  const dirty = pathsKey(images) !== savedKey;

  useEffect(() => {
    let gone = false;
    void loadProductImages(productId).then((res) => {
      if (gone || touched.current) return;
      const next = res.images.map((img) => ({
        id: img.id,
        src: img.src,
        thumb: img.thumb,
        srcPath: img.srcPath,
        thumbPath: null,
      }));
      setImages(next);
      setSavedKey(pathsKey(next));
      if (res.error) setErr(res.error);
    });
    return () => {
      gone = true;
    };
  }, [productId]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    saveRef.current = async () => {
      if (pathsKey(images) === savedKey) return null;
      const message = await saveProductImages(
        productId,
        images.map((img) => ({ id: img.id, srcPath: img.srcPath, thumbPath: img.thumbPath })),
      );
      if (message) return message;
      setSavedKey(pathsKey(images));
      return null;
    };
  });

  const attached = new Set(images.map((img) => img.srcPath));
  const pickedPaths = new Set(picked.map((img) => img.srcPath));

  useEffect(() => {
    pickerOpenRef.current = pickerOpen;
  }, [pickerOpen, pickerOpenRef]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setPickerOpen(false);
      setPicked([]);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pickerOpen]);

  function runSearch(text: string) {
    setSearchErr(null);
    start(async () => {
      try {
        const res = await searchCatalogImages(text);
        setHits(res.hits);
        if (res.error) setSearchErr(res.error);
      } catch (e) {
        setSearchErr(e instanceof Error ? e.message : "Could not load the photo site.");
      }
    });
  }

  function openPicker() {
    setPicked([]);
    setSearchErr(null);
    setPickerOpen(true);
    runSearch(query);
  }

  function closePicker() {
    setPickerOpen(false);
    setPicked([]);
  }

  function toggle(img: CatalogImage) {
    if (attached.has(img.srcPath)) return;
    setPicked((prev) =>
      prev.some((row) => row.srcPath === img.srcPath)
        ? prev.filter((row) => row.srcPath !== img.srcPath)
        : [...prev, img],
    );
  }

  function selectPicked() {
    if (!picked.length) return;
    touched.current = true;
    setErr(null);
    setImages((prev) => [
      ...prev,
      ...picked
        .filter((img) => !prev.some((row) => row.srcPath === img.srcPath))
        .map((img) => ({
          id: null,
          src: img.src,
          thumb: img.thumb,
          srcPath: img.srcPath,
          thumbPath: img.thumbPath,
        })),
    ]);
    closePicker();
  }

  function remove(index: number) {
    touched.current = true;
    setErr(null);
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  const pickerPopup = pickerOpen
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[60] bg-transparent"
                aria-label="Cancel photo selection"
                onClick={closePicker}
              />
              <div className="fixed top-1/2 left-1/2 z-[70] flex max-h-[80vh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-lg">
                <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3">
                  <h2 className="text-sm font-medium">Select photos</h2>
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-200"
                    aria-label="Cancel"
                    onClick={closePicker}
                  >
                    ×
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        runSearch(query);
                      }}
                      placeholder="Lot or site product"
                      className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-1"
                      aria-label="Search the photo site"
                    />
                    <Busy on={pending}>
                      <button
                        type="button"
                        className="rounded border border-stone-300 bg-white px-3 py-1 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                        disabled={pending}
                        onClick={() => runSearch(query)}
                      >
                        Search
                      </button>
                    </Busy>
                  </div>
                  {hits.length ? (
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-stone-300 bg-white p-2">
                      {hits.map((hit) => (
                        <div key={hit.id} className="space-y-1">
                          <p className="text-xs text-stone-600">
                            {hit.name}
                            {hit.sku ? <span className="font-light"> · {hit.sku}</span> : null}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {hit.images.map((img) => {
                              const on = attached.has(img.srcPath) || pickedPaths.has(img.srcPath);
                              return (
                                <button
                                  key={img.srcPath}
                                  type="button"
                                  className={`h-16 w-12 overflow-hidden rounded border bg-white ${
                                    on ? "border-stone-900" : "border-stone-300 hover:border-stone-500"
                                  }`}
                                  title={attached.has(img.srcPath) ? "Already added" : "Select photo"}
                                  aria-label={attached.has(img.srcPath) ? "Already added" : "Select photo"}
                                  onClick={() => toggle(img)}
                                >
                                  <img src={img.thumb || img.src} alt="" className="h-full w-full object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {searchErr ? (
                    <DismissNote onDismiss={() => setSearchErr(null)}>{searchErr}</DismissNote>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2 border-t border-stone-200 px-4 py-3">
                  <Btn type="button" onClick={selectPicked} disabled={!picked.length}>
                    Select
                  </Btn>
                  <button
                    type="button"
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
                    onClick={closePicker}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )
        : null;

  return (
    <>
      <aside className="flex max-h-[90vh] min-h-0 w-52 shrink-0 flex-col overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-3 py-3">
          <h2 className="text-sm font-medium">Photos</h2>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 hover:bg-stone-50"
            onClick={openPicker}
          >
            Search
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {images.length ? (
            <ProductImageGallery images={images} alt={lotNo || "Product"} tall onRemove={remove} />
          ) : (
            <p className="text-xs text-stone-500">None added to this product yet.</p>
          )}
          {err ? (
            <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
        </div>
        {pickerPopup}
      </aside>
      {children(null)}
    </>
  );
}
