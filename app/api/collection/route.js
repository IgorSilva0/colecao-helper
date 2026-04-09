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

    // Usa CDP diretamente para capturar response bodies
    const client = await page.createCDPSession();
    await client.send("Network.enable");

    const rscPayloads = [];
    const requestMap = {};

    client.on("Network.responseReceived", (event) => {
      const ct = event.response.headers["content-type"] ?? "";
      if (ct.includes("text/x-component")) {
        requestMap[event.requestId] = true;
      }
    });

    client.on("Network.loadingFinished", async (event) => {
      if (!requestMap[event.requestId]) return;
      try {
        const { body } = await client.send("Network.getResponseBody", {
          requestId: event.requestId,
        });
        rscPayloads.push(body);
      } catch {
        // ignore
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Poll up to 30s for the payload containing collection data
    let charPayload = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      charPayload = rscPayloads.find(
        (p) => p.includes('"tId"') && p.includes('"collections"')
      );
      if (charPayload) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!charPayload) {
      return Response.json(
        {
          error: "Collection payload not found",
          payloadCount: rscPayloads.length,
          previews: rscPayloads.map((p) => p.slice(0, 100)),
        },
        { status: 500 }
      );
    }

    // Parse RSC format — cada linha é `id:value`
    const parsed = {};
    for (const line of charPayload.split("\n")) {
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