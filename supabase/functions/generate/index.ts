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
// OUTLINE — strict 40–45 scene generation with Kaz Pro
// ═══════════════════════════════════════════════════════
const OUTLINE_SYSTEM_PROMPT = `Ты сценарный ассистент. Твоя задача: вернуть только поэпизодник.

КРИТИЧЕСКИЕ ПРАВИЛА ВЫВОДА:
- Никаких объяснений, комментариев, вступлений, выводов, чеклистов, оценок, рекомендаций.
- Никаких заголовков вроде "Вот поэпизодник".
- Верни только список эпизодов.
- Формат каждого эпизода строго такой:

ИНТ./НАТ. ЛОКАЦИЯ - ВРЕМЯ
УЧАСТНИК 1, УЧАСТНИК 2, УЧАСТНИК 3

Полное описание эпизода

- Между эпизодами оставляй ровно одну пустую строку.
- Между участниками всегда запятая, все имя  в ВЕРХНЕМ РЕГИСТРЕ.
- Описание эпизода: 3-6 предложений, только действие и драматургия, без служебных комментариев.
- Язык: казахский.

МІНДЕТ:
- Дәл 40–45 көріністен тұратын поэпизодник құр.
- Әр көріністі бөлек блок ретінде жаз.

Поэпизодник құру барысында сценарий келесідей структурураға сәйкес болуы керек:
KAZ PRO ҚҰРЫЛЫМЫ:
- 0–3 мин: кіріспе, әлем мен кейіпкерлерді таныстыру, қызықты интрига.
- 3–15 мин: басты мәселе нақты анықталады, кейіпкерлер оны түсінеді.
- 15–30 мин: қақтығыс күшейеді, кедергілер, шешімдер, шағын жеңілістер мен жеңістер.
- 30–35 мин: кульминация – ең үлкен тәуекел мен шешуші таңдау сәті.
- 35–40 мин: мәні бар финал – бастапқы мәселе шешіледі, кейіпкерлердің өзгерісі көрінеді.

KAZ PRO ЖҮЙЕСІ ЕРЕЖЕЛЕРІ:
- Кейіпкерлер доғасы:
  - Әр негізгі кейіпкерде: бастапқы кемшілік, ішкі қажеттілік, сыртқы мақсат, негізгі қақтығыс, трансформация процесі, финалдағы жаңа күйі болуы керек.
- 7 баланың бәрі бір үйде тұратын реалистік емес шешімдерден қаш.
- Балалар әртүрлі әлеуметтік ортадан келсін (мектеп, аула, аудан, ауыл/қала т.б.).
- 2–3 бала тобы болсын, әр тобтың шағын мини-историясы (мини-аркасы) бар.
- Әр кейіпкердің оқиға желісінде жеке шағын доғасы сезілсін.

ДИАЛОГҚА ҚАТЫСТЫ ШЕКТЕУЛЕР (ПОЭПИЗОДНИКТЕ БОЛАШАҚ ДИАЛОГ ҮШІН):
- Әр көріністің болашақ диалогы максимум 1.5 минутқа созылатындай етіп жоспарлансын.
- Диалог қысқа, нақты, тавтологиясыз, «көрсет, айтпа» принципіне сай болуы керек.
- Балалар сөйлеуі жасына сай, қарапайым әрі тірі тілде болуы тиіс.

ӨНДІРІСТІК ШЕКТЕУЛЕР:
- 8 негізгі бала (7–14 жас) – поэпизодник бойы шамамен тең таралсын (әрқайсысы ~19–21 көріністе).
- Ересектер жалпы саны максимум 4, әрқайсысы максимум 20 көріністе.
- Екінші пландағы кейіпкерлер 10 көріністен аз қатыссын.
- Локациялар саны: тек 3–4 негізгі локацияны қолдан.
- Қымбат локациялардан қаш: сауда орталығы / ТЦ, әуежай, тікұшақ, танк, үлкен концерт, трасса ортасы және соған ұқсас масштабты орындар.
- Белгілі актерлер (жұлдыздар) максимум 15 эпизодқа ғана қатыса алады.
- Рөлдер теңгерімді болсын, жүйенің ішкі логикасы біртұтас және қайшы келмейтін болсын.

ҚАУІПСІЗДІК ЖӘНЕ KAZ PRO CHECKLIST:
- Алдымен ішкі түрде осы поэпизодниктің Kaz Pro чеклисті бойынша сәйкестігін 0–100% арасында бағала.
- Егер сәйкестік < 80% болса, алдымен қай жерде ереже бұзылғанын анықтап, поэпизодникті түзетіп қайта құрып, тек содан кейін финалдық нұсқаны бер.
- Соңында қысқа "CHECKLIST ЕСКЕРТУЛЕРІ" бөлімін қосып, қандай тәуекелдер қалғанын 3–7 пунктпен атап өт.

ТІЛ:
- Барлық көріністердің сипаттамасы қазақ тілінде жазылсын.

МАҢЫЗДЫ:
- Тек поэпизодник контентін және соңындағы қысқа чеклист ескертулерін шығар.
- Әр көрініс нақты, ойнауға болатын деңгейде қысқа әрі айқын болсын.`;

// ═══════════════════════════════════════════════════════
// DIALOGUE — per-scene dialogue generation
// ═══════════════════════════════════════════════════════
const DIALOGUE_SYSTEM_PROMPT = `Сен поэпизодникке негізделген диалог жазатын кәсіби сценарий ассистентісің.

МИНДЕТ:
- Тек берілген көрініс үшін толық диалог жаз.
- Көрініс 60–90 секундта ойнауға ыңғайлы болсын.

ЕРЕЖЕЛЕР:
- Сахна тақырыбын (heading) және қатысушылар тізімін қайта жазба.
- Жаңа кейіпкерлерді қоспа, тек participants қатарында көрсетілгендерді пайдалан.
- Диалог қысқа, динамикалы, тавтологиясыз болсын.
- Балалардың сөйлеуі жасына сай табиғи қазақ тілінде болсын.
- «Көрсет, айтпа» қағидасын ұстан: әрекет, кідіріс, таңдаулар, қақтығыс арқылы мағынаны көрсет.

ФОРМАТ:
Кейіпкер аты (БАРЛЫҒЫ ҮЛКЕН ӘРІППЕН)
(қажет болса) ремарка
Диалог жолдары

Қажет болған жағдайда ғана 1–3 қысқа әрекет жолын қосуға болады. Барлық мәтінді қазақ тілінде жаз.`;

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

  const selectedPos = scenes.findIndex((s) => s.index === selectedSceneIndex);
  if (selectedPos === -1) return payload;

  // Keep only selected scene + up to two nearest neighbors.
  let start = Math.max(0, selectedPos - 1);
  let end = Math.min(scenes.length, selectedPos + 2);

  while (end - start < 3) {
    if (start > 0) {
      start--;
      continue;
    }
    if (end < scenes.length) {
      end++;
      continue;
    }
    break;
  }

  return {
    ...payload,
    scenes: scenes.slice(start, end),
    selectedSceneIndex,
  };
}

function buildOutlineUserPrompt(payload: ProjectPayload): string {
  const { title, synopsis } = payload;

  return `Берілген толық жоба контекстіне сүйеніп, қазақ тілінде 40–45 көріністен тұратын поэпизодник құр.

ФИЛЬМ АТАУЫ: ${title || "(атаусыз жоба)"}

ҚЫСҚАША СИНОПСИС:
${synopsis || "(сипаттама жоқ)"}

Барлық Kaz Pro және өндірістік шектеулерді қатаң сақта. Әр көріністі жоғарыда сипатталған форматта жаз.`;
}

function buildDialogueUserPrompt(payload: DialoguePayload): string {
  const { synopsis, characters, scene } = payload;
  const charList = characters
    .map((c) => `${c.name} | ${c.age} | ${c.traits} | ${c.roleType}`)
    .join("\n");

  return `СИНОПСИС:
${synopsis}

ПЕРСОНАЖДАР:
${charList}

КӨРІНІС КОНТЕКСТІ:
${scene.heading}
${scene.participants}
${scene.action}

ТЕК ОСЫ КӨРІНІС ҮШІН қазақ тілінде толық диалог жаз. Жоғарыдағы диалог ережелерін сақта.`;
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

    // Auto-inject project context for ALL request types
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
        systemPrompt = `${GLOBAL_SYSTEM_PROMPT}\n\n${OUTLINE_SYSTEM_PROMPT}`;
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

