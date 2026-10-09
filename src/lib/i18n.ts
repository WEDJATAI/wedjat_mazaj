// Full Arabic translations for the Mazaj platform.
// Used by the language store (src/store/i18n.ts) to toggle EN ↔ AR.

export type Lang = "en" | "ar";

export interface Translations {
  // Sign-in
  mazaj: string;
  hookahLounge: string;
  imStaff: string;
  imStaffDesc: string;
  imGuest: string;
  imGuestDesc: string;
  justBrowsing: string;
  staffPins: string;
  enterPin: string;
  guestCheckIn: string;
  yourName: string;
  tableOptional: string;
  startOrdering: string;
  back: string;
  cancel: string;
  delete: string;
  checking: string;
  welcome: string;

  // Dashboard tabs
  queue: string;
  new: string;
  inventory: string;
  requests: string;
  staff: string;
  buy: string;
  profit: string;
  sync: string;
  analytics: string;
  loyalty: string;
  track: string;
  noAccess: string;
  signOut: string;

  // Bowl builder
  bowlBuilder: string;
  build: string;
  buildBowl: string;
  customer: string;
  tableNumber: string;
  tableRequired: string;
  tableRequiredDesc: string;
  quickPresets: string;
  thisOrder: string;
  noBowlsYet: string;
  noBowlsDesc: string;
  clearAll: string;
  chooseShisha: string;
  chooseShishaDesc: string;
  regularShisha: string;
  amyShisha: string;
  changeCategory: string;
  change: string;
  brands: string;
  popularBowls: string;
  oneTapAdd: string;
  sendOrder: string;
  orderSent: string;
  orderSentDesc: string;
  newOrder: string;
  from: string;
  inCart: string;
  revenue: string;
  netProfit: string;
  margin: string;
  byo: string;
  bowl: string;
  bowls: string;
  for2for1: string;

  // Config sheet
  pickFlavor: string;
  fruits: string;
  mix: string;
  type: string;
  quantity: string;
  lineTotal: string;
  addToCart: string;
  addFlavor: string;
  addAnotherFlavor: string;
  mixFlavors: string;
  mixMatch: string;
  noFlavorsYet: string;

  // Cart
  cart: string;
  yourOrder: string;
  currentOrder: string;
  subtotal: string;
  total: string;
  byoSaving: string;
  addons: string;
  checkout: string;
  emptyCart: string;
  emptyCartDesc: string;

  // Checkout
  customerName: string;
  customerNameOptional: string;
  phone: string;
  phoneOptional: string;
  tableRoom: string;
  notes: string;
  notesOptional: string;
  placeOrder: string;
  placingOrder: string;
  orderPlaced: string;
  orderId: string;
  done: string;

  // Inventory
  molasses: string;
  supplies: string;
  coalFoil: string;
  inStock: string;
  low: string;
  restock: string;
  flavorStock: string;
  flavors: string;
  brandsTracked: string;
  totalMolasses: string;
  totalHookahsLeft: string;
  lowStock: string;
  hookahsLeft: string;
  stock: string;
  min: string;
  reusable: string;
  notAutoDeducted: string;
  medicalHose: string;
  regularCoal: string;
  cubedCoal: string;
  foil: string;

  // Orders panel
  orderQueue: string;
  activeSessions: string;
  incoming: string;
  tapToConfirm: string;
  confirmTake: string;
  myOrders: string;
  otherActive: string;
  doneOrders: string;
  walkIn: string;
  guestSelfOrder: string;
  assigned: string;
  comments: string;
  orderComments: string;
  noCommentsYet: string;
  addComment: string;
  author: string;
  comment: string;
  startPreparing: string;
  backToPending: string;
  markDone: string;
  noOrdersYet: string;
  noOrdersDesc: string;

  // Requests
  requestsTitle: string;
  guestCalls: string;
  callShishaMan: string;
  callShishaManDesc: string;
  sendRequest: string;
  sending: string;
  requestCoal: string;
  requestCoalDesc: string;
  regularCoalType: string;
  cubedCoalType: string;
  quickLight: string;
  longerBurn: string;
  coalRequestSent: string;
  shishaManOnWay: string;
  pending: string;
  inProgress: string;
  acknowledged: string;
  noRequestsYet: string;
  noRequestsDesc: string;
  autoRefresh: string;

  // Employees
  employees: string;
  manageStaff: string;
  addEmployee: string;
  editEmployee: string;
  role: string;
  superAdmin: string;
  admin: string;
  employee: string;
  tabAccess: string;
  permissions: string;
  createEmployee: string;
  saveChanges: string;
  deactivate: string;
  activate: string;
  remove: string;
  pin: string;
  pinDigits: string;

  // Purchases
  purchases: string;
  buyMolasses: string;
  buyStock: string;
  buyDesc: string;
  totalSpent: string;
  lastPurchase: string;
  buyAndRestock: string;
  molassesPacks: string;
  procurementSpend: string;

  // Profit
  profitTitle: string;
  revenueCostMargin: string;
  cogs: string;
  molassesCost: string;
  suppliesCost: string;
  profitByBrand: string;
  recentOrders: string;
  cost: string;
  hookahsSold: string;

  // Sync
  wedjatSync: string;
  connectionHealth: string;
  connected: string;
  disconnected: string;
  connectedToWedjat: string;
  checkRevocations: string;
  checkRevocationsDesc: string;
  syncPrices: string;
  syncPricesDesc: string;
  synced: string;
  revoked: string;
  failed: string;
  revokedByWedjat: string;
  revokedBy: string;
  fromWedjat: string;
  noSyncedOrders: string;
  noSyncedDesc: string;

  // Misc
  egp: string;
  perHookah: string;
  flame: string;

  // PWA — get the app / install / two-way sync
  getApp: string;
  getAppDesc: string;
  scanToInstall: string;
  scanHint: string;
  installNow: string;
  installing: string;
  landingTagline: string;
  installMeta: string;
  installFree: string;
  preparingDownload: string;
  preparingHint: string;
  installAndroidIntro: string;
  installFallbackTitle: string;
  retry: string;
  installIosTitle: string;
  installIosIntro: string;
  iosInstallNote: string;
  openInSafariTitle: string;
  openInSafariDesc: string;
  openInSafariStep: string;
  installSuccessTitle: string;
  installSuccessDesc: string;
  startUsing: string;
  continueInBrowser: string;
  scanWithPhone: string;
  howTo: string;
  youHaveApp: string;
  iosStep1: string;
  iosStep2: string;
  iosStep3: string;
  installFromMenu: string;
  apkButton: string;
  apkSub: string;
  apkStarted: string;
  apkAfterTitle: string;
  apkStep1: string;
  apkStep2: string;
  apkStep3: string;
  orDivider: string;
  instantAdd: string;
  iosNoStore: string;
  sheetApk: string;
  syncTitle: string;
  syncDesc1: string;
  syncDesc2: string;
  featTracking: string;
  featLoyalty: string;
  featOffline: string;
  installBanner: string;
  installBannerDesc: string;
  later: string;
  offlineMode: string;
  queuedOrders: string;
  syncingOrders: string;
  ordersSynced: string;
}

export const translations: Record<Lang, Partial<Translations>> = {
  en: {
    getApp: "Get the app",
    getAppDesc:
      "The full Mazaj platform on your phone — install in seconds, no app store needed.",
    scanToInstall: "Scan to install",
    scanHint:
      "Point any phone camera at the code — it opens a full install screen. Works on iPhone & Android.",
    installNow: "Install now",
    installing: "Installing…",
    landingTagline: "The full lounge in your pocket — order, track, earn.",
    installMeta: "Free · 2–4 MB · installs in seconds",
    installFree: "Install — Free",
    preparingDownload: "Preparing download…",
    preparingHint: "One moment — getting Mazaj ready for your phone.",
    installAndroidIntro:
      "The APK is the full app in one file — your phone installs it directly and it lands on your home screen with the Mazaj icon.",
    installFallbackTitle: "One more step",
    retry: "Try again",
    installIosTitle: "Install on iPhone",
    installIosIntro:
      "Apple installs full-screen apps from Safari — it takes 5 seconds:",
    iosInstallNote:
      "Mazaj then works like any app — full screen, offline, on your home screen.",
    openInSafariTitle: "Open in Safari to install",
    openInSafariDesc:
      "You're viewing this inside another app, which can't install apps. Open it in Safari and the install guide appears.",
    openInSafariStep: "Tap the Share icon, then choose “Open in Safari”",
    installSuccessTitle: "Mazaj is installing ✓",
    installSuccessDesc:
      "The download is on its way — Mazaj will appear on your home screen in a moment.",
    startUsing: "Start using Mazaj",
    continueInBrowser: "Continue in browser",
    scanWithPhone: "Scan with your phone",
    howTo: "How to",
    youHaveApp: "You're using the installed app",
    iosStep1: "Open Mazaj in Safari, then tap the Share button",
    iosStep2: "Scroll down and tap “Add to Home Screen”",
    iosStep3: "Open Mazaj from your home screen — enjoy!",
    installFromMenu:
      "Not showing? Open your browser menu (⋮) and choose “Install app”.",
    apkButton: "Download the app",
    apkSub: "Direct APK file — no Play Store",
    apkStarted:
      "Mazaj.apk is downloading — watch your browser's download bar",
    apkAfterTitle: "When the download finishes",
    apkStep1: "Tap “Open” in the downloads bar",
    apkStep2: "Allow from this source — first time only",
    apkStep3: "Tap “Install” — that's it, you're done",
    orDivider: "or",
    instantAdd: "Add instantly from this browser",
    iosNoStore: "100% App-Store-free — Apple's official install path",
    sheetApk: "Download the app file (APK) · no Play Store",
    syncTitle: "Always in sync — two-way",
    syncDesc1:
      "Orders placed offline are saved on your phone and sync to the lounge the moment you reconnect.",
    syncDesc2:
      "Live status, Mazaj+ points and the queue stay in step on every device — phone, staff screens and the platform.",
    featTracking: "Live order tracking",
    featLoyalty: "Mazaj+ rewards",
    featOffline: "Works offline",
    installBanner: "Install Mazaj on your phone",
    installBannerDesc: "Full app · two-way sync · works offline",
    later: "Later",
    offlineMode: "Offline",
    queuedOrders: "orders waiting to sync",
    syncingOrders: "Syncing orders…",
    ordersSynced: "Back online — orders synced ✓",
  },
  ar: {
    mazaj: "مزاج",
    hookahLounge: "صالة شيشة · نظام الطلبات",
    imStaff: "أنا موظف",
    imStaffDesc: "سجل برمز PIN لاستقبال الطلبات",
    imGuest: "أنا ضيف",
    imGuestDesc: "اطلب من طاولتك أو اطلب رجل الشيشة",
    justBrowsing: "تصفح فقط — تخطي تسجيل الدخول",
    staffPins: "رموز الموظفين",
    enterPin: "أدخل رمز PIN المكون من 4 أرقام",
    guestCheckIn: "تسجيل الضيف",
    yourName: "اسمك",
    tableOptional: "رقم الطاولة (اختياري)",
    startOrdering: "ابدأ الطلب",
    back: "رجوع",
    cancel: "إلغاء",
    delete: "حذف",
    checking: "جارٍ التحقق...",
    welcome: "أهلاً،",

    queue: "الطابور",
    new: "جديد",
    inventory: "المخزون",
    requests: "الطلبات",
    staff: "الموظفون",
    buy: "شراء",
    profit: "الأرباح",
    sync: "المزامنة",
    analytics: "الإحصائيات",
    loyalty: "مزاج+",
    track: "تتبع",
    noAccess: "لا يوجد وصول",
    signOut: "تسجيل الخروج",

    bowlBuilder: "بناء الجبلة",
    build: "بناء",
    buildBowl: "بناء جبلة",
    customer: "العميل",
    tableNumber: "رقم الطاولة",
    tableRequired: "رقم الطاولة مطلوب",
    tableRequiredDesc: "أدخل رقم الطاولة قبل إرسال الطلب.",
    quickPresets: "خيارات سريعة",
    thisOrder: "هذا الطلب",
    noBowlsYet: "لا توجد جبلات بعد",
    noBowlsDesc: "اضغط على علامة تجارية بالأسفل أو خيار سريع للبدء.",
    clearAll: "مسح الكل",
    chooseShisha: "اختر نوع الشيشة",
    chooseShishaDesc: "اختر فئة لعرض العلامات التجارية المتاحة.",
    regularShisha: "شيشة عادية",
    amyShisha: "شيشة أمي",
    changeCategory: "تغيير الفئة",
    change: "تغيير",
    brands: "علامة تجارية",
    popularBowls: "جبلات شائعة",
    oneTapAdd: "اضغط مرة واحدة للإضافة",
    sendOrder: "إرسال الطلب",
    orderSent: "تم إرسال الطلب!",
    orderSentDesc: "تمت مزامنته مع Wedjat RSM",
    newOrder: "طلب جديد",
    from: "من",
    inCart: "في السلة",
    revenue: "الإيرادات",
    netProfit: "صافي الربح",
    margin: "الهامش",
    byo: "جلب معداتك",
    bowl: "جبلة",
    bowls: "جبلات",
    for2for1: "2 مقابل 1",

    pickFlavor: "اختر نكهة",
    fruits: "فواكه",
    mix: "مكس",
    type: "النوع",
    quantity: "الكمية",
    lineTotal: "إجمالي السطر",
    addToCart: "أضف للسلة",
    addFlavor: "أضف نكهة",
    addAnotherFlavor: "أضف نكهة أخرى",
    mixFlavors: "نكهات مختلطة",
    mixMatch: "مكس آند ماتش",
    noFlavorsYet: "لا توجد نكهات بعد",

    cart: "السلة",
    yourOrder: "طلبك",
    currentOrder: "الطلب الحالي",
    subtotal: "المجموع الفرعي",
    total: "الإجمالي",
    byoSaving: "وفّر 2 مقابل 1",
    addons: "إضافات",
    checkout: "الدفع",
    emptyCart: "سلتك فارغة",
    emptyCartDesc: "اختر علامة تجارية لبدء الجلسة.",

    customerName: "اسم العميل",
    customerNameOptional: "اسم العميل (اختياري)",
    phone: "الهاتف",
    phoneOptional: "الهاتف (اختياري)",
    tableRoom: "الطاولة / الغرفة",
    notes: "ملاحظات",
    notesOptional: "ملاحظات (اختياري)",
    placeOrder: "تأكيد الطلب",
    placingOrder: "جارٍ إرسال الطلب...",
    orderPlaced: "تم تأكيد الطلب!",
    orderId: "رقم الطلب",
    done: "تم",

    molasses: "المعسل",
    supplies: "المستلزمات",
    coalFoil: "فحم · ورق",
    inStock: "متوفر",
    low: "منخفض",
    restock: "إعادة تخزين",
    flavorStock: "مخزون النكهات",
    flavors: "نكهات",
    brandsTracked: "العلامات المتتبعة",
    totalMolasses: "إجمالي المعسل",
    totalHookahsLeft: "إجمالي الجبلات المتبقية",
    lowStock: "مخزون منخفض",
    hookahsLeft: "جبلة متبقية",
    stock: "المخزون",
    min: "الحد الأدنى",
    reusable: "قابل لإعادة الاستخدام",
    notAutoDeducted: "لا يُخصم تلقائياً مع كل طلب",
    medicalHose: "خرطوم طبي",
    regularCoal: "فحم عادي",
    cubedCoal: "فحم مكعبات",
    foil: "ورق",

    orderQueue: "طابور الطلبات",
    activeSessions: "الجلسات النشطة والسجل",
    incoming: "وارد",
    tapToConfirm: "اضغط للتأكيد",
    confirmTake: "تأكيد واستلام",
    myOrders: "طلباتي",
    otherActive: "أخرى نشطة",
    doneOrders: "مكتملة",
    walkIn: "عميل بدون اسم",
    guestSelfOrder: "طلب ضيف ذاتي",
    assigned: "مُسند",
    comments: "تعليقات",
    orderComments: "تعليقات الطلب",
    noCommentsYet: "لا توجد تعليقات بعد.",
    addComment: "أضف تعليقاً",
    author: "الكاتب",
    comment: "تعليق",
    startPreparing: "ابدأ التحضير",
    backToPending: "العودة للمعلق",
    markDone: "تم الانتهاء",
    noOrdersYet: "لا توجد طلبات بعد",
    noOrdersDesc: "تظهر الطلبات هنا عند وضعها.",

    requestsTitle: "الطلبات",
    guestCalls: "طلبات الضيوف لرجل الشيشة",
    callShishaMan: "استدعاء رجل الشيشة",
    callShishaManDesc: "سيتم إرسال طلب للموظفين. أضف ملاحظة إن أردت.",
    sendRequest: "إرسال الطلب",
    sending: "جارٍ الإرسال...",
    requestCoal: "طلب فحم",
    requestCoalDesc: "اختر نوع الفحم ليصل الطلب مباشرة لرجل الشيشة.",
    regularCoalType: "فحم عادي",
    cubedCoalType: "فحم مكعبات",
    quickLight: "إشعال سريع",
    longerBurn: "حرق أطول",
    coalRequestSent: "تم إرسال طلب الفحم!",
    shishaManOnWay: "رجل الشيشة في الطريق!",
    pending: "معلق",
    inProgress: "قيد التنفيذ",
    acknowledged: "تم الاستلام",
    noRequestsYet: "لا توجد طلبات بعد",
    noRequestsDesc: "عند استدعاء الضيف لرجل الشيشة، يظهر هنا.",
    autoRefresh: "يتحدث تلقائياً كل 15 ثانية",

    employees: "الموظفون",
    manageStaff: "إدارة الموظفين والصلاحيات",
    addEmployee: "إضافة موظف",
    editEmployee: "تعديل موظف",
    role: "الدور",
    superAdmin: "مدير عام",
    admin: "مدير",
    employee: "موظف",
    tabAccess: "وصول التبويبات",
    permissions: "الصلاحيات",
    createEmployee: "إنشاء موظف",
    saveChanges: "حفظ التغييرات",
    deactivate: "إلغاء التنشيط",
    activate: "تنشيط",
    remove: "إزالة",
    pin: "الرمز",
    pinDigits: "4 أرقام",

    purchases: "المشتريات",
    buyMolasses: "شراء عبوات المعسل",
    buyStock: "شراء مخزون",
    buyDesc: "الشراء يعيد تخزين المخزون تلقائياً ويسجل التكلفة.",
    totalSpent: "إجمالي المنفق",
    lastPurchase: "آخر شراء",
    buyAndRestock: "شراء وإعادة تخزين",
    molassesPacks: "عبوات المعسل",
    procurementSpend: "إنفاق المشتريات",

    profitTitle: "الأرباح",
    revenueCostMargin: "الإيرادات والتكاليف وصافي الهامش",
    cogs: "تكلفة البضاعة",
    molassesCost: "تكلفة المعسل",
    suppliesCost: "تكلفة المستلزمات",
    profitByBrand: "الأرباح حسب العلامة التجارية",
    recentOrders: "أحدث الطلبات",
    cost: "التكلفة",
    hookahsSold: "جبلة مباعة",

    wedjatSync: "مزامنة Wedjat RSM",
    connectionHealth: "حالة الاتصال ومزامنة الطلبات",
    connected: "متصل",
    disconnected: "غير متصل",
    connectedToWedjat: "متصل بـ Wedjat RSM",
    checkRevocations: "فحص الإلغاءات",
    checkRevocationsDesc: "استعلم عن الطلبات الملغاة في Wedjat",
    syncPrices: "مزامنة الأسعار ←",
    syncPricesDesc: "إرسال أسعار مزاج إلى Wedjat",
    synced: "متزامن",
    revoked: "ملغي",
    failed: "فشل",
    revokedByWedjat: "أُلغي بواسطة Wedjat RSM",
    revokedBy: "أُلغي بواسطة",
    fromWedjat: "من Wedjat RSM",
    noSyncedOrders: "لا توجد طلبات متزامنة بعد",
    noSyncedDesc: "الطلبات برقم طاولة تُزامن مع Wedjat RSM تلقائياً.",

    egp: "ج.م",
    perHookah: "لكل جبلة",
    flame: "🔥",

    getApp: "حمّل التطبيق",
    getAppDesc:
      "منصة مزاج كاملة على موبايلك — حمّلها في ثوانٍ بدون متجر تطبيقات.",
    scanToInstall: "امسح للتحميل",
    scanHint:
      "وجّه كاميرا أي موبايل للكود — ستفتح شاشة تثبيت كاملة. يعمل على الآيفون والأندرويد.",
    installNow: "حمّل الآن",
    installing: "جارٍ التحميل…",
    landingTagline: "الصالة كاملة في جيبك — اطلب، تابع، واكسب النقاط.",
    installMeta: "مجاني · ٢–٤ ميجا · يثبّت في ثوانٍ",
    installFree: "تحميل — مجاني",
    preparingDownload: "جارٍ تجهيز التحميل…",
    preparingHint: "لحظة واحدة — نجهّز مزاج لموبايلك.",
    installAndroidIntro:
      "ملف APK هو التطبيق الكامل في ملف واحد — يثبّته هاتفك مباشرةً ويظهر على شاشتك الرئيسية بأيقونة مزاج.",
    installFallbackTitle: "خطوة أخيرة",
    retry: "أعد المحاولة",
    installIosTitle: "ثبّت على الآيفون",
    installIosIntro: "آبل تثبّت التطبيقات من سفاري — الأمر يستغرق ٥ ثوانٍ فقط:",
    iosInstallNote:
      "بعدها يعمل مزاج كأي تطبيق — ملء الشاشة، أوفلاين، على شاشتك الرئيسية.",
    openInSafariTitle: "افتح في سفاري للتثبيت",
    openInSafariDesc:
      "أنت تشاهد هذه الصفحة داخل تطبيق آخر لا يستطيع تثبيت التطبيقات. افتحها في سفاري وسيظهر دليل التثبيت.",
    openInSafariStep: "اضغط أيقونة المشاركة ثم اختر «فتح في سفاري»",
    installSuccessTitle: "مزاج يثبّت الآن ✓",
    installSuccessDesc:
      "جارٍ التحميل — ستظهر أيقونة مزاج على شاشتك الرئيسية بعد لحظات.",
    startUsing: "ابدأ استخدام مزاج",
    continueInBrowser: "المتابعة في المتصفح",
    scanWithPhone: "امسحها بموبايلك",
    howTo: "الطريقة",
    youHaveApp: "أنت تستخدم التطبيق المثبّت",
    iosStep1: "افتح مزاج في سفاري ثم اضغط زر المشاركة",
    iosStep2: "مرّر للأسفل واضغط «إضافة إلى الشاشة الرئيسية»",
    iosStep3: "افتح مزاج من الشاشة الرئيسية — بالهنا والشفا!",
    installFromMenu:
      "لا يظهر؟ افتح قائمة المتصفح (⋮) واختر «تثبيت التطبيق».",
    apkButton: "حمّل التطبيق",
    apkSub: "ملف APK مباشر — بدون Google Play",
    apkStarted: "جارٍ تنزيل Mazaj.apk — تابع شريط التنزيل في المتصفح",
    apkAfterTitle: "بعد اكتمال التنزيل",
    apkStep1: "اضغط «فتح» في شريط التنزيلات",
    apkStep2: "اسمح من هذا المصدر — أول مرة فقط",
    apkStep3: "اضغط «تثبيت» — وهذا كل شيء",
    orDivider: "أو",
    instantAdd: "أضِف فورًا من هذا المتصفح",
    iosNoStore: "بدون App Store تمامًا — المسار الرسمي من آبل",
    sheetApk: "تنزيل ملف التطبيق (APK) · بدون Google Play",
    syncTitle: "مزامنة ثنائية دائمة",
    syncDesc1:
      "الطلبات المسجّلة أوفلاين تُحفظ على موبايلك وتتزامن مع الصالة فور عودة الإنترنت.",
    syncDesc2:
      "الحالة الحية ونقاط مزاج+ والطابور متزامنة على كل الأجهزة — الموبايل وشاشات الموظفين والمنصة.",
    featTracking: "تتبع مباشر للطلبات",
    featLoyalty: "مكافآت مزاج+",
    featOffline: "يعمل أوفلاين",
    installBanner: "حمّل مزاج على موبايلك",
    installBannerDesc: "التطبيق الكامل · مزامنة ثنائية · يعمل أوفلاين",
    later: "لاحقاً",
    offlineMode: "غير متصل",
    queuedOrders: "طلبات في انتظار المزامنة",
    syncingOrders: "جارٍ مزامنة الطلبات…",
    ordersSynced: "عاد الاتصال — تمت المزامنة ✓",
  },
};
