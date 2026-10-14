"use client";

import { useState } from "react";
import { ComboBox } from "@/components/ComboBox";

type Opt = { id: string; name: string; is_active: boolean };
type Sibling = {
  lot_no: string;
  article: string | null;
  color_num: string | null;
  brand_id: string | null;
  pattern_id: string | null;
  content_id: string | null;
};

function parseLotNo(lotNo: string) {
  const parts = lotNo.trim().split("-");
  const article = parts[0]?.trim() ?? "";
  const colorNum = parts[1]?.trim() ?? "";
  if (!article || !colorNum) return null;
  return { article, colorNum };
}

function lotArticle(lot: Sibling) {
  return (lot.article || lot.lot_no.split("-")[0] || "").trim();
}

function lotColorNum(lot: Sibling) {
  return (lot.color_num || lot.lot_no.split("-")[1] || "").trim();
}

export function LotAddFields({
  lots,
  brands,
  colors,
  patterns,
  contents,
}: {
  lots: Sibling[];
  brands: { id: string; name: string }[];
  colors: Opt[];
  patterns: Opt[];
  contents: Opt[];
}) {
  const [brandId, setBrandId] = useState("");
  const [colorId, setColorId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [contentId, setContentId] = useState("");

  function onLotChange(raw: string) {
    const parsed = parseLotNo(raw);
    if (!parsed) return;
    const needle = parsed.article.toLocaleLowerCase("en");
    const match = lots.find((l) => {
      const article = lotArticle(l).toLocaleLowerCase("en");
      const colorNum = lotColorNum(l);
      return article === needle && colorNum !== parsed.colorNum;
    });
    if (!match) return;
    setBrandId(match.brand_id ?? "");
    setPatternId(match.pattern_id ?? "");
    setContentId(match.content_id ?? "");
  }

  return (
    <>
      <input
        name="lot_no"
        required
        aria-label="Lot number"
        className="rounded border px-2 py-1"
        onChange={(e) => onLotChange(e.target.value)}
      />
      <ComboBox
        name="brand_id"
        allowEmpty
        placeholder="Brand"
        value={brandId}
        onChange={setBrandId}
        options={brands.map((b) => ({ id: b.id, label: b.name }))}
      />
      <ComboBox
        name="color_id"
        allowEmpty
        placeholder="Color"
        value={colorId}
        onChange={setColorId}
        options={colors.filter((c) => c.is_active).map((c) => ({ id: c.id, label: c.name }))}
      />
      <ComboBox
        name="pattern_id"
        allowEmpty
        placeholder="Pattern"
        value={patternId}
        onChange={setPatternId}
        options={patterns.filter((c) => c.is_active).map((c) => ({ id: c.id, label: c.name }))}
      />
      <ComboBox
        name="content_id"
        allowEmpty
        placeholder="Content"
        value={contentId}
        onChange={setContentId}
        options={contents.filter((c) => c.is_active).map((c) => ({ id: c.id, label: c.name }))}
      />
    </>
  );
}
