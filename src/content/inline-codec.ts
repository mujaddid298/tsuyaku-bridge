import { SKIP_SELECTOR } from "../shared/constants";

export interface NodeSnapshot {
  tag: string;
  attrs: Record<string, string>;
  isVoid: boolean;
  liveNode?: Node;
  originalPosition?: "prefix" | "middle" | "suffix";
}

export interface CodecMap {
  [id: string]: NodeSnapshot;
}

export function encodeElement(el: Element): { text: string; map: CodecMap } {
  const map: CodecMap = {};
  let counter = 0;
  let hasEncounteredText = false;

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.textContent || "";
      if (val.trim()) {
        hasEncounteredText = true;
      }
      return val;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const elem = node as Element;
    const tag = elem.tagName.toLowerCase();

    // Check if should be skipped or is void
    const isSkip = elem.matches(SKIP_SELECTOR);
    const isVoid = ["br", "img", "hr"].includes(tag) || isSkip || tag === "svg";

    const id = `t${++counter}`;
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(elem.attributes)) {
      attrs[attr.name] = attr.value;
    }

    const originalPosition: "prefix" | "middle" = !hasEncounteredText ? "prefix" : "middle";

    map[id] = { tag, attrs, isVoid, liveNode: elem, originalPosition };

    if (isVoid) {
      return `<${id}/>`;
    }

    const inner = Array.from(elem.childNodes).map(walk).join("");
    return `<${id}>${inner}</${id}>`;
  }

  const text = Array.from(el.childNodes).map(walk).join("").trim();
  return { text, map };
}

export function decodeToFragment(
  translatedText: string,
  map: CodecMap,
  documentRef: Document = document
): DocumentFragment {
  const fragment = documentRef.createDocumentFragment();
  const usedTags = new Set<string>();

  // Tokenize string into text tokens and tags: <t1>, </t1>, <t1/>
  const tokenRegex = /<(\/?)(t\d+)(\/?)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  interface StackEntry {
    elem: Element;
    tagId: string;
  }
  const stack: StackEntry[] = [];

  function appendNode(node: Node) {
    if (stack.length > 0) {
      stack[stack.length - 1].elem.appendChild(node);
    } else {
      fragment.appendChild(node);
    }
  }

  while ((match = tokenRegex.exec(translatedText)) !== null) {
    // Append text before tag
    if (match.index > lastIndex) {
      const textPiece = translatedText.slice(lastIndex, match.index);
      appendNode(documentRef.createTextNode(textPiece));
    }
    lastIndex = tokenRegex.lastIndex;

    const isClosing = match[1] === "/";
    const tagId = match[2];
    const isSelfClosing = match[3] === "/";
    const snapshot = map[tagId];

    if (!snapshot) {
      // Unrecognized tag, just treat as text
      appendNode(documentRef.createTextNode(match[0]));
      continue;
    }

    usedTags.add(tagId);

    if (isSelfClosing || snapshot.isVoid) {
      if (snapshot.liveNode) {
        appendNode(snapshot.liveNode.cloneNode(true));
      } else {
        const elem =
          snapshot.tag.toLowerCase() === "svg"
            ? documentRef.createElementNS("http://www.w3.org/2000/svg", "svg")
            : documentRef.createElement(snapshot.tag);
        for (const [k, v] of Object.entries(snapshot.attrs)) {
          elem.setAttribute(k, v);
        }
        appendNode(elem);
      }
    } else if (isClosing) {
      // Pop stack matching this tagId if present
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagId === tagId) {
          stack.splice(i, 1);
          break;
        }
      }
    } else {
      // Opening tag
      let elem: Element;
      if (snapshot.liveNode && snapshot.liveNode.nodeType === Node.ELEMENT_NODE) {
        elem = (snapshot.liveNode as Element).cloneNode(false) as Element;
      } else {
        elem = documentRef.createElement(snapshot.tag);
        for (const [k, v] of Object.entries(snapshot.attrs)) {
          elem.setAttribute(k, v);
        }
      }
      appendNode(elem);
      stack.push({ elem, tagId });
    }
  }

  // Append remaining text after last tag
  if (lastIndex < translatedText.length) {
    appendNode(documentRef.createTextNode(translatedText.slice(lastIndex)));
  }

  // Fallback preservation: If the AI dropped any void or graphic tags (like <t1/>),
  // re-insert them so icons, SVGs, and control elements are NEVER deleted!
  for (const [tagId, snapshot] of Object.entries(map)) {
    if (!usedTags.has(tagId) && snapshot.isVoid && snapshot.liveNode) {
      const clone = snapshot.liveNode.cloneNode(true);
      if (snapshot.originalPosition === "prefix") {
        fragment.insertBefore(clone, fragment.firstChild);
      } else {
        fragment.appendChild(clone);
      }
    }
  }

  return fragment;
}
