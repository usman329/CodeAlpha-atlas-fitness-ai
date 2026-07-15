import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getSystemInstructionWithFAQs } from "./src/data/faqs_matcher";
import { generateHumanFallbackResponse } from "./src/data/fallback_generator";

const app = express();
const PORT = 3000;

// Simple JSON Database for Collective Learnings across all users
interface DatabaseSchema {
  collectiveLearnings: string[];
}

const DB_FILE = path.join(process.cwd(), "database.json");

function getDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  // Default collective knowledge values
  const defaultDb: DatabaseSchema = {
    collectiveLearnings: [
      "Athlete Abdul Sami targets core strength and high intensity sprint endurance",
      "Swimmers require customized shoulder preservation drills and lat mobilization",
      "Bodybuilders focus on mechanical tension, metabolic stress, and calculated load scaling",
      "Cricketers require dynamic rotational power drills and wrist/forearm conditioning"
    ]
  };
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing default database:", err);
  }
  return defaultDb;
}

function saveDatabase(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving database:", err);
  }
}

// Initialize GoogleGenAI client lazily on the server.
// This prevents crashing on startup if GEMINI_API_KEY is not immediately present.
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper function to call generateContent with retry and model fallback on transient situations
async function generateContentWithRetry(aiClient: GoogleGenAI, params: any, retries = 2, delay = 500): Promise<any> {
  const modelsToTry = [
    params.model || "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  
  for (const modelName of modelsToTry) {
    const currentParams = { ...params, model: modelName };
    for (let i = 0; i < retries; i++) {
      try {
        return await aiClient.models.generateContent(currentParams);
      } catch (err: any) {
        const status = err?.status || err?.statusCode || (err?.message && err.message.includes("503") ? 503 : 0);
        const isTransient = status === 503 || status === 429 || (err?.message && (
          err.message.includes("high demand") || 
          err.message.includes("overloaded") || 
          err.message.includes("UNAVAILABLE") ||
          err.message.includes("temporary")
        ));
        
        if (isTransient && i < retries - 1) {
          console.log(`[System Notice] Model ${modelName} is temporarily busy. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5; // exponential backoff
          continue;
        }
        
        if (modelName !== modelsToTry[modelsToTry.length - 1]) {
          console.log(`[System Notice] Model ${modelName} is busy, checking alternative option...`);
          break;
        }
        throw err;
      }
    }
  }
}

function isGibberishOrIrrelevant(text: string): boolean {
  const query = (text || "").toLowerCase().trim();
  if (!query) return false;
  
  // 1. Check for standard gibberish characters (long words without vowels)
  const words = query.split(/\s+/);
  for (const word of words) {
    if (word.length >= 4) {
      const hasVowels = /[aeiouy]/.test(word);
      if (!hasVowels) {
        return true;
      }
      // Check for keyboard rolls / mashings, e.g., "asdf", "hjkl", "dfgh", "zxcv", "qwer"
      if (/(asdf|sdfg|dfgh|fghj|ghjk|hjkl|asdfg|qwerty|zxcvb|qwert|lkjh|mnbvc|jrefgdjk|gfdj|fgdj|asfg|asdfgh)/.test(word)) {
        return true;
      }
    }
  }

  // 2. Check if the message is a short random character sequence like 'xyz', 'qwe', 'ghj'
  if (query.length > 0 && query.length <= 10) {
    const commonShortWords = new Set([
      "hi", "hey", "hello", "yo", "sup", "yes", "no", "y", "n", "ok", "okay", "bye", "help", "gym", "run", "fit", "bmi", "diet", "legs", "back", "arms", "chest", "abs", "core", "pain", "hurt"
    ]);
    if (/^[a-z]+$/.test(query) && !commonShortWords.has(query)) {
      const vowelCount = (query.match(/[aeiouy]/g) || []).length;
      if (vowelCount === 0 || (query.length >= 4 && vowelCount / query.length < 0.2)) {
        return true;
      }
    }
  }

  return false;
}

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// API route to proxy chat messages to Gemini API
app.post("/api/chat", async (req, res) => {
  try {
    const { userMessageText, history, selectedTrack, learnedMemories, hostName, imageBase64, imageMimeType } = req.body;

    if (!userMessageText) {
      return res.status(400).json({ error: "userMessageText is required" });
    }

    if (isGibberishOrIrrelevant(userMessageText)) {
      return res.json({ text: `I'm not sure what you want to convey. Could you please clarify your message? I am here to help you with your athletic training, custom workout planning, or gym facility questions!` });
    }

    const db = getDatabase();
    const activeHost = hostName || "Abdul Sami";

    // Dynamic Learning: scan message for athletic positions, sports, or injury limitations
    const lowerText = userMessageText.toLowerCase();
    let detectedLearning = "";

    if (lowerText.includes("winger") || lowerText.includes("striker") || lowerText.includes("midfielder") || lowerText.includes("defender") || lowerText.includes("goalkeeper")) {
      const match = lowerText.match(/(winger|striker|midfielder|defender|goalkeeper)/i);
      if (match) detectedLearning = `Athlete ${activeHost} specified soccer/football field position: ${match[0]}`;
    } else if (lowerText.includes("bowler") || lowerText.includes("batsman") || lowerText.includes("all-rounder")) {
      const match = lowerText.match(/(bowler|batsman|all-rounder)/i);
      if (match) detectedLearning = `Athlete ${activeHost} specified cricket roster role: ${match[0]}`;
    } else if (lowerText.includes("swimmer") || lowerText.includes("swimming")) {
      detectedLearning = `Athlete ${activeHost} specified swimming endurance target`;
    } else if (lowerText.includes("bodybuilder") || lowerText.includes("bodybuilding") || lowerText.includes("hypertrophy")) {
      detectedLearning = `Athlete ${activeHost} specified bodybuilding hypertrophy target`;
    } else if (lowerText.includes("powerlifter") || lowerText.includes("powerlifting")) {
      detectedLearning = `Athlete ${activeHost} specified heavy powerlifting weight target`;
    } else if (lowerText.includes("injury") || lowerText.includes("pain") || lowerText.includes("hurt")) {
      detectedLearning = `Athlete ${activeHost} reported physical precaution or injury check: "${userMessageText.substring(0, 60)}"`;
    } else if (lowerText.includes("weight loss") || lowerText.includes("calorie deficit")) {
      detectedLearning = `Athlete ${activeHost} prefers high-energy workouts for weight loss`;
    }

    // Save learning if detected and unique
    if (detectedLearning && !db.collectiveLearnings.some(item => item.toLowerCase() === detectedLearning.toLowerCase())) {
      db.collectiveLearnings.push(detectedLearning);
      if (db.collectiveLearnings.length > 50) {
        db.collectiveLearnings.shift();
      }
      saveDatabase(db);
      console.log(`[Database Learn] Saved collective knowledge: "${detectedLearning}"`);
    }

    // Combine local memories and global database learnings
    const combinedMemories = [
      ...(learnedMemories || []),
      ...db.collectiveLearnings
    ];

    // 1. Compile the top 5 most relevant FAQs along with active track rules into system instructions
    let systemInstruction = getSystemInstructionWithFAQs(userMessageText, selectedTrack, combinedMemories);

    // 2. Explicitly instruct the model to memorize and prioritize personal user context
    systemInstruction += `\n\nCRITICAL USER PERSONAL CONTEXT INSTRUCTION:
- You must carefully inspect the Personalized Adaptive Memory and the conversation history.
- The user's name is ${activeHost}. Address them personally when appropriate!
- Take extreme care of their specific sports playing positions (such as soccer/football positions, striker, midfielder, fast bowler) and their active gym routine or physical limits.
- Never send generic repeated templates. Always prioritize the user's personal fitness profile, goals, and safety boundaries in every single response.`;

    if (imageBase64 && imageMimeType) {
      systemInstruction += `\n- The user has uploaded an image for visual analysis. Provide precise athletic feedback, fitness form/posture check, food/nutrition labels evaluation, or gym equipment coaching based on the image contents. Prioritize sports science metrics and encourage correct biomechanics.`;
    }

    // 3. Format the conversation history for the `@google/genai` SDK
    const contents = (history || []).map((msg: any) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text || "" }]
    }));

    // Ensure the latest user message is appended to the contents if not already there
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      const parts: any[] = [{ text: userMessageText }];
      if (imageBase64 && imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64
          }
        });
      }
      contents.push({
        role: 'user',
        parts: parts
      });
    } else {
      // If the latest message is already 'user', append image to it
      if (imageBase64 && imageMimeType) {
        const lastMsg = contents[contents.length - 1];
        lastMsg.parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64
          }
        });
      }
    }

    // 4. Generate content from the live Gemini 3.5 Flash model with resilient retry wrapper
    const aiInstance = getAiClient();
    const response = await generateContentWithRetry(aiInstance, {
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const text = response.text || "";
    res.json({ text });
  } catch (error: any) {
    console.log("[Fallback Activation] Handled transition to the local sports-science processing engine successfully:", error?.message || error);
    const { userMessageText, learnedMemories, hostName } = req.body;
    
    let athleteName = hostName || "Abdul Sami";
    let position = "All-Rounder (Cricket)";
    if (Array.isArray(learnedMemories)) {
      const nameMem = learnedMemories.find((m: string) => m.startsWith("Name:"));
      if (nameMem) athleteName = nameMem.replace("Name:", "").trim();
      const posMem = learnedMemories.find((m: string) => m.startsWith("Position:"));
      if (posMem) position = posMem.replace("Position:", "").trim();
    }
    
    const db = getDatabase();
    const fallbackText = generateHumanFallbackResponse(userMessageText || "", athleteName, position, [
      ...(learnedMemories || []),
      ...db.collectiveLearnings
    ]);
    res.json({ text: fallbackText });
  }
});

// POST endpoint to intelligently analyze and assess intake questionnaire steps
app.post("/api/assess-step", async (req, res) => {
  try {
    const { userMessageText, currentQuestion, stepIndex, archetype } = req.body;
    if (!userMessageText || !currentQuestion) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Quick local gibberish/keyboard mashing check first
    if (isGibberishOrIrrelevant(userMessageText)) {
      return res.json({
        isAnswer: false,
        isGibberish: true,
        replyText: `I'm not sure what you want to convey with that answer. Could you please clarify your message or answer the question so we can build the perfect routine for you?\n\n**Question ${stepIndex + 1}:** ${currentQuestion}`
      });
    }

    // 2. Call Gemini to analyze the user message using high-speed gemini-3.1-flash-lite
    const aiInstance = getAiClient();
    
    const systemPrompt = `You are a sports science intake coordinator assistant at Atlas.
We are currently in a high-performance athletic intake assessment for a **${archetype}** athlete.
The athlete is being asked:
**Question ${stepIndex + 1}:** ${currentQuestion}

The athlete's reply is:
"${userMessageText}"

Your task is to analyze if this reply is a valid/relevant response to the question, OR if it is an off-topic question, separate inquiry, comment (e.g. asking "who is cr7", asking about other sports, saying something random, or stating some other topic), or gibberish.

You must respond strictly in JSON format with the following fields:
{
  "isAnswer": true or false (set true if the reply directly or indirectly answers the question requested. For example, if asked for position, they say "Midfielder" or "goalkeeper" or "I am a winger". If asked for training days, they say "3 days" or "I have no time". If they answer the question, set true. If they ask a question like "who is cr7" or "what is creatine" or comment on something else, set false),
  "isGibberish": true or false (set true if it is keyboard mash, random nonsense like "jrefgdjk", "hyuyuyu", etc.),
  "replyText": "string"
}

Specific behavior for "replyText":
- If "isAnswer" is true: you can set "replyText" to "Got it! Answer logged to your athletic database."
- If "isAnswer" is false and "isGibberish" is true: set "replyText" to "I'm not sure what you want to convey with that answer. Could you please clarify your message or answer the question so we can build the perfect routine for you?\\n\\n**Question ${stepIndex + 1}:** ${currentQuestion}"
- If "isAnswer" is false and "isGibberish" is false (i.e. it is a valid question or comment like "tell me who is cr7", "can I train if I have knee pain?", "I love Messi" or "what is your name"):
  - You MUST answer their question or address their comment directly, in a highly knowledgeable, friendly, and motivational sports science expert tone.
  - After addressing their question/comment, append a friendly return-to-track transition and re-ask the intake question so they can answer it.
  Example structure: "That's a great question! [Answer the question comprehensively and accurately]. When you're ready, let's continue with your intake: [re-state the Question ${stepIndex + 1}]"

Make sure the JSON you output is valid and can be parsed.`;

    const response = await generateContentWithRetry(aiInstance, {
      model: "gemini-3.1-flash-lite",
      contents: [
        {
          role: "user",
          parts: [{ text: `Analyze this user reply in context: "${userMessageText}"` }]
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    let resultText = (response.text || "{}").trim();
    
    // Safely clean up any markdown code block wrap in case the model returns it
    if (resultText.startsWith("```json")) {
      resultText = resultText.substring(7);
    } else if (resultText.startsWith("```")) {
      resultText = resultText.substring(3);
    }
    if (resultText.endsWith("```")) {
      resultText = resultText.substring(0, resultText.length - 3);
    }
    resultText = resultText.trim();

    const parsed = JSON.parse(resultText);
    res.json(parsed);

  } catch (error: any) {
    console.error("Error in /api/assess-step:", error);
    // Secure fallback: if Gemini fails or returns malformed JSON, assume it's an answer to prevent blocking the user
    res.json({
      isAnswer: true,
      isGibberish: false,
      replyText: "Got it! Answer logged to your athletic database."
    });
  }
});

// GET endpoint for retrieving learnings
app.get("/api/learnings", (req, res) => {
  const db = getDatabase();
  res.json({ collectiveLearnings: db.collectiveLearnings });
});

// POST endpoint to register new learning manually
app.post("/api/learn", (req, res) => {
  const { learning } = req.body;
  if (learning && typeof learning === 'string') {
    const db = getDatabase();
    if (!db.collectiveLearnings.includes(learning)) {
      db.collectiveLearnings.push(learning);
      if (db.collectiveLearnings.length > 50) {
        db.collectiveLearnings.shift();
      }
      saveDatabase(db);
    }
    return res.json({ success: true, collectiveLearnings: db.collectiveLearnings });
  }
  res.status(400).json({ error: "learning string is required" });
});

// Setup Vite Dev Server / Static Files
async function setupVite() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
