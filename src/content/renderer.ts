import { RenderMode } from "../shared/types";
import { CodecMap, decodeToFragment } from "./inline-codec";

const originalNodesMap = new WeakMap<Element, Node[]>();

export function renderTranslation(
  el: Element,
  translatedText: string,
  map: CodecMap,
  mode: RenderMode,
  bilingualStyle: "dim" | "underline" | "box" = "dim"
) {
  const fragment = decodeToFragment(translatedText, map);

  if (mode === "replace") {
    // Save original nodes if not already saved
    if (!originalNodesMap.has(el)) {
      originalNodesMap.set(el, Array.from(el.childNodes).map((n) => n.cloneNode(true)));
    }
    el.replaceChildren(fragment);
  } else {
    // Bilingual mode: check if already has translation
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
