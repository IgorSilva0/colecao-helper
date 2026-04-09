export const maxDuration = 60;

const RSC_HEADERS = {
  "accept": "text/x-component",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "text/plain;charset=UTF-8",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "x-deployment-id": "dpl_J8ydMxyR6NXZMyAD38USHbMAxjCH",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

// Parse RSC format — cada linha é `id:value`
function parseRsc(text) {
  const parsed = {};
  for (const line of text.split("\n")) {
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
  return parsed;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return Response.json({ error: "Missing character name" }, { status: 400 });
  }

  // Step 1: busca o ID numérico do personagem pelo nome
  const idRes = await fetch(
    `https://www.neogames.online/character?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        ...RSC_HEADERS,
        "next-action": "6042902f8f336d9b3699a6f65018d6d9829b43f944",
        "next-router-state-tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22(routes)%22%2C%7B%22children%22%3A%5B%22(with-layout)%22%2C%7B%22children%22%3A%5B%22(marketing)%22%2C%7B%22children%22%3A%5B%22character%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C16%5D",
        "Referer": "https://www.neogames.online/character",
      },
      body: `[1,${JSON.stringify(name)}]`,
    }
  );

  if (!idRes.ok) {
    return Response.json({ error: "Failed to fetch character ID", status: idRes.status }, { status: 500 });
  }

  const idText = await idRes.text();
  const idParsed = parseRsc(idText);

  // Procura o tId no payload
  const charEntry = Object.values(idParsed).find(
    (v) => v && typeof v === "object" && v.tId
  );

  if (!charEntry?.tId) {
    return Response.json({ error: "Character ID not found", parsed: idParsed }, { status: 500 });
  }

  const charId = charEntry.tId;

  // Step 2: busca a coleção pelo ID numérico
  const colRes = await fetch(
    `https://www.neogames.online/character?name=${encodeURIComponent(name)}&menu=information&tab=collection&subtab=0`,
    {
      method: "POST",
      headers: {
        ...RSC_HEADERS,
        "next-action": "40feefff897c3700a0ecac9b5f903cf96e7293d9e5",
        "next-router-state-tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22(routes)%22%2C%7B%22children%22%3A%5B%22(with-layout)%22%2C%7B%22children%22%3A%5B%22(marketing)%22%2C%7B%22children%22%3A%5B%22character%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C16%5D",
        "Referer": `https://www.neogames.online/character?name=${encodeURIComponent(name)}&menu=information&tab=collection&subtab=0`,
      },
      body: `[${charId}]`,
    }
  );

  if (!colRes.ok) {
    return Response.json({ error: "Failed to fetch collection", status: colRes.status }, { status: 500 });
  }

  const colText = await colRes.text();
  const colParsed = parseRsc(colText);

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

  return Response.json(fixEncoding(colParsed));
}