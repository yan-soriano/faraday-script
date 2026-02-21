import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a professional screenwriting assistant for Kazakh/Russian kids & family films.
You must follow formatting rules EXACTLY. Output must be machine-parseable.

GLOBAL CONSTRAINTS:
- Main kids characters: exactly 8, age 7–14. They should appear evenly across the story (target 19–21 scenes each).
- Secondary characters: each appears in < 10 scenes.
- Adult characters: total max 4. If user already defined N adults, you can add at most (4 - N). Each adult appears in max 20 scenes.
- Locations: prefer 3–4 main locations total. Avoid expensive locations (mall/ТЦ, airport/аэропорт, concert/концерт, helicopter/вертолет, stadium-scale events) unless user explicitly demands.
- Scenes must be short and playable in ~1–1.5 minutes later when dialogue is written.
- Dialogue must follow "Show, don't tell": subtext, action, choices, conflict.

LANGUAGE:
- Default output in Russian. Keep it clear and natural.

STRICT FORMATTING:
- Scene headings MUST start with "ИНТ." or "НАТ." in uppercase.
- Participants line MUST be uppercase names separated by comma+space.
- No numbering unless explicitly requested.
- Do not add extra commentary outside requested output.`;

function buildOutlinePrompt(title: string, synopsis: string, characters: any[]) {
  const charList = characters
    .map((c: any) => `${c.name} | ${c.age} | ${c.traits} | ${c.roleType}`)
    .join("\n");
  const adultCount = characters.filter((c: any) => c.roleType === "adult").length;

  return `PROJECT TITLE: ${title}

SYNOPSIS:
${synopsis}

CHARACTERS (user-defined):
${charList}

USER-DEFINED ADULT COUNT: ${adultCount}

TASK:
Generate a поэпизодник of exactly 40–45 scenes.

OUTPUT RULES (MANDATORY):
For each scene output exactly:
1) Scene heading line: "ИНТ." or "НАТ." + location name
2) Participants line: UPPERCASE names, comma-separated
3) Action description: 2–5 sentences, NO DIALOGUE

STRUCTURE (MANDATORY):
- 0–3 min: introduce characters + intrigue
- 3–15 min: main problem is clear (turning point 1)
- 15–30 min: conflict escalates, decisions, obstacles
- 30–35 min: climax
- 35–40 min: finale with meaning

ADDITIONAL RULES:
- Use 3–4 main locations total.
- Ensure balanced participation of 8 main kids (~19–21 scenes each).
- Secondary characters < 10 scenes each.
- Adults max total 4, each adult max 20 scenes.

START NOW. Output only the outline.`;
}

function buildDialoguePrompt(
  synopsis: string,
  characters: any[],
  sceneHeading: string,
  sceneParticipants: string,
  sceneAction: string
) {
  const charList = characters
    .map((c: any) => `${c.name} | ${c.age} | ${c.traits} | ${c.roleType}`)
    .join("\n");

  return `SYNOPSIS:
${synopsis}

CHARACTERS:
${charList}

SCENE CONTEXT:
${sceneHeading}
${sceneParticipants}
${sceneAction}

TASK:
Write the full screenplay dialogue for this scene only.

CONSTRAINTS:
- Duration: 60–90 seconds (1–1.5 minutes).
- Dialogue: short, precise, meaningful, no filler, no tautology.
- Age-appropriate speech for kids 7–14.
- Show-don't-tell: use actions, choices, conflict.
- Do not introduce new characters not listed in participants.
- Keep format strictly as screenplay blocks:

CHARACTER NAME (UPPERCASE)
(Optional) (parenthetical)
Dialogue line(s)

You may add 1–3 short action lines ONLY if necessary.

OUTPUT ONLY the dialogue blocks (and minimal action if needed). Do not repeat the heading/participants.`;
}

function buildLoglinePrompt(title: string, synopsis: string, outlineSummary?: string) {
  return `TITLE: ${title}
SYNOPSIS:
${synopsis}

${outlineSummary ? `OUTLINE SUMMARY:\n${outlineSummary}` : ""}

TASK:
A) Write a strong LOGLINE (1–2 sentences).
B) Evaluate against the following Kaz Pro checklist and mark each as OK or RISK with 1–2 lines justification:
1) Structure timing beats (0–3, 3–15, 15–30, 30–35, 35–40)
2) Characters: goals, arcs, 2–3 groups/miniplots, age-appropriate language
3) Character Arc per main character: start flaw, hidden need, external goal, obstacles, change, final change
4) Episodes & Dialogue: each scene <= 1.5 min, conflict/choice, show-don't-tell, no filler
5) Locations: 3–4 main, no expensive
6) Dynamics: new info/choice/danger every 2–3 minutes, enough action
7) Finale: not only happy end; leaves meaning; resolves initial problems; shows change
8) Production constraints: adults max 4, adult scenes <= 20, balanced kids

C) Provide 5–7 actionable improvements.

OUTPUT FORMAT:
A) LOGLINE:
B) CHECKLIST:
- ...
C) IMPROVEMENTS:
- ...`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, title, synopsis, characters, scene, outlineSummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userPrompt = "";

    switch (type) {
      case "outline":
        userPrompt = buildOutlinePrompt(title, synopsis, characters);
        break;
      case "dialogue":
        userPrompt = buildDialoguePrompt(
          synopsis,
          characters,
          scene.heading,
          scene.participants,
          scene.action
        );
        break;
      case "logline":
        userPrompt = buildLoglinePrompt(title, synopsis, outlineSummary);
        break;
      default:
        throw new Error(`Unknown generation type: ${type}`);
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Лимит запросов превышен, попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Необходимо пополнить кредиты AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Ошибка AI сервиса" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
