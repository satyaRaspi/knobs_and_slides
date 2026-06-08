import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AppWindow,
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Cpu,
  Gauge,
  Info,
  Lock,
  LogOut,
  Grid3X3,
  LayoutDashboard,
  Monitor,
  Moon,
  PauseCircle,
  Printer,
  Plus,
  Power,
  Link2,
  Unlink2,
  RadioTower,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  Trash2,
  UserPlus,
  Users,
  MousePointerClick,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';
import { api, wsUrl, setToken } from './api';
import './styles.css';

const VERSION = '1.2.37';


class StudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'A screen error occurred.' };
  }
  componentDidCatch(error, info) {
    console.error('Studio screen error:', error, info);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <section className="glassCard">
          <SectionHeader eyebrow="Screen recovery" title="This page could not render" text="The app is still running. Use Refresh or another menu item, and check the message below." />
          <div className="errorBox">{this.state.message}</div>
          <button className="refreshButton" onClick={() => window.location.reload()}><RefreshCw size={16} />Reload app</button>
        </section>
      );
    }
    return this.props.children;
  }
}

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'simulator', label: 'Multi-Knob Simulator', icon: Bluetooth },
  { key: 'devices', label: 'Knob Maintenance', icon: Grid3X3 },
  { key: 'profiles', label: 'Profiles', icon: AppWindow },
  { key: 'mappings', label: 'Mappings', icon: SlidersHorizontal },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'leads', label: 'Leads', icon: UserPlus },
  { key: 'events', label: 'Monitor', icon: Activity },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function App() {
  const [active, setActive] = useState('overview');
  const [meta, setMeta] = useState({ name: 'Knobs and Slides Studio', version: VERSION });
  const [textConfig, setTextConfig] = useState({});
  const [devices, setDevices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [controls, setControls] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [events, setEvents] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('knobs_theme') || 'light');
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [menuCollapsed, setMenuCollapsed] = useState(() => localStorage.getItem('knobs_menu_collapsed') === '1');
  const [leadAccess, setLeadAccess] = useState(() => localStorage.getItem('knobs_lead_access') === '1');

  async function refresh() {
    try {
      setError('');
      const [m, d, a, c, map, ev, tx] = await Promise.all([
        api('/api/meta'),
        api('/api/devices'),
        api('/api/applications'),
        api('/api/controls'),
        api('/api/mappings'),
        api('/api/events?limit=80'),
        api('/api/text-config'),
      ]);
      setMeta({ ...m, version: VERSION, release: 'Configurable Text & Lead Intelligence' });
      setDevices(d);
      setApplications(a);
      setControls(c);
      setMappings(map);
      setEvents(ev);
      setTextConfig(toTextMap(tx));
      if (ev[0]) setLastEvent(normalizeDbEvent(ev[0]));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    api('/api/auth/me')
      .then((res) => setAuthUser(res.user))
      .catch(() => { setToken(''); setAuthUser(null); })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    api('/api/text-config').then((tx) => setTextConfig(toTextMap(tx))).catch(() => {});
  }, []);

  useEffect(() => {
    if (authUser) refresh();
  }, [authUser]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('knobs_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('knobs_menu_collapsed', menuCollapsed ? '1' : '0');
  }, [menuCollapsed]);

  useEffect(() => {
    let socket;
    try {
      socket = new WebSocket(wsUrl());
      socket.onmessage = (msg) => {
        const event = JSON.parse(msg.data);
        setLastEvent(event);
        setEvents((prev) => [normalizeWsEvent(event), ...prev].slice(0, 100));
      };
    } catch {}
    return () => socket && socket.close();
  }, []);

  const activeMappings = mappings.filter((m) => Number(m.is_active) === 1);
  const isAdmin = String(authUser?.role || '').toLowerCase() === 'admin' || String(authUser?.username || '').toLowerCase() === 'admin@admin.com';
  const visibleTabs = tabs.filter((t) => isAdmin || !['users', 'leads'].includes(t.key));

  useEffect(() => {
    if (!isAdmin && ['users', 'leads'].includes(active)) {
      setActive('overview');
    }
  }, [isAdmin, active]);

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    setToken('');
    setAuthUser(null);
  }

  if (authLoading) {
    return <div className="loginShell"><div className="loginCard glassCard"><div className="brandGlyph logoGlyph"><img src="/ks-logo.png" alt="K&S logo" /></div><h1>Loading secure studio…</h1></div></div>;
  }

  if (!authUser && !leadAccess) {
    return <LandingPage textConfig={textConfig} onLogin={setAuthUser} onAccess={() => { localStorage.setItem('knobs_lead_access', '1'); setLeadAccess(true); }} />;
  }

  if (!authUser) {
    return <LoginScreen textConfig={textConfig} onLogin={setAuthUser} onBack={() => { localStorage.removeItem('knobs_lead_access'); setLeadAccess(false); }} />;
  }

  return (
    <div className={menuCollapsed ? "studioShell menuCollapsed" : "studioShell"}>
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandGlyph logoGlyph"><img src="/ks-logo.png" alt="K&S logo" /></div>
          <div className="brandText">
            <h1>Knobs & Slides</h1>
            <p>Studio {meta.version}</p>
          </div>
          <button
            className="menuToggle"
            onClick={() => setMenuCollapsed(!menuCollapsed)}
            title={menuCollapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={menuCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <nav className="navList">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => setActive(t.key)} title={t.label} aria-label={t.label}>
                <Icon size={18} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebarCard">
          <span className="eyebrow">Live</span>
          <strong>{activeMappings.length} mappings · {devices.filter(d => d.paired_status === 'paired').length} paired</strong>
          <InfoTip text="Each paired active knob can control a different mapped application parameter." />
        </div>
        <div className="sidebarFooter">
          <span>v{VERSION}</span>
          <span>TrugenGS (C) 2026</span>
        </div>
      </aside>

      <main className="mainStage">
        <header className="topbar">
          <div>
            <span className="eyebrow">Investor Demo</span>
            <h2>{visibleTabs.find((t) => t.key === active)?.label || 'Overview'} <InfoTip text={`${meta.release}. Same FastAPI backend with simulated Bluetooth input.`} /></h2>
          </div>
          <div className="topActions">
            <button className="iconButton" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <SunMedium size={18} />}
            </button>
            <span className="userBadge"><Lock size={14} />{authUser.username}</span>
            <button className="iconButton" onClick={logout} title="Logout"><LogOut size={18} /></button>
            <button className="refreshButton" onClick={refresh}><RefreshCw size={16} />Refresh</button>
          </div>
        </header>

        {error && <div className="errorBox">{error}</div>}

        <StudioErrorBoundary resetKey={active}>
          {active === 'overview' && <Overview devices={devices} applications={applications} controls={controls} mappings={activeMappings} lastEvent={lastEvent} />}
          {active === 'simulator' && <MultiSimulator devices={devices} mappings={activeMappings} onEvent={setLastEvent} refresh={refresh} />}
          {active === 'devices' && <KnobMaintenance devices={devices} mappings={mappings} refresh={refresh} />}
          {active === 'profiles' && <Profiles applications={applications} controls={controls} mappings={mappings} />}
          {active === 'mappings' && <Mappings devices={devices} apps={applications} controls={controls} mappings={mappings} refresh={refresh} />}
          {active === 'users' && <UserManagement currentUser={isAdmin ? { ...authUser, role: 'admin' } : authUser} />}
          {active === 'leads' && <LeadManagement currentUser={isAdmin ? { ...authUser, role: 'admin' } : authUser} />}
          {active === 'events' && <Events events={events} />}
          {active === 'settings' && <SettingsPanel meta={meta} devices={devices} mappings={activeMappings} textConfig={textConfig} setTextConfig={setTextConfig} />}
        </StudioErrorBoundary>
      </main>
    </div>
  );
}


function toTextMap(rows) {
  const out = {};
  (Array.isArray(rows) ? rows : []).forEach((r) => { out[r.text_key] = r.text_value; });
  return out;
}

function textValue(map, key, fallback) {
  return map?.[key] ?? fallback;
}

function collectLeadMetadata() {
  const ua = navigator.userAgent || '';
  const now = new Date();
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS|Macintosh/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS/iPadOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const browser = /Edg/i.test(ua) ? 'Microsoft Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'Unknown';
  const device_type = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Mobile/Tablet' : 'Desktop/Laptop';
  return {
    client_date: now.toLocaleDateString(),
    client_time: now.toLocaleTimeString(),
    client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    client_locale: navigator.language || '',
    os,
    device_type,
    browser,
    platform: navigator.platform || '',
    screen_size: `${window.screen?.width || ''}x${window.screen?.height || ''}`,
    region: (navigator.language || '').split('-')[1] || '',
    referrer: document.referrer || '',
    user_agent: ua,
  };
}

function LandingPage({ onAccess, onLogin, textConfig = {} }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', company: '', role_use_case: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  function validateDemoPassword(pwd) {
    return /^[A-Za-z0-9]{6}$/.test((pwd || '').trim());
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const normalizedEmail = form.email.trim().toLowerCase();
    const pwd = form.password.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email ID. This becomes your login user ID.');
      setBusy(false);
      return;
    }
    if (!validateDemoPassword(pwd)) {
      setError('Password must be exactly 6 letters/numbers. Example: aB123x');
      setBusy(false);
      return;
    }
    try {
      const res = await api('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ ...form, email: normalizedEmail, password: pwd, ...collectLeadMetadata() }),
      });
      setToken(res.token);
      if (onLogin) onLogin(res.user);
      else onAccess();
    } catch (err) {
      setError(err.message || 'Could not create demo login. Please check backend/Railway API.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReturningLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const normalizedEmail = loginForm.email.trim().toLowerCase();
    const pwd = loginForm.password.trim();
    if (!normalizedEmail || !pwd) {
      setError('Enter your email ID and password.');
      setBusy(false);
      return;
    }
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: normalizedEmail, password: pwd }),
      });
      setToken(res.token);
      if (onLogin) onLogin(res.user);
      else onAccess();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your email ID and password.');
    } finally {
      setBusy(false);
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setLogin = (key) => (e) => setLoginForm({ ...loginForm, [key]: e.target.value });

  function openDialog(nextMode = 'register') {
    setMode(nextMode);
    setError('');
    setShowAccessDialog(true);
  }

  return (
    <div className="landingShell">
      <header className="landingNav">
        <div className="landingBrand"><img className="landingLogo" src="/ks-logo.png" alt="K&S logo" /><span>{textValue(textConfig, 'landing.brand', 'Knobs & Slides')}</span></div>
        <div className="landingLinks"><a href="#product">Product</a><a href="#workflow">Workflow</a><button className="navDemoButton" onClick={() => openDialog('register')}>{textValue(textConfig, 'landing.access_demo', 'Access Demo')}</button></div>
      </header>

      <section className="heroPremium">
        <div className="heroCopy">
          <span className="eyebrow premiumEyebrow">{textValue(textConfig, 'landing.eyebrow', 'Wireless Creative Control Surface')}</span>
          <h1>{textValue(textConfig, 'landing.tagline', 'Pair, Map, Create')}</h1>
          <p className="heroLead">{textValue(textConfig, 'landing.hero_lead', 'A premium Bluetooth knob and slider software studio for mapping real physical controls to Photoshop, Premiere Pro, Logic Pro, and custom creative workflows.')}</p>
          <div className="prototypeNotice"><Cpu size={16}/><span>{textValue(textConfig, 'landing.hardware_notice', 'Hardware is currently in progress. This demo shows the software control experience using simulated Bluetooth signals.')}</span></div>
          <div className="heroActions"><button className="primaryCta" onClick={() => openDialog('register')}>{textValue(textConfig, 'landing.access_demo', 'Access Demo')}</button><button className="secondaryCta secondaryButtonReset" onClick={() => openDialog('login')}>{textValue(textConfig, 'landing.returning_login', 'Already have access?')}</button><a className="secondaryCta" href="#workflow">{textValue(textConfig, 'landing.see_workflow', 'See how it works')}</a></div>
          <div className="trustStrip"><span><Bluetooth size={15}/> Simulated Bluetooth now</span><span><Cpu size={15}/> Hardware in progress</span><span><SlidersHorizontal size={15}/> Multi-knob mapping</span><span><ShieldCheck size={15}/> Protected demo URL</span></div>
        </div>
        <div className="premiumDeviceMock">
          <div className="deviceGlow"></div>
          <div className="baseStationCard"><RadioTower size={22}/><span>Base Station</span><strong>6 paired knobs</strong></div>
          <div className="landingKnob"><div className="ring"></div><div className="cap"><span>124.455°</span><small>Brightness 34.571%</small></div></div>
          <div className="miniDashboard"><span>Battery 92%</span><span>RGB On</span><span>Touch: Pair</span></div>
        </div>
      </section>

      <section id="product" className="premiumGrid">
        <div className="premiumCard"><Cpu size={22}/><h3>{textValue(textConfig, 'landing.product.card1.title', 'Hardware-aware studio')}</h3><p>{textValue(textConfig, 'landing.product.card1.body', 'The physical knob hardware is currently in progress. This software demo simulates angle, precision, battery, touch events, RGB ring state, and pairing status.')}</p></div>
        <div className="premiumCard"><MousePointerClick size={22}/><h3>{textValue(textConfig, 'landing.product.card2.title', 'Map any control')}</h3><p>{textValue(textConfig, 'landing.product.card2.body', 'Turn 0–360° input into sliders, knobs, percentages, dB, pixels, color temperature, and timeline values.')}</p></div>
        <div className="premiumCard"><Sparkles size={22}/><h3>{textValue(textConfig, 'landing.product.card3.title', 'Built for demos')}</h3><p>{textValue(textConfig, 'landing.product.card3.body', 'Ultra-clean landing page, lead capture, protected simulator, and Railway-ready deployment structure.')}</p></div>
      </section>

      <section id="workflow" className="workflowPremium">
        <h2>{textValue(textConfig, 'landing.workflow.title', 'From physical movement to creative command.')}</h2>
        <div className="workflowSteps"><div><b>01</b><h3>Pair</h3><p>{textValue(textConfig, 'landing.workflow.pair', 'Connect multiple knobs to one base station.')}</p></div><div><b>02</b><h3>Map</h3><p>{textValue(textConfig, 'landing.workflow.map', 'Assign each knob to a software control.')}</p></div><div><b>03</b><h3>Create</h3><p>{textValue(textConfig, 'landing.workflow.create', 'Adjust creative values with tactile precision.')}</p></div></div>
      </section>

      <section id="access" className="accessPanel accessPromptPanel">
        <div><span className="eyebrow">Demo Access</span><h2>Experience the simulator.</h2><p>New visitors can create demo access. Returning visitors can log in using the same email ID and 6-character password they used earlier.</p></div>
        <div className="accessPromptCard">
          <Sparkles size={24} />
          <h3>Ready to enter the studio?</h3>
          <p>Open the secure demo dialog to register or log back in.</p>
          <button className="primaryCta" onClick={() => openDialog('register')}>{textValue(textConfig, 'landing.access_demo', 'Access Demo')}</button>
          <button className="ghostButton" onClick={() => openDialog('login')}>{textValue(textConfig, 'dialog.existing_access', 'Already have access? Login')}</button>
        </div>
      </section>

      <footer className="landingFooter">
        <div>Knobs and Slides Studio <strong>v{VERSION}</strong></div>
        <div>{textValue(textConfig, 'footer.copyright', 'TrugenGS (C) 2026')} · {textValue(textConfig, 'footer.hardware', 'Hardware in progress')}</div>
      </footer>

      {showAccessDialog && (
        <div className="modalOverlay premiumLeadOverlay" role="dialog" aria-modal="true" aria-label="Access demo form">
          <div className="leadDialog">
            <button className="modalClose" onClick={() => setShowAccessDialog(false)} aria-label="Close"><X size={18} /></button>
            <span className="eyebrow">Access Demo</span>
            <h2>{mode === 'register' ? textValue(textConfig, 'dialog.register_title', 'Create demo access.') : textValue(textConfig, 'dialog.login_title', 'Welcome back.')}</h2>
            <p>{mode === 'register' ? textValue(textConfig, 'dialog.register_help', 'Your email becomes your user ID. Choose a simple 6-character password using letters and numbers.') : textValue(textConfig, 'dialog.login_help', 'Log in using the email ID and 6-character password you used when you first accessed the demo.')} Note: the physical hardware is currently in progress; this simulator uses software-generated Bluetooth values.</p>

            <div className="dialogTabs">
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>{textValue(textConfig, 'dialog.new_access', 'New Demo Access')}</button>
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>{textValue(textConfig, 'dialog.existing_access', 'Already have access? Login')}</button>
            </div>

            {mode === 'register' ? (
              <form className="leadForm dialogLeadForm" onSubmit={submit}>
                <input required placeholder="Name" value={form.full_name} onChange={set('full_name')} />
                <input required type="email" placeholder="Email / User ID" value={form.email} onChange={set('email')} />
                <input required type="password" minLength="6" maxLength="6" pattern="[A-Za-z0-9]{6}" placeholder="6-char password: letters + numbers" value={form.password} onChange={set('password')} />
                <input placeholder="Phone" value={form.phone} onChange={set('phone')} />
                <input placeholder="Company" value={form.company} onChange={set('company')} />
                <textarea placeholder="Role / use case" value={form.role_use_case} onChange={set('role_use_case')} />
                {error && <div className="errorBox">{error}</div>}
                <button className="primaryCta" type="submit" disabled={busy}>{busy ? 'Creating login…' : textValue(textConfig, 'dialog.submit_register', 'Access Simulator')}</button>
              </form>
            ) : (
              <form className="leadForm dialogLeadForm" onSubmit={submitReturningLogin}>
                <input required type="email" placeholder="Email / User ID" value={loginForm.email} onChange={setLogin('email')} />
                <input required type="password" minLength="6" maxLength="6" placeholder="6-char password" value={loginForm.password} onChange={setLogin('password')} />
                {error && <div className="errorBox">{error}</div>}
                <button className="primaryCta" type="submit" disabled={busy}>{busy ? 'Signing in…' : textValue(textConfig, 'dialog.submit_login', 'Login & Open Simulator')}</button>
                <button type="button" className="ghostButton" onClick={() => { setMode('register'); setError(''); }}>Need access? Create demo login</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin, onBack, textConfig = {} }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(res.token);
      onLogin(res.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginShell">
      <form className="loginCard glassCard" onSubmit={submit}>
        <div className="brandGlyph logoGlyph loginLogoGlyph"><img src="/ks-logo.png" alt="K&S logo" /></div>
        <span className="eyebrow">Protected Studio URL</span>
        <h1>{textValue(textConfig, 'login.title', 'Knobs & Slides Studio')}</h1>
        <p>{textValue(textConfig, 'login.subtitle', 'Sign in to access the simulator, mappings, maintenance, and Railway demo URL.')}</p>
        {onBack && <button type="button" className="ghostButton" onClick={onBack}>Back to landing page</button>}
        <label>Email / Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="Email or admin email" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" /></label>
        {error && <div className="errorBox">{error}</div>}
        <button className="loginButton" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function normalizeDbEvent(e) {
  return {
    device_id: e.device_id,
    relative_position: e.relative_position,
    mapped_value: e.mapped_value,
    application: e.application_name,
    control: e.control_name,
    unit: e.output_unit,
    display_value: `${formatNumber(e.mapped_value)}${e.output_unit ?? ''}`,
    created_at: e.created_at,
  };
}

function normalizeWsEvent(event) {
  return {
    id: Date.now() + Math.random(),
    device_id: event.device_id,
    relative_position: event.relative_position,
    mapped_value: event.mapped_value,
    application_name: event.application,
    control_name: event.control,
    output_unit: event.unit,
    created_at: event.created_at,
  };
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function Overview({ devices, applications, controls, mappings, lastEvent }) {
  const position = Number(lastEvent?.relative_position || 0);
  const mappedPercent = Math.min(100, Math.max(0, (position / 360) * 100));

  return (
    <section className="overviewGrid">
      <div className="heroPanel glassCard">
        <div className="heroCopy">
          <span className="pill"><Sparkles size={15} /> Apple-like control studio <InfoTip text="Each simulated Bluetooth device sends a 0.000°–360.000° position and is independently mapped to Photoshop, Premiere Pro, Logic Pro, or custom app controls." /></span>
          <h3>Many knobs. Many controls.</h3>
          <div className="heroStats">
            <Metric value={devices.length} label="Devices" />
            <Metric value={applications.length} label="Profiles" />
            <Metric value={mappings.length} label="Active mappings" />
          </div>
        </div>
        <div className="liveDeviceCard">
          <CircularKnob value={position} size={245} />
          <div className="liveReadout">
            <span>{lastEvent?.device_id || 'Waiting'}</span>
            <strong>{formatNumber(position)}°</strong>
            <small>{lastEvent ? `${lastEvent.application} → ${lastEvent.control}` : 'Send from any simulated knob'}</small>
          </div>
        </div>
      </div>

      <div className="glassCard outputPanel">
        <span className="eyebrow">Latest Mapped Output</span>
        <div className="outputValue">{lastEvent?.display_value || '—'}</div>
        <p>{lastEvent ? `${lastEvent.device_id}: ${lastEvent.control}` : 'Awaiting input'} <InfoTip text={lastEvent ? `Application: ${lastEvent.application}` : 'Open the simulator and move any paired knob.'} /></p>
        <div className="progressTrack"><span style={{ width: `${mappedPercent}%` }} /></div>
      </div>

      <div className="glassCard pipelinePanel">
        <span className="eyebrow">Signal Flow</span>
        <div className="pipeline">
          <FlowStep icon={Bluetooth} title="Many Simulated Devices" subtitle="KNOB_001...KNOB_006" />
          <ChevronRight size={18} />
          <FlowStep icon={Cpu} title="Per-Device Mapping" subtitle="one active control per knob" />
          <ChevronRight size={18} />
          <FlowStep icon={Monitor} title="Creative App Value" subtitle="brightness, timeline, volume" />
        </div>
      </div>

      <div className="glassCard mappingPanel">
        <span className="eyebrow">Active Multi-Knob Layout</span>
        <div className="mappingCards">
          {mappings.map((m) => <MappingCard key={m.id} mapping={m} compact />)}
          {!mappings.length && <p className="muted">No active mappings yet.</p>}
        </div>
      </div>
    </section>
  );
}


function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="infoTipWrap" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="infoTipButton" title={text} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} aria-label="More information"><Info size={13} /></button>
      {open && <span className="infoTipBubble">{text}</span>}
    </span>
  );
}


function SectionHeader({ eyebrow, title, text }) {
  return (
    <div className="sectionHeader">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h3>{title}</h3>}
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

function Metric({ value, label }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function FlowStep({ icon: Icon, title, subtitle }) {
  return <div className="flowStep"><Icon size={20} /><strong>{title}</strong><span>{subtitle}</span></div>;
}

function CircularKnob({ value = 0, size = 220, interactive = false, onChange }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, Number(value) / 360));
  const dash = circumference * pct;
  const rotation = Number(value) || 0;

  function handlePointer(e) {
    if (!interactive || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
    const normalized = angle < 0 ? angle + 360 : angle;
    onChange(Number(normalized.toFixed(3)));
  }

  return (
    <div className={interactive ? 'knobSurface interactive' : 'knobSurface'} style={{ width: size, height: size }} onPointerDown={handlePointer} onPointerMove={(e) => e.buttons === 1 && handlePointer(e)}>
      <svg viewBox="0 0 120 120">
        <defs><filter id="softShadow"><feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity="0.18" /></filter></defs>
        <circle className="knobBase" cx="60" cy="60" r="48" filter="url(#softShadow)" />
        <circle className="knobTrack" cx="60" cy="60" r={radius} pathLength={circumference} />
        <circle className="knobArc" cx="60" cy="60" r={radius} strokeDasharray={`${dash} ${circumference - dash}`} />
        <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '60px 60px' }}><line className="knobPointer" x1="60" y1="20" x2="60" y2="37" /></g>
        <circle className="knobCenter" cx="60" cy="60" r="29" />
        <text x="60" y="58" textAnchor="middle" className="knobText">{formatNumber(value)}</text>
        <text x="60" y="73" textAnchor="middle" className="knobSubText">degrees</text>
      </svg>
    </div>
  );
}

function MultiSimulator({ devices, mappings, onEvent, refresh }) {
  const visibleDevices = useMemo(
    () => devices.filter((d) => d.status === 'active' && d.paired_status === 'paired'),
    [devices]
  );
  const initialPositions = useMemo(
    () => Object.fromEntries(visibleDevices.map((d, i) => [d.device_id, Number(((i + 1) * 41.25).toFixed(3))])),
    [visibleDevices]
  );
  const [positions, setPositions] = useState({});
  const [results, setResults] = useState({});
  const [touchEvents, setTouchEvents] = useState({});
  const [rgbStates, setRgbStates] = useState({});
  const [batteryLevels, setBatteryLevels] = useState({});

  useEffect(() => {
    setPositions((prev) => ({ ...initialPositions, ...prev }));
    setRgbStates((prev) => ({ ...Object.fromEntries(visibleDevices.map((d) => [d.device_id, true])), ...prev }));
    setBatteryLevels((prev) => ({
      ...Object.fromEntries(visibleDevices.map((d, i) => [d.device_id, Math.max(42, 96 - i * 7)])),
      ...prev,
    }));
  }, [initialPositions, visibleDevices]);

  function mappingFor(deviceId) {
    return mappings.find((m) => m.device_id === deviceId);
  }

  async function transmit(deviceId, relative_position) {
    try {
      const event = await api('/api/simulate-input', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId, relative_position: Number(relative_position) }),
      });
      setResults((prev) => ({ ...prev, [deviceId]: event }));
      onEvent(event);
    } catch (e) {
      setResults((prev) => ({ ...prev, [deviceId]: { display_value: e.message } }));
    }
  }

  function updatePosition(deviceId, value) {
    const nextValue = Number(Number(value).toFixed(3));
    setPositions((prev) => ({ ...prev, [deviceId]: nextValue }));
    markTouch(deviceId, 'Knob surface');
    window.clearTimeout(updatePosition.timers?.[deviceId]);
    updatePosition.timers = updatePosition.timers || {};
    updatePosition.timers[deviceId] = window.setTimeout(() => transmit(deviceId, nextValue), 120);
  }

  function markTouch(deviceId, label) {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTouchEvents((prev) => ({ ...prev, [deviceId]: `${label} · ${stamp}` }));
  }

  async function simulatorDeviceAction(deviceId, endpoint) {
    try {
      markTouch(deviceId, endpoint === 'unpair' ? 'Unpair touch' : 'Power touch');
      await api(`/api/devices/${encodeURIComponent(deviceId)}/${endpoint}`, { method: 'POST' });
      if (refresh) await refresh();
    } catch (e) {
      setResults((prev) => ({ ...prev, [deviceId]: { display_value: e.message } }));
    }
  }

  function toggleRgb(deviceId) {
    setRgbStates((prev) => ({ ...prev, [deviceId]: !prev[deviceId] }));
    markTouch(deviceId, 'RGB touch');
  }

  return (
    <section className="studioConsolePage">
      <div className="glassCard studioConsoleHeader">
        <div>
          <span className="eyebrow">Studio Console <InfoTip text="Only active paired knobs are shown. Move a knob to see the mapped application result as a live visual meter." /></span>
          <h3>Live paired knobs</h3>
          <div className="hardwareProgressBadge"><Cpu size={15}/> Hardware status: In progress</div>
        </div>
        <div className="pairedCountBadge"><Bluetooth size={16} />{visibleDevices.length} paired live</div>
      </div>

      {visibleDevices.length === 0 ? (
        <div className="glassCard emptyStudioState">
          <Bluetooth size={32} />
          <h3>No live knobs</h3>
          <InfoTip text="Go to Knob Maintenance, set a device to active, and mark Bluetooth status as paired." />
        </div>
      ) : (
        <div className="studioRack">
          {visibleDevices.map((device) => {
            const pos = Number(positions[device.device_id] ?? 0);
            const mapping = mappingFor(device.device_id);
            const result = results[device.device_id];
            return (
              <div className="glassCard studioChannel" key={device.device_id}>
                <VisualResultPanel
                  device={device}
                  mapping={mapping}
                  position={pos}
                  result={result}
                  batteryLevel={batteryLevels[device.device_id] ?? 88}
                  touchEvent={touchEvents[device.device_id] || 'Idle'}
                  rgbOn={rgbStates[device.device_id] !== false}
                  baseCount={visibleDevices.length}
                />

                <div className="studioKnobDock">
                  <div className="simulatorTouchControls three">
                    <button className="touchButton pairedTouch" onClick={() => simulatorDeviceAction(device.device_id, 'unpair')} title="Unpair this simulated Bluetooth knob">
                      <Bluetooth size={14} /> Pair
                    </button>
                    <button className="touchButton rgbTouch" onClick={() => toggleRgb(device.device_id)} title="Toggle RGB ring state">
                      <Zap size={14} /> RGB
                    </button>
                    <button className="touchButton powerTouch" onClick={() => simulatorDeviceAction(device.device_id, 'deactivate')} title="Switch off this simulated knob">
                      <Power size={14} /> Off
                    </button>
                  </div>
                  <CircularKnob value={pos} size={220} interactive onChange={(v) => updatePosition(device.device_id, v)} />
                  <input className="cleanRange studioRange" type="range" min="0" max="360" step="0.001" value={pos} onChange={(e) => updatePosition(device.device_id, e.target.value)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function previewDisplay(position, mapping) {
  if (!mapping) return '—';
  const ratio = position / 360;
  let value = Number(mapping.output_min) + ratio * (Number(mapping.output_max) - Number(mapping.output_min));
  if (mapping.mapping_type === 'inverted') value = Number(mapping.output_max) - ratio * (Number(mapping.output_max) - Number(mapping.output_min));
  return `${Number(value).toFixed(mapping.precision ?? 3)}${mapping.output_unit || ''}`;
}

function mappedValue(position, mapping, result) {
  if (result?.mapped_value !== undefined && result?.mapped_value !== null && !Number.isNaN(Number(result.mapped_value))) {
    return Number(result.mapped_value);
  }
  if (!mapping) return null;
  const ratio = Number(position) / 360;
  let value = Number(mapping.output_min) + ratio * (Number(mapping.output_max) - Number(mapping.output_min));
  if (mapping.mapping_type === 'inverted') value = Number(mapping.output_max) - ratio * (Number(mapping.output_max) - Number(mapping.output_min));
  return value;
}

function VisualResultPanel({ device, mapping, position, result, batteryLevel = 88, touchEvent = 'Idle', rgbOn = true, baseCount = 1 }) {
  const numericValue = mappedValue(position, mapping, result);
  const outputMin = mapping ? Number(mapping.output_min) : 0;
  const outputMax = mapping ? Number(mapping.output_max) : 100;
  const range = outputMax - outputMin || 1;
  const percent = numericValue === null ? 0 : Math.max(0, Math.min(100, ((numericValue - outputMin) / range) * 100));
  const display = result?.display_value || previewDisplay(position, mapping);
  const appName = mapping?.app_name || 'No application';
  const controlName = mapping?.control_name || 'No active mapping';
  const unit = mapping?.output_unit || '';
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="studioResultPanel visualResultPanel">
      <div className="channelIdentity">
        <strong>{device.device_id}</strong>
        <span>{device.device_name}</span>
      </div>

      <div className="hardwareStatusGrid">
        <HardwareStatusTile icon={Gauge} label="Angle" value={`${Number(position).toFixed(3)}°`} tip="Real-time knob angle from the simulated Bluetooth stream." />
        <HardwareStatusTile icon={Cpu} label="Precision" value="0.001°" tip="3-decimal precision is maintained from input to mapped output preview." />
        <HardwareStatusTile icon={Zap} label="Battery" value={`${batteryLevel}%`} tip="Simulated battery status for the hardware knob." />
        <HardwareStatusTile icon={Power} label="Touch" value={touchEvent} tip="Last capacitive touch or knob-surface event detected in the simulator." />
        <HardwareStatusTile icon={Sparkles} label="RGB Ring" value={rgbOn ? 'On' : 'Off'} tip="Simulated RGB ring light state for the knob base." active={rgbOn} />
        <HardwareStatusTile icon={RadioTower} label="Base" value={`${baseCount} linked`} tip="Multiple knobs are paired to one simulated base station." />
      </div>

      <div className="visualStage">
        <div className="visualGauge" style={{ '--meter': `${percent}%`, '--needle': `${-90 + percent * 1.8}deg` }}>
          <div className="visualGaugeFill" />
          <div className="visualGaugeNeedle" />
          <div className="visualGaugeReadout contrastReadout">
            <strong>{display}</strong>
            <span>{unit || 'mapped output'}</span>
          </div>
        </div>

        <div className="visualTargetCard">
          <span>{appName} <InfoTip text={`Target application for ${device.device_id}`} /></span>
          <strong>{controlName}</strong>
          <small className="contrastInputValue">{formatNumber(position)}°</small>
        </div>
      </div>

      <div className="meterStrip">
        <div className="meterTrack">
          <div className="meterFill" style={{ width: `${percent}%` }} />
          <div className="meterThumb" style={{ left: `${percent}%` }} />
        </div>
        <div className="meterTicks">
          {ticks.map((t) => <span key={t}>{t}%</span>)}
        </div>
      </div>

      <div className="channelMeta">
        <small>{mapping ? mapping.mapping_type : 'mapping'} <InfoTip text={mapping ? `0°–360° maps to ${mapping.output_min}–${mapping.output_max}${mapping.output_unit || ''}` : 'Create a mapping for this device.'} /></small>
        <small className="pairPill paired">paired</small>
      </div>
    </div>
  );
}


function HardwareStatusTile({ icon: Icon, label, value, tip, active = true }) {
  return (
    <div className={active ? 'hardwareStatusTile active' : 'hardwareStatusTile'}>
      <span className="hardwareTileIcon"><Icon size={14} /></span>
      <span className="hardwareTileLabel">{label} <InfoTip text={tip} /></span>
      <strong>{value}</strong>
    </div>
  );
}

function KnobMaintenance({ devices, mappings, refresh }) {
  const [deviceId, setDeviceId] = useState('KNOB_007');
  const [deviceName, setDeviceName] = useState('New Precision Knob');
  const [deviceType, setDeviceType] = useState('knob');
  const [pairedStatus, setPairedStatus] = useState('paired');
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const totals = {
    active: devices.filter((d) => d.status === 'active').length,
    inactive: devices.filter((d) => d.status !== 'active').length,
    paired: devices.filter((d) => d.paired_status === 'paired').length,
    unpaired: devices.filter((d) => d.paired_status !== 'paired').length,
  };

  function mappingFor(deviceId) {
    return mappings.find((m) => m.device_id === deviceId && Number(m.is_active) === 1);
  }

  function openEditor(device) {
    setEditing({
      device_id: device.device_id,
      device_name: device.device_name,
      device_type: device.device_type,
      status: device.status,
      paired_status: device.paired_status || 'unpaired',
    });
  }

  async function addDevice() {
    try {
      await api('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId.trim().toUpperCase(),
          device_name: deviceName.trim(),
          device_type: deviceType,
          paired_status: pairedStatus,
          status: 'active',
        }),
      });
      setMsg(`${deviceId.toUpperCase()} added to maintenance inventory.`);
      await refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function updateDevice(id, changes) {
    try {
      await api(`/api/devices/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
      setMsg(`${id} updated.`);
      setEditing(null);
      await refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function action(id, endpoint, label, closeEditor = false) {
    try {
      await api(`/api/devices/${encodeURIComponent(id)}/${endpoint}`, { method: 'POST' });
      setMsg(`${id} ${label}.`);
      if (closeEditor) setEditing(null);
      await refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteDevice(id, closeEditor = false) {
    const ok = window.confirm(`Delete ${id}? This will also remove its mappings and event history.`);
    if (!ok) return;
    try {
      await api(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setMsg(`${id} deleted.`);
      if (closeEditor) setEditing(null);
      await refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <section className="maintenancePage">
      <div className="glassCard maintenanceHero">
        <div>
          <span className="eyebrow"><Bluetooth size={14} /> Knobs <InfoTip text="Click a row to edit. Use icons for activate/deactivate, pair/unpair, and delete." /></span>
          <h3>Device list</h3>
        </div>
        <div className="maintenanceStats">
          <Metric value={totals.active} label="Active" />
          <Metric value={totals.paired} label="Bluetooth paired" />
          <Metric value={totals.unpaired} label="Not paired" />
        </div>
      </div>

      <div className="maintenanceGrid">
        <div className="glassCard mappingComposer">
          <span className="eyebrow"><Plus size={14} /> Add <InfoTip text="Register a simulated knob or slider and set its Bluetooth pairing state." /></span>
          <h3>New device</h3>
          <div className="controlGrid single">
            <label><span>Device ID</span><input value={deviceId} onChange={(e) => setDeviceId(e.target.value.toUpperCase())} placeholder="KNOB_007" /></label>
            <label><span>Display Name</span><input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Color Knob" /></label>
            <label><span>Device Type</span><select value={deviceType} onChange={(e) => setDeviceType(e.target.value)}><option value="knob">Knob</option><option value="slider">Slider</option></select></label>
            <label><span>Bluetooth Pairing</span><select value={pairedStatus} onChange={(e) => setPairedStatus(e.target.value)}><option value="paired">Paired</option><option value="unpaired">Unpaired</option><option value="pairing">Pairing</option></select></label>
          </div>
          <button className="primaryButton full" onClick={addDevice}><CheckCircle2 size={16} />Add to Maintenance</button>
          {msg && <p className="successMsg">{msg}</p>}
        </div>

        <div className="glassCard maintenanceTableCard">
          <div className="maintenanceTableHeader">
            <div>Device</div>
            <div>Mapping</div>
            <div>Status</div>
            <div>Bluetooth</div>
            <div>Actions</div>
          </div>

          <div className="maintenanceRows">
            {devices.map((d) => {
              const activeMapping = mappingFor(d.device_id);
              return (
                <button className="maintenanceRow" key={d.device_id} onClick={() => openEditor(d)} title="Click to edit this knob">
                  <div className="deviceCell">
                    <strong>{d.device_id}</strong>
                    <span>{d.device_name} · {d.device_type}</span>
                  </div>
                  <div className="mappingCell">{activeMapping ? `${activeMapping.app_name} → ${activeMapping.control_name}` : 'Not mapped'}</div>
                  <div><small className={d.status === 'active' ? 'statusPill active' : 'statusPill inactive'}>{d.status}</small></div>
                  <div><small className={`pairPill ${d.paired_status || 'unpaired'}`}>{d.paired_status || 'unpaired'}</small></div>
                  <div className="rowIconActions" onClick={(e) => e.stopPropagation()}>
                    <button className="miniIconButton" title="Edit" onClick={() => openEditor(d)}><Edit3 size={15} /></button>
                    {d.status === 'active'
                      ? <button className="miniIconButton" title="Deactivate" onClick={() => action(d.device_id, 'deactivate', 'deactivated')}><PauseCircle size={15} /></button>
                      : <button className="miniIconButton" title="Activate" onClick={() => action(d.device_id, 'activate', 'activated')}><Power size={15} /></button>}
                    {d.paired_status === 'paired'
                      ? <button className="miniIconButton" title="Unpair" onClick={() => action(d.device_id, 'unpair', 'unpaired')}><Unlink2 size={15} /></button>
                      : <button className="miniIconButton" title="Pair" onClick={() => action(d.device_id, 'pair', 'paired')}><Link2 size={15} /></button>}
                    <button className="miniIconButton dangerMini" title="Delete" onClick={() => deleteDevice(d.device_id)}><Trash2 size={15} /></button>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {editing && (
        <div className="maintenanceEditorOverlay" onClick={() => setEditing(null)}>
          <div className="glassCard maintenanceEditorSheet" onClick={(e) => e.stopPropagation()}>
            <div className="editorSheetHeader">
              <div>
                <span className="eyebrow"><Edit3 size={14} /> Edit <InfoTip text="Update the knob identity, availability, and simulated Bluetooth state." /></span>
                <h3>{editing.device_id}</h3>
              </div>
              <div className="editorIconActions">
                {editing.status === 'active'
                  ? <button className="miniIconButton" title="Deactivate" onClick={() => action(editing.device_id, 'deactivate', 'deactivated', true)}><PauseCircle size={16} /></button>
                  : <button className="miniIconButton" title="Activate" onClick={() => action(editing.device_id, 'activate', 'activated', true)}><Power size={16} /></button>}
                {editing.paired_status === 'paired'
                  ? <button className="miniIconButton" title="Unpair" onClick={() => action(editing.device_id, 'unpair', 'unpaired', true)}><Unlink2 size={16} /></button>
                  : <button className="miniIconButton" title="Pair" onClick={() => action(editing.device_id, 'pair', 'paired', true)}><Link2 size={16} /></button>}
                <button className="miniIconButton dangerMini" title="Delete" onClick={() => deleteDevice(editing.device_id, true)}><Trash2 size={16} /></button>
                <button className="miniIconButton" title="Close" onClick={() => setEditing(null)}>×</button>
              </div>
            </div>

            <div className="inlineEditor editorGrid">
              <label><span>Name</span><input value={editing.device_name} onChange={(e) => setEditing({ ...editing, device_name: e.target.value })} /></label>
              <label><span>Type</span><select value={editing.device_type} onChange={(e) => setEditing({ ...editing, device_type: e.target.value })}><option value="knob">Knob</option><option value="slider">Slider</option></select></label>
              <label><span>Status</span><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              <label><span>Bluetooth</span><select value={editing.paired_status} onChange={(e) => setEditing({ ...editing, paired_status: e.target.value })}><option value="paired">Paired</option><option value="unpaired">Unpaired</option><option value="pairing">Pairing</option></select></label>
            </div>

            <div className="buttonRow compactButtons editorSaveRow">
              <button className="primaryButton" onClick={() => updateDevice(editing.device_id, editing)}>Save Changes</button>
              <button className="secondaryButton" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Profiles({ applications, controls, mappings }) {
  return (
    <section className="profilesGrid">
      {applications.map((app) => {
        const appControls = controls.filter((c) => c.application_id === app.id);
        const appMappings = mappings.filter((m) => m.application_id === app.id || m.app_name === app.app_name);
        return (
          <div className="profileTile glassCard" key={app.id}>
            <div className="appIcon"><AppWindow size={24} /></div>
            <h3>{app.app_name}</h3>
            <p>{app.description || 'Application control profile'}</p>
            <div className="tileStats"><span>{appControls.length} controls</span><span>{appMappings.length} mapped</span></div>
            <div className="controlChips">
              {appControls.slice(0, 18).map((c) => <span key={c.id}>{c.control_name}</span>)}
              {appControls.length > 18 && <span className="moreChip">+{appControls.length - 18} more</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Mappings({ devices, apps, controls, mappings, refresh }) {
  const [deviceId, setDeviceId] = useState('KNOB_001');
  const [appId, setAppId] = useState('');
  const appControls = useMemo(() => controls.filter((c) => String(c.application_id) === String(appId)).sort((a,b)=>a.control_name.localeCompare(b.control_name)), [controls, appId]);
  const [controlId, setControlId] = useState('');
  const selectedControl = controls.find((c) => String(c.id) === String(controlId));
  const [mappingType, setMappingType] = useState('linear');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => { if (devices[0] && !devices.find((d) => d.device_id === deviceId)) setDeviceId(devices[0].device_id); }, [devices]);
  useEffect(() => { if (apps[0] && !appId) setAppId(apps[0].id); }, [apps, appId]);
  useEffect(() => { if (appControls[0]) setControlId(appControls[0].id); }, [appId, appControls.length]);

  const mappedDeviceIds = new Set(mappings.filter((m) => Number(m.is_active) === 1).map((m) => m.device_id));

  async function save() {
    if (!selectedControl) return;
    await api('/api/mappings', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        application_id: Number(appId),
        control_id: Number(controlId),
        input_min: 0,
        input_max: 360,
        output_min: selectedControl.output_min,
        output_max: selectedControl.output_max,
        mapping_type: mappingType,
        is_active: 1,
      }),
    });
    setMsg(`${deviceId} now controls ${selectedControl.control_name}.`);
    refresh();
  }

  function openMappingEditor(mapping) {
    setEditing({
      ...mapping,
      device_id: mapping.device_id,
      application_id: String(mapping.application_id),
      control_id: String(mapping.control_id),
      mapping_type: mapping.mapping_type || 'linear',
      is_active: Number(mapping.is_active) === 1 ? 1 : 0,
    });
  }

  const editingControls = editing
    ? controls.filter((c) => String(c.application_id) === String(editing.application_id)).sort((a,b)=>a.control_name.localeCompare(b.control_name))
    : [];
  const editingControl = editing ? controls.find((c) => String(c.id) === String(editing.control_id)) : null;

  function changeEditingApp(nextAppId) {
    const nextControls = controls.filter((c) => String(c.application_id) === String(nextAppId)).sort((a,b)=>a.control_name.localeCompare(b.control_name));
    const first = nextControls[0];
    setEditing({
      ...editing,
      application_id: String(nextAppId),
      control_id: first ? String(first.id) : '',
      output_min: first ? first.output_min : editing.output_min,
      output_max: first ? first.output_max : editing.output_max,
    });
  }

  function changeEditingControl(nextControlId) {
    const c = controls.find((item) => String(item.id) === String(nextControlId));
    setEditing({
      ...editing,
      control_id: String(nextControlId),
      output_min: c ? c.output_min : editing.output_min,
      output_max: c ? c.output_max : editing.output_max,
    });
  }

  async function updateMapping() {
    if (!editing || !editingControl) return;
    await api(`/api/mappings/${editing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        device_id: editing.device_id,
        application_id: Number(editing.application_id),
        control_id: Number(editing.control_id),
        input_min: Number(editing.input_min ?? 0),
        input_max: Number(editing.input_max ?? 360),
        output_min: Number(editing.output_min ?? editingControl.output_min),
        output_max: Number(editing.output_max ?? editingControl.output_max),
        mapping_type: editing.mapping_type,
        is_active: Number(editing.is_active),
      }),
    });
    setMsg(`${editing.device_id} mapping updated to ${editingControl.control_name}.`);
    setEditing(null);
    refresh();
  }

  return (
    <section className="mappingStudioGrid">
      <div className="glassCard mappingComposer">
        <span className="eyebrow"><Plus size={14} /> Mapping <InfoTip text="Assign each knob to one active control. Saving a new mapping changes only the selected device. Click existing rows to edit." /></span>
        <h3>Assign control</h3>
        <div className="controlGrid single">
          <label><span>Device</span><select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>{devices.map((d) => <option key={d.device_id}>{d.device_id}{mappedDeviceIds.has(d.device_id) ? ' · mapped' : ' · unmapped'}</option>)}</select></label>
          <label><span>Application</span><select value={appId} onChange={(e) => setAppId(e.target.value)}>{apps.map((a) => <option value={a.id} key={a.id}>{a.app_name}</option>)}</select></label>
          <label><span>Control <InfoTip text="The app parameter this knob will control." /></span><select value={controlId} onChange={(e) => setControlId(e.target.value)}>{appControls.map((c) => <option value={c.id} key={c.id}>{c.control_name}</option>)}</select></label>
          <label><span>Type <InfoTip text="Linear follows the knob direction. Inverted reverses it. Stepped is for fixed increments." /></span><select value={mappingType} onChange={(e) => setMappingType(e.target.value)}><option value="linear">Linear</option><option value="inverted">Inverted</option><option value="stepped">Stepped</option></select></label>
        </div>
        <button className="primaryButton full" onClick={save}><CheckCircle2 size={16} />Save</button>
        {msg && <p className="successMsg">{msg}</p>}
      </div>

      <div className="mappingCardsColumn">
        <div className="glassCard maintenanceTableCard mappingMaintenanceCard">
          <div className="mappingMaintenanceHeader">
            <div>Device</div>
            <div>Application</div>
            <div>Control</div>
            <div>Range</div>
            <div>Actions</div>
          </div>
          <div className="maintenanceRows">
            {mappings.map((m) => (
              <button className="mappingMaintenanceRow" key={m.id} onClick={() => openMappingEditor(m)} title="Click to edit this mapping">
                <div className="deviceCell"><strong>{m.device_id}</strong><span>{Number(m.is_active) === 1 ? 'Active' : 'Saved'} <InfoTip text={Number(m.is_active) === 1 ? 'This mapping is currently active for the device.' : 'This mapping is saved but inactive.'} /></span></div>
                <div className="mappingCell"><strong>{m.app_name}</strong><span>{m.mapping_type} <InfoTip text="Mapping behavior between 0°–360° input and output range." /></span></div>
                <div className="mappingCell"><strong>{m.control_name}</strong><span>{m.control_type || 'control'}</span></div>
                <div className="mappingCell"><strong>{m.output_min}–{m.output_max}{m.output_unit}</strong><span><InfoTip text="Input range is always 0°–360° from the simulated Bluetooth knob." /></span></div>
                <div className="rowIconActions" onClick={(e) => e.stopPropagation()}>
                  <button className="miniIconButton" title="Edit mapping" onClick={() => openMappingEditor(m)}><Edit3 size={15} /></button>
                  <button className="miniIconButton" title="Open mapping" onClick={() => openMappingEditor(m)}><ChevronRight size={15} /></button>
                </div>
              </button>
            ))}
            {!mappings.length && <p className="muted emptyMappingNote">No mappings configured yet. Create the first active mapping from the panel on the left.</p>}
          </div>
        </div>

        <div className="mappingMatrix glassCard">
          <span className="eyebrow">Device Control Matrix</span>
          {devices.map((d) => {
            const active = mappings.find((m) => m.device_id === d.device_id && Number(m.is_active) === 1);
            return <div className="matrixRow" key={d.device_id}><strong>{d.device_id}</strong><span>{active ? `${active.app_name} → ${active.control_name}` : 'Not configured'}</span></div>;
          })}
        </div>
      </div>

      {editing && (
        <div className="maintenanceEditorOverlay" onClick={() => setEditing(null)}>
          <div className="glassCard maintenanceEditorSheet mappingEditorSheet" onClick={(e) => e.stopPropagation()}>
            <div className="editorSheetHeader">
              <div>
                <span className="eyebrow"><Edit3 size={14} /> Edit Mapping <InfoTip text="Change the device, target application, control, output range, and mapping behavior." /></span>
                <h3>{editing.device_id}</h3>
              </div>
              <div className="editorIconActions">
                <button className="miniIconButton" title="Close" onClick={() => setEditing(null)}>×</button>
              </div>
            </div>

            <div className="inlineEditor editorGrid mappingEditorGrid">
              <label><span>Device</span><select value={editing.device_id} onChange={(e) => setEditing({ ...editing, device_id: e.target.value })}>{devices.map((d) => <option value={d.device_id} key={d.device_id}>{d.device_id} · {d.device_name}</option>)}</select></label>
              <label><span>Application</span><select value={editing.application_id} onChange={(e) => changeEditingApp(e.target.value)}>{apps.map((a) => <option value={a.id} key={a.id}>{a.app_name}</option>)}</select></label>
              <label><span>Control <InfoTip text="Target application control." /></span><select value={editing.control_id} onChange={(e) => changeEditingControl(e.target.value)}>{editingControls.map((c) => <option value={c.id} key={c.id}>{c.control_name}</option>)}</select></label>
              <label><span>Type <InfoTip text="Linear, inverted, or stepped mapping." /></span><select value={editing.mapping_type} onChange={(e) => setEditing({ ...editing, mapping_type: e.target.value })}><option value="linear">Linear</option><option value="inverted">Inverted</option><option value="stepped">Stepped</option></select></label>
              <label><span>Output Min</span><input type="number" value={editing.output_min} onChange={(e) => setEditing({ ...editing, output_min: e.target.value })} /></label>
              <label><span>Output Max</span><input type="number" value={editing.output_max} onChange={(e) => setEditing({ ...editing, output_max: e.target.value })} /></label>
              <label><span>Active</span><select value={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: Number(e.target.value) })}><option value={1}>Active</option><option value={0}>Saved / inactive</option></select></label>
            </div>

            <div className="mappingPreviewStrip">
              <span>Preview</span>
              <strong>{editing.device_id}</strong>
              <em>{apps.find((a) => String(a.id) === String(editing.application_id))?.app_name || 'Application'} → {editingControl?.control_name || 'Control'}</em>
              <b>{editing.output_min}–{editing.output_max}{editingControl?.output_unit || editing.output_unit || ''}</b>
            </div>

            <div className="buttonRow compactButtons editorSaveRow">
              <button className="primaryButton" onClick={updateMapping}>Save Mapping Changes</button>
              <button className="secondaryButton" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MappingCard({ mapping, compact = false }) {
  return (
    <div className={compact ? 'mappingCard compact' : 'mappingCard glassCard'}>
      <div className="mappingCardTop"><strong>{mapping.device_id}</strong><span>{mapping.is_active ? 'Active' : 'Saved'}</span></div>
      <h4>{mapping.app_name} → {mapping.control_name}</h4>
      <div className="rangeBars">
        <div><span>Input</span><i><b style={{ width: '100%' }} /></i><em>0°–360°</em></div>
        <div><span>Output</span><i><b style={{ width: '76%' }} /></i><em>{mapping.output_min}–{mapping.output_max}{mapping.output_unit}</em></div>
      </div>
      <small>{mapping.mapping_type} mapping</small>
    </div>
  );
}

function Events({ events }) {
  return (
    <section className="glassCard monitorPanel">
      <span className="eyebrow">Live Signal Monitor</span>
      <h3>Activity feed across all knobs</h3>
      <div className="eventFeed">
        {events.map((e, i) => (
          <div className="eventItem" key={e.id || i}>
            <div className="eventDot" />
            <div>
              <strong>{e.device_id} moved to {formatNumber(e.relative_position)}°</strong>
              <p>{e.control_name || 'Unmapped control'} changed to {formatNumber(e.mapped_value)}{e.output_unit || ''} {e.application_name ? `in ${e.application_name}` : ''}</p>
              <small>{e.created_at}</small>
            </div>
          </div>
        ))}
        {!events.length && <p className="muted">No events yet.</p>}
      </div>
    </section>
  );
}


function LeadManagement({ currentUser }) {
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const isAdminUser = currentUser && String(currentUser.role || '').toLowerCase() === 'admin';

  async function loadLeads() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/leads');
      const clean = Array.isArray(data) ? data.filter(Boolean) : [];
      setLeads(clean);
      setSelectedIds((ids) => ids.filter((id) => clean.some((lead) => lead.id === id)));
    } catch (e) {
      setError(e?.message || 'Unable to load leads. Please refresh after confirming admin login.');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdminUser) loadLeads();
    else setLoading(false);
  }, [isAdminUser]);

  if (!isAdminUser) {
    return (
      <section className="glassCard">
        <SectionHeader eyebrow="Protected" title="Admin access required" text="Lead records are visible only to admin users." />
      </section>
    );
  }

  function safeText(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  function safeDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  function leadId(lead) { return Number(lead?.id); }
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  function toggleSelect(id, checked) {
    setSelectedIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id));
  }

  function toggleSelectAll(checked) {
    setSelectedIds(checked ? leads.map((lead) => leadId(lead)).filter(Boolean) : []);
  }

  function csvEscape(value) {
    const text = safeText(value).replace(/—/g, '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  const csvCols = [
    ['full_name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['company', 'Company'],
    ['role_use_case', 'Use Case'], ['created_at', 'Captured UTC'], ['client_date', 'Client Date'],
    ['client_time', 'Client Time'], ['client_timezone', 'Timezone'], ['os', 'OS'],
    ['device_type', 'Device'], ['browser', 'Browser'], ['region', 'Region'], ['ip_address', 'IP']
  ];

  function exportCsv(rowsToExport = leads, filenameSuffix = 'all') {
    const header = csvCols.map(([, label]) => csvEscape(label)).join(',');
    const body = rowsToExport.map((lead) => csvCols.map(([key]) => csvEscape(lead?.[key])).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knobs-slides-leads-${filenameSuffix}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSelected() {
    const rowsToExport = leads.filter((lead) => selectedIds.includes(leadId(lead)));
    exportCsv(rowsToExport, 'selected');
  }

  async function deleteLead(id) {
    if (!confirm('Delete this lead record?')) return;
    await api(`/api/leads/${id}`, { method: 'DELETE' });
    await loadLeads();
  }

  async function deleteSelected() {
    if (!selectedIds.length) return;
    if (!confirm(`Delete ${selectedIds.length} selected lead record(s)?`)) return;
    await api('/api/leads/delete-bulk', { method: 'POST', body: JSON.stringify({ ids: selectedIds }) });
    setSelectedIds([]);
    await loadLeads();
  }

  function printLead(lead = null) {
    const rows = lead ? [lead] : leads;
    const html = `
      <html><head><title>Knobs & Slides Leads</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#f5f5f7}h1{font-size:22px}.meta{color:#666;margin-bottom:16px}</style></head>
      <body><h1>Knobs & Slides Studio Leads</h1><div class="meta">Printed ${new Date().toLocaleString()}</div>
      <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Use Case</th><th>Date</th><th>OS</th><th>Device</th><th>Region</th></tr></thead>
      <tbody>${rows.map(l => `<tr><td>${safeText(l.full_name)}</td><td>${safeText(l.email)}</td><td>${safeText(l.phone)}</td><td>${safeText(l.company)}</td><td>${safeText(l.role_use_case)}</td><td>${safeDate(l.created_at)}</td><td>${safeText(l.os)}</td><td>${safeText(l.device_type)}</td><td>${safeText(l.region)}</td></tr>`).join('')}</tbody></table></body></html>`;
    const win = window.open('', '_blank', 'width=1100,height=800');
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const detailRows = selectedLead ? [
    ['Name', selectedLead.full_name], ['Email', selectedLead.email], ['Phone', selectedLead.phone],
    ['Company', selectedLead.company], ['Role / use case', selectedLead.role_use_case], ['Source', selectedLead.source],
    ['Captured UTC', selectedLead.created_at], ['Client date', selectedLead.client_date], ['Client time', selectedLead.client_time],
    ['Timezone', selectedLead.client_timezone], ['Locale', selectedLead.client_locale], ['OS', selectedLead.os],
    ['Device type', selectedLead.device_type], ['Browser', selectedLead.browser], ['Platform', selectedLead.platform],
    ['Screen size', selectedLead.screen_size], ['Region', selectedLead.region], ['Referrer', selectedLead.referrer],
    ['IP address', selectedLead.ip_address], ['User agent', selectedLead.user_agent],
  ] : [];

  return (
    <section className="leadsPage">
      <SectionHeader eyebrow="Marketing" title="Lead Capture" text="Clean admin table for simulator access leads. Select records, export, edit, delete, or click a row for full detail." />
      <div className="leadToolbar premiumLeadToolbar">
        <label className="selectAllControl">
          <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
          <span>Select all</span>
        </label>
        <div className="leadSummary"><UserPlus size={16} /><strong>{leads.length}</strong><span>leads</span>{selectedIds.length > 0 && <em>{selectedIds.length} selected</em>}</div>
        <div className="buttonRow compactButtons">
          <button className="refreshButton" type="button" onClick={loadLeads}><RefreshCw size={16} />Refresh</button>
          <button className="refreshButton" type="button" onClick={() => exportCsv(leads, 'all')} disabled={!leads.length}><Download size={16} />Export all</button>
          <button className="refreshButton" type="button" onClick={exportSelected} disabled={!selectedIds.length}><Download size={16} />Export selected</button>
          <button className="refreshButton dangerSoft" type="button" onClick={deleteSelected} disabled={!selectedIds.length}><Trash2 size={16} />Delete selected</button>
        </div>
      </div>
      {error && <div className="errorBox">{error}</div>}
      <div className="leadTableShell">
        <div className="leadTableHeader">
          <span></span><span>Name</span><span>Email</span><span>Company</span><span>Use case</span><span>Captured</span><span>Actions</span>
        </div>
        {loading && <div className="emptyState">Loading leads…</div>}
        {!loading && !error && leads.length === 0 && <div className="emptyState">No leads captured yet.</div>}
        {!loading && leads.map((lead, index) => {
          const id = leadId(lead);
          const checked = selectedIds.includes(id);
          return (
            <div className={`leadRecordRow ${checked ? 'selected' : ''}`} key={id || `${lead?.email || 'lead'}-${index}`} onClick={() => setSelectedLead(lead)}>
              <span className="leadSelectCell" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked} onChange={(e) => toggleSelect(id, e.target.checked)} /></span>
              <span><strong>{safeText(lead?.full_name)}</strong><small>{safeText(lead?.phone)}</small></span>
              <span title={safeText(lead?.email)}>{safeText(lead?.email)}</span>
              <span title={safeText(lead?.company)}>{safeText(lead?.company)}</span>
              <span title={safeText(lead?.role_use_case)}>{safeText(lead?.role_use_case)}</span>
              <span>{safeDate(lead?.created_at)}<small>{safeText(lead?.region)} · {safeText(lead?.device_type)}</small></span>
              <span className="rowIconActions" onClick={(e) => e.stopPropagation()}>
                <button className="miniIconButton" onClick={() => setEditLead({ ...lead })} title="Edit lead"><Edit3 size={16} /></button>
                <button className="miniIconButton dangerIcon" onClick={() => deleteLead(id)} title="Delete lead"><Trash2 size={16} /></button>
              </span>
            </div>
          );
        })}
      </div>

      {selectedLead && (
        <div className="maintenanceEditorOverlay" onClick={() => setSelectedLead(null)}>
          <div className="glassCard leadDetailSheet" onClick={(e) => e.stopPropagation()}>
            <div className="editorSheetHeader">
              <div><span className="eyebrow"><Eye size={14} /> Lead detail</span><h3>{safeText(selectedLead.full_name)}</h3></div>
              <div className="editorIconActions"><button className="miniIconButton" onClick={() => setEditLead({ ...selectedLead })} title="Edit lead"><Edit3 size={16} /></button><button className="miniIconButton" onClick={() => printLead(selectedLead)} title="Print lead"><Printer size={16} /></button><button className="miniIconButton" onClick={() => setSelectedLead(null)}>×</button></div>
            </div>
            <div className="leadDetailGrid">
              {detailRows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{safeText(value)}</strong></div>)}
            </div>
          </div>
        </div>
      )}

      {editLead && (
        <div className="maintenanceEditorOverlay" onClick={() => setEditLead(null)}>
          <form className="glassCard leadEditSheet" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
            e.preventDefault();
            await api(`/api/leads/${editLead.id}`, { method: 'PUT', body: JSON.stringify(editLead) });
            setEditLead(null);
            await loadLeads();
          }}>
            <div className="editorSheetHeader">
              <div><span className="eyebrow"><Edit3 size={14} /> Edit lead</span><h3>{safeText(editLead.full_name)}</h3></div>
              <button type="button" className="miniIconButton" onClick={() => setEditLead(null)}>×</button>
            </div>
            <div className="leadEditGrid">
              {[['full_name','Name'],['email','Email'],['phone','Phone'],['company','Company'],['role_use_case','Use case'],['region','Region'],['os','OS'],['device_type','Device'],['browser','Browser'],['client_timezone','Timezone']].map(([key,label]) => (
                <label key={key}>{label}<input value={editLead[key] || ''} onChange={(e) => setEditLead({ ...editLead, [key]: e.target.value })} /></label>
              ))}
            </div>
            <div className="buttonRow"><button type="button" className="secondaryBtn" onClick={() => setEditLead(null)}>Cancel</button><button className="primaryBtn" type="submit">Save changes</button></div>
          </form>
        </div>
      )}
    </section>
  );
}

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'user', status: 'active' });
  const [error, setError] = useState('');

  async function load() {
    try { setUsers(await api('/api/users')); setError(''); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  function openUser(u) {
    setSelected(u);
    setForm({ username: u.username, password: '', full_name: u.full_name || '', role: u.role, status: u.status });
  }
  function newUser() {
    setSelected(null);
    setForm({ username: '', password: '', full_name: '', role: 'user', status: 'active' });
  }
  async function save(e) {
    e.preventDefault();
    const payload = { full_name: form.full_name, role: form.role, status: form.status };
    if (form.password) payload.password = form.password;
    if (!selected) {
      payload.username = form.username;
      payload.password = form.password;
      await api('/api/users', { method: 'POST', body: JSON.stringify(payload) });
    } else {
      await api(`/api/users/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    }
    newUser();
    load();
  }
  async function removeUser(u) {
    if (!confirm(`Delete user ${u.username}?`)) return;
    await api(`/api/users/${u.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <section className="settingsGrid">
      <div className="glassCard">
        <div className="sectionHeader"><div><span className="eyebrow">URL Protection</span><h3>User Management</h3></div><button className="refreshButton" onClick={newUser}><UserPlus size={16} />New</button></div>
        {error && <div className="errorBox">{error}</div>}
        <div className="userList">
          {users.map((u) => (
            <div className="deviceRow clickableRow" key={u.id} onClick={() => openUser(u)}>
              <Users size={18} />
              <div><strong>{u.username}</strong><span>{u.full_name || '—'} · {u.role} · {u.status}</span></div>
              <button className="iconButton" onClick={(e) => { e.stopPropagation(); removeUser(u); }} title="Delete user" disabled={u.id === currentUser.id}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
      <form className="glassCard userForm" onSubmit={save}>
        <span className="eyebrow">{selected ? 'Edit User' : 'Create User'} <InfoTip text="Users protect the deployed Railway URL and local studio app. Admin users can manage other users." /></span>
        <label>Username<input disabled={!!selected} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
        <label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="user">User</option></select></label>
        <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label>{selected ? 'New password' : 'Password'}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!selected} placeholder={selected ? 'Leave blank to keep existing' : 'Required'} /></label>
        <button className="loginButton">{selected ? 'Save changes' : 'Create user'}</button>
      </form>
    </section>
  );
}

function SettingsPanel({ meta, devices, mappings, textConfig, setTextConfig }) {
  const [rows, setRows] = useState([]);
  const [edited, setEdited] = useState({});
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState('');

  async function loadTextConfig() {
    try {
      const data = await api('/api/text-config');
      setRows(Array.isArray(data) ? data : []);
      setTextConfig(toTextMap(data));
      setStatus('Text configuration loaded.');
    } catch (e) {
      setStatus(e.message || 'Unable to load text configuration.');
    }
  }

  useEffect(() => { loadTextConfig(); }, []);

  const filteredRows = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return [r.category, r.label, r.text_key, edited[r.text_key] ?? r.text_value].some((v) => String(v || '').toLowerCase().includes(q));
  });

  function updateLocal(row, value) {
    setEdited((prev) => ({ ...prev, [row.text_key]: value }));
  }

  async function saveAll() {
    const items = rows.map((r) => ({ text_key: r.text_key, text_value: edited[r.text_key] ?? r.text_value }));
    await api('/api/text-config', { method: 'PUT', body: JSON.stringify({ items }) });
    setStatus('Static text saved successfully. Refresh or revisit screens to see all updates.');
    await loadTextConfig();
    setEdited({});
  }

  function exportTextCsv() {
    const cols = ['category', 'label', 'text_key', 'text_value'];
    const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => `"${String((edited[r.text_key] ?? r[c]) || '').replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knobs-slides-static-text-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="settingsGrid wideSettingsGrid">
      <div className="glassCard">
        <span className="eyebrow">Release <InfoTip text="Railway-ready build with configurable static text, enriched leads, and exportable lead management." /></span>
        <h3>{meta.name}</h3>
        <div className="settingRows">
          <div><strong>Version</strong><span>{VERSION}</span></div>
          <div><strong>Backend</strong><span>FastAPI + SQLite with protected admin APIs</span></div>
          <div><strong>Multi-Knob Mode</strong><span>{devices.length} devices registered, {mappings.length} active mappings</span></div>
        </div>
      </div>
      <div className="glassCard">
        <span className="eyebrow">Registered Devices</span>
        {devices.slice(0, 8).map((d) => (
          <div className="deviceRow" key={d.device_id}>
            <Bluetooth size={18} />
            <div><strong>{d.device_id}</strong><span>{d.device_name || d.device_type}</span></div>
          </div>
        ))}
      </div>
      <div className="glassCard textConfigCard">
        <div className="sectionHeader">
          <div><span className="eyebrow"><Edit3 size={14} /> Static Text Configuration</span><h3>Configure every major displayed text</h3><p className="muted">Edit the formatted table below to change landing page, dialog, login, footer, and release copy without touching code.</p></div>
          <div className="buttonRow compactButtons"><button className="refreshButton" onClick={loadTextConfig}><RefreshCw size={16} />Reload</button><button className="refreshButton" onClick={exportTextCsv}><Download size={16} />Export</button><button className="primaryButton" onClick={saveAll}>Save Text</button></div>
        </div>
        <input className="textFilterInput" placeholder="Search static text by category, key, label, or value" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {status && <p className="successMsg">{status}</p>}
        <div className="textConfigTable">
          <div className="textConfigHeader"><span>Category</span><span>Label</span><span>Key</span><span>Displayed Text</span></div>
          {filteredRows.map((row) => (
            <div className="textConfigRow" key={row.text_key}>
              <span>{row.category}</span>
              <span>{row.label}</span>
              <code>{row.text_key}</code>
              <textarea value={edited[row.text_key] ?? row.text_value} onChange={(e) => updateLocal(row, e.target.value)} />
            </div>
          ))}
          {!filteredRows.length && <div className="emptyState">No matching static text records.</div>}
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
