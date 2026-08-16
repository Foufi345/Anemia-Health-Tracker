import { db } from './firebase-init.js';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

let currentUid = null;
let productsData = [];

export function initInventory(uid) {
    currentUid = uid;
    const productsRef = collection(db, "users", uid, "products");

    onSnapshot(productsRef, (snap) => {
        productsData = [];
        snap.forEach(d => {
            productsData.push({ id: d.id, ...d.data() });
        });
        
        renderInventory();
        renderShoppingList();
    });

    // Form handling
    document.getElementById('btn-add-product').addEventListener('click', () => {
        openModal();
    });

    document.getElementById('close-product-modal').addEventListener('click', () => {
        document.getElementById('product-modal').classList.add('hidden');
    });

    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idInput = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const icon = document.getElementById('prod-icon').value;
        const category = document.getElementById('prod-category').value;
        const unit = document.getElementById('prod-unit').value;
        const stockQty = parseFloat(document.getElementById('prod-stock').value) || 0;
        const portionPerUse = parseFloat(document.getElementById('prod-portion').value) || 1;
        const lowStockThreshold = parseFloat(document.getElementById('prod-threshold').value) || 0;

        const data = { name, icon, category, unit, stockQty, portionPerUse, lowStockThreshold };

        try {
            if (idInput) {
                await updateDoc(doc(db, "users", uid, "products", idInput), data);
            } else {
                const newId = crypto.randomUUID();
                await setDoc(doc(db, "users", uid, "products", newId), data);
            }
            document.getElementById('product-modal').classList.add('hidden');
        } catch (err) {
            console.error("Save product error", err);
        }
    });
}

function openModal(prod = null) {
    document.getElementById('prod-id').value = prod ? prod.id : '';
    document.getElementById('prod-name').value = prod ? prod.name : '';
    document.getElementById('prod-icon').value = prod ? prod.icon : '📦';
    document.getElementById('prod-category').value = prod ? prod.category : '';
    document.getElementById('prod-unit').value = prod ? prod.unit : '';
    document.getElementById('prod-stock').value = prod ? prod.stockQty : 0;
    document.getElementById('prod-portion').value = prod ? prod.portionPerUse : 1;
    document.getElementById('prod-threshold').value = prod ? prod.lowStockThreshold : 1;
    
    document.getElementById('product-modal-title').innerText = prod ? 'Edit Product' : 'Add Product';
    document.getElementById('product-modal').classList.remove('hidden');
}

window.editProduct = (id) => {
    const prod = productsData.find(p => p.id === id);
    if (prod) openModal(prod);
};

window.deleteProduct = async (id) => {
    if(confirm("Are you sure you want to delete this product?")) {
        await deleteDoc(doc(db, "users", currentUid, "products", id));
    }
};

window.consumeProduct = async (id) => {
    const prod = productsData.find(p => p.id === id);
    if (prod && prod.stockQty > 0) {
        let newQty = Math.max(0, prod.stockQty - prod.portionPerUse);
        await updateDoc(doc(db, "users", currentUid, "products", id), { stockQty: newQty });
    }
};

window.purchaseProduct = async (id) => {
    const qtyStr = prompt("How much did you purchase?", "1");
    if (qtyStr) {
        const qty = parseFloat(qtyStr);
        if (!isNaN(qty) && qty > 0) {
            const prod = productsData.find(p => p.id === id);
            if (prod) {
                await updateDoc(doc(db, "users", currentUid, "products", id), { stockQty: prod.stockQty + qty });
            }
        }
    }
};

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';

    // Group by category
    const grouped = {};
    productsData.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
    });

    const categoryColors = ['border-t-orange-500', 'border-t-rose-500', 'border-t-blue-500', 'border-t-green-500', 'border-t-purple-500'];

    Object.keys(grouped).forEach((cat, idx) => {
        const colorClass = categoryColors[idx % categoryColors.length];
        
        const card = document.createElement('div');
        card.className = `bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-t-4 ${colorClass}`;
        
        let html = `<h3 class="font-bold text-slate-800 mb-3">${cat}</h3>`;
        html += `<ul class="space-y-3 text-sm">`;
        
        grouped[cat].forEach(p => {
            const isLow = p.stockQty <= p.lowStockThreshold;
            const barColor = isLow ? 'bg-red-500' : (p.stockQty <= p.lowStockThreshold * 2 ? 'bg-orange-400' : 'bg-green-500');
            const pct = Math.min(100, (p.stockQty / (p.lowStockThreshold * 3 || 1)) * 100);

            html += `
                <li class="bg-slate-50 p-3 rounded border ${isLow ? 'border-red-200' : 'border-slate-100'}">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">${p.icon}</span>
                            <div>
                                <div class="font-bold text-slate-700">${p.name}</div>
                                <div class="text-xs text-slate-500">${p.stockQty} ${p.unit}</div>
                            </div>
                        </div>
                        <div class="flex gap-1">
                            <button onclick="consumeProduct('${p.id}')" class="text-slate-400 hover:text-rose-500 transition px-1" title="-${p.portionPerUse}">➖</button>
                            <button onclick="editProduct('${p.id}')" class="text-slate-400 hover:text-blue-500 transition px-1">✏️</button>
                            <button onclick="deleteProduct('${p.id}')" class="text-slate-400 hover:text-red-500 transition px-1">🗑️</button>
                        </div>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                        <div class="${barColor} h-1.5 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                    </div>
                </li>
            `;
        });
        
        html += `</ul>`;
        card.innerHTML = html;
        grid.appendChild(card);
    });
}

function renderShoppingList() {
    const section = document.getElementById('shopping-list-section');
    const container = document.getElementById('shopping-list-container');
    container.innerHTML = '';

    const toBuy = productsData.filter(p => p.stockQty <= p.lowStockThreshold);
    // Sort by urgency (lowest stock relative to threshold first)
    toBuy.sort((a, b) => (a.stockQty - a.lowStockThreshold) - (b.stockQty - b.lowStockThreshold));

    if (toBuy.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    toBuy.forEach(p => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center bg-white p-3 rounded shadow-sm border border-red-100';
        row.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-2xl">${p.icon}</span>
                <div>
                    <div class="font-bold text-slate-800">${p.name}</div>
                    <div class="text-xs text-red-500 font-medium">Only ${p.stockQty} ${p.unit} remaining (Min ${p.lowStockThreshold})</div>
                </div>
            </div>
            <button onclick="purchaseProduct('${p.id}')" class="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded font-bold text-sm transition shadow-sm">
                Purchased ✔️
            </button>
        `;
        container.appendChild(row);
    });
}
