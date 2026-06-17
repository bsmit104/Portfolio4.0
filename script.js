/* =========================================================
   Starfield — a small custom canvas engine.
   Twinkling depth-layered stars, a sparse constellation
   drawn between a handful of anchor stars, gentle mouse
   parallax, the occasional comet, and a soft pulse on click.
========================================================= */

(function starfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const STAR_COLORS = [
    "255,255,255",
    "200,220,255",
    "94,234,212",
    "185,166,255",
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let links = [];
  let comets = [];
  let pulses = [];
  let mouse = { x: null, y: null };
  let lastTime = performance.now();
  let resizeTimer = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function buildStars() {
    const density = 9200; // px^2 per star, tuned for a clear but not busy sky
    const count = Math.min(220, Math.max(70, Math.round((width * height) / density)));
    stars = [];
    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + depth * 1.6,
        depth,
        baseAlpha: 0.25 + depth * 0.55,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.1,
        color: Math.random() < 0.86 ? STAR_COLORS[0] : STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        vy: 0.004 + depth * 0.012,
        vx: (Math.random() - 0.5) * 0.006,
      });
    }
    buildLinks();
  }

  function buildLinks() {
    // pick a sparse set of brighter "anchor" stars and connect each
    // to its single nearest neighbour among the anchors only —
    // keeps the constellation feeling drawn, not like a dense mesh.
    const anchors = [...stars].sort((a, b) => b.r - a.r).slice(0, Math.max(8, Math.round(stars.length * 0.09)));
    links = [];
    anchors.forEach((star, i) => {
      let nearest = null;
      let nearestDist = Infinity;
      anchors.forEach((other, j) => {
        if (i === j) return;
        const d = Math.hypot(star.x - other.x, star.y - other.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = other;
        }
      });
      if (nearest && nearestDist < Math.max(width, height) * 0.32) {
        links.push({ a: star, b: nearest, phase: Math.random() * Math.PI * 2 });
      }
    });
  }

  function spawnComet() {
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -60 : width + 60;
    const startY = Math.random() * height * 0.55;
    const dir = fromLeft ? 1 : -1;
    const speed = 7 + Math.random() * 4;
    comets.push({
      x: startX,
      y: startY,
      vx: dir * speed,
      vy: speed * 0.42,
      trail: [],
      life: 0,
      maxLife: 70,
    });
  }

  function scheduleComet() {
    const delay = 5000 + Math.random() * 7000;
    setTimeout(() => {
      if (!document.hidden) spawnComet();
      scheduleComet();
    }, delay);
  }

  function update(dt) {
    stars.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < -5) s.x = width + 5;
      if (s.x > width + 5) s.x = -5;
      if (s.y > height + 5) {
        s.y = -5;
        s.x = Math.random() * width;
      }
    });

    comets.forEach((c) => {
      c.trail.push({ x: c.x, y: c.y });
      if (c.trail.length > 14) c.trail.shift();
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life += dt;
    });
    comets = comets.filter((c) => c.life < c.maxLife);

    pulses.forEach((p) => (p.life += dt));
    pulses = pulses.filter((p) => p.life < p.maxLife);
  }

  function render(time) {
    ctx.clearRect(0, 0, width, height);

    const mx = mouse.x;
    const my = mouse.y;
    const hasMouse = mx !== null;
    const cx = width / 2;
    const cy = height / 2;
    const px = hasMouse ? (mx - cx) / cx : 0;
    const py = hasMouse ? (my - cy) / cy : 0;

    // constellation lines first, so stars sit on top
    links.forEach((l) => {
      const shimmer = 0.5 + 0.5 * Math.sin(time / 1800 + l.phase);
      const ax = l.a.x + px * l.a.depth * 10;
      const ay = l.a.y + py * l.a.depth * 10;
      const bx = l.b.x + px * l.b.depth * 10;
      const by = l.b.y + py * l.b.depth * 10;
      ctx.strokeStyle = `rgba(185,166,255,${0.06 + shimmer * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    });

    stars.forEach((s) => {
      const twinkle = prefersReduced
        ? 1
        : 0.55 + 0.45 * Math.sin(time / 1000 * s.twinkleSpeed + s.phase);
      let alpha = s.baseAlpha * twinkle;
      let radius = s.r;

      const ox = s.x + px * s.depth * 14;
      const oy = s.y + py * s.depth * 14;

      if (hasMouse) {
        const d = Math.hypot(ox - mx, oy - my);
        if (d < 90) {
          const boost = 1 - d / 90;
          alpha = Math.min(1, alpha + boost * 0.5);
          radius = s.r + boost * 1.6;
        }
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${s.color},${alpha})`;
      ctx.arc(ox, oy, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    comets.forEach((c) => {
      const fade = 1 - c.life / c.maxLife;
      for (let i = 0; i < c.trail.length - 1; i++) {
        const p1 = c.trail[i];
        const p2 = c.trail[i + 1];
        const t = i / c.trail.length;
        ctx.strokeStyle = `rgba(255,255,255,${fade * t * 0.6})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.arc(c.x, c.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    pulses.forEach((p) => {
      const t = p.life / p.maxLife;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(94,234,212,${0.5 * (1 - t)})`;
      ctx.lineWidth = 1.2;
      ctx.arc(p.x, p.y, t * 46, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function loop(time) {
    const dt = Math.min(32, time - lastTime) / 16.67;
    lastTime = time;
    update(dt);
    render(time);
    requestAnimationFrame(loop);
  }

  function staticRender() {
    // reduced-motion fallback: one calm frame, no animation loop
    render(0);
  }

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });
  window.addEventListener("click", (e) => {
    pulses.push({ x: e.clientX, y: e.clientY, life: 0, maxLife: 36 });
  });

  resize();

  if (prefersReduced) {
    staticRender();
  } else {
    requestAnimationFrame(loop);
    scheduleComet();
  }
})();

/* =========================================================
   Nav: scrolled state + mobile toggle
========================================================= */

(function nav() {
  const navEl = document.querySelector(".nav");
  const toggle = document.querySelector(".nav-toggle");
  if (!navEl) return;

  const onScroll = () => {
    navEl.classList.toggle("scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = navEl.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navEl.querySelectorAll(".nav-links a").forEach((link) => {
      link.addEventListener("click", () => {
        navEl.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }
})();

/* =========================================================
   Scroll reveal
========================================================= */

(function reveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
})();