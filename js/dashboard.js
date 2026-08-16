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

        renderAdherenceRing(allDays, profile.doseTarget);
        renderStreak(allDays, profile.doseTarget);
        renderCountdown(profile);
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

function renderCountdown(profile) {
    if (profile.treatmentStartDate && profile.treatmentGoalDays) {
        const start = new Date(profile.treatmentStartDate);
        const today = new Date();
        const diffTime = Math.abs(today - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        const goal = profile.treatmentGoalDays;
        const remaining = goal - diffDays;
        
        const end = new Date(start);
        end.setDate(end.getDate() + goal);

        document.getElementById('countdown-card').classList.remove('hidden');
        document.getElementById('countdown-days').innerText = `Today ${diffDays} من ${goal}`;
        document.getElementById('countdown-date').innerText = `Expected End: ${end.toISOString().split('T')[0]}`;
    }
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
    
    if (labs.length === 0) {
        empty.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    container.classList.remove('hidden');

    // Simple SVG line chart
    const w = container.clientWidth;
    const h = container.clientHeight;
    
    // Bounds
    let minDate = new Date(labs[0].id).getTime();
    let maxDate = new Date(labs[labs.length-1].id).getTime();
    if (minDate === maxDate) maxDate += 86400000; // Add 1 day if only 1 data point

    let minVal = Math.min(...labs.map(l => Math.min(l.hemoglobin || 100, l.ferritin || 100)));
    let maxVal = Math.max(...labs.map(l => Math.max(l.hemoglobin || 0, l.ferritin || 0)));
    
    minVal = Math.max(0, minVal - 5);
    maxVal = maxVal + 10;

    const mapX = (dateStr) => ((new Date(dateStr).getTime() - minDate) / (maxDate - minDate)) * (w - 40) + 20;
    const mapY = (val) => h - (((val - minVal) / (maxVal - minVal)) * (h - 40) + 20);

    let svg = `<svg viewBox="0 0 ${w} ${h}" class="w-full h-full">`;
    
    // Normal Hb band (12 - 15.5)
    const yTop = mapY(15.5);
    const yBottom = mapY(12);
    svg += `<rect x="20" y="${yTop}" width="${w-40}" height="${yBottom - yTop}" fill="#dcfce7" opacity="0.5" />`;

    // Path Hb (Red)
    let ptsHb = labs.filter(l => l.hemoglobin).map(l => `${mapX(l.id)},${mapY(l.hemoglobin)}`).join(' L ');
    if (ptsHb) svg += `<path d="M ${ptsHb}" fill="none" stroke="#e11d48" stroke-width="2" />`;
    
    // Path Ferritin (Blue)
    let ptsFer = labs.filter(l => l.ferritin).map(l => `${mapX(l.id)},${mapY(l.ferritin)}`).join(' L ');
    if (ptsFer) svg += `<path d="M ${ptsFer}" fill="none" stroke="#2563eb" stroke-width="2" />`;

    // Points
    labs.forEach(l => {
        if (l.hemoglobin) {
            svg += `<circle cx="${mapX(l.id)}" cy="${mapY(l.hemoglobin)}" r="4" fill="#e11d48"><title>Hb: ${l.hemoglobin} (${l.id})</title></circle>`;
        }
        if (l.ferritin) {
             svg += `<circle cx="${mapX(l.id)}" cy="${mapY(l.ferritin)}" r="4" fill="#2563eb"><title>Ferritin: ${l.ferritin} (${l.id})</title></circle>`;
        }
    });

    // Legend
    svg += `<text x="30" y="20" font-size="12" fill="#e11d48" font-family="sans-serif">Hemoglobin (Hb)</text>`;
    svg += `<text x="150" y="20" font-size="12" fill="#2563eb" font-family="sans-serif">Ferritin</text>`;

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
