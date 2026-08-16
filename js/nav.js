import { logout } from './auth-guard.js';

export function injectNav(activePageId) {
    const navHTML = `
        <header class="bg-rose-600 text-white shadow-md py-4 px-6 sticky top-0 z-10">
            <div class="max-w-4xl mx-auto flex flex-wrap gap-4 justify-between items-center">
                <h1 class="text-xl font-bold tracking-wide">🩸 Anemia Heal Tracker</h1>
                <nav class="flex items-center gap-4 text-sm font-medium overflow-x-auto">
                    <a href="dashboard.html" class="whitespace-nowrap hover:text-rose-200 transition ${activePageId === 'dashboard' ? 'text-rose-200 underline' : ''}" data-i18n="navDashboard">Dashboard</a>
                    <a href="today.html" class="whitespace-nowrap hover:text-rose-200 transition ${activePageId === 'today' ? 'text-rose-200 underline' : ''}" data-i18n="navToday">Today</a>
                    <a href="inventory.html" class="whitespace-nowrap hover:text-rose-200 transition ${activePageId === 'inventory' ? 'text-rose-200 underline' : ''}" data-i18n="navInventory">Inventory</a>
                    <a href="settings.html" class="whitespace-nowrap hover:text-rose-200 transition ${activePageId === 'settings' ? 'text-rose-200 underline' : ''}" data-i18n="navSettings">Settings</a>
                    <button id="btn-logout" class="bg-rose-700 hover:bg-rose-800 px-3 py-1 rounded-full text-sm font-medium transition whitespace-nowrap" data-i18n="navLogout">Logout</button>
                </nav>
            </div>
        </header>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHTML);
    document.getElementById('btn-logout').addEventListener('click', logout);
}
