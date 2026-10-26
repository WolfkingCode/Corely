/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'fa' | 'en';

export const translations = {
  fa: {
    // Nav items
    home: 'خانه',
    ai: 'دستیار هوشمند',
    note: 'یادداشت‌ها',
    ideas: 'ایده‌ها',
    edit_assets: 'منابع ادیت',
    routine: 'روتین',
    tasks: 'کارها و خرید',
    habits: 'عادت‌ها',
    finance: 'مدیریت مالی',
    downloads: 'دانلود منیجر',
    dns: 'تغییر دی‌ان‌اس',
    settings: 'تنظیمات',
    
    // Header & Workspace
    myAssistant: 'دستیار من',
    activeProfile: 'پروفایل فعال',
    lockApp: 'قفل برنامه',
    quickSearch: 'جستجوی سریع...',

    // Common Buttons & Labels
    submit: 'ثبت',
    save: 'ذخیره',
    cancel: 'انصراف',
    delete: 'حذف',
    edit: 'ویرایش',
    search: 'جستجو...',
    all: 'همه',
    filter: 'فیلتر',
    priority: 'اولویت',
    category: 'دسته‌بندی',
    status: 'وضعیت',
    normal: 'معمولی',
    important: 'مهم',
    urgent: 'ضروری',
    completed: 'انجام‌شده',
    pending: 'در انتظار',
    
    // Habits
    habitsTitle: 'ردیاب عادت‌ها',
    doHabit: 'انجام عادت',
    quitHabit: 'ترک عادت',
    
    // Tasks
    tasksProgress: 'پیشرفت کارهای جاری',
    todos: 'کارها',
    shopping: 'لیست خرید',
    addNewItem: 'افزودن آیتم جدید',
    newTaskPlaceholder: 'عنوان کار جدید را بنویسید...',
    newShoppingPlaceholder: 'نام کالایی که باید بخرید را بنویسید...',
    
    // Finance
    totalIncome: 'کل درآمد',
    totalExpense: 'کل هزینه',
    monthlyBalance: 'موجودی کل',
    addTransaction: 'افزودن تراکنش جدید',
    incomeVsExpenseRatio: 'نسبت مصرف هزینه به درآمد این ماه',

    // Settings
    settingsTitle: 'تنظیمات و پیکربندی برنامه',
    generalAndProfile: 'عمومی و پروفایل',
    appearanceAndDesign: 'ظاهر و دیزاین',
    backupAndExport: 'پشتیبان و خروجی',
    securityAndPasscode: 'حریم خصوصی و امنیت',
    notifications: 'اعلان‌ها',
    systemStats: 'آمار سیستم',
    appLanguage: 'زبان برنامه / App Language',
    selectLanguageDesc: 'انتخاب زبان رابط کاربری (چیدمان راست‌به‌چپ حفظ می‌شود)',
    userNameLabel: 'نام شما (جهت نمایش در ساعت و داشبورد):',
    calendarTypeLabel: 'نوع تقویم اصلی:',
    jalali: 'هجری شمسی',
    gregorian: 'میلادی',
    clockFormatLabel: 'فرمت ساعت:',

    // AI
    aiAssistant: 'دستیار هوشمند و مولد',
    typeMessage: 'پیام خود را بنویسید...',
  },
  en: {
    // Nav items
    home: 'Home',
    ai: 'AI Assistant',
    note: 'Notes',
    ideas: 'Ideas',
    edit_assets: 'Editing Assets',
    routine: 'Routine',
    tasks: 'Tasks & Shopping',
    habits: 'Habits',
    finance: 'Financial Management',
    downloads: 'Download Manager',
    dns: 'DNS Changer',
    settings: 'Settings',

    // Header & Workspace
    myAssistant: 'My Assistant',
    activeProfile: 'Active Profile',
    lockApp: 'Lock App',
    quickSearch: 'Quick Search...',

    // Common Buttons & Labels
    submit: 'Submit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search...',
    all: 'All',
    filter: 'Filter',
    priority: 'Priority',
    category: 'Category',
    status: 'Status',
    normal: 'Normal',
    important: 'Important',
    urgent: 'Urgent',
    completed: 'Completed',
    pending: 'Pending',

    // Habits
    habitsTitle: 'Habit Tracker',
    doHabit: 'Do Habit',
    quitHabit: 'Quit Habit',

    // Tasks
    tasksProgress: 'Current Tasks Progress',
    todos: 'Tasks',
    shopping: 'Shopping List',
    addNewItem: 'Add New Item',
    newTaskPlaceholder: 'Type new task title...',
    newShoppingPlaceholder: 'Type item to buy...',

    // Finance
    totalIncome: 'Total Income',
    totalExpense: 'Total Expenses',
    monthlyBalance: 'Net Balance',
    addTransaction: 'Add New Transaction',
    incomeVsExpenseRatio: 'Monthly Expense to Income Ratio',

    // Settings
    settingsTitle: 'Settings & App Configuration',
    generalAndProfile: 'General & Profile',
    appearanceAndDesign: 'Appearance & Design',
    backupAndExport: 'Backup & Export',
    securityAndPasscode: 'Privacy & Security',
    notifications: 'Notifications',
    systemStats: 'System Stats',
    appLanguage: 'App Language / زبان برنامه',
    selectLanguageDesc: 'Select interface language (Right-to-Left layout maintained)',
    userNameLabel: 'Your Name (for clock & dashboard):',
    calendarTypeLabel: 'Primary Calendar:',
    jalali: 'Jalali (Solar)',
    gregorian: 'Gregorian',
    clockFormatLabel: 'Clock Format:',

    // AI
    aiAssistant: 'AI Assistant',
    typeMessage: 'Type your message...',
  }
};

export function getTranslation(lang: Language = 'en') {
  return translations[lang] || translations.en;
}
