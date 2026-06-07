import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AppWindow,
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  Edit3,
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
  Zap,
} from 'lucide-react';
import { api, wsUrl, setToken } from './api';
import './styles.css';

const VERSION = '1.2.12';

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'simulator', label: 'Multi-Knob Simulator', icon: Bluetooth },
  { key: 'devices', label: 'Knob Maintenance', icon: Grid3X3 },
  { key: 'profiles', label: 'Profiles', icon: AppWindow },
  { key: 'mappings', label: 'Mappings', icon: SlidersHorizontal },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'events', label: 'Monitor', icon: Activity },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function App() {
  const [active, setActive] = useState('overview');
  const [meta, setMeta] = useState({ name: 'Knobs and Slides Studio', version: VERSION });
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

  async function refresh() {
    try {
      setError('');
      const [m, d, a, c, map, ev] = await Promise.all([
        api('/api/meta'),
        api('/api/devices'),
        api('/api/applications'),
        api('/api/controls'),
        api('/api/mappings'),
        api('/api/events?limit=80'),
      ]);
      setMeta({ ...m, version: VERSION, release: 'Minimal UI with Tooltips' });
      setDevices(d);
      setApplications(a);
      setControls(c);
      setMappings(map);
      setEvents(ev);
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
    if (authUser) refresh();
  }, [authUser]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('knobs_theme', theme);
  }, [theme]);

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

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    setToken('');
    setAuthUser(null);
  }

  if (authLoading) {
    return <div className="loginShell"><div className="loginCard glassCard"><div className="brandGlyph"><Lock size={24} /></div><h1>Loading secure studio…</h1></div></div>;
  }

  if (!authUser) {
    return <LoginScreen onLogin={setAuthUser} />;
  }

  return (
    <div className="studioShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandGlyph"><RadioTower size={25} /></div>
          <div>
            <h1>Knobs & Slides</h1>
            <p>Studio {meta.version}</p>
          </div>
        </div>

        <nav className="navList">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => setActive(t.key)}>
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
      </aside>

      <main className="mainStage">
        <header className="topbar">
          <div>
            <span className="eyebrow">Investor Demo</span>
            <h2>{tabs.find((t) => t.key === active)?.label} <InfoTip text={`${meta.release}. Same FastAPI backend with simulated Bluetooth input.`} /></h2>
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

        {active === 'overview' && <Overview devices={devices} applications={applications} controls={controls} mappings={activeMappings} lastEvent={lastEvent} />}
        {active === 'simulator' && <MultiSimulator devices={devices} mappings={activeMappings} onEvent={setLastEvent} refresh={refresh} />}
        {active === 'devices' && <KnobMaintenance devices={devices} mappings={mappings} refresh={refresh} />}
        {active === 'profiles' && <Profiles applications={applications} controls={controls} mappings={mappings} />}
        {active === 'mappings' && <Mappings devices={devices} apps={applications} controls={controls} mappings={mappings} refresh={refresh} />}
        {active === 'users' && <UserManagement currentUser={authUser} />}
        {active === 'events' && <Events events={events} />}
        {active === 'settings' && <SettingsPanel meta={meta} devices={devices} mappings={activeMappings} />}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('admin');
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
        <div className="brandGlyph"><Lock size={25} /></div>
        <span className="eyebrow">Protected Studio URL</span>
        <h1>Knobs & Slides Studio</h1>
        <p>Sign in to access the simulator, mappings, maintenance, and Railway demo URL.</p>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin123$" /></label>
        {error && <div className="errorBox">{error}</div>}
        <button className="loginButton" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <small className="muted">Default admin: <b>admin</b> / <b>admin123$</b></small>
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

  useEffect(() => {
    setPositions((prev) => ({ ...initialPositions, ...prev }));
  }, [initialPositions]);

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
    window.clearTimeout(updatePosition.timers?.[deviceId]);
    updatePosition.timers = updatePosition.timers || {};
    updatePosition.timers[deviceId] = window.setTimeout(() => transmit(deviceId, nextValue), 120);
  }

  async function simulatorDeviceAction(deviceId, endpoint) {
    try {
      await api(`/api/devices/${encodeURIComponent(deviceId)}/${endpoint}`, { method: 'POST' });
      if (refresh) await refresh();
    } catch (e) {
      setResults((prev) => ({ ...prev, [deviceId]: { display_value: e.message } }));
    }
  }

  return (
    <section className="studioConsolePage">
      <div className="glassCard studioConsoleHeader">
        <div>
          <span className="eyebrow">Studio Console <InfoTip text="Only active paired knobs are shown. Move a knob to see the mapped application result as a live visual meter." /></span>
          <h3>Live paired knobs</h3>
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
                />

                <div className="studioKnobDock">
                  <div className="simulatorTouchControls">
                    <button className="touchButton pairedTouch" onClick={() => simulatorDeviceAction(device.device_id, 'unpair')} title="Unpair this simulated Bluetooth knob">
                      <Bluetooth size={14} /> Paired
                    </button>
                    <button className="touchButton powerTouch" onClick={() => simulatorDeviceAction(device.device_id, 'deactivate')} title="Switch off this simulated knob">
                      <Power size={14} /> Switch Off
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

function VisualResultPanel({ device, mapping, position, result }) {
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

function SettingsPanel({ meta, devices, mappings }) {
  return (
    <section className="settingsGrid">
      <div className="glassCard">
        <span className="eyebrow">Release <InfoTip text="High-contrast simulated values, visual simulator output, touch pairing controls, knob maintenance, clickable mappings, and tooltips." /></span>
        <h3>{meta.name}</h3>
        <div className="settingRows">
          <div><strong>Backend</strong><span>Same FastAPI + SQLite engine from 1.0.0</span></div>
          <div><strong>Bluetooth</strong><span>Simulation now, BLE adapter placeholder retained</span></div>
          <div><strong>Multi-Knob Mode</strong><span>{devices.length} devices registered, {mappings.length} active mappings</span></div>
        </div>
      </div>
      <div className="glassCard">
        <span className="eyebrow">Registered Devices</span>
        {devices.map((d) => (
          <div className="deviceRow" key={d.device_id}>
            <Bluetooth size={18} />
            <div><strong>{d.device_id}</strong><span>{d.device_name || d.device_type}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
