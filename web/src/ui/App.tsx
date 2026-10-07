import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEther, parseEther, type Address, type Hash } from 'viem';
import { config, MAINNET_PENDING } from '../config/environment';
import {
  assertNetwork, claimReward, connectWallet, createChallenge, demoProgress, discoverChallenges,
  getChallenge, getCharacter, getRegistration, getTotalCharacters, publicClient, reclaimExpired,
  registerCharacter, switchNetwork, waitForConfirmation, type Challenge, type Registration,
  type WalletState,
} from '../lib/clients';
import { friendlyError } from '../lib/errors';

type Page = 'discover' | 'create' | 'detail';
type Flash = { kind: 'success' | 'error' | 'info'; message: string } | null;

function short(address?: string) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''; }
function remaining(deadline: bigint) {
  const seconds = Number(deadline) - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return 'ENDED';
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600);
  return days ? `${days}D ${hours}H LEFT` : `${hours}H ${Math.floor(seconds % 3600 / 60)}M LEFT`;
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg className="arrow-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none">
    {diagonal ? <path d="M4 12 12 4M5 4h7v7" /> : <path d="M2 8h11M8 3l5 5-5 5" />}
  </svg>;
}

function Mark({ className = '' }: { className?: string }) {
  return <svg className={`verified-mark ${className}`} aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="m4 10 4 4 8-9" />
  </svg>;
}

function StateTrace({
  baseline = 17, current = 17, target = 20, reward = '1', reached = false,
  compact = false, example = false,
}: {
  baseline?: number; current?: number; target?: number; reward?: string; reached?: boolean;
  compact?: boolean; example?: boolean;
}) {
  const percent = Math.min(100, Math.max(0, (current - baseline) / Math.max(1, target - baseline) * 100));
  const steps = [
    { id: '01', title: 'ONCHAIN GAME', value: 'CHAINMMO', state: 'source' },
    { id: '02', title: 'CANONICAL STATE', value: 'BEST LEVEL', state: 'state' },
    { id: '03', title: 'COMPETITION', value: `+${target - baseline}`, state: 'rule' },
    { id: '04', title: 'BASELINE', value: String(baseline), state: 'baseline' },
    { id: '05', title: 'TARGET', value: String(target), state: 'target' },
    { id: '06', title: 'VERIFICATION', value: reached ? 'PASSED' : 'LIVE READ', state: reached ? 'passed' : 'verify' },
    { id: '07', title: 'REWARD', value: `${reward} MON`, state: reached ? 'paid' : 'SPONSORED' },
  ];
  return <div className={`state-trace ${compact ? 'state-trace-compact' : ''} ${reached ? 'trace-reached' : ''}`}>
    {example && <div className="trace-example-label"><span>ILLUSTRATIVE VALUES</span><span>17 → 20 / +3</span></div>}
    <ol className="trace-steps" aria-label="Challenge verification sequence">
      {steps.map((step, index) => <li key={step.id} className={`trace-step trace-${step.state}${index === 2 ? ' trace-rule' : ''}`}>
        <span className="trace-node" aria-hidden="true">{step.id === '06' && reached ? <Mark /> : step.id}</span>
        <span className="trace-copy"><small>{step.title}</small><strong>{step.value}</strong></span>
      </li>)}
    </ol>
    {!example && <div className="trace-meter" role="progressbar" aria-label="Progress toward the canonical target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <span style={{ transform: `scaleX(${percent / 100})` }} />
    </div>}
    {example && <p className="trace-caption">A participant starts at their own captured level. The game remains unchanged.</p>}
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>('discover');
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [challenges, setChallenges] = useState<Address[]>([]);
  const [selected, setSelected] = useState<Address | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [challengeData, setChallengeData] = useState<Challenge | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [character, setCharacter] = useState<{ owner: Address; bestLevel: number; lastLevelUpEpoch: number } | null>(null);
  const [characterInput, setCharacterInput] = useState('');
  const [observedLevel, setObservedLevel] = useState<number | null>(null);
  const [form, setForm] = useState({ delta: '3', reward: '1', slots: '10', days: '7' });

  const pending = config.mode === 'MONAD_MAINNET' && !config.factory;
  const mainnetReadOnly = config.mode === 'MONAD_MAINNET' && Boolean(config.factory) && !config.writable;
  const refreshList = useCallback(async () => {
    if (!config.factory) { setChallenges([]); setLoading(false); return; }
    setLoading(true);
    try { setChallenges(await discoverChallenges()); }
    catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refreshList(); }, [refreshList]);

  const refreshSelected = useCallback(async (address: Address, player?: Address) => {
    const data = await getChallenge(address);
    setChallengeData(data);
    if (player) {
      const reg = await getRegistration(address, player);
      setRegistration(reg.registered ? reg : null);
      if (reg.registered) {
        setCharacter(await getCharacter(reg.characterId));
        setObservedLevel(null);
      } else { setCharacter(null); setObservedLevel(null); }
    } else { setRegistration(null); setCharacter(null); }
  }, []);
  useEffect(() => {
    if (!selected) return;
    void refreshSelected(selected, wallet?.address).catch(e => setFlash({ kind: 'error', message: friendlyError(e) }));
  }, [selected, wallet?.address, refreshSelected]);

  function chooseChallenge(address: Address) {
    setSelected(address); setPage('detail'); setChallengeData(null); setRegistration(null); setCharacter(null); setFlash(null);
  }
  async function connect() {
    setBusy(true); setFlash(null);
    try {
      const next = await connectWallet(); setWallet(next);
      try { await assertNetwork(next); setWrongNetwork(false); }
      catch { setWrongNetwork(true); }
    } catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
    finally { setBusy(false); }
  }
  async function ensureWallet() {
    if (!wallet) throw new Error('Connect a wallet to continue.');
    await assertNetwork(wallet);
    return wallet;
  }
  async function sendAction(label: string, action: () => Promise<Hash>, after?: () => Promise<void>) {
    setBusy(true); setFlash({ kind: 'info', message: `${label}: preparing transaction…` });
    try {
      const hash = await action(); setFlash({ kind: 'info', message: `${label}: submitted ${short(hash)}. Waiting for confirmation…` });
      await waitForConfirmation(hash);
      if (after) await after();
      setFlash({ kind: 'success', message: `${label}: confirmed on ${config.label}.` });
    } catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
    finally { setBusy(false); }
  }
  async function submitCreate() {
    try {
      const account = await ensureWallet();
      const delta = Number(form.delta), slots = Number(form.slots), reward = parseEther(form.reward), days = Number(form.days);
      if (!Number.isInteger(delta) || delta < 1 || delta > 0xffffffff || !Number.isInteger(slots) || slots < 1 || slots > 0xffffffff || reward <= 0n || days < 1) throw new Error('Enter a valid positive objective, reward, slot count and duration.');
      const deadline = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
      await sendAction('Create challenge', () => createChallenge(account, { delta, rewardMon: form.reward, cap: slots, deadline }), async () => {
        await refreshList(); setPage('discover');
      });
    } catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
  }
  async function inspectCharacter() {
    setFlash(null); setCharacter(null);
    try {
      const id = BigInt(characterInput);
      if (id < 0n) throw new Error('Character ID must be positive.');
      const data = await getCharacter(id); setCharacter(data);
      if (!wallet || data.owner.toLowerCase() !== wallet.address.toLowerCase()) setFlash({ kind: 'error', message: 'This character is not controlled by the connected wallet.' });
    } catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
  }
  async function register() {
    if (!selected || !wallet || !characterInput) return;
    const id = BigInt(characterInput);
    await sendAction('Register character', () => registerCharacter(wallet, selected, id), async () => refreshSelected(selected, wallet.address));
  }
  async function updateProgress() {
    if (!wallet || !registration || !character) return;
    await sendAction('Demo progression', () => demoProgress(wallet, registration.characterId, Math.max(character.bestLevel + 1, Number(registration.target))), async () => {
      setCharacter(await getCharacter(registration.characterId)); setObservedLevel(null);
    });
  }
  async function checkProgress() {
    if (!registration) return;
    try { const value = await getCharacter(registration.characterId); setCharacter(value); setObservedLevel(value.bestLevel); setFlash({ kind: 'success', message: 'Progress refreshed from canonical game state.' }); }
    catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
  }
  async function claim() {
    if (!selected) return;
    try { const account = await ensureWallet(); await sendAction('Claim reward', () => claimReward(account, selected), async () => refreshSelected(selected, account.address)); }
    catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
  }
  async function reclaim() {
    if (!selected) return;
    try { const account = await ensureWallet(); await sendAction('Reclaim unused rewards', () => reclaimExpired(account, selected), async () => refreshSelected(selected, account.address)); }
    catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); }
  }
  async function copyAddress(value: string) { await navigator.clipboard?.writeText(value); setFlash({ kind: 'success', message: 'Address copied.' }); }

  const remainingSlots = challengeData ? challengeData.cap - challengeData.claimed : 0;
  const progress = registration && character ? Math.min(100, Math.max(0, (character.bestLevel - registration.baseline) / Number(registration.target - BigInt(registration.baseline)) * 100)) : 0;
  const reached = Boolean(registration && character && BigInt(character.bestLevel) >= registration.target);
  const isCreator = Boolean(wallet && challengeData && wallet.address.toLowerCase() === challengeData.creator.toLowerCase());
  const isLocal = config.mode === 'LOCAL';
  const totalFunding = useMemo(() => {
    try { return formatEther(parseEther(form.reward || '0') * BigInt(form.slots || '0')); }
    catch { return '—'; }
  }, [form.reward, form.slots]);

  return <div className="app-shell">
    <header className="masthead">
      <button className="brand" onClick={() => { setPage('discover'); setSelected(null); }} aria-label="Arovaq home">
        <span className="brand-symbol" aria-hidden="true">A</span><span>AROVAQ</span>
      </button>
      <span className="network-wordmark"><b>MONAD</b><span>CHAIN / 143</span></span>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={page === 'discover' ? 'nav-active' : ''} onClick={() => { setPage('discover'); setSelected(null); }}>Competitions</button>
        <button className={page === 'create' ? 'nav-active' : ''} onClick={() => { setPage('create'); setSelected(null); }}>Create</button>
      </nav>
      <div className="masthead-actions">
        <span className="environment-label">{config.label}</span>
        {wallet ? <button className="wallet-control connected" aria-label={`Disconnect wallet ${wallet.address}`} onClick={() => setWallet(null)}><span className="wallet-state" />{short(wallet.address)}</button> : <button className="wallet-control" onClick={connect} disabled={busy}>{busy ? 'CONNECTING…' : 'CONNECT WALLET'}</button>}
      </div>
    </header>

    {wrongNetwork && <div className="system-alert network-alert" role="status"><span>WALLET NETWORK</span><p>Wallet network does not match {config.label}.</p><button onClick={async () => { if (wallet) try { await switchNetwork(wallet); setWrongNetwork(false); } catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); } }}>SWITCH NETWORK <Arrow /></button></div>}
    {pending && <div className="deployment-alert" role="status"><b>MAINNET DEPLOYMENT PENDING</b><span>{MAINNET_PENDING}</span><a href="#chainmmo-live">CHAINMMO READS AVAILABLE <Arrow diagonal /></a></div>}
    {mainnetReadOnly && <div className="deployment-alert read-only-alert" role="status"><b>READ-ONLY MODE</b><span>Arovaq contracts are configured for inspection. Mainnet writes are disabled.</span></div>}
    {flash && <div className={`transaction-message ${flash.kind}`} role="status" aria-live="polite"><span className="message-mark">{flash.kind === 'success' ? <Mark /> : flash.kind === 'error' ? '!' : '↗'}</span><p>{flash.message}</p><button aria-label="Dismiss message" onClick={() => setFlash(null)}>DISMISS</button></div>}

    {page === 'discover' && <main className="landing-page">
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="hero-context">THE WORLD BELONGS TO THE GAME<span> / </span>THE COMPETITION BELONGS TO EVERYONE</p>
          <h1>THE GAME<br />STAYS.<br /><em>COMPETITION</em><br />CHANGES.</h1>
          <div className="hero-bottom">
            <p>Communities create new ways to compete around games they do not control.</p>
            <div className="hero-actions">
              <button className="button-primary" onClick={() => document.getElementById('competition-board')?.scrollIntoView({ behavior: 'smooth' })}>EXPLORE COMPETITIONS <Arrow /></button>
        <button className="button-quiet" onClick={() => setPage('create')}>OPEN CREATOR <Arrow diagonal /></button>
            </div>
          </div>
        </div>
        <aside className="hero-trace" aria-label="Arovaq challenge mechanism">
          <div className="trace-head"><span>GAME / CHAINMMO</span><span>NETWORK / 143</span></div>
          <h2>FROM GAME STATE<br />TO A VERIFIED REWARD.</h2>
          <StateTrace example />
        </aside>
        <div className="hero-index" aria-hidden="true">AQ — 001</div>
      </section>

      <section className="mechanism-note" aria-label="Zero integration explanation">
        <div className="mechanism-label"><span className="line-marker" />NO GAME INTEGRATION</div>
        <p>Players keep using the original game. Arovaq reads its canonical state and lets communities attach their own challenge.</p>
      </section>

      {config.mode === 'MONAD_MAINNET' && <WorldReadProbe />}

      <section id="competition-board" className="competition-board">
        <div className="board-heading">
          <div><p className="section-code">COMMUNITY EVENTS / CHAINMMO</p><h2>COMPETITIONS<br /><em>IN PLAY.</em></h2></div>
          <button className="refresh-action" onClick={() => void refreshList()}>REFRESH BOARD <span aria-hidden="true">↻</span></button>
        </div>
        <div className="event-headings" aria-hidden="true"><span>EVENT</span><span>OBJECTIVE</span><span>REWARD</span><span>CLAIMS LEFT</span><span>WINDOW</span><span /></div>
        {loading ? <div className="board-state"><span className="loading-rule" /><p>READING CANONICAL AROVAQ EVENTS…</p></div> : challenges.length ? <div className="event-list">
          {challenges.map((address, index) => <ChallengeCard key={address} address={address} number={index + 1} onOpen={() => void chooseChallenge(address)} />)}
        </div> : <div className="board-empty"><span className="empty-code">00</span><div><p className="section-code">NO ACTIVE EVENTS FOUND</p><h3>{pending ? 'THE FIRST COMPETITION IS WAITING.' : 'START A NEW CHALLENGE.'}</h3><p>{pending ? 'Arovaq Mainnet is not configured yet. The existing ChainMMO world is already readable above.' : 'Set a progression target, sponsor its rewards, and invite your community to play.'}</p><button className="button-quiet" onClick={() => setPage('create')}>CREATE A CHALLENGE <Arrow diagonal /></button></div><span className="empty-origin">BOARD / CHAINMMO</span></div>}
      </section>
    </main>}

    {page === 'create' && <main className="work-page create-page">
      <div className="page-return"><button onClick={() => { setPage('discover'); setSelected(null); }}>← COMPETITIONS</button><span>CREATOR / SPECIFICATION</span></div>
      <header className="page-heading page-title"><p className="section-code">DEFINE A COMMUNITY CHALLENGE</p><h1>SET THE<br /><em>CONDITION.</em></h1><p>Choose a progression objective and sponsor the rewards before the event opens.</p></header>
      <div className="builder-layout">
        <section className="challenge-fields" aria-label="Challenge configuration">
          <div className="field-row game-field"><div className="field-label"><span>GAME WORLD</span><small>EXISTING / NO INTEGRATION</small></div><div className="game-value"><span className="game-monogram">C</span><span><b>ChainMMO</b><small>CANONICAL BEST LEVEL</small></span><Mark /></div></div>
          <fieldset className="field-row objective-field"><legend>OBJECTIVE</legend><p className="field-help">Advance from each participant’s own captured baseline.</p><div className="delta-control"><button aria-label="Decrease progression delta" onClick={() => setForm({ ...form, delta: String(Math.max(1, Number(form.delta) - 1)) })}>−</button><output aria-live="polite"><strong>+{form.delta || '0'}</strong><span>BEST LEVELS</span></output><button aria-label="Increase progression delta" onClick={() => setForm({ ...form, delta: String(Number(form.delta || 0) + 1) })}>＋</button></div></fieldset>
          <div className="field-row reward-fields"><div className="field-label"><label htmlFor="reward-input">REWARD PER SUCCESS</label><small>SPONSOR-FUNDED</small></div><div className="field-control"><input id="reward-input" aria-label="Reward per success" type="number" min="0.000000000000000001" step="0.1" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} /><span>MON</span></div></div>
          <div className="field-row reward-fields"><div className="field-label"><label htmlFor="slots-input">REWARD CLAIMS</label><small>MAXIMUM SUCCESSFUL CLAIMS</small></div><div className="field-control"><input id="slots-input" aria-label="Reward slots" type="number" min="1" step="1" value={form.slots} onChange={e => setForm({ ...form, slots: e.target.value })} /><span>PLAYERS</span></div></div>
          <div className="field-row deadline-field"><div className="field-label"><label htmlFor="duration-input">CHALLENGE WINDOW</label><small>FROM CREATION</small></div><div className="field-control select-control"><select id="duration-input" aria-label="Challenge duration" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}><option value="1">24 hours</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select><span aria-hidden="true">⌄</span></div></div>
          <div className="truth-note"><span>RULES, BEFORE LAUNCH</span><p>Each participant is measured against their own canonical best level captured at registration. Rewards go to valid onchain claims. The challenge does not claim chronological first-achievement ordering.</p></div>
        </section>
        <aside className="challenge-review" aria-label="Challenge funding review">
          <div className="review-top"><span>CHALLENGE SPECIFICATION</span><span>FIXED AT LAUNCH</span></div>
          <div className="review-game"><span>GAME / MONAD</span><strong>CHAINMMO</strong><small>PROGRESSION CHALLENGE</small></div>
          <div className="review-rule"><span>OBJECTIVE</span><strong>ADVANCE +{form.delta || '0'} BEST LEVELS</strong></div>
          <div className="review-metric"><span>REWARD / SUCCESS</span><b>{form.reward || '0'} MON</b></div>
          <div className="review-metric"><span>MAXIMUM CLAIMS</span><b>{form.slots || '0'}</b></div>
          <div className="funding-total"><span>REQUIRED SPONSOR FUNDING</span><strong>{totalFunding}<small> MON</small></strong><p>{form.reward || '0'} MON × {form.slots || '0'} reward claims</p></div>
          <button className="button-primary button-wide" disabled={busy || pending || mainnetReadOnly || !wallet || wrongNetwork} onClick={() => void submitCreate()}>{pending ? 'MAINNET DEPLOYMENT PENDING' : mainnetReadOnly ? 'MAINNET WRITES DISABLED' : !wallet ? 'CONNECT WALLET TO CREATE' : wrongNetwork ? 'SWITCH NETWORK TO CONTINUE' : busy ? 'AWAITING TRANSACTION…' : 'CREATE & FUND CHALLENGE'} <Arrow /></button>
          <p className="review-foot">{config.label} / SPONSOR-FUNDED / NO ENTRY FEE</p>
        </aside>
      </div>
    </main>}

    {page === 'detail' && selected && <main className="work-page detail-page">
      <div className="page-return"><button onClick={() => { setPage('discover'); setSelected(null); }}>← ALL COMPETITIONS</button><span>{short(selected)} <button className="copy-address" onClick={() => void copyAddress(selected)}>COPY ADDRESS</button></span></div>
      {!challengeData ? <div className="detail-loading"><span className="loading-rule" /><p>READING CANONICAL CHALLENGE STATE…</p></div> : <>
        <header className="detail-heading">
          <div className="detail-title"><p className="section-code">CHAINMMO / EVENT {String(challenges.findIndex(item => item.toLowerCase() === selected.toLowerCase()) + 1).padStart(3, '0')}</p><h1>PROGRESSION<br /><em>CHALLENGE.</em></h1><div className="detail-objective"><strong>+{challengeData.delta}</strong><span>BEST LEVELS<br />FROM YOUR BASELINE</span></div></div>
          <aside className="event-window"><span>CLAIM WINDOW</span><strong>{remaining(challengeData.deadline)}</strong><small>FIRST VALID CLAIM<br />NOT FIRST ACHIEVEMENT</small></aside>
        </header>
        <div className="detail-layout">
          <section className="participant-panel" aria-label="Participant progress">
            <div className="panel-heading"><span>YOUR CHARACTER / PROGRESSION</span><span>{challengeData.claimed} OF {challengeData.cap} REWARDS CLAIMED</span></div>
            {registration && character ? <div className={`progress-experience ${reached ? 'is-reached' : ''}`}>
              <div className="participant-identity"><span className="character-number">{String(registration.characterId).padStart(3, '0')}</span><div><small>BOUND GAME ENTITY</small><strong>CHARACTER #{registration.characterId.toString()}</strong></div><div className="identity-proof"><span>BASELINE CAPTURED</span><b>CANONICALLY BOUND ✓</b></div></div>
              <div className="level-comparison" aria-label={`Baseline ${registration.baseline}, current best level ${character.bestLevel}, target ${registration.target.toString()}`}>
                <div className="level-value"><span>START</span><strong>{registration.baseline}</strong><small>BASELINE</small></div>
                <div className="level-track"><div className="level-track-line"><span style={{ transform: `scaleX(${progress / 100})` }} /><i style={{ left: `${progress}%` }} /></div><div className="level-track-caption"><span>CANONICAL BEST LEVEL</span><span>{Math.max(0, Math.min(Number(registration.target) - character.bestLevel, Number(registration.target) - registration.baseline))} TO TARGET</span></div><strong className="current-value">{character.bestLevel}<small> CURRENT</small></strong></div>
                <div className="level-value target-value"><span>TARGET</span><strong>{registration.target.toString()}</strong><small>+{Number(registration.target) - registration.baseline}</small></div>
              </div>
              <StateTrace baseline={registration.baseline} current={character.bestLevel} target={Number(registration.target)} reward={formatEther(challengeData.reward)} reached={reached} compact />
              <div className="participant-actions">
                <button className="button-quiet" onClick={() => void checkProgress()} disabled={busy}>REFRESH CANONICAL STATE <span aria-hidden="true">↻</span></button>
                {isLocal && !reached && <button className="button-quiet" onClick={() => void updateProgress()} disabled={busy}>DEMO: PROGRESS CHARACTER <Arrow /></button>}
                {reached && !registration.claimed && remainingSlots > 0 && <button className="button-primary" onClick={() => void claim()} disabled={busy || mainnetReadOnly}>{busy ? 'VERIFYING…' : `VERIFY + CLAIM ${formatEther(challengeData.reward)} MON`} <Arrow /></button>}
              </div>
              {!reached && <div className="progress-message"><span className="status-square" /> <b>KEEP PLAYING</b><span>Current best level is below your target.</span></div>}
              {reached && !registration.claimed && <div className="objective-reached" role="status"><div><span>CANONICAL STATE CHECK</span><h2>OBJECTIVE<br /><em>REACHED.</em></h2></div><strong>{character.bestLevel} / {registration.target.toString()}</strong></div>}
              {reached && registration.claimed && <div className="completion-receipt" role="status"><div className="receipt-heading"><Mark /><span>OBJECTIVE VERIFIED / CANONICAL STATE</span></div><div className="receipt-main"><div><small>CHARACTER #{registration.characterId.toString()}</small><strong>{registration.baseline}<span>→</span>{character.bestLevel}</strong><p>+{challengeData.delta} BEST LEVELS</p></div><div className="receipt-reward"><small>REWARD CLAIMED</small><strong>{formatEther(challengeData.reward)}<span>MON</span></strong></div></div><p className="receipt-caption">This claim was settled by the competition contract.</p></div>}
            </div> : <div className="character-binding">
              <div className="binding-intro"><span className="binding-step">BIND YOUR GAME ENTITY</span><h2>ENTER THE WORLD.</h2><p>Register a ChainMMO character you control. The contract captures its best level as your personal baseline.</p><div className="binding-check"><span>CONNECTED WALLET</span><b>{wallet ? short(wallet.address) : 'CONNECT WALLET TO CONTINUE'}</b></div></div>
              <div className="binding-form"><label htmlFor="character-id">CHAINMMO CHARACTER ID</label><div className="character-input"><span>#</span><input id="character-id" inputMode="numeric" value={characterInput} onChange={e => setCharacterInput(e.target.value)} placeholder="42" /></div>
                {character && <div className={`owner-check ${wallet && character.owner.toLowerCase() === wallet.address.toLowerCase() ? 'owner-match' : 'owner-mismatch'}`} role="status"><span className="owner-symbol">{wallet && character.owner.toLowerCase() === wallet.address.toLowerCase() ? <Mark /> : '!'}</span><div><small>CANONICAL OWNER / BEST LEVEL {character.bestLevel}</small><b>{short(character.owner)}</b></div><span>{wallet && character.owner.toLowerCase() === wallet.address.toLowerCase() ? 'MATCHED' : 'MISMATCH'}</span></div>}
                <div className="binding-actions"><button className="button-quiet" onClick={() => void inspectCharacter()} disabled={!characterInput}>CHECK OWNERSHIP <Arrow diagonal /></button><button className="button-primary button-wide" disabled={busy || pending || mainnetReadOnly || !wallet || !character || character.owner.toLowerCase() !== wallet.address.toLowerCase() || remainingSlots <= 0 || remaining(challengeData.deadline) === 'ENDED'} onClick={() => void register()}>{pending ? 'MAINNET DEPLOYMENT PENDING' : mainnetReadOnly ? 'MAINNET WRITES DISABLED' : !wallet ? 'CONNECT WALLET TO REGISTER' : remainingSlots <= 0 ? 'REWARDS EXHAUSTED' : busy ? 'AWAITING TRANSACTION…' : 'REGISTER CHARACTER'} <Arrow /></button></div>
              </div>
            </div>}
          </section>
          <aside className="event-facts">
            <div className="event-reward"><span>SPONSORED REWARD / SUCCESS</span><strong>{formatEther(challengeData.reward)}<small>MON</small></strong><p>Claimed only after canonical progression is verified.</p><div className="claim-capacity"><span>REWARD SLOTS</span><b>{remainingSlots} / {challengeData.cap} AVAILABLE</b><div><i style={{ transform: `scaleX(${challengeData.cap ? challengeData.claimed / challengeData.cap : 0})` }} /></div></div></div>
            <dl className="event-facts-list"><div><dt>GAME STATE</dt><dd>CANONICAL / CHAINMMO</dd></div><div><dt>SETTLEMENT</dt><dd>FIRST VALID CLAIM</dd></div><div><dt>CREATOR</dt><dd>{short(challengeData.creator)} {wallet && isCreator ? '(YOU)' : ''}</dd></div><div><dt>PROFILE</dt><dd><button className="copy-address" onClick={() => void copyAddress(challengeData.profile)}>{short(challengeData.profile)} / COPY</button></dd></div></dl>
            {isCreator && remaining(challengeData.deadline) === 'ENDED' && !challengeData.fundsReclaimed && <button className="button-quiet reclaim-action" onClick={() => void reclaim()} disabled={busy || mainnetReadOnly}>RECLAIM UNUSED FUNDING <Arrow diagonal /></button>}
            {isCreator && challengeData.fundsReclaimed && <div className="reclaimed-note">UNUSED FUNDING RECLAIMED</div>}
            <p className="trust-note">The game developer never built this competition. Arovaq reads canonical ChainMMO state directly.</p>
          </aside>
        </div>
      </>}
    </main>}
    <Footer compact={page !== 'discover'} />
  </div>;
}

function ChallengeCard({ address, number, onOpen }: { address: Address; number: number; onOpen: () => void }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void getChallenge(address).then(setChallenge).catch(() => setError(true)); }, [address]);
  if (error) return <div className="event-row broken-event"><span className="event-number">{String(number).padStart(3, '0')}</span><span>CHALLENGE DATA UNAVAILABLE</span><button className="button-quiet" onClick={onOpen}>INSPECT EVENT <Arrow diagonal /></button></div>;
  if (!challenge) return <div className="event-row event-loading" aria-label="Loading challenge"><span className="loading-rule" /></div>;
  return <button className="event-row" onClick={onOpen} aria-label={`EVENT / ${String(number).padStart(2, '0')} — ChainMMO progression challenge`}>
    <span className="event-number">{String(number).padStart(3, '0')}</span><span className="event-objective"><small>CHAINMMO / PROGRESSION</small><strong>ADVANCE +{challenge.delta} BEST LEVELS</strong></span><span className="event-reward-cell"><small>REWARD</small><b>{formatEther(challenge.reward)} MON</b></span><span className="event-slots-cell"><small>CLAIMS LEFT</small><b>{challenge.cap - challenge.claimed} / {challenge.cap}</b></span><span className="event-window-cell"><small>WINDOW</small><b>{remaining(challenge.deadline)}</b></span><span className="event-open">OPEN EVENT <Arrow diagonal /></span>
  </button>;
}

function WorldReadProbe() {
  const [total, setTotal] = useState<bigint | null>(null);
  const [id, setId] = useState('42');
  const [read, setRead] = useState<{ owner: Address; bestLevel: number; lastLevelUpEpoch: number; block: bigint } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    Promise.all([getTotalCharacters(), publicClient.getChainId()]).then(([count, chainId]) => {
      if (alive && chainId === config.chainId) setTotal(count);
      else if (alive) setError(`RPC is on chain ${chainId}; expected Monad Mainnet (143).`);
    }).catch(e => { if (alive) setError(friendlyError(e)); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);
  async function readCharacter() {
    setError(''); setRead(null);
    try {
      const chainId = await publicClient.getChainId();
      if (chainId !== config.chainId) throw new Error(`RPC is on chain ${chainId}; expected Monad Mainnet (143).`);
      const [result, block] = await Promise.all([getCharacter(BigInt(id)), publicClient.getBlockNumber()]);
      setRead({ ...result, block });
    } catch (e) { setError(friendlyError(e)); }
  }
  return <section id="chainmmo-live" className="world-proof" aria-labelledby="world-proof-title">
    <div className="world-proof-copy"><p className="section-code">EXTERNAL WORLD / LIVE READ</p><h2 id="world-proof-title">THE GAME<br />IS ALREADY <em>LIVE.</em></h2><p>ChainMMO remains independent. Arovaq reads its canonical getters directly; no game integration or settlement backend is involved.</p><div className="live-total"><span>CANONICAL CHARACTERS</span><strong>{busy ? '…' : total?.toLocaleString() ?? '—'}</strong><small>MONAD MAINNET / CHAIN 143</small></div></div>
    <div className="world-read-console"><div className="read-console-heading"><span>CHAINMMO GAMEWORLD</span><span>RPC / READ ONLY</span></div><label htmlFor="world-character-id">CHARACTER ID</label><div className="read-character-form"><span>#</span><input id="world-character-id" inputMode="numeric" value={id} onChange={e => setId(e.target.value)} /><button onClick={() => void readCharacter()} disabled={!id}>READ CANONICAL STATE <Arrow /></button></div>
      {read && <div className="live-read-values"><div><small>CANONICAL OWNER</small><b>{short(read.owner)}</b></div><div><small>BEST LEVEL</small><b>{read.bestLevel}</b></div><div><small>LAST LEVEL-UP EPOCH</small><b>{read.lastLevelUpEpoch}</b></div><div><small>READ AT BLOCK</small><b>{read.block.toString()}</b></div></div>}
      {error && <p className="read-error" role="status">{error}</p>}
      <div className="contract-address"><span>GAMEWORLD ADDRESS</span><code>0x3c6e…8FB77</code></div>
    </div>
  </section>;
}

function Footer({ compact = false }: { compact?: boolean }) {
  return <footer className={`site-footer ${compact ? 'footer-compact' : ''}`}><span className="footer-name"><b>AROVAQ</b><small>AH-ro-vak</small></span><span className="footer-thesis">THE WORLD BELONGS TO THE GAME.<br />THE COMPETITION BELONGS TO EVERYONE.</span><span className="footer-proof">CANONICAL STATE / MONAD <Arrow diagonal /></span></footer>;
}
