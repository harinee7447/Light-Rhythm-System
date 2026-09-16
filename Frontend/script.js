/* =====================================================
   LIGHT RHYTHM MANAGEMENT SYSTEM
   Interactive Frontend Client & State Manager
   Compliant with SRS.md (FR-01 to FR-06, NFR-01 to NFR-06)
===================================================== */

// --- API Client Helpers ---
const API_BASE = "";

function getStoredToken() {
    return localStorage.getItem("light_rhythm_token");
}

function getStoredUser() {
    try {
        const u = localStorage.getItem("light_rhythm_user");
        return u ? JSON.parse(u) : null;
    } catch {
        return null;
    }
}

function setAuthSession(token, user) {
    localStorage.setItem("light_rhythm_token", token);
    localStorage.setItem("light_rhythm_user", JSON.stringify(user));
    updateAuthUI();
}

function clearAuthSession() {
    localStorage.removeItem("light_rhythm_token");
    localStorage.removeItem("light_rhythm_user");
    updateAuthUI();
}

async function apiFetch(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = getStoredToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        if (res.status === 401) {
            // Unauthenticated
            if (token) {
                // Expired token
                clearAuthSession();
                showToast("Session Expired", "Please log in again.", true);
            }
            openAuthModal();
            throw new Error("Authentication required.");
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errorMsg = data.detail || (typeof data === "string" ? data : "Request failed.");
            throw new Error(errorMsg);
        }
        return data;
    } catch (err) {
        throw err;
    }
}

// --- Toast Notifications ---
const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");
let toastTimer = null;

function showToast(title, message, isError = false) {
    if (!toast) return;
    toastTitle.textContent = title;
    toastMessage.textContent = message;

    if (isError) {
        toast.classList.add("error");
        toastIcon.textContent = "✕";
    } else {
        toast.classList.remove("error");
        toastIcon.textContent = "✓";
    }

    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

// --- Navigation Controller ---
const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const breadcrumbText = document.getElementById("breadcrumbText");
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");

function showPage(pageId) {
    pages.forEach(p => p.classList.remove("active-page"));
    navItems.forEach(n => n.classList.remove("active"));

    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add("active-page");
    }

    navItems.forEach(item => {
        if (item.dataset.section === pageId) {
            item.classList.add("active");
        }
    });

    if (breadcrumbText) {
        breadcrumbText.textContent = pageId.toUpperCase();
    }

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    // Refresh page data when visited
    if (pageId === "dashboard") refreshDashboard();
    else if (pageId === "schedules") loadSchedules();
    else if (pageId === "brightness") loadBrightnessView();
    else if (pageId === "routines") loadRoutines();
    else if (pageId === "storage") loadStorageMetrics();
    else if (pageId === "history") loadHistory();
    else if (pageId === "reports") loadReports();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

navItems.forEach(item => {
    item.addEventListener("click", () => showPage(item.dataset.section));
});

document.querySelectorAll("[data-section-link]").forEach(elem => {
    elem.addEventListener("click", () => showPage(elem.dataset.sectionLink));
});

if (menuButton) {
    menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (sidebar) sidebar.classList.remove("open");
        closeAllModals();
    }
});

// --- Real-time Clock & Circadian Position ---
const currentTimeEl = document.getElementById("currentTime");
const bigTimeEl = document.getElementById("bigTime");
const todayDateEl = document.getElementById("todayDate");
const currentPositionEl = document.getElementById("currentPosition");

function updateLiveClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    if (currentTimeEl) currentTimeEl.textContent = `${hh}:${mm}:${ss}`;
    if (bigTimeEl) bigTimeEl.textContent = `${hh}:${mm}`;

    if (todayDateEl) {
        todayDateEl.textContent = now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric"
        });
    }

    // Position dot on 24-hour curve (1440 minutes in 24h)
    if (currentPositionEl) {
        const totalMinutes = hours * 60 + minutes;
        const pct = (totalMinutes / 1440) * 100;
        currentPositionEl.style.left = `${pct}%`;
    }
}

setInterval(updateLiveClock, 1000);
updateLiveClock();

// --- Auth UI & Modal Management ---
const authBox = document.getElementById("authBox");
const userProfileBtn = document.getElementById("userProfileBtn");
const userAvatar = document.getElementById("userAvatar");
const userDisplayName = document.getElementById("userDisplayName");
const userRoleLabel = document.getElementById("userRoleLabel");
const authActionBtn = document.getElementById("authActionBtn");

const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const regError = document.getElementById("regError");

function updateAuthUI() {
    const user = getStoredUser();
    if (user && user.username) {
        userAvatar.textContent = user.username[0].toUpperCase();
        userDisplayName.textContent = user.username;
        userRoleLabel.textContent = user.role ? user.role.toUpperCase() : "USER";
        authActionBtn.textContent = "Sign Out";
    } else {
        userAvatar.textContent = "G";
        userDisplayName.textContent = "Guest";
        userRoleLabel.textContent = "Click to Login";
        authActionBtn.textContent = "Sign In";
    }
}

function openAuthModal(mode = "login") {
    authModal.classList.add("open");
    loginError.textContent = "";
    regError.textContent = "";
    if (mode === "login") {
        tabLoginBtn.classList.add("active");
        tabRegisterBtn.classList.remove("active");
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
    } else {
        tabLoginBtn.classList.remove("active");
        tabRegisterBtn.classList.add("active");
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
    }
}

if (userProfileBtn) {
    userProfileBtn.addEventListener("click", () => {
        if (!getStoredToken()) openAuthModal("login");
    });
}

if (authActionBtn) {
    authActionBtn.addEventListener("click", () => {
        if (getStoredToken()) {
            clearAuthSession();
            showToast("Signed Out", "You have been logged out.");
            refreshDashboard();
        } else {
            openAuthModal("login");
        }
    });
}

if (tabLoginBtn) {
    tabLoginBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthModal("login");
    });
}

if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthModal("register");
    });
}

if (closeAuthModal) {
    closeAuthModal.addEventListener("click", () => authModal.classList.remove("open"));
}

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginError.textContent = "";
        const username = document.getElementById("loginUsername").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const data = await apiFetch("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password })
            });
            setAuthSession(data.access_token, data.user);
            authModal.classList.remove("open");
            showToast("Welcome Back", `Signed in as ${data.user.username}`);
            refreshDashboard();
        } catch (err) {
            loginError.textContent = err.message;
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        regError.textContent = "";
        const username = document.getElementById("regUsername").value.trim();
        const password = document.getElementById("regPassword").value;

        try {
            const data = await apiFetch("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ username, password })
            });
            setAuthSession(data.access_token, data.user);
            authModal.classList.remove("open");
            showToast("Account Created", `Registered and logged in as ${data.user.username}`);
            refreshDashboard();
        } catch (err) {
            regError.textContent = err.message;
        }
    });
}

// --- Modals Close Utility ---
function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open"));
}

document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.remove("open");
    });
});

// --- 1. DASHBOARD PAGE (FR-05) ---
async function refreshDashboard() {
    try {
        const data = await apiFetch("/api/dashboard");

        // Update greeting & period
        const greetingEl = document.getElementById("greeting");
        const dayPeriodEl = document.getElementById("dayPeriod");
        const currentModeEl = document.getElementById("currentMode");
        const modeMetaEl = document.getElementById("modeMeta");
        const currentDescEl = document.getElementById("currentDescription");
        const lightSymbolEl = document.getElementById("lightSymbol");
        const brightnessValEl = document.getElementById("brightnessValue");
        const brightnessMetaEl = document.getElementById("brightnessMeta");
        const brightnessFillEl = document.getElementById("brightnessFill");
        const activeScheduleMetaEl = document.getElementById("activeScheduleMeta");

        if (greetingEl) greetingEl.textContent = data.greeting;
        if (dayPeriodEl) dayPeriodEl.textContent = data.day_period;
        if (currentModeEl) currentModeEl.textContent = data.current_mode;
        if (modeMetaEl) modeMetaEl.textContent = data.current_mode.toUpperCase();
        if (lightSymbolEl) lightSymbolEl.textContent = data.symbol;
        if (brightnessValEl) brightnessValEl.textContent = data.brightness_pct;
        if (brightnessMetaEl) brightnessMetaEl.textContent = data.brightness_pct;
        if (brightnessFillEl) brightnessFillEl.style.width = `${data.brightness_pct}%`;

        // Update summary counts
        if (data.stats) {
            const morningEl = document.getElementById("morningLevelVal");
            const dayEl = document.getElementById("dayLevelVal");
            const nightEl = document.getElementById("nightLevelVal");
            const histCountEl = document.getElementById("historyCount");

            if (morningEl) morningEl.textContent = `${data.stats.morning_level}%`;
            if (dayEl) dayEl.textContent = `${data.stats.day_level}%`;
            if (nightEl) nightEl.textContent = `${data.stats.night_level}%`;
            if (histCountEl) histCountEl.textContent = String(data.stats.history_count).padStart(2, "0");
        }

        // Render Dashboard Upcoming Schedules
        const schContainer = document.getElementById("dashboardScheduleList");
        if (schContainer && data.schedules) {
            if (data.schedules.length === 0) {
                schContainer.innerHTML = `<div class="schedule-row"><small>No schedules configured.</small></div>`;
            } else {
                schContainer.innerHTML = data.schedules.map(s => `
                    <div class="schedule-row ${s.period.toLowerCase() === data.current_mode.toLowerCase() ? 'active' : ''}">
                        <div class="schedule-time">${s.start_time}</div>
                        <div class="schedule-marker"><span></span></div>
                        <div class="schedule-info">
                            <strong>${escapeHtml(s.name)}</strong>
                            <small>${s.period} · ${s.start_time} — ${s.end_time}</small>
                        </div>
                        <div class="schedule-value">${s.brightness_pct}%</div>
                    </div>
                `).join("");
            }
        }

        // Render Dashboard Activity Feed
        const actContainer = document.getElementById("dashboardActivityList");
        if (actContainer && data.recent_history) {
            if (data.recent_history.length === 0) {
                actContainer.innerHTML = `<div class="activity"><small>No recorded activity yet.</small></div>`;
            } else {
                actContainer.innerHTML = data.recent_history.map(h => `
                    <div class="activity ${h.event_type.toLowerCase()}">
                        <div class="activity-dot"></div>
                        <div class="activity-info">
                            <strong>${escapeHtml(h.title)}</strong>
                            <small>${escapeHtml(h.details || h.timestamp)}</small>
                        </div>
                        <span class="activity-val">${h.brightness_pct !== null ? h.brightness_pct + '%' : '—'}</span>
                    </div>
                `).join("");
            }
        }

    } catch (err) {
        console.error("Dashboard refresh error:", err);
    }
}

// Quick Mode buttons
document.querySelectorAll("[data-quick-mode]").forEach(btn => {
    btn.addEventListener("click", async () => {
        const mode = btn.dataset.quickMode;
        try {
            await apiFetch("/api/brightness/mode", {
                method: "POST",
                body: JSON.stringify({ mode })
            });
            showToast("Mode Switched", `${mode} mode activated.`);
            refreshDashboard();
        } catch (err) {
            showToast("Action Failed", err.message, true);
        }
    });
});

const resetAutoBtn = document.getElementById("resetAutoBtn");
if (resetAutoBtn) {
    resetAutoBtn.addEventListener("click", async () => {
        try {
            await apiFetch("/api/brightness/reset", { method: "POST" });
            showToast("Circadian Restored", "Automatic light rhythm restored.");
            refreshDashboard();
        } catch (err) {
            showToast("Action Failed", err.message, true);
        }
    });
}

// --- 2. SCHEDULES PAGE (FR-01) ---
const schedulesContainer = document.getElementById("schedulesContainer");
const scheduleSearchInput = document.getElementById("scheduleSearchInput");
const scheduleFilterSelect = document.getElementById("scheduleFilterSelect");
const openAddScheduleBtn = document.getElementById("openAddScheduleBtn");

const scheduleModal = document.getElementById("scheduleModal");
const scheduleForm = document.getElementById("scheduleForm");
const scheduleModalTitle = document.getElementById("scheduleModalTitle");
const closeScheduleModal = document.getElementById("closeScheduleModal");
const cancelScheduleBtn = document.getElementById("cancelScheduleBtn");
const scheduleFormError = document.getElementById("scheduleFormError");

const schBrightnessInput = document.getElementById("schBrightness");
const schBrightDisplay = document.getElementById("schBrightDisplay");

if (schBrightnessInput && schBrightDisplay) {
    schBrightnessInput.addEventListener("input", () => {
        schBrightDisplay.textContent = `${schBrightnessInput.value}%`;
    });
}

async function loadSchedules() {
    if (!schedulesContainer) return;
    try {
        const q = scheduleSearchInput ? scheduleSearchInput.value.trim() : "";
        const period = scheduleFilterSelect ? scheduleFilterSelect.value : "All";
        let url = `/api/schedules?`;
        if (q) url += `q=${encodeURIComponent(q)}&`;
        if (period && period !== "All") url += `period=${encodeURIComponent(period)}&`;

        const schedules = await apiFetch(url);

        if (schedules.length === 0) {
            schedulesContainer.innerHTML = `
                <div style="text-align:center; padding: 40px; color: var(--text-muted);">
                    <p>No schedules found matching your query.</p>
                </div>
            `;
            return;
        }

        schedulesContainer.innerHTML = schedules.map(s => {
            const periodClass = s.period.toLowerCase();
            return `
                <div class="timeline-item">
                    <span class="timeline-time">${s.start_time}</span>
                    <div class="timeline-point ${periodClass}"></div>
                    <div class="timeline-card">
                        <div class="timeline-card-content">
                            <span class="tag ${periodClass}-tag">${s.period.toUpperCase()}</span>
                            <h3>${escapeHtml(s.name)}</h3>
                            <p>${s.start_time} — ${s.end_time} · ${s.is_active ? 'Active' : 'Inactive'}</p>
                        </div>
                        <div class="timeline-card-actions">
                            <strong>${s.brightness_pct}%</strong>
                            <button class="action-btn" onclick="openEditSchedule(${s.id})">Edit</button>
                            <button class="action-btn delete" onclick="confirmDeleteSchedule(${s.id}, '${escapeJsString(s.name)}')">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        schedulesContainer.innerHTML = `<div class="form-error">Failed to load schedules: ${err.message}</div>`;
    }
}

if (scheduleSearchInput) {
    scheduleSearchInput.addEventListener("input", debounce(loadSchedules, 300));
}

if (scheduleFilterSelect) {
    scheduleFilterSelect.addEventListener("change", loadSchedules);
}

if (openAddScheduleBtn) {
    openAddScheduleBtn.addEventListener("click", () => {
        scheduleModalTitle.textContent = "Add Daily Schedule";
        document.getElementById("scheduleEditId").value = "";
        document.getElementById("schName").value = "";
        document.getElementById("schPeriod").value = "Morning";
        document.getElementById("schStart").value = "06:00";
        document.getElementById("schEnd").value = "10:00";
        schBrightnessInput.value = 60;
        schBrightDisplay.textContent = "60%";
        document.getElementById("schActive").checked = true;
        scheduleFormError.textContent = "";
        scheduleModal.classList.add("open");
    });
}

if (closeScheduleModal) closeScheduleModal.addEventListener("click", () => scheduleModal.classList.remove("open"));
if (cancelScheduleBtn) cancelScheduleBtn.addEventListener("click", () => scheduleModal.classList.remove("open"));

window.openEditSchedule = async function(id) {
    try {
        const s = await apiFetch(`/api/schedules/${id}`);
        scheduleModalTitle.textContent = "Edit Daily Schedule";
        document.getElementById("scheduleEditId").value = s.id;
        document.getElementById("schName").value = s.name;
        document.getElementById("schPeriod").value = s.period;
        document.getElementById("schStart").value = s.start_time;
        document.getElementById("schEnd").value = s.end_time;
        schBrightnessInput.value = s.brightness_pct;
        schBrightDisplay.textContent = `${s.brightness_pct}%`;
        document.getElementById("schActive").checked = s.is_active;
        scheduleFormError.textContent = "";
        scheduleModal.classList.add("open");
    } catch (err) {
        showToast("Error", err.message, true);
    }
};

if (scheduleForm) {
    scheduleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        scheduleFormError.textContent = "";
        const id = document.getElementById("scheduleEditId").value;
        const payload = {
            name: document.getElementById("schName").value.trim(),
            period: document.getElementById("schPeriod").value,
            start_time: document.getElementById("schStart").value,
            end_time: document.getElementById("schEnd").value,
            brightness_pct: parseInt(schBrightnessInput.value, 10),
            is_active: document.getElementById("schActive").checked
        };

        try {
            if (id) {
                await apiFetch(`/api/schedules/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                showToast("Schedule Updated", `${payload.name} has been updated.`);
            } else {
                await apiFetch("/api/schedules", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                showToast("Schedule Created", `${payload.name} has been created.`);
            }
            scheduleModal.classList.remove("open");
            loadSchedules();
            refreshDashboard();
        } catch (err) {
            scheduleFormError.textContent = err.message;
        }
    });
}

// Delete confirmation modal wiring
const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const closeConfirmModal = document.getElementById("closeConfirmModal");
const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");
const executeConfirmBtn = document.getElementById("executeConfirmBtn");
let confirmActionCallback = null;

function showConfirm(title, message, callback) {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmActionCallback = callback;
    confirmModal.classList.add("open");
}

if (closeConfirmModal) closeConfirmModal.addEventListener("click", () => confirmModal.classList.remove("open"));
if (cancelConfirmBtn) cancelConfirmBtn.addEventListener("click", () => confirmModal.classList.remove("open"));
if (executeConfirmBtn) {
    executeConfirmBtn.addEventListener("click", async () => {
        if (confirmActionCallback) {
            await confirmActionCallback();
        }
        confirmModal.classList.remove("open");
    });
}

window.confirmDeleteSchedule = function(id, name) {
    showConfirm(
        "Delete Schedule",
        `Are you sure you want to delete the schedule "${name}"?`,
        async () => {
            try {
                await apiFetch(`/api/schedules/${id}`, { method: "DELETE" });
                showToast("Deleted", `Schedule "${name}" was removed.`);
                loadSchedules();
                refreshDashboard();
            } catch (err) {
                showToast("Delete Failed", err.message, true);
            }
        }
    );
};

// --- 3. BRIGHTNESS ENGINE (FR-02) ---
async function loadBrightnessView() {
    try {
        const state = await apiFetch("/api/brightness/current");
        const orbVal = document.getElementById("orbValue");
        const title = document.getElementById("brightnessModeTitle");
        const subtitle = document.getElementById("brightnessModeSubtitle");
        const orbGlow = document.getElementById("brightnessOrbGlow");

        if (orbVal) orbVal.textContent = state.brightness_pct;
        if (title) title.textContent = state.current_mode;
        if (subtitle) subtitle.textContent = state.description;

        // Highlight selected mode card
        document.querySelectorAll(".brightness-mode").forEach(card => {
            if (card.dataset.mode.toLowerCase() === state.current_mode.toLowerCase()) {
                card.classList.add("selected");
            } else {
                card.classList.remove("selected");
            }
        });

        // Set orb glow color
        if (orbGlow) {
            if (state.current_mode === "Morning") {
                orbGlow.style.background = "radial-gradient(circle, rgba(246, 166, 91, 0.4), transparent 70%)";
            } else if (state.current_mode === "Day") {
                orbGlow.style.background = "radial-gradient(circle, rgba(215, 243, 107, 0.4), transparent 70%)";
            } else {
                orbGlow.style.background = "radial-gradient(circle, rgba(184, 156, 255, 0.4), transparent 70%)";
            }
        }
    } catch (err) {
        console.error("Brightness load error:", err);
    }
}

document.querySelectorAll(".brightness-mode").forEach(card => {
    card.addEventListener("click", async () => {
        const mode = card.dataset.mode;
        try {
            await apiFetch("/api/brightness/mode", {
                method: "POST",
                body: JSON.stringify({ mode })
            });
            showToast("Brightness Mode", `${mode} lighting applied.`);
            loadBrightnessView();
            refreshDashboard();
        } catch (err) {
            showToast("Error", err.message, true);
        }
    });
});

const brightnessRestoreBtn = document.getElementById("brightnessRestoreBtn");
if (brightnessRestoreBtn) {
    brightnessRestoreBtn.addEventListener("click", async () => {
        try {
            await apiFetch("/api/brightness/reset", { method: "POST" });
            showToast("Circadian Sync", "System re-synchronized to automatic rhythm.");
            loadBrightnessView();
            refreshDashboard();
        } catch (err) {
            showToast("Error", err.message, true);
        }
    });
}

// --- 4. ROUTINES PAGE (FR-03) ---
const routinesContainer = document.getElementById("routinesContainer");
const routineSearchInput = document.getElementById("routineSearchInput");
const routineFilterSelect = document.getElementById("routineFilterSelect");
const openCreateRoutineBtn = document.getElementById("openCreateRoutineBtn");

const routineModal = document.getElementById("routineModal");
const routineForm = document.getElementById("routineForm");
const routineModalTitle = document.getElementById("routineModalTitle");
const closeRoutineModal = document.getElementById("closeRoutineModal");
const cancelRoutineBtn = document.getElementById("cancelRoutineBtn");
const routineFormError = document.getElementById("routineFormError");

const rtBrightnessInput = document.getElementById("rtBrightness");
const rtBrightDisplay = document.getElementById("rtBrightDisplay");

if (rtBrightnessInput && rtBrightDisplay) {
    rtBrightnessInput.addEventListener("input", () => {
        rtBrightDisplay.textContent = `${rtBrightnessInput.value}%`;
    });
}

async function loadRoutines() {
    if (!routinesContainer) return;
    try {
        const q = routineSearchInput ? routineSearchInput.value.trim() : "";
        const period = routineFilterSelect ? routineFilterSelect.value : "All";
        let url = `/api/routines?`;
        if (q) url += `q=${encodeURIComponent(q)}&`;
        if (period && period !== "All") url += `period=${encodeURIComponent(period)}&`;

        const routines = await apiFetch(url);

        if (routines.length === 0) {
            routinesContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--text-muted);">
                    <p>No light routines found.</p>
                </div>
            `;
            return;
        }

        routinesContainer.innerHTML = routines.map((r, idx) => {
            const periodClass = r.period.toLowerCase();
            return `
                <div class="routine-card">
                    <div class="routine-number">${String(idx + 1).padStart(2, '0')}</div>
                    <span class="tag ${periodClass}-tag">${r.period.toUpperCase()}</span>
                    <h2>${escapeHtml(r.name)}</h2>
                    <p>${escapeHtml(r.description || 'Custom light routine')}</p>
                    <div class="routine-footer">
                        <span>${r.time}</span>
                        <strong>${r.brightness_pct}%</strong>
                    </div>
                    <div class="routine-card-btns">
                        <button class="btn-apply-routine" onclick="applyRoutineNow(${r.id}, '${escapeJsString(r.name)}')">Apply Now</button>
                        <button class="action-btn" onclick="openEditRoutine(${r.id})">Edit</button>
                        <button class="action-btn delete" onclick="confirmDeleteRoutine(${r.id}, '${escapeJsString(r.name)}')">✕</button>
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        routinesContainer.innerHTML = `<div class="form-error">Failed to load routines: ${err.message}</div>`;
    }
}

if (routineSearchInput) {
    routineSearchInput.addEventListener("input", debounce(loadRoutines, 300));
}

if (routineFilterSelect) {
    routineFilterSelect.addEventListener("change", loadRoutines);
}

if (openCreateRoutineBtn) {
    openCreateRoutineBtn.addEventListener("click", () => {
        routineModalTitle.textContent = "Create Light Routine";
        document.getElementById("routineEditId").value = "";
        document.getElementById("rtName").value = "";
        document.getElementById("rtPeriod").value = "Morning";
        document.getElementById("rtTime").value = "06:30";
        rtBrightnessInput.value = 60;
        rtBrightDisplay.textContent = "60%";
        document.getElementById("rtDescription").value = "";
        document.getElementById("rtActive").checked = true;
        routineFormError.textContent = "";
        routineModal.classList.add("open");
    });
}

if (closeRoutineModal) closeRoutineModal.addEventListener("click", () => routineModal.classList.remove("open"));
if (cancelRoutineBtn) cancelRoutineBtn.addEventListener("click", () => routineModal.classList.remove("open"));

window.openEditRoutine = async function(id) {
    try {
        const r = await apiFetch(`/api/routines/${id}`);
        routineModalTitle.textContent = "Edit Light Routine";
        document.getElementById("routineEditId").value = r.id;
        document.getElementById("rtName").value = r.name;
        document.getElementById("rtPeriod").value = r.period;
        document.getElementById("rtTime").value = r.time;
        rtBrightnessInput.value = r.brightness_pct;
        rtBrightDisplay.textContent = `${r.brightness_pct}%`;
        document.getElementById("rtDescription").value = r.description || "";
        document.getElementById("rtActive").checked = r.is_active;
        routineFormError.textContent = "";
        routineModal.classList.add("open");
    } catch (err) {
        showToast("Error", err.message, true);
    }
};

if (routineForm) {
    routineForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        routineFormError.textContent = "";
        const id = document.getElementById("routineEditId").value;
        const payload = {
            name: document.getElementById("rtName").value.trim(),
            period: document.getElementById("rtPeriod").value,
            time: document.getElementById("rtTime").value,
            brightness_pct: parseInt(rtBrightnessInput.value, 10),
            description: document.getElementById("rtDescription").value.trim(),
            is_active: document.getElementById("rtActive").checked
        };

        try {
            if (id) {
                await apiFetch(`/api/routines/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                showToast("Routine Updated", `${payload.name} saved.`);
            } else {
                await apiFetch("/api/routines", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                showToast("Routine Created", `${payload.name} created.`);
            }
            routineModal.classList.remove("open");
            loadRoutines();
            refreshDashboard();
        } catch (err) {
            routineFormError.textContent = err.message;
        }
    });
}

window.applyRoutineNow = async function(id, name) {
    try {
        const res = await apiFetch(`/api/routines/${id}/activate`, { method: "POST" });
        showToast("Routine Applied", res.message);
        refreshDashboard();
    } catch (err) {
        showToast("Failed to Apply", err.message, true);
    }
};

window.confirmDeleteRoutine = function(id, name) {
    showConfirm(
        "Delete Routine",
        `Are you sure you want to delete the routine "${name}"?`,
        async () => {
            try {
                await apiFetch(`/api/routines/${id}`, { method: "DELETE" });
                showToast("Deleted", `Routine "${name}" was removed.`);
                loadRoutines();
                refreshDashboard();
            } catch (err) {
                showToast("Delete Failed", err.message, true);
            }
        }
    );
};

// --- 5. STORAGE & SETTINGS (FR-04) ---
async function loadStorageMetrics() {
    try {
        const data = await apiFetch("/api/reports/storage");
        const dbFileEl = document.getElementById("dbFilePath");
        const dbSizeEl = document.getElementById("dbFileSize");
        const dbIntegrityEl = document.getElementById("dbIntegrity");
        const tableCountsContainer = document.getElementById("tableCountsList");

        if (dbFileEl) dbFileEl.textContent = "light_rhythm.db";
        if (dbSizeEl) dbSizeEl.textContent = data.database_size_formatted;
        if (dbIntegrityEl) dbIntegrityEl.textContent = data.integrity;

        if (tableCountsContainer && data.record_counts) {
            tableCountsContainer.innerHTML = Object.entries(data.record_counts).map(([table, count]) => `
                <div class="table-row-metric">
                    <div>
                        <strong>${escapeHtml(table.toUpperCase())}</strong>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">Database table in SQLite</div>
                    </div>
                    <strong>${count} records</strong>
                </div>
            `).join("");
        }
    } catch (err) {
        console.error("Storage load error:", err);
    }
}

const refreshStorageBtn = document.getElementById("refreshStorageBtn");
if (refreshStorageBtn) {
    refreshStorageBtn.addEventListener("click", () => {
        loadStorageMetrics();
        showToast("Database Synced", "SQLite storage metrics refreshed.");
    });
}

// --- 6. HISTORY AUDIT LOG (FR-06) ---
const historyTableBody = document.getElementById("historyTableBody");
const historySearchInput = document.getElementById("historySearchInput");
const historyFilterSelect = document.getElementById("historyFilterSelect");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const exportHistoryCsvBtn = document.getElementById("exportHistoryCsvBtn");

async function loadHistory() {
    if (!historyTableBody) return;
    try {
        const q = historySearchInput ? historySearchInput.value.trim() : "";
        const event_type = historyFilterSelect ? historyFilterSelect.value : "All";
        let url = `/api/history?limit=100&`;
        if (q) url += `q=${encodeURIComponent(q)}&`;
        if (event_type && event_type !== "All") url += `event_type=${encodeURIComponent(event_type)}&`;

        const logs = await apiFetch(url);

        if (logs.length === 0) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">
                        No event records found.
                    </td>
                </tr>
            `;
            return;
        }

        historyTableBody.innerHTML = logs.map(item => `
            <tr>
                <td style="font-family: 'DM Mono', monospace; font-size: 0.8rem; color: var(--text-secondary);">${item.timestamp}</td>
                <td><strong>${escapeHtml(item.title)}</strong></td>
                <td><span class="history-tag ${item.event_type.toLowerCase()}">${item.event_type}</span></td>
                <td style="font-family: 'DM Mono', monospace; color: var(--lime);">${item.brightness_pct !== null ? item.brightness_pct + '%' : '—'}</td>
                <td style="color: var(--text-muted); font-size: 0.82rem;">${escapeHtml(item.details || '—')}</td>
            </tr>
        `).join("");
    } catch (err) {
        historyTableBody.innerHTML = `<tr><td colspan="5" class="form-error">Error loading history: ${err.message}</td></tr>`;
    }
}

if (historySearchInput) {
    historySearchInput.addEventListener("input", debounce(loadHistory, 300));
}

if (historyFilterSelect) {
    historyFilterSelect.addEventListener("change", loadHistory);
}

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
        showConfirm(
            "Clear History",
            "Are you sure you want to clear the entire audit history log?",
            async () => {
                try {
                    await apiFetch("/api/history/clear", { method: "POST" });
                    showToast("History Cleared", "Activity records have been cleared.");
                    loadHistory();
                    refreshDashboard();
                } catch (err) {
                    showToast("Error", err.message, true);
                }
            }
        );
    });
}

if (exportHistoryCsvBtn) {
    exportHistoryCsvBtn.addEventListener("click", () => {
        window.location.href = "/api/reports/export.csv?type=history";
    });
}

// --- 7. REPORTS PAGE ---
async function loadReports() {
    try {
        const data = await apiFetch("/api/reports/summary");
        const adh = document.getElementById("repAdherence");
        const avg = document.getElementById("repAvgBright");
        const rCount = document.getElementById("repRoutinesCount");
        const actR = document.getElementById("repActiveRoutines");
        const hCount = document.getElementById("repHistoryCount");

        if (adh) adh.textContent = `${data.adherence_pct}%`;
        if (avg) avg.textContent = `${data.avg_brightness}%`;
        if (rCount) rCount.textContent = data.total_routines;
        if (actR) actR.textContent = `${data.active_routines} Active`;
        if (hCount) hCount.textContent = data.total_history_records;
    } catch (err) {
        console.error("Reports load error:", err);
    }
}

const downloadAllCsvBtn = document.getElementById("downloadAllCsvBtn");
if (downloadAllCsvBtn) {
    downloadAllCsvBtn.addEventListener("click", () => {
        window.location.href = "/api/reports/export.csv?type=schedules";
    });
}

// --- Helper Functions ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJsString(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'");
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
    showPage("dashboard");

    // Periodic dashboard state refresh (every 8 seconds)
    setInterval(() => {
        const activePage = document.querySelector(".page.active-page");
        if (activePage && activePage.id === "dashboard") {
            refreshDashboard();
        }
    }, 8000);
});