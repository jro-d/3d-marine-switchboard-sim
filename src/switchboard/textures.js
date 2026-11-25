import * as THREE from 'three';

const COL_LIVE = '#ad4337';
const COL_DEAD = '#7d8791';
const COL_EARTH = '#2f7450';
const COL_AMBER = '#b8860b';
const COL_TEAL = '#1f6f78';

export const MIMIC_DEFAULT = {
  kind: 'MOTOR',
  busLabel: '6.6 kV BUS',
  loadLabel: '',
  bus: false,
  load: false,
  closed: false,
  rack: 20,
  earthed: false,
  backfed: false,
};

export const HMI_DEFAULT = {
  tag: 'CB',
  amps: 0,
  kV: 0,
  closed: false,
  rack: 20,
  earthed: false,
  backfed: false,
};

export const MIMIC_KINDS = {
  'DG1': { kind: 'GEN', busLabel: '6.6 kV BUS A', loadLabel: 'DG1' },
  'BT1': { kind: 'BUSTIE', busLabel: '6.6 kV BUS A', loadLabel: '6.6 kV BUS B' },
  'BT-M1': { kind: 'MOTOR', busLabel: '6.6 kV BUS B', loadLabel: 'BOW THRUSTER' },
  'TR1-HV': { kind: 'XFMR', busLabel: '6.6 kV BUS B', loadLabel: 'TR1' },
  'ACB-TR1-LV': { kind: 'LV', busLabel: 'TR1 440 V SECONDARY', loadLabel: 'MSB 440 V BUS' },
};

export function makeCanvasTex(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { ctx, tex };
}

export function makeBadgeTexture(title, subtitle, bgHex = '#f4f6f8', fgHex = '#1f2529', accentHex = '#1f6f78') {
  const { ctx, tex } = makeCanvasTex(256, 84);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 84);
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 10, 84);
  ctx.strokeStyle = '#9aa8b6';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 253, 81);
  ctx.fillStyle = fgHex;
  ctx.font = 'bold 23px monospace';
  ctx.fillText(title, 20, 35);
  ctx.fillStyle = fgHex === '#ffffff' ? '#e2e8f0' : '#4b545a';
  ctx.font = '600 15px sans-serif';
  ctx.fillText(subtitle, 20, 63);
  return tex;
}

export function makeLivePanel(w, h, drawFn, initialState) {
  const { ctx, tex } = makeCanvasTex(w, h);
  let lastKey = '';
  const panel = {
    tex,
    update(st) {
      const key = JSON.stringify(st);
      if (key === lastKey) return;
      lastKey = key;
      drawFn(ctx, w, h, st);
      tex.needsUpdate = true;
    },
  };
  panel.update(initialState);
  return panel;
}

function mLine(ctx, x1, y1, x2, y2, col, lw) {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawMimic(ctx, w, h, st) {
  const live = (on) => (on ? COL_LIVE : COL_DEAD);
  const isLV = st.kind === 'LV';
  const x0 = 92;
  ctx.fillStyle = '#f4f2ec';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#9aa8b6';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(st.busLabel, 12, 20);

  mLine(ctx, 12, 30, 176, 30, live(st.bus), 6);
  const connected = isLV || st.rack === 20;
  const gap = connected ? 0 : st.rack === 10 ? 9 : 18;
  const plug1 = 62;
  const p1a = plug1 - gap / 2;
  const p1b = plug1 + gap / 2;
  mLine(ctx, x0, 30, x0, p1a, live(st.bus), 4);

  const midLive = connected && st.bus;
  if (connected) {
    ctx.fillStyle = live(st.bus);
    ctx.beginPath();
    ctx.arc(x0, plug1, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    mLine(ctx, x0 - 8, p1a, x0 + 8, p1a, live(st.bus), 4);
    mLine(ctx, x0 - 6, p1b, x0 + 6, p1b, COL_DEAD, 4);
  }
  mLine(ctx, x0, p1b, x0, 82, live(midLive), 4);

  ctx.fillStyle = st.closed ? COL_LIVE : COL_EARTH;
  ctx.fillRect(x0 - 14, 82, 28, 26);
  ctx.strokeStyle = '#1f2529';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 14, 82, 28, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(st.closed ? 'I' : 'O', x0, 102);
  ctx.textAlign = 'left';

  const lowTruckLive = connected && (st.closed ? st.bus : st.load);
  mLine(ctx, x0, 108, x0, 124 - gap / 2, live(lowTruckLive), 4);
  const plug2 = 124;
  const p2a = plug2 - gap / 2;
  const p2b = plug2 + gap / 2;
  if (connected) {
    ctx.fillStyle = live(st.load);
    ctx.beginPath();
    ctx.arc(x0, plug2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    mLine(ctx, x0 - 6, p2a, x0 + 6, p2a, COL_DEAD, 4);
    mLine(ctx, x0 - 8, p2b, x0 + 8, p2b, live(st.load), 4);
  }
  const loadTopY = st.kind === 'BUSTIE' || isLV ? 176 : 169;
  mLine(ctx, x0, p2b, x0, loadTopY, live(st.load), 4);

  if (!isLV) {
    const esY = 146;
    const ex = x0 - 40;
    if (st.earthed) {
      mLine(ctx, x0, esY, ex, esY, COL_EARTH, 3);
    } else {
      mLine(ctx, x0, esY, ex + 8, esY - 16, COL_DEAD, 3);
      ctx.strokeStyle = COL_DEAD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, esY, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    const ec = st.earthed ? COL_EARTH : COL_DEAD;
    mLine(ctx, ex, esY, ex, 170, ec, 3);
    mLine(ctx, ex - 9, 170, ex + 9, 170, ec, 3);
    mLine(ctx, ex - 6, 176, ex + 6, 176, ec, 3);
    mLine(ctx, ex - 3, 182, ex + 3, 182, ec, 3);
    ctx.fillStyle = '#1f2529';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ES', ex, 195);
    ctx.textAlign = 'left';
  }

  ctx.strokeStyle = live(st.load);
  ctx.fillStyle = live(st.load);
  if (st.kind === 'BUSTIE' || isLV) {
    mLine(ctx, 12, 180, 176, 180, live(st.load), 6);
    ctx.fillStyle = '#1f2529';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(st.loadLabel, 12, 196);
  } else {
    ctx.lineWidth = 3;
    if (st.kind === 'XFMR') {
      ctx.beginPath();
      ctx.arc(x0 - 7, 182, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x0 + 7, 182, 11, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x0, 182, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#1f2529';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.kind === 'GEN' ? 'G' : 'M', x0, 188);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#1f2529';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(st.loadLabel, x0 + 22, 186);
  }

  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#6b7780';
  ctx.fillText(isLV ? 'ACB STATE' : 'TRUCK POSITION', 198, 30);
  const pill = (label, y, active, fill) => {
    ctx.fillStyle = active ? fill : '#ebe9e3';
    ctx.fillRect(198, y, 90, 22);
    ctx.strokeStyle = active ? '#1f2529' : '#b7bfc7';
    ctx.lineWidth = 2;
    ctx.strokeRect(198, y, 90, 22);
    ctx.fillStyle = active ? '#ffffff' : '#8a949c';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 243, y + 16);
    ctx.textAlign = 'left';
  };
  if (isLV) {
    pill('CLOSED', 40, st.closed, COL_LIVE);
    pill('OPEN', 68, !st.closed, COL_EARTH);
  } else {
    pill('SERVICE', 40, st.rack === 20, COL_TEAL);
    pill('TEST', 68, st.rack === 10, COL_AMBER);
    pill('DISCONNECTED', 96, st.rack === 0, COL_EARTH);
  }

  [
    ['LIVE', COL_LIVE],
    ['DEAD', COL_DEAD],
    ['EARTH', COL_EARTH],
  ].forEach(([t, col], i) => {
    ctx.fillStyle = col;
    ctx.fillRect(200, 128 + i * 16, 10, 10);
    ctx.fillStyle = '#4b545a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(t, 216, 137 + i * 16);
  });

  if (st.backfed || st.earthed) {
    ctx.fillStyle = st.backfed ? COL_LIVE : COL_EARTH;
    ctx.fillRect(198, 176, 90, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(st.backfed ? 'BACK-FEED!' : 'EARTHED', 243, 190);
    ctx.textAlign = 'left';
  }
}

export function drawHmi(ctx, w, h, st) {
  ctx.fillStyle = '#e7f2f3';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COL_TEAL;
  ctx.fillRect(0, 0, w, 24);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`REF615 · ${st.tag}`, 8, 16);
  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 14px monospace';
  const fmt = (v) => v.toFixed(1).padStart(5, ' ');
  ctx.fillText(`IL1 ${fmt(st.amps)}`, 8, 46);
  ctx.fillText(`IL2 ${fmt(st.amps * 0.995)}`, 8, 64);
  ctx.fillText(`IL3 ${fmt(st.amps * 1.004)}`, 8, 82);
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`${st.kV.toFixed(2)} kV`, 108, 46);
  ctx.fillStyle = st.closed ? COL_LIVE : COL_EARTH;
  ctx.fillText(st.closed ? '[I] CLOSED' : '[O] OPEN', 108, 64);
  ctx.fillStyle = '#1f2529';
  ctx.fillText(st.rack === 20 ? 'SERVICE' : st.rack === 10 ? 'TEST' : 'DISCONN.', 108, 82);
  let bg = COL_AMBER;
  let msg = 'READY · CB OPEN';
  if (st.backfed) {
    bg = COL_LIVE;
    msg = 'BACK-FEED!';
  } else if (st.earthed) {
    bg = COL_EARTH;
    msg = 'EARTHED';
  } else if (st.rack !== 20) {
    bg = '#6b7780';
    msg = 'ISOLATED';
  } else if (st.closed && st.kV > 0) {
    bg = '#2f7450';
    msg = 'IN SERVICE';
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 96, w, h - 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(msg, w / 2, 118);
  ctx.textAlign = 'left';
}

function makeMeterDialTexture(unitText, maxVal) {
  const { ctx, tex } = makeCanvasTex(160, 160);
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, 160, 160);
  ctx.strokeStyle = '#64778a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 154, 154);

  const px = 132;
  const py = 132;
  const r = 98;
  ctx.strokeStyle = '#1f2529';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, r, Math.PI, Math.PI * 1.5);
  ctx.stroke();

  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * (Math.PI * 0.5);
    const rIn = i % 5 === 0 ? r - 12 : r - 7;
    ctx.strokeStyle = i >= 8 ? '#ad4337' : '#1f2529';
    ctx.lineWidth = i % 5 === 0 ? 2.4 : 1.3;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(a) * rIn, py + Math.sin(a) * rIn);
    ctx.lineTo(px + Math.cos(a) * (r + 2), py + Math.sin(a) * (r + 2));
    ctx.stroke();
  }

  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(unitText, 20, 44);
  ctx.font = '600 13px monospace';
  ctx.fillStyle = '#4b545a';
  ctx.fillText(`0..${maxVal}`, 20, 64);

  const maxNum = Number(maxVal);
  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  [0, 5, 10].forEach((i) => {
    const a = Math.PI + (i / 10) * (Math.PI * 0.5);
    const lbl = String(Math.round((maxNum * i) / 10 * 10) / 10);
    ctx.fillText(lbl, px + Math.cos(a) * (r - 26), py + Math.sin(a) * (r - 26) + 4);
  });
  ctx.textAlign = 'left';
  return tex;
}

function makeCounterTexture() {
  const { ctx, tex } = makeCanvasTex(160, 48);
  ctx.fillStyle = '#1f2529';
  ctx.fillRect(0, 0, 160, 48);
  ['0', '0', '1', '4', '2'].forEach((d, i) => {
    ctx.fillStyle = i === 4 ? '#f4f3ef' : '#2e363c';
    ctx.fillRect(8 + i * 29, 6, 25, 36);
    ctx.fillStyle = i === 4 ? '#1f2529' : '#f4f6f8';
    ctx.font = 'bold 23px monospace';
    ctx.fillText(d, 14 + i * 29, 32);
  });
  return tex;
}

function makeLegendTexture(labels, pitchPx) {
  const { ctx, tex } = makeCanvasTex(pitchPx * labels.length, 28);
  ctx.fillStyle = '#f4f2ec';
  ctx.fillRect(0, 0, pitchPx * labels.length, 28);
  ctx.strokeStyle = '#9aa8b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, pitchPx * labels.length - 2, 26);
  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((t, i) => ctx.fillText(t, pitchPx * (i + 0.5), 18));
  ctx.textAlign = 'left';
  return tex;
}

function makeDoorHazardTexture() {
  const { ctx, tex } = makeCanvasTex(640, 100);
  ctx.fillStyle = '#f9f6ee';
  ctx.fillRect(0, 0, 640, 100);
  ctx.strokeStyle = '#9aa8b6';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 637, 97);
  ctx.fillStyle = '#f2c200';
  ctx.strokeStyle = '#1f2529';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(46, 10);
  ctx.lineTo(86, 86);
  ctx.lineTo(8, 86);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1f2529';
  ctx.beginPath();
  ctx.moveTo(50, 28);
  ctx.lineTo(35, 58);
  ctx.lineTo(45, 58);
  ctx.lineTo(40, 78);
  ctx.lineTo(60, 46);
  ctx.lineTo(49, 46);
  ctx.lineTo(56, 28);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = COL_LIVE;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('DANGER · 6.6 kV', 104, 34);
  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('ARC FLASH HAZARD — RACK BREAKER OUT TO', 104, 60);
  ctx.fillText('DISCONNECTED BEFORE OPENING DOOR', 104, 80);
  ctx.strokeStyle = '#1f2529';
  ctx.lineWidth = 2;
  ctx.strokeRect(468, 10, 164, 80);
  ctx.font = 'bold 13px monospace';
  ctx.fillText('IEC 62271-200', 478, 30);
  ctx.fillText('7.2 kV · 630 A', 478, 47);
  ctx.fillText('25 kA / 3 s', 478, 64);
  ctx.fillText('IAC AFLR 25kA/1s', 478, 81);
  return tex;
}

function makeCoverLabelTexture() {
  const { ctx, tex } = makeCanvasTex(480, 60);
  ctx.fillStyle = '#f9f6ee';
  ctx.fillRect(0, 0, 480, 60);
  ctx.strokeStyle = '#9aa8b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 478, 58);
  ctx.fillStyle = '#1f2529';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CABLE BOX · ISOLATE & EARTH BEFORE OPENING', 240, 26);
  ctx.font = '600 13px sans-serif';
  ctx.fillText('4 × M6 CAPTIVE SCREWS · TOOL REQUIRED', 240, 47);
  ctx.textAlign = 'left';
  return tex;
}

function makeHeaderBannerTexture(text) {
  const { ctx, tex } = makeCanvasTex(512, 56);
  ctx.fillStyle = '#26313b';
  ctx.fillRect(0, 0, 512, 56);
  ctx.strokeStyle = '#c8d1da';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 506, 50);
  ctx.fillStyle = '#f8f9fa';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 36);
  ctx.textAlign = 'left';
  return tex;
}

function makeVcbFasciaTexture() {
  const { ctx, tex } = makeCanvasTex(440, 370);
  ctx.fillStyle = '#313c47';
  ctx.fillRect(0, 0, 440, 370);
  ctx.strokeStyle = '#6d7b88';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 428, 358);

  ctx.fillStyle = '#232c35';
  ctx.fillRect(10, 10, 420, 34);
  ctx.fillStyle = '#e6ecf2';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ABB VD4-M · 7.2 kV · 1250 A · 40 kA', 20, 32);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CLOSE [I]', 100, 62);
  ctx.fillText('OPEN [O]', 200, 62);
  ctx.fillText('OPERATIONS', 350, 62);

  ctx.fillText('CB STATUS', 110, 152);
  ctx.fillText('SPRING', 230, 152);
  ctx.fillText('TRUCK POS.', 230, 228);
  ctx.fillText('MANUAL CHARGE', 376, 122);

  ctx.strokeStyle = '#dba328';
  ctx.lineWidth = 2;
  ctx.strokeRect(136, 286, 168, 70);
  ctx.fillStyle = '#f3c65f';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('RACKING PORT · 20 TURNS', 220, 302);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('↺ OUT     IN ↻', 220, 336);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('CASTELL KEY', 80, 294);
  ctx.fillText('LOTO HASP', 355, 294);
  ctx.textAlign = 'left';
  return tex;
}

export function createSharedTextures() {
  return {
    ammeter: makeMeterDialTexture('A', '300'),
    voltmeter: makeMeterDialTexture('kV', '7.2'),
    lvVolt: makeMeterDialTexture('V', '500'),
    lvAmp: makeMeterDialTexture('A', '1000'),
    doorHazard: makeDoorHazardTexture(),
    coverLabel: makeCoverLabelTexture(),
    headerMSB: makeHeaderBannerTexture('MAIN SWITCHBOARD · 6.6 kV'),
    headerLV: makeHeaderBannerTexture('440 V AUX SWITCHBOARD'),
    vcbFascia: makeVcbFasciaTexture(),
    lampLegend: makeLegendTexture(['CLOSED', 'OPEN', 'EARTHED', 'SERVICE'], 64),
    lvLampLegend: makeLegendTexture(['CLOSED', 'OPEN', '440 V', 'BACK-FEED'], 96),
    cviLegend: makeLegendTexture(['L1', 'L2', 'L3'], 64),
    switchLegend: makeLegendTexture(['CB TRIP-NEUT-CLOSE', 'LOCAL / REMOTE'], 160),
    counter: makeCounterTexture(),
    tagDanger: makeBadgeTexture('DANGER', 'DO NOT OPERATE', '#f9e9e6', '#ad4337', '#ad4337'),
    tagEarth: makeBadgeTexture('EARTHED', 'CIRCUIT GROUNDED', '#f6eed7', '#8b680d', '#2f7450'),
    tagSft: makeBadgeTexture('HV TEST', 'SANCTION FOR TEST', '#efeaf5', '#6c5492', '#6c5492'),
    shutterRed: makeBadgeTexture('DANGER 6.6 kV', 'LIVE BUSBAR SPOUTS', '#ad4337', '#ffffff', '#f5edda'),
    shutterYel: makeBadgeTexture('FEEDER SPOUTS', 'CABLE CIRCUIT', '#d4a024', '#1f2529', '#1f2529'),
  };
}
