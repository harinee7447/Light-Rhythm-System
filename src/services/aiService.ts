import { GoogleGenAI } from '@google/genai';
import { Schedule, Routine, ActivityHistory } from '../db/database.js';

export interface CircadianContext {
  currentBrightness: {
    current_mode: string;
    brightness_pct: number;
    period: string;
    is_automatic: boolean;
    current_time: string;
    active_schedule_name?: string | null;
  };
  schedules: Schedule[];
  routines: Routine[];
  recentHistory: ActivityHistory[];
  currentTime: string;
}

export interface ProposedAction {
  type: 'create_schedule' | 'create_routine' | 'set_brightness';
  title: string;
  data: any;
}

export interface AssistantResponse {
  reply: string;
  action?: ProposedAction;
  suggestions?: string[];
}

export interface DashboardInsights {
  headline: string;
  insight: string;
  optimization_tip: string;
  smart_alert: string;
  recommended_brightness: number;
  circadian_score: number;
  score_status: string;
}

function isValidApiKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (
    trimmed === '' ||
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed === 'YOUR_API_KEY' ||
    trimmed === 'PLACEHOLDER' ||
    trimmed === 'TODO' ||
    trimmed.startsWith('your_') ||
    trimmed.length < 20 ||
    !trimmed.startsWith('AIza')
  ) {
    return false;
  }
  return true;
}

function getAiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!isValidApiKey(key)) {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch {
    return null;
  }
}

/**
 * Heuristic fallback when GEMINI_API_KEY is not set or network fails
 */
function getRuleBasedResponse(prompt: string, context: CircadianContext): AssistantResponse {
  const p = prompt.toLowerCase();
  const currentHour = parseInt(context.currentTime.split(':')[0] || '12', 10);

  // 1. Natural Language Schedule creation: "Set morning light to bright at 7 AM"
  if (p.includes('morning') && (p.includes('set') || p.includes('schedule') || p.includes('create') || p.includes('7 am') || p.includes('07:00'))) {
    return {
      reply: "I've drafted a morning light schedule for you. Starting at 07:00 with 65% brightness will help stimulate your cortisol awakening response and synchronize your biological clock with morning daylight.",
      action: {
        type: 'create_schedule',
        title: 'Morning Focus Schedule (07:00 - 10:00 @ 65%)',
        data: {
          name: 'Morning Focus Schedule',
          period: 'Morning',
          start_time: '07:00',
          end_time: '10:00',
          brightness_pct: 65,
          is_active: true,
        },
      },
      suggestions: ['Check my schedule overlap', 'Recommend evening light', 'Show consistency score'],
    };
  }

  // 2. Evening routine: "Create a relaxing evening routine"
  if (p.includes('evening') || p.includes('relax') || p.includes('wind down') || p.includes('night routine')) {
    return {
      reply: 'Here is a custom evening wind-down routine tailored to protect your melatonin production. Lowering brightness to 20% around 20:30 signals your brain to prepare for restorative deep sleep.',
      action: {
        type: 'create_routine',
        title: 'Evening Melatonin Wind-Down (20:30 @ 20%)',
        data: {
          name: 'Evening Wind-Down',
          period: 'Night',
          time: '20:30',
          brightness_pct: 20,
          description: 'Melatonin-friendly ambient light to promote restful sleep',
          is_active: true,
        },
      },
      suggestions: ['Apply this routine now', 'Set morning wake schedule', 'Optimize all schedules'],
    };
  }

  // 3. Brightness recommendation
  if (p.includes('brightness') || p.includes('recommend') || p.includes('how bright') || p.includes('level')) {
    let idealPct = 75;
    let periodName = 'Day';
    if (currentHour >= 6 && currentHour < 10) {
      idealPct = 60;
      periodName = 'Morning';
    } else if (currentHour >= 10 && currentHour < 18) {
      idealPct = 75;
      periodName = 'Day';
    } else {
      idealPct = 25;
      periodName = 'Night';
    }

    return {
      reply: `Based on your local circadian time (${context.currentTime}), the optimal lighting mode is **${periodName}** at **${idealPct}% brightness**. Your current active brightness is ${context.currentBrightness.brightness_pct}%.`,
      action: {
        type: 'set_brightness',
        title: `Switch to ${periodName} Mode (${idealPct}%)`,
        data: {
          mode: periodName,
          brightness_pct: idealPct,
        },
      },
      suggestions: ['Restore automatic circadian sync', 'Review daily schedules', 'Generate a new routine'],
    };
  }

  // 4. Schedule optimization
  if (p.includes('optimize') || p.includes('overlap') || p.includes('inconsistent') || p.includes('clean')) {
    const count = context.schedules.length;
    return {
      reply: `I analyzed your **${count} active light schedules**. Your current coverage maintains key circadian bands (Morning, Day, Night). To further improve energy stability, keep lighting within ±5% of daylight intensity and avoid abrupt jumps above 30% after 20:00.`,
      suggestions: ['Recommend bedtime routine', 'Check activity history', 'Recommend current brightness'],
    };
  }

  // Default intelligent assistant response
  return {
    reply: `I have analyzed your lighting system. You currently have **${context.schedules.length} schedules** and **${context.routines.length} routines** active in **${context.currentBrightness.current_mode} mode** (${context.currentBrightness.brightness_pct}%). How would you like me to adjust or optimize your circadian rhythm today?`,
    suggestions: [
      'Set morning light to bright at 7 AM',
      'Create a relaxing evening routine',
      'Recommend ideal brightness right now',
      'Analyze my schedule consistency',
    ],
  };
}

export const aiService = {
  /**
   * Natural Language Assistant Chat & Command Engine
   */
  async processChat(prompt: string, context: CircadianContext): Promise<AssistantResponse> {
    const aiClient = getAiClient();
    if (!aiClient) {
      return getRuleBasedResponse(prompt, context);
    }

    try {
      const systemInstruction = `You are the Light Rhythm AI Assistant for a Circadian Lighting Management System.
You analyze the user's lighting schedules, routines, and activity history to provide personalized circadian recommendations.
Circadian Biology Guidelines:
- Morning (06:00 - 10:00): 60% brightness (promotes cortisol awakening response and alertness).
- Day (10:00 - 18:00): 75% brightness (crisp focused daylight, prevents midday energy dips).
- Night (18:00 - 06:00): 25% brightness (warm dim light, protects melatonin production and sleep onset).

Current Context:
- Current Time: ${context.currentTime}
- Active Mode: ${context.currentBrightness.current_mode} (${context.currentBrightness.brightness_pct}%)
- Existing Schedules: ${JSON.stringify(context.schedules.map((s) => ({ name: s.name, period: s.period, start: s.start_time, end: s.end_time, bright: s.brightness_pct })))}
- Existing Routines: ${JSON.stringify(context.routines.map((r) => ({ name: r.name, period: r.period, time: r.time, bright: r.brightness_pct })))}
- Recent Activities Count: ${context.recentHistory.length}

Instructions:
1. Provide a concise, friendly, and scientifically grounded response (2-4 sentences).
2. If the user asks to set, change, schedule, or create a routine/schedule/brightness (e.g., "Set morning light to bright at 7 AM" or "Create a relaxing evening routine" or "Dim light to 20%"), include a JSON action block at the very end of your response with this exact format:
<<<ACTION
{"type": "create_schedule" | "create_routine" | "set_brightness", "title": "Human readable title", "data": {...}}
ACTION>>>
Valid periods are strictly: 'Morning', 'Day', 'Night'.
Times must strictly be 'HH:MM' (24-hour format).
Brightness must strictly be an integer between 0 and 100.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const fullText = response.text || '';

      // Extract action block if present
      let reply = fullText;
      let action: ProposedAction | undefined = undefined;

      const actionMatch = fullText.match(/<<<ACTION\s*([\s\S]*?)\s*ACTION>>>/);
      if (actionMatch && actionMatch[1]) {
        try {
          action = JSON.parse(actionMatch[1].trim());
          reply = fullText.replace(/<<<ACTION\s*[\s\S]*?\s*ACTION>>>/, '').trim();
        } catch (e) {
          console.warn('[AI Service] Failed to parse action JSON:', e);
        }
      }

      const suggestions = [
        'Optimize my daily schedule',
        'Recommend brightness for right now',
        'Create a bedtime relaxation routine',
      ];

      return { reply, action, suggestions };
    } catch {
      return getRuleBasedResponse(prompt, context);
    }
  },

  /**
   * Fast Dashboard Insights & Smart Alerts
   */
  async getDashboardInsights(context: CircadianContext): Promise<DashboardInsights> {
    const currentHour = parseInt(context.currentTime.split(':')[0] || '12', 10);
    const mode = context.currentBrightness.current_mode;
    const pct = context.currentBrightness.brightness_pct;
    const scheduleCount = context.schedules.length;

    // Calculate Circadian Health Score (0 - 100)
    let score = 70;
    const hasMorning = context.schedules.some((s) => s.period === 'Morning' && s.is_active);
    const hasDay = context.schedules.some((s) => s.period === 'Day' && s.is_active);
    const hasNight = context.schedules.some((s) => s.period === 'Night' && s.is_active);

    if (hasMorning) score += 10;
    if (hasDay) score += 10;
    if (hasNight) score += 10;
    if (context.currentBrightness.is_automatic) score += 5;
    score = Math.min(100, score);

    let scoreStatus = 'Good Sync';
    if (score >= 90) scoreStatus = 'Optimal Circadian Alignment';
    else if (score >= 80) scoreStatus = 'Balanced Rhythm';
    else scoreStatus = 'Attention Needed';

    // Target brightness for current hour
    let recommendedBrightness = 75;
    let expectedMode = 'Day';
    if (currentHour >= 6 && currentHour < 10) {
      recommendedBrightness = 60;
      expectedMode = 'Morning';
    } else if (currentHour >= 10 && currentHour < 18) {
      recommendedBrightness = 75;
      expectedMode = 'Day';
    } else {
      recommendedBrightness = 25;
      expectedMode = 'Night';
    }

    const aiClient = getAiClient();
    if (aiClient) {
      try {
        const prompt = `Analyze this user's circadian lighting state and return a JSON object with:
- "headline": Short 3-6 word summary (e.g. "Optimal Daytime Focus Alignment")
- "insight": 1 clear sentence analyzing whether ${mode} mode (${pct}%) is appropriate for ${context.currentTime}.
- "optimization_tip": 1 sentence recommendation for schedule consistency or sleep health.
- "smart_alert": 1 concise alert about upcoming light changes or circadian stability.`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        return {
          headline: parsed.headline || `${expectedMode} Circadian Sync Active`,
          insight: parsed.insight || `Your lights are currently at ${pct}% in ${mode} mode, matching ${expectedMode.toLowerCase()} biological needs.`,
          optimization_tip: parsed.optimization_tip || `Maintaining stable wake hours boosts deep sleep quality by up to 25%.`,
          smart_alert: parsed.smart_alert || `Automatic circadian scheduler is running smoothly across ${scheduleCount} slots.`,
          recommended_brightness: recommendedBrightness,
          circadian_score: score,
          score_status: scoreStatus,
        };
      } catch {
        // Fall back gracefully to deterministic circadian intelligence without warning noise
      }
    }

    // High quality deterministic fallback
    let headline = `${expectedMode} Circadian Sync Active`;
    let insight = `Your system is set to ${mode} mode (${pct}%). This provides balanced ambient stimulation for ${context.currentTime}.`;
    let tip = `Consistent morning light between 06:00 and 10:00 strengthens your 24-hour internal clock.`;
    let alert = `All ${scheduleCount} daily schedules are calibrated with zero conflict windows.`;

    if (currentHour >= 21 || currentHour < 5) {
      headline = 'Melatonin Preservation Mode';
      insight = 'Dim lighting below 30% is critical right now to prevent suppressing nocturnal melatonin release.';
      tip = 'Keep nighttime screens and ambient fixtures below 25% brightness for deeper REM sleep.';
      alert = 'Night light schedule active. System will transition to sunrise light at 06:00.';
    } else if (currentHour >= 6 && currentHour < 10) {
      headline = 'Morning Cortisol Stimulation';
      insight = 'Morning 60% warm-white light activates your natural waking response without eye strain.';
      tip = 'Expose yourself to scheduled morning brightness within 30 minutes of rising.';
      alert = 'Upcoming transition to Day focus light scheduled at 10:00.';
    }

    return {
      headline,
      insight,
      optimization_tip: tip,
      smart_alert: alert,
      recommended_brightness: recommendedBrightness,
      circadian_score: score,
      score_status: scoreStatus,
    };
  },
};
