import { z } from "zod";

/**
 * The questionnaire. Editing this file is how questions change — there is no CMS.
 *
 * - IDs name media files in Blob storage and key answers in every manifest.
 *   Preserve existing IDs when editing a question.
 * - `type` is the main way to answer. Every answer slot can hold text, a voice
 *   recording and photos, depending on the question:
 *     text   → a text box, plus a "Record a voice note" button (unless voiceNote: false)
 *     voice  → a recorder
 *     image  → photo upload (up to maxImages, default 3)
 *   Any question can also take photos by setting `maxImages`.
 * - `perPerson: true` gives the question one answer slot per person.
 * - `section` groups consecutive questions under a chapter heading.
 *
 * The array is validated with zod when this module loads, so a malformed entry
 * or a duplicate id fails `next build` loudly.
 */

export const QUESTION_TYPES = ["text", "voice", "image"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const PERSON_SLOTS = ["p1", "p2"] as const;
export type PersonSlot = (typeof PERSON_SLOTS)[number];

/** Default labels for the two per-person answer slots. Respondents can type real names on the first screen. */
export const PEOPLE: Record<PersonSlot, string> = {
  p1: "Riva Chavan",
  p2: "",
};

/** Time zone used for dates in the admin area. */
export const DISPLAY_TIME_ZONE = "Asia/Kolkata";

export const DEFAULT_MAX_DURATION_SEC = 180;
export const DEFAULT_MAX_IMAGES = 3;
export const MAX_IMAGES_LIMIT = 25;

const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be a lowercase slug like q01-intro"),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(1),
    helperText: z.string().trim().min(1).optional(),
    sectionDescription: z.string().trim().min(1).optional(),
    required: z.boolean(),
    maxDurationSec: z.number().int().min(5).max(600).optional(),
    multiline: z.boolean().optional(),
    /** Text questions: offer a voice note next to the text box. Defaults to true. */
    voiceNote: z.boolean().optional(),
    /** Allow up to this many photos per answer slot. Image questions default to DEFAULT_MAX_IMAGES. */
    maxImages: z.number().int().min(1).max(MAX_IMAGES_LIMIT).optional(),
    perPerson: z.boolean().optional(),
    section: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.maxDurationSec !== undefined && q.type !== "voice") {
      ctx.addIssue({ code: "custom", message: `${q.id}: maxDurationSec only applies to voice questions` });
    }
    if (q.voiceNote !== undefined && q.type !== "text") {
      ctx.addIssue({ code: "custom", message: `${q.id}: voiceNote only applies to text questions` });
    }
    if (q.multiline !== undefined && q.type !== "text") {
      ctx.addIssue({ code: "custom", message: `${q.id}: multiline only applies to text questions` });
    }
  });

export type Question = z.infer<typeof QuestionSchema>;

export interface AnswerModes {
  text: boolean;
  voice: boolean;
  /** Max photos per answer slot; 0 means none. */
  images: number;
}

/** Which parts an answer slot accepts for this question. */
export function answerModes(q: Pick<Question, "type" | "voiceNote" | "maxImages">): AnswerModes {
  return {
    text: q.type === "text",
    voice: q.type === "voice" || (q.type === "text" && q.voiceNote !== false),
    images: q.type === "image" ? (q.maxImages ?? DEFAULT_MAX_IMAGES) : (q.maxImages ?? 0),
  };
}

const QuestionnaireSchema = z
  .array(QuestionSchema)
  .min(1)
  .superRefine((questions, ctx) => {
    const seen = new Set<string>();
    for (const q of questions) {
      if (seen.has(q.id)) ctx.addIssue({ code: "custom", message: `Duplicate question id "${q.id}"` });
      seen.add(q.id);
    }
  });

interface QuestionSection {
  title: string;
  description?: string;
  questions: { prompt: string; helperText?: string; maxImages?: number }[];
}

const QUESTION_SECTIONS: QuestionSection[] = [
  {
    title: "Riva, the person",
    questions: [
      { prompt: "Describe yourself in three words. Then give the three words your closest friend would use." },
      { prompt: "Where did you grow up, and what is the first space you remember being moved by? What did it do to you?" },
      { prompt: "Outside design, which books, films, music, art or people have shaped how you see the world?" },
      { prompt: "What are you obsessive about, in design or otherwise?" },
      { prompt: "What does luxury mean to you, and what does it not mean?" },
      { prompt: "Describe your own home: what is in it, what you collect, and what you would never allow in it." },
    ],
  },
  {
    title: "Origin and the studio's story",
    questions: [
      { prompt: "What is your educational and professional background? Where did you train and work before the studio?" },
      { prompt: "When and why did you start Riva Chavan Studio? What did you see in the market that felt wrong?" },
      { prompt: "List every project you have done so far, of any size: paid, unpaid, your own home, family homes, work under a previous employer. Which are you proudest of, and why?", maxImages: 10 },
      { prompt: "What has been the hardest moment since you started, and what did it teach you?" },
      { prompt: "Honestly, why do you think the studio has not landed bigger clients yet?" },
      { prompt: "Who has been part of the journey so far: partners, team, mentors, family?" },
      { prompt: "Is there anything about your story you do not want made public?" },
    ],
  },
  {
    title: "Design philosophy",
    questions: [
      { prompt: "Explain neoclassical design the way you would to a client who has never heard the term." },
      { prompt: "Why neoclassical for you? What moment made you fall for it, and what does it give a Mumbai or Thane home that contemporary or minimal design does not?" },
      { prompt: "Which periods, architects or movements do you draw from (Palladio, Robert Adam, Louis XVI, Regency, colonial Bombay, Art Deco, others)?" },
      { prompt: "How do you adapt classical design to Indian families, Indian climate, and modern apartments with low ceilings and builder layouts?" },
      { prompt: "Which neoclassical elements are non-negotiable for you, and which are overused or done badly? Where is your line between elegant and excessive with ornament, marble, gold and brass?" },
      { prompt: "Describe walking into a Riva Chavan room through the senses: light, sound, texture, smell, temperature." },
      { prompt: "How do you balance a client's taste with your own point of view? Have you ever refused a client's request?" },
      { prompt: "What role do art, antiques and Indian craftsmen play in your work?" },
      { prompt: "Complete this sentence five different ways: \"A home should...\"" },
      { prompt: "Which topics could you speak about with real authority (for example mouldings, marble selection, lighting, layouts, turnkey costs, Vastu, renovating old buildings)?" },
      { prompt: "Share 10 to 20 reference images that capture your design language, and 5 that capture what you dislike.", maxImages: 25 },
    ],
  },
  {
    title: "Ambition and vision",
    questions: [
      { prompt: "Where do you want the studio to be in 12 months, 3 years and 10 years? Do you see it as a boutique founder-led studio or a larger firm?" },
      { prompt: "What revenue, number of projects and average project size would make the next 12 months a success?" },
      { prompt: "Beyond residential in Thane and Mumbai, what interests you: other cities or countries, villas, hospitality, commercial, developer show flats, your own product line?" },
      { prompt: "What do you personally want from this business? Rank these: money, recognition, creative freedom, independence, legacy." },
    ],
  },
  {
    title: "Turnkey model and operations",
    description: "Marketing can only promise what operations can deliver, so this section sets what we are allowed to claim.",
    questions: [
      { prompt: "Walk us through your turnkey process step by step, from the first call to handover. Include how you present designs (renders, mood boards, samples) and how you supervise sites and update clients." },
      { prompt: "What exactly is included in a turnkey project, and what is excluded?" },
      { prompt: "Who executes the work: in-house team, contractors, your own workshop? Who are your key vendors and craftsmen, and how long have you worked with them?" },
      { prompt: "What is a realistic timeline for a 3BHK, a 4BHK and a 5,000+ sq ft home? How many projects can you run in parallel without quality dropping, and in which localities?" },
      { prompt: "How do you handle delays, cost overruns and change requests? Do you offer a warranty or post-handover support?" },
      { prompt: "Where is your process weakest today? We would rather fix it than market around it." },
      { prompt: "What makes your turnkey delivery better than a contractor, a large chain (Livspace, HomeLane, Design Cafe) or another boutique studio?" },
    ],
  },
  {
    title: "The ideal client",
    questions: [
      { prompt: "Describe your dream client as a real person: age, profession, family, lifestyle. Who in the family actually makes the decision and signs?" },
      { prompt: "What is happening in their life when they come to you: a new purchase, possession, a renovation, a marriage, parents moving in?" },
      { prompt: "Which buildings, projects and localities in Thane and Mumbai do your ideal clients live in or buy into? Name them." },
      { prompt: "What do they fear most about doing interiors, and what have they usually been through with designers or contractors before?" },
      { prompt: "Which clients would you refuse even if they could pay? What were the red flags in your worst client experience?" },
      { prompt: "Who influences their choice of designer: architects, brokers, developers, friends, Instagram?" },
      { prompt: "Where do your enquiries come from today, and at what point do they usually drop off, and why?" },
      { prompt: "List every question clients ask you before they hire you." },
    ],
  },
  {
    title: "Pricing and the money conversation",
    description: "The public brand speaks to ₹5–15 Cr homes. Owners of ₹2–5 Cr homes will be reached quietly through targeted ads and WhatsApp, never on the main grid.",
    questions: [
      { prompt: "How do you price turnkey today? Give the per sq ft range for low, mid and premium work, and a typical total for a 3BHK and a 4BHK." },
      { prompt: "What payment structure do you follow, and how flexible is it?" },
      { prompt: "For ₹2–5 Cr homeowners stretched after their purchase, what can you offer without diluting quality (phased execution, room-by-room, fixed-scope packages, financing)?" },
      { prompt: "Where can you save a client money without the home looking cheaper, and where will you never cut costs?" },
      { prompt: "Would you charge a consultation fee, adjustable against the project, to filter serious clients? How much feels right?" },
      { prompt: "What is the lowest project value you will accept to keep cash flowing?" },
      { prompt: "Do you earn a margin on materials and furniture, or is your fee the full margin? How open are you about this with clients?" },
    ],
  },
  {
    title: "Market and competition",
    questions: [
      { prompt: "Which studios in Thane and Mumbai do you see as direct competitors? When you lose a client, who do they go to, and why?" },
      { prompt: "Which studios in India or abroad do you admire, and which are overrated? Who does neoclassical well, and who does it badly?" },
      { prompt: "What do competitors do better than you today?" },
      { prompt: "How do clients in Thane differ from clients in Mumbai in what they want and expect?" },
      { prompt: "Share links to Instagram accounts, websites or brand films in interiors that have impressed you recently." },
    ],
  },
  {
    title: "Brand personality and voice",
    questions: [
      { prompt: "If the studio were a person walking into a room, how would they dress, speak and behave?" },
      {
        prompt: "Pick a side on each pair, and say how strongly (1 to 5):",
        helperText: "Quiet authority / Warm and welcoming\nPoetic / Precise\nHeritage / Modern\nExclusive / Approachable\nSerious / Witty\nStoryteller / Expert",
      },
      { prompt: "Which words should the brand own, and which should it never use (for example \"dream home\", \"luxury\", \"budget-friendly\")?" },
      { prompt: "How comfortable are you holding strong opinions in public, such as criticising common design choices?" },
      { prompt: "Which brands, writers or filmmakers, in any field, have a tone you would want the studio to borrow? Share a few taglines you admire." },
      { prompt: "What should someone feel after one minute on the studio's Instagram, and what should a client say after the first meeting?" },
    ],
  },
  {
    title: "Visual identity",
    questions: [
      { prompt: "What, if anything, do you want to keep from the current logo and visual identity?" },
      { prompt: "Should the identity lead with your name, a monogram (RC), a symbol, or a mix? Are you open to a refined name such as \"Studio Riva Chavan\" or \"Riva Chavan Atelier\"?" },
      { prompt: "Which classical motifs feel personal to you: columns, arches, mouldings, laurels, crests, borders?" },
      { prompt: "Which colours feel like you, and which should never be associated with the studio?" },
      { prompt: "Do you lean toward serif, script, engraved capitals or modern sans-serif type? Share 3 to 5 logos or brand identities you love, and 2 you dislike.", maxImages: 10 },
      { prompt: "Which photography style feels right: moody and dramatic, soft natural light, editorial with people, or architectural and empty?" },
    ],
  },
  {
    title: "Brand story and philosophy",
    questions: [
      { prompt: "Why does the studio exist, beyond making money? Answer in one sentence." },
      { prompt: "What are the 3 to 5 values the studio will never break, even if it costs a project?" },
      { prompt: "What promise do you make to every client, whatever their budget?" },
      { prompt: "What does the studio stand against? Include any belief you hold that most of your industry would disagree with." },
      { prompt: "What single idea do you want people to connect with your name a year from now?" },
      { prompt: "What should a home you designed feel like after 1 year, 10 years and 20 years?" },
      { prompt: "Is there a cause you care about that the studio could stand for, such as preserving craft, restoring heritage, or sustainability?" },
    ],
  },
  {
    title: "Assets available today",
    description:
      "Share everything, even rough material.\n\n☐ Photos, videos, renders, mood boards and sketches of any past or proposed work, including your own and family homes\n☐ Client testimonials or messages of appreciation, and past clients willing to speak on video\n☐ Current logo files and any past marketing material\n☐ Access to Instagram, Facebook, Google Business Profile, website and domain\n☐ Any past Meta ad account, with spend and results\n☐ Vendors and craftsmen we can feature, with their consent\n☐ Material samples and finishes in the studio that we can shoot\n☐ Credentials, awards and memberships",
    questions: [
      { prompt: "Is there any current or upcoming project, of any size, that we can document from start to finish?", maxImages: 10 },
      { prompt: "Do you have access to a show flat, a friend's home or another space we can style and shoot as a concept project?", maxImages: 10 },
    ],
  },
  {
    title: "Working together",
    questions: [
      { prompt: "Who are the decision-makers on your side, and who gives final approval on brand, content and spend?" },
      { prompt: "What turnaround can you commit to for approvals: same day, 48 hours, or weekly?" },
      { prompt: "Who will answer enquiries and take first calls and site visits, and how fast can they respond?" },
      { prompt: "What monthly ad budget are you comfortable starting with, and what would you scale to once leads come in?" },
      { prompt: "What would make you feel this partnership is working at 30 days, 90 days and 6 months?" },
      { prompt: "What has frustrated you about agencies, freelancers or past marketing efforts?" },
    ],
  },
  {
    title: "Rapid fire",
    description: "First instinct, a few words each.",
    questions: [
      { prompt: "Favourite room in any home:" },
      { prompt: "A building in Mumbai you love:" },
      { prompt: "A hotel whose interiors you would move into:" },
      { prompt: "Marble or wood:" },
      { prompt: "Symmetry or asymmetry:" },
      { prompt: "Chandelier or concealed lighting:" },
      { prompt: "White walls or coloured walls:" },
      { prompt: "Paris, London, Rome or Vienna:" },
      { prompt: "A designer you would want to have dinner with:" },
      { prompt: "One word for what clients should feel at handover:" },
    ],
  },
];

let questionNumber = 0;
const RAW_QUESTIONS: z.input<typeof QuestionSchema>[] = QUESTION_SECTIONS.flatMap((section) =>
  section.questions.map((question, index) => ({
    id: `riva-q${String(++questionNumber).padStart(2, "0")}`,
    type: "text" as const,
    section: section.title,
    ...(index === 0 && section.description ? { sectionDescription: section.description } : {}),
    prompt: question.prompt,
    required: false,
    multiline: true,
    ...(question.helperText ? { helperText: question.helperText } : {}),
    ...(question.maxImages ? { maxImages: question.maxImages } : {}),
  })),
);

function parseQuestions(raw: unknown): Question[] {
  const result = QuestionnaireSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid questionnaire in src/config/questions.ts\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const QUESTIONS: Question[] = parseQuestions(RAW_QUESTIONS);

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}
