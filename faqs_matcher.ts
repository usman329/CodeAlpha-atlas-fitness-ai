import { FAQS } from './faqs';

export function getSystemInstructionWithFAQs(message: string, selectedTrack?: string, learnedMemories?: string[]): string {
  const clean = (str: string) => 
    str.toLowerCase()
       .trim()
       .replace(/[?.,!/\\()'"-]/g, '')
       .replace(/\s+/g, ' ');

  const queryWords = clean(message || '').split(' ').filter(w => w.length > 2);
  
  // Dynamic relevant FAQ extraction for super-fast latency
  let relevantFaqs = FAQS;
  if (queryWords.length > 0) {
    const scoredFaqs = FAQS.map(faq => {
      const qClean = clean(faq.question);
      const aClean = clean(faq.answer);
      let score = 0;
      queryWords.forEach(word => {
        if (qClean.includes(word)) score += 3; // weight questions more
        if (aClean.includes(word)) score += 1;
      });
      return { faq, score };
    });
    
    // Sort and take top 5 most relevant FAQs to optimize prompt token size
    relevantFaqs = scoredFaqs
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.faq);
    
    // Fallback if no keyword matched, take some general ones
    if (relevantFaqs.length === 0) {
      relevantFaqs = FAQS.slice(0, 5);
    } else {
      relevantFaqs = relevantFaqs.slice(0, 5);
    }
  } else {
    relevantFaqs = FAQS.slice(0, 5);
  }

  const faqsText = relevantFaqs.map((faq, index) => `${index + 1}. Q: "${faq.question}"\n   A: "${faq.answer}"`).join('\n\n');
  
  const trackInstructions = selectedTrack ? `
Active Specialization Track: "${selectedTrack}"
- Tailor your tone, fitness plans, advice, and drills specifically to help the user excel in ${selectedTrack}.
- For example, if the track is Football, focus on agility, anaerobic endurance, and lower-body explosive power.
- If it is Cricket, focus on rotational power, shoulder preservation, and stamina.
- If it is Bodybuilding, focus on hypertrophy splits, recovery, and precise compound movements.
` : '';

  const memoryInstructions = learnedMemories && learnedMemories.length > 0 ? `
Personalized Adaptive Memory (Facts learned from the user's past messages or manual teachings):
${learnedMemories.map((m, i) => `- [Learned Fact #${i + 1}] ${m}`).join('\n')}
- You MUST adapt your recommendations based on these learned facts! (e.g., if a learned fact says the user has a knee injury, do NOT suggest squats or high-impact activities. If they prefer home workouts, tailor programs to bodyweight drills).
` : '';

  return `You are "Atlas Fitness AI Assistant" (also referred to as Atlas Fitness AI), a highly advanced, empathetic, and professional personal trainer, sports coach, and nutrition specialist.

YOUR SPECIAL CAPABILITIES:
1. You are powered by Gemini 3.5. You are an expert in sports science (including football, cricket, bodybuilding, athletic conditioning, weight loss, and senior longevity).
2. You can analyze exercise photos and videos! When the user shares an image or a video, congratulate them on their training consistency, provide highly precise bio-mechanical form analysis (e.g., knee tracking in squats, shoulder posture in bench presses, core stability in planks), and give actionable coaching pointers to prevent injury.
3. You dynamically learn from user conversation! Any preference, injury, target, or habit they express is permanently remembered to train and refine your coaching intelligence.

KNOWLEDGE BASE (100 Gym & Facilities FAQs):
Use the following official facts for specific questions regarding gym hours, membership prices, bookings, or on-site equipment:
${faqsText}

IMPORTANT DIRECTIVES:
- ANALYZE AND RESPOND DIRECTLY FIRST: You MUST read and thoroughly analyze every user message. Always prioritize answering the user's specific questions, ideas, or comments directly. Never ignore their input to ask a pre-scripted question.
- CONVERSATIONAL SPORT ASSESSMENT (ONE QUESTION AT A TIME): If the user mentions a sport, position, or athletic interest, congratulate and acknowledge them first, then analyze their message. Instead of giving them a full generic program right away, ask if they would like to share more details to help customize their plans. If they agree, ask ONLY ONE friendly diagnostic question at a time (e.g., first ask about their primary athletic goals; after they reply, acknowledge and analyze their answer, then ask about injury status, then training frequency, then diet). Never list all questions at once or ask a second question without thoroughly responding to and analyzing their previous answer.
- GIBBERISH AND IRRELEVANT INPUT HANDLING: If the user inputs gibberish (e.g., "jrefgdjk", random letters, random typing sequences, or completely irrelevant and off-topic statements), you MUST recognize it immediately. Do not attempt to fit it into fitness advice or ask sports questions about it. Instead, politely ask them what they want to convey (e.g., "I'm not sure what you want to convey. Could you please clarify your question? I'm here to help you with any fitness, gym, or sports science queries!").
- RESPOND TO IRRELEVANT COOLDOWNS: If they answer one of your diagnostic questions with irrelevant, gibberish, or off-topic text, stop the diagnostic flow, call it out politely, and ask what they would like to convey.
- STICK TO FACILITIES FAQS: If a user asks about gym hours, fees, registration, lockers, towels, pool, or physical therapy, you MUST stick 100% to the official facts in the KNOWLEDGE BASE.
- Speak in a motivating, supportive, and energetic tone. Use markdown formatting, bullet points, and bold text to make your guides highly readable.
${trackInstructions}
${memoryInstructions}
`;
}

/**
 * Perform a direct local match for instant, perfect response.
 * Uses advanced normalization, substring matching, and keyword-overlap scoring.
 */
export function findLocalFAQMatch(userQuery: string): string | null {
  const clean = (str: string) => 
    str.toLowerCase()
       .trim()
       .replace(/[?.,!/\\()'"-]/g, '')
       .replace(/\s+/g, ' ');

  const normalizedQuery = clean(userQuery);
  if (!normalizedQuery) return null;

  // 1. Direct match & full substring containment
  for (const faq of FAQS) {
    const normalizedQuestion = clean(faq.question);
    
    // Exact match or mutual substring containment
    if (normalizedQuery === normalizedQuestion || 
        normalizedQuery.includes(normalizedQuestion) || 
        normalizedQuestion.includes(normalizedQuery)) {
      return faq.answer;
    }
  }

  // 2. Token-based overlap similarity to handle slight phrasing variations
  const stopWords = new Set([
    'is', 'a', 'the', 'are', 'do', 'you', 'to', 'for', 'your', 'what', 'how', 
    'can', 'i', 'of', 'at', 'on', 'in', 'with', 'any', 'anytime', 'there', 
    'have', 'offer', 'accept', 'we', 'me', 'please', 'tell', 'about'
  ]);

  const getSignificantTokens = (str: string) => 
    clean(str)
      .split(' ')
      .filter(word => word.length > 1 && !stopWords.has(word));

  const queryTokens = getSignificantTokens(userQuery);
  
  if (queryTokens.length > 0) {
    let bestMatch: { answer: string; score: number } | null = null;

    for (const faq of FAQS) {
      const questionTokens = getSignificantTokens(faq.question);
      if (questionTokens.length === 0) continue;

      // Calculate intersection and union size
      const intersection = queryTokens.filter(t => questionTokens.includes(t));
      
      if (intersection.length > 0) {
        // Jaccard-like score based on matching important keyword tokens
        const score = intersection.length / Math.max(queryTokens.length, questionTokens.length);

        // A high overlap score (e.g., >= 0.5) indicates highly likely match
        if (score >= 0.5) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { answer: faq.answer, score };
          }
        }
      }
    }

    if (bestMatch) {
      return bestMatch.answer;
    }
  }

  return null;
}
