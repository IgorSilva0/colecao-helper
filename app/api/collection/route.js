import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

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
    const executablePath = await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
    );

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      defaultViewport: { width: 1280, height: 800 },
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Evasão de detecção de headless
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    const rscPayloads = [];
    const allResponses = [];

    page.on("response", async (response) => {
      const resUrl = response.url();
      const contentType = response.headers()["content-type"] ?? "";
      const status = response.status();

      // Loga todas as respostas pra debug
      allResponses.push({ url: resUrl, contentType, status });

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

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Aguarda mais um pouco para requests assíncronos dispararem
    await new Promise((r) => setTimeout(r, 5000));

    // Poll up to 20s for the payload containing collection data
    let charPayload = null;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      charPayload = rscPayloads.find(
        (p) => p.text.includes('"tId"') && p.text.includes('"collections"')
      );
      if (charPayload) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!charPayload) {
      // Loga o HTML da página e todas as respostas capturadas pra debug
      const html = await page.content();
      return Response.json(
        {
          error: "Collection payload not found",
          payloadCount: rscPayloads.length,
          rscUrls: rscPayloads.map((p) => p.url),
          allResponses: allResponses.slice(0, 30), // primeiras 30
          htmlSnippet: html.slice(0, 2000),
        },
        { status: 500 }
      );
    }

    // Parse RSC format — cada linha é `id:value`
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

    const fixEncoding = (val) => {
      if (typeof val === "string") {
        try { return decodeURIComponent(escape(val)); } catch { return val; }
      }
      if (Array.isArray(val)) return val.map(fixEncoding);
      if (val && typeof val === "object") {
        return Object.fromEntries(
          Object.entries(val).map(([k, v]) => [k, fixEncoding(v)])
        );
      }
      return val;
    };

    return Response.json(fixEncoding(parsed));

  } catch (err) {
    return Response.json(
      { error: "Puppeteer failed", detail: err.message },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}