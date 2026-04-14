document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const isMobileCalmViewport = () => window.matchMedia("(max-width: 980px)").matches;

  const navBase = (() => {
    const path = window.location.pathname.replace(/\/index\.html$/i, "");
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    return ["services", "projects", "about", "contact"].includes(last) ? "../" : "./";
  })();

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

  const ensureScrollProgressBar = () => {
    let bar = document.querySelector(".scroll-progress");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "scroll-progress";
      bar.setAttribute("aria-hidden", "true");
      document.body.append(bar);
    }
    if (!bar.querySelector(".scroll-progress-fill")) {
      const fill = document.createElement("span");
      fill.className = "scroll-progress-fill";
      bar.append(fill);
    }
  };
  ensureScrollProgressBar();

  const page = document.body.dataset.page;
  const menuToggle = document.querySelector(".menu-toggle");
  const navList = document.querySelector(".nav-links");
  const isMobileNavViewport = () => window.matchMedia("(max-width: 980px)").matches;
  let mobileOverlay = null;
  let mobileDrawer = null;
  let mobilePanel = null;
  let mobileTab = null;
  let navTrigger = menuToggle;

  const syncMobileTab = (open) => {
    if (!mobileTab) return;
    mobileTab.textContent = open ? "\u203a" : "\u2261";
    mobileTab.setAttribute("aria-label", open ? "Back, close menu" : "Open menu");
  };

  if (navList) {
    mobileOverlay = document.createElement("div");
    mobileOverlay.className = "mobile-nav-overlay";
    mobileOverlay.setAttribute("aria-hidden", "true");

    mobileDrawer = document.createElement("div");
    mobileDrawer.className = "mobile-nav-drawer";

    mobileTab = document.createElement("button");
    mobileTab.type = "button";
    mobileTab.className = "mobile-nav-tab";
    mobileTab.setAttribute("aria-controls", "mobile-site-nav");
    mobileTab.setAttribute("aria-expanded", "false");
    mobileTab.setAttribute("aria-label", "Open menu");
    mobileTab.textContent = "\u2261";

    mobilePanel = document.createElement("div");
    mobilePanel.className = "mobile-nav-panel";

    const mobileList = document.createElement("ul");
    mobileList.className = "mobile-nav-list";
    mobileList.id = "mobile-site-nav";
    const navItems = Array.from(navList.querySelectorAll("a[data-page-link]")).map((anchor) => {
      return {
        href: anchor.getAttribute("href") || "#",
        pageLink: anchor.getAttribute("data-page-link") || "",
        text: (anchor.textContent || "").trim(),
      };
    });
    const fallbackItems = [
      { href: `${navBase}`, pageLink: "home", text: "Home" },
      { href: `${navBase}services/`, pageLink: "services", text: "Services" },
      { href: `${navBase}projects/`, pageLink: "projects", text: "Projects" },
      { href: `${navBase}about/`, pageLink: "about", text: "About" },
      { href: `${navBase}contact/`, pageLink: "contact", text: "Contact" },
    ];
    const listItems = navItems.length ? navItems : fallbackItems;
    mobileList.innerHTML = listItems
      .map(
        (item) =>
          `<li><a href="${item.href}" data-page-link="${item.pageLink}">${escapeHtml(item.text)}</a></li>`
      )
      .join("");

    mobilePanel.appendChild(mobileList);
    mobileDrawer.appendChild(mobileTab);
    mobileDrawer.appendChild(mobilePanel);
    document.body.appendChild(mobileOverlay);
    document.body.appendChild(mobileDrawer);
    navTrigger = mobileTab;

    const positionMobileDrawer = () => {
      if (!mobileDrawer || !isMobileNavViewport()) return;
      const vv = window.visualViewport;
      const topOffset = vv ? vv.offsetTop : 0;
      mobileDrawer.style.top = `${Math.round(topOffset + 96)}px`;
    };
    positionMobileDrawer();
    window.addEventListener("scroll", positionMobileDrawer, { passive: true });
    window.addEventListener("resize", positionMobileDrawer);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("scroll", positionMobileDrawer);
      window.visualViewport.addEventListener("resize", positionMobileDrawer);
    }

    if (menuToggle) {
      menuToggle.setAttribute("aria-hidden", "true");
      menuToggle.setAttribute("tabindex", "-1");
    }
  }

  const highlightActiveNavLinks = () => {
    document.querySelectorAll("[data-page-link]").forEach((link) => {
      link.classList.toggle("active", link.dataset.pageLink === page);
    });
  };

  const closeMobileNav = () => {
    navTrigger?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
    if (mobileOverlay) {
      mobileOverlay.classList.remove("open");
      mobileOverlay.setAttribute("aria-hidden", "true");
    }
    if (mobileDrawer) {
      mobileDrawer.classList.remove("open");
    }
    syncMobileTab(false);
  };

  highlightActiveNavLinks();
  closeMobileNav();

  document.querySelectorAll("[data-page-link]").forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobileNavViewport()) closeMobileNav();
    });
  });

  navTrigger?.addEventListener("click", () => {
    if (!isMobileNavViewport() || !mobileOverlay || !mobileDrawer) return;
    const expanded = navTrigger?.getAttribute("aria-expanded") === "true";
    const nextExpanded = !expanded;
    navTrigger?.setAttribute("aria-expanded", String(nextExpanded));
    document.body.classList.toggle("nav-open", nextExpanded);
    mobileOverlay.classList.toggle("open", nextExpanded);
    mobileOverlay.setAttribute("aria-hidden", String(!nextExpanded));
    mobileDrawer.classList.toggle("open", nextExpanded);
    syncMobileTab(nextExpanded);
    if (nextExpanded) {
      const mobileList = mobilePanel?.querySelector(".mobile-nav-list");
      if (mobileList) mobileList.scrollTop = 0;
    }
  });

  mobileOverlay?.addEventListener("click", (event) => {
    if (!isMobileNavViewport()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (mobileDrawer?.contains(target)) return;
    closeMobileNav();
  });

  window.addEventListener("resize", () => {
    if (!isMobileNavViewport()) {
      closeMobileNav();
    }
  });

  let openedAt = 0;
  let openedScrollY = 0;
  const markMenuOpenTime = () => {
    openedAt = Date.now();
    openedScrollY = window.scrollY;
  };
  const closeMenuOnUserScroll = () => {
    if (!isMobileNavViewport()) return;
    if (!document.body.classList.contains("nav-open")) return;
    if (Date.now() - openedAt < 280) return;
    if (Math.abs(window.scrollY - openedScrollY) < 6) return;
    closeMobileNav();
  };
  navTrigger?.addEventListener("click", markMenuOpenTime);
  window.addEventListener("scroll", closeMenuOnUserScroll, { passive: true });

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

  const projectsDeliveredMetric = document.getElementById("projectsDeliveredMetric");
  let metricObserver = null;
  if (projectsDeliveredMetric) {
    projectsDeliveredMetric.textContent = "--";

    const applyProjectCount = (count) => {
      if (Number.isFinite(count) && count > 0) {
        projectsDeliveredMetric.textContent = String(count);
      }
    };

    const projectsUrl = new URL(`${navBase}projects/`, window.location.href).toString();
    let didSetCount = false;

    const trySetCount = (count) => {
      if (didSetCount) return;
      if (Number.isFinite(count) && count > 0) {
        didSetCount = true;
        applyProjectCount(count);
        if (!("IntersectionObserver" in window)) {
          animateNumber(projectsDeliveredMetric);
        } else {
          const rect = projectsDeliveredMetric.getBoundingClientRect();
          const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
          if (isVisible) {
            animateNumber(projectsDeliveredMetric);
            if (metricObserver) metricObserver.unobserve(projectsDeliveredMetric);
          }
        }
      }
    };

    const frame = document.createElement("iframe");
    frame.src = projectsUrl;
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText =
      "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
    frame.addEventListener("load", () => {
      try {
        const doc = frame.contentDocument;
        const count = doc ? doc.querySelectorAll(".portfolio-grid .project").length : 0;
        trySetCount(count);
      } catch (_) {
        // If iframe access is blocked, fetch fallback handles it.
      } finally {
        window.setTimeout(() => frame.remove(), 0);
      }
    });
    document.body.appendChild(frame);

    window
      .fetch(projectsUrl, { cache: "no-store" })
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => {
        if (!html) return;
        const parsed = new window.DOMParser().parseFromString(html, "text/html");
        const count = parsed.querySelectorAll(".portfolio-grid .project").length;
        trySetCount(count);
      })
      .catch(() => {
        // Counter intentionally depends on projects page only.
      });
  }

  const metricNums = document.querySelectorAll(".metric .num");
  const animateNumber = (el, duration = 1300) => {
    if (el.dataset.metricAnimated === "true") return true;
    const raw = (el.textContent || "").trim();
    if (!/\d/.test(raw)) return;
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
      if (p < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.dataset.metricAnimated = "true";
      }
    };
    window.requestAnimationFrame(frame);
    return true;
  };

  if ("IntersectionObserver" in window) {
    metricObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const didAnimate = animateNumber(entry.target);
            if (didAnimate) metricObserver.unobserve(entry.target);
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
      if (isMobileCalmViewport()) return;
      const rect = btn.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      btn.style.setProperty("--btn-x", `${x * 0.07}px`);
      btn.style.setProperty("--btn-y", `${y * 0.07}px`);
    });
    btn.addEventListener("mouseleave", () => {
      if (isMobileCalmViewport()) return;
      btn.style.setProperty("--btn-x", "0px");
      btn.style.setProperty("--btn-y", "0px");
    });
  });

  const tiltItems = document.querySelectorAll(".card, .project");
  tiltItems.forEach((item) => {
    item.addEventListener("mousemove", (event) => {
      if (isMobileCalmViewport()) return;
      const rect = item.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      item.style.setProperty("--ry", `${x * 5}deg`);
      item.style.setProperty("--rx", `${-y * 4}deg`);
    });
    item.addEventListener("mouseleave", () => {
      if (isMobileCalmViewport()) return;
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
    const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
    progressBar?.style.setProperty("--scroll-progress", progress.toFixed(4));

    const vh = window.innerHeight;
    const calmMobile = isMobileCalmViewport();
    if (calmMobile) {
      scrubText.forEach((el) => {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      });
      parallaxElements.forEach((el) => {
        el.style.removeProperty("--parallax-y");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    } else {
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
    }

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

    const MAPS_API_SRC =
      "https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&v=beta&loading=async";

    /*
     * Touch phones: use embed only (no Maps JS / WebGL). Script is not loaded on phone (see below).
     */
    const prefersCoarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (prefersCoarsePointer) {
      renderIframeFallback();
      return;
    }

    let mapsApiKey = "";
    try {
      mapsApiKey = new URL(MAPS_API_SRC).searchParams.get("key") || "";
    } catch {
      mapsApiKey = "";
    }
    const useMapsJsApi = Boolean(mapsApiKey && mapsApiKey !== "YOUR_GOOGLE_MAPS_API_KEY");
    if (!useMapsJsApi) {
      renderIframeFallback();
      return;
    }

    const loadGoogleMapsScript = () => {
      if (document.querySelector("script[data-byw-google-maps]")) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = MAPS_API_SRC;
        s.async = true;
        s.dataset.bywGoogleMaps = "true";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Google Maps script failed to load"));
        document.head.appendChild(s);
      });
    };

    const waitForMapsApi = async (maxWaitMs = 9000) => {
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        if (window.google?.maps?.importLibrary) return true;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return false;
    };

    try {
      await loadGoogleMapsScript();
    } catch {
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

      const map = new Map(mapEl, {
        center: dubaiCenter,
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
        colorScheme: google.maps.ColorScheme.DARK,
      });

      const triggerResize = () => {
        if (window.google?.maps?.event) {
          google.maps.event.trigger(map, "resize");
        }
      };
      requestAnimationFrame(triggerResize);
      window.setTimeout(triggerResize, 320);

      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => triggerResize());
        ro.observe(mapEl);
      } else {
        window.addEventListener("resize", triggerResize, { passive: true });
      }

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
  /** True after the user focuses the national-number field (not the country selector). Used to avoid red “required” styling when only the country changes. */
  let phoneDigitsFieldWasFocused = false;
  const submitButton = contactForm?.querySelector('button[type="submit"]');
  const isContactPhoneNarrowViewport = () =>
    window.matchMedia("(max-width: 980px)").matches;

  const intlTelUtilsCdn = "https://cdn.jsdelivr.net/npm/intl-tel-input@27.0.0/dist/js/utils.js";

  const phoneInputInstance =
    phoneInput && window.intlTelInput
      ? window.intlTelInput(phoneInput, {
          initialCountry: "ae",
          countryOrder: ["ae"],
          separateDialCode: true,
          nationalMode: true,
          loadUtils: () => import(intlTelUtilsCdn),
          autoPlaceholder: "aggressive",
          placeholderNumberType: "MOBILE",
          // Visible field: intl-tel-input applies libphonenumber AsYouTypeFormatter via utils.formatNumberAsYouType(full, iso2).
          formatAsYouType: true,
          // Blur / setNumber: national display from libphonenumber formatNumber(..., NATIONAL) for the selected region.
          formatOnDisplay: true,
          // Enforce max digit count for the selected country and block junk keys; works with formatAsYouType
          // so spacing matches national format from libphonenumber (updated with each intl-tel-input release).
          strictMode: true,
          // Match placeholderNumberType ("MOBILE"): valid complete numbers must be mobiles for that country.
          allowedNumberTypes: ["MOBILE"],
          // Visible search UI is hidden in our CSS; disabling search avoids focus moving to a hidden field.
          // Typing letters in the open dropdown still filters countries (library "hidden search" behaviour).
          countrySearch: false,
          // Mobile only: fullscreen popup is a poor fit for our inline dropdown layout.
          ...(isContactPhoneNarrowViewport() ? { useFullscreenPopup: false } : {}),
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

  /**
   * With `countrySearch: false`, the dropdown does not auto-highlight the selected row on open.
   * Align highlight and aria-activedescendant to the current country and scroll it into view.
   */
  const syncItiDropdownHighlightToSelection = () => {
    if (!phoneInputInstance || !phoneInput) return;
    const iso2 = phoneInputInstance.getSelectedCountryData()?.iso2;
    const itiWrap = phoneInput.closest(".iti");
    const listEl = itiWrap?.querySelector(".iti__country-list");
    const selectedCountryBtn = itiWrap?.querySelector(".iti__selected-country");
    if (!iso2 || !listEl || !selectedCountryBtn) return;

    const target = listEl.querySelector(`.iti__country[data-country-code="${iso2}"]`);
    if (!target) return;

    listEl.querySelectorAll(".iti__country.iti__highlight").forEach((li) => {
      li.classList.remove("iti__highlight");
      li.setAttribute("aria-selected", "false");
    });

    target.classList.add("iti__highlight");
    target.setAttribute("aria-selected", "true");

    const activeId = target.getAttribute("id") || "";
    selectedCountryBtn.setAttribute("aria-activedescendant", activeId);

    target.scrollIntoView({ block: "nearest", behavior: "auto" });
  };

  /**
   * Re-run intl-tel-input’s input handler so it applies libphonenumber’s as-you-type formatting for the
   * currently selected region (utils.formatNumberAsYouType). Use after utils load or country change when
   * the field already contains digits (e.g. user typed before utils finished loading).
   */
  const dispatchPhoneInputToApplyLibFormat = () => {
    if (!phoneInput || !window.intlTelInput?.utils) return;
    if (!String(phoneInput.value || "").trim()) return;
    const ev =
      typeof InputEvent !== "undefined"
        ? new InputEvent("input", { bubbles: true })
        : new Event("input", { bubbles: true });
    phoneInput.dispatchEvent(ev);
  };

  /**
   * Complete valid numbers: normalize visible national formatting via setNumber(E164) → lib formatNumber.
   * Partial numbers: trigger as-you-type formatting only (no manual dial+digit concatenation for display).
   */
  const polishVisiblePhoneFromLib = () => {
    if (!phoneInput || !phoneInputInstance || !window.intlTelInput?.utils) return;
    const utils = window.intlTelInput.utils;
    const trimmed = String(phoneInput.value || "").trim();
    if (!trimmed) return;
    if (phoneInputInstance.isValidNumber() === true) {
      const e164 = phoneInputInstance.getNumber(utils.numberFormat.E164);
      if (e164) phoneInputInstance.setNumber(e164);
    } else {
      dispatchPhoneInputToApplyLibFormat();
    }
  };

  const refreshPhoneFieldErrorForPartial = () => {
    if (!phoneInput || !phoneInputInstance) return;
    const t = String(phoneInput.value || "").trim();
    if (!t) {
      // Empty: do not show field error here (e.g. on country change). Red only after the user leaves the number field (blur) or on submit.
      setFieldErrorState(phoneInput, false);
      clearRequiredMessageIfComplete();
      return;
    }
    if (window.intlTelInput?.utils && phoneInputInstance.isValidNumber() === true) {
      setFieldErrorState(phoneInput, false);
      phoneInput.setCustomValidity("");
    }
    clearRequiredMessageIfComplete();
  };

  const validatePhoneBlurStrict = () => {
    if (!phoneInput || !phoneInputInstance || !window.intlTelInput?.utils) return;
    const t = String(phoneInput.value || "").trim();
    if (!t) {
      phoneInput.setCustomValidity("");
      setFieldErrorState(phoneInput, phoneDigitsFieldWasFocused);
      return;
    }
    if (phoneInputInstance.isValidNumber() !== true) {
      phoneInput.setCustomValidity(
        "Enter a complete mobile number in the format shown for this country."
      );
      setFieldErrorState(phoneInput, true);
    } else {
      phoneInput.setCustomValidity("");
      setFieldErrorState(phoneInput, false);
    }
  };

  if (phoneInputInstance && phoneInput) {
    phoneInputInstance.setCountry("ae");
    window.setTimeout(updatePhoneInputOffset, 0);
    window.setTimeout(pinUaeToTop, 0);
    phoneInputInstance.promise?.then?.(() => {
      updatePhoneInputOffset();
      pinUaeToTop();
      dispatchPhoneInputToApplyLibFormat();
      phoneInput.addEventListener("input", () => {
        refreshPhoneFieldErrorForPartial();
      });
    });
    phoneInput.addEventListener("countrychange", () => {
      updatePhoneInputOffset();
      pinUaeToTop();
      window.requestAnimationFrame(() => {
        dispatchPhoneInputToApplyLibFormat();
        refreshPhoneFieldErrorForPartial();
      });
      clearRequiredMessageIfComplete();
    });
    phoneInput.addEventListener("focus", () => {
      phoneDigitsFieldWasFocused = true;
      pinUaeToTop();
      phoneInput.setCustomValidity("");
      setFieldErrorState(phoneInput, false);
    });
    phoneInput.addEventListener("blur", () => {
      window.setTimeout(() => {
        const itiRoot = phoneInput.closest(".iti");
        const active = document.activeElement;
        if (itiRoot && active && itiRoot.contains(active)) return;
        polishVisiblePhoneFromLib();
        validatePhoneBlurStrict();
      }, 0);
    });
    phoneInput
      .closest(".iti")
      ?.querySelector(".iti__selected-country")
      ?.addEventListener("click", () => window.setTimeout(pinUaeToTop, 0));
    window.addEventListener("resize", updatePhoneInputOffset);

    phoneInput.addEventListener("open:countrydropdown", () => {
      window.requestAnimationFrame(() => {
        syncItiDropdownHighlightToSelection();
      });
    });
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
      if (field === phoneInput && phoneInputInstance) {
        const value = String(field.value || "").trim();
        let isValid = false;
        if (!value) {
          isValid = false;
        } else if (window.intlTelInput?.utils) {
          isValid = phoneInputInstance.isValidNumber() === true;
        } else {
          isValid = value.replace(/\D/g, "").length >= 6;
        }
        setFieldErrorState(field, !isValid);
        if (!isValid) hasError = true;
        return;
      }
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
      if (field === phoneInput && phoneInputInstance) {
        const value = String(field.value || "").trim();
        if (!value) return false;
        if (window.intlTelInput?.utils) {
          if (phoneInputInstance.isValidNumber() !== true) return false;
        } else if (value.replace(/\D/g, "").length < 6) {
          return false;
        }
        continue;
      }
      const isCheckbox = field instanceof HTMLInputElement && field.type === "checkbox";
      const value = String(field.value || "").trim();
      const isValid = isCheckbox ? field.checked : Boolean(value);
      if (!isValid) return false;
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
      if (field === phoneInput) return;
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

  const resolvePhoneForSubmit = async () => {
    if (!phoneInput) {
      const raw = String(contactForm ? new FormData(contactForm).get("phone_raw") || "" : "").trim();
      return raw ? { ok: true, value: raw } : { ok: false, reason: "empty" };
    }
    if (!phoneInputInstance) {
      const raw = String(phoneInput.value || "").trim();
      return raw ? { ok: true, value: raw } : { ok: false, reason: "empty" };
    }
    await phoneInputInstance.promise.catch(() => {});
    const trimmed = String(phoneInput.value || "").trim();
    if (!trimmed) return { ok: false, reason: "empty" };

    const utils = window.intlTelInput?.utils;
    if (utils) {
      if (phoneInputInstance.isValidNumber() !== true) {
        return { ok: false, reason: "invalid" };
      }
      // E.164 from libphonenumber (parse + format), not a naive "+dialCode + raw digits" join.
      const e164 = phoneInputInstance.getNumber(utils.numberFormat.E164);
      return e164 ? { ok: true, value: e164 } : { ok: false, reason: "invalid" };
    }

    const nationalDigits = trimmed.replace(/\D/g, "");
    const dialCode = phoneInputInstance.getSelectedCountryData().dialCode || "";
    if (!dialCode || nationalDigits.length < 6) {
      return { ok: false, reason: "invalid" };
    }
    // Fallback only if utils failed to load (should be rare).
    return { ok: true, value: `+${dialCode}${nationalDigits}` };
  };

  contactForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!status) return;

    clearAllFieldErrors();

    const formData = new FormData(contactForm);
    const fullName = String(formData.get("Full Name") || "").trim();
    const email = String(formData.get("Email Address") || "").trim();
    const service = String(formData.get("Service Needed") || "").trim();
    const timeline = String(formData.get("Timeline") || "").trim();
    const projectDetails = String(formData.get("Project Details") || "").trim();
    const designReferences = String(formData.get("Design References or Examples") || "").trim();
    const preferredContactMethod = String(formData.get("Preferred Contact Method") || "").trim();
    const consent = formData.get("Consent to Contact");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const hasRequiredFieldErrors = validateRequiredFields();
    if (hasRequiredFieldErrors) {
      status.textContent = requiredFieldsMessage;
      status.className = "status error";
      return;
    }

    const phoneResult = await resolvePhoneForSubmit();
    if (!phoneResult.ok) {
      if (phoneInput) setFieldErrorState(phoneInput, true);
      status.textContent =
        phoneResult.reason === "invalid"
          ? "Enter a complete mobile number in the format shown for this country."
          : requiredFieldsMessage;
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
    submission.append("Phone Number", phoneResult.value);
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
        phoneDigitsFieldWasFocused = false;
        phoneInput?.setCustomValidity("");
        if (phoneInput) setFieldErrorState(phoneInput, false);
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
