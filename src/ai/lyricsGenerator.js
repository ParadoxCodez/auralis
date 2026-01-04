const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export async function generateLyrics(songTitle, artist = "") {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ API key not found");
  }

  const prompt = `
Write original song lyrics

Title: ${songTitle}
Artist: ${artist || "unknown"}

Rules:
- Original lyrics only
- Match mood and theme
- No explanation
- Just lyrics text
`;

  const response = await fetch("/api/groq/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("GROQ error:", err);
    throw new Error("Lyrics generation failed");
  }

  const data = await response.json();

  return data.choices?.[0]?.message?.content || "Lyrics unavailable.";
}
