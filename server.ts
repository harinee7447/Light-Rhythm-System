import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, User, Schedule, Routine, ActivityHistory } from './src/db/database.js';
import { aiService, CircadianContext } from './src/services/aiService.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const SECRET_KEY = process.env.JWT_SECRET || 'light-rhythm-secret-key-super-secure-key-2026';
const APP_NAME = 'Light Rhythm Management System';
const APP_VERSION = '1.0.0';

app.use(cors());
app.use(express.json());

interface AuthRequest extends Request {
  user?: User;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// --- Circadian Calculations ---
function determineCircadianMode(currentHour: number, currentMinute: number) {
  const totalMinutes = currentHour * 60 + currentMinute;
  const morningStart = 6 * 60;
  const dayStart = 10 * 60;
  const nightStart = 18 * 60;

  if (morningStart <= totalMinutes && totalMinutes < dayStart) {
    return {
      mode: 'Morning',
      pct: 60,
      symbol: '☼',
      description: 'Morning light is active',
      period: 'MORNING',
    };
  } else if (dayStart <= totalMinutes && totalMinutes < nightStart) {
    return {
      mode: 'Day',
      pct: 75,
      symbol: '☀',
      description: 'Bright daytime lighting',
      period: 'DAY',
    };
  } else {
    return {
      mode: 'Night',
      pct: 25,
      symbol: '☾',
      description: 'Night lighting is active',
      period: 'NIGHT',
    };
  }
}

async function getCurrentBrightnessState() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const currentTimeHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const hour = now.getHours();
  const minute = now.getMinutes();

  const defaultCircadian = determineCircadianMode(hour, minute);

  const systemMode = (await db.getSetting('system_mode')) || 'AUTOMATIC';
  const overrideRaw = await db.getSetting('override_brightness');
  const overrideVal = overrideRaw && overrideRaw !== '-1' ? parseInt(overrideRaw, 10) : null;

  const modeSymbolMap: Record<string, string> = {
    Morning: '☼',
    Day: '☀',
    Night: '☾',
  };

  if (systemMode !== 'AUTOMATIC' && overrideVal !== null) {
    return {
      current_mode: systemMode,
      brightness_pct: overrideVal,
      period: systemMode.toUpperCase(),
      symbol: modeSymbolMap[systemMode] || '☼',
      description: `Manual ${systemMode} lighting override active`,
      is_automatic: false,
      current_time: nowStr,
      active_schedule_name: 'Manual Override',
    };
  }

  // Check active schedules
  const allSchedules = await db.getSchedules();
  const activeSchedules = allSchedules
    .filter((s) => s.is_active)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  let matchedSchedule: Schedule | null = null;
  for (const sch of activeSchedules) {
    const start = sch.start_time;
    const end = sch.end_time;
    if (start <= end) {
      if (start <= currentTimeHm && currentTimeHm < end) {
        matchedSchedule = sch;
        break;
      }
    } else {
      // Overnight (e.g. 18:00 to 06:00)
      if (currentTimeHm >= start || currentTimeHm < end) {
        matchedSchedule = sch;
        break;
      }
    }
  }

  if (matchedSchedule) {
    const modeName =
      matchedSchedule.period.charAt(0).toUpperCase() + matchedSchedule.period.slice(1).toLowerCase();
    return {
      current_mode: modeName,
      brightness_pct: matchedSchedule.brightness_pct,
      period: modeName.toUpperCase(),
      symbol: modeSymbolMap[modeName] || '☼',
      description: `Following schedule: ${matchedSchedule.name}`,
      is_automatic: true,
      current_time: nowStr,
      active_schedule_name: matchedSchedule.name,
    };
  }

  return {
    current_mode: defaultCircadian.mode,
    brightness_pct: defaultCircadian.pct,
    period: defaultCircadian.period,
    symbol: defaultCircadian.symbol,
    description: defaultCircadian.description,
    is_automatic: true,
    current_time: nowStr,
    active_schedule_name: `Standard ${defaultCircadian.mode} Rhythm`,
  };
}

// --- Auth Middleware ---
async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { sub: string; id: number };
    const user = await db.getUserByUsername(decoded.sub);
    if (!user) {
      res.status(401).json({ detail: 'Could not validate credentials or token expired.' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ detail: 'Could not validate credentials or token expired.' });
  }
}

// --- Health Check ---
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: APP_NAME,
    version: APP_VERSION,
    database_connected: db.isSupabaseConnected() ? 'Supabase PostgreSQL' : 'Local In-Memory',
    availability: '99%+',
  });
});

// --- Auth Routes ---
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ detail: 'Username must be at least 3 characters long.' });
    return;
  }
  const cleanUsername = username.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    res.status(400).json({ detail: 'Username can only contain alphanumeric characters, underscores, and hyphens.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ detail: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = await db.getUserByUsername(cleanUsername);
  if (existing) {
    res.status(400).json({ detail: 'Username already registered. Please choose another username.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = await db.createUser(cleanUsername, passwordHash, 'user');

  await db.recordActivity('USER', `New user registered: ${newUser.username}`, 'Account created successfully');

  const token = jwt.sign({ sub: newUser.username, id: newUser.id }, SECRET_KEY, { expiresIn: '24h' });
  res.status(201).json({
    access_token: token,
    token_type: 'bearer',
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      created_at: newUser.created_at,
    },
  });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(401).json({ detail: 'Incorrect username or password.' });
    return;
  }

  const user = await db.getUserByUsername(String(username));
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ detail: 'Incorrect username or password.' });
    return;
  }

  await db.recordActivity('USER', `User login: ${user.username}`, 'Authenticated via JWT');

  const token = jwt.sign({ sub: user.username, id: user.id }, SECRET_KEY, { expiresIn: '24h' });
  res.json({
    access_token: token,
    token_type: 'bearer',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
    },
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
  });
});

// --- Schedule Routes (FR-01) ---
app.get('/api/schedules', async (req: Request, res: Response) => {
  const q = req.query.q ? String(req.query.q).trim() : '';
  const period = req.query.period ? String(req.query.period) : '';
  const list = await db.getSchedules(q, period);
  res.json(list);
});

app.get('/api/schedules/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const schedule = await db.getScheduleById(id);
  if (!schedule) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }
  res.json(schedule);
});

app.post('/api/schedules', requireAuth, async (req: AuthRequest, res: Response) => {
  const { name, period, start_time, end_time, brightness_pct, is_active } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ detail: 'Schedule name is required.' });
    return;
  }
  const cleanPeriod = (period || '').charAt(0).toUpperCase() + (period || '').slice(1).toLowerCase();
  if (!['Morning', 'Day', 'Night'].includes(cleanPeriod)) {
    res.status(400).json({ detail: 'Period must be Morning, Day, or Night.' });
    return;
  }
  if (!TIME_REGEX.test(start_time) || !TIME_REGEX.test(end_time)) {
    res.status(400).json({ detail: 'Time must be in 24-hour HH:MM format (00:00 to 23:59).' });
    return;
  }
  const brightNum = parseInt(brightness_pct, 10);
  if (isNaN(brightNum) || brightNum < 0 || brightNum > 100) {
    res.status(400).json({ detail: 'Brightness must be between 0 and 100.' });
    return;
  }

  const newSchedule = await db.createSchedule({
    name: name.trim(),
    period: cleanPeriod,
    start_time,
    end_time,
    brightness_pct: brightNum,
    is_active: is_active !== false,
  });

  await db.recordActivity(
    'SCHEDULE',
    `Schedule created: ${newSchedule.name}`,
    `Period: ${newSchedule.period}, ${newSchedule.start_time} - ${newSchedule.end_time} @ ${newSchedule.brightness_pct}%`,
    newSchedule.brightness_pct
  );

  res.status(201).json(newSchedule);
});

app.put('/api/schedules/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.getScheduleById(id);
  if (!existing) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }

  const { name, period, start_time, end_time, brightness_pct, is_active } = req.body || {};
  let cleanPeriod: string | undefined;

  if (period !== undefined) {
    cleanPeriod = period.charAt(0).toUpperCase() + period.slice(1).toLowerCase();
    if (!cleanPeriod || !['Morning', 'Day', 'Night'].includes(cleanPeriod)) {
      res.status(400).json({ detail: 'Period must be Morning, Day, or Night.' });
      return;
    }
  }

  if (start_time !== undefined && !TIME_REGEX.test(start_time)) {
    res.status(400).json({ detail: 'Start time must be in HH:MM format.' });
    return;
  }
  if (end_time !== undefined && !TIME_REGEX.test(end_time)) {
    res.status(400).json({ detail: 'End time must be in HH:MM format.' });
    return;
  }
  let brightNum: number | undefined;
  if (brightness_pct !== undefined) {
    brightNum = parseInt(brightness_pct, 10);
    if (isNaN(brightNum) || brightNum < 0 || brightNum > 100) {
      res.status(400).json({ detail: 'Brightness must be between 0 and 100.' });
      return;
    }
  }

  const updated = await db.updateSchedule(id, {
    name: name !== undefined ? String(name).trim() : undefined,
    period: cleanPeriod,
    start_time,
    end_time,
    brightness_pct: brightNum,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
  });

  if (!updated) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }

  await db.recordActivity(
    'SCHEDULE',
    `Schedule updated: ${updated.name}`,
    `${updated.period} ${updated.start_time}-${updated.end_time} set to ${updated.brightness_pct}%`,
    updated.brightness_pct
  );

  res.json(updated);
});

app.delete('/api/schedules/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.getScheduleById(id);
  if (!existing) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }

  await db.deleteSchedule(id);
  await db.recordActivity(
    'SCHEDULE',
    `Schedule deleted: ${existing.name}`,
    `Removed schedule ID ${id}`,
    existing.brightness_pct
  );

  res.json({ message: `Schedule '${existing.name}' successfully deleted.` });
});

// --- Routine Routes (FR-03) ---
app.get('/api/routines', async (req: Request, res: Response) => {
  const q = req.query.q ? String(req.query.q).trim() : '';
  const period = req.query.period ? String(req.query.period) : '';
  const list = await db.getRoutines(q, period);
  res.json(list);
});

app.get('/api/routines/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const routine = await db.getRoutineById(id);
  if (!routine) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }
  res.json(routine);
});

app.post('/api/routines', requireAuth, async (req: AuthRequest, res: Response) => {
  const { name, period, time, brightness_pct, description, is_active } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ detail: 'Routine name is required.' });
    return;
  }
  const cleanPeriod = (period || '').charAt(0).toUpperCase() + (period || '').slice(1).toLowerCase();
  if (!['Morning', 'Day', 'Night'].includes(cleanPeriod)) {
    res.status(400).json({ detail: 'Period must be Morning, Day, or Night.' });
    return;
  }
  if (!TIME_REGEX.test(time)) {
    res.status(400).json({ detail: 'Time must be in 24-hour HH:MM format.' });
    return;
  }
  const brightNum = parseInt(brightness_pct, 10);
  if (isNaN(brightNum) || brightNum < 0 || brightNum > 100) {
    res.status(400).json({ detail: 'Brightness must be between 0 and 100.' });
    return;
  }

  const newRoutine = await db.createRoutine({
    name: name.trim(),
    period: cleanPeriod,
    time,
    brightness_pct: brightNum,
    description: description || '',
    is_active: is_active !== false,
  });

  await db.recordActivity(
    'ROUTINE',
    `Routine created: ${newRoutine.name}`,
    `${newRoutine.period} routine at ${newRoutine.time} (${newRoutine.brightness_pct}%)`,
    newRoutine.brightness_pct
  );

  res.status(201).json(newRoutine);
});

app.put('/api/routines/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.getRoutineById(id);
  if (!existing) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  const { name, period, time, brightness_pct, description, is_active } = req.body || {};
  let cleanPeriod: string | undefined;

  if (period !== undefined) {
    cleanPeriod = period.charAt(0).toUpperCase() + period.slice(1).toLowerCase();
    if (!cleanPeriod || !['Morning', 'Day', 'Night'].includes(cleanPeriod)) {
      res.status(400).json({ detail: 'Period must be Morning, Day, or Night.' });
      return;
    }
  }

  if (time !== undefined && !TIME_REGEX.test(time)) {
    res.status(400).json({ detail: 'Time must be in HH:MM format.' });
    return;
  }
  let brightNum: number | undefined;
  if (brightness_pct !== undefined) {
    brightNum = parseInt(brightness_pct, 10);
    if (isNaN(brightNum) || brightNum < 0 || brightNum > 100) {
      res.status(400).json({ detail: 'Brightness must be between 0 and 100.' });
      return;
    }
  }

  const updated = await db.updateRoutine(id, {
    name: name !== undefined ? String(name).trim() : undefined,
    period: cleanPeriod,
    time,
    brightness_pct: brightNum,
    description: description !== undefined ? String(description) : undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
  });

  if (!updated) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  await db.recordActivity(
    'ROUTINE',
    `Routine updated: ${updated.name}`,
    `${updated.period} ${updated.time} set to ${updated.brightness_pct}%`,
    updated.brightness_pct
  );

  res.json(updated);
});

app.delete('/api/routines/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.getRoutineById(id);
  if (!existing) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  await db.deleteRoutine(id);
  await db.recordActivity(
    'ROUTINE',
    `Routine deleted: ${existing.name}`,
    `Removed routine ID ${id}`,
    existing.brightness_pct
  );

  res.json({ message: `Routine '${existing.name}' successfully deleted.` });
});

app.post('/api/routines/:id/activate', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const routine = await db.getRoutineById(id);
  if (!routine) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  const period = routine.period.charAt(0).toUpperCase() + routine.period.slice(1).toLowerCase();
  const brightness = routine.brightness_pct;

  await db.setSetting('system_mode', period);
  await db.setSetting('override_brightness', String(brightness));

  await db.recordActivity(
    'LIGHT',
    `Routine applied: ${routine.name}`,
    `Activated ${period} routine at ${brightness}% by ${req.user!.username}`,
    brightness
  );

  res.json({
    message: `Routine '${routine.name}' activated successfully at ${brightness}%.`,
    routine,
  });
});

// --- Brightness Routes (FR-02) ---
app.get('/api/brightness/current', async (_req: Request, res: Response) => {
  const state = await getCurrentBrightnessState();
  res.json(state);
});

app.post('/api/brightness/mode', requireAuth, async (req: AuthRequest, res: Response) => {
  const { mode, brightness_pct } = req.body || {};
  if (!mode) {
    res.status(400).json({ detail: 'Mode is required.' });
    return;
  }
  const cleanMode = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
  if (!['Morning', 'Day', 'Night'].includes(cleanMode)) {
    res.status(400).json({ detail: 'Mode must be Morning, Day, or Night.' });
    return;
  }

  const defaultValues: Record<string, number> = { Morning: 60, Day: 75, Night: 25 };
  const brightness = brightness_pct !== undefined ? parseInt(brightness_pct, 10) : defaultValues[cleanMode];

  await db.setSetting('system_mode', cleanMode);
  await db.setSetting('override_brightness', String(brightness));

  await db.recordActivity(
    'LIGHT',
    `${cleanMode} mode manually activated`,
    `Brightness set to ${brightness}% by ${req.user!.username}`,
    brightness
  );

  res.json({
    message: `${cleanMode} mode activated at ${brightness}%.`,
    mode: cleanMode,
    brightness_pct: brightness,
  });
});

app.post('/api/brightness/reset', requireAuth, async (req: AuthRequest, res: Response) => {
  await db.setSetting('system_mode', 'AUTOMATIC');
  await db.setSetting('override_brightness', '-1');

  await db.recordActivity(
    'LIGHT',
    'Automatic rhythm restored',
    `Circadian scheduler re-enabled by ${req.user!.username}`
  );

  res.json({ message: 'System restored to automatic circadian rhythm.' });
});

// --- Dashboard Route (FR-05) ---
app.get('/api/dashboard', async (_req: Request, res: Response) => {
  const now = new Date();
  const brightnessState = await getCurrentBrightnessState();

  const hour = now.getHours();
  let greeting = 'night';
  if (hour >= 5 && hour < 12) greeting = 'morning';
  else if (hour >= 12 && hour < 17) greeting = 'day';
  else if (hour >= 17 && hour < 21) greeting = 'evening';

  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const todayDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const allSchedules = await db.getSchedules();
  const activeSchedules = allSchedules
    .filter((s) => s.is_active)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const allHistory = await db.getHistory(undefined, undefined, 6, 0);
  const allRoutines = await db.getRoutines();

  const stats = {
    schedules_count: allSchedules.length,
    routines_count: allRoutines.length,
    history_count: allHistory.length,
    morning_level: 60,
    day_level: 75,
    night_level: 25,
  };

  res.json({
    current_mode: brightnessState.current_mode,
    brightness_pct: brightnessState.brightness_pct,
    symbol: brightnessState.symbol,
    greeting,
    day_period: brightnessState.period,
    current_time: formattedTime,
    today_date: todayDate,
    schedules: activeSchedules,
    recent_history: allHistory,
    stats,
  });
});

// --- History Routes (FR-06) ---
app.get('/api/history', async (req: Request, res: Response) => {
  const eventType = req.query.event_type ? String(req.query.event_type).toUpperCase() : '';
  const q = req.query.q ? String(req.query.q).toLowerCase().trim() : '';
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));

  const history = await db.getHistory(eventType, q, limit, offset);
  res.json(history);
});

app.post('/api/history/clear', requireAuth, async (req: AuthRequest, res: Response) => {
  await db.clearHistory();
  await db.recordActivity('USER', 'Activity history cleared', `Logs cleared by ${req.user!.username}`);
  res.json({ message: 'Activity history cleared.' });
});

// --- Reports & Storage Routes (FR-04, FR-06) ---
app.get('/api/reports/summary', async (_req: Request, res: Response) => {
  const allSchedules = await db.getSchedules();
  const allRoutines = await db.getRoutines();
  const allHistory = await db.getHistory(undefined, undefined, 500, 0);

  const totalSchedules = allSchedules.length;
  const avgBrightness =
    totalSchedules > 0
      ? Math.round((allSchedules.reduce((acc, s) => acc + s.brightness_pct, 0) / totalSchedules) * 10) / 10
      : 0;

  const totalRoutines = allRoutines.length;
  const activeRoutines = allRoutines.filter((r) => r.is_active).length;
  const totalHistory = allHistory.length;
  const adherence = Math.min(100.0, Math.round((totalSchedules / 3.0) * 1000) / 10);

  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  const generatedAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  res.json({
    total_schedules: totalSchedules,
    total_routines: totalRoutines,
    total_history_records: totalHistory,
    avg_brightness: avgBrightness,
    active_routines: activeRoutines,
    adherence_pct: adherence,
    generated_at: generatedAt,
  });
});

app.get('/api/reports/storage', async (_req: Request, res: Response) => {
  const metrics = await db.getStorageMetrics();
  res.json(metrics);
});

app.get('/api/reports/export.csv', async (req: Request, res: Response) => {
  const exportType = String(req.query.type || 'schedules').toLowerCase();
  const now = new Date();
  const timeStampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

  function escapeCsv(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  let csvContent = '';
  let filename = '';

  if (exportType === 'history') {
    filename = `light_rhythm_history_${timeStampStr}.csv`;
    csvContent += 'ID,Event Type,Title,Details,Brightness %,Timestamp\n';
    const history = await db.getHistory(undefined, undefined, 1000, 0);
    for (const h of history) {
      csvContent += [
        h.id,
        escapeCsv(h.event_type),
        escapeCsv(h.title),
        escapeCsv(h.details),
        h.brightness_pct !== null ? h.brightness_pct : '',
        escapeCsv(h.timestamp),
      ].join(',') + '\n';
    }
  } else if (exportType === 'routines') {
    filename = `light_rhythm_routines_${timeStampStr}.csv`;
    csvContent += 'ID,Routine Name,Period,Time,Brightness %,Description,Active\n';
    const routines = await db.getRoutines();
    for (const r of routines) {
      csvContent += [
        r.id,
        escapeCsv(r.name),
        escapeCsv(r.period),
        escapeCsv(r.time),
        r.brightness_pct,
        escapeCsv(r.description),
        r.is_active ? 'Yes' : 'No',
      ].join(',') + '\n';
    }
  } else {
    // schedules
    filename = `light_rhythm_schedules_${timeStampStr}.csv`;
    csvContent += 'ID,Schedule Name,Period,Start Time,End Time,Brightness %,Active\n';
    const schedules = await db.getSchedules();
    for (const s of schedules) {
      csvContent += [
        s.id,
        escapeCsv(s.name),
        escapeCsv(s.period),
        escapeCsv(s.start_time),
        escapeCsv(s.end_time),
        s.brightness_pct,
        s.is_active ? 'Yes' : 'No',
      ].join(',') + '\n';
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// --- AI Assistant Routes ---
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ detail: 'Message prompt is required.' });
    return;
  }

  try {
    const brightnessState = await getCurrentBrightnessState();
    const schedules = await db.getSchedules();
    const routines = await db.getRoutines();
    const history = await db.getHistory(undefined, undefined, 10, 0);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const context: CircadianContext = {
      currentBrightness: brightnessState,
      schedules,
      routines,
      recentHistory: history,
      currentTime,
    };

    const aiResponse = await aiService.processChat(message.trim(), context);

    await db.recordActivity(
      'USER',
      `AI Assistant query: "${message.trim().slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
      `Responded with circadian guidance`
    );

    res.json(aiResponse);
  } catch (err: any) {
    console.error('AI chat endpoint error:', err);
    res.status(500).json({ detail: err.message || 'Failed to process AI request' });
  }
});

app.get('/api/ai/dashboard-insights', async (_req: Request, res: Response) => {
  try {
    const brightnessState = await getCurrentBrightnessState();
    const schedules = await db.getSchedules();
    const routines = await db.getRoutines();
    const history = await db.getHistory(undefined, undefined, 10, 0);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const context: CircadianContext = {
      currentBrightness: brightnessState,
      schedules,
      routines,
      recentHistory: history,
      currentTime,
    };

    const insights = await aiService.getDashboardInsights(context);
    res.json(insights);
  } catch (err: any) {
    console.error('AI dashboard insights error:', err);
    res.status(500).json({ detail: err.message || 'Failed to generate AI insights' });
  }
});

app.post('/api/ai/apply-action', async (req: Request, res: Response) => {
  const { action } = req.body || {};
  if (!action || !action.type || !action.data) {
    res.status(400).json({ detail: 'Valid action payload is required.' });
    return;
  }

  try {
    if (action.type === 'create_schedule') {
      const schedule = await db.createSchedule({
        name: action.data.name,
        period: action.data.period,
        start_time: action.data.start_time,
        end_time: action.data.end_time,
        brightness_pct: action.data.brightness_pct,
        is_active: action.data.is_active !== false,
      });

      await db.recordActivity(
        'SCHEDULE',
        `AI Action: Schedule Created (${schedule.name})`,
        `Applied via AI Assistant: ${schedule.period} ${schedule.start_time}-${schedule.end_time} @ ${schedule.brightness_pct}%`,
        schedule.brightness_pct
      );

      res.status(201).json({ message: `Schedule '${schedule.name}' applied successfully.`, schedule });
      return;
    }

    if (action.type === 'create_routine') {
      const routine = await db.createRoutine({
        name: action.data.name,
        period: action.data.period,
        time: action.data.time,
        brightness_pct: action.data.brightness_pct,
        description: action.data.description || 'Generated by AI Light Rhythm Assistant',
        is_active: action.data.is_active !== false,
      });

      await db.recordActivity(
        'ROUTINE',
        `AI Action: Routine Created (${routine.name})`,
        `Applied via AI Assistant: ${routine.period} at ${routine.time} (${routine.brightness_pct}%)`,
        routine.brightness_pct
      );

      res.status(201).json({ message: `Routine '${routine.name}' applied successfully.`, routine });
      return;
    }

    if (action.type === 'set_brightness') {
      const mode = action.data.mode;
      const brightness = action.data.brightness_pct;

      await db.setSetting('system_mode', mode);
      await db.setSetting('override_brightness', String(brightness));

      await db.recordActivity(
        'LIGHT',
        `AI Action: ${mode} mode applied`,
        `Brightness adjusted to ${brightness}% by AI Assistant`,
        brightness
      );

      res.json({ message: `${mode} mode applied at ${brightness}%.`, mode, brightness_pct: brightness });
      return;
    }

    res.status(400).json({ detail: `Unknown action type: ${action.type}` });
  } catch (err: any) {
    console.error('Apply AI action error:', err);
    res.status(500).json({ detail: err.message || 'Failed to apply AI action' });
  }
});

// --- Static Frontend Serving ---
const frontendDir = path.join(process.cwd(), 'Frontend');
app.use('/static', express.static(frontendDir));
app.use(express.static(frontendDir));

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// SPA fallback for non-API routes
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ detail: 'Endpoint not found' });
    return;
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Initialize database and start server
async function startServer() {
  await db.init();
  app.listen(PORT, HOST, () => {
    console.log(`[Light Rhythm] Server listening on http://${HOST}:${PORT}`);
  });
}

startServer();
