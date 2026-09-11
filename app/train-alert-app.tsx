"use client";

import { useCallback, useEffect, useState } from "react";
import type { RouteGroup, Trip, WatchTargetInput, WatchView } from "@/lib/types";

type Member = { id: string; displayName: string; role: "owner" | "member" };
type ChannelState = { push: boolean; telegram: boolean };
type AdminMember = Member & { activeAlerts: number; push: boolean; telegram: boolean; revokedAt: string | null };

function money(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00+01:00`));
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || "Something went wrong");
  return body as T;
}

export function TrainAlertApp() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [channels, setChannels] = useState<ChannelState>({ push: false, telegram: false });
  const [watches, setWatches] = useState<WatchView[]>([]);
  const [view, setView] = useState<"dashboard" | "new" | "people" | "settings">("dashboard");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [actionTarget, setActionTarget] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("notification");
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ configured: boolean; member: Member | null; channels?: ChannelState; watches?: WatchView[] }>("/api/me");
      setConfigured(data.configured);
      setMember(data.member);
      setChannels(data.channels || { push: false, telegram: false });
      setWatches(data.watches || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load TrainAlert");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const directAction = hash.get("action");
    const target = hash.get("target");
    if (directAction && target) {
      void api("/api/alerts/action", { method: "POST", body: JSON.stringify({ targetId: target, action: directAction }) })
        .then(() => directAction === "book" ? location.assign("https://nrc.gsds.ng/") : refresh())
        .catch((cause) => setError(cause.message));
    }
    queueMicrotask(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  async function claimAccess(kind: "setup" | "invite", token: string, displayName: string) {
    setError("");
    try {
      await api(kind === "setup" ? "/api/bootstrap" : "/api/invites/redeem", {
        method: "POST",
        body: JSON.stringify({ token, displayName }),
      });
      history.replaceState(null, "", location.pathname);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Access could not be activated");
    }
  }

  if (loading) return <LoadingScreen />;
  if (!member) return <AccessScreen configured={configured} error={error} onSubmit={claimAccess} />;

  const activeCount = watches.filter((watch) => watch.status === "active").length;
  const availableCount = watches.reduce((sum, watch) => sum + watch.targets.filter((target) => target.isAvailable).length, 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")} aria-label="TrainAlert home">
          <span className="brand-mark"><span>TA</span></span>
          <span><strong>TrainAlert</strong><small>Catch the seat</small></span>
        </button>
        <div className="header-actions">
          <span className="live-pill"><i /> Checking every 2 min</span>
          <button className="avatar" onClick={() => setView("settings")} aria-label="Open settings">{member.displayName.slice(0, 2).toUpperCase()}</button>
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label="Main navigation">
          <NavButton icon="⌂" label="Overview" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          <NavButton icon="＋" label="New alert" active={view === "new"} onClick={() => setView("new")} />
          {member.role === "owner" && <NavButton icon="◎" label="People" active={view === "people"} onClick={() => setView("people")} />}
          <NavButton icon="⚙" label="Settings" active={view === "settings"} onClick={() => setView("settings")} />
        </nav>
        <div className="sidebar-note"><span>Unofficial service</span><p>Bookings happen securely on NRC.</p></div>
      </aside>

      <main className="main-content">
        {notice && <div className="toast success">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="toast error">{error}<button onClick={() => setError("")}>×</button></div>}
        {view === "dashboard" && (
          <Dashboard
            member={member}
            channels={channels}
            watches={watches}
            activeCount={activeCount}
            availableCount={availableCount}
            onNew={() => setView("new")}
            onSettings={() => setView("settings")}
            onChanged={refresh}
            onError={setError}
          />
        )}
        {view === "new" && <NewAlert onSaved={async () => { await refresh(); setView("dashboard"); setNotice("Your alert is live. We’ll keep watch."); }} onCancel={() => setView("dashboard")} onError={setError} />}
        {view === "people" && member.role === "owner" && <People onError={setError} />}
        {view === "settings" && <Settings member={member} channels={channels} onChanged={refresh} onNotice={setNotice} onError={setError} />}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton icon="⌂" label="Home" active={view === "dashboard"} onClick={() => setView("dashboard")} />
        <NavButton icon="＋" label="Alert" active={view === "new"} onClick={() => setView("new")} />
        {member.role === "owner" && <NavButton icon="◎" label="People" active={view === "people"} onClick={() => setView("people")} />}
        <NavButton icon="⚙" label="Settings" active={view === "settings"} onClick={() => setView("settings")} />
      </nav>

      {actionTarget && <ActionSheet targetId={actionTarget} onClose={() => { setActionTarget(null); history.replaceState(null, "", location.pathname); }} onChanged={refresh} onError={setError} />}
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><span className="brand-mark large"><span>TA</span></span><p>Checking the tracks…</p></div>;
}

function AccessScreen({ configured, error, onSubmit }: { configured: boolean; error: string; onSubmit: (kind: "setup" | "invite", token: string, displayName: string) => void }) {
  const hash = typeof window !== "undefined" ? new URLSearchParams(location.hash.replace(/^#/, "")) : new URLSearchParams();
  const inviteToken = hash.get("invite") || "";
  const setupToken = hash.get("setup") || "";
  const kind = configured ? "invite" : "setup";
  const [token, setToken] = useState(inviteToken || setupToken);
  const [name, setName] = useState("");
  return (
    <main className="access-page">
      <section className="access-copy">
        <span className="eyebrow">NIGERIAN TRAIN SEAT WATCHER</span>
        <h1>Don’t refresh all day.<br /><em>Catch the seat.</em></h1>
        <p>TrainAlert checks NRC every two minutes and tells you the moment the right seat appears.</p>
        <div className="feature-row"><span>◉ Telegram</span><span>◉ Phone alerts</span><span>◉ ₦0 to use</span></div>
      </section>
      <form className="access-card" onSubmit={(event) => { event.preventDefault(); onSubmit(kind, token, name); }}>
        <span className="brand-mark"><span>TA</span></span>
        <h2>{configured ? "Your invite is ready" : "Set up your owner access"}</h2>
        <p>{configured ? "Enter your name to activate this device." : "This one-time step makes this device the owner."}</p>
        <label>Display name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Treasure" /></label>
        <label>{configured ? "Invite code" : "Setup code"}<input required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your private code" /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary full" type="submit">Activate TrainAlert <span>→</span></button>
        <small>Private invite access. No password or NRC login required.</small>
      </form>
    </main>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{icon}</span>{label}</button>;
}

function Dashboard({ member, channels, watches, activeCount, availableCount, onNew, onSettings, onChanged, onError }: {
  member: Member; channels: ChannelState; watches: WatchView[]; activeCount: number; availableCount: number;
  onNew: () => void; onSettings: () => void; onChanged: () => Promise<void>; onError: (value: string) => void;
}) {
  return <>
    <section className="welcome-row">
      <div><span className="eyebrow">LIVE SEAT MONITOR</span><h1>Good day, {member.displayName.split(" ")[0]}.</h1><p>We’ll watch the timetable. You get on with your day.</p></div>
      <button className="primary" onClick={onNew}>＋ Create alert</button>
    </section>
    {(!channels.push || !channels.telegram) && <button className="channel-banner" onClick={onSettings}><span>⚡</span><div><strong>Complete your notification setup</strong><p>{!channels.telegram ? "Connect Telegram" : "Enable phone notifications"} so you never miss an opening.</p></div><b>Set up →</b></button>}
    <section className="stats-grid">
      <article className="stat-card dark"><span>ACTIVE WATCHES</span><strong>{activeCount.toString().padStart(2, "0")}</strong><p><i /> Checks running normally</p></article>
      <article className="stat-card"><span>SEATS OPEN NOW</span><strong>{availableCount.toString().padStart(2, "0")}</strong><p>{availableCount ? "Move fast — seats can go quickly" : "We’ll alert you when that changes"}</p></article>
      <article className="stat-card accent"><span>NEXT CHECK</span><strong>≤ 2<small>min</small></strong><p>Telegram + phone push</p></article>
    </section>
    <section className="section-head"><div><span className="eyebrow">YOUR JOURNEYS</span><h2>Seat watches</h2></div><span className="muted">{watches.length} total</span></section>
    {watches.length === 0 ? <EmptyState onNew={onNew} /> : <div className="watch-list">{watches.map((watch) => <WatchCard key={watch.id} watch={watch} onChanged={onChanged} onError={onError} />)}</div>}
  </>;
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return <button className="empty-state" onClick={onNew}><span className="track-illustration"><i /><b>＋</b><i /></span><h3>Put your first journey on watch</h3><p>Choose a train, class, and how many seats you need.</p><strong>Create an alert →</strong></button>;
}

function WatchCard({ watch, onChanged, onError }: { watch: WatchView; onChanged: () => Promise<void>; onError: (value: string) => void }) {
  const best = Math.max(0, ...watch.targets.map((target) => target.lastSeats));
  const primaryTarget = watch.targets[0];
  const update = async (status: string) => {
    try { await api(`/api/watches/${watch.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await onChanged(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not update alert"); }
  };
  return <article className="watch-card">
    <div className="route-line"><span>{watch.originName}</span><i><b>●</b></i><span>{watch.destinationName}</span></div>
    <div className="watch-meta"><span>{friendlyDate(watch.travelDate)}</span><span>{primaryTarget?.departureTime || "—"}</span><span>{watch.targets.length} selection{watch.targets.length === 1 ? "" : "s"}</span></div>
    <div className="watch-bottom">
      <span className={`status ${watch.status}`}>{watch.status === "active" ? "● Watching" : watch.status}</span>
      <span className={best >= watch.minimumSeats ? "seat-count open" : "seat-count"}>{best} seat{best === 1 ? "" : "s"} now</span>
      <div className="card-actions">
        {watch.status === "active" ? <button onClick={() => update("paused")}>Pause</button> : watch.status === "paused" ? <button onClick={() => update("active")}>Resume</button> : null}
        {(watch.status === "active" || watch.status === "paused") && <button onClick={() => update("completed")}>End</button>}
      </div>
    </div>
    {watch.lastError && <p className="inline-warning">Last check delayed: {watch.lastError}</p>}
  </article>;
}

function NewAlert({ onSaved, onCancel, onError }: { onSaved: () => Promise<void>; onCancel: () => void; onError: (value: string) => void }) {
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [maxDays, setMaxDays] = useState(3);
  const [routeId, setRouteId] = useState("");
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [date, setDate] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState<Record<string, WatchTargetInput>>({});
  const [minimumSeats, setMinimumSeats] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ routes: RouteGroup[]; maxDays: number }>("/api/nrc/routes").then((data) => { setRoutes(data.routes); setMaxDays(data.maxDays); setRouteId(data.routes[0]?.routeId || ""); }).catch((cause) => onError(cause.message)); }, [onError]);
  const route = routes.find((item) => item.routeId === routeId);
  const today = new Date();
  const minDate = today.toISOString().slice(0, 10);
  const maxDateValue = new Date(today.getTime() + (maxDays - 1) * 86400000).toISOString().slice(0, 10);
  async function loadTrips() {
    if (!originId || !destinationId || !date) return onError("Choose your route and date first.");
    setBusy(true); setSelected({});
    try { const data = await api<{ trips: Trip[] }>(`/api/nrc/trips?originId=${encodeURIComponent(originId)}&destinationId=${encodeURIComponent(destinationId)}&travelDate=${date}&routeId=${routeId}`); setTrips(data.trips); if (!data.trips.length) onError("NRC has no trains for that selection yet."); }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not load trains"); } finally { setBusy(false); }
  }
  function toggle(trip: Trip, coachId: string) {
    const coach = trip.coaches.find((item) => item.coachTypeId === coachId)!;
    const key = `${trip.tripId}:${coachId}`;
    setSelected((current) => {
      const next = { ...current };
      if (next[key]) delete next[key]; else next[key] = { tripId: trip.tripId, trainName: trip.vehicleName, departureTime: trip.departureTime, arrivalTime: trip.arrivalTime, coachTypeId: coach.coachTypeId, coachTypeName: coach.coachTypeName, fare: coach.fare };
      return next;
    });
  }
  async function save() {
    const origin = route?.stations.fromStation.find((item) => item.id === originId);
    const destination = route?.stations.toStation.find((item) => item.id === destinationId);
    if (!origin || !destination || !date || !Object.keys(selected).length) return onError("Select at least one train and class.");
    setBusy(true);
    try {
      await api("/api/watches", { method: "POST", body: JSON.stringify({ routeId, originId, originName: origin.name, destinationId, destinationName: destination.name, travelDate: date, minimumSeats, targets: Object.values(selected) }) });
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Could not save alert"); } finally { setBusy(false); }
  }
  return <section className="form-page">
    <button className="back-link" onClick={onCancel}>← Back to watches</button>
    <div className="form-heading"><span className="eyebrow">NEW SEAT WATCH</span><h1>Where are you headed?</h1><p>We’ll check this exact journey every two minutes.</p></div>
    <div className="form-card">
      <div className="field-grid">
        <label>From<select value={originId} onChange={(e) => { setOriginId(e.target.value); setTrips([]); }}><option value="">Choose station</option>{route?.stations.fromStation.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
        <label>To<select value={destinationId} onChange={(e) => { setDestinationId(e.target.value); setTrips([]); }}><option value="">Choose station</option>{route?.stations.toStation.filter((station) => station.id !== originId).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
        <label>Journey date<input type="date" min={minDate} max={maxDateValue} value={date} onChange={(e) => { setDate(e.target.value); setTrips([]); }} /></label>
        <label>Seats needed<select value={minimumSeats} onChange={(e) => setMinimumSeats(Number(e.target.value))}>{[1,2,3,4,5,6].map((count) => <option key={count} value={count}>{count} seat{count > 1 ? "s" : ""}</option>)}</select></label>
      </div>
      <button className="secondary" disabled={busy || !originId || !destinationId || !date} onClick={loadTrips}>{busy ? "Checking NRC…" : "Find departures"}</button>
    </div>
    {trips.length > 0 && <section className="departure-section"><div className="section-head"><div><span className="eyebrow">CHOOSE WHAT TO WATCH</span><h2>Departures and classes</h2></div><span className="muted">{Object.keys(selected).length} selected</span></div>
      <div className="trip-list">{trips.map((trip) => <article className="trip-card" key={trip.tripId}><div className="trip-time"><strong>{trip.departureTime}</strong><span>to {trip.arrivalTime}</span></div><div className="trip-main"><h3>{trip.vehicleName}</h3><p>{trip.vehicleCode}</p><div className="coach-options">{trip.coaches.map((coach) => { const key = `${trip.tripId}:${coach.coachTypeId}`; return <label className={selected[key] ? "coach selected" : "coach"} key={coach.coachTypeId}><input type="checkbox" checked={Boolean(selected[key])} onChange={() => toggle(trip, coach.coachTypeId)} /><span><b>{coach.coachTypeName}</b><small>{money(coach.fare)} · {coach.availableSeats} now</small></span></label>; })}</div></div></article>)}</div>
      <div className="sticky-save"><div><strong>{Object.keys(selected).length} selection{Object.keys(selected).length === 1 ? "" : "s"}</strong><span>Alert at {minimumSeats}+ seats</span></div><button className="primary" disabled={busy || !Object.keys(selected).length} onClick={save}>Start watching →</button></div>
    </section>}
  </section>;
}

function Settings({ member, channels, onChanged, onNotice, onError }: { member: Member; channels: ChannelState; onChanged: () => Promise<void>; onNotice: (value: string) => void; onError: (value: string) => void }) {
  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push notifications are not supported on this browser.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const registration = await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/push/public-key");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Key(publicKey) });
      await api("/api/push", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      onNotice("Phone notifications are connected."); await onChanged();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Could not enable notifications"); }
  }
  async function connectTelegram() {
    try { const { url } = await api<{ url: string }>("/api/telegram/link", { method: "POST", body: "{}" }); window.open(url, "_blank", "noopener,noreferrer"); }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not connect Telegram"); }
  }
  return <section className="form-page narrow"><div className="form-heading"><span className="eyebrow">DELIVERY</span><h1>Notification settings</h1><p>Use both channels so an opening is hard to miss.</p></div>
    <div className="setting-list">
      <article><span className="setting-icon">↗</span><div><h3>Telegram</h3><p>Fast bot messages with Book now and End alert buttons.</p></div><span className={channels.telegram ? "connected" : "not-connected"}>{channels.telegram ? "Connected" : "Not connected"}</span><button className="secondary small" onClick={connectTelegram}>{channels.telegram ? "Reconnect" : "Connect"}</button></article>
      <article><span className="setting-icon">●</span><div><h3>Phone notifications</h3><p>Native alerts even when TrainAlert is closed.</p></div><span className={channels.push ? "connected" : "not-connected"}>{channels.push ? "Connected" : "Not connected"}</span><button className="secondary small" onClick={enablePush}>{channels.push ? "Refresh" : "Enable"}</button></article>
    </div>
    <div className="profile-card"><span className="avatar large-avatar">{member.displayName.slice(0,2).toUpperCase()}</span><div><span className="eyebrow">THIS DEVICE</span><h3>{member.displayName}</h3><p>{member.role === "owner" ? "Owner access" : "Invited member"}</p></div></div>
  </section>;
}

function People({ onError }: { onError: (value: string) => void }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [label, setLabel] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const load = useCallback(() => { api<{ members: AdminMember[] }>("/api/invites").then((data) => setMembers(data.members)).catch((cause) => onError(cause.message)); }, [onError]);
  useEffect(load, [load]);
  async function createInvite() {
    try { const data = await api<{ inviteUrl: string }>("/api/invites", { method: "POST", body: JSON.stringify({ label }) }); setInviteUrl(data.inviteUrl); setLabel(""); load(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not create invite"); }
  }
  async function copyInvite() { await navigator.clipboard.writeText(inviteUrl); }
  async function revoke(id: string, name: string) {
    if (!window.confirm(`Revoke ${name}'s TrainAlert access and end their watches?`)) return;
    try { await api(`/api/members/${id}`, { method: "DELETE" }); load(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not revoke access"); }
  }
  return <section className="form-page"><div className="form-heading"><span className="eyebrow">OWNER CONTROLS</span><h1>Invite your people</h1><p>Up to ten people can use this private alert circle.</p></div>
    <div className="invite-card"><label>Friend’s name<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Who is this invite for?" /></label><button className="primary" disabled={!label.trim()} onClick={createInvite}>Create invite</button></div>
    {inviteUrl && <div className="invite-result"><div><strong>Private invite ready</strong><p>{inviteUrl}</p></div><button className="secondary" onClick={copyInvite}>Copy link</button></div>}
    <div className="people-list">{members.map((person) => <article key={person.id}><span className="avatar">{person.displayName.slice(0,2).toUpperCase()}</span><div><h3>{person.displayName}</h3><p>{person.role === "owner" ? "Owner" : `${person.activeAlerts} active alert${person.activeAlerts === 1 ? "" : "s"}`}</p></div><div className="channel-dots"><i className={person.telegram ? "on" : ""} title="Telegram" /><i className={person.push ? "on" : ""} title="Push" /></div><span className={person.revokedAt ? "status completed" : "status active"}>{person.revokedAt ? "Revoked" : "Active"}</span>{person.role !== "owner" && !person.revokedAt && <button className="revoke-button" onClick={() => revoke(person.id, person.displayName)}>Revoke</button>}</article>)}</div>
  </section>;
}

function ActionSheet({ targetId, onClose, onChanged, onError }: { targetId: string; onClose: () => void; onChanged: () => Promise<void>; onError: (value: string) => void }) {
  async function act(action: "book" | "end") {
    try { await api("/api/alerts/action", { method: "POST", body: JSON.stringify({ targetId, action }) }); if (action === "book") location.assign("https://nrc.gsds.ng/"); else { await onChanged(); onClose(); } }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Could not update alert"); }
  }
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="alert-action-title" onClick={(event) => event.stopPropagation()}><span className="action-badge">SEATS AVAILABLE</span><h2 id="alert-action-title">What do you want to do?</h2><p>Choosing either option permanently finishes this watch.</p><button className="primary full" onClick={() => act("book")}>Book now on NRC <span>↗</span></button><button className="secondary full" onClick={() => act("end")}>End alert</button><button className="text-button" onClick={onClose}>Keep reminding me</button></section></div>;
}

function base64Key(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
