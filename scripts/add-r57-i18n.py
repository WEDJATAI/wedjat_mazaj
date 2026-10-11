import re

P = "src/lib/i18n.ts"
s = open(P, encoding="utf-8").read()

# ── 1. interface additions ──────────────────────────────────────────────
iface_anchor = "  browseSkipToast: string;\n"
iface_new = iface_anchor + """
  // r57 — resilient request queue
  requestQueued: string;
  requestQueuedDesc: string;

  // r57 — multi-branch platform
  chooseBranch: string;
  chooseBranchDesc: string;
  allBranches: string;
  allBranchesDesc: string;
  chooseBranchGuest: string;
  branchLabel: string;
  branchChip: string;

  // r57 — inventory matrix (venue admins)
  invTotalAll: string;
  invByBranch: string;
  invMatrixHint: string;

  // r57 — platform super-admin console
  platformConsole: string;
  platformConsoleDesc: string;
  venues: string;
  venuesDesc: string;
  addVenue: string;
  addVenueDesc: string;
  venueName: string;
  venueNameAr: string;
  venueKind: string;
  kindHookah: string;
  kindCafe: string;
  kindRestaurant: string;
  flagshipBranch: string;
  flagshipBranchHint: string;
  adminName: string;
  adminPin: string;
  connectVenue: string;
  suspendVenue: string;
  activateVenue: string;
  venuePending: string;
  venueActive: string;
  venueSuspended: string;
  addBranch: string;
  branchName: string;
  branchAddedToast: string;
  venueOnboardedToast: string;
  venueOnboardedToastDesc: string;
  todayOrders: string;
  todayRevenue: string;
  platformVenuesActive: string;
  platformBranches: string;
  openVenue: string;
  branchesOf: string;
  statusLabel: string;
  noVenues: string;
  noVenuesDesc: string;
  venueStatusUpdated: string;
"""
assert iface_anchor in s, "iface anchor missing"
s = s.replace(iface_anchor, iface_new, 1)

# ── 2. EN dictionary additions ──────────────────────────────────────────
en_anchor = '    browseSkipToast: "Welcome! Browse and order when ready.",\n'
en_new = en_anchor + """
    // r57 — resilient request queue
    requestQueued: "Request saved — it will reach the lounge the moment we reconnect",
    requestQueuedDesc: "We keep retrying automatically. Your coal is on its way.",

    // r57 — multi-branch platform
    chooseBranch: "Choose your branch",
    chooseBranchDesc: "Where are you working tonight?",
    allBranches: "All branches",
    allBranchesDesc: "Venue-wide view · total inventory",
    chooseBranchGuest: "Which branch are you at?",
    branchLabel: "Branch",
    branchChip: "Branch",

    // r57 — inventory matrix (venue admins)
    invTotalAll: "Total · all branches",
    invByBranch: "Stock by branch",
    invMatrixHint: "Each branch keeps its own stock — this is the venue-wide total.",

    // r57 — platform super-admin console
    platformConsole: "Platform Console",
    platformConsoleDesc: "Every venue, every branch — one command center",
    venues: "Venues",
    venuesDesc: "Cafés & restaurants connected to Mazaj Platform",
    addVenue: "Onboard a venue",
    addVenueDesc: "Add a café or restaurant and connect it to the platform",
    venueName: "Venue name",
    venueNameAr: "Arabic name (optional)",
    venueKind: "Venue type",
    kindHookah: "Hookah lounge",
    kindCafe: "Café",
    kindRestaurant: "Restaurant",
    flagshipBranch: "First branch name",
    flagshipBranchHint: "e.g. Downtown · Corniche · Maadi",
    adminName: "Branch admin name",
    adminPin: "Admin PIN (4 digits)",
    connectVenue: "Connect venue",
    suspendVenue: "Suspend",
    activateVenue: "Activate",
    venuePending: "Pending",
    venueActive: "Active",
    venueSuspended: "Suspended",
    addBranch: "Add branch",
    branchName: "Branch name",
    branchAddedToast: "Branch added!",
    venueOnboardedToast: "Venue onboarded!",
    venueOnboardedToastDesc: "Connected with its first branch and its admin.",
    todayOrders: "Orders today",
    todayRevenue: "Revenue today",
    platformVenuesActive: "Active venues",
    platformBranches: "Branches",
    openVenue: "View branches",
    branchesOf: "Branches",
    statusLabel: "Status",
    noVenues: "No venues yet",
    noVenuesDesc: "Onboard the first café or restaurant to grow the platform.",
    venueStatusUpdated: "Venue status updated",
"""
assert en_anchor in s, "en anchor missing"
s = s.replace(en_anchor, en_new, 1)

# ── 3. AR dictionary additions ──────────────────────────────────────────
ar_anchor = '    browseSkipToast: "أهلاً! اتفرج واطلب لما تجهز.",\n'
ar_new = ar_anchor + """
    // r57 — resilient request queue
    requestQueued: "تم حفظ الطلب — هيوصل للمكان أول ما يرجع الاتصال",
    requestQueuedDesc: "بنعيد المحاولة تلقائياً. الفحم في الطريق.",

    // r57 — multi-branch platform
    chooseBranch: "اختر الفرع",
    chooseBranchDesc: "شتغل فين الليلة؟",
    allBranches: "كل الفروع",
    allBranchesDesc: "عرض شامل · إجمالي المخزون",
    chooseBranchGuest: "أنت في أي فرع؟",
    branchLabel: "الفرع",
    branchChip: "فرع",

    // r57 — inventory matrix (venue admins)
    invTotalAll: "الإجمالي · كل الفروع",
    invByBranch: "المخزون حسب الفرع",
    invMatrixHint: "كل فرع له مخزونه الخاص — ده الإجمالي على مستوى المكان كله.",

    // r57 — platform super-admin console
    platformConsole: "لوحة المنصة",
    platformConsoleDesc: "كل الأماكن وكل الفروع — مركز تحكم واحد",
    venues: "الأماكن",
    venuesDesc: "كافيهات ومطاعم متوصلة بمنصة مزاج",
    addVenue: "إضافة مكان",
    addVenueDesc: "أضف كافيه أو مطعم ووصّله بالمنصة",
    venueName: "اسم المكان",
    venueNameAr: "الاسم بالعربي (اختياري)",
    venueKind: "نوع المكان",
    kindHookah: "صالة شيشة",
    kindCafe: "كافيه",
    kindRestaurant: "مطعم",
    flagshipBranch: "اسم الفرع الأول",
    flagshipBranchHint: "مثلاً: وسط البلد · الكورنيش · المعادي",
    adminName: "اسم مسؤول الفرع",
    adminPin: "رقم سري للمسؤول (4 أرقام)",
    connectVenue: "توصيل المكان",
    suspendVenue: "إيقاف مؤقت",
    activateVenue: "تنشيط",
    venuePending: "قيد الربط",
    venueActive: "نشط",
    venueSuspended: "موقوف",
    addBranch: "إضافة فرع",
    branchName: "اسم الفرع",
    branchAddedToast: "تمت إضافة الفرع!",
    venueOnboardedToast: "تمت إضافة المكان!",
    venueOnboardedToastDesc: "اتربط بأول فرع ومسؤول خاص بيه.",
    todayOrders: "طلبات اليوم",
    todayRevenue: "إيراد اليوم",
    platformVenuesActive: "أماكن نشطة",
    platformBranches: "الفروع",
    openVenue: "عرض الفروع",
    branchesOf: "الفروع",
    statusLabel: "الحالة",
    noVenues: "لا توجد أماكن بعد",
    noVenuesDesc: "أضف أول كافيه أو مطعم لتنمية المنصة.",
    venueStatusUpdated: "تم تحديث حالة المكان",
"""
assert ar_anchor in s, "ar anchor missing"
s = s.replace(ar_anchor, ar_new, 1)

open(P, "w", encoding="utf-8").write(s)
print("i18n keys added")

# quick symmetry check
keys = re.findall(r"^  (\w+): string;", s, re.M)
en_block = s[s.index("export const EN"):]
ar_block = s[s.index("export const AR"):]
en_keys = re.findall(r'^    (\w+): "', en_block, re.M)
ar_keys = re.findall(r'^    (\w+): "', ar_block, re.M)
print("interface:", len(keys), "EN:", len(en_keys), "AR:", len(ar_keys))
missing_en = [k for k in keys if k not in en_keys]
missing_ar = [k for k in keys if k not in ar_keys]
print("missing EN:", missing_en[:10])
print("missing AR:", missing_ar[:10])
