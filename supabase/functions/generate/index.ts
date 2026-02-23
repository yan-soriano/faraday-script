import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = new Set(
  [
    "http://localhost:5173",
    "http://localhost:8080",
    (Deno.env.get("PROD_DOMAIN") ?? "").trim().replace(/\/$/, ""),
  ].filter(Boolean),
);

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

type GenerationType = "chat" | "outline" | "dialogue" | "logline";

interface Character {
  name: string;
  age: number;
  traits: string;
  roleType: "main" | "secondary" | "adult" | string;
}

interface ParsedScene {
  index: number;
  heading: string;
  participants: string[];
  actionText?: string;
  hasDialogue?: boolean;
  dialogueCount?: number;
  speakingCharacters?: string[];
}

interface ProjectPayload {
  projectId?: string;
  title: string;
  synopsis: string;
  characters: Character[];
  scenes?: ParsedScene[];
  selectedSceneIndex?: number | null;
}

interface ChatPayload extends ProjectPayload {
  message: string;
}

interface DialogueScenePayload {
  heading: string;
  participants: string;
  action: string;
}

interface DialoguePayload extends ProjectPayload {
  scene: DialogueScenePayload;
}

interface LoglinePayload extends ProjectPayload {
  outlineSummary?: string;
}

// ═══════════════════════════════════════════════════════
// GLOBAL SYSTEM PROMPT — appended to ALL generation types
// ═══════════════════════════════════════════════════════
const GLOBAL_SYSTEM_PROMPT = `Сен белсенді кино жобасының ішінде жұмыс істейтін кәсіби сценарий ассистентісің. 
Барлық жауаптарда сценарий контентін тек қазақ тілінде жаз. Орысша тек қолданушы арнайы сұраса ғана қолдан.

ЖАЛПЫ ЕРЕЖЕЛЕР:
- Негізгі бала кейіпкерлері: дәл 8, жасы 7–14. Олар оқиға бойы теңдей таралуы керек (шамамен 19–21 көрініс әрқайсысына).
- Екінші пландағы кейіпкерлер: әрқайсысы 10 көріністен аз.
- Ересектер: жалпы саны максимум 4. Әр ересек максимум 20 көріністе ғана көрінуі тиіс.
- Локациялар: 3–4 негізгі локацияға сүйен. Қымбат локациялардан (сауда орталығы/ТЦ, әуежай, тікұшақ, танк, үлкен концерт, трасса ортасы және т.б.) қаш.
- Көріністер кейін диалог жазылғанда шамамен 60–90 секунд ойнауға ыңғайлы болсын.
- Диалог пен әрекет «көрсет, айтпа» қағидасына бағынсын: астарлы мағына, әрекет, таңдау, қақтығыс.

ТІЛ:
- Барлық сценарий мәтіні қазақ тілінде жазылуы тиіс.
- Орыс тілін тек қолданушы анық сұраса ғана қолдан.`;

// ═══════════════════════════════════════════════════════
// CHAT — free-form conversation, NEVER auto-generates outline
// ═══════════════════════════════════════════════════════
const CHAT_SYSTEM_PROMPT = `You are an intelligent screenplay assistant working inside an active screenplay project. You always know the full project context and must answer in Kazakh.

CHAT BEHAVIOUR:
- Еркін әңгімелес: сұрақтарға жауап бер, сценарийді талда, бөлімдерді жақсартуға көмектес, ұсыныстар бер.
- Толық поэпизодник (40–45 көріністі толық құрылым) тек қолданушы бұл туралы нақты және тікелей сұраса ғана жаса.
- Егер қолданушы құрылымды жақсартуды сұраса, алдымен қысқа талдау мен ұсыныстар бер, «Создать поэпизодник» батырмасы арқылы толық outline жасауға бағытта.

МАҢЫЗДЫ ШЕКТЕУЛЕР:
- ЕШ УАҚЫТТА өздігінен поэпизодник генерациялама. Толық поэпизодник тек "Создать поэпизодник" батырмасы арқылы жасалады.
- Чатта тек: талдау, ұсыныстар, сын, нақты сұрақтарға жауап, сцена бөліктерін жазу/жақсарту.
- Қолданушы "поэпизодник жаса" десе де, оған "Создать поэпизодник" батырмасын басуға бағытта.`;

// ═══════════════════════════════════════════════════════
// OUTLINE — strict scene list, screenplay format ONLY, NO other formats
// ═══════════════════════════════════════════════════════
const OUTLINE_SYSTEM_PROMPT = `Ты сценарный ассистент. Верни ТОЛЬКО поэпизодник — блоки сцен. Без номеров, без "КӨРІНІС:", "Қатысушылар:", "Мақсаты:", без *, **.

Длина: 1 сцена = 1–1,5 мин экрана = ~1 стр. A4. Описание 1–6 предложений.
Язык: весь текст (описания) — только на КАЗАХСКОМ. ИНТ./ЭКСТ./НАТ. не переводи.

Формат каждой сцены (пример):

ИНТ. МЕКТЕП АЛДЫ – КҮНДІЗ
ДИМАШ, БАХА, САБИНА, АМИНА, АРМАН, МАҚСАТ, ДИАНА, ДАМИР

Мектептен шыққанда, Баха мен Арман бөлек келеді. Димаш, Сабина, Аминалар олармен сөйлеспейді.

Правила: slugline ИНТ./ЭКСТ. + ЛОКАЦИЯ – ВРЕМЯ (тире длинное), заглавными. Участники — одна строка, заглавными, через запятую. Пустая строка, потом описание. Между сценами — одна пустая строка.`;

// ═══════════════════════════════════════════════════════
// DIALOGUE — ONLY selected scene; strict format; NO other context
// ═══════════════════════════════════════════════════════
const DIALOGUE_SYSTEM_PROMPT = `Ты сценарный ассистент. Диалог ТОЛЬКО для одной переданной сцены. Контекст — только эта сцена, без других сцен и комментариев.

Язык: весь текст (описание, реплики, ремарки) — только на КАЗАХСКОМ. ИНТ./ЭКСТ./НАТ. не переводи.
Длина сцены: ~1–1,5 мин = ~1 стр. A4.

Формат: slugline (ИНТ./ЭКСТ. ЛОКАЦИЯ – ВРЕМЯ), участники заглавными, пустая строка, описание, пустая строка, диалоги. Имя героя: 16 пробелов + ЗАГЛАВНЫМИ. Реплика: 8 пробелов. Ремарка: 8 пробелов + (в скобках). Только сценарий, без пояснений.`;

// ═══════════════════════════════════════════════════════
// LOGLINE — logline + Kaz Pro checklist evaluation
// ═══════════════════════════════════════════════════════
const LOGLINE_SYSTEM_PROMPT = `Сен Kaz Pro жүйесіне сүйенетін логлайн және құрылымдық талдау маманысың.
Барлық жауапты қазақ тілінде бер.`;

// ═══════════════════════════════════════════════════════
// buildProjectContext — auto-injected into every request
// ═══════════════════════════════════════════════════════
function buildProjectContext(payload: ProjectPayload): string {
  const { projectId, title, synopsis, characters, scenes = [], selectedSceneIndex } = payload;

  const adultCount = characters.filter((c) => c.roleType === "adult").length;
  const mainKids = characters.filter((c) => c.roleType === "main");
  const secondaryChars = characters.filter((c) => c.roleType === "secondary");

  const charLines = characters
    .map((c) => `${c.name} | ${c.age} | ${c.traits} | ${c.roleType}`)
    .join("\n");

  const totalScenes = scenes.length;

  const sceneIndexLines = scenes
    .map((s) => {
      const participants = (s.participants || []).join(", ");
      const shortAction =
        (s.actionText || "").split(". ").slice(0, 2).join(". ").slice(0, 280);
      return `${s.index}. ${s.heading}\nУЧАСНИКТЕР: ${participants || "—"}\nҚЫСҚА ӘРЕКЕТ: ${shortAction || "—"}`;
    })
    .join("\n\n");

  const scenesPerCharacter: Record<string, number> = {};
  for (const ch of characters) {
    const upper = ch.name.toUpperCase();
    const count = scenes.filter(
      (s) =>
        (s.participants || []).some((p) => p.toUpperCase() === upper) ||
        (s.speakingCharacters || []).includes(upper),
    ).length;
    scenesPerCharacter[ch.name] = count;
  }

  const locationsSet = new Set<string>();
  for (const s of scenes) {
    const rest = s.heading.replace(/^(ИНТ\.|НАТ\.)\s*/i, "").trim();
    const onlyLocation = rest.split(/[—-]/)[0].trim();
    if (onlyLocation) locationsSet.add(onlyLocation);
  }
  const locationsList = Array.from(locationsSet).join(", ");

  const selectedScene =
    selectedSceneIndex != null
      ? scenes.find((s) => s.index === selectedSceneIndex) || null
      : null;

  const selectedSceneText = selectedScene
    ? `${selectedScene.heading}
${(selectedScene.participants || []).join(", ")}
${selectedScene.actionText || ""}`
    : "";

  const statsSummaryLines = [
    `ЖАЛПЫ СТАТИСТИКА:`,
    `- Барлық көрініс саны: ${totalScenes}`,
    `- Негізгі балалар (roleType=main): ${mainKids.length} (мақсат: дәл 8)`,
    `- Ересектер (roleType=adult): ${adultCount} (максимум 4 болуы керек)`,
    `- Екінші пландағы кейіпкерлер (roleType=secondary): ${secondaryChars.length}`,
    `- Локациялар саны (болжамды): ${locationsSet.size} — ${locationsList || "анықталмаған"}`,
    `- Кейіпкерлер бойынша көріністер саны:`,
    ...Object.entries(scenesPerCharacter).map(
      ([name, count]) => `  • ${name}: ${count} көрініс`,
    ),
  ].join("\n");

  const productionConstraints = [
    `ӨНДІРІСТІК ШЕКТЕУЛЕР:`,
    `- 8 негізгі бала (7–14 жас).`,
    `- Ересектер максимум 4, әрқайсысы максимум 20 көріністе.`,
    `- Екінші пландағы кейіпкерлер 10 көріністен аз.`,
    `- 3–4 негізгі локация, қымбат локациялардан қашу (сауда орталығы/ТЦ, әуежай, тікұшақ, танк, үлкен концерт, трасса ортасы).`,
  ].join("\n");

  return [
    `PROJECT CONTEXT (HIDDEN FROM USER)`,
    projectId ? `Project ID: ${projectId}` : "",
    `АТАУЫ: ${title || "(атаусыз жоба)"}`,
    `СИНОПСИС (қысқаша):`,
    synopsis || "(сипаттама жоқ)",
    ``,
    `ПЕРСОНАЖДАР:`,
    charLines || "(персонаждар әлі қосылмаған)",
    ``,
    statsSummaryLines,
    ``,
    `СЦЕНАЛЫҚ ИНДЕКС (қысқаша):`,
    sceneIndexLines || "(көріністер әлі табылмады)",
    ``,
    selectedScene
      ? `ТАҢДАЛҒАН КӨРІНІС (толығырақ контекст үшін):\n${selectedSceneText}`
      : "",
    ``,
    productionConstraints,
  ]
    .filter(Boolean)
    .join("\n");
}

/** For dialogue: STRICT CONTEXT ISOLATION — only the selected scene is sent to Gemini. */
function buildDialogueContextPayload(
  payload: ProjectPayload,
  dialogueScene?: DialogueScenePayload,
): ProjectPayload {
  const scenes = payload.scenes || [];
  if (scenes.length === 0) return payload;

  let selectedSceneIndex =
    payload.selectedSceneIndex != null &&
      scenes.some((s) => s.index === payload.selectedSceneIndex)
      ? payload.selectedSceneIndex
      : null;

  if (selectedSceneIndex == null && dialogueScene?.heading) {
    const heading = dialogueScene.heading.trim().toUpperCase();
    const matched = scenes.find((s) => s.heading.trim().toUpperCase() === heading);
    if (matched) selectedSceneIndex = matched.index;
  }

  if (selectedSceneIndex == null) {
    selectedSceneIndex = scenes[0]?.index ?? null;
  }

  const selectedScene = scenes.find((s) => s.index === selectedSceneIndex);
  if (!selectedScene) return payload;

  return {
    ...payload,
    scenes: [selectedScene],
    selectedSceneIndex,
  };
}

function buildOutlineUserPrompt(payload: ProjectPayload): string {
  const { title, synopsis } = payload;

  return `Сгенерируй поэпизодник по проекту. Название: ${title || "(без названия)"}. Синопсис: ${synopsis || "(нет)"}.

Верни только сцены: заголовок (ИНТ./ЭКСТ. ЛОКАЦИЯ – ВРЕМЯ), пустая строка, участники заглавными, пустая строка, описание. Описание и весь текст — на казахском. 1 сцена ≈ 1–1,5 мин (≈1 стр. A4). Без номеров, без "КӨРІНІС:", "Қатысушылар:", "Мақсаты:", без маркеров.`;
}

/** Для outline передаём только название и синопсис — без формата сцен с номерами и подписями, чтобы модель не копировала его. */
function buildOutlineContextOnly(payload: ProjectPayload): string {
  const { title, synopsis, characters } = payload;
  const charLines = (characters || [])
    .map((c) => `${c.name} | ${c.age} | ${c.traits} | ${c.roleType}`)
    .join("\n");
  return [
    "КОНТЕКСТ ПРОЕКТА (только для понимания, формат вывода — строго ИНТ./ЭКСТ. как в инструкции):",
    `Название: ${title || "(без названия)"}`,
    `Синопсис:\n${synopsis || "(нет)"}`,
    charLines ? `Персонажи:\n${charLines}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildDialogueUserPrompt(payload: DialoguePayload): string {
  const { scene } = payload;

  return `Напиши диалог ТОЛЬКО для этой сцены. Контекст — только то, что ниже.

ЗАГОЛОВОК СЦЕНЫ:
${scene.heading}

УЧАСТНИКИ:
${scene.participants}

ОПИСАНИЕ СЦЕНЫ:
${scene.action}

Верни только текст сценария: заголовок, участники, описание, диалоги (имя — 16 пробелов, реплика — 8 пробелов, ремарка — 8 пробелов в скобках). Весь текст — на казахском. Без пояснений.`;
}

function buildLoglineUserPrompt(payload: LoglinePayload): string {
  const { title, synopsis, outlineSummary } = payload;

  return `АТАУЫ: ${title}
СИНОПСИС:
${synopsis}

${outlineSummary ? `ПОЭПИЗОДНИКТІҢ ҚЫСҚАША ҚОРЫТЫНДЫСЫ:\n${outlineSummary}\n` : ""}

ТАПСЫРМА:
A) Қазақ тілінде 1–2 сөйлемдік күшті логлайн жаз.
B) Төмендегі Kaz Pro чеклист бойынша жобаны қысқа түрде бағала, әр пункт бойынша OK немесе RISK деп белгілеп, 1–2 жол түсіндірме қос:
1) Құрылымдық тайминг (0–3, 3–15, 15–30, 30–35, 35–40 минут аралықтары)
2) Кейіпкерлер: мақсаттар, доғалар, 2–3 топ/мини-история, жасқа сай тіл
3) Әр негізгі кейіпкердің аркасы: бастапқы кемшілік, жасырын ішкі қажеттілік, сыртқы мақсат, кедергілер, өзгеріс, финалдағы жаңа күй
4) Көріністер мен диалог: әр көрініс <= 1.5 минут, қақтығыс/таңдау, «көрсет, айтпа», артық сөз жоқ
5) Локациялар: 3–4 негізгі, қымбат локациялар жоқ
6) Динамика: әр 2–3 минут сайын жаңа ақпарат/таңдау/қауіп, жеткілікті әрекет
7) Финал: тек «бақытты аяқталу» емес, бастапқы мәселелер шешіліп, мағына қалдырады, өзгеріс көрінеді
8) Өндірістік шектеулер: ересектер максимум 4, ересек көріністері <= 20, балалардың қатысуы теңгерімді

C) Жобаны жақсарту үшін 5–7 нақты ұсыныс бер.

ШЫҒАРУ ФОРМАТЫ:
A) ЛОГЛАЙН:
B) CHECKLIST:
- ...
C) ЖАҚСАРТУ ҰСЫНЫСТАРЫ:
- ...`;
}

// ═══════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════
serve(async (req) => {
  const origin = (req.headers.get("origin") ?? "").trim().replace(/\/$/, "");
  const isAllowedOrigin = !origin || ALLOWED_ORIGINS.has(origin);
  const corsHeaders = {
    ...BASE_CORS_HEADERS,
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
  };

  if (!isAllowedOrigin) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      {
        status: 403,
        headers: { ...BASE_CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const type: GenerationType = body.type;

    const baseProjectPayload: ProjectPayload = {
      projectId: body.projectId,
      title: body.title,
      synopsis: body.synopsis,
      characters: body.characters || [],
      scenes: body.scenes || [],
      selectedSceneIndex: body.selectedSceneIndex ?? null,
    };

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

    let projectContext = buildProjectContext(baseProjectPayload);
    let systemPrompt = GLOBAL_SYSTEM_PROMPT;
    let userPrompt = "";

    switch (type) {
      case "chat": {
        const chatPayload: ChatPayload = {
          ...baseProjectPayload,
          message: body.message || "",
        };
        systemPrompt = `${GLOBAL_SYSTEM_PROMPT}\n\n${CHAT_SYSTEM_PROMPT}`;
        userPrompt = chatPayload.message;
        break;
      }

      case "outline": {
        // Только outline-инструкция, без GLOBAL (чтобы не подсказывать формат "КӨРІНІС:", "Қатысушылар:" и т.д.)
        systemPrompt = OUTLINE_SYSTEM_PROMPT;
        projectContext = buildOutlineContextOnly(baseProjectPayload);
        userPrompt = buildOutlineUserPrompt(baseProjectPayload);
        break;
      }

      case "dialogue": {
        const dialoguePayload: DialoguePayload = {
          ...baseProjectPayload,
          scene: body.scene,
        };
        const scopedContextPayload = buildDialogueContextPayload(
          baseProjectPayload,
          dialoguePayload.scene,
        );
        projectContext = buildProjectContext(scopedContextPayload);
        systemPrompt = `${GLOBAL_SYSTEM_PROMPT}\n\n${DIALOGUE_SYSTEM_PROMPT}`;
        userPrompt = buildDialogueUserPrompt(dialoguePayload);
        break;
      }

      case "logline": {
        const loglinePayload: LoglinePayload = {
          ...baseProjectPayload,
          outlineSummary: body.outlineSummary,
        };
        systemPrompt = `${GLOBAL_SYSTEM_PROMPT}\n\n${LOGLINE_SYSTEM_PROMPT}`;
        userPrompt = buildLoglineUserPrompt(loglinePayload);
        break;
      }

      default:
        throw new Error(`Unknown generation type: ${type}`);
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: projectContext },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const t = await response.text();
      console.error("Gemini error:", response.status, t);

      let providerMessage = "AI service error";
      try {
        const parsed = JSON.parse(t);
        const msg = parsed?.error?.message;
        if (typeof msg === "string" && msg.trim()) {
          providerMessage = msg;
        }
      } catch {
        // Keep fallback message when provider response is not JSON.
      }

      return new Response(
        JSON.stringify({ error: providerMessage }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

