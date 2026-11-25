import { getTopology, isFullPPE } from '../sim/state.js';
import { getLotoSteps, MISSION_TITLES } from '../sim/missions.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function buildIso7010ArcSvg(size = 56) {
  return `
    <svg viewBox="0 0 100 92" width="${size}" height="${Math.round(size * 0.92)}" role="img" aria-label="ISO 7010 W012 High Voltage Arc-Flash Hazard">
      <defs>
        <radialGradient id="arcPlasmaGrad" cx="50%" cy="62%" r="48%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="38%" stop-color="#ffd54f"/>
          <stop offset="75%" stop-color="#ff6d00"/>
          <stop offset="100%" stop-color="#d50000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="54" r="38" fill="url(#arcPlasmaGrad)">
        <animate attributeName="r" values="32;42;32" dur="0.75s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.9;0.35;0.9" dur="0.75s" repeatCount="indefinite"/>
      </circle>
      <polygon points="50,6 95,84 5,84" fill="#f5c400" stroke="#111315" stroke-width="6.5" stroke-linejoin="round"/>
      <polygon points="50,14 87,79 13,79" fill="none" stroke="#111315" stroke-width="1.6" stroke-linejoin="round" opacity="0.35"/>
      <polygon points="50,36 55,47 67,44 58,53 69,62 56,60 59,72 50,63 41,72 44,60 31,62 42,53 33,44 45,47" fill="#d82b1e" opacity="0.88">
        <animate attributeName="opacity" values="0.95;0.45;0.95" dur="0.38s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="53,24 36,52 49,52 42,74 66,45 52,45" fill="#111315"/>
      <polygon points="42,74 37,66 47,68" fill="#111315"/>
    </svg>
  `;
}

/**
 * Wires the slim top bar, command rail drawers (Checklist, PPE & Tools, Megger,
 * Help), and modal dialogs (PTW/SFT, Single-Line Diagram, Interlock Manual, Notices).
 */
export function initHud({ sim, actions, audio, onSwitchMission, onResetMission }) {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  let _arcBannerTimer = null;
  let _lastArcModalData = null;
  let activeDrawerTab = 'CHECKLIST';

  function syncToastHostOffset() {
    const banner = $('arcFlashHudBanner');
    const host = $('toastHost');
    if (!host) return;
    if (banner && !banner.hidden) {
      const h = banner.offsetHeight || 150;
      host.style.top = `${(banner.offsetTop || 72) + h + 8}px`;
    } else {
      host.style.top = '';
    }
  }

  function showNotice(title, html) {
    const dlg = $('noticeDialog');
    const ttl = $('noticeTitle');
    const bdy = $('noticeBody');
    if (!dlg) return;
    ttl.textContent = title;
    bdy.innerHTML = html;
    if (!dlg.open && typeof dlg.showModal === 'function') dlg.showModal();
  }

  function openLastArcFlashModal() {
    if (_lastArcModalData) showNotice(_lastArcModalData.modalTitle, _lastArcModalData.modalHtml);
  }

  function dismissArcFlashBanner() {
    const banner = $('arcFlashHudBanner');
    if (banner) banner.hidden = true;
    syncToastHostOffset();
    if (_arcBannerTimer) {
      clearTimeout(_arcBannerTimer);
      _arcBannerTimer = null;
    }
  }

  function showArcFlashBanner(title, reason, ptsLabel = '-5 PTS', isDemo = false) {
    const banner = $('arcFlashHudBanner');
    if (!banner) return;
    const cub = sim.cubicles[sim.selectedCubicle] || sim.cubicles['BT-M1'];
    banner.innerHTML = `
      <div class="arc-hud-svg">${buildIso7010ArcSvg(56)}</div>
      <div class="arc-hud-body">
        <div class="arc-hud-eyebrow">
          <span>ISO 7010 W012 · NFPA 70E HRC 4</span>
          <span>40 cal/cm² · 6,600 V AC · 40 kA</span>
          <span style="color:#ff8a80;">${esc(ptsLabel)}</span>
        </div>
        <div class="arc-hud-title">${esc(title)}</div>
        <div class="arc-hud-sub">${esc(reason)} (Bay: ${esc(cub.code)} · ${esc(cub.id)})</div>
      </div>
      <div class="arc-hud-actions">
        <button type="button" class="btn btn-xs btn-danger" id="btnArcBannerReport">NFPA 70E Report</button>
        <button type="button" class="btn btn-xs" id="btnArcBannerDismiss" style="background:#26292e;color:#f4f3ef;border-color:#4b525c;">Dismiss</button>
      </div>
    `;
    banner.querySelector('#btnArcBannerReport')?.addEventListener('click', openLastArcFlashModal);
    banner.querySelector('#btnArcBannerDismiss')?.addEventListener('click', dismissArcFlashBanner);
    banner.hidden = false;
    syncToastHostOffset();
    if (_arcBannerTimer) clearTimeout(_arcBannerTimer);
    _arcBannerTimer = setTimeout(() => {
      if (banner) banner.hidden = true;
      syncToastHostOffset();
    }, isDemo ? 7500 : 8500);
  }

  function showToast(text, tone = 'info') {
    const host = $('toastHost');
    if (!host) return;
    const m = /^\[(Interlock Block|ARC-FLASH HAZARD) (-\d+) pts\] (.*)$/.exec(text);
    const tier = m ? (m[1] === 'Interlock Block' ? 1 : 2) : 0;
    const kind = tier === 1 ? 'tier1' : tier === 2 ? 'tier2' : ({ safe: 'safe', warn: 'warn', danger: 'danger' }[tone] || 'info');
    const icon = { tier1: '#i-lock', tier2: '#i-alert', safe: '#i-check', warn: '#i-alert', danger: '#i-alert', info: '#i-info' }[kind];
    const item = document.createElement('div');
    item.className = `toast t-${kind}`;
    item.setAttribute('role', kind === 'tier2' || kind === 'danger' ? 'alert' : 'status');
    item.innerHTML = `<span class="t-ic"><svg class="ic"><use href="${icon}"/></svg></span><span class="t-title"></span><span class="t-score"></span>`;
    if (tier) {
      const cub = sim.cubicles[sim.selectedCubicle] || sim.cubicles['BT-M1'];
      item.querySelector('.t-title').textContent = `${tier === 1 ? 'Interlock block' : 'Arc-flash hazard'} · ${m[3]}`;
      item.querySelector('.t-score').textContent = `${m[2].replace('-', '−')} · ${sim.score}/100`;
      const meta = document.createElement('span');
      meta.className = 't-meta';
      meta.innerHTML = `<span class="state-flag ${tier === 2 ? 'solid red' : 'earth'}"><svg class="ic"><use href="${tier === 2 ? '#i-alert' : '#i-lock'}"/></svg>TIER ${tier}</span><span class="t-bay"></span><button type="button" class="btn btn-xs btn-quiet t-why">Why?</button>`;
      meta.querySelector('.t-bay').textContent = `${cub.code} · ${cub.id}`;
      meta.querySelector('.t-why').addEventListener('click', openLastArcFlashModal);
      item.appendChild(meta);
    } else {
      item.querySelector('.t-title').textContent = text;
    }
    host.appendChild(item);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    setTimeout(() => { if (item.parentNode) item.parentNode.removeChild(item); }, tier ? 6000 : 3200);
  }

  function logEvent(text, tone = null) {
    const el = $('bottomStatusEvent');
    if (el) el.textContent = `Last event: ${text}`;
    if (tone) showToast(text, tone);
  }

  function handleViolation({ pts, title, reason, catastrophic, cub }) {
    if (catastrophic) {
      const vig = $('arcFlashVignette');
      if (vig) {
        vig.classList.remove('active');
        void vig.offsetWidth;
        vig.classList.add('active');
      }
      const modalTitle = `ISO 7010 W012 · 6.6 kV Arc-Flash Hazard (-${pts} pts)`;
      const modalHtml = `
        <div class="nfpa-modal-card">
          <div class="nfpa-header">
            <div>${buildIso7010ArcSvg(46)}</div>
            <div class="nfpa-header-text">
              <h4>DANGER — HIGH VOLTAGE ARC-FLASH &amp; SHOCK HAZARD</h4>
              <span>ISO 7010 W012 · NFPA 70E PPE Category 4 · STCW Table A-III/6</span>
            </div>
          </div>
          <div class="nfpa-body">
            <p style="font-size:14px;color:#ffffff;"><strong>${esc(title)}</strong></p>
            <p style="color:#cbd5e1;line-height:1.45;">${esc(reason)}</p>
            <div class="nfpa-metrics">
              <div class="nfpa-metric"><span>Nominal System</span><strong>6,600 V · 3Ø 60 Hz</strong></div>
              <div class="nfpa-metric"><span>Incident Energy</span><strong>40.0 cal/cm² @ 450 mm</strong></div>
              <div class="nfpa-metric"><span>Short-Circuit Isc</span><strong>40 kA Sym (3s)</strong></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid rgba(255,255,255,0.16);font-family:var(--font-mono);font-size:12px;color:#e2e8f0;">
              <span>Active Cubicle: <strong>${esc(cub.code)} (${esc(cub.id)})</strong></span>
              <span style="color:#ff8a80;font-weight:700;">Score: ${sim.score} / 100 (-${pts} pts)</span>
            </div>
          </div>
        </div>
      `;
      _lastArcModalData = { modalTitle, modalHtml };
      showArcFlashBanner(title, reason, `-${pts} PTS`, false);
      showNotice(modalTitle, modalHtml);
    } else {
      const modalTitle = `Mechanical / Procedural Interlock (-${pts} pts)`;
      const modalHtml = `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;background:var(--earth-tint);border:1px solid var(--earth-line);border-radius:var(--r);">
          <svg class="ic" style="width:28px;height:28px;color:var(--earth);flex-shrink:0;margin-top:2px;"><use href="#i-lock"/></svg>
          <div>
            <p style="margin-bottom:4px;color:var(--text);"><strong>${esc(title)}</strong></p>
            <p style="color:var(--text-2);font-size:13px;line-height:1.45;">${esc(reason)}</p>
          </div>
        </div>
        <p style="margin-top:10px;font-family:var(--font-mono);font-size:12px;display:flex;justify-content:space-between;">
          <span>Cubicle: <strong>${esc(cub.code)} · ${esc(cub.id)}</strong></span>
          <span>Assessment Score: <strong>${sim.score} / 100 (-${pts} pts)</strong></span>
        </p>
      `;
      _lastArcModalData = { modalTitle, modalHtml };
      if (sim.mode === 'EXAM') showNotice(modalTitle, modalHtml);
    }
  }

  function openPtwModal() {
    const bdy = $('ptwModalBody');
    if (!bdy) return;
    bdy.innerHTML = `
      <div style="background:var(--surface-2);padding:12px;border:1px solid var(--line);border-radius:var(--r);font-family:var(--font-mono);font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div>Permit Ref: <strong>PTW-HV-6600-0${sim.missionId}A</strong></div>
        <div>Apparatus: <strong>${esc(sim.selectedCubicle)}</strong></div>
        <div>PTW Status: <strong>${sim.ptw.active ? 'ACTIVE & AUTHORIZED' : sim.ptw.cancelled ? 'CANCELLED' : 'PENDING'}</strong></div>
        <div>SFT Status: <strong>${sim.sft.active ? 'SANCTION-FOR-TEST ACTIVE' : 'INACTIVE'}</strong></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:13.5px;color:var(--text-2);margin-top:10px;">
        <div>1. Disconnected completely from all HV &amp; LV back-feed sources</div>
        <div>2. Secured against re-connection via LOTO padlocks &amp; Castell trapped keys</div>
        <div>3. Verified dead at point of work via 6.6 kV Prove–Test–Prove</div>
        <div>4. Earthed and short-circuited via Integral EK6 Earth Switch / CME</div>
        <div>5. Adjacent live 6.6 kV red busbar shutters padlocked &amp; notices posted</div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap;">
        ${!sim.ptw.active
          ? '<button type="button" class="btn btn-primary" id="btnDlgIssuePtw">Sign &amp; Issue PTW</button>'
          : '<button type="button" class="btn btn-danger" id="btnDlgCancelPtw">Cancel Active PTW</button>'}
        ${sim.missionId === 3 && !sim.sft.active
          ? '<button type="button" class="btn btn-test" id="btnDlgIssueSft">Issue Sanction-for-Test (SFT)</button>'
          : ''}
        ${sim.sft.active
          ? '<button type="button" class="btn btn-danger" id="btnDlgCancelSft">Cancel Active SFT</button>'
          : ''}
      </div>
    `;
    const dlg = $('ptwDialog');
    bdy.querySelector('#btnDlgIssuePtw')?.addEventListener('click', () => { actions.issuePTW(); dlg.close(); });
    bdy.querySelector('#btnDlgCancelPtw')?.addEventListener('click', () => { actions.cancelPTW(); dlg.close(); });
    bdy.querySelector('#btnDlgIssueSft')?.addEventListener('click', () => { actions.issueSFT(); dlg.close(); });
    bdy.querySelector('#btnDlgCancelSft')?.addEventListener('click', () => { actions.cancelSFT(); dlg.close(); });
    dlg.showModal();
  }

  function openSldModal() {
    const bdy = $('sldModalBody');
    const dlg = $('sldDialog');
    if (!bdy || !dlg) return;
    const topo = getTopology(sim);
    bdy.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:13px;color:var(--text-2);">Port &amp; Starboard Main HV Switchboard Bus Architecture (Live State)</span>
        <span class="small-badge">IEC 60092-503</span>
      </div>
      <svg viewBox="0 0 980 220" style="width:100%;height:220px;background:#faf9f6;border:1px solid var(--line);border-radius:var(--r);">
        <line x1="36" y1="56" x2="448" y2="56" stroke="${topo.portLive ? '#ad4337' : '#8a9196'}" stroke-width="6" stroke-linecap="round"/>
        <rect x="38" y="20" width="166" height="24" rx="4" fill="${topo.portLive ? '#f9e9e6' : '#ebe9e4'}" stroke="${topo.portLive ? '#e7bab2' : '#cdc9c0'}"/>
        <text x="50" y="36" fill="${topo.portLive ? '#ad4337' : '#4b545a'}" font-size="12" font-weight="700">PORT 6.6 kV BUS A</text>
        <text x="214" y="36" fill="#6a7277" font-family="var(--font-mono)" font-size="11.5">${topo.portLive ? '6.65 kV · 60 Hz' : '0.00 kV'}</text>

        <line x1="532" y1="56" x2="944" y2="56" stroke="${topo.stbdLive ? '#ad4337' : '#8a9196'}" stroke-width="6" stroke-linecap="round"/>
        <rect x="536" y="20" width="170" height="24" rx="4" fill="${topo.stbdLive ? '#f9e9e6' : '#ebe9e4'}" stroke="${topo.stbdLive ? '#e7bab2' : '#cdc9c0'}"/>
        <text x="548" y="36" fill="${topo.stbdLive ? '#ad4337' : '#4b545a'}" font-size="12" font-weight="700">STBD 6.6 kV BUS B</text>
        <text x="718" y="36" fill="#6a7277" font-family="var(--font-mono)" font-size="11.5">${topo.stbdLive ? '6.65 kV · 60 Hz' : '0.00 kV'}</text>

        <line x1="448" y1="56" x2="470" y2="56" stroke="#4b545a" stroke-width="2"/>
        <line x1="510" y1="56" x2="532" y2="56" stroke="#4b545a" stroke-width="2"/>
        <rect x="470" y="40" width="40" height="32" rx="4" fill="#ffffff" stroke="#55669a" stroke-width="2"/>
        <text x="490" y="60" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2529">BT1</text>
        <text x="490" y="88" text-anchor="middle" font-size="10.5" fill="#55669a" font-family="var(--font-mono)">C2 BUS-TIE (${sim.cubicles['BT1'].vcbClosed ? 'CLOSED' : 'OPEN'})</text>

        <line x1="145" y1="56" x2="145" y2="128" stroke="${topo.portLive ? '#ad4337' : '#8a9196'}" stroke-width="3.5"/>
        <circle cx="145" cy="148" r="18" fill="#ffffff" stroke="#3d7a89" stroke-width="2.2"/>
        <text x="145" y="152" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2529">DG1</text>
        <text x="145" y="182" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4b545a">C1 · Diesel Gen 1</text>

        <line x1="635" y1="56" x2="635" y2="128" stroke="${topo.btEarthed ? '#2f7450' : topo.btVolts > 0 ? '#ad4337' : '#8a9196'}" stroke-width="3.5"/>
        <circle cx="635" cy="148" r="18" fill="#ffffff" stroke="#a46a28" stroke-width="2.2"/>
        <text x="635" y="152" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2529">M1</text>
        <text x="635" y="182" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4b545a">C3 · Bow Thruster</text>

        <line x1="800" y1="56" x2="800" y2="120" stroke="${topo.trEarthed ? '#2f7450' : topo.trVolts > 0 ? '#ad4337' : '#8a9196'}" stroke-width="3.5"/>
        <circle cx="800" cy="133" r="12" fill="none" stroke="#84567e" stroke-width="2.2"/>
        <circle cx="800" cy="150" r="12" fill="none" stroke="#4a8258" stroke-width="2.2"/>
        <text x="800" y="182" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4b545a">C4 · TR1 (6.6 / 0.44 kV)</text>

        <line x1="812" y1="150" x2="892" y2="150" stroke="${sim.cubicles['ACB-TR1-LV'].vcbClosed ? '#ad4337' : '#8a9196'}" stroke-width="3" stroke-dasharray="5,3"/>
        <rect x="892" y="135" width="70" height="30" rx="4" fill="#ffffff" stroke="#4a8258" stroke-width="2"/>
        <text x="927" y="154" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2529">C5 · 440V</text>
        ${topo.trBackfed ? '<text x="875" y="204" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ad4337">BACK-FEED FROM 440 V BUS</text>' : ''}
      </svg>
    `;
    dlg.showModal();
  }

  function renderLotoDrawer() {
    const container = $('lotoStepsList');
    if (!container) return;
    const steps = getLotoSteps(sim);
    const doneCount = steps.filter((s) => s.done).length;
    const currentIdx = steps.findIndex((s) => !s.done);
    const exam = sim.mode === 'EXAM';

    $('lotoPtwCode').textContent = `PTW-HV-6600-0${sim.missionId}A · Step ${doneCount} of ${steps.length}`;
    const prog = $('lotoProgressBar');
    if (prog) prog.style.width = `${Math.round((doneCount / steps.length) * 100)}%`;

    container.innerHTML = steps
      .map((s, idx) => {
        const isCurrent = idx === currentIdx;
        const st = s.done ? 'done' : isCurrent ? 'current' : 'pending';
        if (exam && !s.done) {
          return isCurrent
            ? `<div class="st hidden-exam" aria-current="step"><span class="st-mark">${idx + 1}</span><span class="st-title">Step ${idx + 1} of ${steps.length}</span><span class="st-rule">No hints in Exam / CoC</span></div>`
            : '';
        }
        return `
          <div class="st ${st}"${isCurrent ? ' aria-current="step"' : ''}>
            <span class="st-mark">${s.done ? '<svg class="ic"><use href="#i-check"/></svg>' : idx + 1}</span>
            <span class="st-title">${esc(s.title)}</span>
            ${isCurrent ? `<span class="st-desc">${esc(s.desc)}</span>` : ''}
          </div>
        `;
      })
      .join('');

    const nextTip = $('quickStepTipText');
    if (nextTip) {
      nextTip.textContent = currentIdx === -1
        ? 'All mission steps complete — switch missions or reset to replay.'
        : `Next: Step ${currentIdx + 1} · ${steps[currentIdx].title}`;
    }

    // Also update walkthrough tab in Help drawer
    const walkthrough = $('tutorialStepsContainer');
    const banner = $('tutorialMissionIntroBanner');
    if (banner) {
      banner.innerHTML = `<strong>${esc(MISSION_TITLES[sim.missionId] || 'Switching Walkthrough')}</strong><br>${
        currentIdx === -1
          ? '<span style="color:var(--safe);font-weight:600;">All objectives verified (100/100).</span>'
          : `Active objective: <strong>Step ${currentIdx + 1} of ${steps.length}</strong>`
      }`;
    }
    if (walkthrough) {
      walkthrough.innerHTML = steps
        .map((s, idx) => {
          const isCurrent = idx === currentIdx;
          const isDone = s.done;
          return `
            <div class="guide-step-card ${isCurrent ? 'active' : ''} ${isDone ? 'done' : ''}">
              <div class="guide-step-top">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="guide-badge ${isDone ? 'completed' : isCurrent ? 'current' : 'pending'}">${
            isDone ? 'DONE' : isCurrent ? `STEP ${idx + 1}` : `${idx + 1}`
          }</span>
                  <strong>${esc(s.title)}</strong>
                </div>
              </div>
              <div class="guide-step-explain">${esc(s.desc)}</div>
            </div>
          `;
        })
        .join('');
    }
  }

  function render() {
    const topo = getTopology(sim);

    const scoreBadge = $('topScoreBadge');
    $('topScoreText').textContent = `${sim.score} / 100`;
    scoreBadge.className = `score-badge ${sim.score < 60 ? 'bad' : sim.score < 85 ? 'warn' : ''}`;

    $('telBus').dataset.state = topo.stbdLive ? 'live' : 'safe';
    $('topTelBus').textContent = topo.stbdLive ? '6.60 kV · 60.0 Hz' : '0.00 kV · Dead';

    const btDrawingLoad = topo.stbdLive && sim.cubicles['BT-M1'].vcbClosed && sim.cubicles['BT-M1'].rackingTurns === 20;
    $('telLoad').dataset.state = btDrawingLoad ? 'live' : 'safe';
    $('topTelLoad').textContent = btDrawingLoad ? '1,800 kW · PF 0.92' : '420 kW · Ship Svc';

    $('telTie').dataset.state = sim.cubicles['BT1'].vcbClosed ? 'live' : 'safe';
    $('topTelTie').textContent = sim.cubicles['BT1'].vcbClosed ? 'CLOSED [I]' : 'OPEN [O]';

    $('telRules').dataset.state = sim.ptw.active ? 'safe' : 'warn';
    $('topTelRules').textContent = sim.ptw.active ? 'PTW compliant' : 'In progress';

    // Read-only PPE / Keys / Megger drawer telemetry
    $('ppeGlovesSub').textContent = sim.ppe.gloves
      ? sim.ppe.glovesAirTested ? 'Air-tested & donned' : 'Donned without air-test!'
      : sim.ppe.glovesAirTested ? 'Air-tested (ready)' : 'Roll air-test required at PPE Locker';
    $('ppeSuitSub').textContent = sim.ppe.suit ? 'Donned (40 cal/cm²)' : 'Not donned';
    $('ppeBootsSub').textContent = sim.ppe.bootsMat ? 'Boots & 15 kV mat active' : 'Not deployed';
    $('ppeGlovesRow').className = `ppe-row ${sim.ppe.gloves && sim.ppe.glovesAirTested ? 'equipped' : ''}`;
    $('ppeSuitRow').className = `ppe-row ${sim.ppe.suit ? 'equipped' : ''}`;
    $('ppeBootsRow').className = `ppe-row ${sim.ppe.bootsMat ? 'equipped' : ''}`;

    $('currentToolLabel').textContent = sim.activeTool;
    document.querySelectorAll('#toolbeltGrid .tool-item[data-t]').forEach((btn) => {
      const selected = btn.dataset.t === sim.activeTool;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });
    const keyWrap = $('keyChipsContainer');
    keyWrap.innerHTML = Object.keys(sim.keys)
      .map((k) => {
        const loc = sim.keys[k];
        const inHand = loc === 'HAND';
        const locShort = loc === 'VCB_TRAPPED' ? 'Breaker' : loc === 'EARTH_SWITCH' ? 'Earth cyl' : 'In hand';
        return `<span class="key-tag ${inHand ? 'in-hand' : ''}"><svg class="ic"><use href="#i-key"/></svg>${esc(k)} · ${locShort}</span>`;
      })
      .join('');
    $('keyBoxStatusBadge').textContent = sim.keyBoxLocked ? 'Key box locked' : 'Key box open';

    const m = sim.megger;
    $('valMegger1Min').textContent = m.ir1Min !== null ? `${m.ir1Min} MΩ` : '—';
    $('valMegger10Min').textContent = m.ir10Min !== null ? `${m.ir10Min} MΩ` : '—';
    $('valMeggerPI').textContent = m.piRatio !== null ? `${m.piRatio}` : '—';
    $('valMeggerVolts').textContent = `${m.windingChargeVolts} V DC`;
    $('valMeggerVolts').style.color = m.windingChargeVolts > 0 ? 'var(--live)' : 'var(--safe)';
    $('meggerLeadBadge').textContent = m.connectedCubicle ? `On ${m.connectedCubicle}` : 'Leads off';

    const wsGrid = $('workspaceGrid');
    if (wsGrid) wsGrid.classList.toggle('exam-mode', sim.mode === 'EXAM');

    renderLotoDrawer();

    // Check completion
    const steps = getLotoSteps(sim);
    if (steps.every((s) => s.done) && !sim.missionCompleted) {
      sim.missionCompleted = true;
      audio.playSuccess();
      logEvent(`Mission 0${sim.missionId} completed — Score ${sim.score}/100.`, 'safe');
      showNotice(
        `Mission 0${sim.missionId} Completed (${sim.score}/100 pts)`,
        '<p><strong>STCW 2010 Manila Amendments Table A-III/6 Verified.</strong></p><p style="color:var(--text-2);margin-top:6px;">All mechanical interlocks, live-line Prove–Test–Prove checks, earthing safeguards, and formal PTW / SFT procedures were executed accurately.</p>'
      );
    }
  }

  // Theme & density
  function applyTheme(t) {
    if (!['day', 'night', 'projector'].includes(t)) t = 'day';
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t === 'night' ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeSet === t)));
  }

  function applyDensity(on) {
    document.body.classList.toggle('density-presentation', on);
    const b = $('btnDensity');
    if (b) b.setAttribute('aria-checked', String(on));
  }

  applyTheme(store.get('mhv-theme') || 'day');
  applyDensity(store.get('mhv-density') === 'presentation');

  // Left drawer & rail wiring
  const grid = $('workspaceGrid');
  const help = $('helpFloat');
  const isDrawerOpen = () => !grid.classList.contains('left-collapsed');

  function setDrawerTab(tab) {
    activeDrawerTab = tab;
    $('leftPaneChecklist').hidden = tab !== 'CHECKLIST';
    $('leftPaneChecklist').classList.toggle('active-pane', tab === 'CHECKLIST');
    $('leftPaneMissionPpe').hidden = tab !== 'PPE';
    $('leftPaneMissionPpe').classList.toggle('active-pane', tab === 'PPE');
    $('leftPaneToolsKeys').hidden = tab !== 'TOOLS';
    $('leftPaneToolsKeys').classList.toggle('active-pane', tab === 'TOOLS');
  }

  function syncRail() {
    const open = isDrawerOpen();
    $('railChecklist')?.setAttribute('aria-expanded', String(open && activeDrawerTab === 'CHECKLIST'));
    $('tabLeftMissionPpe')?.setAttribute('aria-expanded', String(open && activeDrawerTab === 'PPE'));
    $('tabLeftToolsKeys')?.setAttribute('aria-expanded', String(open && activeDrawerTab === 'TOOLS'));
    $('btnToggleHelp')?.setAttribute('aria-expanded', String(!help.classList.contains('hidden')));
  }

  function toggleDrawerFor(tab) {
    help.classList.add('hidden');
    if (isDrawerOpen() && activeDrawerTab === tab) {
      grid.classList.add('left-collapsed');
    } else {
      setDrawerTab(tab);
      grid.classList.remove('left-collapsed');
    }
    syncRail();
    window.dispatchEvent(new Event('resize'));
  }

  $('railChecklist')?.addEventListener('click', () => toggleDrawerFor('CHECKLIST'));
  $('tabLeftMissionPpe')?.addEventListener('click', () => toggleDrawerFor('PPE'));
  $('tabLeftToolsKeys')?.addEventListener('click', () => toggleDrawerFor('TOOLS'));
  $('railMegger')?.addEventListener('click', () => {
    toggleDrawerFor('TOOLS');
    $('meggerSectionBox')?.scrollIntoView({ block: 'start' });
  });
  $('btnCollapseLeft')?.addEventListener('click', () => {
    grid.classList.add('left-collapsed');
    syncRail();
    window.dispatchEvent(new Event('resize'));
  });
  $('railSLD')?.addEventListener('click', openSldModal);
  $('railPermit')?.addEventListener('click', openPtwModal);
  $('btnFullPtwView')?.addEventListener('click', openPtwModal);

  $('btnToggleHelp')?.addEventListener('click', () => {
    grid.classList.add('left-collapsed');
    help.classList.toggle('hidden');
    syncRail();
  });
  $('helpCloseBtn')?.addEventListener('click', () => {
    help.classList.add('hidden');
    syncRail();
  });

  document.querySelectorAll('.help-tab-btn').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.help-tab-btn').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.htab;
      document.querySelectorAll('.htab-pane').forEach((p) => { p.style.display = 'none'; });
      const pane = $(`hpane-${target}`);
      if (pane) pane.style.display = 'block';
    });
  });

  // Mission switching & Topbar controls
  document.querySelectorAll('.scenario-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scenario-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $('missionCountBadge').textContent = `0${btn.dataset.m} / 04`;
      $('bottomStatusScenario').innerHTML = `<strong>Mission 0${btn.dataset.m}</strong> · ${esc(btn.querySelector('span:last-child').textContent)}`;
      const m = $('missionMenu');
      if (m && m.matches(':popover-open')) m.hidePopover();
      onSwitchMission(btn.dataset.m);
    });
  });

  $('btnToggleMode')?.addEventListener('click', (e) => {
    sim.mode = sim.mode === 'TRAIN' ? 'EXAM' : 'TRAIN';
    e.currentTarget.innerHTML = `<span class="segmented-tab ${sim.mode === 'TRAIN' ? 'active' : ''}" data-mode="train">Training</span><span class="segmented-tab ${sim.mode === 'EXAM' ? 'active' : ''}" data-mode="exam">Exam</span>`;
    e.currentTarget.setAttribute('aria-label', sim.mode === 'TRAIN' ? 'Mode: Training. Click to switch to Exam / CoC' : 'Mode: Exam / CoC. Click to switch to Training');
    render();
  });

  $('btnToggleAudio')?.addEventListener('click', (e) => {
    const on = audio.toggle();
    e.currentTarget.innerHTML = `<svg class="ic"><use href="${on ? '#i-sound' : '#i-mute'}"/></svg>${on ? 'Sound' : 'Muted'}`;
  });

  $('btnOpenManual')?.addEventListener('click', () => {
    const m = $('moreMenu');
    if (m && m.matches(':popover-open')) m.hidePopover();
    $('manualDialog').showModal();
  });

  $('btnResetAll')?.addEventListener('click', () => {
    const m = $('moreMenu');
    if (m && m.matches(':popover-open')) m.hidePopover();
    onResetMission();
  });

  $('btnResetPermit')?.addEventListener('click', onResetMission);

  document.querySelectorAll('#toolbeltGrid .tool-item[data-t]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sim.activeTool = btn.dataset.t;
      render();
    });
  });

  document.querySelectorAll('[data-theme-set]').forEach((b) =>
    b.addEventListener('click', () => {
      applyTheme(b.dataset.themeSet);
      store.set('mhv-theme', b.dataset.themeSet);
    })
  );

  $('btnDensity')?.addEventListener('click', () => {
    const on = !document.body.classList.contains('density-presentation');
    applyDensity(on);
    store.set('mhv-density', on ? 'presentation' : 'default');
    window.dispatchEvent(new Event('resize'));
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]') || document.querySelector(':popover-open')) return;
    if (!help.classList.contains('hidden')) {
      help.classList.add('hidden');
      syncRail();
    } else if (isDrawerOpen()) {
      grid.classList.add('left-collapsed');
      syncRail();
    }
  });

  setDrawerTab('CHECKLIST');
  syncRail();

  return {
    render,
    logEvent,
    handleViolation,
    showNotice,
    openPtwModal,
    openSldModal,
  };
}
