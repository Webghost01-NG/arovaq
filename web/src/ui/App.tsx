import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEther, parseEther, type Address, type Hash } from 'viem';
import { config, MAINNET_PENDING } from '../config/environment';
import {
  assertNetwork, claimReward, connectWallet, createChallenge, demoProgress, discoverChallenges,
  getChallenge, getCharacter, getRegistration, getTotalCharacters, publicClient, reclaimExpired, registerCharacter,
  switchNetwork, waitForConfirmation, type Challenge, type Registration, type WalletState,
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

  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={() => { setPage('discover'); setSelected(null); }} aria-label="Arovaq home"><span className="brand-mark">A</span><span>AROVAQ</span><i>COMPETITION LAYER</i></button>
      <nav><button className={page === 'discover' ? 'nav-active' : ''} onClick={() => { setPage('discover'); setSelected(null); }}>Explore</button><button className={page === 'create' ? 'nav-active' : ''} onClick={() => { setPage('create'); setSelected(null); }}>Create</button></nav>
      <div className="top-actions"><span className={`env-pill ${config.mode.toLowerCase()}`}><b />{config.label}</span>{wallet ? <button className="wallet-btn connected" aria-label={`Disconnect wallet ${wallet.address}`} onClick={() => setWallet(null)}>{short(wallet.address)} <span>⌄</span></button> : <button className="wallet-btn" onClick={connect} disabled={busy}>{busy ? 'CONNECTING…' : 'CONNECT WALLET'}</button>}</div>
    </header>

    {wrongNetwork && <div className="network-banner"><span>Wallet network does not match {config.label}.</span><button onClick={async () => { if (wallet) try { await switchNetwork(wallet); setWrongNetwork(false); } catch (e) { setFlash({ kind: 'error', message: friendlyError(e) }); } }}>SWITCH NETWORK</button></div>}
    {pending && <div className="pending-banner"><span><b>MAINNET DEPLOYMENT PENDING</b> — {MAINNET_PENDING}</span><span>READ-ONLY CHAINMMO ACCESS REMAINS AVAILABLE</span></div>}
    {mainnetReadOnly && <div className="pending-banner"><span><b>MAINNET WRITE ACCESS DISABLED</b> — Arovaq contracts are configured for read-only inspection.</span><span>NO WALLET WRITE WILL BE REQUESTED</span></div>}
    {config.mode === 'MONAD_MAINNET' && <WorldReadProbe />}
    {flash && <div className={`flash ${flash.kind}`} role="status"><span>{flash.kind === 'success' ? '✓' : flash.kind === 'error' ? '!' : '↗'}</span><p>{flash.message}</p><button aria-label="Dismiss message" onClick={() => setFlash(null)}>×</button></div>}

    {page === 'discover' && <>
      <main className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="line" /> COMMUNITY LIVEOPS / 001</div><h1>THE WORLD<br />IS <em>ALREADY</em><br />IN MOTION<span className="period">.</span></h1><p>New ways to compete around games you don't control. Built by the communities that play them.</p><div className="hero-buttons"><button className="primary" onClick={() => document.getElementById('competitions')?.scrollIntoView({ behavior: 'smooth' })}>EXPLORE CHALLENGES <span>↘</span></button><button className="secondary" onClick={() => setPage('create')}>CREATE A CHALLENGE <span>＋</span></button></div><div className="hero-note"><span className="pulse" /> NO GAME INTEGRATION REQUIRED</div></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" /><div className="core"><span>WORLD<br />STATE</span><strong>↗</strong></div><div className="art-tag tag-top"><small>SUPPORTED METRIC</small><b>BEST_LEVEL / MONOTONIC</b></div><div className="art-tag tag-bottom"><small>CHAINMMO / CANONICAL STATE</small><b>NO GAME INTEGRATION</b></div><div className="coord">STATE IS THE SOURCE<br />Arovaq reads what the game stores.</div></div>
      </main>
      <section className="signal-strip"><span>01 / THE GAME</span><b>→</b><span>02 / CANONICAL STATE</span><b>→</b><span>03 / COMMUNITY COMPETITION</span><b>→</b><span>04 / REWARD</span></section>
      <section className="explain"><div className="section-label">A NEW LAYER, NOT A NEW WORLD</div><div><h2>The game owns the world.<br /><em>The community sets the stakes.</em></h2><p>Players keep playing the original game. Arovaq reads its canonical state and lets anyone build a supported challenge around it.</p></div><div className="explain-proof"><span>EXISTING ONCHAIN GAME</span><i>↓</i><span>CANONICAL GAME STATE</span><i>↓</i><strong>COMMUNITY REWARD</strong></div></section>
      <section id="competitions" className="competition-section"><div className="section-heading"><div><div className="section-label">OPEN EVENTS / CHAINMMO</div><h2>COMPETE <em>NOW</em></h2></div><button className="text-link" onClick={() => void refreshList()}>REFRESH ↻</button></div>
        {loading ? <div className="empty-card"><div className="loader" /><p>Reading competition events from Arovaq…</p></div> : challenges.length ? <div className="cards">{challenges.map((address, index) => <ChallengeCard key={address} address={address} number={index + 1} onOpen={() => void chooseChallenge(address)} />)}</div> : <div className="empty-card"><div className="empty-symbol">＋</div><div><h3>{pending ? 'THE FIRST COMPETITION IS WAITING.' : 'NO ACTIVE COMPETITIONS.'}</h3><p>{pending ? 'Mainnet challenges appear here after Arovaq is deployed. Explore the ChainMMO world while we prepare.' : 'Create a ChainMMO progression challenge and invite your community into the game.'}</p><button className="text-link" onClick={() => setPage('create')}>CREATE FIRST CHALLENGE ↗</button></div></div>}
      </section>
      <Footer />
    </>}

    {page === 'create' && <main className="page-wrap"><div className="backline"><button onClick={() => setPage('discover')}>← BACK TO EXPLORE</button><span>CREATOR STUDIO / 001</span></div><div className="page-title"><div className="section-label">COMMUNITY LIVEOPS</div><h1>SET A NEW<br /><em>CHALLENGE.</em></h1><p>Build a progression objective around canonical ChainMMO state. Your rules and reward are fixed once created.</p></div>
      <div className="create-grid"><section className="form-panel"><div className="panel-top"><span>01 — CONFIGURE</span><span>CHAINMMO / MONAD</span></div><div className="field-group"><label>GAME WORLD</label><div className="selected-game"><div className="game-glyph">C</div><div><b>ChainMMO</b><small>CANONICAL GAME STATE / BEST LEVEL</small></div><span className="check">✓</span></div></div><div className="field-group"><label>PROGRESSION OBJECTIVE</label><div className="delta-control"><button aria-label="Decrease progression delta" onClick={() => setForm({ ...form, delta: String(Math.max(1, Number(form.delta) - 1)) })}>−</button><div><small>ADVANCE</small><strong>+{form.delta || '0'} <i>LEVELS</i></strong></div><button aria-label="Increase progression delta" onClick={() => setForm({ ...form, delta: String(Number(form.delta || 0) + 1) })}>＋</button></div></div><div className="form-row"><div className="field-group"><label>REWARD / SUCCESS</label><div className="input-unit"><input aria-label="Reward per success" type="number" min="0.000000000000000001" step="0.1" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} /><span>MON</span></div></div><div className="field-group"><label>REWARD SLOTS</label><div className="input-unit"><input aria-label="Reward slots" type="number" min="1" step="1" value={form.slots} onChange={e => setForm({ ...form, slots: e.target.value })} /><span>PLAYERS</span></div></div></div><div className="field-group"><label>CHALLENGE DEADLINE</label><div className="select-wrap"><select aria-label="Challenge duration" value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}><option value="1">24 hours</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select><span>⌄</span></div></div><div className="notice"><span>i</span><p>Each participant is measured against their own canonical best level captured when they register. Rewards go to valid onchain claims. This challenge does not claim chronological first-achievement ordering.</p></div></section>
      <aside className="review-panel"><div className="panel-top"><span>02 — REVIEW & FUND</span><span>FIXED ON CREATION</span></div><div className="review-art"><div className="mini-orbit"/><span>CHAINMMO<br />PROGRESSION</span></div><div className="review-objective"><small>OBJECTIVE</small><strong>ADVANCE <em>+{form.delta}</em> BEST LEVELS</strong></div><div className="math-row"><span>REWARD / COMPLETION</span><b>{form.reward || '0'} MON</b></div><div className="math-row"><span>MAXIMUM CLAIMS</span><b>{form.slots || '0'}</b></div><div className="funding-total"><span>REQUIRED FUNDING</span><strong>{totalFunding} <small>MON</small></strong><p>{form.reward || '0'} MON × {form.slots || '0'} reward slots</p></div><button className="primary full" disabled={busy || pending || mainnetReadOnly || !wallet || wrongNetwork} onClick={() => void submitCreate()}>{pending ? 'AWAITING MAINNET DEPLOYMENT' : mainnetReadOnly ? 'MAINNET WRITES DISABLED' : !wallet ? 'CONNECT WALLET TO CREATE' : wrongNetwork ? 'SWITCH NETWORK TO CONTINUE' : busy ? 'AWAITING TRANSACTION…' : 'CREATE & FUND CHALLENGE ↗'}</button><div className="review-foot">{config.label} · SPONSOR-FUNDED · NON-CUSTODIAL RULES</div></aside></div>
    </main>}

    {page === 'detail' && selected && <main className="page-wrap"><div className="backline"><button onClick={() => { setPage('discover'); setSelected(null); }}>← ALL COMPETITIONS</button><span>{short(selected)} <button className="copy" onClick={() => void copyAddress(selected)}>COPY</button></span></div>{!challengeData ? <div className="empty-card"><div className="loader" /><p>Reading challenge and canonical profile…</p></div> : <>
      <div className="detail-head"><div><div className="section-label">CHAINMMO / PROGRESSION CHALLENGE</div><h1>ADVANCE <em>+{challengeData.delta}</em><br />BEST LEVELS.</h1></div><div className="deadline-box"><span>CHALLENGE WINDOW</span><b>{remaining(challengeData.deadline)}</b><small>FIRST VALID CLAIM / NOT FIRST ACHIEVEMENT</small></div></div>
      <div className="detail-grid"><section className="detail-main"><div className="panel-top"><span>PARTICIPANT PROGRESS</span><span>{challengeData.claimed} / {challengeData.cap} REWARDS CLAIMED</span></div>{registration && character ? <div className="progress-card"><div className="character-line"><span className="character-icon">{String(registration.characterId).padStart(2, '0')}</span><div><small>REGISTERED CHARACTER</small><strong>#{registration.characterId.toString()}</strong></div><span className="bound">CANONICALLY BOUND ✓</span></div><div className="level-track"><div className="level-point"><small>STARTING</small><strong>{registration.baseline}</strong></div><div className="progress-rail" role="progressbar" aria-label="Challenge progression" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }} /><span style={{ left: `${progress}%` }} /></div><div className="level-point target"><small>TARGET</small><strong>{registration.target.toString()}</strong></div></div><div className="current-level"><span>CURRENT BEST LEVEL</span><strong>{character.bestLevel}</strong><small>{observedLevel === null ? 'NOT REFRESHED' : 'CANONICAL STATE · JUST READ'}</small></div><div className="progress-caption"><span>{Math.max(0, Math.min(Number(registration.target) - character.bestLevel, Number(registration.target) - registration.baseline))} levels remaining</span><span>{Math.min(Math.max(character.bestLevel - registration.baseline, 0), Number(registration.target) - registration.baseline)} / {Number(registration.target) - registration.baseline} LEVELS</span></div><div className="action-row"><button className="secondary" onClick={() => void checkProgress()} disabled={busy}>REFRESH GAME STATE ↻</button>{isLocal && <button className="secondary" onClick={() => void updateProgress()} disabled={busy}>DEMO: PROGRESS CHARACTER ↗</button>}{reached && !registration.claimed && remainingSlots > 0 && <button className="primary" onClick={() => void claim()} disabled={busy || mainnetReadOnly}>{busy ? 'VERIFYING…' : `CLAIM ${formatEther(challengeData.reward)} MON ↗`}</button>}</div>{reached && registration.claimed && <div className="completion"><div className="completion-mark">✓</div><div><small>OBJECTIVE VERIFIED</small><h3>REWARD CLAIMED</h3><p>Character #{registration.characterId.toString()} advanced from {registration.baseline} to {character.bestLevel}. Canonical game state verified.</p></div><strong>{formatEther(challengeData.reward)}<small> MON</small></strong></div>}{!reached && <div className="keep-playing"><span className="pulse" /> KEEP PLAYING <small>Current canonical best level is below your target.</small></div>}</div> : <div className="join-card"><div className="join-copy"><div className="section-label">ENTER THE WORLD</div><h2>YOUR NEXT<br /><em>LEVEL STARTS HERE.</em></h2><p>Register a character you control. Arovaq captures its canonical best level as your personal baseline.</p></div><div className="join-form"><label htmlFor="character-id">CHAINMMO CHARACTER ID</label><div className="input-unit"><input id="character-id" inputMode="numeric" value={characterInput} onChange={e => setCharacterInput(e.target.value)} placeholder="e.g. 42" /><span>#</span></div>{character && <div className={`owner-result ${wallet && character.owner.toLowerCase() === wallet.address.toLowerCase() ? 'valid' : 'invalid'}`}><span>{wallet && character.owner.toLowerCase() === wallet.address.toLowerCase() ? '✓' : '!'}</span><div><small>CANONICAL OWNER · BEST LEVEL {character.bestLevel}</small><b>{short(character.owner)}</b></div></div>}<button className="secondary full" onClick={() => void inspectCharacter()} disabled={!characterInput}>CHECK CHARACTER ↗</button><button className="primary full" disabled={busy || pending || mainnetReadOnly || !wallet || !character || character.owner.toLowerCase() !== wallet.address.toLowerCase() || remainingSlots <= 0 || remaining(challengeData.deadline) === 'ENDED'} onClick={() => void register()}>{pending ? 'MAINNET DEPLOYMENT PENDING' : mainnetReadOnly ? 'MAINNET WRITES DISABLED' : !wallet ? 'CONNECT WALLET TO REGISTER' : remainingSlots <= 0 ? 'REWARDS EXHAUSTED' : busy ? 'AWAITING TRANSACTION…' : 'REGISTER CHARACTER ↗'}</button></div></div>}
      </section><aside className="detail-aside"><div className="reward-tile"><span>SPONSORED REWARD</span><strong>{formatEther(challengeData.reward)} <small>MON</small></strong><p>Per valid completion</p><div className="slot-meter"><div style={{ width: `${challengeData.cap ? challengeData.claimed / challengeData.cap * 100 : 0}%` }} /></div><small>{remainingSlots} OF {challengeData.cap} SLOTS REMAINING</small></div><div className="facts"><div><span>CREATOR</span><b>{short(challengeData.creator)} {wallet && isCreator ? '(YOU)' : ''}</b></div><div><span>GAME STATE</span><b>CANONICAL / CHAINMMO</b></div><div><span>SETTLEMENT</span><b>FIRST VALID CLAIM</b></div><div><span>PROFILE</span><button className="copy" onClick={() => void copyAddress(challengeData.profile)}>{short(challengeData.profile)} COPY</button></div></div>{isCreator && remaining(challengeData.deadline) === 'ENDED' && !challengeData.fundsReclaimed && <button className="secondary full" onClick={() => void reclaim()} disabled={busy || mainnetReadOnly}>RECLAIM UNUSED FUNDING ↗</button>}{isCreator && challengeData.fundsReclaimed && <div className="reclaimed-note">UNUSED FUNDING RECLAIMED</div>}<p className="trust-note">The game developer never built this competition. Arovaq reads canonical ChainMMO state directly.</p></aside></div>
    </>}</main>}
    <Footer compact />
  </div>;
}

function ChallengeCard({ address, number, onOpen }: { address: Address; number: number; onOpen: () => void }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void getChallenge(address).then(setChallenge).catch(() => setError(true)); }, [address]);
  if (error) return <div className="challenge-card broken"><span>EVENT / {String(number).padStart(2, '0')}</span><p>Challenge data is unavailable.</p><button onClick={onOpen}>INSPECT ↗</button></div>;
  if (!challenge) return <div className="challenge-card loading-card"><div className="loader" /></div>;
  return <button className="challenge-card" onClick={onOpen}><div className="card-top"><span>EVENT / {String(number).padStart(2, '0')}</span><span className="live-dot">● {remaining(challenge.deadline)}</span></div><div className="card-game">CHAINMMO <span>PROGRESSION</span></div><h3>ADVANCE <em>+{challenge.delta}</em><br />BEST LEVELS</h3><div className="card-reward"><small>REWARD / COMPLETION</small><strong>{formatEther(challenge.reward)} <i>MON</i></strong></div><div className="card-bottom"><span>{challenge.cap - challenge.claimed} / {challenge.cap} REWARDS LEFT</span><b>ENTER ↗</b></div></button>;
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
  return <section className="world-probe"><div className="probe-intro"><div className="section-label">EXTERNAL WORLD / LIVE READ</div><h2>THE GAME IS<br /><em>ALREADY HERE.</em></h2><p>Direct read-only calls to the deployed ChainMMO GameWorld on Monad. No Arovaq transaction is available in this build.</p><div className="probe-total"><small>CANONICAL CHARACTERS</small><strong>{busy ? '…' : total?.toLocaleString() ?? '—'}</strong><span>CHAIN ID 143 / MONAD MAINNET</span></div></div><div className="probe-card"><div className="panel-top"><span>GAMEWORLD / CHARACTER READ</span><span>RPC · READ ONLY</span></div><label htmlFor="world-character-id">CHARACTER ID</label><div className="probe-search"><span>#</span><input id="world-character-id" inputMode="numeric" value={id} onChange={e => setId(e.target.value)} /><button onClick={() => void readCharacter()} disabled={!id}>READ STATE ↗</button></div>{read && <div className="probe-result"><div><small>CANONICAL OWNER</small><b>{short(read.owner)}</b></div><div><small>BEST LEVEL</small><b>{read.bestLevel}</b></div><div><small>LAST LEVEL-UP EPOCH</small><b>{read.lastLevelUpEpoch}</b></div><div><small>READ AT BLOCK</small><b>{read.block.toString()}</b></div></div>}{error && <p className="probe-error" role="status">{error}</p>}<div className="probe-address"><small>CHAINMMO GAMEWORLD</small><code>0x3c6e…8FB77</code></div></div></section>;
}
function Footer({ compact = false }: { compact?: boolean }) {
  return <footer className={compact ? 'footer compact' : 'footer'}><span className="footer-brand">AROVAQ <i>AH-ro-vak</i></span><span>THE WORLD BELONGS TO THE GAME.<br />THE COMPETITION BELONGS TO EVERYONE.</span><span>BUILT ON CANONICAL STATE <b>↗</b></span></footer>;
}
