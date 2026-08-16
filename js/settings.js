import { db } from './firebase-init.js';
import { doc, getDoc, collection, query, orderBy, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

let currentUid = null;
let saveTimeout = null;
let productsList = []; // For the select dropdown

export async function initSettings(uid) {
    currentUid = uid;
    
    // Load Profile
    const profileRef = doc(db, "users", uid);
    onSnapshot(profileRef, (snap) => {
        if(snap.exists()) {
            const p = snap.data();
            document.getElementById('set-med-name').value = p.medicationName || "Medication";
            document.getElementById('set-dose-target').value = p.doseTarget || 2;
            document.getElementById('set-start-date').value = p.treatmentStartDate || '';
            document.getElementById('set-goal-days').value = p.treatmentGoalDays || 90;
            document.getElementById('set-language').value = p.language || 'en';
            document.getElementById('set-theme').value = p.theme || 'light';
            document.getElementById('set-reminders').checked = !!p.remindersEnabled;
        }
    });

    // Attach profile auto-save
    const attachProfileSave = (id, field) => {
        document.getElementById(id).addEventListener('input', (e) => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                let val = e.target.value;
                if (e.target.type === 'number') val = parseFloat(val);
                updateDoc(profileRef, { [field]: val }).then(showToast);
            }, 1000);
        });
    };

    attachProfileSave('set-med-name', 'medicationName');
    attachProfileSave('set-dose-target', 'doseTarget');
    attachProfileSave('set-start-date', 'treatmentStartDate');
    attachProfileSave('set-goal-days', 'treatmentGoalDays');
    
    document.getElementById('set-language').addEventListener('change', (e) => {
        updateDoc(profileRef, { language: e.target.value }).then(showToast);
    });
    document.getElementById('set-theme').addEventListener('change', (e) => {
        updateDoc(profileRef, { theme: e.target.value }).then(showToast);
    });
    document.getElementById('set-reminders').addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (checked && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        updateDoc(profileRef, { remindersEnabled: checked }).then(showToast);
    });

    // Load Products for dropdowns
    const prodSnap = await getDocs(collection(db, "users", uid, "products"));
    prodSnap.forEach(d => productsList.push({ id: d.id, ...d.data() }));

    // Load Slots
    const slotsRef = collection(db, "users", uid, "mealSlots");
    const qSlots = query(slotsRef, orderBy("order", "asc"));
    onSnapshot(qSlots, (snap) => {
        const slots = [];
        snap.forEach(d => slots.push({ id: d.id, ...d.data() }));
        renderSlots(slots);
    });

    document.getElementById('btn-add-slot').addEventListener('click', async () => {
        const newId = crypto.randomUUID();
        const numSlots = document.getElementById('slots-container').children.length;
        await setDoc(doc(db, "users", uid, "mealSlots", newId), {
            name: "New Meal",
            time: "12:00",
            description: "",
            isDoseSlot: false,
            linkedProductIds: [],
            order: numSlots
        });
        showToast();
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
    const qLab = query(labRef, orderBy("__name__", "desc"));
    onSnapshot(qLab, (snap) => {
        const tbody = document.getElementById('lab-table-body');
        tbody.innerHTML = '';
        snap.forEach(d => {
            const val = d.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-slate-800">${d.id}</td>
                <td class="px-4 py-3">${val.hemoglobin || '-'}</td>
                <td class="px-4 py-3">${val.ferritin || '-'}</td>
                <td class="px-4 py-3 text-slate-500">${val.notes || ''}</td>
                <td class="px-4 py-3 text-end">
                    <button onclick="deleteLab('${d.id}')" class="text-slate-400 hover:text-red-500 transition">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function showToast() {
    const t = document.getElementById('toast');
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 2000);
}

function renderSlots(slots) {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';

    slots.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = "bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col gap-3";
        
        // Product options
        let opts = `<option value="">(No product consumed)</option>`;
        productsList.forEach(p => {
            const sel = (s.linkedProductIds && s.linkedProductIds.includes(p.id)) ? 'selected' : '';
            opts += `<option value="${p.id}" ${sel}>${p.icon} ${p.name}</option>`;
        });

        row.innerHTML = `
            <div class="flex justify-between items-start gap-4">
                <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" id="slot-name-${s.id}" value="${s.name}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full" placeholder="Meal Name">
                    <input type="time" id="slot-time-${s.id}" value="${s.time}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full">
                    <input type="text" id="slot-desc-${s.id}" value="${s.description || ''}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full sm:col-span-2" placeholder="Description or Note (Optional)">
                    <select id="slot-prod-${s.id}" class="border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-rose-500 w-full bg-white sm:col-span-2">
                        ${opts}
                    </select>
                </div>
                <div class="flex flex-col gap-2 items-center shrink-0">
                    <div class="flex flex-col items-center gap-1 bg-white p-1 rounded border border-slate-200">
                        <button onclick="moveSlot('${s.id}', -1, ${i})" class="text-slate-400 hover:text-slate-800" ${i===0?'disabled opacity-50':''}>▲</button>
                        <button onclick="moveSlot('${s.id}', 1, ${i})" class="text-slate-400 hover:text-slate-800" ${i===slots.length-1?'disabled opacity-50':''}>▼</button>
                    </div>
                    <button onclick="deleteSlot('${s.id}')" class="text-red-400 hover:text-red-600 text-sm mt-2">🗑️</button>
                </div>
            </div>
            <div class="flex flex-wrap gap-4 mt-2">
                <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-200 w-max">
                    <input type="checkbox" id="slot-dose-${s.id}" class="w-4 h-4 accent-rose-500" ${s.isDoseSlot ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-700">💊 Contains medication dose</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-200 w-max">
                    <input type="checkbox" id="slot-remind-${s.id}" class="w-4 h-4 accent-rose-500" ${s.reminderEnabled ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-700">🔔 Enable Reminder</span>
                </label>
            </div>
        `;

        // Attach debounced auto-save
        const attachSlotSave = (elId, getValFn) => {
            const el = row.querySelector(`#${elId}`);
            if(!el) return;
            el.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    const data = getValFn();
                    await updateDoc(doc(db, "users", currentUid, "mealSlots", s.id), data);
                    showToast();
                }, 1000);
            });
        };

        const getSlotData = () => ({
            name: row.querySelector(`#slot-name-${s.id}`).value,
            time: row.querySelector(`#slot-time-${s.id}`).value,
            description: row.querySelector(`#slot-desc-${s.id}`).value,
            isDoseSlot: row.querySelector(`#slot-dose-${s.id}`).checked,
            reminderEnabled: row.querySelector(`#slot-remind-${s.id}`).checked,
            linkedProductIds: row.querySelector(`#slot-prod-${s.id}`).value ? [row.querySelector(`#slot-prod-${s.id}`).value] : []
        });

        attachSlotSave(`slot-name-${s.id}`, getSlotData);
        attachSlotSave(`slot-time-${s.id}`, getSlotData);
        attachSlotSave(`slot-desc-${s.id}`, getSlotData);
        attachSlotSave(`slot-dose-${s.id}`, getSlotData);
        attachSlotSave(`slot-remind-${s.id}`, getSlotData);
        
        row.querySelector(`#slot-prod-${s.id}`).addEventListener('change', async () => {
            await updateDoc(doc(db, "users", currentUid, "mealSlots", s.id), getSlotData());
            showToast();
        });

        container.appendChild(row);
    });
}

window.deleteSlot = async (id) => {
    if(confirm("Delete this meal?")) {
        await deleteDoc(doc(db, "users", currentUid, "mealSlots", id));
    }
};

window.moveSlot = async (id, dir, currentIndex) => {
    // This is a simple swap logic. Better to re-query, swap orders, and batch write.
    const slotsRef = collection(db, "users", currentUid, "mealSlots");
    const qSlots = query(slotsRef, orderBy("order", "asc"));
    const snap = await getDocs(qSlots);
    const slots = [];
    snap.forEach(d => slots.push({ id: d.id, ...d.data() }));

    const targetIndex = currentIndex + dir;
    if (targetIndex >= 0 && targetIndex < slots.length) {
        // Swap orders
        const batch = writeBatch(db);
        const tempOrder = slots[currentIndex].order;
        batch.update(doc(db, "users", currentUid, "mealSlots", slots[currentIndex].id), { order: slots[targetIndex].order });
        batch.update(doc(db, "users", currentUid, "mealSlots", slots[targetIndex].id), { order: tempOrder });
        await batch.commit();
    }
};

window.deleteLab = async (date) => {
    if(confirm("Delete this result?")) {
        await deleteDoc(doc(db, "users", currentUid, "labResults", date));
    }
};
