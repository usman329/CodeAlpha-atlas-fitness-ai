/**
 * Advanced Dynamic Fallback Generator for Atlas Fitness AI.
 * This ensures that even if there are server connectivity issues, or the Gemini API
 * key is not configured, the user receives an incredibly polished, friendly,
 * sports-science-backed, and human-sounding response customized to their profile.
 */

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
}

export function generateHumanFallbackResponse(
  userQuery: string,
  athleteName: string = "Abdul Sami",
  footballPosition: string = "All-Rounder (Cricket)",
  learnedMemories: string[] = []
): string {
  const query = (userQuery || "").toLowerCase().trim();

  // Handle gibberish or completely irrelevant input first
  if (isGibberishOrIrrelevant(userQuery)) {
    return `I'm not sure what you want to convey. Could you please clarify your message? I am here to help you with your athletic training, custom workout planning, or gym facility questions!`;
  }

  // Basic normalization helper
  const has = (...words: string[]) => words.some(w => query.includes(w));

  // 0. SPORT & POSITION INITIAL ONBOARDING ASSESSMENT (First ask questions, then suggest)
  const hasSportOrPosition = has(
    "bowler", "batsman", "striker", "goalkeeper", "winger", "midfielder", "defender",
    "cricket", "football", "soccer", "basketball", "tennis", "badminton"
  );
  
  const hasAnswersOrDetails = has(
    "days", "times", "week", "pain", "injury", "gym", "home", "protein", "diet", "restrict",
    "eat", "workout", "exercise", "routine", "schedule", "plan", "program"
  ) || query.length > 50;

  if (hasSportOrPosition && !hasAnswersOrDetails) {
    let sportName = "Cricket";
    let positionName = "Bowler";

    if (has("striker", "goalkeeper", "winger", "midfielder", "defender", "football", "soccer")) {
      sportName = "Football/Soccer";
      if (has("striker")) positionName = "Striker";
      else if (has("goalkeeper")) positionName = "Goalkeeper";
      else if (has("winger")) positionName = "Winger";
      else if (has("defender")) positionName = "Defender";
      else if (has("midfielder")) positionName = "Midfielder";
      else positionName = "Player";
    } else if (has("basketball")) {
      sportName = "Basketball";
      positionName = "Player";
    } else if (has("tennis")) {
      sportName = "Tennis";
      positionName = "Player";
    } else if (has("badminton")) {
      sportName = "Badminton";
      positionName = "Player";
    } else {
      if (has("batsman")) positionName = "Batsman";
      else if (has("all-rounder", "all rounder")) positionName = "All-Rounder";
      else positionName = "Bowler";
    }

    return `That's fantastic, **${athleteName}**! 🏏⚽

Training as an elite **${positionName}** in **${sportName}** requires a highly precise, sports-science backed blueprint. 

To design the absolute perfect workout schedule, target exercises, and customized nutrition/diet plan for your specific body and style of play, could you please tell me:

1. **What is your main athletic goal?** (e.g. increase bowling pace, improve speed/agility, build stamina, or gain muscle?)
2. **Do you have any active discomfort or joint pain** (especially in your left shoulder, knees, or lower back)?
3. **What is your training setup & availability?** (e.g. how many days a week can you train? Do you have access to a gym, or are you training at home?)
4. **Any specific dietary preferences?** (e.g. high-protein, caloric deficit for weight loss, or surplus for building bulk?)

Once you let me know these quick details, I'll instantly map out your complete workout exercises, sets, reps, safety modifications, and meal protocols! 🔥`;
  }

  // 1. GREETINGS & INTROS
  if (has("hello", "hi ", "hi!", "hey", "yo ", "yo!", "greetings", "howdy", "sup", "what's up")) {
    return `Hello **${athleteName}**! 👋

Welcome back to the training ground. I am fully locked and loaded to help you optimize your athletic preparation today! 

Since your profile is configured as an elite **${footballPosition}**, we are actively tracking these priority vectors:
- 🏏 **Rotational Acceleration & Deceleration**: Optimizing trunk rotation and dynamic pelvic transfer.
- 🔋 **Match-Day Stamina**: High work capacity to handle dual batting & bowling workloads.
- 🛡️ **Shoulder Preservation**: Your active injury guideline (protecting that left shoulder and avoiding heavy overhead presses) is fully engaged.

How can I help you dominate your training today? We can design a customized, shoulder-safe workout routine, walk through specific athletic drills, or plan a recovery strategy!`;
  }

  // 2. SHOULDER & INJURY CARE
  if (has("shoulder", "injury", "hurt", "pain", "overhead", "safety", "protect")) {
    return `Understood, **${athleteName}**. Protecting your left shoulder is our absolute number-one priority in this athletic architecture! 🛡️

To prevent shoulder impingement or rotatory joint wear while maintaining peak cricket capabilities (especially the high deceleration force required at the end of a bowling action), we have suspended heavy overhead presses and overhead snatches.

Instead, let's substitute them with these safe, high-yield, sport-specific movements:
1. **Landmine Presses (Neutral Grip)**: Provides a friendly, semi-vertical pushing angle that loads the anterior deltoid and chest while completely sparing the shoulder socket.
2. **Band Pull-Aparts**: Enhances mid-back and rear-deltoid activation, providing the crucial back-scapular stability needed to decelerate your bowling arm safely.
3. **Face Pulls with Rotator Cuff Rotation**: Strengthens the infraspinatus and teres minor to keep the shoulder centrated during fast athletic movements.

Let me know if you would like me to compile a complete, highly-personalized upper body workout that is 100% shoulder-safe!`;
  }

  // 3. CRICKET & BOWLING & ALL-ROUNDER DRILLS
  if (has("cricket", "bowling", "bowl", "batsman", "batting", "fast bowler", "all-rounder", "all rounder", "spin")) {
    return `Excellent, **${athleteName}**! As an active **${footballPosition}**, your biomechanical profile is dual-loaded. You need explosive speed for bowling, rapid hand-eye coordination for batting, and massive conditioning for multi-hour match days.

Here are your specialized athletic protocols:

### 1. Bowling Power (Rotational Force Transfer)
Bowling speed doesn't come from the arm—it starts in the ground! 
* **Medicine Ball Lateral Throws**: 3 sets of 6 reps per side. Focus on driving from your back leg, pivoting the hip, and slamming the ball into a wall.
* **Single-Leg Balance to Bounds**: 3 sets of 5 reps per leg. Teaches your front leg to block force and transfer it cleanly up your kinetic chain.

### 2. Batting Agility (Hand-Eye & Fast Footwork)
* **Hexagon Lateral Hops**: 3 sets of 30 seconds. Keeps your stance light, springy, and reactive.
* **Wrist Roller / Forearm Holds**: 3 sets of 45-second holds to build endurance for heavy bat grip fatigue.

### 3. Active Care Check
Since we are keeping your left shoulder out of overhead compromise, we avoid standard overhead barbell presses. We replace them with high-velocity pushups, chest-supported rows, and cable woodchops.

What specific aspect of your cricket training should we plan or refine next?`;
  }

  // 4. WORKOUT / EXERCISE ROUTINES
  if (has("workout", "exercise", "routine", "train", "gym", "program", "split")) {
    return `Let's dial in a custom, athletic session for you, **${athleteName}**! 

To accommodate your **${footballPosition}** requirements while respecting your **left shoulder safety guidelines**, I have designed this dynamic **Rotational Stamina & Lower Body Power** session:

### 🏃 Warm-Up (6-8 Mins)
* **Scapular Glides & Arm Circles**: 10 reps (gentle, no load).
* **World's Greatest Stretch**: 5 reps per side (unlocks hips and thoracic spine).
* **Plank Tap**: 30 seconds (stabilizes pelvis).

### ⚡ Phase 1: Explosive Rotational Power
* **Medicine Ball Rotational Slams**: 3 sets of 6 reps per side. (Drives cricket-specific rotational speed).
* **Band-Resisted Pallof Press**: 3 sets of 12 reps per side. (Trains the core to resist rotation, key for spinal health).

### 🏋️ Phase 2: Lower Body Power (Shoulder-Free Load)
* **Goblet Squats or Dumbbell Bulgarian Split Squats**: 3 sets of 10 reps. (Loads the legs heavily without squeezing or straining the shoulders).
* **Single-Leg Dumbbell RDLs**: 3 sets of 8 reps per leg. (Strengthens hamstrings and glutes for high-speed bowling approaches).

### 💪 Phase 3: Upper Body Recovery & Core
* **Dumbbell Chest Supported Row**: 3 sets of 12 reps. (Builds a robust, injury-resistant back).
* **Deadbugs or Plank Pull-Throughs**: 3 sets of 45 seconds.

Would you like me to adjust the difficulty, swap any exercises, or write up a detailed nutrition guideline for this workout?`;
  }

  // 5. NUTRITION / DIET / PROTEIN
  if (has("diet", "nutrition", "eat", "food", "protein", "meal", "carb", "water", "hydration")) {
    return `Nutrition is the fuel that powers your match-day stamina, **${athleteName}**! 🍏

For a dynamic cricket athlete, we want to balance cellular repair, muscle maintenance, and sustained athletic output. Here is your target blueprint:

### 🥩 1. Repair & Muscle (Protein)
* Aim for approximately **1.6 to 2.0g of protein per kilogram of bodyweight**. 
* Focus on clean sources: lean chicken, fish, eggs, lentils, Greek yogurt, or a clean whey/plant protein isolate.
* *Why?* High-velocity bowling and batting create micro-tears in muscle tissue that require immediate amino acid synthesis.

### 🍚 2. Sustained Energy (Carbohydrates)
* Prioritize complex, low-glycemic carbohydrates: oats, brown rice, sweet potatoes, and quinoa.
* *Why?* Cricket is a long-form sport. You need glycogen-filled muscles to sustain power output in the 4th hour of play just as much as the 1st.

### 💧 3. Hydration & Muscle Cramp Prevention
* Aim for at least **3.5 to 4 liters of water daily**, especially during training or hot match conditions.
* Incorporate an electrolyte formula with sodium, potassium, and magnesium to prevent cramping during long overs.

Would you like me to draft a full meal plan matching your current training calendar?`;
  }

  // 6. DEFAULT GENERAL SCIENTIFIC FITNESS OUTCOME
  return `That's an excellent training inquiry, **${athleteName}**! 🧠

As your dedicated fitness coach and sports-science advisor, here is how we approach this concept through your active **${footballPosition}** lens:

1. **The Biomechanical Baseline**: All elite athletic movements (especially rotation for throwing, hitting, and bowling) rely on transferring energy from the feet, up through the pelvis, and out through the upper extremities.
2. **Strict Injury Safeguard**: Because we are protecting your left shoulder, any load must avoid full vertical overhead articulation. We always prioritize lateral, horizontal, or landmine angles to get the same strength response with zero injury risk.
3. **Core Deceleration Control**: The key to cricket longevity is not just how fast you can rotate, but how safely your core and back can decelerate your body after a high-impact bowling release or explosive swing.

Let me know how you want to expand on this—we can dive into a customized exercise selection, plan out your recovery protocols, or design a detailed hydration schedule!`;
}
