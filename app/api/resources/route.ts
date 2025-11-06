import { NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

function sanitizeQuery(q: string) {
  return q
    .replace(/\(.*?\)/g, "")        // remove ( ... )
    .replace(/[^a-zA-Z0-9\s]/g, "") // strip special chars
    .trim();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get("query") || "";
  let query = sanitizeQuery(rawQuery);

  if (!query) {
    return NextResponse.json({ resources: [] });
  }

  // Add "tutorial" to improve results
  query = `${query} tutorial`;

  // 🔍 Debug log — see what’s being searched
  console.log("🔎 YouTube query:", query);

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&relevanceLanguage=en&q=${encodeURIComponent(
        query
      )}&key=${YOUTUBE_API_KEY}`
    );

    if (!res.ok) {
      console.error("❌ YouTube API error", res.status);
      return NextResponse.json({ resources: [] });
    }

    const data = await res.json();

    if (!data.items || !Array.isArray(data.items)) {
      return NextResponse.json({ resources: [] });
    }

    const resources = data.items.map((item: any) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    return NextResponse.json({ resources });
  } catch (err) {
    console.error("❌ Error fetching YouTube:", err);
    return NextResponse.json({ resources: [] });
  }
}
