/* ============================================================
   RAGNAR SOLUTIONS — script.js
   Interactions, animations, particles, form handling
   ============================================================ */

(function () {
  'use strict';

  /* ---- Navbar scroll effect ---- */
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    updateActiveNav();
  });

  function updateActiveNav() {
    const sections = ['home', 'services', 'gift-cards', 'why-us', 'contact'];
    let current = '';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) {
        current = id;
      }
    });
    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  /* ---- Mobile hamburger ---- */
  const hamburger = document.getElementById('hamburger');
  const navLinksEl = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinksEl.classList.toggle('open');
  });

  navLinksEl.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinksEl.classList.remove('open');
    });
  });

  /* ---- Smooth scroll for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        const offset = 72;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ---- Intersection Observer for fade-in animations ---- */
  const fadeEls = document.querySelectorAll(
    '.service-card, .why-card, .gc-brand-item, .social-card, .gc-badge, .trust-item, .cta-banner, .contact-form-wrap, .contact-info-box'
  );

  fadeEls.forEach(el => el.classList.add('fade-in'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, 60 * (Array.from(fadeEls).indexOf(entry.target) % 5));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach(el => observer.observe(el));

  /* ---- Particle Canvas ---- */
  function initParticles() {
    const container = document.getElementById('hero-particles');
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'particles-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let W, H, particles = [];

    function resize() {
      W = canvas.width  = container.offsetWidth;
      H = canvas.height = container.offsetHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    const COUNT = 60;

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.r = Math.random() * 1.5 + 0.4;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.alpha = Math.random() * 0.4 + 0.1;
        this.blue = Math.random() > 0.6;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.blue
          ? `rgba(61,139,255,${this.alpha})`
          : `rgba(200,208,224,${this.alpha * 0.4})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < COUNT; i++) particles.push(new Particle());

    function connectParticles() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(26,109,255,${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });
      connectParticles();
      requestAnimationFrame(loop);
    }

    loop();
  }

  initParticles();

  /* ---- Gift card stack hover interaction ---- */
  const gcCards = document.querySelectorAll('.gc-card');
  gcCards.forEach((card, i) => {
    card.addEventListener('mouseenter', () => {
      gcCards.forEach((c, j) => {
        if (j !== i) c.style.filter = 'brightness(0.5)';
      });
    });
    card.addEventListener('mouseleave', () => {
      gcCards.forEach(c => { c.style.filter = ''; });
    });
  });

  /* ---- Contact form handling ---- */
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('form-success');
  const submitBtn = document.getElementById('form-submit-btn');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const name    = document.getElementById('input-name').value.trim();
      const email   = document.getElementById('input-email').value.trim();
      const service = document.getElementById('input-service').value;
      const message = document.getElementById('input-message').value.trim();

      // Basic validation
      if (!name || !email || !service || !message) {
        highlightEmpty();
        return;
      }

      if (!isValidEmail(email)) {
        document.getElementById('input-email').style.borderColor = '#ff4d6d';
        return;
      }

      // Simulate sending
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';

      setTimeout(() => {
        form.reset();
        submitBtn.textContent = 'Send Message';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        successMsg.style.display = 'block';
        setTimeout(() => { successMsg.style.display = 'none'; }, 5000);
      }, 1500);
    });
  }

  function highlightEmpty() {
    ['input-name', 'input-email', 'input-service', 'input-message'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) {
        el.style.borderColor = '#ff4d6d';
        el.addEventListener('input', () => { el.style.borderColor = ''; }, { once: true });
      }
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ---- Number counter animation for stats (if present) ---- */
  function animateCounter(el, target, duration) {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = Math.floor(start).toLocaleString() + (el.dataset.suffix || '');
    }, 16);
  }

  /* ---- Typing effect for hero subtitle ---- */
  function typeEffect(el, text, speed) {
    if (!el) return;
    el.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        el.textContent += text[i++];
      } else {
        clearInterval(timer);
      }
    }, speed);
  }

  // Start typing after a brief delay
  setTimeout(() => {
    typeEffect(document.getElementById('hero-subtitle'), 'All in One Place.', 60);
  }, 800);

  /* ---- Floating cards glow on hover ---- */
  document.querySelectorAll('.floating-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 8px 40px rgba(26,109,255,0.4), 0 0 0 1px rgba(26,109,255,0.4)';
      card.style.zIndex = '20';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
      card.style.zIndex = '';
    });
  });

  /* ---- Service card tilt effect ---- */
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotX = (-y / rect.height) * 4;
      const rotY = (x / rect.width) * 4;
      card.style.transform = `translateY(-6px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      card.style.transition = 'none';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = '';
    });
  });

  /* ---- Why-card stagger animation ---- */
  const whyCards = document.querySelectorAll('.why-card');
  const whyObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      whyCards.forEach((card, i) => {
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 100);
      });
      whyObs.disconnect();
    }
  }, { threshold: 0.2 });

  whyCards.forEach(c => {
    c.style.opacity = '0';
    c.style.transform = 'translateY(30px)';
    c.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  const whySection = document.getElementById('why-us');
  if (whySection) whyObs.observe(whySection);

  /* ---- Active nav highlight on scroll ---- */
  updateActiveNav();

  /* ---- Gift card brand icons (text-based visual) ---- */
  const brandIcons = {
    'gcb-apple':   { bg: '#1c1c1e', text: ' ', color: '#fff' },
    'gcb-amazon':  { bg: '#ff9900', text: 'A',  color: '#fff' },
    'gcb-google':  { bg: '#4285f4', text: 'G',  color: '#fff' },
    'gcb-ps':      { bg: '#003087', text: 'PS', color: '#fff' },
    'gcb-vanilla': { bg: '#6b4f3a', text: 'V',  color: '#fff' },
    'gcb-visa':    { bg: '#1a1f71', text: 'V',  color: '#fff' },
    'gcb-mc':      { bg: '#eb001b', text: 'MC', color: '#fff' },
    'gcb-steam':   { bg: '#1b2838', text: 'S',  color: '#fff' },
  };

  Object.entries(brandIcons).forEach(([id, cfg]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = el.querySelector('.gc-brand-icon');
    if (!icon) return;
    icon.style.background = cfg.bg;
    icon.style.color = cfg.color;
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.fontSize = '0.7rem';
    icon.style.fontWeight = '900';
    icon.style.borderRadius = '8px';
    icon.textContent = cfg.text;
  });

  /* ---- Scroll-to-top on logo click ---- */
  document.getElementById('nav-logo-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ============================================================
     LIVE CRYPTO TICKER
     ============================================================ */
  const TICKER_COINS = {
    bitcoin:     { sym:'BTC',  name:'Bitcoin'   },
    ethereum:    { sym:'ETH',  name:'Ethereum'  },
    solana:      { sym:'SOL',  name:'Solana'    },
    tether:      { sym:'USDT', name:'Tether'    },
    binancecoin: { sym:'BNB',  name:'BNB'       },
    ripple:      { sym:'XRP',  name:'XRP'       },
    dogecoin:    { sym:'DOGE', name:'Dogecoin'  },
    cardano:     { sym:'ADA',  name:'Cardano'   },
  };

  const TICKER_FALLBACK = {
    bitcoin:     { usd:65420,  usd_24h_change: 2.1  },
    ethereum:    { usd:3210,   usd_24h_change:-1.3  },
    solana:      { usd:148.4,  usd_24h_change: 4.2  },
    tether:      { usd:1.00,   usd_24h_change: 0.01 },
    binancecoin: { usd:580.5,  usd_24h_change: 1.5  },
    ripple:      { usd:0.58,   usd_24h_change:-0.8  },
    dogecoin:    { usd:0.124,  usd_24h_change: 3.1  },
    cardano:     { usd:0.44,   usd_24h_change:-0.4  },
  };

  function buildTickerHTML(data) {
    let html = '';
    for (const [id, info] of Object.entries(data)) {
      const coin    = TICKER_COINS[id];
      if (!coin) continue;
      const price   = info.usd >= 1
        ? '$' + info.usd.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
        : '$' + info.usd.toFixed(5);
      const chg     = (info.usd_24h_change || 0).toFixed(2);
      const cls     = info.usd_24h_change >= 0 ? 'up' : 'down';
      const sign    = info.usd_24h_change >= 0 ? '+' : '';
      html += `<div class="ticker-item">
        <span class="ticker-coin">${coin.sym}</span>
        <span class="ticker-price">${price}</span>
        <span class="ticker-change ${cls}">${sign}${chg}%</span>
      </div>`;
    }
    return html;
  }

  async function refreshTicker() {
    const inner = document.getElementById('ticker-inner');
    if (!inner) return;
    try {
      const ids = Object.keys(TICKER_COINS).join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const html = buildTickerHTML(data);
      inner.innerHTML = html + html; /* duplicate for seamless loop */
    } catch (err) {
      /* Use fallback prices if API unreachable */
      const html = buildTickerHTML(TICKER_FALLBACK);
      inner.innerHTML = html + html;
    }
  }

  refreshTicker();
  setInterval(refreshTicker, 60000);

  console.log('%c RAGNAR SOLUTIONS ', 'background:#1a6dff;color:#fff;font-size:20px;font-weight:900;padding:8px 20px;border-radius:8px;');
  console.log('%c Powering Digital Success ', 'color:#3d8bff;font-size:14px;');

})();
