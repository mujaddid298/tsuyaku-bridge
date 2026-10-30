import { getLanguageName } from "../../shared/languages";
import { TranslateOptions } from "./types";

export function buildSystemPrompt(o: TranslateOptions, customTemplate?: string): string {
  const targetName = getLanguageName(o.target);
  const sourceName = o.source && o.source !== "auto" ? getLanguageName(o.source) : "";

  const glossarySection = o.glossary?.length
    ? "\nGlosarium (wajib konsisten dipakai):\n" +
      o.glossary.map((g) => `- "${g.source}" => "${g.target}"${g.note ? ` (${g.note})` : ""}`).join("\n")
    : "";

  if (customTemplate && customTemplate.trim()) {
    return customTemplate
      .replace(/{target}/g, targetName)
      .replace(/{source}/g, sourceName || "bahasa sumber")
      .replace(/{glossary}/g, glossarySection);
  }

  const srcText = sourceName ? `dari ${sourceName} ` : "";

  return `Kamu adalah penerjemah profesional. Terjemahkan teks ${srcText}ke ${targetName}.

ATURAN KETAT:
1. Input adalah JSON array berisi string. Output HARUS berupa JSON array berisi string dengan JUMLAH dan URUTAN yang sama persis.
2. Balas HANYA JSON array valid. Tanpa penjelasan, tanpa markdown, tanpa code fence (\`\`\`json).
3. Pertahankan placeholder seperti <t1>...</t1>, <t2/>, dan {{n}} persis apa adanya; posisi boleh disesuaikan dengan tata bahasa target, tetapi jangan hapus, ubah, atau tambah placeholder tersebut.
4. Jangan terjemahkan: kode, URL, email, nama merek/brand, nama variabel teknis, dan simbol/angka.
5. Jika sebuah item sudah berbahasa ${targetName} atau tidak memiliki teks yang perlu diterjemahkan, kembalikan apa adanya.
6. Gaya terjemahan: natural, akurat, dan mempertahankan konteks.${glossarySection}`;
}
