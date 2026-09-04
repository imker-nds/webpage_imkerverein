// Sprite-based bees with configurable count and a single queen
//
// Overview:
// - Preloads bee sprite images, creates a canvas that covers the viewport
// - Spawns a number of Bee agents (one queen + workers)
// - Each Bee maintains position, velocity and a sprite image and is updated
//   each animation frame by the `loop()` function.
// - Interaction:
//   - Moving the mouse near bees causes them to avoid the cursor.
//   - Scrolling triggers a 'flee' behaviour where bees fly outward and fade.
//
// Configuration (set `window.BEE_CONFIG = { ... }` before this script loads):
// - count: number of bees
// - scale: visual scale multiplier for bee sizes
// - size: exact pixel size override for bees
// - queenScale: relative size for the queen (default ~1.25)
// - angleSmooth: smoothing factor for visual rotation (0..1)
//
(function(){
  const CANVAS_ID = 'bee-canvas';
  const RETURN_DELAY = 10000; // ms until bees slowly return

  // configurable options: set `window.BEE_CONFIG = { count: 20, scale: 2, size: 30 }` before script loads
  // NUM_BEES: number of agents to spawn
  const NUM_BEES = (window.BEE_CONFIG && window.BEE_CONFIG.count) || window.BEE_COUNT || 15;
  // BEE_SCALE: simple multiplier applied to computed bee sizes
  const BEE_SCALE = (window.BEE_CONFIG && window.BEE_CONFIG.scale) || 2; // user-visible multiplier (default 2x)
  // Responsive sizing parameters for bees (size adapts to viewport width)
  const BASE_BEE_SIZE = 35; // base pixel size before scaling
  const MIN_VIEWPORT_SCALE = 0.8; // minimum viewport factor (prevents bees becoming too small)
  const MAX_VIEWPORT_SCALE = 1.2; // maximum viewport factor
  // QUEEN_SCALE: queen is slightly larger than workers (default 1.25x)
  const QUEEN_SCALE = (window.BEE_CONFIG && window.BEE_CONFIG.queenScale) || 1.25; // queen relative size
  // ANGLE_SMOOTH: how quickly the sprite rotates to face its velocity vector
  const ANGLE_SMOOTH = (window.BEE_CONFIG && window.BEE_CONFIG.angleSmooth) || 0.18; // 0=no smoothing, 1=instant

  const canvas = document.getElementById(CANVAS_ID);
  const ctx = canvas.getContext('2d');

  // sprite assets (expect in assets/ folder)
  const WORKER_SPRITES = ['assets/bee1.png','assets/bee2.png','assets/bee3.png'];
  const QUEEN_SPRITE = 'assets/queen.png';

  let sprites = [];
  let queenImg = null;

  // Preload images then start
  function preload(list, cb){
    // load each worker sprite image and call cb when all loaded (or errored)
    let loaded = 0; const total = list.length;
    list.forEach((src, i)=>{
      const img = new Image(); img.src = src;
      // on success or error we count the file as handled and store the image object
      img.onload = ()=>{ loaded++; sprites[i]=img; if(loaded===total) cb(); };
      img.onerror = ()=>{ loaded++; sprites[i]=img; if(loaded===total) cb(); };
    });
  }

  function preloadQueen(src, cb){
    // queen image loaded separately; we keep the queen image in `queenImg`
    queenImg = new Image(); queenImg.src = src;
    queenImg.onload = cb; queenImg.onerror = cb;
  }

  // sizing helpers
  function resize(){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(300, Math.floor(window.innerHeight * dpr));
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // update bee sizes responsively after canvas resize
    // (the bees adapt to viewport width so they remain visually proportional)
    updateBeeSizes();
  }

  window.addEventListener('resize', ()=>{ resize(); });

  class Bee{
    constructor(opts){
      this.isQueen = !!opts.isQueen;
      this.sprite = opts.sprite; // Image
      // size is responsive; allow explicit override via opts.size
      // `this.size` controls the pixel width used when drawing the sprite
      this.size = opts.size || getResponsiveBeeSize();
      this.reset(opts.offscreen);
      this.alpha = 1;
      this.hidden = false;
    }
    reset(offscreen){
      // place the bee at a random position. If offscreen=true, spawn slightly
      // below the bottom so the bee can float in.
      this.x = Math.random()*window.innerWidth;
      this.y = offscreen ? (window.innerHeight + 40 + Math.random()*120) : (Math.random()*window.innerHeight);
      // initial velocity: small random value so bees start moving gently
      this.vx = (Math.random()-0.5)*1;
      this.vy = (Math.random()-0.5)*1;
      this.angle = Math.atan2(this.vy,this.vx);
      this.fleeing = false;
      this.alpha = this.alpha || 0.8; // visual transparency
    }
    update(bees, pointer, scrolled){
      // compute acceleration (ax, ay) for this timestep
      // ax/ay combine small random wandering with social and input forces
      let ax = (Math.random()-0.5)*0.04;
      let ay = (Math.random()-0.5)*0.03;

      // weak cohesion toward center: occasionally nudge bees toward the viewport center
      if(Math.random() < 0.02){ ax += (window.innerWidth/2 - this.x)*0.00002; ay += (window.innerHeight/2 - this.y)*0.00002; }

      // simple separation/attraction behaviour to keep bees from overlapping
      for(const other of bees){
        if(other===this) continue;
        const dx = other.x - this.x, dy = other.y - this.y;
        const dist = Math.hypot(dx,dy);
        // if too close, push away; if within a medium range, a slight attraction
        if(dist < 30){ ax -= (dx/dist)*0.06; ay -= (dy/dist)*0.04; }
        else if(dist < 80){ ax += (dx/dist)*0.002; ay += (dy/dist)*0.0018; }
      }

      // mouse avoidance: if the pointer is near, steer away from it
      if(pointer.active){
        const dx = this.x - pointer.x, dy = this.y - pointer.y;
        const d = Math.hypot(dx,dy)+0.01;
        if(d < 120){ ax += (dx/d)*0.12; ay += (dy/d)*0.08; this.fleeing = true; }
      }

      if(scrolled){
        // push outward from viewport center instead of always upward
        const cx = (window.innerWidth||800)/2;
        const cy = (window.innerHeight||600)/2;
        let dx = this.x - cx, dy = this.y - cy;
        let d = Math.hypot(dx,dy);
        if(d < 10){ // if near center, pick a random direction
          const a = Math.random()*Math.PI*2; dx = Math.cos(a); dy = Math.sin(a); d = 1;
        }
        dx /= d; dy /= d;
        // outward impulse (some randomness)
        const impulse = 0.8 + Math.random()*0.6;
        this.vx += dx * impulse;
        this.vy += dy * impulse;
        // fade out more slowly
        this.alpha -= 0.01;
        if(this.alpha <= 0.03) this.hidden = true;
      }

      // integrate accelerations into velocity
      this.vx += ax; this.vy += ay;
      // limiter: cap the speed so bees don't accelerate arbitrarily fast
      const speed = Math.hypot(this.vx,this.vy);
      const max = scrolled ? 8 : (this.isQueen ? 1.2 : 1.6);
      if(speed > max){ this.vx = (this.vx/speed)*max; this.vy = (this.vy/speed)*max; }

      this.x += this.vx; this.y += this.vy;
      // smooth only the angle changes to reduce visual jitter. We compute the
      // shortest angular difference and move `this.angle` a fraction (ANGLE_SMOOTH)
      // toward the target each frame instead of snapping instantly.
      const targetAngle = Math.atan2(this.vy, this.vx);
      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * ANGLE_SMOOTH;

      // wrap bounds
      if(this.x < -60) this.x = window.innerWidth + 10;
      if(this.x > window.innerWidth + 60) this.x = -10;
      if(this.y < -120) this.y = window.innerHeight + 20;
      if(this.y > window.innerHeight + 120) this.y = -20;
    }
    draw(ctx){
      if(this.hidden) return;
      // draw the bee sprite centered on (x,y) rotated so the sprite's head
      // (image orientation: up) points in the direction of `this.angle`.
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.rotate(this.angle + Math.PI/2);
      const img = this.sprite;
      if(img && img.complete){
        // compute target draw width & height preserving image aspect ratio
        const w = this.size;
        const h = this.size * (img.height / img.width || 1);
        ctx.globalAlpha = this.alpha;
        ctx.drawImage(img, -w/2, -h/2, w, h);
        ctx.globalAlpha = 1;
      } else {
        // fallback rendering if image not loaded: simple circle
        ctx.fillStyle = 'rgba(50,30,10,'+this.alpha+')';
        ctx.beginPath(); ctx.arc(0,0,this.size*0.6,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  let bees = [];
  let pointer = {x:0,y:0,active:false};
  let scrolled = false;
  let returnTimeout = null;

  function createBees(){
    bees = [];
    // determine queen index
    const queenIndex = Math.floor(Math.random()*NUM_BEES);
    // distribute worker sprites equally among workers
    const workerCount = Math.max(0, NUM_BEES - 1);
    for(let i=0;i<NUM_BEES;i++){
      // create the queen as a single special bee
      if(i===queenIndex){ bees.push(new Bee({isQueen:true, sprite: queenImg, size: Math.round(getResponsiveBeeSize()*QUEEN_SCALE), offscreen: false})); continue; }
      // choose sprite to keep roughly equal distribution
      const idx = Math.floor(((i - (i>queenIndex?1:0)) % WORKER_SPRITES.length + WORKER_SPRITES.length) % WORKER_SPRITES.length);
      bees.push(new Bee({isQueen:false, sprite: sprites[idx], offscreen:false}));
    }
  }

  // compute bee size based on viewport width and config
  function getResponsiveBeeSize(){
    // explicit pixel override wins
    if(window.BEE_CONFIG && window.BEE_CONFIG.size) return window.BEE_CONFIG.size;
    // compute a viewport-based scaling factor so bees scale moderately with
    // window width. We clamp the viewport influence to avoid extremes.
    const vw = Math.max(320, Math.min(window.innerWidth || 1024, 2400));
    const viewportScale = Math.max(MIN_VIEWPORT_SCALE, Math.min(MAX_VIEWPORT_SCALE, vw / 1000));
    const size = Math.round(BASE_BEE_SIZE * viewportScale * BEE_SCALE);
    return size;
  }

  function updateBeeSizes(){
    if(!bees || bees.length===0) return;
    const newSize = getResponsiveBeeSize();
    for(const b of bees){
      // apply responsive size to workers and scale queen accordingly
      b.size = b.isQueen ? Math.round(newSize * QUEEN_SCALE) : newSize;
    }
  }

  let lastTime = 0;
  function loop(t){
    const dt = Math.min(40, t - lastTime); lastTime = t;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // draw then update
    for(const b of bees) b.draw(ctx);
    for(const b of bees) b.update(bees, pointer, scrolled);
    requestAnimationFrame(loop);
  }

  window.addEventListener('mousemove', (e)=>{ pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; clearTimeout(pointer._t); pointer._t = setTimeout(()=>{ pointer.active = false; }, 1200); });
  // pointer handling: we set `pointer.active` true for ~1.2s after last movement so
  // bees respond to brief mouse movement without needing constant events.

  window.addEventListener('scroll', ()=>{
    scrolled = true; clearTimeout(returnTimeout);
    returnTimeout = setTimeout(()=>{
      scrolled = false;
      for(const b of bees){ if(b.hidden){ b.reset(true); b.hidden=false; b.alpha=0; } }
      let fadeInt = setInterval(()=>{ let done=true; for(const b of bees){ b.alpha = Math.min(1, b.alpha+0.06); if(b.alpha<1) done=false; } if(done) clearInterval(fadeInt); }, 120);
    }, RETURN_DELAY);
  }, {passive:true});

  // scroll handling: `scrolled` is true for a short while after a scroll event.
  // Individual bees respond immediately by getting an outward impulse (see
  // code in `update()`) and gradually fade out. After `RETURN_DELAY` the
  // system restores hidden bees and fades them back in.

  // start once sprites loaded
  preload(WORKER_SPRITES, ()=>{ preloadQueen(QUEEN_SPRITE, ()=>{ resize(); createBees(); lastTime = performance.now(); requestAnimationFrame(loop); }); });

})();
