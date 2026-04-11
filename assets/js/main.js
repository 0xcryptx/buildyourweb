document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const initProjectModals = () => {
    const projects = Array.from(document.querySelectorAll(".project[data-modal-title]"));
    if (!projects.length) return;

    if (!document.querySelector(".modal-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.setAttribute("hidden", "");
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalDesc">
          <button class="modal-close" type="button" aria-label="Close modal">Close</button>
          <div class="modal-media project-media">
            <div class="project-mock">
              <div class="project-mock-chrome">
                <span class="project-mock-dot project-mock-dot--r"></span>
                <span class="project-mock-dot project-mock-dot--y"></span>
                <span class="project-mock-dot project-mock-dot--g"></span>
                <span class="project-mock-url"></span>
              </div>
              <div class="project-mock-viewport">
                <div class="modal-carousel" id="modalCarousel">
                  <div class="modal-track" id="modalTrack"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-gallery" id="modalGallery" hidden></div>
          <div class="modal-body">
            <p class="modal-kicker" id="modalType"></p>
            <h3 class="modal-title">
              <a class="modal-title-link" id="modalTitleLink" href="#" target="_blank" rel="noopener noreferrer"></a>
            </h3>
            <p class="modal-visit-hint" id="modalVisitHint" hidden>Visit website ↗</p>
            <p class="modal-desc" id="modalDesc"></p>
            <ul class="modal-list" id="modalList"></ul>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const overlay = document.querySelector(".modal-overlay");
    const dialog = overlay?.querySelector(".modal");
    const closeBtn = overlay?.querySelector(".modal-close");
    const titleLinkEl = overlay?.querySelector("#modalTitleLink");
    const visitHintEl = overlay?.querySelector("#modalVisitHint");
    const typeEl = overlay?.querySelector("#modalType");
    const descEl = overlay?.querySelector("#modalDesc");
    const listEl = overlay?.querySelector("#modalList");
    const carouselEl = overlay?.querySelector("#modalCarousel");
    const trackEl = overlay?.querySelector("#modalTrack");
    const galleryEl = overlay?.querySelector("#modalGallery");
    const mediaEl = overlay?.querySelector(".modal-media");
    if (!overlay || !dialog || !closeBtn || !titleLinkEl || !visitHintEl || !typeEl || !descEl || !listEl || !carouselEl || !trackEl || !galleryEl || !mediaEl) return;

    let lastFocus = null;
    let currentImages = [];
    let currentTitle = "";
    let currentIndex = 0;
    let displayIndex = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragDeltaX = 0;
    let isDragging = false;
    let dragAxis = "";
    let activePointerId = null;
    let wheelSettleTimer = 0;
    let nextAllowedSwitchAt = 0;

    const viewportWidth = () => Math.max(1, carouselEl.clientWidth || mediaEl.clientWidth || 1);
    const wrapIndex = (idx) =>
      ((idx % Math.max(1, currentImages.length)) + Math.max(1, currentImages.length)) %
      Math.max(1, currentImages.length);
    const transitionMs = 320;

    const setTrackTransform = (animate) => {
      const width = viewportWidth();
      const base = -displayIndex * width + dragDeltaX;
      trackEl.style.transition = animate ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none";
      trackEl.style.transform = `translate3d(${base}px, 0, 0)`;
    };

    const setActiveThumb = () => {
      const thumbs = galleryEl.querySelectorAll(".modal-gallery-thumb");
      thumbs.forEach((thumb, idx) => {
        thumb.classList.toggle("active", idx === currentIndex);
      });
    };

    const renderSlides = () => {
      const slides = [...currentImages];
      if (slides.length > 1) {
        slides.unshift(currentImages[currentImages.length - 1]);
        slides.push(currentImages[0]);
      }
      trackEl.innerHTML = slides
        .map(
          (src) =>
            `<div class="modal-slide"><img class="modal-image" src="${escapeHtml(src)}" alt="" /></div>`
        )
        .join("");
      dragDeltaX = 0;
      displayIndex = currentImages.length > 1 ? currentIndex + 1 : 0;
      setTrackTransform(false);
    };

    const goToIndex = (nextIndex, animate = true) => {
      if (!currentImages.length) return;
      const count = currentImages.length;
      const prevIndex = currentIndex;
      const nextWrapped = wrapIndex(nextIndex);
      currentIndex = nextWrapped;
      dragDeltaX = 0;
      if (count > 1) {
        if (prevIndex === count - 1 && nextWrapped === 0) {
          displayIndex = count + 1;
        } else if (prevIndex === 0 && nextWrapped === count - 1) {
          displayIndex = 0;
        } else {
          displayIndex = nextWrapped + 1;
        }
      } else {
        displayIndex = 0;
      }
      setTrackTransform(animate);
      setActiveThumb();

      if (animate && count > 1 && (displayIndex === 0 || displayIndex === count + 1)) {
        window.setTimeout(() => {
          displayIndex = currentIndex + 1;
          setTrackTransform(false);
        }, transitionMs + 20);
      }
    };

    const shiftImage = (delta) => {
      if (currentImages.length < 2) return;
      const now = Date.now();
      if (now < nextAllowedSwitchAt) return;
      nextAllowedSwitchAt = now + 180;
      goToIndex(currentIndex + delta, true);
    };

    const startDrag = (x, y) => {
      if (currentImages.length < 2) return;
      isDragging = true;
      dragAxis = "";
      dragStartX = x;
      dragStartY = y;
      dragDeltaX = 0;
      trackEl.style.transition = "none";
      mediaEl.classList.add("is-dragging");
    };

    const moveDrag = (x, y) => {
      if (!isDragging || currentImages.length < 2) return;
      const dx = x - dragStartX;
      const dy = y - dragStartY;
      if (!dragAxis) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        dragAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      if (dragAxis !== "x") return;
      dragDeltaX = dx;
      setTrackTransform(false);
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      dragAxis = "";
      mediaEl.classList.remove("is-dragging");
      if (currentImages.length < 2) return;
      const threshold = viewportWidth() * 0.18;
      if (dragDeltaX <= -threshold) {
        goToIndex(currentIndex + 1, true);
      } else if (dragDeltaX >= threshold) {
        goToIndex(currentIndex - 1, true);
      } else {
        goToIndex(currentIndex, true);
      }
    };

    const openModal = (projectEl) => {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const title = projectEl.dataset.modalTitle || "";
      const type = projectEl.dataset.modalType || "";
      const url = (projectEl.dataset.modalUrl || "").trim();
      const description = projectEl.dataset.modalDescription || "";
      const pointsRaw = projectEl.dataset.modalPoints || "";
      const points = pointsRaw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const thumb = projectEl.querySelector(".project-mock-viewport img");
      const modalImages = (projectEl.dataset.modalImages || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const images = modalImages.length ? modalImages : [thumb?.getAttribute("src") || ""];
      currentImages = images;
      currentTitle = title;
      currentIndex = 0;

      typeEl.textContent = type;
      titleLinkEl.textContent = title;
      titleLinkEl.href = url || "#";
      titleLinkEl.classList.toggle("is-disabled", !url);
      titleLinkEl.setAttribute("aria-disabled", String(!url));
      if (url) {
        visitHintEl.hidden = false;
        visitHintEl.textContent = "Website link ↑";
      } else {
        visitHintEl.hidden = true;
      }
      descEl.textContent = description;
      listEl.innerHTML = points.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
      renderSlides();
      galleryEl.innerHTML = "";

      if (currentImages.length > 1) {
        galleryEl.hidden = false;
        currentImages.forEach((src, idx) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `modal-gallery-thumb${idx === 0 ? " active" : ""}`;
          button.setAttribute("aria-label", `View image ${idx + 1} for ${title}`);
          button.innerHTML = `<img src="${escapeHtml(src)}" alt="" />`;
          button.addEventListener("click", () => {
            goToIndex(idx, true);
          });
          galleryEl.appendChild(button);
        });
      } else {
        galleryEl.hidden = true;
      }

      overlay.removeAttribute("hidden");
      window.requestAnimationFrame(() => {
        overlay.classList.add("is-open");
        setTrackTransform(true);
      });
      document.body.classList.add("modal-open");
      closeBtn.focus();
    };

    const closeModal = () => {
      if (overlay.hasAttribute("hidden")) return;
      overlay.classList.remove("is-open");
      window.setTimeout(() => {
        overlay.setAttribute("hidden", "");
      }, 240);
      document.body.classList.remove("modal-open");
      if (lastFocus) lastFocus.focus();
    };

    projects.forEach((project) => {
      const body = project.querySelector(".project-body");
      if (body && !body.querySelector(".project-hint")) {
        const hint = document.createElement("p");
        hint.className = "project-hint";
        hint.textContent = "View Project";
        body.appendChild(hint);
      }
      project.addEventListener("click", () => openModal(project));
      project.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(project);
        }
      });
    });

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    mediaEl.addEventListener("touchstart", (e) => {
      if (currentImages.length < 2 || overlay.hasAttribute("hidden")) return;
      const touch = e.changedTouches[0];
      startDrag(touch.clientX, touch.clientY);
    });
    mediaEl.addEventListener("touchmove", (e) => {
      if (!isDragging || currentImages.length < 2) return;
      const touch = e.changedTouches[0];
      moveDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    });
    mediaEl.addEventListener("touchcancel", () => {
      endDrag();
    });
    mediaEl.addEventListener("touchend", (e) => {
      if (currentImages.length < 2 || overlay.hasAttribute("hidden")) return;
      const touch = e.changedTouches[0];
      moveDrag(touch.clientX, touch.clientY);
      endDrag();
    });
    mediaEl.addEventListener("pointerdown", (e) => {
      if (currentImages.length < 2 || e.pointerType === "touch" || overlay.hasAttribute("hidden")) return;
      activePointerId = e.pointerId;
      mediaEl.setPointerCapture(e.pointerId);
      startDrag(e.clientX, e.clientY);
    });
    mediaEl.addEventListener("pointermove", (e) => {
      if (!isDragging || currentImages.length < 2 || e.pointerType === "touch") return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      moveDrag(e.clientX, e.clientY);
    });
    mediaEl.addEventListener("pointerup", (e) => {
      if (currentImages.length < 2 || e.pointerType === "touch") return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      moveDrag(e.clientX, e.clientY);
      endDrag();
      if (activePointerId !== null) {
        mediaEl.releasePointerCapture(activePointerId);
      }
      activePointerId = null;
    });
    mediaEl.addEventListener("pointercancel", () => {
      endDrag();
      activePointerId = null;
    });
    mediaEl.addEventListener(
      "wheel",
      (e) => {
        if (overlay.hasAttribute("hidden") || currentImages.length < 2) return;
        const dominantHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
        if (!dominantHorizontal || Math.abs(e.deltaX) < 3) return;
        e.preventDefault();
        dragDeltaX = Math.max(
          -viewportWidth() * 0.6,
          Math.min(viewportWidth() * 0.6, dragDeltaX - e.deltaX)
        );
        setTrackTransform(false);
        window.clearTimeout(wheelSettleTimer);
        wheelSettleTimer = window.setTimeout(() => {
          const threshold = viewportWidth() * 0.18;
          if (dragDeltaX <= -threshold) {
            goToIndex(currentIndex + 1, true);
          } else if (dragDeltaX >= threshold) {
            goToIndex(currentIndex - 1, true);
          } else {
            goToIndex(currentIndex, true);
          }
        }, 90);
      },
      { passive: false }
    );
    document.addEventListener("keydown", (e) => {
      if (overlay.hasAttribute("hidden")) return;
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowRight") shiftImage(1);
      if (e.key === "ArrowLeft") shiftImage(-1);
    });
    window.addEventListener("resize", () => {
      if (overlay.hasAttribute("hidden")) return;
      setTrackTransform(false);
    });
  };

  if (!document.querySelector(".fx-layer")) {
    const fx = document.createElement("div");
    fx.className = "fx-layer";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML =
      '<div class="aurora-bg"></div><div class="grain-bg"></div><div class="vignette-bg"></div>';
    document.body.prepend(fx);
  }

  if (!document.querySelector(".scroll-progress")) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.append(bar);
  }

  const page = document.body.dataset.page;
  const navLinks = document.querySelectorAll("[data-page-link]");
  const menuToggle = document.querySelector(".menu-toggle");
  const navList = document.querySelector(".nav-links");

  navLinks.forEach((link) => {
    if (link.dataset.pageLink === page) {
      link.classList.add("active");
    }
    link.addEventListener("click", () => {
      navList?.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
    });
  });

  menuToggle?.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    navList?.classList.toggle("open");
  });

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  const metricNums = document.querySelectorAll(".metric .num");
  const animateNumber = (el, duration = 1300) => {
    const raw = (el.textContent || "").trim();
    const plus = raw.endsWith("+");
    const percent = raw.endsWith("%");
    const ratio = raw.includes("/");
    let end = parseFloat(raw.replace(/[^\d.]/g, "")) || 0;
    let suffix = plus ? "+" : percent ? "%" : "";
    let ratioTail = "";

    if (ratio) {
      const match = raw.match(/^([\d.]+)\/(.+)$/);
      if (match) {
        end = parseFloat(match[1]);
        ratioTail = `/${match[2]}`;
      }
    }

    const start = performance.now();
    const frame = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = end * eased;
      const formatted = ratio
        ? `${value.toFixed(1)}${ratioTail}`
        : end % 1 !== 0
        ? value.toFixed(1)
        : `${Math.round(value)}`;
      el.textContent = `${formatted}${suffix}`;
      if (p < 1) window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  };

  if ("IntersectionObserver" in window) {
    const metricObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateNumber(entry.target);
            metricObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.55 }
    );
    metricNums.forEach((n) => metricObserver.observe(n));
  }

  const buttons = document.querySelectorAll(".btn");
  buttons.forEach((btn) => {
    btn.addEventListener("mousemove", (event) => {
      const rect = btn.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      btn.style.setProperty("--btn-x", `${x * 0.07}px`);
      btn.style.setProperty("--btn-y", `${y * 0.07}px`);
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.setProperty("--btn-x", "0px");
      btn.style.setProperty("--btn-y", "0px");
    });
  });

  const tiltItems = document.querySelectorAll(".card, .project");
  tiltItems.forEach((item) => {
    item.addEventListener("mousemove", (event) => {
      const rect = item.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      item.style.setProperty("--ry", `${x * 5}deg`);
      item.style.setProperty("--rx", `${-y * 4}deg`);
    });
    item.addEventListener("mouseleave", () => {
      item.style.setProperty("--ry", "0deg");
      item.style.setProperty("--rx", "0deg");
    });
  });

  const parallaxElements = document.querySelectorAll(
    ".hero-panel, .card, .project, .metric, .cta"
  );
  parallaxElements.forEach((el, i) => {
    if (!el.dataset.depth) {
      const base = el.classList.contains("hero-panel")
        ? 0.07
        : el.classList.contains("cta")
        ? 0.05
        : 0.038;
      el.dataset.depth = String(base + (i % 3) * 0.008);
    }
  });

  const scrubText = document.querySelectorAll("h1, h2, h3, .lead, .section-title p");
  scrubText.forEach((el) => el.classList.add("scrub-text"));

  const progressBar = document.querySelector(".scroll-progress");
  const motionLoop = () => {
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const progress = scrollY / maxScroll;
    progressBar?.style.setProperty("transform", `scaleX(${progress})`);

    const vh = window.innerHeight;
    scrubText.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - vh * 0.46);
      const normalized = Math.max(0, 1 - distance / (vh * 0.9));
      const smooth = normalized * normalized * (3 - 2 * normalized);
      const y = (1 - smooth) * 14;
      const opacity = 0.42 + smooth * 0.58;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
      el.style.opacity = opacity.toFixed(3);
    });

    parallaxElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const depth = parseFloat(el.dataset.depth || "0.04");
      const y = Math.max(-18, Math.min(18, -(mid - vh / 2) * depth));
      el.style.setProperty("--parallax-y", `${y}px`);
    });

    if (!prefersReducedMotion) {
      window.requestAnimationFrame(motionLoop);
    }
  };

  if (!prefersReducedMotion) {
    window.requestAnimationFrame(motionLoop);
  }

  initProjectModals();

  const initHomeMetrics = async () => {
    if (document.body.dataset.page !== "home") return;

    const satisfactionEl = document.getElementById("clientSatisfactionMetric");
    const ratingEl = document.getElementById("averageRatingMetric");
    const reviewCountEl = document.getElementById("reviewCountNote");
    if (!satisfactionEl || !ratingEl) return;
    if (reviewCountEl) reviewCountEl.hidden = true;

    const animateMetricValue = (from, to, durationMs, onFrame) => {
      if (prefersReducedMotion) {
        onFrame(to);
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = from + (to - from) * eased;
        onFrame(value);
        if (progress < 1) {
          window.requestAnimationFrame(tick);
        }
      };
      window.requestAnimationFrame(tick);
    };

    const parseMetricNumber = (value) => {
      const match = String(value || "").match(/-?\d+(\.\d+)?/);
      return match ? Number(match[0]) : 0;
    };

    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    let rollingTimer = null;

    if (!prefersReducedMotion) {
      const seedSatisfaction = randomInt(91, 99);
      const seedRating = randomInt(45, 50) / 10;
      satisfactionEl.textContent = `${seedSatisfaction}%`;
      ratingEl.textContent = `${seedRating.toFixed(1)}/5`;
      rollingTimer = window.setInterval(() => {
        const rollingSatisfaction = randomInt(91, 99);
        const rollingRating = randomInt(45, 50) / 10;
        satisfactionEl.textContent = `${rollingSatisfaction}%`;
        ratingEl.textContent = `${rollingRating.toFixed(1)}/5`;
      }, 90);
    } else {
      satisfactionEl.textContent = "--";
      ratingEl.textContent = "--";
    }

    const endpoint =
      "https://script.google.com/macros/s/AKfycbw1GAY8Rl9U1eW7KW46zne8WBWP8KF1SryZ2wBu2TepBWUaW5RTLweKv3GCcIvYrA/exec";

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Metrics request failed");
      const data = await response.json();
      const averageRating = String(data?.averageRating || "").trim();
      const satisfactionPercent = String(data?.satisfactionPercent || "").trim();
      const reviewCount = Number(data?.reviewCount ?? data?.totalReviews);
      if (rollingTimer) {
        window.clearInterval(rollingTimer);
        rollingTimer = null;
      }

      if (/^\d+(\.\d+)?\/5$/.test(averageRating)) {
        const ratingValue = Number(averageRating.replace("/5", ""));
        const ratingStart = parseMetricNumber(ratingEl.textContent);
        animateMetricValue(ratingStart, ratingValue, 950, (value) => {
          ratingEl.textContent = `${value.toFixed(1)}/5`;
        });
      }
      if (/^\d+%$/.test(satisfactionPercent)) {
        const satisfactionValue = Number(satisfactionPercent.replace("%", ""));
        const satisfactionStart = parseMetricNumber(satisfactionEl.textContent);
        animateMetricValue(satisfactionStart, satisfactionValue, 900, (value) => {
          satisfactionEl.textContent = `${Math.round(value)}%`;
        });
      }
      if (Number.isFinite(reviewCount) && reviewCount > 0 && reviewCountEl) {
        reviewCountEl.hidden = false;
        reviewCountEl.textContent = `Based on ${reviewCount} review${reviewCount === 1 ? "" : "s"}`;
      }
    } catch (error) {
      if (rollingTimer) {
        window.clearInterval(rollingTimer);
      }
      satisfactionEl.textContent = "--";
      ratingEl.textContent = "--";
      if (reviewCountEl) {
        reviewCountEl.hidden = true;
      }
    }
  };

  initHomeMetrics();

  const initContactMap = async () => {
    const mapEl = document.getElementById("contactMap");
    if (!mapEl) return;

    const renderIframeFallback = () => {
      mapEl.innerHTML = `
        <iframe
          src="https://maps.google.com/maps?hl=en&q=Dubai,%20UAE&z=10&output=embed"
          title="Dubai, UAE on Google Maps"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      `;
    };

    const hasMissingOrPlaceholderKey = () => {
      try {
        const script = Array.from(document.scripts).find((el) =>
          el.src.includes("maps.googleapis.com/maps/api/js")
        );
        if (!script) return true;
        const key = new URL(script.src).searchParams.get("key") || "";
        return !key || key === "YOUR_GOOGLE_MAPS_API_KEY";
      } catch (error) {
        return true;
      }
    };

    const waitForMapsApi = async (maxWaitMs = 9000) => {
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        if (window.google?.maps?.importLibrary) return true;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return false;
    };

    if (hasMissingOrPlaceholderKey()) {
      renderIframeFallback();
      return;
    }

    const mapsReady = await waitForMapsApi();
    if (!mapsReady) {
      renderIframeFallback();
      return;
    }

    try {
      const { Map } = await google.maps.importLibrary("maps");
      const dubaiCenter = { lat: 25.2048, lng: 55.2708 };

      new Map(mapEl, {
        center: dubaiCenter,
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
        colorScheme: google.maps.ColorScheme.DARK,
      });

      // If Google returns its auth/error overlay, swap to reliable iframe view.
      window.setTimeout(() => {
        if (mapEl.querySelector(".gm-err-container, .gm-err-message")) {
          renderIframeFallback();
        }
      }, 1200);
    } catch (error) {
      renderIframeFallback();
    }
  };

  initContactMap();

  const contactForm = document.getElementById("contact-form");
  const status = document.getElementById("formStatus");
  const testToastBtn = document.getElementById("testToastBtn");
  const inquiryToast = document.getElementById("inquiryToast");
  const inquiryToastOverlay = document.getElementById("inquiryToastOverlay");
  const requiredFieldsMessage = "Please complete all required fields.";
  let inquiryToastTimer = null;
  const phoneInput = document.getElementById("phone-number");
  const submitButton = contactForm?.querySelector('button[type="submit"]');
  const phoneInputInstance =
    phoneInput && window.intlTelInput
      ? window.intlTelInput(phoneInput, {
          initialCountry: "ae",
          separateDialCode: true,
          preferredCountries: ["ae"],
        })
      : null;
  const updatePhoneInputOffset = () => {
    if (!phoneInput) return;
    const itiWrap = phoneInput.closest(".iti");
    const selectedCountryEl = itiWrap?.querySelector(".iti__selected-country");
    if (!itiWrap || !selectedCountryEl) return;
    const offset = Math.ceil(selectedCountryEl.getBoundingClientRect().width) + 22;
    itiWrap.style.setProperty("--phone-input-offset", `${offset}px`);
  };
  const pinUaeToTop = () => {
    if (!phoneInput) return;
    const itiWrap = phoneInput.closest(".iti");
    const listEl = itiWrap?.querySelector(".iti__country-list");
    if (!listEl) return;

    const uaeEl = listEl.querySelector('.iti__country[data-country-code="ae"]');
    if (!uaeEl) return;

    const divider = listEl.querySelector(".iti__divider");
    if (divider) divider.remove();

    if (listEl.firstElementChild !== uaeEl) {
      listEl.insertBefore(uaeEl, listEl.firstChild);
    }
  };
  const sanitizePhoneToDigits = () => {
    if (!phoneInput) return;
    const digitsOnly = phoneInput.value.replace(/\D+/g, "").slice(0, 12);
    if (phoneInput.value !== digitsOnly) {
      phoneInput.value = digitsOnly;
    }
  };

  if (phoneInputInstance && phoneInput) {
    phoneInputInstance.setCountry("ae");
    window.setTimeout(updatePhoneInputOffset, 0);
    window.setTimeout(pinUaeToTop, 0);
    phoneInput.addEventListener("input", sanitizePhoneToDigits);
    phoneInput.addEventListener("countrychange", updatePhoneInputOffset);
    phoneInput.addEventListener("countrychange", pinUaeToTop);
    phoneInput.addEventListener("focus", pinUaeToTop);
    phoneInput
      .closest(".iti")
      ?.querySelector(".iti__selected-country")
      ?.addEventListener("click", () => window.setTimeout(pinUaeToTop, 0));
    window.addEventListener("resize", updatePhoneInputOffset);
  }

  const setFieldErrorState = (field, hasError) => {
    const fieldWrap = field.closest(".field");
    fieldWrap?.classList.toggle("has-error", hasError);
  };

  const clearAllFieldErrors = () => {
    contactForm
      ?.querySelectorAll(".field.has-error")
      .forEach((el) => el.classList.remove("has-error"));
  };

  const validateRequiredFields = () => {
    if (!contactForm) return false;
    let hasError = false;
    const requiredFields = contactForm.querySelectorAll(
      "input[required], select[required], textarea[required]"
    );

    requiredFields.forEach((field) => {
      const isCheckbox = field instanceof HTMLInputElement && field.type === "checkbox";
      const value = String(field.value || "").trim();
      const isValid = isCheckbox ? field.checked : Boolean(value);
      setFieldErrorState(field, !isValid);
      if (!isValid) hasError = true;
    });

    return hasError;
  };

  const areRequiredFieldsComplete = () => {
    if (!contactForm) return false;
    const requiredFields = contactForm.querySelectorAll(
      "input[required], select[required], textarea[required]"
    );

    for (const field of requiredFields) {
      const isCheckbox = field instanceof HTMLInputElement && field.type === "checkbox";
      const value = String(field.value || "").trim();
      const isValid = isCheckbox ? field.checked : Boolean(value);
      if (!isValid) return false;
    }

    if (phoneInputInstance) {
      const dialCode = phoneInputInstance.getSelectedCountryData().dialCode || "";
      if (!dialCode) return false;
    }

    return true;
  };

  const clearRequiredMessageIfComplete = () => {
    if (!status) return;
    if (
      status.classList.contains("error") &&
      status.textContent === requiredFieldsMessage &&
      areRequiredFieldsComplete()
    ) {
      status.textContent = "";
      status.className = "status";
    }
  };

  const autoResizeTextarea = (textarea) => {
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const contactTextareas = contactForm ? Array.from(contactForm.querySelectorAll("textarea")) : [];
  contactTextareas.forEach((textarea) => {
    autoResizeTextarea(textarea);
    textarea.addEventListener("input", () => autoResizeTextarea(textarea));
  });

  const showInquiryToast = (
    message = "Thanks — your inquiry has been sent. We’ll get back to you as soon as possible."
  ) => {
    if (!inquiryToast || !inquiryToastOverlay) return;
    inquiryToast.textContent = message;
    inquiryToastOverlay.classList.add("is-visible");
    inquiryToastOverlay.setAttribute("aria-hidden", "false");
    if (inquiryToastTimer) {
      window.clearTimeout(inquiryToastTimer);
    }
    inquiryToastTimer = window.setTimeout(() => {
      inquiryToastOverlay.classList.remove("is-visible");
      inquiryToastOverlay.setAttribute("aria-hidden", "true");
    }, 3000);
  };
  window.__bywShowInquiryToast = showInquiryToast;

  testToastBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showInquiryToast();
  });

  contactForm
    ?.querySelectorAll("input[required], select[required], textarea[required]")
    .forEach((field) => {
      const eventName = field instanceof HTMLSelectElement ? "change" : "input";
      field.addEventListener(eventName, () => {
        const isCheckbox = field instanceof HTMLInputElement && field.type === "checkbox";
        const value = String(field.value || "").trim();
        const isValid = isCheckbox ? field.checked : Boolean(value);
        setFieldErrorState(field, !isValid);
        clearRequiredMessageIfComplete();
      });
      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        field.addEventListener("change", () => {
          setFieldErrorState(field, !field.checked);
          clearRequiredMessageIfComplete();
        });
      }
    });

  phoneInput?.addEventListener("countrychange", clearRequiredMessageIfComplete);

  contactForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!status) return;

    clearAllFieldErrors();

    const formData = new FormData(contactForm);
    const fullName = String(formData.get("Full Name") || "").trim();
    const email = String(formData.get("Email Address") || "").trim();
    const phone = String(formData.get("phone_raw") || "").trim();
    const phoneCode = phoneInputInstance
      ? `+${phoneInputInstance.getSelectedCountryData().dialCode || ""}`
      : "";
    const service = String(formData.get("Service Needed") || "").trim();
    const timeline = String(formData.get("Timeline") || "").trim();
    const projectDetails = String(formData.get("Project Details") || "").trim();
    const designReferences = String(formData.get("Design References or Examples") || "").trim();
    const preferredContactMethod = String(formData.get("Preferred Contact Method") || "").trim();
    const consent = formData.get("Consent to Contact");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const hasRequiredFieldErrors = validateRequiredFields();
    if (hasRequiredFieldErrors || (phoneInputInstance && !phoneCode)) {
      if (phoneInputInstance && !phoneCode && phoneInput) {
        setFieldErrorState(phoneInput, true);
      }
      status.textContent = requiredFieldsMessage;
      status.className = "status error";
      return;
    }

    if (!emailRegex.test(email)) {
      const emailField = contactForm.querySelector("#email-address");
      if (emailField) setFieldErrorState(emailField, true);
      status.textContent = "Please enter a valid email address.";
      status.className = "status error";
      return;
    }

    if (!consent) {
      const consentField = contactForm.querySelector('input[name="Consent to Contact"]');
      if (consentField) setFieldErrorState(consentField, true);
      status.textContent = "Please agree to be contacted before sending.";
      status.className = "status error";
      return;
    }

    const accessKey =
      String(contactForm.querySelector('input[name="access_key"]')?.value || "").trim();
    const fromName =
      String(contactForm.querySelector('input[name="from_name"]')?.value || "").trim() ||
      "Build Your Web";
    const subject = service;

    if (!accessKey || accessKey === "YOUR_WEB3FORMS_ACCESS_KEY") {
      status.textContent = "Please add your Web3Forms access key to enable submissions.";
      status.className = "status error";
      return;
    }

    const submission = new FormData();
    submission.append("access_key", accessKey);
    submission.append("from_name", fromName);
    submission.append("subject", subject);
    submission.append("Full Name", fullName);
    submission.append("Email Address", email);
    submission.append("Phone Number", phoneCode ? `${phoneCode} ${phone}` : phone);
    submission.append("Service Needed", service);
    if (timeline) submission.append("Timeline", timeline);
    submission.append("Project Details", projectDetails);
    if (designReferences) {
      submission.append("Design References or Examples", designReferences);
    }
    if (preferredContactMethod) {
      submission.append("Preferred Contact Method", preferredContactMethod);
    }

    const actionUrl = contactForm.getAttribute("action") || "https://api.web3forms.com/submit";
    submitButton?.setAttribute("disabled", "disabled");

    fetch(actionUrl, {
      method: "POST",
      body: submission,
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) {
          throw new Error(result.message || "Unable to send inquiry right now.");
        }

        status.textContent = "";
        status.className = "status";
        showInquiryToast();
        contactForm.reset();
        phoneInputInstance?.setCountry("ae");
        updatePhoneInputOffset();
        window.setTimeout(() => {
          contactTextareas.forEach((textarea) => autoResizeTextarea(textarea));
        }, 0);
      })
      .catch((error) => {
        status.textContent = error.message || "Something went wrong. Please try again.";
        status.className = "status error";
      })
      .finally(() => {
        submitButton?.removeAttribute("disabled");
      });
  });
});
