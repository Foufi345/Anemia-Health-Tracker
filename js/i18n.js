const dictionary = {
    ar: {
        loginTitle: "تسجيل الدخول",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        loginBtn: "دخول",
        navDashboard: "لوحة التحكم",
        navToday: "اليوم",
        navInventory: "المخزون",
        navSettings: "الإعدادات",
        navLogout: "خروج",
        comingSoon: "قريباً",
        dashboardTitle: "لوحة التحكم",
        exportData: "تصدير البيانات",
        adherenceWeek: "التزام هذا الأسبوع",
        currentStreak: "الاستمرارية",
        bestStreak: "أفضل رقم:",
        treatmentProgress: "تقدم العلاج",
        historyHeatmap: "سجل الأيام",
        less: "أقل",
        more: "أكثر",
        weeklyAvg: "المتوسط الأسبوعي",
        labTrends: "نتائج التحاليل",
        addLabResult: "+ إضافة نتيجة",
        noLabData: "لا توجد بيانات مسجلة بعد.",
        dosesTakenLabel: "الجرعات المتناولة:",
        symptomsSummary: "الأعراض:",
        energy: "الطاقة",
        nausea: "الغثيان",
        dizziness: "الدوخة",
        notes: "ملاحظات",
        notesPlaceholder: "كيف تشعرين اليوم؟ هل هناك أي تغيرات؟",
        medicationDoses: "جرعات الدواء",
        nauseaControl: "السيطرة على الغثيان",
        nauseaDesc: "أكمل الوجبات الخفيفة وتجنب الجوع لتقليل الغثيان.",
        mealsSupplements: "اللوحة اليومية",
        dailyJournal: "السجل اليومي للأعراض",
        loading: "جاري التحميل...",
        shoppingList: "قائمة المشتريات التلقائية",
        inventory: "المخزون",
        addProduct: "إضافة منتج",
        prodName: "الاسم",
        prodIcon: "أيقونة (إيموجي)",
        prodCategory: "التصنيف",
        prodCategoryHint: "مثال: لحوم، خضروات، أدوية",
        prodUnit: "الوحدة",
        prodUnitHint: "حصة، حبة...",
        prodStock: "المخزون الحالي",
        prodPortion: "الاستهلاك للوجبة",
        prodThreshold: "حد التنبيه (لإضافته للمشتريات)",
        save: "حفظ",
        saved: "تم الحفظ",
        settingsTitle: "الإعدادات",
        profileSettings: "الملف الشخصي والعلاج",
        medName: "اسم الدواء / المكمل",
        doseTarget: "الهدف اليومي (عدد الجرعات)",
        startDate: "تاريخ بداية العلاج",
        goalDays: "مدة العلاج المستهدفة (أيام)",
        appearanceSettings: "المظهر واللغة",
        language: "اللغة (Language)",
        theme: "المظهر",
        themeLight: "فاتح",
        themeDark: "داكن",
        scheduleManager: "إدارة الوجبات والجدول اليومي",
        addSlot: "+ إضافة وجبة",
        labResultsEntry: "تسجيل التحاليل المخبرية",
        date: "التاريخ",
        notesPlaceholderLab: "صائم، إلخ...",
        saveResult: "تسجيل"
    },
    en: {
        loginTitle: "Login",
        email: "Email",
        password: "Password",
        loginBtn: "Enter",
        navDashboard: "Dashboard",
        navToday: "Today",
        navInventory: "Inventory",
        navSettings: "Settings",
        navLogout: "Logout",
        comingSoon: "Coming Soon",
        dashboardTitle: "Dashboard",
        exportData: "Export Data",
        adherenceWeek: "This Week's Adherence",
        currentStreak: "Streak",
        bestStreak: "Best: ",
        treatmentProgress: "Treatment Progress",
        historyHeatmap: "History Heatmap",
        less: "Less",
        more: "More",
        weeklyAvg: "Weekly Average",
        labTrends: "Lab Results",
        addLabResult: "+ Add Result",
        noLabData: "No data logged yet.",
        dosesTakenLabel: "Doses Taken:",
        symptomsSummary: "Symptoms:",
        energy: "Energy",
        nausea: "Nausea",
        dizziness: "Dizziness",
        notes: "Notes",
        notesPlaceholder: "How do you feel today? Any changes?",
        medicationDoses: "Medication Doses",
        nauseaControl: "Nausea Control",
        nauseaDesc: "Complete snacks and avoid hunger to reduce nausea.",
        mealsSupplements: "Daily Checklist",
        dailyJournal: "Daily Symptoms Journal",
        loading: "Loading...",
        shoppingList: "Auto Shopping List",
        inventory: "Inventory",
        addProduct: "Add Product",
        prodName: "Name",
        prodIcon: "Icon (Emoji)",
        prodCategory: "Category",
        prodCategoryHint: "e.g. Meat, Veggies, Meds",
        prodUnit: "Unit",
        prodUnitHint: "portion, pill...",
        prodStock: "Current Stock",
        prodPortion: "Portion per use",
        prodThreshold: "Low Stock Threshold",
        save: "Save",
        saved: "Saved",
        settingsTitle: "Settings",
        profileSettings: "Profile & Treatment",
        medName: "Medication / Supplement Name",
        doseTarget: "Daily Target (Doses)",
        startDate: "Treatment Start Date",
        goalDays: "Treatment Goal (Days)",
        appearanceSettings: "Appearance & Language",
        language: "Language (اللغة)",
        theme: "Theme",
        themeLight: "Light",
        themeDark: "Dark",
        scheduleManager: "Meals & Schedule Manager",
        addSlot: "+ Add Meal",
        labResultsEntry: "Lab Results Entry",
        date: "Date",
        notesPlaceholderLab: "Fasting, etc...",
        saveResult: "Save"
    }
};

export function applyLanguage(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    const dict = dictionary[lang] || dictionary['en'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            // If element contains span or other elements, this might wipe them out.
            // Better to only replace text nodes, but for our simple UI, direct replacement or checking childnodes is ok.
            // Since we mix icons in some places (like `<span>👤</span> الملف الشخصي`), we need to be careful.
            // Actually, in the HTML I separated icons into spans, so the text should be applied to the specific element containing the text.
            el.innerHTML = dict[key]; 
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            el.placeholder = dict[key];
        }
    });
}

export function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('bg-slate-900', 'text-slate-200');
        document.body.classList.remove('bg-slate-50', 'text-slate-800');
    } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('bg-slate-900', 'text-slate-200');
        document.body.classList.add('bg-slate-50', 'text-slate-800');
    }
}
