import { RenderMode } from "../shared/types";
import { CodecMap, decodeToFragment } from "./inline-codec";

const originalNodesMap = new WeakMap<Element, Node[]>();
const originalTextMap = new WeakMap<Text, string>();

export function renderTranslation(
  el: Element,
  translatedText: string,
  map: CodecMap,
  mode: RenderMode,
  bilingualStyle: "dim" | "underline" | "box" = "dim"
) {
  if (mode === "replace") {
    // If no tags were encoded (pure text container, like <span class="awsui_content">Roles</span>),
    // update text nodes in-place so React fibers, event listeners, and sibling nodes are 100% untouched!
    if (Object.keys(map).length === 0) {
      const childNodes = Array.from(el.childNodes);
      const textNodes = childNodes.filter((n) => n.nodeType === Node.TEXT_NODE) as Text[];
      if (textNodes.length === 1 && childNodes.length === 1) {
        if (!originalTextMap.has(textNodes[0])) {
          originalTextMap.set(textNodes[0], textNodes[0].nodeValue || "");
        }
        textNodes[0].nodeValue = translatedText;
        return;
      }
    }

    const fragment = decodeToFragment(translatedText, map);
    // Save original nodes if not already saved
    if (!originalNodesMap.has(el)) {
      originalNodesMap.set(el, Array.from(el.childNodes).map((n) => n.cloneNode(true)));
    }
    el.replaceChildren(fragment);
  } else {
    // Bilingual mode: check if already has translation
    const fragment = decodeToFragment(translatedText, map);
    const existing = el.querySelector(`.tx-trans[data-tx-for="${el.getAttribute("data-tx-id")}"]`);
    if (existing) {
      existing.replaceChildren(fragment);
      return;
    }

    const transSpan = document.createElement("span");
    transSpan.className = "tx-trans";
    transSpan.setAttribute("data-tx-for", el.getAttribute("data-tx-id") || "");
    transSpan.setAttribute("data-style", bilingualStyle);
    transSpan.appendChild(fragment);

    // If block element, append as block
    el.appendChild(transSpan);
  }
}

export function restoreElement(el: Element) {
  // Restore in-place updated text nodes
  const childNodes = Array.from(el.childNodes);
  for (const n of childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      const origText = originalTextMap.get(n as Text);
      if (origText !== undefined) {
        (n as Text).nodeValue = origText;
        originalTextMap.delete(n as Text);
      }
    }
  }

  // If replace mode, restore from saved clones
  const original = originalNodesMap.get(el);
  if (original) {
    el.replaceChildren(...original.map((n) => n.cloneNode(true)));
    originalNodesMap.delete(el);
  }

  // Remove any bilingual elements
  const txSpans = el.querySelectorAll(".tx-trans");
  for (const span of Array.from(txSpans)) {
    span.remove();
  }

  el.removeAttribute("data-tx-id");
}

export function restoreAll(root: Element = document.body) {
  const translated = root.querySelectorAll("[data-tx-id]");
  for (const el of Array.from(translated)) {
    restoreElement(el);
  }

  const danglingSpans = root.querySelectorAll(".tx-trans");
  for (const span of Array.from(danglingSpans)) {
    span.remove();
  }
}
