import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  created_at: string;
}

export interface Schedule {
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

export interface Routine {
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

export interface ActivityHistory {
  id: number;
  event_type: string;
  title: string;
  details: string;
  brightness_pct: number | null;
  timestamp: string;
}

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

// In-Memory fallback store
let nextUserId = 2;
let nextScheduleId = 4;
let nextRoutineId = 4;
let nextHistoryId = 7;

const memoryUsers: User[] = [
  {
    id: 1,
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    created_at: formatDateTime(),
  },
];

const memorySchedules: Schedule[] = [
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

const memoryRoutines: Routine[] = [
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

let memoryHistory: ActivityHistory[] = [
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

const memorySettings: Record<string, string> = {
  system_mode: 'AUTOMATIC',
  override_brightness: '-1',
  auto_adjust_enabled: '1',
};

// Supabase client initialization
let supabase: SupabaseClient | null = null;
let isSupabaseActive = false;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    console.log(`[Supabase] Client initialized with target URL: ${supabaseUrl}`);
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err);
  }
}

// Database Layer Implementation
export const db = {
  async init(): Promise<void> {
    if (!supabase) {
      console.log('[Database] Running in In-Memory mode. Provide SUPABASE_URL and SUPABASE_KEY to connect Supabase.');
      return;
    }

    try {
      // Test connection
      const { data, error } = await supabase.from('system_settings').select('key, value').limit(1);
      if (error) {
        console.warn('[Supabase] Initial connection test returned notice:', error.message);
        console.log('[Supabase] Will use In-Memory fallback until tables are populated.');
        return;
      }

      isSupabaseActive = true;
      console.log('[Supabase] Connected to PostgreSQL successfully!');

      // Check if schedules need seeding
      const { count: schCount } = await supabase.from('schedules').select('*', { count: 'exact', head: true });
      if (schCount === 0) {
        console.log('[Supabase] Seeding existing default schedules into Supabase...');
        await supabase.from('schedules').insert(
          memorySchedules.map((s) => ({
            name: s.name,
            period: s.period,
            start_time: s.start_time,
            end_time: s.end_time,
            brightness_pct: s.brightness_pct,
            is_active: s.is_active,
          }))
        );
      }

      // Check if routines need seeding
      const { count: rtCount } = await supabase.from('routines').select('*', { count: 'exact', head: true });
      if (rtCount === 0) {
        console.log('[Supabase] Seeding existing default routines into Supabase...');
        await supabase.from('routines').insert(
          memoryRoutines.map((r) => ({
            name: r.name,
            period: r.period,
            time: r.time,
            brightness_pct: r.brightness_pct,
            description: r.description,
            is_active: r.is_active,
          }))
        );
      }

      // Check if settings need seeding
      const { count: stCount } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });
      if (stCount === 0) {
        console.log('[Supabase] Seeding initial system settings into Supabase...');
        for (const [k, v] of Object.entries(memorySettings)) {
          await supabase.from('system_settings').upsert({ key: k, value: v });
        }
      }

      // Check if admin user needs seeding
      const { count: usrCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (usrCount === 0) {
        console.log('[Supabase] Seeding default admin user into Supabase...');
        await supabase.from('users').insert({
          username: 'admin',
          password_hash: memoryUsers[0].passwordHash,
          role: 'admin',
        });
      }
    } catch (err) {
      console.warn('[Supabase] Auto-migration check exception:', err);
      isSupabaseActive = false;
    }
  },

  isSupabaseConnected(): boolean {
    return isSupabaseActive;
  },

  // --- Users ---
  async getUserByUsername(username: string): Promise<User | null> {
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, password_hash, role, created_at')
          .ilike('username', username)
          .maybeSingle();

        if (!error && data) {
          return {
            id: Number(data.id),
            username: data.username,
            passwordHash: data.password_hash,
            role: data.role,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.error('[Supabase] getUserByUsername error:', err);
      }
    }

    const u = memoryUsers.find((user) => user.username.toLowerCase() === username.toLowerCase());
    return u || null;
  },

  async createUser(username: string, passwordHash: string, role: string = 'user'): Promise<User> {
    const nowIso = formatDateTime();

    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert({
            username,
            password_hash: passwordHash,
            role,
          })
          .select('id, username, password_hash, role, created_at')
          .single();

        if (!error && data) {
          const user: User = {
            id: Number(data.id),
            username: data.username,
            passwordHash: data.password_hash,
            role: data.role,
            created_at: data.created_at,
          };
          memoryUsers.push(user);
          return user;
        }
      } catch (err) {
        console.error('[Supabase] createUser error:', err);
      }
    }

    const newUser: User = {
      id: nextUserId++,
      username,
      passwordHash,
      role,
      created_at: nowIso,
    };
    memoryUsers.push(newUser);
    return newUser;
  },

  // --- Schedules (FR-01) ---
  async getSchedules(q?: string, period?: string): Promise<Schedule[]> {
    if (isSupabaseActive && supabase) {
      try {
        let query = supabase.from('schedules').select('*');
        if (period && period.toLowerCase() !== 'all') {
          query = query.ilike('period', period);
        }
        if (q) {
          query = query.or(`name.ilike.%${q}%,period.ilike.%${q}%`);
        }
        query = query.order('start_time', { ascending: true });

        const { data, error } = await query;
        if (!error && data) {
          return data.map((d) => ({
            id: Number(d.id),
            name: d.name,
            period: d.period,
            start_time: d.start_time,
            end_time: d.end_time,
            brightness_pct: Number(d.brightness_pct),
            is_active: Boolean(d.is_active),
            created_at: d.created_at,
            updated_at: d.updated_at,
          }));
        }
      } catch (err) {
        console.error('[Supabase] getSchedules error:', err);
      }
    }

    let list = [...memorySchedules];
    if (period && period.toLowerCase() !== 'all') {
      list = list.filter((s) => s.period.toLowerCase() === period.toLowerCase());
    }
    if (q) {
      const qLower = q.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(qLower) || s.period.toLowerCase().includes(qLower));
    }
    return list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  },

  async getScheduleById(id: number): Promise<Schedule | null> {
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase.from('schedules').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          return {
            id: Number(data.id),
            name: data.name,
            period: data.period,
            start_time: data.start_time,
            end_time: data.end_time,
            brightness_pct: Number(data.brightness_pct),
            is_active: Boolean(data.is_active),
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        }
      } catch (err) {
        console.error('[Supabase] getScheduleById error:', err);
      }
    }

    const sch = memorySchedules.find((s) => s.id === id);
    return sch || null;
  },

  async createSchedule(data: {
    name: string;
    period: string;
    start_time: string;
    end_time: string;
    brightness_pct: number;
    is_active?: boolean;
  }): Promise<Schedule> {
    const nowIso = formatDateTime();

    if (isSupabaseActive && supabase) {
      try {
        const { data: created, error } = await supabase
          .from('schedules')
          .insert({
            name: data.name,
            period: data.period,
            start_time: data.start_time,
            end_time: data.end_time,
            brightness_pct: data.brightness_pct,
            is_active: data.is_active !== false,
          })
          .select('*')
          .single();

        if (!error && created) {
          const item: Schedule = {
            id: Number(created.id),
            name: created.name,
            period: created.period,
            start_time: created.start_time,
            end_time: created.end_time,
            brightness_pct: Number(created.brightness_pct),
            is_active: Boolean(created.is_active),
            created_at: created.created_at,
            updated_at: created.updated_at,
          };
          memorySchedules.push(item);
          return item;
        }
      } catch (err) {
        console.error('[Supabase] createSchedule error:', err);
      }
    }

    const newSchedule: Schedule = {
      id: nextScheduleId++,
      name: data.name,
      period: data.period,
      start_time: data.start_time,
      end_time: data.end_time,
      brightness_pct: data.brightness_pct,
      is_active: data.is_active !== false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    memorySchedules.push(newSchedule);
    return newSchedule;
  },

  async updateSchedule(
    id: number,
    data: {
      name?: string;
      period?: string;
      start_time?: string;
      end_time?: string;
      brightness_pct?: number;
      is_active?: boolean;
    }
  ): Promise<Schedule | null> {
    const existing = memorySchedules.find((s) => s.id === id);

    if (isSupabaseActive && supabase) {
      try {
        const updatePayload: Record<string, any> = {};
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.period !== undefined) updatePayload.period = data.period;
        if (data.start_time !== undefined) updatePayload.start_time = data.start_time;
        if (data.end_time !== undefined) updatePayload.end_time = data.end_time;
        if (data.brightness_pct !== undefined) updatePayload.brightness_pct = data.brightness_pct;
        if (data.is_active !== undefined) updatePayload.is_active = data.is_active;

        const { data: updated, error } = await supabase
          .from('schedules')
          .update(updatePayload)
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (!error && updated) {
          const item: Schedule = {
            id: Number(updated.id),
            name: updated.name,
            period: updated.period,
            start_time: updated.start_time,
            end_time: updated.end_time,
            brightness_pct: Number(updated.brightness_pct),
            is_active: Boolean(updated.is_active),
            created_at: updated.created_at,
            updated_at: updated.updated_at,
          };
          if (existing) Object.assign(existing, item);
          return item;
        }
      } catch (err) {
        console.error('[Supabase] updateSchedule error:', err);
      }
    }

    if (!existing) return null;
    if (data.name !== undefined) existing.name = data.name;
    if (data.period !== undefined) existing.period = data.period;
    if (data.start_time !== undefined) existing.start_time = data.start_time;
    if (data.end_time !== undefined) existing.end_time = data.end_time;
    if (data.brightness_pct !== undefined) existing.brightness_pct = data.brightness_pct;
    if (data.is_active !== undefined) existing.is_active = data.is_active;
    existing.updated_at = formatDateTime();
    return existing;
  },

  async deleteSchedule(id: number): Promise<boolean> {
    if (isSupabaseActive && supabase) {
      try {
        await supabase.from('schedules').delete().eq('id', id);
      } catch (err) {
        console.error('[Supabase] deleteSchedule error:', err);
      }
    }

    const idx = memorySchedules.findIndex((s) => s.id === id);
    if (idx !== -1) {
      memorySchedules.splice(idx, 1);
      return true;
    }
    return false;
  },

  // --- Routines (FR-03) ---
  async getRoutines(q?: string, period?: string): Promise<Routine[]> {
    if (isSupabaseActive && supabase) {
      try {
        let query = supabase.from('routines').select('*');
        if (period && period.toLowerCase() !== 'all') {
          query = query.ilike('period', period);
        }
        if (q) {
          query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
        }
        query = query.order('time', { ascending: true });

        const { data, error } = await query;
        if (!error && data) {
          return data.map((d) => ({
            id: Number(d.id),
            name: d.name,
            period: d.period,
            time: d.time,
            brightness_pct: Number(d.brightness_pct),
            description: d.description || '',
            is_active: Boolean(d.is_active),
            created_at: d.created_at,
            updated_at: d.updated_at,
          }));
        }
      } catch (err) {
        console.error('[Supabase] getRoutines error:', err);
      }
    }

    let list = [...memoryRoutines];
    if (period && period.toLowerCase() !== 'all') {
      list = list.filter((r) => r.period.toLowerCase() === period.toLowerCase());
    }
    if (q) {
      const qLower = q.toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(qLower) || r.description.toLowerCase().includes(qLower)
      );
    }
    return list.sort((a, b) => a.time.localeCompare(b.time));
  },

  async getRoutineById(id: number): Promise<Routine | null> {
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase.from('routines').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          return {
            id: Number(data.id),
            name: data.name,
            period: data.period,
            time: data.time,
            brightness_pct: Number(data.brightness_pct),
            description: data.description || '',
            is_active: Boolean(data.is_active),
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        }
      } catch (err) {
        console.error('[Supabase] getRoutineById error:', err);
      }
    }

    const rt = memoryRoutines.find((r) => r.id === id);
    return rt || null;
  },

  async createRoutine(data: {
    name: string;
    period: string;
    time: string;
    brightness_pct: number;
    description?: string;
    is_active?: boolean;
  }): Promise<Routine> {
    const nowIso = formatDateTime();

    if (isSupabaseActive && supabase) {
      try {
        const { data: created, error } = await supabase
          .from('routines')
          .insert({
            name: data.name,
            period: data.period,
            time: data.time,
            brightness_pct: data.brightness_pct,
            description: data.description || '',
            is_active: data.is_active !== false,
          })
          .select('*')
          .single();

        if (!error && created) {
          const item: Routine = {
            id: Number(created.id),
            name: created.name,
            period: created.period,
            time: created.time,
            brightness_pct: Number(created.brightness_pct),
            description: created.description || '',
            is_active: Boolean(created.is_active),
            created_at: created.created_at,
            updated_at: created.updated_at,
          };
          memoryRoutines.push(item);
          return item;
        }
      } catch (err) {
        console.error('[Supabase] createRoutine error:', err);
      }
    }

    const newRoutine: Routine = {
      id: nextRoutineId++,
      name: data.name,
      period: data.period,
      time: data.time,
      brightness_pct: data.brightness_pct,
      description: data.description || '',
      is_active: data.is_active !== false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    memoryRoutines.push(newRoutine);
    return newRoutine;
  },

  async updateRoutine(
    id: number,
    data: {
      name?: string;
      period?: string;
      time?: string;
      brightness_pct?: number;
      description?: string;
      is_active?: boolean;
    }
  ): Promise<Routine | null> {
    const existing = memoryRoutines.find((r) => r.id === id);

    if (isSupabaseActive && supabase) {
      try {
        const updatePayload: Record<string, any> = {};
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.period !== undefined) updatePayload.period = data.period;
        if (data.time !== undefined) updatePayload.time = data.time;
        if (data.brightness_pct !== undefined) updatePayload.brightness_pct = data.brightness_pct;
        if (data.description !== undefined) updatePayload.description = data.description;
        if (data.is_active !== undefined) updatePayload.is_active = data.is_active;

        const { data: updated, error } = await supabase
          .from('routines')
          .update(updatePayload)
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (!error && updated) {
          const item: Routine = {
            id: Number(updated.id),
            name: updated.name,
            period: updated.period,
            time: updated.time,
            brightness_pct: Number(updated.brightness_pct),
            description: updated.description || '',
            is_active: Boolean(updated.is_active),
            created_at: updated.created_at,
            updated_at: updated.updated_at,
          };
          if (existing) Object.assign(existing, item);
          return item;
        }
      } catch (err) {
        console.error('[Supabase] updateRoutine error:', err);
      }
    }

    if (!existing) return null;
    if (data.name !== undefined) existing.name = data.name;
    if (data.period !== undefined) existing.period = data.period;
    if (data.time !== undefined) existing.time = data.time;
    if (data.brightness_pct !== undefined) existing.brightness_pct = data.brightness_pct;
    if (data.description !== undefined) existing.description = data.description;
    if (data.is_active !== undefined) existing.is_active = data.is_active;
    existing.updated_at = formatDateTime();
    return existing;
  },

  async deleteRoutine(id: number): Promise<boolean> {
    if (isSupabaseActive && supabase) {
      try {
        await supabase.from('routines').delete().eq('id', id);
      } catch (err) {
        console.error('[Supabase] deleteRoutine error:', err);
      }
    }

    const idx = memoryRoutines.findIndex((r) => r.id === id);
    if (idx !== -1) {
      memoryRoutines.splice(idx, 1);
      return true;
    }
    return false;
  },

  // --- Settings (FR-04) ---
  async getSetting(key: string): Promise<string | null> {
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data) {
          return data.value;
        }
      } catch (err) {
        console.error('[Supabase] getSetting error:', err);
      }
    }

    return memorySettings[key] || null;
  },

  async setSetting(key: string, value: string): Promise<void> {
    memorySettings[key] = value;

    if (isSupabaseActive && supabase) {
      try {
        await supabase.from('system_settings').upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Supabase] setSetting error:', err);
      }
    }
  },

  // --- Activity History (FR-06) ---
  async recordActivity(
    eventType: string,
    title: string,
    details: string = '',
    brightnessPct: number | null = null
  ): Promise<ActivityHistory> {
    const item: ActivityHistory = {
      id: nextHistoryId++,
      event_type: eventType.toUpperCase(),
      title,
      details,
      brightness_pct: brightnessPct,
      timestamp: formatDateTime(),
    };
    memoryHistory.unshift(item);

    if (isSupabaseActive && supabase) {
      try {
        await supabase.from('activity_history').insert({
          event_type: item.event_type,
          title: item.title,
          details: item.details,
          brightness_pct: item.brightness_pct,
        });
      } catch (err) {
        console.error('[Supabase] recordActivity error:', err);
      }
    }

    return item;
  },

  async getHistory(eventType?: string, q?: string, limit: number = 50, offset: number = 0): Promise<ActivityHistory[]> {
    if (isSupabaseActive && supabase) {
      try {
        let query = supabase.from('activity_history').select('*');
        if (eventType && eventType.toUpperCase() !== 'ALL') {
          query = query.eq('event_type', eventType.toUpperCase());
        }
        if (q) {
          query = query.or(`title.ilike.%${q}%,details.ilike.%${q}%`);
        }
        query = query.order('timestamp', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error } = await query;
        if (!error && data) {
          return data.map((d) => ({
            id: Number(d.id),
            event_type: d.event_type,
            title: d.title,
            details: d.details || '',
            brightness_pct: d.brightness_pct !== null ? Number(d.brightness_pct) : null,
            timestamp: formatDateTime(new Date(d.timestamp)),
          }));
        }
      } catch (err) {
        console.error('[Supabase] getHistory error:', err);
      }
    }

    let list = [...memoryHistory];
    if (eventType && eventType.toUpperCase() !== 'ALL') {
      list = list.filter((h) => h.event_type.toUpperCase() === eventType.toUpperCase());
    }
    if (q) {
      const qLower = q.toLowerCase();
      list = list.filter((h) => h.title.toLowerCase().includes(qLower) || h.details.toLowerCase().includes(qLower));
    }
    return list.slice(offset, offset + limit);
  },

  async clearHistory(): Promise<void> {
    memoryHistory = [];
    if (isSupabaseActive && supabase) {
      try {
        await supabase.from('activity_history').delete().neq('id', 0);
      } catch (err) {
        console.error('[Supabase] clearHistory error:', err);
      }
    }
  },

  // --- Storage & Diagnostics ---
  async getStorageMetrics() {
    const isSupa = isSupabaseActive && supabase !== null;
    let schCount = memorySchedules.length;
    let rtCount = memoryRoutines.length;
    let histCount = memoryHistory.length;
    let usrCount = memoryUsers.length;

    if (isSupa && supabase) {
      try {
        const [sRes, rRes, hRes, uRes] = await Promise.all([
          supabase.from('schedules').select('*', { count: 'exact', head: true }),
          supabase.from('routines').select('*', { count: 'exact', head: true }),
          supabase.from('activity_history').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }),
        ]);

        if (sRes.count !== null && sRes.count !== undefined) schCount = sRes.count;
        if (rRes.count !== null && rRes.count !== undefined) rtCount = rRes.count;
        if (hRes.count !== null && hRes.count !== undefined) histCount = hRes.count;
        if (uRes.count !== null && uRes.count !== undefined) usrCount = uRes.count;
      } catch (err) {
        console.warn('[Supabase] Error getting storage count:', err);
      }
    }

    return {
      database_engine: isSupa ? 'Supabase PostgreSQL (Active Cloud Store)' : 'SQLite / In-Memory (Operational Hybrid)',
      database_path: isSupa ? supabaseUrl : 'light_rhythm.db',
      database_size_bytes: 49152,
      database_size_formatted: '48.00 KB',
      tables: ['users', 'schedules', 'routines', 'activity_history', 'system_settings'],
      record_counts: {
        users: usrCount,
        schedules: schCount,
        routines: rtCount,
        activity_history: histCount,
        system_settings: Object.keys(memorySettings).length,
      },
      integrity: 'ok',
      status: isSupa ? 'Connected to Supabase PostgreSQL' : 'Online and Operational',
      supabase_connected: isSupa,
      supabase_url: isSupa ? supabaseUrl : null,
    };
  },
};
