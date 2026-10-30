class TranslationOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private progressContainer: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;

  init() {
    if (this.host) return;

    this.host = document.createElement("div");
    this.host.id = "tx-overlay-root";
    this.host.style.position = "absolute";
    this.host.style.top = "0";
    this.host.style.left = "0";
    this.host.style.width = "100%";
    this.host.style.height = "100%";
    this.host.style.pointerEvents = "none";
    this.host.style.zIndex = "2147483647";

    this.shadow = this.host.attachShadow({ mode: "closed" });

    // Styles inside shadow DOM
    const style = document.createElement("style");
    style.textContent = `
      .tx-progress-card {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #fff8ea;
        color: #111111;
        padding: 12px 16px;
        border-radius: 12px;
        border: 2.5px solid #111111;
        box-shadow: 4px 4px 0 #111111;
        font-family: "Space Grotesk", system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 700;
        pointer-events: auto;
        display: none;
        flex-direction: column;
        gap: 8px;
        min-width: 220px;
        animation: txFadeIn 0.2s ease-out;
      }
      .tx-bar-bg {
        width: 100%;
        height: 8px;
        background: #e6dfd1;
        border: 1.5px solid #111111;
        border-radius: 4px;
        overflow: hidden;
      }
      .tx-bar-fill {
        height: 100%;
        background: #ffd93b;
        width: 0%;
        transition: width 0.3s ease;
      }
      .tx-tooltip {
        position: fixed;
        background: #fff8ea;
        color: #111111;
        padding: 14px 18px;
        border-radius: 14px;
        border: 2.5px solid #111111;
        box-shadow: 5px 5px 0 #111111;
        font-family: "Space Grotesk", system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        max-width: 380px;
        pointer-events: auto;
        display: none;
        flex-direction: column;
        gap: 10px;
        z-index: 2147483647;
      }
      .tx-tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #111111;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .tx-btn {
        background: #ffd93b;
        color: #111111;
        border: 2px solid #111111;
        box-shadow: 2px 2px 0 #111111;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        transition: transform 0.1s;
      }
      .tx-btn:hover {
        transform: translate(1px, 1px);
        box-shadow: 1px 1px 0 #111111;
      }
      .tx-btn:active {
        transform: translate(2px, 2px);
        box-shadow: 0 0 0 #111111;
      }
      @keyframes txFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;

    this.shadow.appendChild(style);

    // Progress card
    this.progressContainer = document.createElement("div");
    this.progressContainer.className = "tx-progress-card";
    this.progressContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:800; text-transform:uppercase; font-size:12px;">Tsuyaku Bridge</span>
        <span id="tx-ptext" style="font-size:12px; font-weight:700;">0%</span>
      </div>
      <div class="tx-bar-bg">
        <div id="tx-bfill" class="tx-bar-fill"></div>
      </div>
    `;
    this.shadow.appendChild(this.progressContainer);

    this.progressBar = this.shadow.getElementById("tx-bfill");
    this.progressText = this.shadow.getElementById("tx-ptext");

    // Tooltip for selection
    this.tooltip = document.createElement("div");
    this.tooltip.className = "tx-tooltip";
    this.shadow.appendChild(this.tooltip);

    document.documentElement.appendChild(this.host);
  }

  showProgress(done: number, total: number) {
    this.init();
    if (!this.progressContainer || !this.progressBar || !this.progressText) return;

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    this.progressContainer.style.display = "flex";
    this.progressBar.style.width = `${pct}%`;
    this.progressText.textContent = `${pct}% (${done}/${total})`;

    if (done >= total && total > 0) {
      setTimeout(() => {
        if (this.progressContainer) this.progressContainer.style.display = "none";
      }, 2000);
    }
  }

  hideProgress() {
    if (this.progressContainer) {
      this.progressContainer.style.display = "none";
    }
  }

  showSelectionTooltip(_original: string, translated: string) {
    this.init();
    if (!this.tooltip) return;

    this.tooltip.innerHTML = `
      <div class="tx-tooltip-header">
        <span>Terjemahan AI</span>
        <button id="tx-close-btn" class="tx-btn" style="padding:2px 6px;">✕</button>
      </div>
      <div style="max-height:200px; overflow-y:auto; word-break:break-word;">
        ${escapeHtml(translated)}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:6px;">
        <button id="tx-copy-btn" class="tx-btn">Salin</button>
      </div>
    `;

    // Position in bottom-right corner or center
    this.tooltip.style.bottom = "24px";
    this.tooltip.style.right = "24px";
    this.tooltip.style.display = "flex";

    const closeBtn = this.tooltip.querySelector("#tx-close-btn");
    closeBtn?.addEventListener("click", () => {
      if (this.tooltip) this.tooltip.style.display = "none";
    });

    const copyBtn = this.tooltip.querySelector("#tx-copy-btn");
    copyBtn?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(translated);
      if (copyBtn) copyBtn.textContent = "Tersalin!";
      setTimeout(() => {
        if (copyBtn) copyBtn.textContent = "Salin";
      }, 1500);
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const overlay = new TranslationOverlay();
