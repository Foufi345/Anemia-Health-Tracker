import os
import re

translations = {
    # index.html
    "تسجيل الدخول": "Login",
    "البريد الإلكتروني": "Email",
    "كلمة المرور": "Password",
    "دخول": "Enter",
    "قريباً": "Coming Soon",
    "جاري التحميل...": "Loading...",

    # nav.js
    "لوحة التحكم": "Dashboard",
    "اليوم": "Today",
    "المخزون": "Inventory",
    "الإعدادات": "Settings",
    "خروج": "Logout",

    # dashboard
    "تصدير البيانات": "Export Data",
    "التزام هذا الأسبوع": "This Week's Adherence",
    "الاستمرارية": "Streak",
    "أفضل رقم:": "Best:",
    "تقدم العلاج": "Treatment Progress",
    "سجل الأيام": "History Heatmap",
    "أقل": "Less",
    "أكثر": "More",
    "المتوسط الأسبوعي": "Weekly Average",
    "نتائج التحاليل": "Lab Results",
    "إضافة نتيجة": "+ Add Result",
    "لا توجد بيانات مسجلة بعد.": "No data logged yet.",
    "الجرعات المتناولة:": "Doses Taken:",
    "الأعراض:": "Symptoms:",
    "الطاقة": "Energy",
    "الغثيان": "Nausea",
    "الدوخة": "Dizziness",
    "ملاحظات": "Notes",
    "لا توجد ملاحظات.": "No notes.",
    "النهاية المتوقعة:": "Expected End:",
    
    # today
    "جرعات الدواء": "Medication Doses",
    "السيطرة على الغثيان": "Nausea Control",
    "أكمل الوجبات الخفيفة وتجنب الجوع لتقليل الغثيان.": "Complete snacks and avoid hunger to reduce nausea.",
    "اللوحة اليومية": "Daily Checklist",
    "السجل اليومي للأعراض": "Daily Symptoms Journal",
    "كيف تشعرين اليوم؟ هل هناك أي تغيرات؟": "How do you feel today? Any changes?",
    "مستقر": "Stable",
    "خطر الغثيان": "Nausea Risk",
    "جرعة": "Dose",
    "الدواء": "Medication",
    "حفظ": "Save",
    
    # inventory
    "قائمة المشتريات التلقائية": "Auto Shopping List",
    "تم الشراء ✔️": "Purchased ✔️",
    "متبقي": "Remaining",
    "فقط": "only",
    "الحد الأدنى": "Minimum",
    "إضافة منتج": "Add Product",
    "تعديل منتج": "Edit Product",
    "الاسم": "Name",
    "أيقونة (إيموجي)": "Icon (Emoji)",
    "التصنيف": "Category",
    "مثال: لحوم، خضروات، أدوية": "e.g. Meat, Veggies, Meds",
    "الوحدة": "Unit",
    "حصة، حبة...": "portion, pill...",
    "المخزون الحالي": "Current Stock",
    "الاستهلاك للوجبة": "Portion per use",
    "حد التنبيه (لإضافته للمشتريات)": "Low Stock Threshold",
    "هل أنت متأكد من حذف هذا المنتج؟": "Are you sure you want to delete this product?",
    "كم الكمية التي قمت بشرائها؟": "How much did you purchase?",
    
    # settings
    "الملف الشخصي والعلاج": "Profile & Treatment",
    "اسم الدواء / المكمل": "Medication / Supplement Name",
    "الهدف اليومي (عدد الجرعات)": "Daily Target (Doses)",
    "تاريخ بداية العلاج": "Treatment Start Date",
    "مدة العلاج المستهدفة (أيام)": "Treatment Goal (Days)",
    "المظهر واللغة": "Appearance & Language",
    "اللغة (Language)": "Language",
    "المظهر": "Theme",
    "فاتح": "Light",
    "داكن": "Dark",
    "إدارة الوجبات والجدول اليومي": "Meals & Schedule Manager",
    "إضافة وجبة": "Add Meal",
    "وجبة جديدة": "New Meal",
    "تسجيل التحاليل المخبرية": "Lab Results Entry",
    "التاريخ": "Date",
    "صائم، إلخ...": "Fasting, etc...",
    "تسجيل": "Save",
    "تم الحفظ": "Saved",
    "بدون استهلاك منتج": "No product consumed",
    "اسم الوجبة": "Meal Name",
    "وصف أو ملاحظة (اختياري)": "Description or Note (Optional)",
    "تتضمن جرعة دواء": "Contains medication dose",
    "تفعيل التنبيهات (المحلية)": "Enable Reminders (Local)",
    "التنبيهات": "Reminders",
    "تفعيل التنبيه": "Enable Reminder",
    "حذف هذه الوجبة؟": "Delete this meal?",
    "حذف هذه النتيجة؟": "Delete this result?",

    # reminders
    "تذكير:": "Reminder:",
    "حان وقت الوجبة / الدواء": "Time for your meal / medication",
    "هل أتممت:": "Did you complete:",
    "سيتم تحديث السجل والمخزون.": "The log and inventory will be updated.",
    "تم التحديث بنجاح!": "Updated successfully!",
}

regex_translations = {
    r"اليوم (\d+) من (\d+)": r"Day \1 of \2",
    r"متبقي (.*?) (.*?) فقط \(الحد الأدنى (.*?)\)": r"Only \1 \2 remaining (Min \3)",
    r"💊 جرعة (.*?)": r"💊 \1 Dose",
    r"النهاية المتوقعة: (.*?)": r"Expected End: \1"
}

files_to_process = [
    "index.html",
    "dashboard.html",
    "today.html",
    "inventory.html",
    "settings.html",
    "js/nav.js",
    "js/dashboard.js",
    "js/today.js",
    "js/inventory.js",
    "js/settings.js",
    "js/reminders.js",
]

def replace_arabic(content):
    # First regex replacements
    for pattern, repl in regex_translations.items():
        content = re.sub(pattern, repl, content)
    
    # Then exact string replacements
    # Sort by length descending to replace longer phrases first
    sorted_keys = sorted(translations.keys(), key=len, reverse=True)
    for ar in sorted_keys:
        en = translations[ar]
        content = content.replace(ar, en)
        
    return content

for filename in files_to_process:
    filepath = os.path.join("/Users/foufi/Desktop/Anemia Heal Tracker", filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Change dir="rtl" to dir="ltr" and lang="ar" to lang="en" in HTML
        if filename.endswith(".html"):
            content = content.replace('dir="rtl"', 'dir="ltr"')
            content = content.replace('lang="ar"', 'lang="en"')

        new_content = replace_arabic(content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Processed {filename}")
