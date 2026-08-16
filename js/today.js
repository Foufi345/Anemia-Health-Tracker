import { db } from './firebase-init.js';
import { doc, getDoc, collection, query, orderBy, getDocs, writeBatch, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

export async function initToday(uid) {
    const todayStr = new Date().toISOString().split('T')[0];
    const profileRef = doc(db, "users", uid);
    const dayRef = doc(db, "users", uid, "days", todayStr);
    const slotsRef = collection(db, "users", uid, "mealSlots");

    try {
        const profileSnap = await getDoc(profileRef);
        const profile = profileSnap.data();
        const doseTarget = profile.doseTarget || 2;
        const medName = profile.medicationName || "Medication";

        const slotsQuery = query(slotsRef, orderBy("order", "asc"));
        const slotsSnap = await getDocs(slotsQuery);
        let slots = [];
        slotsSnap.forEach(doc => slots.push({ id: doc.id, ...doc.data() }));

        let daySnap = await getDoc(dayRef);
        if (!daySnap.exists()) {
            await setDoc(dayRef, {
                meals: {},
                dosesTaken: 0,
                symptoms: { energy: 3, nausea: 3, dizziness: 3, notes: "" }
            });
            daySnap = await getDoc(dayRef);
        }
        
        let dayData = daySnap.data();
        
        renderMeals(uid, slots, dayData, dayRef, doseTarget, medName);
        renderSymptoms(dayData.symptoms, dayRef);
        updateTopCards(slots, dayData.meals, doseTarget);

    } catch (e) {
        console.error("Today view error:", e);
    }
}

function renderMeals(uid, slots, dayData, dayRef, doseTarget, medName) {
    const container = document.getElementById('meals-container');
    container.innerHTML = '';

    slots.forEach(slot => {
        const isChecked = dayData.meals[slot.id] === true;
        
        const row = document.createElement('div');
        row.className = "p-4 flex items-start gap-4 hover:bg-slate-50 transition cursor-pointer";
        row.onclick = (e) => {
            if (e.target.type !== 'checkbox') {
                const cb = row.querySelector('input[type="checkbox"]');
                cb.click();
            }
        };

        let badgeHTML = '';
        if (slot.isDoseSlot) {
            badgeHTML = `<span class="inline-block mt-2 bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded font-bold">💊  Dose${medName}</span>`;
        }

        row.innerHTML = `
            <input type="checkbox" id="cb-${slot.id}" class="mt-1 w-5 h-5 accent-rose-500 rounded cursor-pointer" ${isChecked ? 'checked' : ''}>
            <div>
                <h4 class="font-bold text-slate-800">${slot.name} <span class="text-xs text-slate-400 font-normal ms-2">${slot.time || ''}</span></h4>
                <p class="text-sm text-slate-500">${slot.description || ''}</p>
                ${badgeHTML}
            </div>
        `;

        const checkbox = row.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            const checked = e.target.checked;
            dayData.meals[slot.id] = checked;
            
            // Recompute doses
            let doses = 0;
            slots.forEach(s => {
                if (s.isDoseSlot && dayData.meals[s.id]) doses++;
            });
            dayData.dosesTaken = doses;

            // Batch write
            const batch = writeBatch(db);
            
            // Update day doc
            batch.update(dayRef, {
                [`meals.${slot.id}`]: checked,
                dosesTaken: doses
            });

            // Update linked products stock
            if (slot.linkedProductIds && slot.linkedProductIds.length > 0) {
                for (const prodId of slot.linkedProductIds) {
                    const prodRef = doc(db, "users", uid, "products", prodId);
                    const prodSnap = await getDoc(prodRef); // need current stock to decrement properly, transactions are better but this is simpler client-side
                    if (prodSnap.exists()) {
                        const pData = prodSnap.data();
                        let newQty = pData.stockQty || 0;
                        const portion = pData.portionPerUse || 1;
                        if (checked) {
                            newQty = Math.max(0, newQty - portion);
                        } else {
                            newQty = newQty + portion;
                        }
                        batch.update(prodRef, { stockQty: newQty });
                    }
                }
            }

            try {
                await batch.commit();
                updateTopCards(slots, dayData.meals, doseTarget);
            } catch (err) {
                console.error("Batch write failed", err);
                e.target.checked = !checked; // revert UI
            }
        });

        container.appendChild(row);
    });
}

function updateTopCards(slots, meals, doseTarget) {
    let dosesTaken = 0;
    slots.forEach(s => {
        if (s.isDoseSlot && meals[s.id]) dosesTaken++;
    });

    document.getElementById('dose-text').innerText = `${dosesTaken} / ${doseTarget}`;
    document.getElementById('dose-bar').style.width = `${Math.min(100, (dosesTaken / doseTarget) * 100)}%`;

    // Simple nausea logic: if first slot of day is completed, nausea is better
    if (slots.length > 0 && meals[slots[0].id]) {
        document.getElementById('nausea-status').innerText = "Stable";
        document.getElementById('nausea-status').className = "text-green-600 font-bold";
    } else {
        document.getElementById('nausea-status').innerText = "Nausea Risk";
        document.getElementById('nausea-status').className = "text-orange-500 font-bold";
    }
}

function renderSymptoms(symptoms, dayRef) {
    const sym = symptoms || { energy: 3, nausea: 3, dizziness: 3, notes: "" };
    
    document.getElementById('slider-energy').value = sym.energy;
    document.getElementById('val-energy').innerText = `${sym.energy}/5`;
    
    document.getElementById('slider-nausea').value = sym.nausea;
    document.getElementById('val-nausea').innerText = `${sym.nausea}/5`;
    
    document.getElementById('slider-dizziness').value = sym.dizziness;
    document.getElementById('val-dizziness').innerText = `${sym.dizziness}/5`;
    
    document.getElementById('notes-text').value = sym.notes;

    let timeout;
    const saveSymptoms = () => {
        const energy = parseInt(document.getElementById('slider-energy').value);
        const nausea = parseInt(document.getElementById('slider-nausea').value);
        const dizziness = parseInt(document.getElementById('slider-dizziness').value);
        const notes = document.getElementById('notes-text').value;

        updateDoc(dayRef, {
            symptoms: { energy, nausea, dizziness, notes }
        }).catch(e => console.error("Save symptoms error:", e));
    };

    const attachDebounce = (id, valId) => {
        document.getElementById(id).addEventListener('input', (e) => {
            if (valId) document.getElementById(valId).innerText = `${e.target.value}/5`;
            clearTimeout(timeout);
            timeout = setTimeout(saveSymptoms, 1000);
        });
    };

    attachDebounce('slider-energy', 'val-energy');
    attachDebounce('slider-nausea', 'val-nausea');
    attachDebounce('slider-dizziness', 'val-dizziness');
    attachDebounce('notes-text', null);
}
