"use client";

import * as React from "react";
import { useSession, EmployeeSession } from "@/store/session";
import { BowlBuilder } from "./bowl-builder";
import { InventoryPanel } from "./inventory-panel";
import { RequestsPanel } from "./requests-panel";
import { OrdersPanel } from "./orders-panel";
import { EmployeesPanel } from "./employees-panel";
import { PurchasesPanel } from "./purchases-panel";
import { ProfitPanel } from "./profit-panel";
import { SyncPanel } from "./sync-panel";
import { AnalyticsPanel } from "./analytics-panel";
import { LoyaltyPanel } from "./loyalty-panel";
import { LangToggle } from "./lang-toggle";
import { cn } from "@/lib/utils";
import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import {
  useSmartAlerts,
  primeNotifications,
} from "@/hooks/use-smart-alerts";
import {
  PlusCircle,
  Boxes,
  BellRing,
  ScrollText,
  Users,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Crown,
  Bell,
  BellOff,
  QrCode,
  Wand2,
  ShieldX,
  X,
  MapPin,
  ChevronDown,
  ChevronLeft,
  PenLine,
  LayoutGrid,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePwa } from "@/store/pwa";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useI18n } from "@/store/i18n";
import { useCart } from "@/store/cart";
import { SommelierSheet } from "./sommelier-sheet";
import { OrderScreen } from "./order-screen";
import { EASE, EmptyState, FadeSwap, TabBar, type TabItem } from "./kit/kit";

interface TabDef extends TabItem {
  key: Permission;
  render: (signOut: () => void) => React.ReactNode;
}

export function EmployeeDashboard() {
  const employee = useSession((s) => s.employee) as EmployeeSession | null;
  const signOut = useSession((s) => s.signOut);
  const setEmployeeBranch = useSession((s) => s.setEmployeeBranch);
  const perms = employee?.permissions ?? [];

  // r57 — multi-branch staff switch their working branch from the header
  const { branchId, branchName, branches, isFloater } = useBranchScope();
  const t = useI18n((s) => s.t);
  const lang = useI18n((s) => s.lang);
  const [branchMenuOpen, setBranchMenuOpen] = React.useState(false);
  const branchMenuRef = React.useRef<HTMLDivElement>(null);

  // close the branch menu on outside tap
  React.useEffect(() => {
    if (!branchMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [branchMenuOpen]);

  // R49 smart alerts: chime + notification + badge for new orders/requests.
  const alerts = useSmartAlerts();

  // r54: AI sommelier for staff — help a guest choose a bowl.
  const [sommOpen, setSommOpen] = React.useState(false);

  // r58 living orders — when an amend session is active (started from the
  // queue), the “New” tab becomes the ORDER EDITOR (cart-driven OrderScreen)
  // instead of BowlBuilder, so the staff member edits with the full menu:
  // mixes, BYO, add-ons — and saves a revision straight to the kitchen.
  const amendActive = useCart((s) => !!s.amendOrderId);

  // r56: the floating action cluster — one FAB, fans open on demand.
  const [fabOpen, setFabOpen] = React.useState(false);

  // Ask for notification permission once, on first interaction.
  React.useEffect(() => {
    const handler = () => primeNotifications();
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, []);

  // Active tab state — declared before the tabs memo so `selectTab` can
  // be referenced inside it. Starts on the queue (order-receiving focus);
  // the visibility effect below corrects it if permissions disallow.
  const [tab, setTab] = React.useState<Permission | null>("queue");

  // Switching to the queue/requests tab acknowledges unseen alerts.
  const selectTab = React.useCallback(
    (key: string) => {
      setTab(key as Permission);
      if (key === "queue" || key === "requests") {
        alerts.acknowledge();
      }
    },
    [alerts]
  );

  const tabs: TabDef[] = React.useMemo(
    () => [
      {
        key: "queue",
        label: "Queue",
        icon: <ScrollText className="size-5" />,
        render: (so) => (
          <OrdersPanel
            onSignOut={so}
            onAmendStart={() => selectTab("new_order")}
          />
        ),
      },
      {
        key: "new_order",
        label: amendActive ? "Edit" : "New",
        icon: amendActive ? (
          <PenLine className="size-5" />
        ) : (
          <PlusCircle className="size-5" />
        ),
        render: (so) =>
          amendActive ? (
            <OrderScreen
              title={t("amendStaffTitle")}
              subtitle={t("amendStaffSubtitle")}
              source="employee"
              orderedByName={employee?.name ?? ""}
              employeeId={employee?.id ?? null}
              bottomInset={64}
              onAmended={() => selectTab("queue")}
              headerExtra={
                <button
                  type="button"
                  onClick={() => selectTab("queue")}
                  className="glass grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={t("backToQueue")}
                  title={t("backToQueue")}
                >
                  <ChevronLeft className="size-4 rtl:rotate-180" />
                </button>
              }
            />
          ) : (
            <BowlBuilder
              orderedByName={employee?.name ?? ""}
              employeeId={employee?.id ?? ""}
              onSignOut={so}
            />
          ),
      },
      {
        key: "inventory",
        label: "Inventory",
        icon: <Boxes className="size-5" />,
        render: (so) => <InventoryPanel onSignOut={so} />,
      },
      {
        key: "requests",
        label: "Requests",
        icon: <BellRing className="size-5" />,
        render: (so) => <RequestsPanel onSignOut={so} />,
      },
      {
        key: "employees",
        label: "Staff",
        icon: <Users className="size-5" />,
        render: (so) => <EmployeesPanel onSignOut={so} />,
      },
      {
        key: "purchases",
        label: "Buy",
        icon: <ShoppingCart className="size-5" />,
        render: (so) => <PurchasesPanel onSignOut={so} />,
      },
      {
        key: "profit",
        label: "Profit",
        icon: <TrendingUp className="size-5" />,
        render: (so) => <ProfitPanel onSignOut={so} />,
      },
      {
        key: "analytics",
        label: "Stats",
        icon: <BarChart3 className="size-5" />,
        render: (so) => <AnalyticsPanel onSignOut={so} />,
      },
      {
        key: "loyalty",
        label: "Mazaj+",
        icon: <Crown className="size-5" />,
        render: (so) => <LoyaltyPanel onSignOut={so} />,
      },
      {
        key: "sync",
        label: "Sync",
        icon: <RefreshCw className="size-5" />,
        render: (so) => <SyncPanel onSignOut={so} />,
      },
    ],
    [employee, amendActive, t, selectTab]
  );

  // Filter tabs by the employee's permissions.
  const visibleTabs = tabs.filter((t) => hasPermission(perms, t.key));

  // Default to the first visible tab, preferring the queue (order-receiving focus).
  const defaultTab = visibleTabs.find((t) => t.key === "queue") ?? visibleTabs[0];


  // If the current tab is no longer visible (permissions changed), reset.
  React.useEffect(() => {
    if (tab && !visibleTabs.some((t) => t.key === tab)) {
      setTab(defaultTab?.key ?? null);
    }
  }, [tab, visibleTabs, defaultTab]);

  if (!employee) return null;
  if (visibleTabs.length === 0) {
    return (
      <div className="dark flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[oklch(0.135_0.014_60)] px-6 text-center text-foreground">
        <EmptyState
          icon={<ShieldX className="size-6" />}
          title="No access"
          description="You don't have permission to access any section. Ask a super admin to assign you a role."
          action={
            <button
              type="button"
              className="glass rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={signOut}
            >
              Sign out
            </button>
          }
        />
      </div>
    );
  }

  const activeTab = visibleTabs.find((t) => t.key === tab) ?? defaultTab;

  const tabItems: TabItem[] = visibleTabs.map((t) => ({
    key: t.key,
    label: t.label,
    icon: t.icon,
    badge:
      t.key === "queue"
        ? alerts.pendingOrders
        : t.key === "requests"
        ? alerts.pendingRequests
        : 0,
  }));

  return (
    <div className="relative min-h-[100dvh] bg-[oklch(0.135_0.014_60)]">
      {/* cinematic crossfade between panels */}
      <FadeSwap swapKey={activeTab?.key ?? "none"}>
        {activeTab && activeTab.render(signOut)}
      </FadeSwap>

      {/* r57 — the branch switcher (venue admins / floaters only): a glass
          chip fixed at the top edge; opens a dropdown to hop branches or
          float across all of them (total-inventory matrix view) */}
      {isFloater && (
        <div
          ref={branchMenuRef}
          className="fixed start-3 top-[70px] z-40"
        >
          <button
            type="button"
            onClick={() => setBranchMenuOpen((o) => !o)}
            aria-expanded={branchMenuOpen}
            aria-haspopup="menu"
            aria-label={t("branchLabel")}
            className="glass flex h-10 max-w-[60vw] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground/90 transition-all hover:border-primary/45 active:scale-[0.97]"
          >
            <MapPin className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{branchName ?? t("allBranches")}</span>
            <ChevronDown
              className={`size-3.5 shrink-0 text-foreground/70 transition-transform ${branchMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence>
            {branchMenuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="glass absolute start-0 top-12 w-64 overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/60"
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={branchId === null}
                  onClick={() => {
                    setEmployeeBranch(null);
                    setBranchMenuOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-start text-sm transition-colors ${
                    branchId === null
                      ? "bg-primary/15 font-bold text-primary"
                      : "text-foreground/90 hover:bg-white/[0.06]"
                  }`}
                >
                  <LayoutGrid className="size-4 shrink-0" />
                  <span className="truncate">{t("allBranches")}</span>
                </button>
                {branches.map((b) => {
                  const label = (lang === "ar" && b.nameAr) || b.name;
                  const active = branchId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setEmployeeBranch(b.id);
                        setBranchMenuOpen(false);
                      }}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-start text-sm transition-colors ${
                        active
                          ? "bg-primary/15 font-bold text-primary"
                          : "text-foreground/90 hover:bg-white/[0.06]"
                      }`}
                    >
                      <MapPin className="size-4 shrink-0" />
                      <span className="truncate">{label}</span>
                      {b.isFlagship && <span className="ms-auto text-[10px] text-primary">★</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <SommelierSheet
        open={sommOpen}
        onOpenChange={setSommOpen}
        guestName={employee.name}
        mode="staff"
      />

      {/* Floating action cluster — one gold FAB that fans open (QR, mute,
          language) so a permanent stack never covers panel content */}
      <div className="fixed start-4 bottom-[84px] z-50 flex flex-col items-center gap-2.5">
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.div
                key="fab-lang"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, delay: 0.15, ease: EASE }}
                className="glass grid size-10 place-items-center rounded-full"
              >
                <LangToggle className="border-0 bg-transparent px-1.5 text-[11px]" />
              </motion.div>
              <motion.button
                key="fab-mute"
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, delay: 0.1, ease: EASE }}
                onClick={alerts.toggleMuted}
                aria-label={alerts.muted ? "Unmute alerts" : "Mute alerts"}
                title={alerts.muted ? "Unmute alerts" : "Mute alerts"}
                className={cn(
                  "grid size-10 place-items-center rounded-full border shadow-lg backdrop-blur-xl transition-colors",
                  alerts.muted
                    ? "border-white/[0.08] bg-white/[0.05] text-muted-foreground"
                    : "border-primary/40 bg-primary/15 text-primary"
                )}
              >
                {alerts.muted ? (
                  <BellOff className="size-4" />
                ) : (
                  <Bell className="size-4" />
                )}
              </motion.button>
              <motion.button
                key="fab-qr"
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, delay: 0.05, ease: EASE }}
                onClick={() => usePwa.getState().setGetAppOpen(true)}
                aria-label="Show guest app QR"
                title="Show the guest download QR"
                className="glass grid size-10 place-items-center rounded-full text-primary shadow-lg transition-colors hover:border-primary/50 hover:bg-primary/20"
              >
                <QrCode className="size-4" />
              </motion.button>
              <motion.button
                key="fab-somm"
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                transition={{ duration: 0.22, ease: EASE }}
                onClick={() => {
                  setSommOpen(true);
                  setFabOpen(false);
                }}
                aria-label="AI Sommelier"
                title="AI Sommelier — recommend a bowl for a guest"
                className="glass grid size-10 place-items-center rounded-full text-primary shadow-lg transition-colors hover:border-primary/50 hover:bg-primary/20"
              >
                <Wand2 className="size-4" />
              </motion.button>
            </>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={() => setFabOpen((o) => !o)}
          whileTap={{ scale: 0.92 }}
          aria-label={fabOpen ? "Close actions" : "Open actions — AI sommelier, QR, alerts, language"}
          aria-expanded={fabOpen}
          title="AI Sommelier & more"
          className="relative grid size-12 place-items-center rounded-full bg-gradient-to-b from-[oklch(0.86_0.13_74)] to-[oklch(0.72_0.145_60)] text-[oklch(0.17_0.03_50)] shadow-[0_12px_34px_-10px_oklch(0.72_0.145_60/0.65)]"
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/30"
            aria-hidden
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={fabOpen ? "x" : "wand"}
              initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="grid place-items-center"
            >
              {fabOpen ? <X className="size-5" /> : <Wand2 className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Bottom tab bar — only shows tabs this employee can access.
          Horizontally scrollable so wide permission sets never cramp. */}
      <TabBar items={tabItems} active={activeTab?.key ?? null} onChange={selectTab} />
    </div>
  );
}
