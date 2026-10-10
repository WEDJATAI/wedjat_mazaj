// Full bilingual dictionary for the Mazaj platform (EN + AR).
// Used by the language store (src/store/i18n.ts) to toggle EN ↔ AR.
// r54: EN dictionary completed for every key (previously EN had only the PWA
// section, so English UI showed raw camelCase keys) + guest-surface wiring.

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
  namePlaceholder: string;
  tablePlaceholder: string;
  invalidPin: string;
  couldNotSignIn: string;
  linkedPosNote: string;

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
  grams20Note: string;
  standardSession: string;
  flatNote: string;
  mixAcrossBrands: string;
  mixEmpty: string;
  selectedWord: string;
  closeBtn: string;
  flavorsOf: string;

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
  each20g: string;
  byoTitle: string;
  byoDesc: string;
  loungeSetup: string;
  loungeSetupDesc: string;
  ownHookahLabel: string;
  ownHookahDesc: string;
  ownMolassesLabel: string;
  ownMolassesDesc: string;
  personalHose: string;
  freeWord: string;
  chargedWord: string;

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
  nameOrTableHint: string;
  checkingPlus: string;
  loyaltyPhonePlaceholder: string;
  tablePlaceholder2: string;
  notesPlaceholder: string;
  newToMazajPlus: string;
  bonusPtsPrefix: string;
  ptsOnOrder: string;
  posLinkedNote: string;
  orderSavedOfflineTitle: string;
  orderSavedOfflineDesc: string;
  sessionQueued: string;
  welcomeMazajPlus: string;
  ptsEarned: string;
  ptsRedeemed: string;
  orderSavedDeviceToast: string;
  willSyncToast: string;
  sessionQueuedToast: string;

  // Order screen (guest browse)
  guestOrderTitle: string;
  scan: string;
  cartBtn: string;
  egyptianLounge: string;
  heroLine1: string;
  heroLine2: string;
  heroBody: string;
  promoByoTitle: string;
  promoByoBody: string;
  promoMolassesTitle: string;
  promoMolassesBody: string;
  promoMixTitle: string;
  promoMixBody: string;
  oneTapFav: string;
  tapBrandHint: string;
  viewCart: string;
  bogoOn: string;
  footerLine: string;
  searchMenu: string;
  searchPlaceholder: string;
  searchNoResults: string;
  searchMatches: string;
  addBtn: string;
  legendFruits: string;
  legendMix: string;
  legendAmy: string;
  legendSpecial: string;
  legendFlatSub: string;
  priceList: string;

  // Guest tracking
  trackOrders: string;
  trackDesc: string;
  noOrders48: string;
  allServed: string;
  stepPlaced: string;
  stepPreparing: string;
  stepServed: string;
  inQueue: string;
  minutesShort: string;
  longerUsual: string;
  preparingNow: string;
  ptsOrderNote: string;
  pingTitle: string;
  notifOn: string;
  notifOnDesc: string;
  notifOffDesc: string;
  notifUnsupportedDesc: string;
  notifyMe: string;
  howWasSession: string;
  lovedIt: string;
  goodRating: string;
  doBetter: string;
  feedbackPlaceholder: string;
  sendFeedback: string;
  thanksRating: string;
  rateStarsFirst: string;
  justNow: string;
  mAgo: string;
  hAgo: string;
  pingOnToast: string;
  pingOnToastDesc: string;
  blockedToast: string;
  blockedToastDesc: string;
  installAppToast: string;
  installAppToastDesc: string;
  thanksFeedbackToast: string;
  helpsServe: string;

  // Guest order header + dialogs
  aiBtn: string;
  favorites: string;
  coal: string;
  call: string;
  welcomeBackName: string;
  yourUsual: string;
  reorderBtn: string;
  nameLabel: string;
  tableLabel: string;
  callDescShort: string;
  coalDescShort: string;
  needHelpPlaceholder: string;
  coalNoteRegular: string;
  coalNoteCubed: string;
  shishaManToast: string;
  shishaManToastDesc: string;
  coalToast: string;
  cubedOnWay: string;
  regularOnWay: string;
  browseSkipToast: string;

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

  // Favorites sheet
  favTitle: string;
  favDesc: string;
  saveCurrentMix: string;
  favPlaceholder: string;
  saveBtn: string;
  favHint: string;
  noFavs: string;
  favRemoved: string;
  favAdded: string;

  // AI Sommelier
  aiSommelier: string;
  sommelierTagline: string;
  sommelierGreeting: string;
  askPlaceholder: string;
  thinking: string;
  quickAdd: string;
  somethingSweet: string;
  strongClassic: string;
  mintyFresh: string;
  surpriseMe: string;
  aiBadge: string;
  engineBadge: string;
  clearChat: string;
  sendBtn: string;
  addedToCart: string;
  // r58 living orders — amend after confirming
  amendAction: string;
  amendEditingTitle: string;
  amendEditingDesc: string;
  amendBarTitle: string;
  amendBarCta: string;
  amendSaveChanges: string;
  amendSaving: string;
  amendCancelEdit: string;
  amendCancelled: string;
  amendNoChanges: string;
  amendChangesChip: string;
  amendFooterNote: string;
  amendUpdatedToast: string;
  amendUpdatedDesc: string;
  amendRevWord: string;
  amendGuestButton: string;
  amendGuestStartDesc: string;
  amendStartDesc: string;
  amendStaffTitle: string;
  amendStaffSubtitle: string;
  amendEmptyTitle: string;
  amendEmptyDesc: string;
  amendLegacyError: string;
  backToQueue: string;
  sommelierError: string;

  // AI brief (manager analytics)
  aiBrief: string;
  generateBrief: string;
  briefLoading: string;
  briefTitle: string;
  analyticsLoadError: string;
  tryAgain: string;

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

  // Landing — cinematic home experience
  landKicker: string;
  landHeroTitleA: string;
  landHeroTitleB: string;
  landHeroSub: string;
  landHeroMeta: string;
  landCtaOrder: string;
  landScroll: string;
  landNavPlatform: string;
  landNavExperience: string;
  landNavApp: string;
  landRitualKicker: string;
  landRitualTitle: string;
  landRitual1T: string;
  landRitual1D: string;
  landRitual2T: string;
  landRitual2D: string;
  landRitual3T: string;
  landRitual3D: string;
  landFeatKicker: string;
  landFeatTitle: string;
  landFeatAiT: string;
  landFeatAiD: string;
  landFeatTrackT: string;
  landFeatTrackD: string;
  landFeatOfflineT: string;
  landFeatOfflineD: string;
  landFeatLoyaltyT: string;
  landFeatLoyaltyD: string;
  landStatHouses: string;
  landStatFlavors: string;
  landStatBowl: string;
  landStatBogo: string;
  landAppKicker: string;
  landAppTitle: string;
  landAppDesc: string;
  landAppB1: string;
  landAppB2: string;
  landAppB3: string;
  landAppB4: string;
  landFooterCraft: string;
  landFooterTagline: string;
  landFooterRights: string;
  landEnter: string;
  landMenuPeek: string;
  landMenuPeekSub: string;
}

export const translations: Record<Lang, Partial<Translations>> = {
  en: {
    // Sign-in
    mazaj: "Mazaj",
    hookahLounge: "Hookah Lounge · Ordering System",
    imStaff: "I'm staff",
    imStaffDesc: "Sign in with your PIN to take orders",
    imGuest: "I'm a guest",
    imGuestDesc: "Order from your table or call for help",
    justBrowsing: "Just browsing — skip sign-in",
    staffPins: "Staff PINs",
    enterPin: "Enter your 4-digit PIN",
    guestCheckIn: "Guest check-in",
    yourName: "Your name",
    tableOptional: "Table number (optional)",
    startOrdering: "Start ordering",
    back: "Back",
    cancel: "Cancel",
    delete: "Delete",
    checking: "Checking…",
    welcome: "Welcome,",
    namePlaceholder: "e.g. Sara",
    tablePlaceholder: "e.g. Table 5",
    invalidPin: "Invalid PIN",
    couldNotSignIn: "Could not sign in",
    linkedPosNote: "Linked to the table's check from the restaurant POS",

    // Dashboard tabs
    queue: "Queue",
    new: "New",
    inventory: "Inventory",
    requests: "Requests",
    staff: "Staff",
    buy: "Buy",
    profit: "Profit",
    sync: "Sync",
    analytics: "Analytics",
    loyalty: "Mazaj+",
    track: "Track",
    noAccess: "No access",
    signOut: "Sign out",

    // Bowl builder
    bowlBuilder: "Bowl builder",
    build: "Build",
    buildBowl: "Build a bowl",
    customer: "Customer",
    tableNumber: "Table number",
    tableRequired: "Table number required",
    tableRequiredDesc: "Enter the table number before sending the order.",
    quickPresets: "Quick presets",
    thisOrder: "This order",
    noBowlsYet: "No bowls yet",
    noBowlsDesc: "Tap a brand below or a quick preset to start.",
    clearAll: "Clear all",
    chooseShisha: "Choose your shisha",
    chooseShishaDesc: "Select a category to see available brands.",
    regularShisha: "Regular shisha",
    amyShisha: "Amy shisha",
    changeCategory: "Change category",
    change: "Change",
    brands: "brands",
    popularBowls: "Popular bowls",
    oneTapAdd: "One tap to add a house favourite",
    sendOrder: "Send order",
    orderSent: "Order sent!",
    orderSentDesc: "Synced with Wedjat RSM",
    newOrder: "New order",
    from: "from",
    inCart: "packed",
    revenue: "Revenue",
    netProfit: "Net profit",
    margin: "Margin",
    byo: "BYO",
    bowl: "bowl",
    bowls: "bowls",
    for2for1: "2-for-1",

    // Config sheet
    pickFlavor: "Pick a flavor",
    fruits: "Fruits",
    mix: "Mix",
    type: "Type",
    quantity: "Quantity",
    lineTotal: "Line total",
    addToCart: "Pack my Shisha",
    addFlavor: "Add a flavor",
    addAnotherFlavor: "Add another flavor",
    mixFlavors: "Mix flavors",
    mixMatch: "mix & match",
    noFlavorsYet: "No flavors yet",
    grams20Note: "20g molasses per hookah",
    standardSession: "Standard session",
    flatNote: "Flat price",
    mixAcrossBrands:
      "Combine flavors from this or any other brand. The 20g splits evenly; price is the highest mix price among chosen brands.",
    mixEmpty: 'No flavors yet. Tap "Add a flavor" to start your mix.',
    selectedWord: "selected",
    closeBtn: "Close",
    flavorsOf: "flavors:",

    // Cart
    cart: "Cart",
    yourOrder: "Your order",
    currentOrder: "My packed shisha",
    subtotal: "Subtotal",
    total: "Total",
    byoSaving: "BYO 2-for-1 saving",
    addons: "Add-ons",
    checkout: "Checkout",
    emptyCart: "No shisha packed yet",
    emptyCartDesc: "Pick a brand to start a session.",
    each20g: "Each hookah is 20g of molasses.",
    byoTitle: "Bring Your Own · 2 for 1",
    byoDesc: "Customer brings own hookah or molasses → 2 hookahs for the price of 1.",
    loungeSetup: "Use lounge setup",
    loungeSetupDesc: "Standard pricing, no promo.",
    ownHookahLabel: "Bring my own hookah",
    ownHookahDesc: "Customer brings the device, we bring the molasses.",
    ownMolassesLabel: "Bring my own molasses",
    ownMolassesDesc: "Customer brings the molasses, we bring the setup.",
    personalHose: "Personal hose",
    freeWord: "free",
    chargedWord: "charged",

    // Checkout
    customerName: "Customer name",
    customerNameOptional: "Customer name (optional)",
    phone: "Phone",
    phoneOptional: "Phone (optional)",
    tableRoom: "Table / room",
    notes: "Notes",
    notesOptional: "Notes (optional)",
    placeOrder: "Place order",
    placingOrder: "Placing order…",
    orderPlaced: "Order placed!",
    orderId: "Order ID",
    done: "Done",
    nameOrTableHint: "Add your name or table so we know where to bring it",
    checkingPlus: "Checking Mazaj+…",
    loyaltyPhonePlaceholder: "01xxxxxxxxx — earn & redeem points",
    tablePlaceholder2: "e.g. Table 7",
    notesPlaceholder: "Extra coal, flavor requests…",
    newToMazajPlus: "New here? This phone joins Mazaj+ automatically",
    bonusPtsPrefix: "50 bonus pts +",
    ptsOnOrder: "pts on this order",
    posLinkedNote: "✓ linked to the table's check (restaurant POS)",
    orderSavedOfflineTitle: "Order saved offline",
    orderSavedOfflineDesc:
      "You're offline — this order will sync to the lounge automatically the moment you reconnect.",
    sessionQueued: "The hookah session is queued for preparation.",
    welcomeMazajPlus: "Welcome to Mazaj+!",
    ptsEarned: "pts earned",
    ptsRedeemed: "pts redeemed",
    orderSavedDeviceToast: "Order saved on this device",
    willSyncToast: "It will sync to the lounge automatically when you reconnect.",
    sessionQueuedToast: "Session added to the queue.",

    // Order screen
    guestOrderTitle: "Guest order",
    scan: "Scan",
    cartBtn: "My Shisha",
    egyptianLounge: "Egyptian market · lounge pricing",
    heroLine1: "Build your perfect",
    heroLine2: "hookah session",
    heroBody:
      "Pick your molasses brand and flavor. Every hookah is 20g of molasses, mixed fresh.",
    promoByoTitle: "Bring your own hookah",
    promoByoBody: "Get 2 hookahs for the price of 1.",
    promoMolassesTitle: "Bring your own molasses",
    promoMolassesBody: "Same 2-for-1 deal applies.",
    promoMixTitle: "Mix & match flavors",
    promoMixBody: "Cross-brand mixes, one bowl.",
    oneTapFav: "One tap to add a house favourite",
    tapBrandHint: "Tap a brand to set flavor & quantity.",
    viewCart: "View my shisha",
    bogoOn: "2-for-1 on",
    footerLine: "20g molasses per hookah · Prices in EGP · Egyptian market",
    searchMenu: "Search the menu",
    searchPlaceholder: "Search flavors, brands, presets…",
    searchNoResults: 'No matches — try "mint" or "apple"',
    searchMatches: "Matches",
    addBtn: "Add",
    legendFruits: "Regular fruits",
    legendMix: "Fruits mix",
    legendAmy: "Amy (premium)",
    legendSpecial: "Salom / Kass",
    legendFlatSub: "Everyday flat price",
    priceList: "The price list",

    // Guest tracking
    trackOrders: "Track my orders",
    trackDesc: "Live status of your hookah sessions · updates every 10 seconds",
    noOrders48: "No orders in the last 48 hours. Place an order to see it here live!",
    allServed: "All your sessions are served. Enjoy!",
    stepPlaced: "Order placed",
    stepPreparing: "Preparing",
    stepServed: "Served",
    inQueue: "In the queue · est.",
    minutesShort: "min",
    longerUsual: "(a little longer than usual)",
    preparingNow: "Your shisha man is preparing it right now",
    ptsOrderNote: "Mazaj+ points earned on this order",
    pingTitle: "Ping me when it's ready",
    notifOn: "Notifications on",
    notifOnDesc:
      "We'll notify you when your hookah is prepared and served — even with the app closed.",
    notifOffDesc: "Get a notification on this phone when your hookah is prepared and served.",
    notifUnsupportedDesc:
      "On iPhone: install the app first (Add to Home Screen), then come back to enable pings.",
    notifyMe: "Notify me",
    howWasSession: "How was your session?",
    lovedIt: "Loved it!",
    goodRating: "Good",
    doBetter: "We'll do better",
    feedbackPlaceholder: "Anything to tell the team? (optional)",
    sendFeedback: "Send feedback",
    thanksRating: "Thanks for rating!",
    rateStarsFirst: "Tap the stars to rate first",
    justNow: "just now",
    mAgo: "m ago",
    hAgo: "h ago",
    pingOnToast: "You'll get a ping when it's ready 🔔",
    pingOnToastDesc: "We'll notify you the moment your hookah is served.",
    blockedToast: "Notifications are blocked",
    blockedToastDesc: "Enable them for Mazaj in your browser/site settings to get updates.",
    installAppToast: "Install the app to get notifications",
    installAppToastDesc:
      "On iPhone, add Mazaj to your home screen first — then this button turns on pings.",
    thanksFeedbackToast: "Thanks for your feedback!",
    helpsServe: "It helps us serve you better 🙏",

    // Guest order header + dialogs
    aiBtn: "AI",
    favorites: "Favorites",
    coal: "Coal",
    call: "Call",
    welcomeBackName: "Welcome back,",
    yourUsual: "Your usual:",
    reorderBtn: "Re-order",
    nameLabel: "Name:",
    tableLabel: "Table:",
    callDescShort: "A request will be sent to the staff. Add a note if you like.",
    coalDescShort: "Choose your coal type and a request goes straight to the shisha man.",
    needHelpPlaceholder: "e.g. Need help choosing flavors",
    coalNoteRegular: "Regular coal please",
    coalNoteCubed: "Cubed coal please",
    shishaManToast: "The shisha man is on the way!",
    shishaManToastDesc: "They'll be with you shortly.",
    coalToast: "Coal request sent!",
    cubedOnWay: "Cubed coal on the way",
    regularOnWay: "Regular coal on the way",
    browseSkipToast: "Welcome! Browse and order when ready.",

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

    // Favorites sheet
    favTitle: "Your favorite mixes",
    favDesc: "Save your go-to bowl and re-order it in one tap",
    saveCurrentMix: "Save your current mix",
    favPlaceholder: "e.g. My Blueberry Mint",
    saveBtn: "Save",
    favHint: "Add a Fruits Mix to your cart first, then save it here.",
    noFavs: "No favorites yet. Save your first mix above.",
    favRemoved: "Favorite removed",
    favAdded: "Added",

    // AI Sommelier
    aiSommelier: "AI Sommelier",
    sommelierTagline: "Your shisha concierge — mood to bowl in seconds",
    sommelierGreeting:
      "Ahlan! I'm Mazaj's sommelier 🌿 Tell me your mood — sweet, minty, strong — and I'll match the perfect bowl with prices.",
    askPlaceholder: "e.g. Something sweet and light…",
    thinking: "Thinking…",
    quickAdd: "Quick add",
    somethingSweet: "Something sweet",
    strongClassic: "Strong & classic",
    mintyFresh: "Minty & fresh",
    surpriseMe: "Surprise me",
    aiBadge: "Mazaj AI",
    engineBadge: "Smart match",
    clearChat: "Clear",
    sendBtn: "Send",
    addedToCart: "Shisha packed",
    // r58 living orders — amend after confirming
    amendAction: "Edit order",
    amendEditingTitle: "Editing order",
    amendEditingDesc: "Change anything — the kitchen updates instantly.",
    amendBarTitle: "Editing order",
    amendBarCta: "Review changes",
    amendSaveChanges: "Save changes",
    amendSaving: "Saving…",
    amendCancelEdit: "Stop editing",
    amendCancelled: "Editing cancelled — the order stays as it was",
    amendNoChanges: "No changes yet",
    amendChangesChip: "Your changes",
    amendFooterNote: "Saving updates the kitchen queue and stock instantly.",
    amendUpdatedToast: "Order updated",
    amendUpdatedDesc: "The kitchen sees your revision instantly.",
    amendRevWord: "Rev",
    amendGuestButton: "Modify my order",
    amendGuestStartDesc: "Browse the menu and change your bowls — then save.",
    amendStartDesc: "Browse the menu, change the bowls, then save the revision.",
    amendStaffTitle: "Edit Order",
    amendStaffSubtitle: "Modify a placed order — the queue updates on save",
    amendEmptyTitle: "Nothing left in this order",
    amendEmptyDesc: "Add at least one bowl, or stop editing to keep it as it was.",
    amendLegacyError: "This order can't be edited (older format)",
    backToQueue: "Back to queue",
    sommelierError: "The sommelier is resting — try again",

    // AI brief
    aiBrief: "AI Brief",
    generateBrief: "Generate AI brief",
    briefLoading: "Reading your numbers…",
    briefTitle: "Today's executive brief",
    analyticsLoadError: "Couldn't load analytics.",
    tryAgain: "Try again",

    // Inventory
    molasses: "Molasses",
    supplies: "Supplies",
    coalFoil: "Coal · Foil",
    inStock: "In stock",
    low: "Low",
    restock: "Restock",
    flavorStock: "Flavor stock",
    flavors: "Flavors",
    brandsTracked: "Brands tracked",
    totalMolasses: "Total molasses",
    totalHookahsLeft: "Total hookahs left",
    lowStock: "Low stock",
    hookahsLeft: "hookahs left",
    stock: "Stock",
    min: "Min",
    reusable: "Reusable",
    notAutoDeducted: "Not auto-deducted per order",
    medicalHose: "Medical hose",
    regularCoal: "Regular coal",
    cubedCoal: "Cubed coal",
    foil: "Foil",

    // Orders panel
    orderQueue: "Order queue",
    activeSessions: "Active sessions & history",
    incoming: "Incoming",
    tapToConfirm: "Tap to confirm",
    confirmTake: "Confirm & take",
    myOrders: "My orders",
    otherActive: "Other active",
    doneOrders: "Done",
    walkIn: "Walk-in",
    guestSelfOrder: "Guest self-order",
    assigned: "Assigned",
    comments: "Comments",
    orderComments: "Order comments",
    noCommentsYet: "No comments yet.",
    addComment: "Add a comment",
    author: "Author",
    comment: "Comment",
    startPreparing: "Start preparing",
    backToPending: "Back to pending",
    markDone: "Mark done",
    noOrdersYet: "No orders yet",
    noOrdersDesc: "Orders appear here once placed.",

    // Requests
    requestsTitle: "Requests",
    guestCalls: "Guest calls for the shisha man",
    callShishaMan: "Call the shisha man",
    callShishaManDesc: "A request will be sent to the staff. Add a note if you like.",
    sendRequest: "Send request",
    sending: "Sending…",
    requestCoal: "Request coal",
    requestCoalDesc: "Choose your coal type and a request goes straight to the shisha man.",
    regularCoalType: "Regular coal",
    cubedCoalType: "Cubed coal",
    quickLight: "Quick light",
    longerBurn: "Longer burn",
    coalRequestSent: "Coal request sent!",
    shishaManOnWay: "The shisha man is on the way!",
    pending: "Pending",
    inProgress: "In progress",
    acknowledged: "Acknowledged",
    noRequestsYet: "No requests yet",
    noRequestsDesc: "When a guest calls the shisha man, it shows here.",
    autoRefresh: "Auto-refreshes every 15 seconds",

    // Employees
    employees: "Employees",
    manageStaff: "Manage staff & permissions",
    addEmployee: "Add employee",
    editEmployee: "Edit employee",
    role: "Role",
    superAdmin: "Super admin",
    admin: "Admin",
    employee: "Employee",
    tabAccess: "Tab access",
    permissions: "Permissions",
    createEmployee: "Create employee",
    saveChanges: "Save changes",
    deactivate: "Deactivate",
    activate: "Activate",
    remove: "Remove",
    pin: "PIN",
    pinDigits: "4 digits",

    // Purchases
    purchases: "Purchases",
    buyMolasses: "Buy molasses packs",
    buyStock: "Buy stock",
    buyDesc: "Buying auto-restocks inventory and logs the cost.",
    totalSpent: "Total spent",
    lastPurchase: "Last purchase",
    buyAndRestock: "Buy & restock",
    molassesPacks: "Molasses packs",
    procurementSpend: "Procurement spend",

    // Profit
    profitTitle: "Profit",
    revenueCostMargin: "Revenue, costs & net margin",
    cogs: "Cost of goods",
    molassesCost: "Molasses cost",
    suppliesCost: "Supplies cost",
    profitByBrand: "Profit by brand",
    recentOrders: "Recent orders",
    cost: "Cost",
    hookahsSold: "hookahs sold",

    // Sync
    wedjatSync: "Wedjat RSM Sync",
    connectionHealth: "Connection health & order sync",
    connected: "Connected",
    disconnected: "Disconnected",
    connectedToWedjat: "Connected to Wedjat RSM",
    checkRevocations: "Check revocations",
    checkRevocationsDesc: "Query cancelled orders in Wedjat",
    syncPrices: "Sync prices →",
    syncPricesDesc: "Push Mazaj prices to Wedjat",
    synced: "Synced",
    revoked: "Revoked",
    failed: "Failed",
    revokedByWedjat: "Revoked by Wedjat RSM",
    revokedBy: "Revoked by",
    fromWedjat: "from Wedjat RSM",
    noSyncedOrders: "No synced orders yet",
    noSyncedDesc: "Orders with a table number sync to Wedjat RSM automatically.",

    // Misc
    egp: "EGP",
    perHookah: "per hookah",
    flame: "🔥",

    // PWA
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

    // Landing — cinematic home experience
    landKicker: "Mazaj · Shisha Atelier",
    landHeroTitleA: "Where Smoke",
    landHeroTitleB: "Becomes Poetry",
    landHeroSub:
      "Seven legendary molasses houses. One bowl crafted to order, tracked live to your table — and a full app that lives on your phone.",
    landHeroMeta: "7 Houses · 30+ Flavors · Crafted Bowls",
    landCtaOrder: "Order Now",
    landScroll: "Scroll",
    landNavPlatform: "Platform",
    landNavExperience: "Experience",
    landNavApp: "The App",
    landRitualKicker: "The Experience",
    landRitualTitle: "The Ritual, Perfected",
    landRitual1T: "Choose your house",
    landRitual1D:
      "Seven molasses houses — from timeless Egyptian classics to Amy's premium line. Or let the AI sommelier read your mood.",
    landRitual2T: "Crafted to order",
    landRitual2D:
      "Every bowl packed to order — 20 grams, your mix, your way. Bring your own hookah or molasses and two bowls cost one.",
    landRitual3T: "Tracked to your table",
    landRitual3D:
      "Watch it live — from coal to cloud. A gentle ping the moment it's served, and points with every bowl.",
    landFeatKicker: "The Platform",
    landFeatTitle: "A lounge that thinks",
    landFeatAiT: "AI Sommelier",
    landFeatAiD:
      "Tell it your mood — sweet, minty, strong — and it crafts your perfect bowl from the live menu.",
    landFeatTrackT: "Live Tracking",
    landFeatTrackD: "From “preparing” to “served” — every stage streaming live to your phone.",
    landFeatOfflineT: "Works Offline",
    landFeatOfflineD: "Order in airplane mode. It syncs itself the moment you're back.",
    landFeatLoyaltyT: "Mazaj+ Rewards",
    landFeatLoyaltyD: "Every bowl earns. Climb tiers, unlock free mixes.",
    landStatHouses: "Molasses Houses",
    landStatFlavors: "Flavors",
    landStatBowl: "Per Bowl",
    landStatBogo: "Bring Your Own",
    landAppKicker: "The App",
    landAppTitle: "Carry the whole lounge",
    landAppDesc:
      "No app store needed. Scan the code, tap install — the full platform lives on your home screen, works offline, and stays in perfect sync with the lounge.",
    landAppB1: "Installs in seconds",
    landAppB2: "Works offline",
    landAppB3: "Pings you when ready",
    landAppB4: "Earns Mazaj+ points",
    landFooterCraft: "Crafted in Cairo",
    landFooterTagline: "Order · Track · Earn",
    landFooterRights: "All rights reserved",
    landEnter: "Enter the lounge",
    landMenuPeek: "Tonight's houses",
    landMenuPeekSub: "Tap to open the full menu",
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
    namePlaceholder: "مثلاً: سارة",
    tablePlaceholder: "مثلاً: طاولة ٥",
    invalidPin: "رمز PIN غير صحيح",
    couldNotSignIn: "تعذر تسجيل الدخول",
    linkedPosNote: "مرتبط بفاتورة الطاولة من نظام المطعم",

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
    inCart: "مجهّزة",
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
    addToCart: "جهّز شيشتي",
    addFlavor: "أضف نكهة",
    addAnotherFlavor: "أضف نكهة أخرى",
    mixFlavors: "نكهات مختلطة",
    mixMatch: "مكس آند ماتش",
    noFlavorsYet: "لا توجد نكهات بعد",
    grams20Note: "٢٠ جرام معسل للجبلة",
    standardSession: "جلسة عادية",
    flatNote: "سعر ثابت",
    mixAcrossBrands:
      "امزج نكهات من نفس العلامة أو أي علامة تانية. الـ٢٠ جرام بتتقسم بالتساوي؛ السعر هو أغلى سعر مكس بين العلامات المختارة.",
    mixEmpty: "مفيش نكهات لسه. اضغط «أضف نكهة» لبدء المكس.",
    selectedWord: "مختارة",
    closeBtn: "إغلاق",
    flavorsOf: "النكهات:",

    cart: "السلة",
    yourOrder: "طلبك",
    currentOrder: "شيشتي المجهّزة",
    subtotal: "المجموع الفرعي",
    total: "الإجمالي",
    byoSaving: "وفّر 2 مقابل 1",
    addons: "إضافات",
    checkout: "الدفع",
    emptyCart: "لسه مفيش شيشة",
    emptyCartDesc: "اختر علامة تجارية لبدء الجلسة.",
    each20g: "كل جبلة ٢٠ جرام معسل.",
    byoTitle: "اجيب معاك · ٢ مقابل ١",
    byoDesc: "العميل يجيب شيشته أو معسله ← جبلتين بسعر واحدة.",
    loungeSetup: "استخدم معدات الصالة",
    loungeSetupDesc: "السعر العادي، بدون عرض.",
    ownHookahLabel: "هجيب شيشتي معايا",
    ownHookahDesc: "العميل يجيب الشيشة، وإحنا المعسل.",
    ownMolassesLabel: "هجيب معسلي معايا",
    ownMolassesDesc: "العميل يجيب المعسل، وإحنا التجهيز.",
    personalHose: "خرطوم شخصي",
    freeWord: "مجاناً",
    chargedWord: "مدفوعة",

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
    nameOrTableHint: "اكتب اسمك أو رقم الطاولة عشان نعرف نجيبها فين",
    checkingPlus: "بندور في مزاج+…",
    loyaltyPhonePlaceholder: "٠١xxxxxxxxx — اكسب واستبدل نقاط",
    tablePlaceholder2: "مثلاً: طاولة ٧",
    notesPlaceholder: "فحم إضافي، طلبات نكهات…",
    newToMazajPlus: "أول مرة؟ الرقم ده هينضم لمزاج+ تلقائياً",
    bonusPtsPrefix: "٥٠ نقطة ترحيبية +",
    ptsOnOrder: "نقطة على الطلب ده",
    posLinkedNote: "✓ مرتبط بفاتورة الطاولة (من نظام المطعم)",
    orderSavedOfflineTitle: "الطلب اتحفظ أوفلاين",
    orderSavedOfflineDesc:
      "أنت أوفلاين — الطلب هيتزامن مع الصالة تلقائياً أول ما يرجع النت.",
    sessionQueued: "الجلسة دخلت طابور التحضير.",
    welcomeMazajPlus: "أهلاً بك في مزاج+!",
    ptsEarned: "نقطة اكتُسبت",
    ptsRedeemed: "نقطة استُبدلت",
    orderSavedDeviceToast: "الطلب اتحفظ على الجهاز",
    willSyncToast: "هيتزامن مع الصالة تلقائياً أول ما يرجع النت.",
    sessionQueuedToast: "الجلسة اتضافت للطابور.",

    guestOrderTitle: "طلب الضيف",
    scan: "امسح",
    cartBtn: "شيشتي",
    egyptianLounge: "السوق المصري · أسعار الصالة",
    heroLine1: "اصنع جلستك المثالية",
    heroLine2: "بالظبط على ذوقك",
    heroBody: "اختر علامة المعسل والنكهة. كل جبلة ٢٠ جرام معسل، بتتحضّر طازة.",
    promoByoTitle: "اجيب شيشتك معاك",
    promoByoBody: "٢ جبلة بسعر واحدة.",
    promoMolassesTitle: "اجيب معسلك معاك",
    promoMolassesBody: "نفس عرض ٢ مقابل ١.",
    promoMixTitle: "امزج النكهات",
    promoMixBody: "مكس بين العلامات في جبلة واحدة.",
    oneTapFav: "ضغطة واحدة تضيف أفضل جبلاتنا",
    tapBrandHint: "اضغط على علامة لاختيار النكهة والكمية.",
    viewCart: "شوف شيشتك",
    bogoOn: "عرض ٢×١ شغّال",
    footerLine: "٢٠ جرام معسل للجبلة · الأسعار بالجنيه المصري · السوق المصري",
    searchMenu: "ابحث في المنيو",
    searchPlaceholder: "ابحث عن نكهة أو علامة…",
    searchNoResults: "مفيش نتائج — جرب «نعناع» أو «تفاح»",
    searchMatches: "النتائج",
    addBtn: "أضف",
    legendFruits: "فواكه عادية",
    legendMix: "مكس فواكه",
    legendAmy: "أمي (بريميوم)",
    legendSpecial: "سلوم / كاس",
    legendFlatSub: "سعر ثابت يومي",
    priceList: "قائمة الأسعار",

    trackOrders: "تتبع طلباتي",
    trackDesc: "حالة جلساتك مباشرة · بتتحدث كل ١٠ ثواني",
    noOrders48: "مفيش طلبات آخر ٤٨ ساعة. اطلب حاجة وشوفها هنا لحظة بلحظة!",
    allServed: "كل جلساتك وصلت. بالهنا والشفا!",
    stepPlaced: "تم الطلب",
    stepPreparing: "قيد التحضير",
    stepServed: "تم التقديم",
    inQueue: "في الطابور · متوقع",
    minutesShort: "دقيقة",
    longerUsual: "(أطول من المعتاد شوية)",
    preparingNow: "رجل الشيشة بيجهّزها دلوقتي",
    ptsOrderNote: "نقاط مزاج+ على الطلب ده",
    pingTitle: "نبّهني لما تجهز",
    notifOn: "التنبيهات شغّالة",
    notifOnDesc: "هننبّهك لما الشيشة تتجهّز وتوصل — حتى لو التطبيق مقفول.",
    notifOffDesc: "هيوصلك تنبيه على الموبايل لما الشيشة تتجهّز وتوصل.",
    notifUnsupportedDesc:
      "على الآيفون: ثبّت التطبيق الأول (إضافة للشاشة الرئيسية) وارجع فعّل التنبيهات.",
    notifyMe: "نبّهني",
    howWasSession: "الجلسة كانت عامل إيه؟",
    lovedIt: "حبيتها!",
    goodRating: "حلوة",
    doBetter: "هنحسّن",
    feedbackPlaceholder: "عايز تقول حاجة للفريق؟ (اختياري)",
    sendFeedback: "ابعت التقييم",
    thanksRating: "شكراً على التقييم!",
    rateStarsFirst: "اضغط النجوم الأول",
    justNow: "دلوقتي",
    mAgo: " د",
    hAgo: " س",
    pingOnToast: "هننبّهك لما تجهز 🔔",
    pingOnToastDesc: "هننبّهك أول ما الشيشة توصل.",
    blockedToast: "التنبيهات محجوبة",
    blockedToastDesc: "فعّلها لمزاج من إعدادات المتصفح عشان يوصلك التحديثات.",
    installAppToast: "ثبّت التطبيق عشان يوصلك تنبيه",
    installAppToastDesc:
      "على الآيفون، ضيف مزاج للشاشة الرئيسية الأول — وبعدين الزرار ده يفعّل التنبيهات.",
    thanksFeedbackToast: "شكراً على ملاحظاتك!",
    helpsServe: "بتساعدنا نخدمك أحسن 🙏",

    aiBtn: "ذكي",
    favorites: "المفضلة",
    coal: "فحم",
    call: "استدعاء",
    welcomeBackName: "أهلاً بعودتك،",
    yourUsual: "المعتاد بتاعك:",
    reorderBtn: "اطبق المعتاد",
    nameLabel: "الاسم:",
    tableLabel: "الطاولة:",
    callDescShort: "هيوصلك طلب للفريق. ضيف ملاحظة لو حابب.",
    coalDescShort: "اختر نوع الفحم والطلب هيوصل لرجل الشيشة على طول.",
    needHelpPlaceholder: "مثلاً: محتاج مساعدة في اختيار النكهات",
    coalNoteRegular: "فحم عادي لو سمحت",
    coalNoteCubed: "فحم مكعبات لو سمحت",
    shishaManToast: "رجل الشيشة في الطريق!",
    shishaManToastDesc: "هيوصلك في ثواني.",
    coalToast: "طلب الفحم اتبعت!",
    cubedOnWay: "فحم مكعبات في الطريق",
    regularOnWay: "فحم عادي في الطريق",
    browseSkipToast: "أهلاً! اتفرج واطلب لما تجهز.",

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

    // Favorites sheet
    favTitle: "مكساتك المفضلة",
    favDesc: "احفظ جبلتك المعتادة واطلبها بضغطة واحدة",
    saveCurrentMix: "احفظ المكس الحالي",
    favPlaceholder: "مثلاً: التوت نعناع بتاعي",
    saveBtn: "حفظ",
    favHint: "ضيف مكس فواكه للسلة الأول، وبعدين احفظه هنا.",
    noFavs: "مفيش مفضلات لسه. احفظ أول مكس فوق.",
    favRemoved: "اتشالت من المفضلة",
    favAdded: "تمت إضافة",

    aiSommelier: "السوميلييه الذكي",
    sommelierTagline: "كونسيرج الشيشة — من المزاج للجبلة في ثواني",
    sommelierGreeting:
      "أهلاً! أنا سوميلييه مزاج 🌿 قول لي مزاجك — حلو، نعناع، قوي — وهرشحلك الجبلة المثالية بالأسعار.",
    askPlaceholder: "مثلاً: حاجة حلوة وخفيفة…",
    thinking: "بفكر…",
    quickAdd: "إضافة سريعة",
    somethingSweet: "حاجة حلوة",
    strongClassic: "قوية وكلاسيكية",
    mintyFresh: "نعناع ومنعشة",
    surpriseMe: "فاجئني",
    aiBadge: "ذكاء مزاج",
    engineBadge: "ترشيح ذكي",
    clearChat: "مسح",
    sendBtn: "إرسال",
    addedToCart: "الشيشة اتجهازت",
    // r58 living orders — amend after confirming
    amendAction: "تعديل الطلب",
    amendEditingTitle: "تعديل الطلب",
    amendEditingDesc: "غيّر أي حاجة — المطبخ هيتحدث فورًا.",
    amendBarTitle: "تعديل الطلب",
    amendBarCta: "راجع التعديلات",
    amendSaveChanges: "احفظ التعديلات",
    amendSaving: "جاري الحفظ…",
    amendCancelEdit: "إيقاف التعديل",
    amendCancelled: "اتلغى التعديل — الطلب زي ما كان",
    amendNoChanges: "مفيش تغيير لسه",
    amendChangesChip: "تعديلاتك",
    amendFooterNote: "الحفظ يحدّث طابور المطبخ والمخزون فورًا.",
    amendUpdatedToast: "تم تحديث الطلب",
    amendUpdatedDesc: "المطبخ شاف التعديل فورًا.",
    amendRevWord: "نسخة",
    amendGuestButton: "عدّل طلبي",
    amendGuestStartDesc: "اتفرج على المنيو وغيّر الشيشن — وبعدين احفظ.",
    amendStartDesc: "اتفرج على المنيو وغيّر الشيشن — وبعدين احفظ النسخة الجديدة.",
    amendStaffTitle: "تعديل الطلب",
    amendStaffSubtitle: "عدّل طلب موجود — الطابور يتحدث مع الحفظ",
    amendEmptyTitle: "الطلب فضي خلاص",
    amendEmptyDesc: "ضيف شيشة واحدة على الأقل، أو أوقف التعديل لتركيه زي ما كان.",
    amendLegacyError: "الطلب ده ما ينفعش يتعدل (صيغة قديمة)",
    backToQueue: "رجوع للطابور",
    sommelierError: "السوميلييه رايح يستريح — جرب تاني",

    aiBrief: "ملخص ذكي",
    generateBrief: "ولّد الملخص الذكي",
    briefLoading: "بقرا أرقامك…",
    briefTitle: "الملخص التنفيذي لليوم",
    analyticsLoadError: "تعذر تحميل الإحصائيات.",
    tryAgain: "حاول تاني",

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

    // Landing — cinematic home experience
    landKicker: "مزاج · بيت الشيشة",
    landHeroTitleA: "حيث يصير الدخان",
    landHeroTitleB: "شِعراً",
    landHeroSub:
      "سبعة بيوت معسل أصيلة. طبق واحد يُصنع حسب طلبك ويُتابع مباشرة حتى طاولتك — وتطبيق كامل يعيش على هاتفك.",
    landHeroMeta: "٧ بيوت · +٣٠ نكهة · أطباق مصنوعة يدوياً",
    landCtaOrder: "اطلب الآن",
    landScroll: "مرّر",
    landNavPlatform: "المنصة",
    landNavExperience: "التجربة",
    landNavApp: "التطبيق",
    landRitualKicker: "التجربة",
    landRitualTitle: "طقوسٌ صُقلت بإتقان",
    landRitual1T: "اختر بيتك",
    landRitual1D:
      "سبعة بيوت معسل — من الكلاسيكيات المصرية الخالدة إلى خط أمي الفاخر. أو دع السوميلييه الذكي يقرأ مزاجك.",
    landRitual2T: "يُصنع لطلبك",
    landRitual2D:
      "كل طبق يُحضَّر عند الطلب — ٢٠ جراماً، خلطتك، بطريقتك. أحضر معلك أو معسلك وادفع طبقاً واحداً عن كل اثنين.",
    landRitual3T: "يُتابع حتى طاولتك",
    landRitual3D:
      "تابعه مباشرة — من الفحم إلى السحابة. تنبيه لطيف لحظة التقديم، ونقاط مع كل طبق.",
    landFeatKicker: "المنصة",
    landFeatTitle: "صالةٌ تفكّر",
    landFeatAiT: "سوميلييه ذكي",
    landFeatAiD: "أخبره بمزاجك — حلو، منعش، قوي — فيصوغ طبقك المثالي من القائمة الحية.",
    landFeatTrackT: "تتبع مباشر",
    landFeatTrackD: "من «يُحضّر» إلى «قُدّم» — كل مرحلة تصل مباشرة إلى هاتفك.",
    landFeatOfflineT: "يعمل بلا إنترنت",
    landFeatOfflineD: "اطلب في وضع الطيران. تتم المزامنة لحظة عودة الاتصال.",
    landFeatLoyaltyT: "مكافآت مزاج+",
    landFeatLoyaltyD: "كل طبق يكسبك. ارتقِ المستويات وافتح خلطات مجانية.",
    landStatHouses: "بيوت معسل",
    landStatFlavors: "نكهة",
    landStatBowl: "جرام للطبق",
    landStatBogo: "احضر معلك",
    landAppKicker: "التطبيق",
    landAppTitle: "احمل الصالة كاملة",
    landAppDesc:
      "بدون متجر تطبيقات. امسح الكود واضغط تثبيت — المنصة كاملة تعيش على شاشتك الرئيسية، تعمل بلا إنترنت، وتبقى مزامنة تماماً مع الصالة.",
    landAppB1: "يثبت في ثوانٍ",
    landAppB2: "يعمل بلا إنترنت",
    landAppB3: "ينبّهك عندما يجهز",
    landAppB4: "يكسب نقاط مزاج+",
    landFooterCraft: "صُنع في القاهرة",
    landFooterTagline: "اطلب · تابع · اكسب",
    landFooterRights: "جميع الحقوق محفوظة",
    landEnter: "ادخل الصالة",
    landMenuPeek: "بيوت الليلة",
    landMenuPeekSub: "اضغط لفتح القائمة كاملة",
  },
};
