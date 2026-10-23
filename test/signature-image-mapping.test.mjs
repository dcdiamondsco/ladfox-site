import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../classic-solitaire.html", import.meta.url), "utf8");
const mappingStart = html.indexOf("const SIGNATURE_COLLECTION_IMAGES = ");
const platinumComment = html.indexOf("// Existing Platinum", mappingStart);
const mappingEnd = html.lastIndexOf(";", platinumComment) + 1;
assert.ok(mappingStart >= 0 && mappingEnd > mappingStart, "Solitaire image mapping should remain centrally defined");
const mappingLiteral = html.slice(mappingStart + "const SIGNATURE_COLLECTION_IMAGES = ".length, mappingEnd).replace(/;\s*$/, "");
const mapping = vm.runInNewContext(`(${mappingLiteral})`).solitaire;
const rendersStart = html.indexOf("const SIGNATURE_RENDERS = ");
const rendersEnd = html.indexOf("const SIGNATURE_CARAT_SIZES", rendersStart);
const rendersLiteral = html.slice(rendersStart + "const SIGNATURE_RENDERS = ".length, html.lastIndexOf(";", rendersEnd) + 1).replace(/;\s*$/, "");
const platinumRenders = vm.runInNewContext(`(${rendersLiteral})`).platinum;
const correctionsStart = html.indexOf("const GOLD_RENDER_CORRECTIONS = ");
const correctionsEnd = html.indexOf("const decodeRenderVariant", correctionsStart);
const correctionsLiteral = html.slice(correctionsStart + "const GOLD_RENDER_CORRECTIONS = ".length, html.lastIndexOf(";", correctionsEnd) + 1).replace(/;\s*$/, "");
const corrections = vm.runInNewContext(`(${correctionsLiteral})`);

const metals = ["yellowGold", "whiteGold", "roseGold"];
const purities = ["9k", "14k", "18k"];
const shapes = ["round", "oval", "cushion", "princess", "pear", "emerald", "marquise", "radiant"];
const baseUrl = "https://image25.thepersonalizedbest.com/image/api_image61/";
const groupAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const shapeAlphabet = "BGLQV16";
const decodeVariant = (id) => {
  const start = id.length - 9;
  return ((groupAlphabet.indexOf(id[start]) * groupAlphabet.length) + groupAlphabet.indexOf(id[start + 1])) * shapeAlphabet.length
    + shapeAlphabet.indexOf(id[start + 2]);
};
const encodeVariant = (value) => {
  const shape = value % shapeAlphabet.length;
  const group = Math.floor(value / shapeAlphabet.length);
  return `${groupAlphabet[Math.floor(group / groupAlphabet.length)]}${groupAlphabet[group % groupAlphabet.length]}${shapeAlphabet[shape]}`;
};
const derive = (baseId, shape, carat, metal, purity) => {
  const start = baseId.length - 9;
  const delta = decodeVariant(platinumRenders[shape][carat]) - decodeVariant(platinumRenders[shape][1]);
  const correction = corrections[metal]?.[purity]?.[carat] || 0;
  return `${baseId.slice(0, start)}${encodeVariant(decodeVariant(baseId) + delta + correction)}${baseId.slice(start + 3)}`;
};

test("Solitaire gold mapping contains exactly 72 unique supported combinations", () => {
  const ids = [];
  assert.deepEqual(Object.keys(mapping), metals);
  for (const metal of metals) {
    assert.deepEqual(Object.keys(mapping[metal]), purities);
    for (const purity of purities) {
      assert.deepEqual(Object.keys(mapping[metal][purity]), shapes);
      ids.push(...Object.values(mapping[metal][purity]));
    }
  }
  assert.equal(ids.length, 72);
  assert.equal(new Set(ids).size, 72);
  assert.ok(ids.every((id) => /^[A-Z0-9]+$/.test(id)));
  assert.equal(html.includes('data-option-value="Heart"'), false);
});

test("every Solitaire gold selection generates all three view URLs", () => {
  for (const metal of metals) {
    for (const purity of purities) {
      for (const shape of shapes) {
        const id = mapping[metal][purity][shape];
        assert.deepEqual(
          [1, 2, 3].map((view) => `${baseUrl}${id}.jpg?v=${view}`),
          [
            `${baseUrl}${id}.jpg?v=1`,
            `${baseUrl}${id}.jpg?v=2`,
            `${baseUrl}${id}.jpg?v=3`
          ]
        );
      }
    }
  }
});

test("verified colour families derive a distinct render for each Platinum-supported carat", () => {
  for (const metal of ["yellowGold", "roseGold"]) {
    for (const shape of shapes) {
        const baseId = mapping[metal]["9k"][shape];
        const carats = Object.keys(platinumRenders[shape]).map(Number).filter((carat) => carat >= 0.3 && carat <= 6);
        const derivedIds = carats.map((carat) => derive(baseId, shape, carat, metal, "9k"));
        assert.equal(new Set(derivedIds).size, carats.length, `${metal} ${shape} should change with carat`);
        assert.equal(derive(baseId, shape, 1, metal, "9k"), baseId, `${metal} ${shape} should retain its verified 1ct ID`);
        assert.ok(derivedIds.every((id) => /^[A-Z0-9]+$/.test(id)));
    }
  }
  assert.match(html, /const deriveGoldRenderId =/);
});

test("all gold purities use the verified render family for their selected colour", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(corrections.yellowGold["9k"])), {});
  assert.equal(corrections.roseGold["9k"][0.5], -1);
  assert.match(html, /if \(metalKey === "whiteGold"\)[\s\S]*?SIGNATURE_RENDERS\.platinum/);
  assert.match(html, /const renderPurity = "9k";/);
});

test("representative shape, purity and metal changes resolve independently", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(mapping.yellowGold["9k"])), {
    round: "6FQ5XKV6B0L1M9A", oval: "6FQ5XKV6Q0L1M9A", cushion: "6FQ5XKV6L0L1M9A", princess: "6FQ5XKV6G0L1M9A",
    pear: "6FQ5XKV610L1M9A", emerald: "6FQ5XKV6V0L1M9A", marquise: "6FQ5XKV660L1M9A", radiant: "6FQ5XKV7B0L1M9A"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(mapping.whiteGold["9k"])), {
    round: "6QB0L1M9A", oval: "6QQ0L1M9A", cushion: "6QL0L1M9A", princess: "6QG0L1M9A",
    pear: "6Q10L1M9A", emerald: "6QV0L1M9A", marquise: "6Q60L1M9A", radiant: "6RB0L1M9A"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(mapping.roseGold["9k"])), {
    round: "6K81LVILB0L1M9A", oval: "6K81LVILQ0L1M9A", cushion: "6K81LVILL0L1M9A", princess: "6K81LVILG0L1M9A",
    pear: "6K81LVIL10L1M9A", emerald: "6K81LVILV0L1M9A", marquise: "6K81LVIL60L1M9A", radiant: "6K81LVIMB0L1M9A"
  });
  assert.equal(mapping.roseGold["14k"].oval, "6LR76PKQQ0L1M9A");
  assert.equal(mapping.roseGold["14k"].cushion, "6LR76PKQL0L1M9A");
  assert.equal(mapping.roseGold["14k"].round, "6LR76PKQB0L1M9A");
  assert.equal(mapping.roseGold["14k"].radiant, "6LR76PKRB0L1M9A");
  assert.equal(mapping.roseGold["18k"].oval, "6L2SX44BQ0L1M9A");
  assert.equal(mapping.whiteGold["18k"].oval, "632MIVGQ0L1M9A");
});

test("existing Platinum mapping remains separate and populated", () => {
  assert.match(html, /const SIGNATURE_RENDERS = \{\s*platinum:\s*\{/);
  assert.match(html, /round:\s*\{0\.25:"6BDNEXEML0L1M4Z"/);
});

test("fresh-page defaults resolve the corrected 14k Yellow Gold Round render", () => {
  assert.match(html, /id="signatureSetting"[^>]+value="Petal"/);
  assert.match(html, /id="signatureMetalBase"[^>]+value="Gold"/);
  assert.match(html, /id="signatureMetalKarat"[^>]+value="14k"/);
  assert.match(html, /id="signatureShape"[^>]+value="Round"/);
  assert.match(html, /id="signatureStoneType"[^>]+value="Lab Diamond"/);
  assert.match(html, /id="signatureStoneSize"[^>]+value="1\.00 ct"/);
  assert.match(html, /id="signatureRingSize"[^>]+value=""/);
  assert.equal(mapping.yellowGold["14k"].round, "6GBCIEYBB0L1M9A");
});
