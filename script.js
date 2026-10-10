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
function measure() { W = holder.clientWidth; H = holder.clientHeight; }
function applyRatio() {
  const r = cardRatio[current] || 1.586;
  if (r !== activeRatio) { activeRatio = r; holder.style.aspectRatio = r; measure(); }
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t * t * (3 - 2 * t);
const range = (t, a, b) => clamp((t - a) / (b - a));

/* Profil de coulées irrégulières, fixe dans l'espace -> réversible. */
const prof = (x, k) => {
  const a = .5 + .5 * Math.sin(x * 9 + k), b = .5 + .5 * Math.sin(x * 23 + k * 2.3), c = .5 + .5 * Math.sin(x * 4.1 + k * .7);
  return Math.pow(a * .5 + b * .25 + c * .25, 1.6) * 1.35 > 1 ? 1 : Math.pow(a * .5 + b * .25 + c * .25, 1.6) * 1.35;
};
/* Bord liquide : e=0 -> au-dessus de la carte, e=1 -> sous la carte. */
function edge(x, e, k, dmax) {
  const u = x / W;
  return -dmax + e * (H + dmax * 1.3) + dmax * prof(u, k) * Math.sin(Math.PI * e) * 1.0 + 3 * Math.sin(u * 17 + e * 9) * Math.sin(Math.PI * e);
}
function liquidPath(eTop, eBot, k) {
  const steps = Math.max(24, Math.round(W / 10)), dmax = H * .38, pts = [];
  for (let i = 0; i <= steps; i++) { const x = W * i / steps; pts.push([x, edge(x, eTop, k + 5, dmax)]); }
  let d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  const bot = [];
  for (let i = steps; i >= 0; i--) { const x = W * i / steps; bot.push([x, edge(x, eBot, k, dmax)]); }
  return d + 'L' + bot.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
}

let current = 0;
function setCurrent(i) {
  current = i;
  cardEls.forEach((c, j) => c.style.opacity = j === i ? 1 : 0);
  copyEls.forEach((c, j) => c.style.opacity = j === i ? 1 : 0);
  dots.forEach((d, j) => d.classList.toggle('on', j === i));
  const u = UNIVERSES[i];
  stage.style.setProperty('--ink', u.ink);
  liquid.style.setProperty('--liquid', u.liquid); liquid.style.setProperty('--light', u.light);
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
  if (reduce) { liquid.style.clipPath = 'path("M0 0Z")'; }
  else if (eCover <= 0 || (eRet >= 1)) liquid.style.clipPath = 'path("M0 0Z")';
  else {
    liquid.style.setProperty('--liquid', UNIVERSES[to].liquid); liquid.style.setProperty('--light', UNIVERSES[to].light);
    liquid.style.setProperty('--sx', (eCover * 120 - 20 + eRet * 40) + '%');
    liquid.style.clipPath = `path("${liquidPath(eRet, eCover, seg * 3.7)}")`;
  }

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
