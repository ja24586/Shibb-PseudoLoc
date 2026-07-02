// ============================================================================
// Pseudolocalizer v0.2 — ©2026 Joel Arellano
// ============================================================================

figma.showUI(__html__, { width: 300, height: 220 });

// ----------------------------------------------------------------------------
// 1. Homoglyph tables — visually-similar characters drawn from Latin
//    Extended, Greek, and Cyrillic (all covered by core "Noto Sans", so
//    these render as intended rather than tofu). Each letter maps to a
//    small array of candidates; one is picked at random per occurrence so
//    repeated letters in a string don't all get the same substitution.
// ----------------------------------------------------------------------------

const HOMOGLYPHS = {
  a: ["á", "а", "ạ"],           A: ["Á", "А", "Α"],
  b: ["ḃ", "β"],                 B: ["Ḃ", "Β", "В"],
  c: ["ç", "с"],                 C: ["Ç", "Ϲ"],
  d: ["ď", "đ"],                 D: ["Ď", "Đ"],
  e: ["é", "е", "ė"],            E: ["É", "Е", "Ε"],
  f: ["f̃", "ƒ"],                 F: ["F̃", "Ƒ"],
  g: ["ğ", "ġ"],                 G: ["Ğ", "Ġ"],
  h: ["ĥ", "һ"],                 H: ["Ĥ", "Η", "Н"],
  i: ["í", "і", "ı"],            I: ["Í", "І", "Ι"],
  j: ["ĵ", "ј"],                 J: ["Ĵ", "Ј"],
  k: ["ķ", "κ"],                 K: ["Ķ", "Κ", "К"],
  l: ["ĺ", "ł"],                 L: ["Ĺ", "Ł"],
  m: ["ṁ", "m̃"],                 M: ["Μ", "М"],
  n: ["ñ", "ń"],                 N: ["Ń", "Ñ"],
  o: ["ő", "о", "ο", "ω"],       O: ["Ő", "О", "Ο", "Ω"],
  p: ["p̀", "р"],                 P: ["P̀", "Ρ", "Р"],
  q: ["q̃", "ԛ"],                 Q: ["Q̃", "Ǫ"],
  r: ["ř", "ŕ"],                 R: ["Ř", "Ŕ"],
  s: ["š", "ѕ"],                 S: ["Š", "Ѕ"],
  t: ["ť", "ţ"],                 T: ["Ť", "Τ", "Т"],
  u: ["ü", "υ"],                 U: ["Ü", "Ú"],
  v: ["ṽ", "ν"],                 V: ["Ṽ", "Ѵ"],
  w: ["ŵ", "ẃ"],                 W: ["Ŵ", "Ẃ"],
  x: ["x̂", "х"],                 X: ["X̂", "Χ", "Х"],
  y: ["ý", "у", "γ"],            Y: ["Ý", "Υ", "У"],
  z: ["ž", "ᴢ"],                 Z: ["Ž", "Ζ"]
};

const FULLWIDTH_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Padding pools, split by script so the font-assignment pass (section 4)
// can tag each run correctly. These get appended to hit the target
// expansion length.
const PAD_POOL_BASE = [
  // Thai consonants
  "ก","ข","ค","ง","จ","ช","ซ","ฐ","ณ","ด","ต","ถ","ท","ธ","น","บ","ป","ผ","ฝ",
  "พ","ฟ","ภ","ม","ย","ร","ล","ว","ศ","ษ","ส","ห","อ","ฮ",
  // Thai vowels
  "ำ","ะ","า","ิ","ี","ึ","ื","ุ","ู","เ","แ","โ","ใ","ไ",
  // Thai tone marks / combining (stack above/below base — height edge case)
  "่","้","๊","๋","็","์",
  // Cyrillic lower/upper
  "а","б","в","г","д","е","ж","з","и","й","к","л","м","н","о","п","р","с","т",
  "у","ф","х","ц","ч","ш","щ","ъ","ы","ь","э","ю","я",
  "А","Б","В","Г","Д","Е","Ж","З","И","Й","К","Л","М","Н","О","П","Р","С","Т",
  "У","Ф","Х","Ц","Ч","Ш","Щ","Ъ","Ы","Ь","Э","Ю","Я",
  // Vietnamese multi-diacritic stacks (base + tone + modifier)
  "ệ","ẫ","ả","ữ","ỳ","ộ","ẵ","ẳ","ỗ",
  // Fullwidth Latin (double-width edge case)
  "Ｗ","Ｍ","Ｑ","Ｇ",
  // CJK — generic, non-brand Han characters + kana, for glyph density/joining
  "山","水","火","木","金","土","人","大","小","中","日","月","年","光","風",
  "雲","星","花","川","石",
  "あ","い","う","え","お","か","き","く","け","こ",
  "ア","イ","ウ","エ","オ","カ","キ","ク","ケ","コ"
];

// RTL pool — only mixed in when the user enables the RTL toggle. Arabic
// harakat and Hebrew niqqud are combining marks (stack on the base letter),
// and Arabic-Indic digits are included deliberately since numerals inside
// RTL text are a classic bidi edge case.
const PAD_POOL_RTL = [
  // Arabic letters
  "ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ",
  "ف","ق","ك","ل","م","ن","ه","و","ي",
  // Arabic harakat (combining diacritics)
  "ً","ٌ","ٍ","َ","ُ","ِ","ّ","ْ",
  // Arabic-Indic digits
  "٠","١","٢","٣","٤","٥","٦","٧","٨","٩",
  // Hebrew letters
  "א","ב","ג","ד","ה","ו","ז","ח","ט","י","כ","ל","מ","נ","ס","ע","פ","צ","ק",
  "ר","ש","ת",
  // Hebrew niqqud (combining diacritics)
  "ָ","ֶ","ִ","ֹ","ֻ","ְ","ּ"
];

const SIGNAL_PALETTE = ["#FF1493", "#FF4500", "#39FF14", "#00E5FF", "#FFD700"];

// ----------------------------------------------------------------------------
// 2. Grapheme-aware length helper (falls back gracefully — Figma's plugin
//    sandbox doesn't always ship full Intl.Segmenter support depending on
//    app version, so this degrades to Array.from() if unavailable).
// ----------------------------------------------------------------------------

function graphemeLength(str) {
  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(seg.segment(str)).length;
    }
  } catch (e) {
    // fall through to the simpler count below
  }
  return Array.from(str).length;
}

// ----------------------------------------------------------------------------
// 3. Pseudolocalization string transform
// ----------------------------------------------------------------------------

function decorateChar(ch) {
  if (HOMOGLYPHS[ch]) {
    const options = HOMOGLYPHS[ch];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (ch >= "0" && ch <= "9") return FULLWIDTH_DIGITS[Number(ch)];
  return ch; // spaces, punctuation, anything else: left as-is
}

function decorate(str) {
  return Array.from(str).map(decorateChar).join("");
}

// Interpolation/placeholder tokens must survive pseudolocalization untouched
// — real production strings carry these ({{name}}, %s, {count}, ${var}) and
// corrupting them breaks the string rather than just stress-testing its
// layout. Matches, in priority order: double-mustache ({{...}}), JS template
// interpolation (${...}), single-brace ICU-style ({...}), and printf-style
// (%s, %d, %1$s, %@, etc). Single capture group so String.split() below
// alternates [plain, placeholder, plain, placeholder, ...] in the result.
const PLACEHOLDER_REGEX = /(\{\{[^{}]*\}\}|\$\{[^{}]*\}|\{[^{}]*\}|%\d*\$?[sdfotxX@])/g;

function protectedDecorate(line, counter) {
  const parts = line.split(PLACEHOLDER_REGEX);
  counter.count += Math.floor(parts.length / 2); // odd-indexed entries are placeholder matches
  return parts.map((part, idx) => (idx % 2 === 0 ? decorate(part) : part)).join("");
}

// Stepped expansion function, banded to match IBM's "Guidelines to design
// global solutions" table (as reproduced by W3C i18n: see
// https://www.w3.org/International/articles/article-text-size.en.html).
// That table expresses expansion as a RATIO of final-to-original length
// (e.g. "200-300%" = translated text ends up 2-3x the source). This
// function is ADDITIVE instead (2.0 means +200% on top of the original,
// i.e. final = 3x), so each band below uses the TOP of IBM's published
// range, converted to additive by subtracting 100%. That intentionally
// biases toward the more aggressive end of real-world expansion — a
// reasonable choice for a stress-testing tool, where over-simulating is
// safer than under-simulating.
//
// IBM's bands, for reference (source chars -> ratio range -> additive top):
//   <=10   : 200-300% ratio -> 200% additive  (used as-is)
//   11-20  : 180-200% ratio -> 100% additive  (used as-is)
//   21-30  : 160-180% ratio ->  80% additive  (used as-is)
//   31-50  : 140-160% ratio ->  60% additive  (used as-is)
//   51-70  : IBM's published "151-170%" breaks the otherwise-monotonic
//            trend (widely believed to be a typo in the original table).
//            We use 40% additive instead, interpolated to preserve a
//            smooth decline between the 31-50 and >70 bands.
//   >70    : 130% ratio -> 30% additive       (used as-is)
//
// Operates on grapheme count, not raw UTF-16 length.
function expansionRatio(len) {
  if (len <= 10) return 2.0;   // +200%
  if (len <= 20) return 1.0;   // +100%
  if (len <= 30) return 0.8;   // +80%
  if (len <= 50) return 0.6;   // +60%
  if (len <= 70) return 0.4;   // +40% (interpolated — see note above)
  return 0.3;                  // +30%
}

function randomPadWord(pool, minLen, maxLen) {
  const len = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += pool[Math.floor(Math.random() * pool.length)];
  }
  return out;
}

// Builds padding text. When includeRTL is true, RTL word-chunks (Arabic /
// Hebrew) are embedded roughly one word in three, alongside the base pool —
// simulating a mixed-bidi string rather than a segregated RTL block.
function buildPadding(targetExtraLength, includeRTL) {
  let out = "";
  while (graphemeLength(out) < targetExtraLength) {
    if (out.length > 0) out += " ";
    const useRTL = includeRTL && Math.random() < 0.35;
    out += randomPadWord(useRTL ? PAD_POOL_RTL : PAD_POOL_BASE, 3, 8);
  }
  return out;
}

function pseudolocalizeLine(line, includeRTL, counter) {
  if (line.trim().length === 0) return line; // preserve blank lines / pure whitespace
  const decorated = protectedDecorate(line, counter);
  const lineLen = graphemeLength(line);
  const targetExtra = Math.round(lineLen * expansionRatio(lineLen));
  const padding = targetExtra > 0 ? buildPadding(targetExtra, includeRTL) : "";
  return padding ? "[" + decorated + " " + padding + "]" : "[" + decorated + "]";
}

function pseudolocalize(text, includeRTL, counter) {
  return text.split("\n").map((line) => pseudolocalizeLine(line, includeRTL, counter)).join("\n");
}

// ----------------------------------------------------------------------------
// 4. Script detection + per-range font assignment.
//    Noto Sans (core) only covers Latin/Greek/Cyrillic. Thai, Arabic,
//    Hebrew, and CJK each need their own Noto family. We tag every
//    character by script, group into contiguous runs, load whatever fonts
//    are actually needed, and apply them per-range so nothing renders as
//    tofu. Failed font loads fall back to Noto Sans (Latin-only rendering
//    for that run) and are counted as an "issue" for the results summary.
// ----------------------------------------------------------------------------

const SCRIPT_FONT = {
  thai: { family: "Noto Sans Thai" },
  arabic: { family: "Noto Sans Arabic" },
  hebrew: { family: "Noto Sans Hebrew" },
  cjk: { family: "Noto Sans JP" },
  latin: { family: "Noto Sans" } // also covers Greek + Cyrillic ranges below
};

function detectScript(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x0e00 && cp <= 0x0e7f) return "thai";
  if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) ||
      (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)) return "arabic";
  if (cp >= 0x0590 && cp <= 0x05ff) return "hebrew";
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3040 && cp <= 0x30ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf)) return "cjk";
  return "latin"; // Latin, Latin Extended, Greek, Cyrillic, digits, punctuation
}

function buildScriptRuns(text) {
  const chars = Array.from(text);
  const runs = [];
  let currentScript = null;
  let start = 0;
  let offset = 0;
  for (const ch of chars) {
    const script = detectScript(ch);
    if (currentScript === null) {
      currentScript = script;
      start = offset;
    } else if (script !== currentScript) {
      runs.push({ script: currentScript, start: start, end: offset });
      currentScript = script;
      start = offset;
    }
    offset += ch.length; // ch.length handles any surrogate pairs robustly
  }
  if (currentScript !== null) runs.push({ script: currentScript, start: start, end: offset });
  return runs;
}

// Loads and applies the correct font family per script run. Returns the
// number of font-load fallbacks that occurred (for the results summary).
async function applyScriptFonts(node, runs, isBold) {
  let issues = 0;
  const resolved = {};
  const uniqueScripts = Array.from(new Set(runs.map((r) => r.script)));

  for (const script of uniqueScripts) {
    const family = SCRIPT_FONT[script].family;
    let chosen = { family: family, style: "Regular" };
    try {
      await figma.loadFontAsync({ family: family, style: "Regular" });
      if (isBold) {
        try {
          await figma.loadFontAsync({ family: family, style: "Bold" });
          chosen.style = "Bold";
        } catch (e) {
          // Bold not available for this family — Regular already loaded, keep it
        }
      }
    } catch (e) {
      issues++;
      chosen = { family: "Noto Sans", style: "Regular" }; // fallback (already loaded elsewhere)
    }
    resolved[script] = chosen;
  }

  for (const run of runs) {
    node.setRangeFontName(run.start, run.end, resolved[run.script]);
  }
  return issues;
}

async function loadAllFontsInNode(node) {
  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (const font of fonts) {
    await figma.loadFontAsync(font);
  }
  return fonts;
}

// ----------------------------------------------------------------------------
// 5. Color / contrast helpers for the overflow signal color (unchanged)
// ----------------------------------------------------------------------------

function hexToRgbObj(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255
  };
}

function relLuminance(c) {
  const t = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const R = t(c.r), G = t(c.g), B = t(c.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(c1, c2) {
  const L1 = relLuminance(c1);
  const L2 = relLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getBackgroundColor(node) {
  let current = node.parent;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if ("fills" in current && Array.isArray(current.fills)) {
      const solid = current.fills.find((f) => f.type === "SOLID" && f.visible !== false);
      if (solid) return solid.color;
    }
    current = current.parent;
  }
  return { r: 1, g: 1, b: 1 }; // default Figma canvas white
}

function pickSignalColor(bg) {
  let best = null;
  let bestRatio = 0;
  for (const hex of SIGNAL_PALETTE) {
    const rgb = hexToRgbObj(hex);
    const ratio = contrastRatio(rgb, bg);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = rgb;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
// 6. Main run routine
// ----------------------------------------------------------------------------

function collectTextNodes(nodes) {
  const result = [];
  function walk(node) {
    if (node.type === "TEXT") {
      result.push(node);
    } else if ("children" in node) {
      node.children.forEach(walk);
    }
  }
  nodes.forEach(walk);
  return result;
}

async function run(includeRTL, showSummary) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: "results", stats: null, notice: "Select a text layer or a frame containing text layers." });
    return;
  }

  const textNodes = collectTextNodes(selection);

  if (textNodes.length === 0) {
    figma.ui.postMessage({ type: "results", stats: null, notice: "No text layers found in the selection." });
    return;
  }

  const stats = {
    processed: 0,
    overflowed: 0,
    skippedLocked: 0,
    skippedAutoSized: 0,
    skippedEmpty: 0,
    fontIssues: 0,
    errors: 0,
    placeholdersProtected: 0,
    totalExpansionPct: 0
  };

  for (const node of textNodes) {
    try {
      if (node.locked || node.visible === false) {
        stats.skippedLocked++;
        continue;
      }
      if (node.characters.length === 0) {
        stats.skippedEmpty++;
        continue;
      }

      const originalFonts = await loadAllFontsInNode(node);
      const isBold = !!(originalFonts[0] && /bold/i.test(originalFonts[0].style));

      // Capture original styling before we touch anything, so we can both
      // measure accurately and re-approximate the source typeface's density
      // on the Noto Sans replacement afterward. x/y matter here too: when
      // textAutoResize switches to WIDTH_AND_HEIGHT below, Figma grows the
      // box from its text-alignment anchor (e.g. center-aligned text grows
      // symmetrically in both directions), which shifts the node's position
      // — not just its size. Restoring width/height alone leaves the node
      // correctly sized but wrongly placed, so position must be restored too.
      const originalStyle = {
        fontSize: node.getRangeFontSize(0, 1),
        letterSpacing: node.getRangeLetterSpacing(0, 1),
        lineHeight: node.getRangeLineHeight(0, 1),
        textAutoResize: node.textAutoResize,
        width: node.width,
        height: node.height,
        x: node.x,
        y: node.y
      };

      const originalText = node.characters;
      const placeholderCounter = { count: 0 };
      const pseudo = pseudolocalize(originalText, includeRTL, placeholderCounter);
      stats.placeholdersProtected += placeholderCounter.count;

      // Set the new text while still in the ORIGINAL font. This lets us
      // measure overflow against the real typeface's metrics (kerning,
      // average advance width) rather than Noto Sans's, which may be
      // narrower or wider than whatever ships to production.
      node.characters = pseudo;

      let overflowed = false;
      if (originalStyle.textAutoResize === "NONE") {
        try {
          node.textAutoResize = "WIDTH_AND_HEIGHT";
          const measuredW = node.width;
          const measuredH = node.height;
          overflowed = measuredW > originalStyle.width + 0.5 || measuredH > originalStyle.height + 0.5;
        } finally {
          node.textAutoResize = "NONE";
          node.resizeWithoutConstraints(originalStyle.width, originalStyle.height);
          node.x = originalStyle.x;
          node.y = originalStyle.y;
        }
      } else {
        stats.skippedAutoSized++;
      }

      // Now assign the correct Noto family per script range so every
      // injected character actually renders.
      const runs = buildScriptRuns(pseudo);
      stats.fontIssues += await applyScriptFonts(node, runs, isBold);

      // Re-approximate the original typeface's density on the Noto Sans
      // replacement: same size, same tracking, same explicit leading.
      const len = node.characters.length;
      node.setRangeFontSize(0, len, originalStyle.fontSize);
      node.setRangeLetterSpacing(0, len, originalStyle.letterSpacing);
      if (originalStyle.lineHeight.unit !== "AUTO") {
        node.setRangeLineHeight(0, len, originalStyle.lineHeight);
      }

      stats.processed++;
      const origLen = graphemeLength(originalText) || 1;
      const newLen = graphemeLength(pseudo);
      stats.totalExpansionPct += ((newLen - origLen) / origLen) * 100;

      if (overflowed) {
        stats.overflowed++;
        const bg = getBackgroundColor(node);
        const signal = pickSignalColor(bg);
        node.fills = [{ type: "SOLID", color: signal }];
      }
    } catch (err) {
      stats.errors++;
      console.error("Pseudolocalize error on node:", node.name, err);
    }
  }

  stats.avgExpansionPct = stats.processed > 0 ? Math.round(stats.totalExpansionPct / stats.processed) : 0;

  if (showSummary) {
    figma.ui.postMessage({ type: "results", stats: stats, notice: null });
  } else {
    let msg = "Pseudolocalized " + stats.processed + " layer(s).";
    if (stats.overflowed > 0) msg += " " + stats.overflowed + " overrun.";
    if (stats.errors > 0) msg += " " + stats.errors + " error(s) — check console.";
    figma.notify(msg);
    figma.closePlugin();
  }
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "run") {
    run(!!msg.includeRTL, !!msg.showSummary);
  } else if (msg.type === "close") {
    figma.closePlugin();
  } else if (msg.type === "resize") {
    figma.ui.resize(msg.width, msg.height);
  }
};
