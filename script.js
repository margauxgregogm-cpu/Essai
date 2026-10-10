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
  W = holder.clientWidth; H = holder.clientHeight; DPR = Math.min(1.5, devicePixelRatio || 1);
  liquid.width = Math.round(W * DPR); liquid.height = Math.round(H * DPR); if (fx) fx.resize(W, H, DPR);
}
function applyRatio() {
  const r = cardRatio[current] || 1.586;
  if (r !== activeRatio) { activeRatio = r; holder.style.aspectRatio = r; measure(); }
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t * t * (3 - 2 * t);
const range = (t, a, b) => clamp((t - a) / (b - a));

/* ---- Liquide WebGL (voir liquid-gl.js). Sans WebGL : simple fondu. ---- */
const fx = window.createLiquidGL ? createLiquidGL(liquid, SEG) : null;
let DPR = 1;

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
  const noFx = reduce || !fx;
  if (noFx || eCover <= 0 || eRet >= 1) { if (fx && liquidOn) { fx.clear(); liquidOn = false; } }
  else { liquidOn = true; fx.draw(eRet, eCover, seg, UNIVERSES[to]); }

  /* Fonds : fondu doux entre univers autour du recouvrement. */
  const mix = ease(range(t, .3, .7));
  bgEls.forEach((b, j) => b.style.opacity = j === from ? 1 - mix : j === to ? mix : 0);
  if (p >= 1) bgEls.forEach((b, j) => b.style.opacity = j === N - 1 ? 1 : 0);
  if (noFx) { /* sans liquide : fondu de la carte au milieu du segment */
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
