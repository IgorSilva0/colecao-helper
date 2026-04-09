import puppeteer from "puppeteer-core";

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
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    const rscPayloads = [];
    const allNetworkResponses = [];
    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      const status = response.status();
      allNetworkResponses.push({ url: response.url(), contentType, status });
      if (contentType.includes("text/x-component")) {
        try {
          const buffer = await response.buffer();
          const text = new TextDecoder("utf-8").decode(buffer);
          rscPayloads.push({ url: response.url(), text });
        } catch {
          // ignore
        }
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Poll up to 30s for the payload containing collection data
    let charPayload = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      charPayload = rscPayloads.find(
        (p) => p.text.includes('"tId"') && p.text.includes('"collections"')
      );
      if (charPayload) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!charPayload) {
      const html = await page.content();
      const allResponses = rscPayloads.map((p) => ({ url: p.url, preview: p.text.slice(0, 200) }));
      return Response.json(
        {
          error: "Collection payload not found",
          payloadCount: rscPayloads.length,
          urls: rscPayloads.map((p) => p.url),
          allResponses,
          allNetworkResponses: allNetworkResponses.slice(0, 40),
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