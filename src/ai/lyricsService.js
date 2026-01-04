export async function fetchLyrics(songTitle, artist) {
  const title = (songTitle || "").trim();
  const artistName = (artist || "").trim();
  if (!title || !artistName) {
    throw new Error("Song title and artist are required");
  }
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      let errDetail = {};
      try {
        errDetail = await res.json();
      } catch {}
      throw new Error(`Lyrics API Error: ${res.status} ${res.statusText} ${JSON.stringify(errDetail)}`);
    }
    const data = await res.json();
    if (data && typeof data.lyrics === "string" && data.lyrics.trim()) {
      return data.lyrics.trim();
    }
    return null;
  } catch (e) {
    console.error("fetchLyrics error:", e);
    throw e;
  }
}
