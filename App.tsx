import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Settings, 
  Send, 
  Menu, 
  X, 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  Award, 
  User,
  Paperclip,
  Linkedin,
  Mail,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  FileText,
  Image,
  HardDrive,
  HelpCircle,
  Dribbble,
  Waves,
  Zap,
  Target,
  UserCheck
} from 'lucide-react';
import { FAQS, FAQItem } from './data/faqs';
import { findLocalFAQMatch } from './data/faqs_matcher';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  imageUrl?: string;
}

interface ChatSession {
  id: string;
  title: string;
  systemInstruction: string;
  history: Message[];
  selectedTrack: string;
}

interface QuestionnaireState {
  archetype: string;
  step: number;
  questions: string[];
  answers: string[];
}

const isGibberishOrIrrelevant = (text: string): boolean => {
  const query = (text || "").toLowerCase().trim();
  if (!query) return false;
  
  // 1. Check for standard gibberish characters (long words without vowels)
  const words = query.split(/\s+/);
  for (const word of words) {
    if (word.length >= 4) {
      const hasVowels = /[aeiouy]/.test(word);
      if (!hasVowels) return true;
      // Check for keyboard rolls / mashings, e.g., "asdf", "hjkl", "dfgh", "zxcv", "qwer", "jrefgdjk"
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
};

const formatInlineMarkdown = (text: string) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-extrabold text-amber-500">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const renderMessageText = (text: string) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  
  let currentTableRows: string[][] = [];
  
  const flushTable = (key: string | number) => {
    if (currentTableRows.length === 0) return;
    
    // Check if the first or second row is a separator row e.g. | :--- | ---: |
    let headerRow: string[] | null = null;
    let dataRows: string[][] = [];
    
    if (currentTableRows.length > 1) {
      const secondRowJoined = currentTableRows[1].join('');
      const isSeparator = /^[:\s-|]+$/.test(secondRowJoined) && secondRowJoined.includes('-');
      if (isSeparator) {
        headerRow = currentTableRows[0];
        dataRows = currentTableRows.slice(2);
      } else {
        // Check if first row itself is separator
        const firstRowJoined = currentTableRows[0].join('');
        const isFirstSeparator = /^[:\s-|]+$/.test(firstRowJoined) && firstRowJoined.includes('-');
        if (isFirstSeparator) {
          dataRows = currentTableRows.slice(1);
        } else {
          headerRow = currentTableRows[0];
          dataRows = currentTableRows.slice(1);
        }
      }
    } else {
      dataRows = currentTableRows;
    }
    
    renderedElements.push(
      <div key={`table-${key}`} className="my-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {headerRow && (
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  {headerRow.map((cell, cellIdx) => (
                    <th key={cellIdx} className="p-3.5 font-extrabold text-amber-500 tracking-wider whitespace-nowrap">
                      {formatInlineMarkdown(cell.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
              {dataRows.map((row, rowIdx) => (
                <tr 
                  key={rowIdx} 
                  className={`transition-all duration-150 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 ${
                    rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-slate-900/20'
                  }`}
                >
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="p-3.5 text-slate-700 dark:text-slate-300 align-middle">
                      {formatInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
    
    currentTableRows = [];
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Is it a table row?
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim());
      // Remove first and last empty elements from outer split pipes
      if (line.startsWith('|')) cells.shift();
      if (line.endsWith('|')) cells.pop();
      
      currentTableRows.push(cells);
    } else {
      // Non-table line. Flush any accumulated table first.
      if (currentTableRows.length > 0) {
        flushTable(i);
      }
      
      if (trimmed.startsWith('### ')) {
        renderedElements.push(
          <h3 key={i} className="text-sm font-bold text-amber-500 mt-3 mb-1.5">
            {formatInlineMarkdown(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith('## ')) {
        renderedElements.push(
          <h2 key={i} className="text-base font-extrabold text-amber-500 mt-4 mb-2">
            {formatInlineMarkdown(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        renderedElements.push(
          <div key={i} className="flex gap-2 pl-2 my-1">
            <span className="text-amber-500 select-none font-bold">•</span>
            <span className="flex-1">{formatInlineMarkdown(trimmed.substring(2))}</span>
          </div>
        );
      } else {
        const numListMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numListMatch) {
          renderedElements.push(
            <div key={i} className="flex gap-2 pl-2 my-1">
              <span className="text-amber-500 select-none font-bold">{numListMatch[1]}.</span>
              <span className="flex-1">{formatInlineMarkdown(numListMatch[2])}</span>
            </div>
          );
        } else if (trimmed === '') {
          renderedElements.push(<div key={i} className="h-2" />);
        } else {
          renderedElements.push(
            <p key={i} className="leading-relaxed my-1.5">
              {formatInlineMarkdown(line)}
            </p>
          );
        }
      }
    }
  }
  
  // Flush any remaining table at the end of content
  if (currentTableRows.length > 0) {
    flushTable('end');
  }
  
  return (
    <div className="space-y-1">
      {renderedElements}
    </div>
  );
};

export default function App() {
  // Session & Global State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<QuestionnaireState | null>(null);
  
  // Navigation & UI States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFAQOpen, setIsFAQOpen] = useState(false); // Right side slideable FAQ Panel
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [selectedImageMimeType, setSelectedImageMimeType] = useState<string | null>(null);
  const [expandedFAQCategory, setExpandedFAQCategory] = useState<string | null>(null);

  // Multi-user & Local Storage Name Onboarding State
  const [hostName, setHostName] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingInput, setOnboardingInput] = useState<string>('');

  // Collective Learning Database (Fetched from backend server-wide storage updates)
  const [learnedDatabase, setLearnedDatabase] = useState<string[]>([]);

  // User Profile State
  const [userProfileMemory, setUserProfileMemory] = useState({
    name: 'Abdul Sami',
    email: 'abdulsami6550@gmail.com',
    linkedin: 'https://www.linkedin.com',
    footballPosition: 'Not specified yet'
  });

  // Init & Onboarding Checks
  useEffect(() => {
    // 1. Identify User / Host Check
    const storedHost = localStorage.getItem('atlas_host_name');
    if (!storedHost) {
      setShowOnboarding(true);
    } else {
      setHostName(storedHost);
      setUserProfileMemory(prev => ({ ...prev, name: storedHost }));
    }

    // 2. Fetch or Init Sessions
    const savedSessions = localStorage.getItem('atlas_sessions');
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) setActiveSessionId(parsed[0].id);
    } else {
      handleCreateNewSession('General', storedHost || 'Abdul Sami');
    }

    // 3. Load learned behaviors database from server-side database
    const fetchLearnedBehaviors = async () => {
      try {
        const res = await fetch('/api/learnings');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.collectiveLearnings)) {
            setLearnedDatabase(data.collectiveLearnings);
          }
        } else {
          // Local fallback
          const savedDatabase = localStorage.getItem('atlas_learned_db');
          if (savedDatabase) {
            setLearnedDatabase(JSON.parse(savedDatabase));
          } else {
            const defaultKnowledge = ["Prefers direct athletic breakdowns", "Consistently targets endurance limits"];
            setLearnedDatabase(defaultKnowledge);
          }
        }
      } catch (err) {
        console.warn("Could not reach backend learnings API - using offline knowledge:", err);
        const savedDatabase = localStorage.getItem('atlas_learned_db');
        if (savedDatabase) {
          setLearnedDatabase(JSON.parse(savedDatabase));
        } else {
          setLearnedDatabase(["Prefers direct athletic breakdowns", "Consistently targets endurance limits"]);
        }
      }
    };
    
    fetchLearnedBehaviors();
  }, []);

  // Sync state helpers
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('atlas_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const saveHostName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('atlas_host_name', trimmed);
    setHostName(trimmed);
    setUserProfileMemory(prev => ({ ...prev, name: trimmed }));
    setShowOnboarding(false);
    
    // Refresh/Create the welcome session with their unique registered host name
    handleCreateNewSession('General', trimmed);
  };

  const handleCreateNewSession = (trackName: string = 'General', currentHost: string = hostName) => {
    const activeHost = currentHost || 'Athlete';
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: `${trackName} Track Session`,
      systemInstruction: `Core Persona: Atlas Sports Science Model. Active Athlete/Host: ${activeHost}. Priority Contact: abdulsami6550@gmail.com. Collective Learnings: ${learnedDatabase.join(', ')}`,
      history: [
        {
          id: 'welcome',
          role: 'model',
          text: `Hello ${activeHost}! Welcome back to Atlas. How can I optimize your ${trackName} track goals today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      selectedTrack: trackName
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  // Sport Archetype Interactive Questionnaire Data
  const ARCHETYPE_QUESTIONS: { [key: string]: string[] } = {
    Footballer: [
      "What is your primary **playing position** on the field? (e.g., Winger, Striker, Midfielder, Defender)",
      "How many **days a week** can you train, and what is your current **sprint speed** or **stamina bottleneck**?",
      "Do you have any **physical safety precautions**, joint tightness, or **previous injuries** we must account for?"
    ],
    Swimmer: [
      "What **stroke or event style** do you primarily focus on? (e.g., Freestyle, Breaststroke, Butterfly, Backstroke)",
      "What is your current **weekly swimming distance** or general **stamina goal**?",
      "Do you experience any **shoulder stiffness** or other joint discomfort, and what is your **dryland gym experience**?"
    ],
    Cricketer: [
      "What is your primary **playing role** on the team? (e.g., Fast Bowler, Spin Bowler, Batsman, All-Rounder, Wicketkeeper)",
      "Which aspect of your performance do you want to **elevate most**? (e.g., core swing rotation, arm speed, field sprint acceleration)",
      "Do you have any **active physical symptoms**, lower back tightness, or **physical safety precautions**?"
    ],
    Bodybuilder: [
      "What is your current **lifting experience level** and preferred **weekly split**? (e.g., PPL, Upper/Lower, Full Body)",
      "What is your main **muscle development focus** and current **nutrition stance**? (e.g., prioritizing chest/back, bulk, cut, or recomposition)",
      "How are your general **recovery indicators** (sleep hours, joint soreness, current recovery protocols)?"
    ],
    Runner: [
      "What is your current **personal record (PR)** or comfort-level pace? (e.g., 5K in 25 mins, 10K in 60 mins)",
      "How many **miles per week** do you run, and what is your specific **time or distance goal**?",
      "Do you have any **runner-specific pain points**? (e.g., shin splints, knee strain, arch/ankle stiffness)"
    ],
    Powerlifter: [
      "What are your current (or estimated) **1-Rep Max lifts** for Squat, Bench Press, and Deadlift?",
      "Where is your primary **weak point** during the lifts? (e.g., off-the-floor in deadlift, off-the-chest in bench, bottom of squat)",
      "Are you preparing for an **upcoming powerlifting meet**, and do you have any back, spine, or **knee safety considerations**?"
    ]
  };

  // Sport Archetype Click Handlers - Initiates Interactive Assessment Flow
  const handleSelectSportArchetype = (sport: string) => {
    const questions = ARCHETYPE_QUESTIONS[sport] || [];
    if (questions.length === 0) return;

    setActiveQuestionnaire({
      archetype: sport,
      step: 0,
      questions,
      answers: []
    });

    const currentHost = hostName || userProfileMemory.name || 'Athlete';
    const startText = `Welcome to your custom **${sport}** athletic assessment, ${currentHost}! 

To engineer your elite routine, I am going to ask you 3 quick questions one-by-one to learn about your goals and physiological profile.

**Question 1:** ${questions[0]}`;

    // Find or use the active session, or create a new session
    let currentSession = sessions.find(s => s.id === activeSessionId);
    const newSessionTitle = `${sport} Assessment`;

    if (currentSession && (currentSession.history.length <= 1 || currentSession.title.includes('Track Session') || currentSession.title.includes('General'))) {
      // Modify active session to host this assessment
      const welcomeMsg: Message = {
        id: `assessment-start-${Date.now()}`,
        role: 'model',
        text: startText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            title: newSessionTitle,
            history: [...s.history, welcomeMsg]
          };
        }
        return s;
      }));
    } else {
      // Create a fresh session
      const newSessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: newSessionId,
        title: newSessionTitle,
        systemInstruction: `Core Persona: Atlas Sports Science Model. Active Athlete/Host: ${currentHost}. Dynamic Archetype: ${sport}.`,
        history: [
          {
            id: `assessment-start-${Date.now()}`,
            role: 'model',
            text: startText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
         ],
         selectedTrack: 'General'
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSessionId);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || isLoading) return;

    const userMessageText = inputText;
    const attachedLabel = selectedFile ? `[File: ${selectedFile}] ` : '';
    const imageBase64 = selectedImageBase64;
    const imageMimeType = selectedImageMimeType;
    const imagePreview = selectedImagePreview;

    setInputText('');
    setSelectedFile(null);
    setSelectedImagePreview(null);
    setSelectedImageBase64(null);
    setSelectedImageMimeType(null);
    setIsAttachmentOpen(false);

    const currentTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: attachedLabel + userMessageText,
      timestamp: currentTimestamp,
      imageUrl: imagePreview || undefined
    };

    let currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    const updatedHistory = [...currentSession.history, userMsg];
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) return { ...s, history: updatedHistory };
      return s;
    }));

    setIsLoading(true);

    // -- INTERCEPT IF ACTIVE QUESTIONNAIRE FLOW IS RUNNING --
    if (activeQuestionnaire && !attachedLabel) {
      try {
        const response = await fetch('/api/assess-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessageText,
            currentQuestion: activeQuestionnaire.questions[activeQuestionnaire.step],
            stepIndex: activeQuestionnaire.step,
            archetype: activeQuestionnaire.archetype
          })
        });

        if (!response.ok) {
          throw new Error('Failed to evaluate assessment step');
        }

        const assessment = await response.json();

        if (assessment.isAnswer) {
          const updatedAnswers = [...activeQuestionnaire.answers, userMessageText];
          const nextStep = activeQuestionnaire.step + 1;

          // Dynamically post a manual learning statement so our database registers it!
          try {
            const currentQuestionText = activeQuestionnaire.questions[activeQuestionnaire.step];
            const learningStatement = `Athlete ${hostName || userProfileMemory.name} (${activeQuestionnaire.archetype}): Answered "${userMessageText}" to "${currentQuestionText}"`;
            fetch('/api/learn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ learning: learningStatement })
            });
          } catch (err) {
            console.warn("Could not submit learning manually during question:", err);
          }

          if (nextStep < activeQuestionnaire.questions.length) {
            // Prepare next question
            const nextQuestionText = activeQuestionnaire.questions[nextStep];
            const modelMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: `${assessment.replyText || 'Got it! Answer logged.'}\n\n**Question ${nextStep + 1}:** ${nextQuestionText}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setSessions(prev => prev.map(s => {
              if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
              return s;
            }));

            setActiveQuestionnaire({
              ...activeQuestionnaire,
              step: nextStep,
              answers: updatedAnswers
            });
            setIsLoading(false);
          } else {
            // Complete the questionnaire! Send dynamic synthesis to Gemini AI
            const archetype = activeQuestionnaire.archetype;
            const q1 = activeQuestionnaire.questions[0];
            const a1 = updatedAnswers[0];
            const q2 = activeQuestionnaire.questions[1];
            const a2 = updatedAnswers[1];
            const q3 = activeQuestionnaire.questions[2];
            const a3 = updatedAnswers[2];

            const finalPrompt = `I have completed the interactive intake assessment for the **${archetype}** profile.
Here is my structured data that you must analyze, register, and use to synthesize a customized high-performance plan:

1. **${q1}**: "${a1}"
2. **${q2}**: "${a2}"
3. **${q3}**: "${a3}"

Please formulate:
- A customized high-performance training routine tailored to my role/experience, training availability, and physiological pain points.
- Highlight 3 specific athletic tips based on my replies.
- Use clean, modern sports-science structure. Add recovery guidelines.`;

            try {
              const responseChat = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userMessageText: finalPrompt,
                  history: updatedHistory,
                  selectedTrack: currentSession.selectedTrack,
                  learnedMemories: [
                    `Name: ${hostName || userProfileMemory.name}`,
                    `Email: ${userProfileMemory.email}`,
                    `Role: ${a1}`,
                    `Training: ${a2}`,
                    `Bottlenecks: ${a3}`,
                    `Selected Archetype: ${archetype}`
                  ],
                  hostName: hostName || userProfileMemory.name
                })
              });

              if (!responseChat.ok) {
                throw new Error(`Server status error: ${responseChat.status}`);
              }

              const data = await responseChat.json();
              if (!data || !data.text) {
                throw new Error("Invalid payload from chat server");
              }

              // Register final learned items
              try {
                const finalLearningStr = `Athlete ${hostName || userProfileMemory.name} completed ${archetype} profile: Position: ${a1}, Schedule: ${a2}, Constraints: ${a3}`;
                await fetch('/api/learn', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ learning: finalLearningStr })
                });

                // Refresh learnedDatabase
                const learnRes = await fetch('/api/learnings');
                if (learnRes.ok) {
                  const learnData = await learnRes.json();
                  if (learnData && Array.isArray(learnData.collectiveLearnings)) {
                    setLearnedDatabase(learnData.collectiveLearnings);
                  }
                }
              } catch (err) {
                console.warn("Could not register final learnings:", err);
              }

              // Update local profile memory if Footballer
              if (archetype === 'Footballer') {
                const updatedMemory = { ...userProfileMemory, footballPosition: a1 };
                setUserProfileMemory(updatedMemory);
                localStorage.setItem('atlas_profile_memory', JSON.stringify(updatedMemory));
              }

              const modelMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: data.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };

              setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
                return s;
              }));

            } catch (error) {
              console.warn("Assessment generation error - fallback to offline renderer:", error);
              const offlineText = `[Offline Mode: Dynamic local model rendering custom ${archetype} routine]

### 🏆 Your Customized ${archetype} Athlete Profile Setup
- **Main Role**: ${a1}
- **Availability & Capacity**: ${a2}
- **Bottlenecks/Precaution**: ${a3}

---

### 📅 Your Custom Training Routine
1. **Dynamic Activation (10 mins)**: High-knee skips, dynamic hamstring sweeps, and deep lateral squats to guard against "${a3}".
2. **Explosive Block (20 mins)**: Match-specific intervals, power outputs, or force-generation movements depending on your role.
3. **Primary Strength Split**: Dedicate your available sessions (${a2}) to mechanical loading under strict control.
4. **Resilience & Mobility**: Complete with specific joint mobilizations matching your precautions.

*Your metrics have been cached in your local profile database!*`;

              const modelMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: offlineText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };

              setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
                return s;
              }));
            } finally {
              setActiveQuestionnaire(null);
              setIsLoading(false);
            }
          }
        } else {
          // If the reply is off-topic, gibberish or an inline question, show the model answer
          // but do NOT advance the current question/step.
          const modelMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: assessment.replyText || "I'm not sure what you want to convey. Could you please clarify your question?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
            return s;
          }));
          setIsLoading(false);
        }

      } catch (err) {
        console.warn("Assessment evaluator error - direct answer logging fallback:", err);
        // Fallback: stay on current step to prevent skipping when there is a glitch, ask to try again
        const currentQuestionText = activeQuestionnaire.questions[activeQuestionnaire.step];
        const modelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `I experienced a brief connection glitch. Let's make sure we capture your answer correctly so we can build the perfect routine for you. Could you please re-submit or clarify?

**Question ${activeQuestionnaire.step + 1}:** ${currentQuestionText}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
          return s;
        }));
        setIsLoading(false);
      }
      return;
    }

    // 0. Gibberish and Irrelevant input check
    if (isGibberishOrIrrelevant(userMessageText) && !attachedLabel) {
      setTimeout(() => {
        const modelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `I'm not sure what you want to convey. Could you please clarify your message? I am here to help you with your athletic training, custom workout planning, or gym facility questions!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
          return s;
        }));
        setIsLoading(false);
      }, 600);
      return;
    }

    // 1. Direct Local FAQ Engine Check
    const localMatch = findLocalFAQMatch(userMessageText);
    if (localMatch && !attachedLabel) {
      setTimeout(() => {
        const modelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: localMatch,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
          return s;
        }));
        setIsLoading(false);
      }, 600);
      return;
    }

    // 2. Real server-side dynamic call to proxy model (synced with db/collective learnings)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userMessageText: attachedLabel + userMessageText,
          history: currentSession.history,
          selectedTrack: currentSession.selectedTrack,
          learnedMemories: [
            `Name: ${hostName || userProfileMemory.name}`,
            `Email: ${userProfileMemory.email}`,
            `Position: ${userProfileMemory.footballPosition}`
          ],
          hostName: hostName || userProfileMemory.name,
          imageBase64: imageBase64,
          imageMimeType: imageMimeType
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error status: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.text) {
        throw new Error("Invalid response payload from the server");
      }

      // Automatically sync latest collective learnings from the database in the UI state
      try {
        const learnRes = await fetch('/api/learnings');
        if (learnRes.ok) {
          const learnData = await learnRes.json();
          if (learnData && Array.isArray(learnData.collectiveLearnings)) {
            setLearnedDatabase(learnData.collectiveLearnings);
          }
        }
      } catch (err) {
        console.warn("Could not sync server database learnings:", err);
      }

      // Parse and register positions locally if updated
      const lower = userMessageText.toLowerCase();
      if (lower.includes('football') || lower.includes('position') || lower.includes('winger') || lower.includes('striker') || lower.includes('midfielder')) {
        const updatedMemory = { ...userProfileMemory, footballPosition: userMessageText };
        setUserProfileMemory(updatedMemory);
        localStorage.setItem('atlas_profile_memory', JSON.stringify(updatedMemory));
      }

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
        return s;
      }));

    } catch (error) {
      console.warn("Server API Error - Switching to robust local offline fallback:", error);
      
      const memoriesList = [
        `Name: ${hostName || userProfileMemory.name}`,
        `Email: ${userProfileMemory.email}`,
        `Position: ${userProfileMemory.footballPosition}`
      ];
      
      let athleteName = hostName || "Abdul Sami";
      let position = userProfileMemory.footballPosition;
      
      const offlineReply = `[System Local Cache Modality: API experiencing high server demand. Local offline model active for host ${athleteName}.]\n\nYour inputs have been queued locally: "${userMessageText}". I will keep analyzing your profile stats dynamically using our offline dataset parameters!`;
      
      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: offlineReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) return { ...s, history: [...updatedHistory, modelMsg] };
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file.name);
    setIsAttachmentOpen(false);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setSelectedImagePreview(result);
        
        // Extract raw base64 string
        const base64Parts = result.split(',');
        if (base64Parts.length > 1) {
          setSelectedImageBase64(base64Parts[1]);
        }
        setSelectedImageMimeType(file.type);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImagePreview(null);
      setSelectedImageBase64(null);
      setSelectedImageMimeType(null);
    }
  };

  const handleAttachmentClick = (type: string) => {
    if (type === 'LocalImage') {
      document.getElementById('image-upload-input')?.click();
    } else if (type === 'LocalDoc') {
      document.getElementById('file-upload-input')?.click();
    } else {
      // Simulate Google Drive connector nicely with dynamic names
      setSelectedFile(`google_drive_athletic_log_${Math.floor(Math.random() * 9000) + 1000}.json`);
      setSelectedImagePreview(null);
      setSelectedImageBase64(null);
      setSelectedImageMimeType(null);
      setIsAttachmentOpen(false);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id && filtered.length > 0) {
      setActiveSessionId(filtered[0].id);
    } else if (filtered.length === 0) {
      localStorage.removeItem('atlas_sessions');
      handleCreateNewSession('General');
    }
  };

  const handleResetAllData = () => {
    localStorage.removeItem('atlas_sessions');
    localStorage.removeItem('atlas_profile_memory');
    localStorage.removeItem('atlas_host_name');
    localStorage.removeItem('atlas_learned_db');
    setSessions([]);
    setHostName('');
    setUserProfileMemory({
      name: 'Abdul Sami',
      email: 'abdulsami6550@gmail.com',
      linkedin: 'https://www.linkedin.com',
      footballPosition: 'Not specified yet'
    });
    setIsSettingsOpen(false);
    setShowOnboarding(true);
  };

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const faqCategories: { [key: string]: FAQItem[] } = {};
  FAQS.forEach(faq => {
    if (!faqCategories[faq.category]) {
      faqCategories[faq.category] = [];
    }
    faqCategories[faq.category].push(faq);
  });

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Onboarding Overlay Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-500">
              <UserCheck className="w-6 h-6"/>
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">Identify Profile Host</h2>
            <p className="text-xs text-slate-400">
              Welcome to Atlas Sports Science Engine. Please enter your name below to register as the primary dashboard host.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); saveHostName(onboardingInput); }} className="space-y-3">
              <input 
                type="text" 
                required
                id="hostNameInput"
                value={onboardingInput}
                onChange={(e) => setOnboardingInput(e.target.value)}
                placeholder="Enter host name (e.g., Abdul Sami)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition-all text-center"
              />
              <button 
                type="submit"
                id="submitOnboardingBtn"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg cursor-pointer"
              >
                Access Athletic Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Left Navigation Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-80 border-r flex flex-col z-30 transition-transform duration-300 md:static md:translate-x-0 ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500 fill-amber-500/20"/>
            <h1 className="font-bold text-md tracking-tight">Atlas Fitness AI</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-red-500 cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="p-3">
          <button 
            id="newConsultationBtn"
            onClick={() => handleCreateNewSession('General')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4"/> New Consultation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 custom-scroll">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Focus Tracks</div>
          {['General', 'Weight Loss', 'Muscle Gain', 'Cardio Endurance'].map((track) => (
            <button
              key={track}
              onClick={() => { handleCreateNewSession(track); setIsSidebarOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-amber-500 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-500/70"/> {track} Track
            </button>
          ))}

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mt-4 mb-2">Consultation Logs</div>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
              className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                s.id === activeSessionId 
                  ? (isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-200 border border-slate-300') 
                  : (isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-200/50')
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden pr-6">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0"/>
                <span className="text-xs font-medium truncate">{s.title}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="absolute right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
        </div>

        {/* Footer Section with Clickable Email and Profile Details */}
        <div className={`p-4 border-t flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center font-bold text-xs text-amber-500 uppercase">
              {hostName ? hostName.substring(0, 2) : "AS"}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold truncate">Host: {hostName || "Abdul Sami"}</div>
              <a 
                href={`mailto:${userProfileMemory.email}`}
                className="text-[10px] text-slate-400 hover:text-amber-500 transition-all flex items-center gap-1 truncate font-medium cursor-pointer"
                title="Click to send email"
              >
                <Mail className="w-2.5 h-2.5 shrink-0"/> {userProfileMemory.email}
              </a>
            </div>
          </div>
          
          <div className={`flex items-center justify-between border-t pt-2 text-xs ${
            isDarkMode ? 'border-slate-800/50' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <a 
                href={userProfileMemory.linkedin} 
                target="_blank" 
                rel="noreferrer" 
                className={`p-1.5 rounded-lg border transition-all ${
                  isDarkMode ? 'border-slate-800 hover:border-blue-500 hover:text-blue-400 bg-slate-900' : 'border-slate-300 hover:border-blue-500 hover:text-blue-600 bg-white text-slate-700 shadow-sm'
                }`} 
                title="LinkedIn"
              >
                <Linkedin className="w-3.5 h-3.5"/>
              </a>
              <button 
                onClick={() => setIsSettingsOpen(true)} 
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isDarkMode ? 'border-slate-800 hover:border-slate-600 bg-slate-900' : 'border-slate-300 hover:border-slate-500 bg-white text-slate-700 shadow-sm'
                }`} 
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5"/>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                isDarkMode 
                  ? 'bg-slate-950 border-slate-800 hover:border-amber-500/50 text-slate-400 hover:text-amber-500 hover:bg-slate-900' 
                  : 'bg-white border-slate-200 hover:border-amber-500/50 text-slate-600 hover:text-amber-600 hover:bg-slate-50 shadow-sm'
              }`}
              title="Manage Local Auth / Profile Credentials"
            >
              🔑 Local Auth
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Frame */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Dynamic Header Frame containing Theme Toggles & Right Panels Toggles */}
        <header className={`h-16 border-b flex items-center justify-between px-4 z-10 shrink-0 ${isDarkMode ? 'bg-slate-950/40 border-slate-900' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className={`p-2 border rounded-xl md:hidden transition-all cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-white bg-slate-900 border-slate-800' : 'text-slate-600 hover:text-slate-900 bg-white border-slate-200'
              }`}
            >
              <Menu className="w-4 h-4"/>
            </button>
            <div className="text-xs font-bold text-slate-400">
              Active Focus Track: <span className="text-amber-500 font-extrabold">{currentSession?.selectedTrack || 'General'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Header Theme Toggler */}
            <button 
              id="themeToggleBtn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-amber-500' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-amber-600'
              }`}
              title="Toggle Layout Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4 text-slate-700"/>}
              <span className="text-[10px] font-bold hidden sm:inline">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>

            {/* Right Slideable FAQ Panel Toggle Button */}
            <button 
              id="faqToggleBtn"
              onClick={() => setIsFAQOpen(!isFAQOpen)}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                isFAQOpen 
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' 
                  : (isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600')
              }`}
              title="Open FAQ Panel"
            >
              <HelpCircle className="w-4 h-4"/>
              <span className="text-[10px] font-bold hidden sm:inline">Support FAQs</span>
            </button>
          </div>
        </header>

        {/* Chat History and Archetypes Zone */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scroll">
          
          {/* Quick Start Athlete Cards (Appears only on freshly initiated tracks / empty histories) */}
          {(!currentSession?.history || currentSession.history.length <= 1) && (
            <div className="max-w-3xl mx-auto space-y-4 pt-4">
              <div className="text-center space-y-1">
                <h3 className={`text-sm font-bold flex items-center justify-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  <Sparkles className="w-4 h-4 text-amber-500"/> Select Sport Archetype Goal
                </h3>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Click a card below to launch an optimized, customized consultation flow directly:</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Footballer", desc: "Sprints, power & field durability", icon: <Dribbble className="w-4 h-4 text-blue-400"/> },
                  { label: "Swimmer", desc: "VO2 max & endurance stamina", icon: <Waves className="w-4 h-4 text-cyan-400"/> },
                  { label: "Cricketer", desc: "Power stroke & core stability", icon: <Target className="w-4 h-4 text-emerald-400"/> },
                  { label: "Bodybuilder", desc: "Hypertrophy splits & recovery", icon: <Zap className="w-4 h-4 text-amber-500"/> },
                  { label: "Runner", desc: "Sub-20 pace blocks & splits", icon: <Award className="w-4 h-4 text-rose-400"/> },
                  { label: "Powerlifter", desc: "Max squat, bench & deadlift", icon: <Sliders className="w-4 h-4 text-violet-400"/> }
                ].map((sport) => (
                  <button
                    key={sport.label}
                    onClick={() => handleSelectSportArchetype(sport.label)}
                    className={`p-3 text-left border rounded-xl hover:border-amber-500/50 transition-all flex flex-col justify-between cursor-pointer space-y-1.5 ${
                      isDarkMode 
                        ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {sport.icon}
                      <span className="text-xs font-bold">{sport.label}</span>
                    </div>
                    <span className={`text-[10px] leading-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sport.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentSession?.history.map((msg) => (
            <div key={msg.id} className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                msg.role === 'user' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
              </div>
              <div className={`rounded-2xl p-4 shadow-xl border text-xs leading-relaxed ${
                isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {msg.imageUrl && (
                  <div className="mb-2.5 max-w-sm rounded-lg overflow-hidden border border-amber-500/20 shadow-md">
                    <img 
                      src={msg.imageUrl} 
                      alt="Uploaded Context" 
                      className="max-h-64 rounded object-contain bg-slate-950/40 w-full" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                {renderMessageText(msg.text)}
                <div className="text-[9px] text-slate-400 mt-2 text-right">{msg.timestamp}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 max-w-3xl">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Sparkles className="w-4 h-4 animate-spin"/>
              </div>
              <div className={`rounded-2xl p-4 border flex items-center gap-3 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <span className="text-xs text-slate-400 font-medium">Atlas updating weights & parsing parameters</span>
                <div className="flex items-center gap-1 px-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Text Entry Box */}
        <footer className={`p-4 border-t shrink-0 ${isDarkMode ? 'bg-slate-950/80 border-slate-900' : 'bg-white border-slate-200'}`}>
          <div className="max-w-3xl mx-auto space-y-3">
            
            {selectedFile && (
              <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs animate-fade-in">
                <div className="flex items-center gap-2 truncate">
                  {selectedImagePreview ? (
                    <img 
                      src={selectedImagePreview} 
                      alt="Thumbnail preview" 
                      className="w-8 h-8 rounded object-cover border border-blue-500/30"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0"/>
                  )}
                  <span className="truncate font-medium">{selectedFile} ready for analysis</span>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setSelectedImagePreview(null);
                    setSelectedImageBase64(null);
                    setSelectedImageMimeType(null);
                  }} 
                  className="text-slate-400 hover:text-white p-1 cursor-pointer hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4"/>
                </button>
              </div>
            )}

            {/* Hidden Real Local File Inputs */}
            <input 
              type="file" 
              id="image-upload-input" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <input 
              type="file" 
              id="file-upload-input" 
              accept=".txt,.csv,.json,.pdf,.doc,.docx"
              className="hidden" 
              onChange={handleFileChange} 
            />

            <form onSubmit={handleSendMessage} className="flex gap-2 relative">
              <div className="relative flex items-center">
                <button 
                  type="button"
                  id="attachmentBtn"
                  onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600'
                  }`}
                  title="Attachments"
                >
                  <Paperclip className="w-4 h-4"/>
                </button>

                {isAttachmentOpen && (
                  <div className={`absolute bottom-14 left-0 w-52 rounded-xl p-2 border shadow-2xl space-y-1 z-40 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <button 
                      type="button" 
                      onClick={() => handleAttachmentClick('LocalImage')} 
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Image className="w-3.5 h-3.5 text-blue-500"/> Upload Local Images
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleAttachmentClick('LocalDoc')} 
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-500"/> Upload Local Files
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleAttachmentClick('GoogleDrive')} 
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <HardDrive className="w-3.5 h-3.5 text-amber-500"/> Connect Google Drive
                    </button>
                  </div>
                )}
              </div>

              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask query, click an archetype card, or input your training program..."
                className={`flex-1 rounded-xl px-4 py-3 text-xs focus:outline-none transition-all ${
                  isDarkMode ? 'bg-slate-900 border border-slate-800 focus:border-slate-700 text-slate-200' : 'bg-slate-100 border border-slate-200 focus:border-slate-400 text-slate-900'
                }`}
              />
              <button 
                type="submit" 
                id="sendMessageBtn"
                className="p-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center cursor-pointer shadow-amber-500/10"
              >
                <Send className="w-4 h-4"/>
              </button>
            </form>
          </div>
        </footer>

        {/* Global Settings Modal Container */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 transition-colors ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Sliders className="w-4 h-4 text-amber-500"/> Neural Engine Settings
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className={`p-1 cursor-pointer transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <X className="w-4 h-4"/>
                </button>
              </div>
              <div className="text-xs space-y-3">
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>Change Active Host Name</label>
                  <input 
                    type="text"
                    value={hostName}
                    onChange={(e) => {
                      setHostName(e.target.value);
                      localStorage.setItem('atlas_host_name', e.target.value);
                    }}
                    placeholder="Enter name..."
                    className={`w-full rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500 transition-colors ${
                      isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>Saved Pitch Position Context</label>
                  <input 
                    type="text"
                    value={userProfileMemory.footballPosition}
                    onChange={(e) => {
                      const updated = { ...userProfileMemory, footballPosition: e.target.value };
                      setUserProfileMemory(updated);
                      localStorage.setItem('atlas_profile_memory', JSON.stringify(updated));
                    }}
                    placeholder="Enter position..."
                    className={`w-full rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500 transition-colors ${
                      isDarkMode ? 'bg-slate-950 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div className={`p-2.5 rounded-lg space-y-1 border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Simulated Learning Cache</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[10px] custom-scroll">
                    {learnedDatabase.map((learning, idx) => (
                      <div key={idx} className={`truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>• {learning}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={`flex justify-between items-center pt-2 border-t ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Reset layout cache</span>
                <button 
                  onClick={handleResetAllData}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500 bg-red-950/20 text-red-400 text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Cached Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slideable Right Side FAQ Panel */}
        {isFAQOpen && (
          <div className={`absolute inset-y-0 right-0 w-80 border-l flex flex-col z-30 shadow-2xl transition-all duration-300 h-full ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500"/>
                <h4 className="font-bold text-xs uppercase tracking-wider">Atlas Support FAQs</h4>
              </div>
              <button 
                onClick={() => setIsFAQOpen(false)} 
                className={`p-1 cursor-pointer transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-500'
                }`}
              >
                <X className="w-4 h-4"/>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
              <p className={`text-[10px] leading-normal ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Select from our calibrated sports science catalog to automatically populate questions in your current session:
              </p>
              <div className="space-y-2">
                {Object.keys(faqCategories).map(category => (
                  <div key={category} className={`text-xs border rounded-xl overflow-hidden ${
                    isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <button 
                      onClick={() => setExpandedFAQCategory(expandedFAQCategory === category ? null : category)}
                      className={`w-full flex items-center justify-between py-2.5 px-3 text-left font-semibold transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{category}</span>
                      {expandedFAQCategory === category ? <ChevronUp className="w-3.5 h-3.5 text-amber-500"/> : <ChevronDown className="w-3.5 h-3.5 text-slate-400"/>}
                    </button>
                    {expandedFAQCategory === category && (
                      <div className={`px-3 pb-3 pt-1 space-y-1.5 border-t ${
                        isDarkMode ? 'border-slate-800/30' : 'border-slate-200/50'
                      }`}>
                        {faqCategories[category].map((faq, idx) => (
                          <button 
                            key={idx}
                            onClick={() => { setInputText(faq.question); setIsFAQOpen(false); }}
                            className={`w-full text-left py-1.5 px-2 rounded-lg text-[11px] leading-normal cursor-pointer transition-all ${
                              isDarkMode 
                                ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white' 
                                : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                            }`}
                            title={faq.question}
                          >
                            {faq.question}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
