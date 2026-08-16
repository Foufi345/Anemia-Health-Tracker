import { db } from './firebase-init.js';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { applyLanguage, applyTheme } from './i18n.js';

let currentUid = null;
let currentLang = 'ar';
let productsList = []; // For the select dropdown

export async function initSettings(uid) {
    currentUid = uid;
    
    // Load Profile once
    const profileRef = doc(db, "users", uid);
    try {
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
            const p = snap.data();
            currentLang = p.language || 'ar';
            document.getElementById('set-med-name').value = p.medicationName || "فوماكور (Fumacur)";
            document.getElementById('set-dose-target').value = p.doseTarget || 2;
            document.getElementById('set-start-date').value = p.treatmentStartDate || '';
            document.getElementById('set-goal-days').value = p.treatmentGoalDays || 90;
            document.getElementById('set-language').value = currentLang;
            document.getElementById('set-theme').value = p.theme || 'light';
            document.getElementById('set-reminders').checked = !!p.remindersEnabled;
        }
    } catch (e) {
        console.error("Load profile error:", e);
    }

    // Handle Profile Form Submit (Save Settings Button)
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('btn-save-profile');
            const originalHTML = btn ? btn.innerHTML : '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<span>⏳</span> <span>${currentLang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>`;
            }

            const medName = document.getElementById('set-med-name').value;
            const doseTarget = parseFloat(document.getElementById('set-dose-target').value) || 2;
            const startDate = document.getElementById('set-start-date').value;
            const goalDays = parseFloat(document.getElementById('set-goal-days').value) || 90;
            const language = document.getElementById('set-language').value;
            const theme = document.getElementById('set-theme').value;
            const remindersEnabled = document.getElementById('set-reminders').checked;

            currentLang = language;

            if (remindersEnabled && Notification.permission !== "granted") {
                Notification.requestPermission();
            }

            try {
                await setDoc(profileRef, {
                    medicationName: medName,
                    doseTarget: doseTarget,
                    treatmentStartDate: startDate,
                    treatmentGoalDays: goalDays,
                    language: language,
                    theme: theme,
                    remindersEnabled: remindersEnabled
                }, { merge: true });

                applyLanguage(language);
                applyTheme(theme);
                showToast();

                if (btn) {
                    btn.classList.remove('bg-rose-600', 'hover:bg-rose-700');
                    btn.classList.add('bg-green-600', 'hover:bg-green-700');
                    btn.innerHTML = `<span>✓</span> <span>${currentLang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully'}</span>`;
                    setTimeout(() => {
                        btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                        btn.classList.add('bg-rose-600', 'hover:bg-rose-700');
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                        applyLanguage(currentLang);
                    }, 2000);
                }
            } catch (err) {
                console.error("Save profile error:", err);
                if (btn) {
                    btn.innerHTML = `<span>❌ Error</span>`;
                    btn.disabled = false;
                }
            }
        });
    }

    // Load Products for dropdowns
    try {
        const prodSnap = await getDocs(collection(db, "users", uid, "products"));
        productsList = [];
        prodSnap.forEach(d => productsList.push({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Load products error:", e);
    }

    // Load Slots
    await loadAndRenderSlots();

    document.getElementById('btn-add-slot').addEventListener('click', async () => {
        const newId = crypto.randomUUID();
        const numSlots = document.getElementById('slots-container').children.length;
        await setDoc(doc(db, "users", uid, "mealSlots", newId), {
            name: currentLang === 'ar' ? "وجبة جديدة" : "New Meal",
            time: "12:00",
            description: "",
            isDoseSlot: false,
            linkedProductIds: [],
            order: numSlots
        });
        showToast();
        await loadAndRenderSlots();
    });

    // Labs
    document.getElementById('lab-date').valueAsDate = new Date();
    document.getElementById('lab-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = document.getElementById('lab-date').value;
        const hb = parseFloat(document.getElementById('lab-hb').value) || null;
        const fer = parseFloat(document.getElementById('lab-fer').value) || null;
        const notes = document.getElementById('lab-notes').value;

        if (!d || (!hb && !fer)) return; // Need at least date + one value

        await setDoc(doc(db, "users", uid, "labResults", d), { hemoglobin: hb, ferritin: fer, notes: notes });
        
        document.getElementById('lab-hb').value = '';
        document.getElementById('lab-fer').value = '';
        document.getElementById('lab-notes').value = '';
        showToast();
    });

    const labRef = collection(db, "users", uid, "labResults");
    onSnapshot(labRef, (snap) => {
        const tbody = document.getElementById('lab-table-body');
        tbody.innerHTML = '';
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => b.id.localeCompare(a.id));
        items.forEach(val => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-slate-800">${val.id}</td>
                <td class="px-4 py-3">${val.hemoglobin !== null && val.hemoglobin !== undefined ? val.hemoglobin : '-'}</td>
                <td class="px-4 py-3">${val.ferritin !== null && val.ferritin !== undefined ? val.ferritin : '-'}</td>
                <td class="px-4 py-3 text-slate-500">${val.notes || ''}</td>
                <td class="px-4 py-3 text-end">
                    <button onclick="deleteLab('${val.id}')" class="text-slate-400 hover:text-red-500 transition">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }, (err) => {
        console.error("Lab results snapshot error:", err);
    });
}

function showToast() {
    const t = document.getElementById('toast');
    if (!t) return;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 2000);
}

async function loadAndRenderSlots() {
    try {
        const slotsRef = collection(db, "users", currentUid, "mealSlots");
        const snap = await getDocs(slotsRef);
        const slots = [];
        snap.forEach(d => slots.push({ id: d.id, ...d.data() }));
        slots.sort((a, b) => (a.order !== undefined ? a.order : 0) - (b.order !== undefined ? b.order : 0));
        renderSlots(slots);
    } catch (e) {
        console.error("Load slots error:", e);
    }
}

function renderSlots(slots) {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';

    const noProdLabel = currentLang === 'ar' ? '(بدون منتج مستهلك)' : '(No product consumed)';

    slots.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = "bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col gap-3";
        row.id = `slot-card-${s.id}`;
        
        // Product options
        let opts = `<option value="">${noProdLabel}</option>`;
        productsList.forEach(p => {
            const sel = (s.linkedProductIds && s.linkedProductIds.includes(p.id)) ? 'selected' : '';
            opts += `<option value="${p.id}" ${sel}>${p.icon || '📦'} ${p.name}</option>`;
        });

        row.innerHTML = `
            <div class="flex justify-between items-start gap-4">
                <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1" data-i18n="mealName">Meal Name</label>
                        <input type="text" id="slot-name-${s.id}" value="${s.name || ''}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full" placeholder="Meal Name">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1" data-i18n="mealTime">Time</label>
                        <input type="time" id="slot-time-${s.id}" value="${s.time || ''}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs font-bold text-slate-500 mb-1" data-i18n="mealDesc">Description</label>
                        <input type="text" id="slot-desc-${s.id}" value="${s.description || ''}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full" placeholder="Description or Note (Optional)">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs font-bold text-slate-500 mb-1" data-i18n="mealProduct">Linked Product</label>
                        <select id="slot-prod-${s.id}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full bg-white">
                            ${opts}
                        </select>
                    </div>
                </div>
                <div class="flex flex-col gap-2 items-center shrink-0">
                    <div class="flex flex-col items-center gap-1 bg-white p-1 rounded border border-slate-200">
                        <button type="button" onclick="moveSlot('${s.id}', -1, ${i})" class="text-slate-400 hover:text-slate-800" ${i===0?'disabled opacity-50':''}>▲</button>
                        <button type="button" onclick="moveSlot('${s.id}', 1, ${i})" class="text-slate-400 hover:text-slate-800" ${i===slots.length-1?'disabled opacity-50':''}>▼</button>
                    </div>
                    <button type="button" onclick="deleteSlot('${s.id}')" class="text-red-400 hover:text-red-600 text-sm mt-2">🗑️</button>
                </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-4 mt-2 pt-2 border-t border-slate-200">
                <div class="flex flex-wrap gap-4">
                    <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-200 w-max">
                        <input type="checkbox" id="slot-dose-${s.id}" class="w-4 h-4 accent-rose-500" ${s.isDoseSlot ? 'checked' : ''}>
                        <span class="text-sm font-bold text-slate-700" data-i18n="containsDose">💊 Contains medication dose</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-200 w-max">
                        <input type="checkbox" id="slot-remind-${s.id}" class="w-4 h-4 accent-rose-500" ${s.reminderEnabled ? 'checked' : ''}>
                        <span class="text-sm font-bold text-slate-700" data-i18n="enableReminder">🔔 Enable Reminder</span>
                    </label>
                </div>
                <button type="button" id="btn-save-slot-${s.id}" onclick="saveSlot('${s.id}')" class="btn-save-slot bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition flex items-center gap-1 shadow-sm">
                    <span>💾</span> <span data-i18n="saveSlot">Save Meal</span>
                </button>
            </div>
        `;

        container.appendChild(row);
    });

    applyLanguage(currentLang);
}

window.saveSlot = async (id) => {
    const card = document.getElementById(`slot-card-${id}`);
    if (!card) return;

    const btn = document.getElementById(`btn-save-slot-${id}`);
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> <span>${currentLang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>`;
    }

    const name = card.querySelector(`#slot-name-${id}`).value;
    const time = card.querySelector(`#slot-time-${id}`).value;
    const description = card.querySelector(`#slot-desc-${id}`).value;
    const isDoseSlot = card.querySelector(`#slot-dose-${id}`).checked;
    const reminderEnabled = card.querySelector(`#slot-remind-${id}`).checked;
    const prodVal = card.querySelector(`#slot-prod-${id}`).value;
    const linkedProductIds = prodVal ? [prodVal] : [];

    try {
        await setDoc(doc(db, "users", currentUid, "mealSlots", id), {
            name,
            time,
            description,
            isDoseSlot,
            reminderEnabled,
            linkedProductIds
        }, { merge: true });
        
        showToast();

        if (btn) {
            btn.classList.remove('bg-rose-600', 'hover:bg-rose-700');
            btn.classList.add('bg-green-600', 'hover:bg-green-700');
            btn.innerHTML = `<span>✓</span> <span>${currentLang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully'}</span>`;
            setTimeout(() => {
                btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                btn.classList.add('bg-rose-600', 'hover:bg-rose-700');
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                applyLanguage(currentLang);
            }, 2000);
        }
    } catch (err) {
        console.error("Save slot error:", err);
        if (btn) {
            btn.innerHTML = `<span>❌ Error</span>`;
            btn.disabled = false;
        }
    }
};

window.deleteSlot = async (id) => {
    if(confirm(currentLang === 'ar' ? "هل تريد حذف هذه الوجبة؟" : "Delete this meal?")) {
        await deleteDoc(doc(db, "users", currentUid, "mealSlots", id));
        await loadAndRenderSlots();
    }
};

window.moveSlot = async (id, dir, currentIndex) => {
    const slotsRef = collection(db, "users", currentUid, "mealSlots");
    const snap = await getDocs(slotsRef);
    const slots = [];
    snap.forEach(d => slots.push({ id: d.id, ...d.data() }));
    slots.sort((a, b) => (a.order !== undefined ? a.order : 0) - (b.order !== undefined ? b.order : 0));

    const targetIndex = currentIndex + dir;
    if (targetIndex >= 0 && targetIndex < slots.length) {
        const batch = writeBatch(db);
        const tempOrder = slots[currentIndex].order !== undefined ? slots[currentIndex].order : currentIndex;
        const targetOrder = slots[targetIndex].order !== undefined ? slots[targetIndex].order : targetIndex;
        batch.update(doc(db, "users", currentUid, "mealSlots", slots[currentIndex].id), { order: targetOrder });
        batch.update(doc(db, "users", currentUid, "mealSlots", slots[targetIndex].id), { order: tempOrder });
        await batch.commit();
        await loadAndRenderSlots();
    }
};

window.deleteLab = async (date) => {
    if(confirm(currentLang === 'ar' ? "هل تريد حذف هذه النتيجة؟" : "Delete this result?")) {
        await deleteDoc(doc(db, "users", currentUid, "labResults", date));
    }
};
