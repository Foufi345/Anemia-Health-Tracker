import { db } from './firebase-init.js';
import { doc, getDoc, collection, onSnapshot, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// Note on Architecture (Stage 7):
// Currently, notifications are purely client-side scheduling (setTimeout).
// They will only fire if the user has the Anemia Heal Tracker tab open in the background.
// To implement true background push notifications on iOS/Android or when the browser is closed:
// 1. Setup Firebase Cloud Messaging (FCM) service worker.
// 2. Request FCM registration token.
// 3. Store tokens in Firestore under the user document.
// 4. Create a scheduled Cloud Function (Firebase Blaze plan required) that runs every minute, 
//    checks all users' mealSlots and current time, and sends FCM payloads.

let activeTimeouts = [];
let currentUid = null;
let currentProfile = null;
let currentSlots = [];
let unsubscribeProfile = null;
let unsubscribeSlots = null;

export function initReminders(uid) {
    currentUid = uid;

    // Listen to profile to check if reminders are enabled globally
    unsubscribeProfile = onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists()) {
            currentProfile = snap.data();
            scheduleAll();
        }
    });

    // Listen to slots to get times and individual toggles
    unsubscribeSlots = onSnapshot(collection(db, "users", uid, "mealSlots"), (snap) => {
        currentSlots = [];
        snap.forEach(d => currentSlots.push({ id: d.id, ...d.data() }));
        scheduleAll();
    });
}

function scheduleAll() {
    // Clear existing
    activeTimeouts.forEach(t => clearTimeout(t));
    activeTimeouts = [];

    if (!currentProfile || !currentProfile.remindersEnabled) return;
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    currentSlots.forEach(slot => {
        if (!slot.reminderEnabled || !slot.time) return;

        const [hours, mins] = slot.time.split(':').map(Number);
        
        const targetTime = new Date();
        targetTime.setHours(hours, mins, 0, 0);

        // Check if the time has already passed today
        let msUntil = targetTime.getTime() - now.getTime();
        
        // Only schedule if it's in the future today
        if (msUntil > 0) {
            const timeout = setTimeout(() => triggerNotification(slot, todayStr), msUntil);
            activeTimeouts.push(timeout);
        }
    });
}

function triggerNotification(slot, todayStr) {
    const title = `Reminder: ${slot.name}`;
    const options = {
        body: slot.description || "Time for your meal / medication",
        icon: "/favicon.ico", // Adjust if you have an icon
        requireInteraction: true,
        data: { slotId: slot.id, date: todayStr }
    };

    const notif = new Notification(title, options);
    
    // Clicking the notification could ideally mark it as done, but clicking closes it.
    // We can handle click to focus window and then mark it if we had a service worker.
    // For pure client-side, we listen to click on the notification object.
    notif.onclick = async () => {
        window.focus();
        notif.close();
        if(confirm(`Did you complete: ${slot.name}؟\nThe log and inventory will be updated.`)) {
            await markSlotDone(slot, todayStr);
        }
    };
}

async function markSlotDone(slot, todayStr) {
    const dayRef = doc(db, "users", currentUid, "days", todayStr);
    
    try {
        const daySnap = await getDoc(dayRef);
        let dayData = daySnap.exists() ? daySnap.data() : { meals: {}, dosesTaken: 0, symptoms: {} };
        
        if (dayData.meals[slot.id]) return; // Already checked

        const batch = writeBatch(db);
        
        dayData.meals[slot.id] = true;

        let doses = 0;
        currentSlots.forEach(s => {
            if (s.isDoseSlot && dayData.meals[s.id]) doses++;
        });

        if (!daySnap.exists()) {
            batch.set(dayRef, { meals: dayData.meals, dosesTaken: doses, symptoms: { energy: 3, nausea: 3, dizziness: 3, notes: "" } });
        } else {
            batch.update(dayRef, { [`meals.${slot.id}`]: true, dosesTaken: doses });
        }

        // Decrement stock
        if (slot.linkedProductIds && slot.linkedProductIds.length > 0) {
            for (const prodId of slot.linkedProductIds) {
                const prodRef = doc(db, "users", currentUid, "products", prodId);
                const pSnap = await getDoc(prodRef);
                if (pSnap.exists()) {
                    const p = pSnap.data();
                    let newQty = Math.max(0, (p.stockQty || 0) - (p.portionPerUse || 1));
                    batch.update(prodRef, { stockQty: newQty });
                }
            }
        }
        
        await batch.commit();
        alert("Updated successfully!");
    } catch (e) {
        console.error("Failed to mark slot done via notification", e);
    }
}
