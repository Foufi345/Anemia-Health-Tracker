import { db } from './firebase-init.js';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

export async function initDashboard(uid) {
    const profileRef = doc(db, "users", uid);
    const daysRef = collection(db, "users", uid, "days");
    const labRef = collection(db, "users", uid, "labResults");

    try {
        const profileSnap = await getDoc(profileRef);
        const profile = profileSnap.data();

        // Fetch days
        const daysSnap = await getDocs(daysRef);
        const daysMap = new Map();
        let allDays = [];
        daysSnap.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            daysMap.set(doc.id, data);
            allDays.push(data);
        });
        allDays.sort((a, b) => b.id.localeCompare(a.id));
        allDays = allDays.slice(0, 90);

        // Fetch lab results
        const labSnap = await getDocs(labRef);
        let labs = [];
        labSnap.forEach(doc => labs.push({ id: doc.id, ...doc.data() }));
        labs.sort((a, b) => a.id.localeCompare(b.id));

        // Fetch Fumacur stock
        const fumacurRef = doc(db, "users", uid, "products", "fumacur");
        const fumacurSnap = await getDoc(fumacurRef);
        const fumacurData = fumacurSnap.exists() ? fumacurSnap.data() : { stockQty: 180 };

        renderAdherenceRing(allDays, profile.doseTarget);
        renderStreak(allDays, profile.doseTarget);
        renderCountdown(profile, fumacurData);
        renderHeatmap(daysMap, profile.doseTarget);
        renderWeeklyChart(allDays, profile.doseTarget);
        renderLabTrends(labs);
        setupExport(allDays, labs);

    } catch (e) {
        console.error("Dashboard error:", e);
    }
}

function renderAdherenceRing(days, doseTarget) {
    // Get this week's days (last 7 days from today)
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let daysWithTarget = 0;
    let daysCounted = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayData = days.find(x => x.id === dateStr);
        if (dayData) {
            daysCounted++;
            if (dayData.dosesTaken >= doseTarget) daysWithTarget++;
        }
    }

    const pct = daysCounted === 0 ? 0 : Math.round((daysWithTarget / daysCounted) * 100);
    
    document.getElementById('adherence-text').innerText = `${pct}%`;
    const ring = document.getElementById('adherence-ring');
    const circ = 251.2; // 2 * pi * 40
    ring.style.strokeDashoffset = circ - (pct / 100) * circ;
}

function renderStreak(days, doseTarget) {
    // Sort descending by date
    days.sort((a,b) => b.id.localeCompare(a.id));
    
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate streaks
    // Walk back in time
    let isCurrentBroken = false;

    // Check if we start at today or yesterday for current streak
    let startIdx = 0;
    if (days.length > 0 && days[0].id === todayStr) {
        if (days[0].dosesTaken < doseTarget) {
            isCurrentBroken = true; // Today is broken, but maybe yesterday we had a streak?
            // Actually, if today is logged and broken, current streak is 0.
        } else {
            currentStreak++;
        }
        startIdx = 1;
    } else {
        // Today not logged yet, check yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (days.length > 0 && days[0].id !== yesterdayStr) {
             // gap!
             isCurrentBroken = true;
        }
    }

    for (let i = 0; i < days.length; i++) {
        if (days[i].dosesTaken >= doseTarget) {
            tempStreak++;
            if (!isCurrentBroken && i >= startIdx) {
                // Ensure continuity
                const currentDay = new Date(days[i].id);
                const prevDay = i > 0 ? new Date(days[i-1].id) : null;
                if (prevDay) {
                    const diff = (prevDay - currentDay) / (1000 * 60 * 60 * 24);
                    if (diff === 1) {
                        if(i >= startIdx) currentStreak++;
                    } else {
                        isCurrentBroken = true;
                    }
                } else {
                     if(i >= startIdx) currentStreak++;
                }
            }
        } else {
            if (tempStreak > bestStreak) bestStreak = tempStreak;
            tempStreak = 0;
            if (i >= startIdx) isCurrentBroken = true;
        }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;

    document.getElementById('streak-current').innerText = currentStreak;
    document.getElementById('streak-best').innerText = bestStreak;
}

function renderCountdown(profile, fumacurData) {
    const card = document.getElementById('countdown-card');
    if (!card) return;

    card.classList.remove('hidden');

    const totalStock = 180;
    const currentStock = fumacurData && fumacurData.stockQty !== undefined ? fumacurData.stockQty : 180;
    const doseTarget = profile.doseTarget || 2;
    const goalDays = profile.treatmentGoalDays || 90;

    let daysElapsed = 1;
    let expectedEndStr = '';
    let pct = 0;

    if (profile.treatmentStartDate) {
        const start = new Date(profile.treatmentStartDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        start.setHours(0,0,0,0);
        const diffTime = today - start;
        daysElapsed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
        
        const end = new Date(start);
        end.setDate(end.getDate() + goalDays);
        expectedEndStr = `End: ${end.toISOString().split('T')[0]}`;
        
        pct = Math.min(100, Math.max(0, Math.round((daysElapsed / goalDays) * 100)));
    } else {
        const pillsTaken = Math.max(0, totalStock - currentStock);
        daysElapsed = Math.max(1, Math.round(pillsTaken / doseTarget) + 1);
        pct = Math.min(100, Math.round((pillsTaken / totalStock) * 100));
        expectedEndStr = `Goal: ${goalDays} days (180 pills)`;
    }

    const daysLeft = Math.max(0, Math.floor(currentStock / doseTarget));

    const countdownDays = document.getElementById('countdown-days');
    const countdownDate = document.getElementById('countdown-date');
    const treatmentPct = document.getElementById('treatment-pct');
    const treatmentBar = document.getElementById('treatment-bar');
    const stockInfo = document.getElementById('fumacur-stock-info');

    if (countdownDays) countdownDays.innerText = `Day ${daysElapsed} / ${goalDays}`;
    if (countdownDate) countdownDate.innerText = expectedEndStr;
    if (treatmentPct) treatmentPct.innerText = `${pct}%`;
    if (treatmentBar) treatmentBar.style.width = `${pct}%`;
    if (stockInfo) stockInfo.innerText = `💊 Fumacur: ${currentStock} / ${totalStock} (${daysLeft}d left)`;
}

function renderHeatmap(daysMap, doseTarget) {
    const grid = document.getElementById('heatmap-grid');
    grid.innerHTML = '';
    
    // Render last 35 days (5 weeks)
    const today = new Date();
    const days = [];
    for (let i = 34; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    days.forEach(dateStr => {
        const cell = document.createElement('div');
        cell.className = 'w-full aspect-square rounded-sm cursor-pointer transition transform hover:scale-110';
        
        if (daysMap.has(dateStr)) {
            const data = daysMap.get(dateStr);
            if (data.dosesTaken >= doseTarget) {
                cell.classList.add('bg-green-500');
            } else if (data.dosesTaken > 0) {
                cell.classList.add('bg-orange-400');
            } else {
                cell.classList.add('bg-red-400');
            }

            cell.addEventListener('click', () => openDayModal(dateStr, data));
        } else {
            cell.classList.add('bg-slate-100');
        }
        
        grid.appendChild(cell);
    });
}

function openDayModal(dateStr, data) {
    document.getElementById('modal-date').innerText = dateStr;
    document.getElementById('modal-doses').innerText = data.dosesTaken;
    document.getElementById('modal-energy').innerText = data.symptoms?.energy || '-';
    document.getElementById('modal-nausea').innerText = data.symptoms?.nausea || '-';
    document.getElementById('modal-dizziness').innerText = data.symptoms?.dizziness || '-';
    document.getElementById('modal-notes').innerText = data.symptoms?.notes || 'No notes.';
    
    document.getElementById('day-modal').classList.remove('hidden');
}

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('day-modal').classList.add('hidden');
});

function renderWeeklyChart(days, doseTarget) {
    const container = document.getElementById('bar-chart-container');
    container.innerHTML = '';

    // Group last 8 weeks
    const today = new Date();
    const weeks = Array.from({length: 8}, () => ({ count: 0, sum: 0 }));

    days.forEach(day => {
        const d = new Date(day.id);
        const diff = (today - d) / (1000 * 60 * 60 * 24);
        const weekIdx = 7 - Math.floor(diff / 7);
        if (weekIdx >= 0 && weekIdx < 8) {
            weeks[weekIdx].count++;
            weeks[weekIdx].sum += day.dosesTaken;
        }
    });

    weeks.forEach((w, i) => {
        const avg = w.count > 0 ? (w.sum / w.count) : 0;
        const heightPct = doseTarget > 0 ? (avg / doseTarget) * 100 : 0;
        
        const bar = document.createElement('div');
        bar.className = 'w-full bg-slate-100 rounded-t-sm relative group';
        bar.style.height = '100%';
        
        const fill = document.createElement('div');
        fill.className = 'absolute bottom-0 left-0 right-0 bg-rose-500 rounded-t-sm transition-all duration-500';
        fill.style.height = `${Math.min(heightPct, 100)}%`;
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none z-10';
        tooltip.innerText = avg.toFixed(1);

        bar.appendChild(fill);
        bar.appendChild(tooltip);
        container.appendChild(bar);
    });
}

function renderLabTrends(labs) {
    const container = document.getElementById('lab-chart-container');
    const empty = document.getElementById('lab-empty');
    const summaryCards = document.getElementById('lab-summary-cards');
    
    if (!labs || labs.length === 0) {
        if (empty) empty.classList.remove('hidden');
        if (container) container.classList.add('hidden');
        if (summaryCards) summaryCards.classList.add('hidden');
        return;
    }
    
    if (empty) empty.classList.add('hidden');
    if (container) container.classList.remove('hidden');
    
    // Populate summary cards with latest lab result
    if (summaryCards) {
        summaryCards.classList.remove('hidden');
        const latest = labs[labs.length - 1];
        const hbEl = document.getElementById('latest-hb-val');
        const ferEl = document.getElementById('latest-fer-val');
        const dateEl = document.getElementById('latest-lab-date');
        const notesEl = document.getElementById('latest-lab-notes');

        if (hbEl) hbEl.innerText = latest.hemoglobin !== null && latest.hemoglobin !== undefined ? latest.hemoglobin : '--';
        if (ferEl) ferEl.innerText = latest.ferritin !== null && latest.ferritin !== undefined ? latest.ferritin : '--';
        if (dateEl) dateEl.innerText = latest.id || '--';
        if (notesEl) notesEl.innerText = latest.notes ? `📝 ${latest.notes}` : '';
    }

    // Chart Dimensions
    const vbW = 600;
    const vbH = 220;
    const padLeft = 50;
    const padRight = 50;
    const padTop = 40;
    const padBottom = 40;
    const chartW = vbW - padLeft - padRight;
    const chartH = vbH - padTop - padBottom;

    // Value bounds
    let maxVal = Math.max(20, ...labs.map(l => Math.max(l.hemoglobin || 0, l.ferritin || 0)));
    maxVal = Math.ceil(maxVal / 5) * 5; // Round to nearest multiple of 5
    const minVal = 0;

    const mapY = (val) => padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

    // Date bounds
    let minDate = new Date(labs[0].id).getTime();
    let maxDate = new Date(labs[labs.length - 1].id).getTime();

    const mapX = (dateStr) => {
        if (labs.length === 1 || minDate === maxDate) {
            return padLeft + chartW / 2; // Center if only 1 lab
        }
        const t = new Date(dateStr).getTime();
        return padLeft + ((t - minDate) / (maxDate - minDate)) * chartW;
    };

    let svg = `<svg viewBox="0 0 ${vbW} ${vbH}" class="w-full h-full overflow-visible select-none">`;

    // Normal Hb Range Band (12.0 - 15.5)
    const yTopBand = mapY(Math.min(maxVal, 15.5));
    const yBottomBand = mapY(Math.min(maxVal, 12.0));
    const bandHeight = Math.max(2, yBottomBand - yTopBand);
    svg += `<rect x="${padLeft}" y="${yTopBand}" width="${chartW}" height="${bandHeight}" fill="#22c55e" opacity="0.12" rx="4" />`;
    svg += `<text x="${padLeft + 6}" y="${yTopBand + 12}" font-size="10" font-weight="bold" fill="#16a34a">Normal Hb (12.0 - 15.5)</text>`;

    // Y Gridlines and Labels (steps of 5)
    const step = maxVal <= 25 ? 5 : 10;
    for (let v = 0; v <= maxVal; v += step) {
        const y = mapY(v);
        svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3" />`;
        svg += `<text x="${padLeft - 10}" y="${y + 3}" font-size="10" fill="#94a3b8" text-anchor="end" font-family="sans-serif">${v}</text>`;
    }

    // Baseline X Axis
    svg += `<line x1="${padLeft}" y1="${padTop + chartH}" x2="${padLeft + chartW}" y2="${padTop + chartH}" stroke="#e2e8f0" stroke-width="1.5" />`;

    // Connecting Lines (if >= 2 points)
    if (labs.length > 1) {
        const hbPoints = labs.filter(l => l.hemoglobin !== null && l.hemoglobin !== undefined);
        if (hbPoints.length > 1) {
            const pathHb = hbPoints.map(l => `${mapX(l.id)},${mapY(l.hemoglobin)}`).join(' L ');
            svg += `<path d="M ${pathHb}" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
        }

        const ferPoints = labs.filter(l => l.ferritin !== null && l.ferritin !== undefined);
        if (ferPoints.length > 1) {
            const pathFer = ferPoints.map(l => `${mapX(l.id)},${mapY(l.ferritin)}`).join(' L ');
            svg += `<path d="M ${pathFer}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
        }
    }

    // Points and Value Callouts
    labs.forEach(l => {
        const x = mapX(l.id);

        // Vertical Guide line down to date
        svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + chartH}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2,2" />`;
        
        // Date Label below X axis
        svg += `<text x="${x}" y="${padTop + chartH + 18}" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">${l.id}</text>`;

        // Hemoglobin Point + Badge
        if (l.hemoglobin !== null && l.hemoglobin !== undefined) {
            const yHb = mapY(l.hemoglobin);
            svg += `<circle cx="${x}" cy="${yHb}" r="5.5" fill="#e11d48" stroke="#ffffff" stroke-width="2" shadow="drop-shadow(0 1px 2px rgba(0,0,0,0.1))" />`;
            svg += `<rect x="${x - 26}" y="${yHb - 22}" width="52" height="16" rx="4" fill="#e11d48" />`;
            svg += `<text x="${x}" y="${yHb - 10}" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">Hb: ${l.hemoglobin}</text>`;
        }

        // Ferritin Point + Badge
        if (l.ferritin !== null && l.ferritin !== undefined) {
            const yFer = mapY(l.ferritin);
            svg += `<circle cx="${x}" cy="${yFer}" r="5.5" fill="#2563eb" stroke="#ffffff" stroke-width="2" />`;
            svg += `<rect x="${x - 30}" y="${yFer + 8}" width="60" height="16" rx="4" fill="#2563eb" />`;
            svg += `<text x="${x}" y="${yFer + 20}" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">Fer: ${l.ferritin}</text>`;
        }
    });

    // Legend at top
    svg += `<g transform="translate(${padLeft}, 15)">
        <circle cx="6" cy="4" r="4.5" fill="#e11d48" />
        <text x="16" y="8" font-size="11" font-weight="bold" fill="#e11d48">Hemoglobin (Hb)</text>
        <circle cx="160" cy="4" r="4.5" fill="#2563eb" />
        <text x="170" y="8" font-size="11" font-weight="bold" fill="#2563eb">Ferritin</text>
    </g>`;

    svg += `</svg>`;
    container.innerHTML = svg;
}

function setupExport(days, labs) {
    document.getElementById('btn-export').addEventListener('click', () => {
        let csv = "Date,DosesTaken,Energy,Nausea,Dizziness,Notes\n";
        days.forEach(d => {
            const sym = d.symptoms || {};
            const notes = (sym.notes || "").replace(/"/g, '""');
            csv += `${d.id},${d.dosesTaken},${sym.energy || ''},${sym.nausea || ''},${sym.dizziness || ''},"${notes}"\n`;
        });
        
        csv += "\nLab Date,Hemoglobin,Ferritin,Notes\n";
        labs.forEach(l => {
             const notes = (l.notes || "").replace(/"/g, '""');
             csv += `${l.id},${l.hemoglobin || ''},${l.ferritin || ''},"${notes}"\n`;
        });

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anemia-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}
