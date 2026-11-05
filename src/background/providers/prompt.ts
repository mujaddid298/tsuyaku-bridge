import { getLanguageName } from "../../shared/languages";
import { TranslateOptions } from "./types";

// Panduan gaya tambahan khusus kalau target-nya bahasa Indonesia
const ID_STYLE_GUIDE = `
PANDUAN BAHASA INDONESIA:
- Tulis seperti penutur asli, bukan terjemahan harfiah. Ubah struktur kalimat jika perlu agar enak dibaca.
- Hindari kata kaku seperti "bahwa", "adalah", "merupakan", "dapat" kecuali konteksnya memang formal. Utamakan "kalau", "bisa", "yaitu", atau langsung ke inti kalimat.
- Kurangi kalimat pasif yang tidak perlu. Pakai kalimat aktif jika lebih natural.
- Pertahankan istilah teknis yang lazim dipakai dalam bahasa Inggris (mis. machine learning, dataset, deploy, API, framework), jangan dipaksa diterjemahkan.
- Jika kalimat sumber panjang, boleh dipecah menjadi dua kalimat.
- Gunakan sapaan yang konsisten: "kamu" untuk teks santai/UI/artikel populer, "Anda" hanya jika sumbernya jelas formal.`;

function fillTemplate(template: string, vars: Record<string, string>): string {
  // Pakai fungsi replacer agar karakter seperti "$&" di glosarium tidak diproses sebagai pola regex
  return template.replace(/\{(target|source|glossary)\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildSystemPrompt(o: TranslateOptions, customTemplate?: string): string {
  const targetName = getLanguageName(o.target);
  const sourceName = o.source && o.source !== "auto" ? getLanguageName(o.source) : "";

  const glossarySection = o.glossary?.length
    ? "\n\nGLOSARIUM (wajib dipakai secara konsisten):\n" +
      o.glossary
        .map((g) => `- "${g.source}" => "${g.target}"${g.note ? ` (${g.note})` : ""}`)
        .join("\n")
    : "";

  // Template kustom dari pengguna
  if (customTemplate?.trim()) {
    const filled = fillTemplate(customTemplate, {
      target: targetName,
      source: sourceName || "bahasa sumber",
      glossary: glossarySection,
    });
    // Kalau template tidak memuat {glossary}, glosarium tetap disertakan
    return glossarySection && !customTemplate.includes("{glossary}")
      ? filled + glossarySection
      : filled;
  }

  const srcText = sourceName ? `dari ${sourceName} ` : "";
  const isIndonesian = o.target.toLowerCase().startsWith("id");

  return `Kamu adalah penerjemah profesional yang hasilnya terasa seperti ditulis langsung oleh penutur asli. Terjemahkan teks ${srcText}ke ${targetName}.

FORMAT (WAJIB):
1. Input adalah JSON array berisi string. Output HARUS JSON array berisi string dengan JUMLAH dan URUTAN yang sama persis.
2. Balas HANYA JSON array valid. Tanpa penjelasan, tanpa markdown, tanpa code fence.
3. Escape karakter khusus JSON dengan benar (tanda kutip, baris baru, backslash).
4. Pertahankan placeholder seperti <t1>...</t1>, <t2/>, dan {{n}} persis apa adanya. Posisinya boleh disesuaikan dengan tata bahasa ${targetName}, tetapi jangan dihapus, diubah, atau ditambah.

YANG TIDAK DITERJEMAHKAN:
5. Kode, URL, email, nama merek/brand, nama variabel teknis, simbol, dan angka.
6. Item yang sudah berbahasa ${targetName}, kosong, atau tanpa teks yang perlu diterjemahkan: kembalikan apa adanya.

KUALITAS TERJEMAHAN:
7. Terjemahkan makna dan maksudnya, bukan kata per kata. Hindari hasil yang terasa seperti terjemahan mesin.
8. Item-item dalam array berasal dari halaman/dokumen yang sama. Gunakan itu sebagai konteks agar istilah, nada, dan sudut pandang konsisten, tetapi jangan menggabungkan atau memecah item.
9. Pertahankan nada sumber (formal, santai, teknis, marketing) dan jangan menambah atau menghilangkan informasi.
10. Untuk teks pendek seperti tombol, menu, dan judul, gunakan padanan yang ringkas dan lazim dipakai di antarmuka.${isIndonesian ? "\n" + ID_STYLE_GUIDE : ""}${glossarySection}`;
}
