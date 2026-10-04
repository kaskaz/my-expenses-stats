"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownLeft, ArrowUpRight, BarChart3, ChevronRight, CircleHelp, Download, ExternalLink, Layers3, LayoutDashboard, LoaderCircle, LogOut, Menu, RefreshCw, Search, Sheet, TrendingUp, Wallet, X } from "lucide-react";
import { demoData, type DashboardPayload } from "@/lib/demo";
import type { Total } from "@/lib/parser";

type View = "Statistics" | "Categories" | "Performance";
type Granularity = "daily" | "weekly" | "monthly";
const colors = ["#258774", "#8abeb0", "#dfb66b", "#687bb0", "#c68b80", "#acc7d0", "#aca6c3", "#84a35f"];
const titleCase = (value: string) => value.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const sum = (rows: Total[]) => rows.reduce((n, row) => n + row.debit, 0);
const dateLabel = (value: string, monthly = false) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", ...(monthly ? { year: "numeric" } : { day: "numeric" }), timeZone: "UTC" });
const errors: Record<string, string> = {
  setup: "Google Sheets is not configured yet. Follow the setup instructions in the repository README.",
  state: "The sign-in request expired or could not be verified. Please try again.",
  cancelled: "Google sign-in was cancelled. You can try again whenever you’re ready.",
  signin: "Google sign-in failed. Check the OAuth configuration and try again.",
  account: "This Google account is not allowed to sign in. Choose the account configured for this dashboard."
};

export default function Dashboard({ authenticated, userName, configured }: { authenticated: boolean; userName: string; configured: boolean }) {
  const [view, setView] = useState<View>("Statistics");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [menu, setMenu] = useState(false);
  const [category, setCategory] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [metric, setMetric] = useState<"debit" | "count">("debit");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason) Promise.resolve().then(() => setError(errors[reason] ?? errors.signin));
    if (!authenticated) return;
    const controller = new AbortController();
    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load the spreadsheet.");
        setData(result); setError("");
      })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load data."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [authenticated, requestVersion]);

  const demo = !authenticated;
  const source = data ?? demoData;
  const money = (value: number, compact = false) => new Intl.NumberFormat("en-GB", { style: "currency", currency: source.currency, maximumFractionDigits: compact ? 1 : 0, notation: compact ? "compact" : "standard" }).format(value);
  const stats = [...source.statistics.categories].sort((a, b) => b.debit - a.debit);
  const total = sum(stats);
  const transactionCount = stats.reduce((n, item) => n + item.count, 0);
  const chosen = source.categories.find(c => c.name === category) ?? source.categories[0];
  const periods = useMemo(() => source.performance[granularity].filter(row => (!from || row.date >= from) && (!to || row.date <= to)), [source, granularity, from, to]);
  const periodTotal = periods.reduce((n, row) => n + row.debit, 0);
  const periodCount = periods.reduce((n, row) => n + row.count, 0);
  const periodLabel = granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month";
  const peak = [...periods].sort((a, b) => b.debit - a.debit)[0];
  const available = source.performance.daily;
  const coverage = available.length ? `${dateLabel(available[0].date)} – ${dateLabel(available.at(-1)!.date)} ${available.at(-1)!.date.slice(0, 4)}` : "No recorded periods";
  const displayChartValue = (value: number) => metric === "debit" ? money(value) : value.toLocaleString();

  function refresh() { setLoading(true); setRequestVersion(v => v + 1); }
  function selectView(next: View) { setView(next); setMenu(false); }
  function exportCsv() {
    const rows = view === "Performance"
      ? [["Period start", "Period end", "Spending", "Transactions"], ...periods.map(p => [p.date, p.end ?? "", p.debit, p.count])]
      : [["Name", "Spending", "Transactions"], ...(view === "Categories" ? chosen?.merchants ?? [] : source.statistics.merchants).map(r => [r.name, r.debit, r.count])];
    const quote = (value: string | number) => {
      const text = String(value);
      // Protect spreadsheet programs from formula injection in merchant labels.
      const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `expenses-${view.toLowerCase()}${demo ? "-demo" : ""}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <Link className="brand" href="/" aria-label="My Expenses home"><span className="brand-mark"><BarChart3 size={23} /></span><span>my expenses<span className="brand-dot">.</span></span></Link>
      <button className="mobile-close icon-button" onClick={() => setMenu(false)} aria-label="Close navigation"><X size={20} /></button>
      <div className="workspace"><span className="workspace-icon"><Wallet size={18} /></span><div><strong>Personal finances</strong><small>EXTRATOS-BCN · 2026</small></div><ChevronRight size={15} /></div>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav>{([{ name: "Statistics", icon: LayoutDashboard }, { name: "Categories", icon: Layers3 }, { name: "Performance", icon: TrendingUp }] as const).map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? "active" : ""}`} onClick={() => selectView(name)}><Icon size={19} /><span>{name}</span>{view === name && <span className="active-dot" />}</button>)}</nav>
      <div className="source-card"><span className="source-symbol"><Sheet size={22} /></span><strong>Your sheet. Your insights.</strong><p>A fresh perspective on the numbers you already keep.</p>{data ? <a href={data.sourceUrl} target="_blank" rel="noreferrer">Open spreadsheet <ArrowUpRight size={15} /></a> : <button onClick={() => setSetup(true)}>Connection details <ArrowUpRight size={15} /></button>}</div>
      <div className="sidebar-footer"><button onClick={() => setSetup(true)}><CircleHelp size={17} /> How it works</button><div className="profile"><span className="avatar">{authenticated ? userName.slice(0, 1).toUpperCase() : "D"}</span><div><strong>{authenticated ? userName : "Demo workspace"}</strong><small>{authenticated ? "Private Google connection" : "Explore with sample data"}</small></div>{authenticated && <form action="/api/auth/logout" method="post"><button className="icon-button" aria-label="Sign out"><LogOut size={17} /></button></form>}</div></div>
    </aside>
    {menu && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />}
    <main>
      <header className="topbar"><div><button className="mobile-menu icon-button" onClick={() => setMenu(true)} aria-label="Open navigation"><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{view}</strong></div><div className="top-actions"><span className={`connection-pill ${demo ? "demo" : ""}`}><span />{demo ? "Demo mode" : data ? "Google Sheets connected" : "Google Sheets"}</span>{demo ? <a className="button small" href={configured ? "/api/auth/login" : undefined} onClick={configured ? undefined : (event) => { event.preventDefault(); setSetup(true); }}>Connect Google Sheet <ArrowUpRight size={15} /></a> : <button className="icon-button" onClick={refresh} disabled={loading} aria-label="Refresh sheet data"><RefreshCw className={loading ? "spin" : ""} size={18} /></button>}</div></header>
      <div className="content">
        {demo && <div className="demo-notice"><span><Sheet size={17} /><strong>You’re exploring a preview.</strong> All numbers below are synthetic sample data.</span><button onClick={() => setSetup(true)}>Connect your 2026 sheet <ArrowUpRight size={15} /></button></div>}
        {error && <div role="alert" className="error-notice"><span>{error}</span>{authenticated && <a href="/api/auth/login">Sign in again</a>}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
        <div className="page-heading"><div><p className="eyebrow">A LITTLE CLARITY, EVERY DAY</p><h1>{view === "Statistics" ? "Your spending, in perspective." : view === "Categories" ? "See where it all goes." : "Find your spending rhythm."}</h1><p>{view === "Statistics" ? "The big picture of your expenses, straight from your spreadsheet." : view === "Categories" ? "Explore each category and the places behind the numbers." : "Follow your spending over time, one period at a time."}</p></div><button className="button secondary" onClick={exportCsv} disabled={authenticated && !data}><Download size={16} /> Export CSV</button></div>
        <div className="context-row"><span className="year-tag">2026</span><span>{coverage}</span><span className="context-spacer" /><span>Source: <strong>{view}</strong></span><span className="currency-tag">{source.currency}</span></div>
        {authenticated && !data ? <div className="empty-state">{loading ? <><LoaderCircle className="spin" /><h2>Reading your spreadsheet</h2><p>Loading Statistics, Categories, and Performance.</p></> : <><Sheet /><h2>Your sheet couldn’t be loaded</h2><p>{error || "Please try refreshing your connection."}</p><button className="button" onClick={refresh}>Try again</button></>}</div> : <>
          {view === "Statistics" && <>
            <div className="metric-grid"><Metric label="Total spending" value={money(total)} detail="All debit categories · Statistics" icon={<Wallet size={18} />} /><Metric label="Transactions" value={transactionCount.toLocaleString()} detail="Debit transactions · Statistics" icon={<ArrowDownLeft size={18} />} /><Metric label="Largest category" value={titleCase(stats[0]?.name ?? "—")} detail={stats[0] ? `${money(stats[0].debit)} · ${total ? (stats[0].debit / total * 100).toFixed(1) : 0}% of spending` : "No categories"} icon={<Layers3 size={18} />} /><Metric label="Places visited" value={source.statistics.merchants.length.toLocaleString()} detail="Merchant locations with debits" icon={<BarChart3 size={18} />} /></div>
            <div className="chart-grid"><section className="panel"><PanelTitle title="Spending by category" subtitle="Every expense has a place in the picture." /><div className="donut-layout"><div className="donut-container"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={stats} dataKey="debit" nameKey="name" innerRadius={78} outerRadius={105} paddingAngle={2} stroke="none" onClick={(_, index) => { setCategory(stats[index].name); setView("Categories"); }}>{stats.map((item, i) => <Cell key={item.name} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={value => money(Number(value))} /></PieChart></ResponsiveContainer><div className="donut-center"><span>Total spending</span><strong>{money(total, true)}</strong></div></div><div className="legend">{stats.slice(0, 6).map((item, i) => <button key={item.name} onClick={() => { setCategory(item.name); setView("Categories"); }}><span className="legend-dot" style={{ background: colors[i % colors.length] }} /><span>{titleCase(item.name)}</span><strong>{total ? (item.debit / total * 100).toFixed(1) : 0}%</strong></button>)}{stats.length > 6 && <small>+ {stats.length - 6} more categories below</small>}</div></div><p className="chart-footnote">Select a segment or category to explore its merchants.</p></section>
            <section className="panel"><PanelTitle title="The category comparison" subtitle="Your top eight categories, side by side." /><div className="chart-height"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}><CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#e9ede9" /><XAxis type="number" tickFormatter={v => money(v, true)} tickLine={false} axisLine={false} fontSize={11} /><YAxis dataKey="name" type="category" tickFormatter={titleCase} width={106} tickLine={false} axisLine={false} fontSize={11} /><Tooltip formatter={v => money(Number(v))} cursor={{ fill: "#f3f6f3" }} /><Bar dataKey="debit" name="Spending" fill="#258774" radius={[0, 4, 4, 0]} barSize={17} /></BarChart></ResponsiveContainer></div></section></div>
            <section className="panel"><PanelTitle title="Category overview" subtitle="Exact totals from the Statistics tab." /><div className="category-overview">{stats.map((item, i) => <button key={item.name} onClick={() => { setCategory(item.name); setView("Categories"); }}><span className="category-tile-icon" style={{ background: `${colors[i % colors.length]}20`, color: colors[i % colors.length] }}><Layers3 size={17} /></span><span><strong>{titleCase(item.name)}</strong><small>{item.count} transactions</small></span><b>{money(item.debit)}</b><ChevronRight size={14} /></button>)}</div></section>
            <MerchantTable rows={source.statistics.merchants} format={money} title="Your spending destinations" subtitle="All merchant totals from Statistics. Search, sort, and explore." />
          </>}
          {view === "Categories" && <>
            <div className="category-filters" aria-label="Choose category">{source.categories.map(c => <button key={c.name} className={chosen?.name === c.name ? "selected" : ""} onClick={() => setCategory(c.name)}>{titleCase(c.name)}</button>)}</div>
            {chosen ? <><div className="metric-grid three"><Metric label={`${titleCase(chosen.name)} spending`} value={money(chosen.debit)} detail="Category summary · Categories tab" icon={<Wallet size={18} />} /><Metric label="Transactions" value={chosen.count.toLocaleString()} detail="Includes all category transactions" icon={<ArrowDownLeft size={18} />} /><Metric label="Merchant locations" value={chosen.merchants.length.toLocaleString()} detail="Blank merchant labels are kept" icon={<Layers3 size={18} />} /></div>
              <section className="panel"><PanelTitle title={`Inside ${titleCase(chosen.name)}`} subtitle="The ten merchant locations with the highest spending." /><div className="chart-height tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...chosen.merchants].sort((a, b) => b.debit - a.debit).slice(0, 10)} margin={{ top: 12, right: 16, bottom: 36, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#e9ede9" /><XAxis dataKey="name" tickFormatter={name => name.length > 13 ? `${name.slice(0, 13)}…` : name} tickLine={false} axisLine={false} fontSize={10} angle={-20} textAnchor="end" interval={0} /><YAxis tickFormatter={n => money(n, true)} tickLine={false} axisLine={false} width={75} fontSize={11} /><Tooltip formatter={v => money(Number(v))} /><Bar dataKey="debit" name="Spending" fill="#258774" radius={[5, 5, 0, 0]} maxBarSize={54} /></BarChart></ResponsiveContainer></div></section>
              <MerchantTable key={chosen.name} rows={chosen.merchants} format={money} title={`${titleCase(chosen.name)} · all merchants`} subtitle="Merchant totals and transaction counts from the Categories tab." /></> : <div className="empty-state"><p>No Categories data is available.</p></div>}
          </>}
          {view === "Performance" && <>
            <div className="performance-filters"><div className="segmented">{(["daily", "weekly", "monthly"] as const).map(g => <button key={g} className={g === granularity ? "selected" : ""} onClick={() => setGranularity(g)}>{titleCase(g)}</button>)}</div><div className="date-filters"><label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>{(from || to) && <button className="text-button" onClick={() => { setFrom(""); setTo(""); }}>Reset</button>}</div></div>
            <p className="scope-note"><CircleHelp size={15} /> Performance excludes rent and bank fees. Date filters select period start dates; weekly totals cover Monday–Sunday. Monthly and weekly edge periods may be incomplete.</p>
            <div className="metric-grid"><Metric label="Period spending" value={money(periodTotal)} detail={`${periods.length} recorded ${periodLabel}${periods.length === 1 ? "" : "s"} selected`} icon={<Wallet size={18} />} /><Metric label={`Average / ${periodLabel}`} value={money(periods.length ? periodTotal / periods.length : 0)} detail="Average over recorded periods only" icon={<TrendingUp size={18} />} /><Metric label="Transactions" value={periodCount.toLocaleString()} detail="Rent and bank fees excluded" icon={<ArrowDownLeft size={18} />} /><Metric label="Highest spending period" value={peak ? dateLabel(peak.date, granularity === "monthly") : "—"} detail={peak ? money(peak.debit) : "No periods in selection"} icon={<BarChart3 size={18} />} /></div>
            <section className="panel"><div className="panel-title"><div><h2>Spending over time</h2><p>A closer look at your {granularity} rhythm.</p></div><div className="chart-controls"><select aria-label="Chart metric" value={metric} onChange={e => setMetric(e.target.value as typeof metric)}><option value="debit">Spending</option><option value="count">Transactions</option></select><div className="segmented compact"><button className={chartType === "area" ? "selected" : ""} onClick={() => setChartType("area")} aria-label="Area chart"><TrendingUp size={15} /></button><button className={chartType === "bar" ? "selected" : ""} onClick={() => setChartType("bar")} aria-label="Bar chart"><BarChart3 size={15} /></button></div></div></div>
              {periods.length ? <div className="chart-height tall"><ResponsiveContainer width="100%" height="100%">{chartType === "area" ? <AreaChart key={`${granularity}-${from}-${to}`} data={periods} margin={{ top: 16, right: 16, bottom: 4, left: 5 }}><defs><linearGradient id="spending-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#258774" stopOpacity={0.2} /><stop offset="100%" stopColor="#258774" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#e9ede9" /><XAxis dataKey="date" tickFormatter={v => dateLabel(v, granularity === "monthly")} axisLine={false} tickLine={false} fontSize={11} minTickGap={30} /><YAxis tickFormatter={v => metric === "debit" ? money(v, true) : String(v)} axisLine={false} tickLine={false} width={78} fontSize={11} /><Tooltip labelFormatter={v => dateLabel(String(v), granularity === "monthly")} formatter={v => displayChartValue(Number(v))} /><Area type="monotone" dataKey={metric} name={metric === "debit" ? "Spending" : "Transactions"} stroke="#258774" strokeWidth={2.5} fill="url(#spending-fill)" activeDot={{ r: 5 }} /><Brush dataKey="date" height={24} stroke="#accbbe" travellerWidth={7} tickFormatter={v => dateLabel(v)} /></AreaChart> : <BarChart key={`${granularity}-${from}-${to}`} data={periods} margin={{ top: 16, right: 16, bottom: 4, left: 5 }}><CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#e9ede9" /><XAxis dataKey="date" tickFormatter={v => dateLabel(v, granularity === "monthly")} axisLine={false} tickLine={false} fontSize={11} minTickGap={30} /><YAxis tickFormatter={v => metric === "debit" ? money(v, true) : String(v)} axisLine={false} tickLine={false} width={78} fontSize={11} /><Tooltip labelFormatter={v => dateLabel(String(v), granularity === "monthly")} formatter={v => displayChartValue(Number(v))} /><Bar dataKey={metric} name={metric === "debit" ? "Spending" : "Transactions"} fill="#258774" radius={[4, 4, 0, 0]} maxBarSize={50} /><Brush dataKey="date" height={24} stroke="#accbbe" travellerWidth={7} tickFormatter={v => dateLabel(v)} /></BarChart>}</ResponsiveContainer></div> : <div className="empty-state"><h3>No recorded periods</h3><p>Choose another date range to see your spending.</p></div>}
              <p className="chart-footnote">Hover for exact values. Drag the handles below the chart to zoom; summary cards reflect the date filters.</p></section>
            <PeriodTable key={`${granularity}-${from}-${to}`} rows={periods} monthly={granularity === "monthly"} format={money} />
          </>}
          {source.warnings.length > 0 && <details className="data-warnings"><summary><CircleHelp size={16} /> {source.warnings.length} source consistency notes</summary>{source.warnings.map(note => <p key={note}>{note}</p>)}</details>}
          <footer className="page-footer"><span><span className="status-dot" />{demo ? "Synthetic demo data · not your financial records" : `Last refreshed ${data ? new Date(data.fetchedAt).toLocaleTimeString("en-GB") : "—"}`}</span><span>Debits shown as positive spending · {source.currency}</span></footer>
        </>}
      </div>
    </main>
    {setup && <div className="modal-backdrop" onClick={() => setSetup(false)}><section role="dialog" aria-modal="true" aria-labelledby="setup-title" className="modal" onClick={e => e.stopPropagation()}><button className="icon-button modal-close" aria-label="Close connection details" onClick={() => setSetup(false)} autoFocus><X size={20} /></button><span className="modal-symbol"><Sheet size={30} /></span><h2 id="setup-title">Your spreadsheet, connected.</h2><p>My Expenses reads the <strong>Statistics</strong>, <strong>Categories</strong>, and <strong>Performance</strong> tabs in your 2026 Google Sheet. It never edits the workbook.</p><ol><li>Configure Google OAuth and the spreadsheet ID using the repository README.</li><li>Sign in with the Google account that can access EXTRATOS-BCN / 2026.</li><li>Refresh to read the latest calculated totals from your sheet.</li></ol><p className="scope-note">Rent and bank fees appear in Statistics and Categories, but are excluded from Performance by the source sheet. Currency defaults to CVE and can be configured.</p>{configured ? <a className="button" href="/api/auth/login">Sign in with Google <ArrowUpRight size={16} /></a> : <a className="button" href="https://github.com/kaskaz/my-expenses-stats#setup" target="_blank" rel="noreferrer">Open setup instructions <ExternalLink size={16} /></a>}<button className="text-button" onClick={() => setSetup(false)}>Back to dashboard</button></section></div>}
  </div>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <section className="metric-card"><div><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><p>{detail}</p></section>;
}
function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}
function MerchantTable({ rows, format, title, subtitle }: { rows: Total[]; format: (n: number) => string; title: string; subtitle: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"debit" | "count" | "name">("debit");
  const [page, setPage] = useState(0);
  const filtered = [...rows].filter(r => r.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages - 1);
  return <section className="panel table-panel"><div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div><label className="search"><Search size={15} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Search merchants…" aria-label="Search merchants" /></label></div><div className="table-scroll"><table><thead><tr><th><button onClick={() => setSort("name")}>MERCHANT {sort === "name" ? "↓" : ""}</button></th><th><button onClick={() => setSort("count")}>TRANSACTIONS {sort === "count" ? "↓" : ""}</button></th><th><button onClick={() => setSort("debit")}>SPENDING {sort === "debit" ? "↓" : ""}</button></th></tr></thead><tbody>{filtered.slice(current * 8, current * 8 + 8).map((row, i) => <tr key={`${row.name}-${i}`}><td><span className="merchant-initial">{row.name.slice(0, 1).toUpperCase()}</span>{titleCase(row.name)}</td><td>{row.count.toLocaleString()}</td><td className="spending-cell">{format(row.debit)}</td></tr>)}{!filtered.length && <tr><td colSpan={3}>No merchants match your search.</td></tr>}</tbody></table></div><Pagination page={current} pages={pages} count={filtered.length} onChange={setPage} /></section>;
}
function PeriodTable({ rows, monthly, format }: { rows: { date: string; end?: string; debit: number; count: number }[]; monthly: boolean; format: (n: number) => string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  return <section className="panel table-panel"><PanelTitle title="The numbers behind the chart" subtitle="Exact values from the Performance tab, within your selected dates." /><div className="table-scroll"><table><thead><tr><th>PERIOD</th><th>TRANSACTIONS</th><th>SPENDING</th></tr></thead><tbody>{rows.slice(page * 8, page * 8 + 8).map(row => <tr key={row.date}><td>{dateLabel(row.date, monthly)}{row.end ? ` – ${dateLabel(row.end)}` : ""}</td><td>{row.count.toLocaleString()}</td><td className="spending-cell">{format(row.debit)}</td></tr>)}{!rows.length && <tr><td colSpan={3}>No recorded periods in the selected range.</td></tr>}</tbody></table></div><Pagination page={page} pages={pages} count={rows.length} onChange={setPage} /></section>;
}
function Pagination({ page, pages, count, onChange }: { page: number; pages: number; count: number; onChange: (n: number) => void }) {
  return <div className="pagination"><span>{count} records · Page {page + 1} of {pages}</span><div><button disabled={!page} onClick={() => onChange(page - 1)}>Previous</button><button disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={13} /></button></div></div>;
}
