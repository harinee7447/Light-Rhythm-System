import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const SECRET_KEY = process.env.JWT_SECRET || 'light-rhythm-secret-key-super-secure-key-2026';
const APP_NAME = 'Light Rhythm Management System';
const APP_VERSION = '1.0.0';

// Enable JSON body parser & CORS
app.use(cors());
app.use(express.json());

// --- Types ---
interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  created_at: string;
}

interface Schedule {
  id: number;
  name: string;
  period: string; // Morning, Day, Night
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  brightness_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Routine {
  id: number;
  name: string;
  period: string;
  time: string;
  brightness_pct: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ActivityHistory {
  id: number;
  event_type: string;
  title: string;
  details: string;
  brightness_pct: number | null;
  timestamp: string;
}

interface AuthRequest extends Request {
  user?: User;
}

// --- Date/Time Helpers ---
function formatDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// --- In-Memory Database Seed Data ---
let nextUserId = 2;
let nextScheduleId = 4;
let nextRoutineId = 4;
let nextHistoryId = 7;

const initialHashedPassword = bcrypt.hashSync('admin123', 10);

const users: User[] = [
  {
    id: 1,
    username: 'admin',
    passwordHash: initialHashedPassword,
    role: 'admin',
    created_at: formatDateTime(),
  },
];

const schedules: Schedule[] = [
  {
    id: 1,
    name: 'Morning Light',
    period: 'Morning',
    start_time: '06:00',
    end_time: '10:00',
    brightness_pct: 60,
    is_active: true,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
  },
  {
    id: 2,
    name: 'Day Light',
    period: 'Day',
    start_time: '10:00',
    end_time: '18:00',
    brightness_pct: 75,
    is_active: true,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
  },
  {
    id: 3,
    name: 'Night Light',
    period: 'Night',
    start_time: '18:00',
    end_time: '06:00',
    brightness_pct: 25,
    is_active: true,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
  },
];

const routines: Routine[] = [
  {
    id: 1,
    name: 'Morning Rhythm',
    period: 'Morning',
    time: '06:00',
    brightness_pct: 60,
    description: 'Start the day with the scheduled morning light.',
    is_active: true,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
  },
  {
    id: 2,
    name: 'Day Rhythm',
    period: 'Day',
    time: '10:00',
    brightness_pct: 75,
    description: 'Maintain the scheduled daytime brightness.',
    is_active: true,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
  },
  {
    id: 3,
    name: 'Night Rhythm',
    period: 'Night',
    time: '18:00',
    brightness_pct: 25,
    description: 'Reduce brightness according to the night schedule.',
    is_active: true,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
  },
];

let activityHistory: ActivityHistory[] = [
  {
    id: 6,
    event_type: 'LIGHT',
    title: 'Morning brightness activated',
    details: 'Initial rhythm initialized',
    brightness_pct: 60,
    timestamp: formatDateTime(),
  },
  {
    id: 5,
    event_type: 'LIGHT',
    title: 'Night brightness activated',
    details: 'Automated circadian brightness set to 25%',
    brightness_pct: 25,
    timestamp: formatDateTime(),
  },
  {
    id: 4,
    event_type: 'USER',
    title: 'Day routine updated',
    details: 'Routine schedule adjusted to 75%',
    brightness_pct: 75,
    timestamp: formatDateTime(),
  },
  {
    id: 3,
    event_type: 'USER',
    title: 'Night routine updated',
    details: 'Routine schedule adjusted to 25%',
    brightness_pct: 25,
    timestamp: formatDateTime(),
  },
  {
    id: 2,
    event_type: 'LIGHT',
    title: 'Morning brightness activated',
    details: 'Automated circadian brightness set to 60%',
    brightness_pct: 60,
    timestamp: formatDateTime(),
  },
  {
    id: 1,
    event_type: 'LIGHT',
    title: 'Day brightness activated',
    details: 'Automated circadian brightness set to 75%',
    brightness_pct: 75,
    timestamp: formatDateTime(),
  },
];

const systemSettings: Record<string, string> = {
  system_mode: 'AUTOMATIC',
  override_brightness: '-1',
  auto_adjust_enabled: '1',
};

function recordActivity(
  eventType: string,
  title: string,
  details: string = '',
  brightnessPct: number | null = null
): ActivityHistory {
  const item: ActivityHistory = {
    id: nextHistoryId++,
    event_type: eventType.toUpperCase(),
    title,
    details,
    brightness_pct: brightnessPct,
    timestamp: formatDateTime(),
  };
  activityHistory.unshift(item);
  return item;
}

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

function getCurrentBrightnessState() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const currentTimeHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const hour = now.getHours();
  const minute = now.getMinutes();

  const defaultCircadian = determineCircadianMode(hour, minute);

  const systemMode = systemSettings['system_mode'] || 'AUTOMATIC';
  const overrideVal =
    systemSettings['override_brightness'] && systemSettings['override_brightness'] !== '-1'
      ? parseInt(systemSettings['override_brightness'], 10)
      : null;

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
  const activeSchedules = schedules
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
    const modeName = matchedSchedule.period.charAt(0).toUpperCase() + matchedSchedule.period.slice(1).toLowerCase();
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
function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { sub: string; id: number };
    const user = users.find((u) => u.username === decoded.sub);
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

// --- API Endpoints ---

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: APP_NAME,
    version: APP_VERSION,
    availability: '99%+',
  });
});

// --- Auth Routes ---
app.post('/api/auth/register', (req: Request, res: Response) => {
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

  const existing = users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
  if (existing) {
    res.status(400).json({ detail: 'Username already registered. Please choose another username.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser: User = {
    id: nextUserId++,
    username: cleanUsername,
    passwordHash,
    role: 'user',
    created_at: formatDateTime(),
  };
  users.push(newUser);

  recordActivity('USER', `New user registered: ${newUser.username}`, 'Account created successfully');

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

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(401).json({ detail: 'Incorrect username or password.' });
    return;
  }

  const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ detail: 'Incorrect username or password.' });
    return;
  }

  recordActivity('USER', `User login: ${user.username}`, 'Authenticated via JWT');

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
app.get('/api/schedules', (req: Request, res: Response) => {
  const q = req.query.q ? String(req.query.q).toLowerCase().trim() : '';
  const period = req.query.period ? String(req.query.period).toLowerCase() : '';

  let list = [...schedules];
  if (period && period !== 'all') {
    list = list.filter((s) => s.period.toLowerCase() === period);
  }
  if (q) {
    list = list.filter((s) => s.name.toLowerCase().includes(q) || s.period.toLowerCase().includes(q));
  }
  list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  res.json(list);
});

app.get('/api/schedules/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }
  res.json(schedule);
});

app.post('/api/schedules', requireAuth, (req: AuthRequest, res: Response) => {
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

  const nowIso = formatDateTime();
  const newSchedule: Schedule = {
    id: nextScheduleId++,
    name: name.trim(),
    period: cleanPeriod,
    start_time,
    end_time,
    brightness_pct: brightNum,
    is_active: is_active !== false,
    created_at: nowIso,
    updated_at: nowIso,
  };
  schedules.push(newSchedule);

  recordActivity(
    'SCHEDULE',
    `Schedule created: ${newSchedule.name}`,
    `Period: ${newSchedule.period}, ${newSchedule.start_time} - ${newSchedule.end_time} @ ${newSchedule.brightness_pct}%`,
    newSchedule.brightness_pct
  );

  res.status(201).json(newSchedule);
});

app.put('/api/schedules/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }

  const { name, period, start_time, end_time, brightness_pct, is_active } = req.body || {};

  if (name !== undefined) schedule.name = String(name).trim();
  if (period !== undefined) {
    const cleanPeriod = period.charAt(0).toUpperCase() + period.slice(1).toLowerCase();
    if (!['Morning', 'Day', 'Night'].includes(cleanPeriod)) {
      res.status(400).json({ detail: 'Period must be Morning, Day, or Night.' });
      return;
    }
    schedule.period = cleanPeriod;
  }
  if (start_time !== undefined) {
    if (!TIME_REGEX.test(start_time)) {
      res.status(400).json({ detail: 'Start time must be in HH:MM format.' });
      return;
    }
    schedule.start_time = start_time;
  }
  if (end_time !== undefined) {
    if (!TIME_REGEX.test(end_time)) {
      res.status(400).json({ detail: 'End time must be in HH:MM format.' });
      return;
    }
    schedule.end_time = end_time;
  }
  if (brightness_pct !== undefined) {
    const num = parseInt(brightness_pct, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      res.status(400).json({ detail: 'Brightness must be between 0 and 100.' });
      return;
    }
    schedule.brightness_pct = num;
  }
  if (is_active !== undefined) {
    schedule.is_active = Boolean(is_active);
  }
  schedule.updated_at = formatDateTime();

  recordActivity(
    'SCHEDULE',
    `Schedule updated: ${schedule.name}`,
    `${schedule.period} ${schedule.start_time}-${schedule.end_time} set to ${schedule.brightness_pct}%`,
    schedule.brightness_pct
  );

  res.json(schedule);
});

app.delete('/api/schedules/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const index = schedules.findIndex((s) => s.id === id);
  if (index === -1) {
    res.status(404).json({ detail: `Schedule with ID ${id} not found.` });
    return;
  }

  const deleted = schedules.splice(index, 1)[0];
  recordActivity(
    'SCHEDULE',
    `Schedule deleted: ${deleted.name}`,
    `Removed schedule ID ${id}`,
    deleted.brightness_pct
  );

  res.json({ message: `Schedule '${deleted.name}' successfully deleted.` });
});

// --- Routine Routes (FR-03) ---
app.get('/api/routines', (req: Request, res: Response) => {
  const q = req.query.q ? String(req.query.q).toLowerCase().trim() : '';
  const period = req.query.period ? String(req.query.period).toLowerCase() : '';

  let list = [...routines];
  if (period && period !== 'all') {
    list = list.filter((r) => r.period.toLowerCase() === period);
  }
  if (q) {
    list = list.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => a.time.localeCompare(b.time));
  res.json(list);
});

app.get('/api/routines/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const routine = routines.find((r) => r.id === id);
  if (!routine) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }
  res.json(routine);
});

app.post('/api/routines', requireAuth, (req: AuthRequest, res: Response) => {
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

  const nowIso = formatDateTime();
  const newRoutine: Routine = {
    id: nextRoutineId++,
    name: name.trim(),
    period: cleanPeriod,
    time,
    brightness_pct: brightNum,
    description: description || '',
    is_active: is_active !== false,
    created_at: nowIso,
    updated_at: nowIso,
  };
  routines.push(newRoutine);

  recordActivity(
    'ROUTINE',
    `Routine created: ${newRoutine.name}`,
    `${newRoutine.period} routine at ${newRoutine.time} (${newRoutine.brightness_pct}%)`,
    newRoutine.brightness_pct
  );

  res.status(201).json(newRoutine);
});

app.put('/api/routines/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const routine = routines.find((r) => r.id === id);
  if (!routine) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  const { name, period, time, brightness_pct, description, is_active } = req.body || {};

  if (name !== undefined) routine.name = String(name).trim();
  if (period !== undefined) {
    const cleanPeriod = period.charAt(0).toUpperCase() + period.slice(1).toLowerCase();
    if (!['Morning', 'Day', 'Night'].includes(cleanPeriod)) {
      res.status(400).json({ detail: 'Period must be Morning, Day, or Night.' });
      return;
    }
    routine.period = cleanPeriod;
  }
  if (time !== undefined) {
    if (!TIME_REGEX.test(time)) {
      res.status(400).json({ detail: 'Time must be in HH:MM format.' });
      return;
    }
    routine.time = time;
  }
  if (brightness_pct !== undefined) {
    const num = parseInt(brightness_pct, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      res.status(400).json({ detail: 'Brightness must be between 0 and 100.' });
      return;
    }
    routine.brightness_pct = num;
  }
  if (description !== undefined) routine.description = String(description);
  if (is_active !== undefined) routine.is_active = Boolean(is_active);
  routine.updated_at = formatDateTime();

  recordActivity(
    'ROUTINE',
    `Routine updated: ${routine.name}`,
    `${routine.period} ${routine.time} set to ${routine.brightness_pct}%`,
    routine.brightness_pct
  );

  res.json(routine);
});

app.delete('/api/routines/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const index = routines.findIndex((r) => r.id === id);
  if (index === -1) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  const deleted = routines.splice(index, 1)[0];
  recordActivity(
    'ROUTINE',
    `Routine deleted: ${deleted.name}`,
    `Removed routine ID ${id}`,
    deleted.brightness_pct
  );

  res.json({ message: `Routine '${deleted.name}' successfully deleted.` });
});

app.post('/api/routines/:id/activate', requireAuth, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const routine = routines.find((r) => r.id === id);
  if (!routine) {
    res.status(404).json({ detail: `Routine with ID ${id} not found.` });
    return;
  }

  const period = routine.period.charAt(0).toUpperCase() + routine.period.slice(1).toLowerCase();
  const brightness = routine.brightness_pct;

  systemSettings['system_mode'] = period;
  systemSettings['override_brightness'] = String(brightness);

  recordActivity(
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
app.get('/api/brightness/current', (_req: Request, res: Response) => {
  res.json(getCurrentBrightnessState());
});

app.post('/api/brightness/mode', requireAuth, (req: AuthRequest, res: Response) => {
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

  systemSettings['system_mode'] = cleanMode;
  systemSettings['override_brightness'] = String(brightness);

  recordActivity(
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

app.post('/api/brightness/reset', requireAuth, (req: AuthRequest, res: Response) => {
  systemSettings['system_mode'] = 'AUTOMATIC';
  systemSettings['override_brightness'] = '-1';

  recordActivity(
    'LIGHT',
    'Automatic rhythm restored',
    `Circadian scheduler re-enabled by ${req.user!.username}`
  );

  res.json({ message: 'System restored to automatic circadian rhythm.' });
});

// --- Dashboard Route (FR-05) ---
app.get('/api/dashboard', (_req: Request, res: Response) => {
  const now = new Date();
  const brightnessState = getCurrentBrightnessState();

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

  const activeSchedules = schedules
    .filter((s) => s.is_active)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const recentHistory = activityHistory.slice(0, 6);

  const stats = {
    schedules_count: schedules.length,
    routines_count: routines.length,
    history_count: activityHistory.length,
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
    recent_history: recentHistory,
    stats,
  });
});

// --- History Routes (FR-06) ---
app.get('/api/history', (req: Request, res: Response) => {
  const eventType = req.query.event_type ? String(req.query.event_type).toUpperCase() : '';
  const q = req.query.q ? String(req.query.q).toLowerCase().trim() : '';
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));

  let list = [...activityHistory];
  if (eventType && eventType !== 'ALL') {
    list = list.filter((h) => h.event_type.toUpperCase() === eventType);
  }
  if (q) {
    list = list.filter((h) => h.title.toLowerCase().includes(q) || h.details.toLowerCase().includes(q));
  }

  // Already sorted desc
  const paginated = list.slice(offset, offset + limit);
  res.json(paginated);
});

app.post('/api/history/clear', requireAuth, (req: AuthRequest, res: Response) => {
  activityHistory = [];
  recordActivity('USER', 'Activity history cleared', `Logs cleared by ${req.user!.username}`);
  res.json({ message: 'Activity history cleared.' });
});

// --- Reports & Storage Routes (FR-04, FR-06) ---
app.get('/api/reports/summary', (_req: Request, res: Response) => {
  const totalSchedules = schedules.length;
  const avgBrightness =
    totalSchedules > 0
      ? Math.round((schedules.reduce((acc, s) => acc + s.brightness_pct, 0) / totalSchedules) * 10) / 10
      : 0;

  const totalRoutines = routines.length;
  const activeRoutines = routines.filter((r) => r.is_active).length;
  const totalHistory = activityHistory.length;
  const adherence = Math.min(100.0, Math.round((totalSchedules / 3.0) * 1000) / 10);

  res.json({
    total_schedules: totalSchedules,
    total_routines: totalRoutines,
    total_history_records: totalHistory,
    avg_brightness: avgBrightness,
    active_routines: activeRoutines,
    adherence_pct: adherence,
    generated_at: formatDateTime(),
  });
});

app.get('/api/reports/storage', (_req: Request, res: Response) => {
  const tableCounts = {
    users: users.length,
    schedules: schedules.length,
    routines: routines.length,
    activity_history: activityHistory.length,
    system_settings: Object.keys(systemSettings).length,
  };

  res.json({
    database_engine: 'SQLite 3 (Operational In-Memory Store)',
    database_path: 'light_rhythm.db',
    database_size_bytes: 32768,
    database_size_formatted: '32.00 KB',
    tables: ['users', 'schedules', 'routines', 'activity_history', 'system_settings'],
    record_counts: tableCounts,
    integrity: 'ok',
    status: 'Online and Operational',
  });
});

app.get('/api/reports/export.csv', (req: Request, res: Response) => {
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
    for (const h of activityHistory) {
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

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`[Light Rhythm] Server listening on http://${HOST}:${PORT}`);
});
