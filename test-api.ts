/**
 * Automated Test Suite for Light Rhythm Management System
 * Validates FR-01 through FR-06 and Auth (NFR-02, NFR-06)
 */

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message || String(err) });
    console.error(`✗ ${name}:`, err.message || String(err));
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runTests() {
  console.log('--- STARTING LIGHT RHYTHM API TEST SUITE ---');

  // 1. Health check
  await test('System Availability & Health Check (NFR-04)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(data.status === 'healthy', 'Expected status: healthy');
  });

  // 2. Auth - Register & Login
  let authToken = '';
  const testUser = `test_user_${Date.now()}`;
  await test('User Registration with Hashed Password (NFR-02, NFR-06)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'password123' }),
    });
    assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(!!data.access_token, 'Access token missing');
    assert(data.user.username === testUser, 'Username mismatch');
  });

  await test('User Authentication & JWT Issuance (NFR-06)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'password123' }),
    });
    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(!!data.access_token, 'Access token missing on login');
    authToken = data.access_token;
  });

  await test('Protected Route Authentication Check (NFR-06)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(data.username === testUser, 'User mismatch on /me');
  });

  // 3. FR-01: Schedules CRUD
  let createdScheduleId = 0;
  await test('FR-01: List Daily Schedules', async () => {
    const res = await fetch(`${BASE_URL}/api/schedules`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(Array.isArray(data) && data.length >= 3, 'Expected at least 3 seeded schedules');
  });

  await test('FR-01: Create Daily Light Schedule', async () => {
    const res = await fetch(`${BASE_URL}/api/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Late Evening Dim',
        period: 'Night',
        start_time: '21:00',
        end_time: '23:00',
        brightness_pct: 15,
        is_active: true,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(data.name === 'Late Evening Dim', 'Name mismatch');
    assert(data.brightness_pct === 15, 'Brightness mismatch');
    createdScheduleId = data.id;
  });

  await test('FR-01: Update Daily Schedule', async () => {
    const res = await fetch(`${BASE_URL}/api/schedules/${createdScheduleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Late Evening Ambient',
        brightness_pct: 20,
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(data.name === 'Late Evening Ambient', 'Updated name mismatch');
    assert(data.brightness_pct === 20, 'Updated brightness mismatch');
  });

  await test('FR-01: Delete Daily Schedule', async () => {
    const res = await fetch(`${BASE_URL}/api/schedules/${createdScheduleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // 4. FR-02: Brightness Control Engine
  await test('FR-02: Retrieve Current Brightness State', async () => {
    const res = await fetch(`${BASE_URL}/api/brightness/current`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(['Morning', 'Day', 'Night'].includes(data.current_mode), `Unexpected mode: ${data.current_mode}`);
    assert(typeof data.brightness_pct === 'number', 'Expected numeric brightness');
  });

  await test('FR-02: Override Brightness Mode', async () => {
    const res = await fetch(`${BASE_URL}/api/brightness/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ mode: 'Night', brightness_pct: 10 }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    const verify = await fetch(`${BASE_URL}/api/brightness/current`);
    const data = (await verify.json()) as any;
    assert(data.current_mode === 'Night', 'Mode should be Night');
    assert(data.brightness_pct === 10, 'Brightness should be 10');
  });

  await test('FR-02: Restore Automatic Circadian Rhythm', async () => {
    const res = await fetch(`${BASE_URL}/api/brightness/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    const verify = await fetch(`${BASE_URL}/api/brightness/current`);
    const data = (await verify.json()) as any;
    assert(data.is_automatic === true, 'System should be in automatic mode');
  });

  // 5. FR-03: Routines
  let createdRoutineId = 0;
  await test('FR-03: Create Light Routine', async () => {
    const res = await fetch(`${BASE_URL}/api/routines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Deep Focus Work',
        period: 'Day',
        time: '11:00',
        brightness_pct: 85,
        description: 'Focus mode for high concentration',
        is_active: true,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const data = (await res.json()) as any;
    createdRoutineId = data.id;
  });

  await test('FR-03: Trigger Routine Immediate Activation', async () => {
    const res = await fetch(`${BASE_URL}/api/routines/${createdRoutineId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    const verify = await fetch(`${BASE_URL}/api/brightness/current`);
    const data = (await verify.json()) as any;
    assert(data.brightness_pct === 85, 'Routine activation brightness mismatch');
  });

  await test('FR-03: Clean up Test Routine', async () => {
    const res = await fetch(`${BASE_URL}/api/routines/${createdRoutineId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // 6. FR-04: Storage Metrics
  await test('FR-04: Storage & SQLite/Supabase Metrics Endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/reports/storage`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(Array.isArray(data.tables) && data.tables.includes('schedules'), 'Tables list incomplete');
    assert(data.integrity === 'ok', 'Integrity check failed');
  });

  // 7. FR-05: Unified Dashboard
  await test('FR-05: Real-Time Circadian Dashboard (< 2s Response) (NFR-01)', async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    const duration = Date.now() - start;
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(duration < 2000, `Dashboard took ${duration}ms, exceeding 2000ms SLA`);
    const data = (await res.json()) as any;
    assert(!!data.current_mode, 'Missing current_mode');
    assert(Array.isArray(data.schedules), 'Missing schedules array');
    assert(Array.isArray(data.recent_history), 'Missing recent_history');
  });

  // 8. FR-06: Activity History & Audit Log
  await test('FR-06: Activity History Audit Log & CSV Export', async () => {
    const res = await fetch(`${BASE_URL}/api/history?limit=10`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const logs = (await res.json()) as any;
    assert(Array.isArray(logs) && logs.length > 0, 'Expected recorded activities');

    const csvRes = await fetch(`${BASE_URL}/api/reports/export.csv?type=history`);
    assert(csvRes.status === 200, `Expected 200 for CSV export, got ${csvRes.status}`);
    const text = await csvRes.text();
    assert(text.startsWith('ID,Event Type,Title'), 'CSV header mismatch');
  });

  // 9. AI Light Rhythm Assistant
  await test('AI: Dashboard Insights & Circadian Score', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/dashboard-insights`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(!!data.headline, 'Missing AI headline');
    assert(!!data.insight, 'Missing AI insight');
    assert(!!data.optimization_tip, 'Missing AI optimization tip');
    assert(!!data.smart_alert, 'Missing AI smart alert');
    assert(typeof data.circadian_score === 'number', 'Expected numeric score');
    assert(typeof data.recommended_brightness === 'number', 'Expected numeric brightness');
  });

  let aiScheduleAction: any = null;
  await test('AI: Natural Language Schedule Control ("Set morning light to bright at 7 AM")', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Set my morning light to bright at 7 AM' }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(!!data.reply && data.reply.length > 10, 'Expected detailed AI reply');
    assert(!!data.action, 'Expected proposed action from AI');
    assert(data.action.type === 'create_schedule', `Expected action type create_schedule, got ${data.action.type}`);
    aiScheduleAction = data.action;
  });

  await test('AI: Smart Routine Generator ("Create a relaxing evening routine")', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Create a relaxing evening routine' }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(!!data.reply, 'Expected AI reply');
    assert(data.action && data.action.type === 'create_routine', 'Expected create_routine action');
  });

  await test('AI: Apply Proposed Action to Database', async () => {
    assert(!!aiScheduleAction, 'No action to apply');
    const res = await fetch(`${BASE_URL}/api/ai/apply-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: aiScheduleAction }),
    });
    assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
    const data = (await res.json()) as any;
    assert(!!data.schedule && data.schedule.name === aiScheduleAction.data.name, 'Schedule name mismatch');

    // Clean up created schedule
    await fetch(`${BASE_URL}/api/schedules/${data.schedule.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
  });

  console.log('\n--- TEST SUITE SUMMARY ---');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests();
