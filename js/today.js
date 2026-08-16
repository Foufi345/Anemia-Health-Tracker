import { db } from './firebase-init.js';
import { doc, getDoc, collection, getDocs, writeBatch, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

export async function initToday(uid) {
    const todayStr = new Date().toISOString().split('T')[0];
    const profileRef = doc(db, "users", uid);
    const dayRef = doc(db, "users", uid, "days", todayStr);
    const slotsRef = collection(db, "users", uid, "mealSlots");
    const fumacurRef = doc(db, "users", uid, "products", "fumacur");

    try {
        const profileSnap = await getDoc(profileRef);
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const doseTarget = profile.doseTarget || 2;
        const medName = profile.medicationName || "Fumacur (فوماكور)";

        // Ensure Fumacur product exists with 180 total stock if not initialized
        let fumacurSnap = await getDoc(fumacurRef);
        if (!fumacurSnap.exists()) {
            await setDoc(fumacurRef, {
                name: "فوماكور (Fumacur)",
                category: "Medication",
                unit: "قرص",
                stockQty: 180,
                portionPerUse: 1,
                lowStockThreshold: 20,
                icon: "💊"
            });
            fumacurSnap = await getDoc(fumacurRef);
        }
        let fumacurData = fumacurSnap.data() || { stockQty: 180 };

        // Fetch Meal Slots
        const slotsSnap = await getDocs(slotsRef);
        let slots = [];
        slotsSnap.forEach(doc => slots.push({ id: doc.id, ...doc.data() }));
        slots.sort((a, b) => (a.order !== undefined ? a.order : 0) - (b.order !== undefined ? b.order : 0));

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
        
        renderMeals(uid, slots, dayData, dayRef, doseTarget, medName, fumacurRef);
        renderSymptoms(dayData.symptoms, dayRef);
        updateTopCards(slots, dayData.meals, doseTarget, medName, fumacurData.stockQty);

    } catch (e) {
        console.error("Today view error:", e);
    }
}

function renderMeals(uid, slots, dayData, dayRef, doseTarget, medName, fumacurRef) {
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
            badgeHTML = `<span class="inline-block mt-2 bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded font-bold">💊 Dose: ${medName}</span>`;
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

            // Track linked products & Fumacur medication
            const productsToUpdate = new Set(slot.linkedProductIds || []);
            if (slot.isDoseSlot) {
                productsToUpdate.add('fumacur');
            }

            let latestFumacurQty = 180;

            for (const prodId of productsToUpdate) {
                const prodRef = doc(db, "users", uid, "products", prodId);
                const prodSnap = await getDoc(prodRef);
                if (prodSnap.exists()) {
                    const pData = prodSnap.data();
                    let newQty = pData.stockQty !== undefined ? pData.stockQty : 180;
                    const portion = pData.portionPerUse || 1;
                    if (checked) {
                        newQty = Math.max(0, newQty - portion);
                    } else {
                        newQty = newQty + portion;
                    }
                    batch.update(prodRef, { stockQty: newQty });
                    if (prodId === 'fumacur') {
                        latestFumacurQty = newQty;
                    }
                }
            }

            try {
                await batch.commit();
                updateTopCards(slots, dayData.meals, doseTarget, medName, latestFumacurQty);
            } catch (err) {
                console.error("Batch write failed", err);
                e.target.checked = !checked; // revert UI
            }
        });

        container.appendChild(row);
    });
}

function updateTopCards(slots, meals, doseTarget, medName, fumacurQty) {
    let dosesTaken = 0;
    slots.forEach(s => {
        if (s.isDoseSlot && meals[s.id]) dosesTaken++;
    });

    const doseText = document.getElementById('dose-text');
    const doseBar = document.getElementById('dose-bar');
    if (doseText) doseText.innerText = `${dosesTaken} / ${doseTarget}`;
    if (doseBar) doseBar.style.width = `${Math.min(100, (dosesTaken / doseTarget) * 100)}%`;

    // Update Fumacur Stock Card text
    const medLabel = document.getElementById('med-name-label');
    const stockText = document.getElementById('med-stock-text');
    if (medLabel) medLabel.innerText = `${medName || 'فوماكور (Fumacur)'}`;
    if (stockText) {
        const qty = fumacurQty !== undefined ? fumacurQty : 180;
        const daysLeft = Math.floor(qty / (doseTarget || 2));
        stockText.innerText = `${qty} / 180 (${daysLeft} days left)`;
    }

    // Nausea Status
    const nauseaStatus = document.getElementById('nausea-status');
    if (nauseaStatus) {
        if (slots.length > 0 && meals[slots[0].id]) {
            nauseaStatus.innerText = "Stable";
            nauseaStatus.className = "text-green-600 font-bold";
        } else {
            nauseaStatus.innerText = "Nausea Risk";
            nauseaStatus.className = "text-orange-500 font-bold";
        }
    }
}

function showToast() {
    const t = document.getElementById('toast');
    if (!t) return;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 2000);
}

function renderSymptoms(symptoms, dayRef) {
    const sym = symptoms || { energy: 3, nausea: 3, dizziness: 3, notes: "" };
    
    const energySlider = document.getElementById('slider-energy');
    const energyVal = document.getElementById('val-energy');
    const nauseaSlider = document.getElementById('slider-nausea');
    const nauseaVal = document.getElementById('val-nausea');
    const dizzinessSlider = document.getElementById('slider-dizziness');
    const dizzinessVal = document.getElementById('val-dizziness');
    const notesText = document.getElementById('notes-text');
    const saveBtn = document.getElementById('btn-save-symptoms');

    energySlider.value = sym.energy;
    energyVal.innerText = `${sym.energy}/5`;
    
    nauseaSlider.value = sym.nausea;
    nauseaVal.innerText = `${sym.nausea}/5`;
    
    dizzinessSlider.value = sym.dizziness;
    dizzinessVal.innerText = `${sym.dizziness}/5`;
    
    notesText.value = sym.notes || '';

    // Update labels locally on slider move
    energySlider.addEventListener('input', (e) => {
        energyVal.innerText = `${e.target.value}/5`;
    });
    nauseaSlider.addEventListener('input', (e) => {
        nauseaVal.innerText = `${e.target.value}/5`;
    });
    dizzinessSlider.addEventListener('input', (e) => {
        dizzinessVal.innerText = `${e.target.value}/5`;
    });

    // Save on button click only
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const energy = parseInt(energySlider.value);
            const nausea = parseInt(nauseaSlider.value);
            const dizziness = parseInt(dizzinessSlider.value);
            const notes = notesText.value;

            try {
                await updateDoc(dayRef, {
                    symptoms: { energy, nausea, dizziness, notes }
                });
                showToast();
            } catch (e) {
                console.error("Save symptoms error:", e);
            }
        };
    }
}
