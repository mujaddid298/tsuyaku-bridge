export type FloatingState = "idle" | "translating" | "translated";

const BRIDGE_ICON_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M4 17c2-6 6-9 8-9s6 3 8 9"/><path d="M8 12v5"/><path d="M16 12v5"/><path d="M12 8v9"/><circle cx="12" cy="5" r="2" fill="#111111"/></svg>`;
const CHECK_ICON_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

interface FloatingButtonCallbacks {
  onTranslate: () => void;
  onRestore: () => void;
}

class FloatingButtonManager {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private state: FloatingState = "idle";
  private callbacks: FloatingButtonCallbacks | null = null;
  private buttonEl: HTMLButtonElement | null = null;
  private tooltipEl: HTMLElement | null = null;

  init(callbacks: FloatingButtonCallbacks) {
    if (this.host) return; // already initialized
    this.callbacks = callbacks;

    this.host = document.createElement("div");
    this.host.id = "ai-translator-floating-host";
    this.shadow = this.host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483645;
        font-family: "Space Grotesk", system-ui, -apple-system, sans-serif;
      }
      .wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .btn {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        border: 2.5px solid #111111;
        outline: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffd93b;
        color: #111111;
        box-shadow: 4px 4px 0 #111111;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
        user-select: none;
      }
      .btn:hover {
        transform: translate(2px, 2px);
        box-shadow: 2px 2px 0 #111111;
      }
      .btn:active {
        transform: translate(3px, 3px);
        box-shadow: 0 0 0 #111111;
      }
      .btn.translating {
        background: #ff9a3c;
      }
      .btn.translated {
        background: #6fd3b4;
      }
      .icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 900;
      }
      .spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(0, 0, 0, 0.25);
        border-top-color: #111111;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .tooltip {
        position: absolute;
        right: 58px;
        background: #fff8ea;
        color: #111111;
        border: 2px solid #111111;
        box-shadow: 3px 3px 0 #111111;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transform: translateX(6px);
        transition: opacity 0.15s ease, transform 0.15s ease;
      }
      .wrapper:hover .tooltip {
        opacity: 1;
        transform: translateX(0);
      }
    `;

    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = "Terjemahkan Halaman (1-Klik)";
    this.tooltipEl = tooltip;

    const button = document.createElement("button");
    button.className = "btn";
    button.setAttribute("aria-label", "Tsuyaku: Terjemahkan Halaman");
    button.innerHTML = `<span class="icon">${BRIDGE_ICON_SVG}</span>`;
    this.buttonEl = button;

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.state === "idle") {
        this.callbacks?.onTranslate();
      } else if (this.state === "translated") {
        this.callbacks?.onRestore();
      }
    });

    wrapper.appendChild(tooltip);
    wrapper.appendChild(button);
    this.shadow.appendChild(style);
    this.shadow.appendChild(wrapper);

    document.body.appendChild(this.host);
  }

  setState(state: FloatingState, progress?: { done: number; total: number }) {
    this.state = state;
    if (!this.buttonEl || !this.tooltipEl) return;

    this.buttonEl.className = `btn ${state}`;

    if (state === "translating") {
      this.buttonEl.innerHTML = `<div class="spinner"></div>`;
      const progressText = progress ? ` (${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%)` : "";
      this.tooltipEl.textContent = `Menerjemahkan...${progressText}`;
    } else if (state === "translated") {
      this.buttonEl.innerHTML = `<span class="icon">${CHECK_ICON_SVG}</span>`;
      this.tooltipEl.textContent = "Kembalikan Teks Asli (1-Klik)";
    } else {
      this.buttonEl.innerHTML = `<span class="icon">${BRIDGE_ICON_SVG}</span>`;
      this.tooltipEl.textContent = "Terjemahkan Halaman (1-Klik)";
    }
  }

  destroy() {
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.buttonEl = null;
    this.tooltipEl = null;
  }
}

export const floatingButton = new FloatingButtonManager();
