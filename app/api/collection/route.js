import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  let browser = null;

  try {
    const isDev = process.env.NODE_ENV === "development";

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: isDev
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : await chromium.executablePath(
            "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
          ),
      headless: true,
    });

    const page = await browser.newPage();

    // Wait for the specific response that contains data+values
    const collectionData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for collection data")), 25000);

      page.on("response", async (response) => {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";

        if (!url.includes("/character") || !contentType.includes("text/x-component")) return;

        try {
          const text = await response.text();
          const parsed = {};
          for (const line of text.split("\n")) {
            const match = line.match(/^([^:]+):(.+)$/);
            if (!match) continue;
            try { parsed[match[1]] = JSON.parse(match[2]); }
            catch { parsed[match[1]] = match[2]; }
          }
          const payload = parsed["1"];
          // Only resolve when we get the response that has both data and values
          if (payload?.data && payload?.values) {
            clearTimeout(timeout);
            resolve(payload);
          }
        } catch (e) {
          // ignore — some responses can't be read, keep waiting
        }
      });

      page.goto(
        `https://www.neogames.online/character?name=${encodeURIComponent(name)}&menu=information&tab=collection`,
        { waitUntil: "networkidle0", timeout: 30000 }
      ).catch(reject);
    });

    return NextResponse.json(collectionData);
  } catch (err) {
    console.error("Puppeteer error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch data" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}