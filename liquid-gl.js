/* Liquide WebGL : champ d'épaisseur + normales + éclairage (reflets, fresnel, ombre portée).
   Entièrement déterministe en fonction de (eBot, eTop) => piloté par le scroll, réversible. */
(function () {
  const ND = 14;
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `precision highp float;
#define ND ${ND}
uniform vec2 uRes;uniform float uDPR,uBot,uTop,uSeed;uniform vec3 uA,uB;
uniform vec4 uDB[ND];uniform vec4 uDT[ND];
float h1(float n){return fract(sin(n*127.1+uSeed)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .5*n2(p)+.25*n2(p*2.03+7.)+.125*n2(p*4.1+13.);}
/* bord bas : (y, dy/dx) */
vec2 botEdge(float x){
  float e=uBot,Dm=uRes.y*.45;
  float sheet=mix(-14.,uRes.y+14.,pow(e,1.5));
  sheet+=5.*sin(x*.021+e*5.)*sin(3.14159*e);
  float best=0.,slope=0.;
  for(int i=0;i<ND;i++){
    vec4 d=uDB[i];float w=d.y*uRes.x,q=(x-d.x*uRes.x)/w;
    if(abs(q)<.999){
      float r=smoothstep(d.w,d.w+.5,e),s=1.-q*q,v=Dm*d.z*r*pow(s,.6);
      if(v>best){best=v;slope=-Dm*d.z*r*.6*pow(s,-.4)*2.*q/w;}
    }
  }
  return vec2(sheet+best,clamp(slope,-8.,8.));
}
/* bord haut : la nappe glisse en laissant des traînées */
vec2 topEdge(float x){
  float e=uTop,H=uRes.y;
  float base=mix(-14.,H+14.,pow(e,1.2));
  float k=pow(sin(3.14159*e),.8),best=0.,slope=0.;
  for(int i=0;i<ND;i++){
    vec4 d=uDT[i];float w=d.y*uRes.x,q=(x-d.x*uRes.x)/w;
    if(abs(q)<.999){
      float s=1.-q*q,v=H*.38*d.z*k*pow(s,.6);
      if(v>best){best=v;slope=-H*.38*d.z*k*.6*pow(s,-.4)*2.*q/w;}
    }
  }
  return vec2(base-best,clamp(-slope,-8.,8.));
}
/* distance approchée au bord (px) : >0 dans le liquide */
float dist(vec2 p){
  vec2 b=botEdge(p.x);float d=(b.x-p.y)/sqrt(1.+b.y*b.y);
  if(uTop>.001){vec2 t=topEdge(p.x);d=min(d,(p.y-t.x)/sqrt(1.+t.y*t.y));}
  return d;
}
float R_;
float height(vec2 p){
  float d=dist(p),t=clamp(d/R_,0.,1.);
  return R_*sqrt(1.-(1.-t)*(1.-t))+(fbm(p*.012+uSeed)-.5)*5.*t;
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y*uDPR-gl_FragCoord.y)/uDPR;
  R_=clamp(uRes.y*.07,10.,30.);
  float d=dist(p);
  float a=clamp(d+.5,0.,1.);
  vec4 outc=vec4(0.);
  if(d>-1.){
    float e=1.5,h0=height(p),hx=height(p+vec2(e,0.)),hy=height(p+vec2(0.,e));
    vec3 n=normalize(vec3(-(hx-h0)/e*1.1,-(hy-h0)/e*1.1,1.));
    float t=clamp(d/R_,0.,1.);
    float flow=fbm(vec2(p.x*.008,p.y*.004-uBot*2.+uTop*2.)+3.);
    vec3 col=mix(uA,uB,.3+.7*smoothstep(0.,1.,t));
    col*=.9+.2*flow;
    vec3 L=normalize(vec3(-.5,-.7,.8)),V=vec3(0.,0.,1.),Hh=normalize(L+V);
    float diff=dot(n,L)*.5+.5;
    col*=.62+.6*diff;
    float spec=pow(max(dot(n,Hh),0.),110.)*1.5+pow(max(dot(n,Hh),0.),16.)*.16;
    float fr=pow(1.-n.z,2.2);
    vec3 r=vec3(2.*n.z*n.x,2.*n.z*n.y,2.*n.z*n.z-1.);
    float box=smoothstep(.6,.3,length(r.xy-vec2(-.5,-.55)));
    float env=box*.5+.25*smoothstep(-.3,1.,-r.y);
    col+=env*(.15+.7*fr)+spec+fr*.18*uA;
    col=mix(col,uB*.55,smoothstep(.35,0.,t)*.0);
    float al=a*mix(.78,1.,smoothstep(0.,.5,t));
    outc=vec4(col*al,al);
  }
  float ds=dist(p-vec2(0.,9.));
  float sh=.32*smoothstep(-12.,5.,ds)*(1.-outc.a);
  outc.a+=sh;
  gl_FragColor=outc;
}`;
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  window.createLiquidGL = function (canvas, segs) {
    const gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: false});
    if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const u = {res: U('uRes'), dpr: U('uDPR'), bot: U('uBot'), top: U('uTop'), seed: U('uSeed'), A: U('uA'), B: U('uB'), db: U('uDB'), dt: U('uDT')};
    const sets = [];
    for (let s = 0; s < segs; s++) {
      const r = mul(s * 97 + 13), b = [], t = [];
      for (let i = 0; i < ND; i++) {
        b.push((i + .1 + r() * .8) / ND, .028 + r() * .04, .12 + r() * .88, r() * .5);
        t.push((i + .1 + r() * .8) / ND, .03 + r() * .04, .2 + r() * .8, 0);
      }
      sets.push({b: new Float32Array(b), t: new Float32Array(t)});
    }
    gl.clearColor(0, 0, 0, 0);
    let W = 1, H = 1, D = 1;
    return {
      resize(w, h, dpr) { W = w; H = h; D = dpr; gl.viewport(0, 0, canvas.width, canvas.height); },
      clear() { gl.clear(gl.COLOR_BUFFER_BIT); },
      draw(eTop, eBot, seg, uni) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(u.res, W, H); gl.uniform1f(u.dpr, D); gl.uniform1f(u.bot, eBot); gl.uniform1f(u.top, eTop);
        gl.uniform1f(u.seed, seg * 3.7); gl.uniform3fv(u.A, hex(uni.light)); gl.uniform3fv(u.B, hex(uni.liquid));
        gl.uniform4fv(u.db, sets[seg].b); gl.uniform4fv(u.dt, sets[seg].t);
        gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  };
})();
