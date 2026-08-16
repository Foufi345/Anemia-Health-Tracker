import { auth, db, syncFumacurTreatment } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { applyLanguage, applyTheme } from './i18n.js';
import { initReminders } from './reminders.js';

export function requireAuth(onUserAuth) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            await syncFumacurTreatment(user.uid);
            onSnapshot(doc(db, "users", user.uid), (snap) => {
                if(snap.exists()) {
                    const p = snap.data();
                    applyLanguage(p.language || 'ar');
                    applyTheme(p.theme || 'light');
                }
            });
            initReminders(user.uid);
            if (onUserAuth) onUserAuth(user);
        }
    });
}

export function logout() {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    });
}
