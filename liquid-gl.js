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
/* houle : y(x) et pente, plusieurs vagues superposées qui avancent avec e */
vec2 swell(float x,float ph,float A){
  float k1=.0105,k2=.0270,k3=.0046;
  float y=A*(.55*sin(x*k1+ph*7.)+.3*sin(x*k2-ph*5.+1.3)+.75*sin(x*k3+2.+ph*3.));
  float s=A*(.55*k1*cos(x*k1+ph*7.)+.3*k2*cos(x*k2-ph*5.+1.3)+.75*k3*cos(x*k3+2.+ph*3.));
  return vec2(y,s);
}
vec2 botEdge(float x){
  float A=uRes.y*.075;vec2 w=swell(x,uBot,A);
  return vec2(mix(-2.*A-14.,uRes.y+2.*A+14.,uBot)+w.x,w.y);
}
vec2 topEdge(float x){
  float A=uRes.y*.06;vec2 w=swell(x,uTop+1.7,A);
  return vec2(mix(-2.*A-14.,uRes.y+2.*A+14.,uTop)+w.x,w.y);
}
/* distance approchée au bord (px) : >0 dans l'eau */
float dist(vec2 p){
  vec2 b=botEdge(p.x);float d=(b.x-p.y)/sqrt(1.+b.y*b.y);
  if(uTop>.001){vec2 t=topEdge(p.x);d=min(d,(p.y-t.x)/sqrt(1.+t.y*t.y));}
  return d;
}
float ripple(vec2 p){
  return fbm(vec2(p.x*.025,p.y*.05)+vec2(uBot*3.,-uTop*3.))+.5*n2(p*.09+vec2(uBot*6.,uTop*4.));
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y*uDPR-gl_FragCoord.y)/uDPR;
  float d=dist(p);
  vec4 outc=vec4(0.);
  if(d>-1.){
    float a=clamp(d+.5,0.,1.);
    float e=1.2,r0=ripple(p),rx=ripple(p+vec2(e,0.)),ry=ripple(p+vec2(0.,e));
    float depth=smoothstep(0.,uRes.y*.45,d);
    vec3 n=normalize(vec3(-(rx-r0)/e*.9,-(ry-r0)/e*.9,1.));
    vec3 col=mix(uA,uB,.25+.75*depth);
    vec3 L=normalize(vec3(-.4,-.7,.6)),V=vec3(0.,0.,1.),Hh=normalize(L+V);
    col*=.85+.3*(dot(n,L)*.5+.5);
    float spec=pow(max(dot(n,Hh),0.),70.)*1.1;
    float fr=pow(1.-n.z,2.);
    col+=spec+fr*.25;
    /* caustiques douces */
    col+=.07*smoothstep(.55,.9,n2(p*.045+vec2(uBot*4.,uTop*3.)))*(1.-depth);
    /* écume : bande claire et bulleuse le long du bord */
    float bub=n2(p*.35+uBot*2.)*.6+n2(p*.9)*.4;
    float foam=smoothstep(26.,2.,d)*smoothstep(.28,.62,bub+(1.-smoothstep(0.,26.,d))*.35);
    foam+=smoothstep(3.,0.,abs(d-34.-12.*sin(p.x*.02)))*.35*(1.-depth)*step(.001,uBot)*smoothstep(0.,.3,uBot);
    vec3 fc=mix(vec3(1.),uA,.12);
    col=mix(col,fc,clamp(foam,0.,1.));
    float al=a*mix(.7,1.,smoothstep(0.,45.,d));
    al=mix(al,a,clamp(foam,0.,1.));
    outc=vec4(col*al,al);
  }
  /* sable mouillé autour du bord */
  float wet=.2*smoothstep(-40.,0.,d)*(1.-outc.a);
  outc.a+=wet;
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
