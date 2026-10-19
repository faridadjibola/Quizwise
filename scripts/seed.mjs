import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!url || !key || !email || !password) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.",
  );
}

const db = createClient(url, key, { auth: { persistSession: false } });
const {
  data: { users },
  error: usersError,
} = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;

let admin = users.find((user) => user.email === email);
if (!admin) {
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Sample Admin" },
  });
  if (created.error) throw created.error;
  admin = created.data.user;
}

const profile = await db.from("profiles").upsert({
  id: admin.id,
  email,
  full_name: "Sample Admin",
  role: "admin",
  is_active: true,
});
if (profile.error) throw profile.error;

const quizzes = [
  {
    title: "Everyday Science",
    category: "Science",
    description: "A quick tour through core science ideas.",
    difficulty: "easy",
    questions: [
      {
        text: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Mercury"],
        correct_answer: "Mars",
        explanation: "Iron oxide gives Mars its reddish appearance.",
        difficulty: "easy",
      },
      {
        text: "What gas do plants absorb during photosynthesis?",
        options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
        correct_answer: "Carbon dioxide",
        explanation: "Plants use carbon dioxide and water to make sugars.",
        difficulty: "easy",
      },
      {
        text: "What is the chemical symbol for water?",
        options: ["CO2", "H2O", "O2", "NaCl"],
        correct_answer: "H2O",
        explanation: "A water molecule has two hydrogen atoms and one oxygen atom.",
        difficulty: "easy",
      },
      {
        text: "How many bones are in a typical adult human body?",
        options: ["106", "206", "306", "406"],
        correct_answer: "206",
        explanation: "Most adults have 206 bones.",
        difficulty: "medium",
      },
      {
        text: "Which force pulls objects toward Earth?",
        options: ["Friction", "Magnetism", "Gravity", "Tension"],
        correct_answer: "Gravity",
        explanation: "Gravity attracts objects with mass.",
        difficulty: "easy",
      },
    ],
  },
  {
    title: "Numbers & Logic",
    category: "Mathematics",
    description: "Practice arithmetic, patterns and reasoning.",
    difficulty: "medium",
    questions: [
      {
        text: "What is 7 × 8?",
        options: ["54", "56", "58", "64"],
        correct_answer: "56",
        explanation: "Seven groups of eight make fifty-six.",
        difficulty: "easy",
      },
      {
        text: "What is the square root of 81?",
        options: ["7", "8", "9", "10"],
        correct_answer: "9",
        explanation: "9 × 9 = 81.",
        difficulty: "easy",
      },
      {
        text: "Which number is prime?",
        options: ["21", "27", "29", "33"],
        correct_answer: "29",
        explanation: "29 has no positive divisors other than 1 and itself.",
        difficulty: "medium",
      },
      {
        text: "What is 15% of 200?",
        options: ["15", "20", "30", "45"],
        correct_answer: "30",
        explanation: "0.15 × 200 = 30.",
        difficulty: "medium",
      },
      {
        text: "What is 3/4 as a percentage?",
        options: ["25%", "50%", "75%", "80%"],
        correct_answer: "75%",
        explanation: "3 divided by 4 is 0.75, or 75%.",
        difficulty: "easy",
      },
    ],
  },
  {
    title: "Moments in History",
    category: "History",
    description: "Explore people and events that shaped the past.",
    difficulty: "medium",
    questions: [
      {
        text: "In what year did humans first land on the Moon?",
        options: ["1959", "1969", "1979", "1989"],
        correct_answer: "1969",
        explanation: "Apollo 11 landed on the Moon in July 1969.",
        difficulty: "easy",
      },
      {
        text: "Which civilization built the pyramids at Giza?",
        options: ["Ancient Egyptians", "Ancient Greeks", "Romans", "Aztecs"],
        correct_answer: "Ancient Egyptians",
        explanation: "The Giza pyramids were built in ancient Egypt.",
        difficulty: "easy",
      },
      {
        text: "Who is commonly credited with developing the movable-type printing press in Europe?",
        options: ["Galileo Galilei", "Johannes Gutenberg", "Isaac Newton", "Marco Polo"],
        correct_answer: "Johannes Gutenberg",
        explanation: "Gutenberg's press helped make books more widely available in Europe.",
        difficulty: "medium",
      },
      {
        text: "The Magna Carta was sealed in which year?",
        options: ["1066", "1215", "1492", "1776"],
        correct_answer: "1215",
        explanation: "King John sealed the Magna Carta in 1215.",
        difficulty: "hard",
      },
      {
        text: "Which city was the center of the Roman Empire?",
        options: ["Athens", "Carthage", "Rome", "Alexandria"],
        correct_answer: "Rome",
        explanation: "Rome was the capital and political center of the Roman Empire.",
        difficulty: "easy",
      },
    ],
  },
  {
    title: "World Geography",
    category: "Geography",
    description: "Test your knowledge of places around the world.",
    difficulty: "easy",
    questions: [
      {
        text: "What is the capital of Japan?",
        options: ["Kyoto", "Seoul", "Tokyo", "Osaka"],
        correct_answer: "Tokyo",
        explanation: "Tokyo is Japan's capital and largest metropolitan area.",
        difficulty: "easy",
      },
      {
        text: "Which is the largest ocean on Earth?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        correct_answer: "Pacific",
        explanation: "The Pacific Ocean is the world's largest ocean.",
        difficulty: "easy",
      },
      {
        text: "Which continent is crossed by the Equator and the Prime Meridian?",
        options: ["Asia", "Africa", "South America", "Europe"],
        correct_answer: "Africa",
        explanation: "Both the Equator and Prime Meridian cross Africa.",
        difficulty: "medium",
      },
      {
        text: "The Sahara Desert is primarily located on which continent?",
        options: ["Asia", "Africa", "Australia", "South America"],
        correct_answer: "Africa",
        explanation: "The Sahara stretches across northern Africa.",
        difficulty: "easy",
      },
      {
        text: "Mount Everest is part of which mountain range?",
        options: ["Andes", "Alps", "Himalayas", "Rockies"],
        correct_answer: "Himalayas",
        explanation: "Mount Everest is in the Himalayan mountain range.",
        difficulty: "easy",
      },
    ],
  },
  {
    title: "Technology Basics",
    category: "Technology",
    description: "A friendly introduction to computing and the web.",
    difficulty: "easy",
    questions: [
      {
        text: "What does CPU stand for?",
        options: [
          "Central Processing Unit",
          "Computer Personal Utility",
          "Core Program Upload",
          "Central Power User",
        ],
        correct_answer: "Central Processing Unit",
        explanation: "The CPU executes instructions and processes data.",
        difficulty: "easy",
      },
      {
        text: "What does HTML primarily describe?",
        options: [
          "The structure of web pages",
          "A type of computer memory",
          "A network cable",
          "An image format",
        ],
        correct_answer: "The structure of web pages",
        explanation: "HTML provides the structure and meaning of web page content.",
        difficulty: "easy",
      },
      {
        text: "Which two digits are used in the binary number system?",
        options: ["0 and 1", "1 and 2", "0 and 9", "A and B"],
        correct_answer: "0 and 1",
        explanation: "Binary is a base-two number system using 0 and 1.",
        difficulty: "easy",
      },
      {
        text: "What does the S in HTTPS indicate?",
        options: ["Simple", "Secure", "System", "Shared"],
        correct_answer: "Secure",
        explanation: "HTTPS uses encryption to protect data sent between a browser and website.",
        difficulty: "medium",
      },
      {
        text: "Which device is primarily used to enter text into a computer?",
        options: ["Monitor", "Keyboard", "Speaker", "Projector"],
        correct_answer: "Keyboard",
        explanation: "A keyboard is a common input device for entering text.",
        difficulty: "easy",
      },
    ],
  },
];

const questionRows = quizzes.flatMap((quiz) =>
  quiz.questions.map((question) => ({
    ...question,
    type: "multiple_choice",
    category: quiz.category,
    created_by: admin.id,
  })),
);
const questionTexts = questionRows.map((question) => question.text);
const { data: existingQuestions, error: existingQuestionsError } = await db
  .from("questions")
  .select("id,text")
  .eq("created_by", admin.id)
  .in("text", questionTexts);
if (existingQuestionsError) throw existingQuestionsError;

const existingTexts = new Set((existingQuestions ?? []).map((question) => question.text));
const missingQuestions = questionRows.filter((question) => !existingTexts.has(question.text));
let insertedQuestions = [];
if (missingQuestions.length) {
  const inserted = await db.from("questions").insert(missingQuestions).select("id,text");
  if (inserted.error) throw inserted.error;
  insertedQuestions = inserted.data ?? [];
}

const questionIds = new Map(
  [...(existingQuestions ?? []), ...insertedQuestions].map((question) => [
    question.text,
    question.id,
  ]),
);

for (const quizSpec of quizzes) {
  const { data: existingQuiz, error: lookupError } = await db
    .from("quizzes")
    .select("id")
    .eq("created_by", admin.id)
    .eq("title", quizSpec.title)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const quizValues = {
    title: quizSpec.title,
    description: quizSpec.description,
    category: quizSpec.category,
    difficulty: quizSpec.difficulty,
    estimated_minutes: 8,
    time_limit_minutes: 10,
    pass_mark: 70,
    attempts_allowed: 3,
    shuffle_questions: true,
    shuffle_options: false,
    is_published: true,
    status: "PUBLISHED",
    publish_at: new Date().toISOString(),
    created_by: admin.id,
  };

  let quizId = existingQuiz?.id;
  if (quizId) {
    const { error: updateError } = await db
      .from("quizzes")
      .update(quizValues)
      .eq("id", quizId);
    if (updateError) throw updateError;
  } else {
    const { data: createdQuiz, error: createError } = await db
      .from("quizzes")
      .insert(quizValues)
      .select("id")
      .single();
    if (createError) throw createError;
    quizId = createdQuiz.id;
  }

  const { error: clearError } = await db
    .from("quiz_questions")
    .delete()
    .eq("quiz_id", quizId);
  if (clearError) throw clearError;

  const assignments = quizSpec.questions.map((question, position) => ({
    quiz_id: quizId,
    question_id: questionIds.get(question.text),
    position,
    points: 1,
  }));
  const { error: assignmentError } = await db.from("quiz_questions").insert(assignments);
  if (assignmentError) throw assignmentError;
}

console.log(`Seeded admin ${email}, ${quizzes.length} quizzes and ${questionRows.length} questions.`);
