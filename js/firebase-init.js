import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaZ3deTGBcZ0MIdiv0heQJARuccEDRfNM",
    authDomain: "anemia-heal-tracker.firebaseapp.com",
    projectId: "anemia-heal-tracker",
    storageBucket: "anemia-heal-tracker.firebasestorage.app",
    messagingSenderId: "695316088653",
    appId: "1:695316088653:web:5c2503b11c9c457c6bd904",
    measurementId: "G-1DMPGKRVW8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Migration Logic
export async function migrateUserData(uid) {
    const oldDocRef = doc(db, "trackers", uid);
    const newProfileRef = doc(db, "users", uid);

    try {
        const oldDocSnap = await getDoc(oldDocRef);
        const newProfileSnap = await getDoc(newProfileRef);

        if (oldDocSnap.exists() && !newProfileSnap.exists()) {
            console.log("Migration needed. Starting migration for user:", uid);
            const oldData = oldDocSnap.data();
            const batch = writeBatch(db);

            // 1. Profile
            batch.set(newProfileRef, {
                displayName: "User",
                language: "ar",
                theme: "light",
                treatmentStartDate: null,
                treatmentGoalDays: 90,
                doseTarget: 2
            });

            // 2. Meal Slots
            const mealSlots = [
                { id: "morning", name: "فور الاستيقاظ (كسر الغثيان)", time: "08:00", description: "قطعتان بسكويت مالح جاف على السرير قبل النهوض.", linkedProductIds: [], isDoseSlot: false, order: 0 },
                { id: "lunch", name: "الغداء", time: "13:30", description: "شريحة لحم حصان + سلطة سبانخ + بطاطا.", linkedProductIds: ["meat"], isDoseSlot: true, order: 1 },
                { id: "snack", name: "وجبة خفيفة", time: "17:00", description: "قهوة أو شاي (بعيداً عن الحديد).", linkedProductIds: [], isDoseSlot: false, order: 2 },
                { id: "dinner", name: "العشاء", time: "20:30", description: "حساء عدس مع عصرة ليمون خفيفة.", linkedProductIds: ["lentils"], isDoseSlot: true, order: 3 }
            ];
            mealSlots.forEach(slot => {
                const { id, ...data } = slot;
                batch.set(doc(db, `users/${uid}/mealSlots`, id), data);
            });

            // 3. Products
            const oldInventory = oldData.inventory || {};
            const oldGroceries = oldData.groceries || {};
            const oldSupplies = oldData.supplies || {};

            const products = [
                { id: "meat", name: "لحم الحصان", category: "Proteins", unit: "حصص", stockQty: oldInventory.meatPortions || 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🥩" },
                { id: "fumacur", name: "فوماكور", category: "Medication", unit: "قرص", stockQty: oldInventory.pillsLeft || 0, portionPerUse: 1, lowStockThreshold: 10, icon: "💊" },
                { id: "spinach", name: "سبانخ", category: "Vegetables", unit: "حبة", stockQty: oldGroceries.spinach ? 1 : 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🥬" },
                { id: "bellPepper", name: "فلفل رومي", category: "Vegetables", unit: "حبة", stockQty: oldGroceries.bellPepper ? 1 : 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🫑" },
                { id: "lemon", name: "ليمون", category: "Vegetables", unit: "حبة", stockQty: oldGroceries.lemon ? 1 : 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🍋" },
                { id: "lentils", name: "عدس", category: "Vegetables", unit: "حبة", stockQty: oldGroceries.lentils ? 1 : 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🥣" },
                { id: "tissues", name: "مناديل ورقية", category: "Supplies", unit: "علبة", stockQty: oldSupplies.tissues ? 1 : 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🧻" },
                { id: "paperTowels", name: "ورق مطبخ", category: "Supplies", unit: "لفة", stockQty: oldSupplies.paperTowels ? 1 : 0, portionPerUse: 1, lowStockThreshold: 1, icon: "🧻" }
            ];
            products.forEach(p => {
                const { id, ...data } = p;
                batch.set(doc(db, `users/${uid}/products`, id), data);
            });

            // 4. Today's Day Doc
            const today = new Date().toISOString().split('T')[0];
            let dosesTaken = 0;
            if (oldData.meals?.lunch) dosesTaken++;
            if (oldData.meals?.dinner) dosesTaken++;
            
            batch.set(doc(db, `users/${uid}/days`, today), {
                meals: oldData.meals || {},
                dosesTaken: dosesTaken,
                symptoms: { energy: 3, nausea: 3, dizziness: 3, notes: "" }
            });

            // 5. History
            if (oldData.history && oldData.history.length > 0) {
                oldData.history.forEach(entry => {
                    // Convert "Mon Aug 16 2026" to "YYYY-MM-DD" approximately or just use as ID if valid
                    try {
                        const d = new Date(entry.date);
                        const isoDate = !isNaN(d) ? d.toISOString().split('T')[0] : String(entry.dayNumber);
                        
                        batch.set(doc(db, `users/${uid}/days`, isoDate), {
                            meals: entry.meals || {},
                            dosesTaken: entry.dosesTaken || 0,
                            symptoms: { energy: 3, nausea: 3, dizziness: 3, notes: "" } // Defaults for old entries
                        });
                    } catch (e) {
                        console.error("Failed to migrate history entry", entry);
                    }
                });
            }

            await batch.commit();
            console.log("Migration complete!");
        } else {
            console.log("No migration needed.");
        }
    } catch (e) {
        console.error("Migration error:", e);
    }
}

// Sync User's Active Treatment & Fumacur Stock
export async function syncFumacurTreatment(uid) {
    try {
        const profileRef = doc(db, "users", uid);
        const fumacurRef = doc(db, "users", uid, "products", "fumacur");
        
        const profileSnap = await getDoc(profileRef);
        const pData = profileSnap.exists() ? profileSnap.data() : {};

        // Only sync if not already synced to 2026-08-11
        if (pData.treatmentStartDate === "2026-08-11" && pData.treatmentGoalDays === 90) {
            return;
        }

        const batch = writeBatch(db);

        // 1. Profile: Start 2026-08-11, 90 Days Goal, 2 doses/day
        batch.set(profileRef, {
            medicationName: "فوماكور (Fumacur)",
            doseTarget: 2,
            treatmentStartDate: "2026-08-11",
            treatmentGoalDays: 90
        }, { merge: true });

        // 2. Fumacur Product: 180 initial - 12 taken (Aug 11-16) = 168 remaining
        batch.set(fumacurRef, {
            name: "فوماكور (Fumacur)",
            category: "Medication",
            unit: "قرص",
            stockQty: 168,
            portionPerUse: 1,
            lowStockThreshold: 20,
            icon: "💊"
        }, { merge: true });

        // 3. Populate past days history: 2026-08-11 through 2026-08-16 with 2 doses each
        const dates = [
            "2026-08-11",
            "2026-08-12",
            "2026-08-13",
            "2026-08-14",
            "2026-08-15",
            "2026-08-16"
        ];

        dates.forEach(dStr => {
            const dayRef = doc(db, "users", uid, "days", dStr);
            batch.set(dayRef, {
                dosesTaken: 2,
                meals: {
                    lunch: true,
                    dinner: true
                },
                symptoms: {
                    energy: 4,
                    nausea: 1,
                    dizziness: 1,
                    notes: "2 doses Fumacur taken"
                }
            }, { merge: true });
        });

        await batch.commit();
        console.log("Fumacur treatment synced successfully for user:", uid);
    } catch (err) {
        console.error("Sync error:", err);
    }
}

export { app, auth, db };
