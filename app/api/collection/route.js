export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return Response.json({ error: "Missing character name" }, { status: 400 });
  }

  // Step 1: resolve name → characterIdx
  const armoryRes = await fetch(
    `https://api.neogames.online/api/website/armory?name=${encodeURIComponent(name)}`,
    { next: { revalidate: 60 } }
  );

  if (!armoryRes.ok) {
    return Response.json({ error: "Character not found" }, { status: 404 });
  }

  const armoryData = await armoryRes.json();
  const characterIdx = armoryData?.character?.characterIdx;

  if (!characterIdx) {
    return Response.json({ error: "Character not found" }, { status: 404 });
  }

  // Step 2: fetch collection using the resolved ID
  const collectionRes = await fetch(
    `https://api.neogames.online/api/website/armory/collection/${characterIdx}`,
    { next: { revalidate: 60 } }
  );

  if (!collectionRes.ok) {
    return Response.json({ error: "Failed to fetch collection" }, { status: collectionRes.status });
  }

  const collectionData = await collectionRes.json();

  return Response.json({
    character: armoryData.character,
    ...collectionData,
  });
}