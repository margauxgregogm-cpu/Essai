/* Beauty Fidelity — scène verrouillée, transitions liquides pilotées par le scroll. Sans dépendance. */
const UNIVERSES = [
  {id:'matcha',  title:'Matcha',  desc:'Une fidélité infusée de douceur.', brand:'MATCHA CLUB',   bg:'#dce8d4', ink:'#2b412f', liquid:'#749455', light:'#c4dc9e'},
  {id:'vanille', title:'Vanille', desc:'Une douceur à chaque visite.',     brand:'VANILLA STUDIO',bg:'#f4e7d1', ink:'#55412c', liquid:'#d8b57c', light:'#f9e6ad'},
  {id:'beaute',  title:'Beauté',  desc:'La beauté d’une attention.',       brand:'ROSE ATELIER',  bg:'#f3dce4', ink:'#603e4d', liquid:'#d98da9', light:'#f8bed0'},
  {id:'luxe',    title:'Luxe',    desc:'Une signature d’exception.',       brand:'MAISON DORÉE',  bg:'#252022', ink:'#fff1e4', liquid:'#b79562', light:'#efd6a2'},
  {id:'floral',  title:'Floral',  desc:'La fidélité en fleurs.',           brand:'FLEUR STUDIO',  bg:'#e9dff1', ink:'#4b3a5c', liquid:'#a58bc5', light:'#d9c3ec'}
];
const N = UNIVERSES.length, SEG = N - 1;
const COVER = [0.10, 0.50], RETREAT = [0.50, 0.90];   // phases d'un segment (0..1)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = s => document.querySelector(s);
const stage = $('#stage'), holder = $('#card-holder'), liquid = $('#liquid');
const bgEls = [], cardEls = [], copyEls = [], dots = [];
const cardRatio = UNIVERSES.map(() => 1.586);

UNIVERSES.forEach((u, i) => {
  const bg = document.createElement('div'); bg.className = 'bg'; bg.style.setProperty('--bg', u.bg);
  const im = new Image(); im.alt = ''; im.src = `assets/backgrounds/${u.id}.jpg`;
  im.onload = () => bg.appendChild(im); bgEls.push(bg); $('#bgs').appendChild(bg);

  const card = document.createElement('div'); card.style.cssText = `--ink:${u.ink};--liquid:${u.liquid};--light:${u.light}`;
  card.className = 'fake';
  card.innerHTML = `<div><div class="s">CARTE DE FIDÉLITÉ DIGITALE</div><div class="b">${u.brand}</div></div>
    <div class="r"><span class="s">EMPLACEMENT DE VOTRE CARTE<br>APPLE &amp; GOOGLE WALLET</span><span><i></i><i></i><i></i><i></i></span></div>`;
  const ci = new Image(); ci.alt = 'Carte de fidélité ' + u.title; ci.src = `assets/cards/${u.id}.png`;
  ci.onload = () => { cardRatio[i] = ci.naturalWidth / ci.naturalHeight; card.replaceWith(ci); cardEls[i] = ci; applyRatio(); };
  cardEls.push(card); $('#cards').appendChild(card);

  const c = document.createElement('div'); c.className = 'item';
  c.innerHTML = `<div class="eyebrow">Collection immersive · 0${i+1}/05</div><h1>${u.title}</h1><p class="desc">${u.desc}</p>`;
  copyEls.push(c); $('#copy').appendChild(c);

  const d = document.createElement('span'); dots.push(d); $('#dots').appendChild(d);
});

let W = 0, H = 0, activeRatio = 0;
function measure() {
  W = holder.clientWidth; H = holder.clientHeight; DPR = Math.min(2, devicePixelRatio || 1);
  liquid.width = Math.round(W * DPR); liquid.height = Math.round(H * DPR); buildDrips();
}
function applyRatio() {
  const r = cardRatio[current] || 1.586;
  if (r !== activeRatio) { activeRatio = r; holder.style.aspectRatio = r; measure(); }
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t * t * (3 - 2 * t);
const range = (t, a, b) => clamp((t - a) / (b - a));

/* ---- Liquide (canvas) : coulées à bout arrondi, fixes dans l'espace -> réversible ---- */
const ctx = liquid.getContext('2d');
let DPR = 1;
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let pour = [], drain = [];
function buildDrips() {
  pour = []; drain = [];
  for (let s = 0; s < SEG; s++) {
    const r1 = mulberry(s * 97 + 13), r2 = mulberry(s * 53 + 7), n = Math.max(7, Math.round(W / 50)), a = [], b = [];
    for (let i = 0; i < n; i++) {
      a.push({x: W * ((i + .15 + r1() * .7) / n), r: W * (.016 + r1() * .034), d: r1() * .45, ext: r1()});
      b.push({x: W * ((i + .15 + r2() * .7) / n), r: W * (.035 + r2() * .045), len: .08 + r2() * .22});
    }
    pour.push(a); drain.push(b);
  }
}
const smax = (a, b, k) => { const h = clamp(.5 + .5 * (a - b) / k); return b + (a - b) * h + k * h * (1 - h); };
/* bord bas de la nappe : e 0 -> 1, des coulées devancent la nappe */
function bottomY(x, e, set) {
  let y = -6 + Math.pow(ease(range(e, .28, 1)), 1.5) * (H + 12);
  for (const d of set) {
    const dx = x - d.x; if (Math.abs(dx) >= d.r) continue;
    const ei = ease(clamp((e - d.d) / (1 - d.d))), ry = d.r * (1.5 + d.ext * 2.6);
    const tip = -ry + ei * (H + 2 * ry + 8);
    const yi = tip - ry + ry * Math.sqrt(1 - (dx / d.r) ** 2);
    y = smax(yi, y, d.r * .9);
  }
  return y;
}
/* bord haut : la nappe glisse vers le bas en laissant des traînées accrochées */
function topY(x, e, set) {
  const k = Math.sin(Math.PI * e);
  let bump = 0;
  for (const d of set) {
    const dx = x - d.x; if (Math.abs(dx) >= d.r) continue;
    bump = Math.max(bump, d.len * H * Math.sqrt(1 - (dx / d.r) ** 2) * k);
  }
  return -6 + Math.pow(ease(e), 1.2) * (H + 12) - bump;
}
function drawLiquid(eTop, eBot, seg, u) {
  const dr = ctx.canvas; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  const step = 3, n = Math.ceil(W / step), top = [], bot = [];
  for (let i = 0; i <= n; i++) { const x = Math.min(W, i * step); top.push(topY(x, eTop, drain[seg])); bot.push(bottomY(x, eBot, pour[seg])); }
  ctx.beginPath(); ctx.moveTo(0, top[0]);
  for (let i = 1; i <= n; i++) ctx.lineTo(Math.min(W, i * step), top[i]);
  for (let i = n; i >= 0; i--) ctx.lineTo(Math.min(W, i * step), bot[i]);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, W * .8, H);
  g.addColorStop(0, u.light); g.addColorStop(.5, u.liquid); g.addColorStop(1, u.light);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(255,255,255,.35)'); v.addColorStop(.5, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  /* reflets le long des coulées */
  if (eBot < 1) for (const d of pour[seg]) {
    const ei = ease(clamp((eBot - d.d) / (1 - d.d))), ry = d.r * (1.5 + d.ext * 2.6), tip = -ry + ei * (H + 2 * ry + 8);
    if (tip < 0) continue;
    const hx = d.x - d.r * .38;
    const sg = ctx.createLinearGradient(0, tip - ry * 2, 0, tip - d.r * .6); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,.55)');
    ctx.strokeStyle = sg; ctx.lineWidth = d.r * .28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, Math.max(0, tip - ry * 2)); ctx.lineTo(hx, tip - d.r * .6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(hx, tip - d.r * .55, d.r * .16, d.r * .3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(d.x + d.r * .35, tip - d.r * .5, d.r * .25, d.r * .5, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
  /* épaisseur du bord : ombre + liseré clair */
  const rim = (pts, c, w, dy) => { ctx.beginPath(); pts.forEach((y, i) => ctx[i ? 'lineTo' : 'moveTo'](Math.min(W, i * step), y + dy)); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
  if (eBot < 1) { rim(bot, 'rgba(0,0,0,.22)', 5, 2); rim(bot, 'rgba(255,255,255,.55)', 2, -1); }
  if (eTop > 0) rim(top, 'rgba(255,255,255,.5)', 2, 1);
}

let current = 0, liquidOn = false;
function setCurrent(i) {
  current = i;
  cardEls.forEach((c, j) => c.style.opacity = j === i ? 1 : 0);
  copyEls.forEach((c, j) => c.style.opacity = j === i ? 1 : 0);
  dots.forEach((d, j) => d.classList.toggle('on', j === i));
  const u = UNIVERSES[i];
  stage.style.setProperty('--ink', u.ink);
  applyRatio();
}

function render() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? clamp(scrollY / max) : 0;
  const pos = p * SEG, seg = Math.min(SEG - 1, Math.floor(pos)), t = pos - seg;
  const from = seg, to = seg + 1;

  /* La carte change quand elle est entièrement recouverte (t = 0.5). */
  const idx = t < .5 ? from : to;
  if (idx !== current) setCurrent(idx);

  /* Liquide : couvre (haut->bas) puis se retire par le bas ; couleur = univers suivant. */
  const eCover = ease(range(t, COVER[0], COVER[1])), eRet = ease(range(t, RETREAT[0], RETREAT[1]));
  if (reduce || eCover <= 0 || eRet >= 1) { if (liquidOn) { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0, 0, liquid.width, liquid.height); liquidOn = false; } }
  else { liquidOn = true; drawLiquid(eRet, eCover, seg, UNIVERSES[to]); }

  /* Fonds : fondu doux entre univers autour du recouvrement. */
  const mix = ease(range(t, .3, .7));
  bgEls.forEach((b, j) => b.style.opacity = j === from ? 1 - mix : j === to ? mix : 0);
  if (p >= 1) bgEls.forEach((b, j) => b.style.opacity = j === N - 1 ? 1 : 0);
  if (reduce) { /* sans liquide : fondu de la carte au milieu du segment */
    const f = ease(range(t, .4, .6));
    cardEls[from].style.opacity = 1 - f; cardEls[to].style.opacity = f;
    copyEls[from].style.opacity = 1 - f; copyEls[to].style.opacity = f;
  }
  $('#hint').style.opacity = p > .02 ? 0 : 1;
}

let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
addEventListener('scroll', schedule, {passive: true});
addEventListener('resize', () => { measure(); schedule(); });
addEventListener('orientationchange', () => setTimeout(() => { measure(); schedule(); }, 200));

$('#next').addEventListener('click', e => {
  e.preventDefault();
  const max = document.documentElement.scrollHeight - innerHeight;
  const step = max / SEG, k = Math.round(scrollY / step);
  const target = k >= SEG ? 0 : (k + 1) * step;       // boucle vers le début après la dernière
  scrollTo({top: target, behavior: reduce ? 'auto' : 'smooth'});
});

measure(); setCurrent(0); render();
