document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const navBase = (() => {
    const path = window.location.pathname.replace(/\/index\.html$/i, "");
    const segments = path.split("/").filter(Boolean);
    const last = (segments[segments.length - 1] || "").toLowerCase();
    return ["services", "projects", "about", "contact"].includes(last) ? "../" : "./";
  })();

  /* ---------- Header: scrolled state ---------- */
  const header = document.querySelector(".site-header");
  const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  /* ---------- Active nav link ---------- */
  const page = document.body.dataset.page;
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    const isActive = link.dataset.pageLink === page;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
  });

  /* ---------- Mobile menu ---------- */
  const menuToggle = document.querySelector(".menu-toggle");
  const setMenu = (open) => {
    if (!menuToggle) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  };
  menuToggle?.addEventListener("click", () => {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  document.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
      setMenu(false);
      menuToggle?.focus();
    }
  });
  window.matchMedia("(min-width: 861px)").addEventListener("change", (e) => {
    if (e.matches) setMenu(false);
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((openItem) => {
        openItem.classList.remove("open");
        openItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---------- Project modal ---------- */
  const initProjectModals = () => {
    const projects = Array.from(document.querySelectorAll(".project[data-modal-title]"));
    if (!projects.length) return;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="modal-close" type="button" aria-label="Close project details">✕</button>
        <div class="modal-media">
          <div class="modal-track" id="modalTrack" tabindex="0" aria-label="Project screenshots"></div>
          <button class="modal-nav modal-nav--prev" type="button" aria-label="Previous screenshot">←</button>
          <button class="modal-nav modal-nav--next" type="button" aria-label="Next screenshot">→</button>
          <span class="modal-count" id="modalCount"></span>
        </div>
        <div class="modal-body">
          <div>
            <span class="tag" id="modalType"></span>
            <h3 id="modalTitle"><a class="modal-title-link" id="modalTitleLink" href="#" target="_blank" rel="noopener noreferrer"><span id="modalTitleText"></span><span class="modal-title-arrow" aria-hidden="true">↗</span></a></h3>
            <p class="modal-visit-hint" id="modalVisitHint"><span id="modalHintVerb">Tap</span> the name to visit the website</p>
            <p class="modal-desc" id="modalDesc"></p>
          </div>
          <div class="modal-side">
            <h4>What's on the site</h4>
            <ul class="modal-list" id="modalList"></ul>
            <a class="btn btn-primary" id="modalVisit" href="#" target="_blank" rel="noopener noreferrer">Visit live site ↗</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const $ = (sel) => overlay.querySelector(sel);
    const track = $("#modalTrack");
    const prev = $(".modal-nav--prev");
    const next = $(".modal-nav--next");
    const count = $("#modalCount");
    let lastFocus = null;
    let total = 0;

    const currentIndex = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const syncNav = () => {
      const i = currentIndex();
      count.textContent = total > 1 ? `${i + 1} / ${total}` : "";
      prev.hidden = total < 2;
      next.hidden = total < 2;
    };
    const go = (delta) => {
      const target = (currentIndex() + delta + total) % total;
      track.scrollTo({ left: target * track.clientWidth, behavior: prefersReducedMotion ? "auto" : "smooth" });
    };

    const open = (el) => {
      lastFocus = document.activeElement;
      const d = el.dataset;
      const images = (d.modalImages || "").split("|").map((s) => s.trim()).filter(Boolean);
      total = images.length;
      track.innerHTML = "";
      images.forEach((src, i) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = `${d.modalTitle} screenshot ${i + 1}`;
        img.decoding = "async";
        track.appendChild(img);
      });
      track.scrollLeft = 0;
      $("#modalType").textContent = d.modalType || "";
      $("#modalTitleText").textContent = d.modalTitle || "";
      const titleLink = $("#modalTitleLink");
      const hint = $("#modalVisitHint");
      if (d.modalUrl) {
        titleLink.href = d.modalUrl;
        titleLink.removeAttribute("aria-disabled");
        titleLink.setAttribute("aria-label", `${d.modalTitle} — visit the live website (opens in a new tab)`);
        $("#modalHintVerb").textContent = window.matchMedia("(hover: hover)").matches ? "Click" : "Tap";
        hint.hidden = false;
      } else {
        titleLink.removeAttribute("href");
        titleLink.setAttribute("aria-disabled", "true");
        hint.hidden = true;
      }
      $("#modalDesc").textContent = d.modalDescription || "";
      const list = $("#modalList");
      list.innerHTML = "";
      (d.modalPoints || "").split("|").filter(Boolean).forEach((point) => {
        const li = document.createElement("li");
        li.textContent = point.trim();
        list.appendChild(li);
      });
      const visit = $("#modalVisit");
      visit.hidden = !d.modalUrl;
      if (d.modalUrl) visit.href = d.modalUrl;
      syncNav();

      overlay.hidden = false;
      document.body.classList.add("modal-open");
      requestAnimationFrame(() => overlay.classList.add("is-open"));
      $(".modal-close").focus();
    };

    const close = () => {
      overlay.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      window.setTimeout(() => {
        overlay.hidden = true;
      }, prefersReducedMotion ? 0 : 250);
      lastFocus?.focus?.();
    };

    projects.forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        open(el);
      });
      el.addEventListener("keydown", (e) => {
        if (e.target !== el) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(el);
        }
      });
    });

    $(".modal-close").addEventListener("click", close);
    prev.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));
    track.addEventListener("scroll", () => window.requestAnimationFrame(syncNav), { passive: true });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (overlay.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && total > 1) go(-1);
      if (e.key === "ArrowRight" && total > 1) go(1);
      if (e.key === "Tab") {
        const focusables = Array.from(overlay.querySelectorAll("button:not([hidden]), a[href]:not([hidden]), [tabindex='0']"));
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  };
  initProjectModals();

  /* ---------- Home metrics ---------- */
  const animateTo = (el, to, format, duration = 900) => {
    if (prefersReducedMotion) {
      el.textContent = format(to);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = format(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const projectsEl = document.getElementById("projectsDeliveredMetric");
  if (projectsEl) {
    fetch(new URL(`${navBase}projects/`, window.location.href), { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => {
        if (!html) return;
        const doc = new DOMParser().parseFromString(html, "text/html");
        const n = doc.querySelectorAll(".project[data-modal-title]").length;
        if (n > 0) animateTo(projectsEl, n, (v) => String(Math.round(v)));
      })
      .catch(() => {});
  }

  const satisfactionEl = document.getElementById("clientSatisfactionMetric");
  const ratingEl = document.getElementById("averageRatingMetric");
  const reviewCountEl = document.getElementById("reviewCountNote");
  if (satisfactionEl && ratingEl) {
    fetch(
      "https://script.google.com/macros/s/AKfycbw1GAY8Rl9U1eW7KW46zne8WBWP8KF1SryZ2wBu2TepBWUaW5RTLweKv3GCcIvYrA/exec",
      { headers: { Accept: "application/json" } }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Metrics request failed");
        return r.json();
      })
      .then((data) => {
        const rating = String(data?.averageRating || "").trim();
        const satisfaction = String(data?.satisfactionPercent || "").trim();
        const reviews = Number(data?.reviewCount ?? data?.totalReviews);
        if (/^\d+(\.\d+)?\/5$/.test(rating)) {
          animateTo(ratingEl, Number(rating.replace("/5", "")), (v) => `${v.toFixed(1)}/5`);
        }
        if (/^\d+%$/.test(satisfaction)) {
          animateTo(satisfactionEl, Number(satisfaction.replace("%", "")), (v) => `${Math.round(v)}%`);
        }
        if (reviewCountEl && Number.isFinite(reviews) && reviews > 0) {
          reviewCountEl.hidden = false;
          reviewCountEl.textContent = `Based on ${reviews} client review${reviews === 1 ? "" : "s"}`;
        }
      })
      .catch(() => {});
  }

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
