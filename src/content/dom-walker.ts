import { BLOCK_TAGS, SKIP_SELECTOR } from "../shared/constants";
import { TranslationUnit } from "../shared/types";
import { CodecMap, encodeElement } from "./inline-codec";

export interface CollectedUnit {
  unit: TranslationUnit;
  element: Element;
  codecMap: CodecMap;
}

export function isElementVisible(el: Element): boolean {
  if (el.hasAttribute("hidden")) return false;
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

export function isMeaningfulText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  // If only digits, punctuation or whitespace
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) return false;
  return true;
}

export function findClosestBlock(node: Node): Element | null {
  let curr: Node | null = node.parentElement;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (curr.nodeType === Node.ELEMENT_NODE) {
      const el = curr as Element;
      if (el.matches(SKIP_SELECTOR)) return null;
      if (BLOCK_TAGS.has(el.tagName)) return el;
    }
    curr = curr.parentNode;
  }
  return (node.parentElement as Element) || null;
}

export function collectTranslationUnits(root: Element = document.body): CollectedUnit[] {
  const collected: CollectedUnit[] = [];
  const processedBlocks = new WeakSet<Element>();
  let unitIndex = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent || !isMeaningfulText(node.textContent)) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const blockElements: Element[] = [];

  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    const block = findClosestBlock(textNode);
    if (block && !processedBlocks.has(block) && !block.hasAttribute("data-tx-id")) {
      processedBlocks.add(block);
      blockElements.push(block);
    }
  }

  for (const block of blockElements) {
    if (!isElementVisible(block)) continue;

    const { text, map } = encodeElement(block);
    if (!isMeaningfulText(text)) continue;

    const id = `u_${Date.now()}_${++unitIndex}`;
    block.setAttribute("data-tx-id", id);

    collected.push({
      unit: { id, text },
      element: block,
      codecMap: map,
    });
  }

  return collected;
}
