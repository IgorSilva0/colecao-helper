import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return Response.json({ error: "Missing character name" }, { status: 400 });
  }

  const url = `https://www.neogames.online/character?name=${encodeURIComponent(name)}&menu=information&tab=collection&subtab=0`;

  let browser;
  try {
    const isDev = process.env.NODE_ENV === "development";

    browser = await puppeteer.launch(
      isDev
        ? {
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            headless: "new",
          }
        : {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          }
    );

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (r) => {
      if (["image", "stylesheet", "font", "media"].includes(r.resourceType())) {
        r.abort();
      } else {
        r.continue();
      }
    });

    const rscPayloads = [];
    page.on("response", async (response) => {
      const resUrl = response.url();
      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("text/x-component")) {
        try {
          const buffer = await response.buffer();
          const text = new TextDecoder("utf-8").decode(buffer);
          rscPayloads.push({ url: resUrl, text });
        } catch {
          // ignore
        }
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Poll for the collection payload for up to 15s
    let charPayload = null;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      charPayload = rscPayloads.find(p =>
        p.url.includes("/character") &&
        p.text.includes("\"tId\"") &&
        p.text.includes("\"collections\"")
      );
      if (charPayload) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!charPayload) {
      return Response.json({ error: "Collection payload not found" }, { status: 500 });
    }

    // Parse RSC format — each line is `id:value`
    const parsed = {};
    for (const line of charPayload.text.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const id = line.slice(0, colonIdx);
      const raw = line.slice(colonIdx + 1);
      try {
        parsed[id] = JSON.parse(raw);
      } catch {
        // not valid JSON, skip
      }
    }

    // Fix mojibake on all string values
    const fixEncoding = (val) => {
      if (typeof val === "string") {
        try { return decodeURIComponent(escape(val)); } catch { return val; }
      }
      if (Array.isArray(val)) return val.map(fixEncoding);
      if (val && typeof val === "object") {
        return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, fixEncoding(v)]));
      }
      return val;
    };

    const fixed = fixEncoding(parsed);

    return Response.json(fixed);

  } catch (err) {
    return Response.json({ error: "Puppeteer failed", detail: err.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}