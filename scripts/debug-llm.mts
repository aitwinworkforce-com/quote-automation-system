import { readFileSync } from "node:fs";
import { invokeLLM } from "../server/_core/llm";
import { storagePut, storageGet } from "../server/storage";

const buf = readFileSync("/home/ubuntu/upload/Q732717.pdf");
const { key } = await storagePut("supplier-quotes/debug/Q732717.pdf", buf, "application/pdf");
const { url } = await storageGet(key);
console.log("Signed URL:", url.slice(0, 120));

// Test 1: file_url with no schema
try {
  const r1 = await invokeLLM({
    model: "gemini-3.1-pro-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "file_url", file_url: { url, mime_type: "application/pdf" } },
          { type: "text", text: "What is the quotation number on this document? Answer in one line." },
        ],
      },
    ],
  });
  console.log("T1 (gemini, no schema):", r1?.choices?.[0]?.message?.content ?? JSON.stringify(r1).slice(0, 500));
} catch (e: any) {
  console.log("T1 FAILED:", e.message);
}

// Test 2: same but default model
try {
  const r2 = await invokeLLM({
    messages: [
      {
        role: "user",
        content: [
          { type: "file_url", file_url: { url, mime_type: "application/pdf" } },
          { type: "text", text: "What is the quotation number on this document? Answer in one line." },
        ],
      },
    ],
  });
  console.log("T2 (default model):", r2?.choices?.[0]?.message?.content ?? JSON.stringify(r2).slice(0, 500));
} catch (e: any) {
  console.log("T2 FAILED:", e.message);
}

// Test 3: base64 data URL instead of signed URL
try {
  const dataUrl = `data:application/pdf;base64,${buf.toString("base64")}`;
  const r3 = await invokeLLM({
    model: "gemini-3.1-pro-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "file_url", file_url: { url: dataUrl, mime_type: "application/pdf" } },
          { type: "text", text: "What is the quotation number on this document? Answer in one line." },
        ],
      },
    ],
  });
  console.log("T3 (data URL):", r3?.choices?.[0]?.message?.content ?? JSON.stringify(r3).slice(0, 500));
} catch (e: any) {
  console.log("T3 FAILED:", e.message);
}
