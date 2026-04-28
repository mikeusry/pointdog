/**
 * point.dog Pixel - Lead Generation Sites
 * Version: 1.0.0
 *
 * A lightweight first-party tracking pixel for lead-gen websites.
 * Captures customer journey events for service businesses:
 * - Spray Squad (pest control)
 * - Banyan Tree (mental health)
 * - Any non-ecommerce site
 *
 * Features:
 * - First-party cookie with cross-subdomain support
 * - localStorage backup for ITP/ETP browsers
 * - Proper SHA-256 hashing for Meta/Google CAPI compliance
 * - Event queue with retry for offline resilience
 * - SPA/route change detection
 * - Event deduplication
 * - Consent management integration
 * - Captures gclid/fbclid/utm_* from URL parameters
 * - Form interaction tracking (view, start, submit)
 * - Phone click tracking
 * - Chat widget integration
 *
 * Installation:
 * Add before </head>:
 *
 * <script>
 *   window.pdPixelConfig = {
 *     brandId: 'spray-squad',
 *     endpoint: 'https://pixel.spraysquad.com/collect',
 *     // Optional: customize form selectors
 *     formSelectors: 'form[data-lead-form], .contact-form, #quote-form'
 *   };
 * </script>
 * <script src="https://cdn.point.dog/pixel/pd-pixel-leadgen.min.js" async></script>
 */

(function(window, document) {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const config = window.pdPixelConfig || {};
  const BRAND_ID = config.brandId || 'unknown';
  const ENDPOINT = config.endpoint || '/pd-pixel/collect';
  const COOKIE_NAME = '_pd_uid';
  const COOKIE_DAYS = 365;
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const DEBUG = config.debug || false;
  const EVENT_QUEUE_KEY = 'pd_event_queue';
  const CONSENT_KEY = 'pd_consent';
  const MAX_RETRIES = 3;
  const DEDUP_WINDOW_MS = 1000; // 1 second

  // Form tracking config
  const FORM_SELECTORS = config.formSelectors ||
    'form[data-lead-form], form[action*="contact"], form[action*="quote"], ' +
    'form[action*="schedule"], form[action*="appointment"], form[action*="request"], ' +
    '.contact-form, .quote-form, .lead-form, #contact-form, #quote-form, ' +
    'form[method="post"]:not([action*="search"]):not([action*="login"]):not([action*="cart"])';

  // Service page patterns
  const SERVICE_PATTERNS = config.servicePatterns || [
    '/services/', '/service/', '/treatments/', '/solutions/',
    '/pest-control/', '/termite/', '/mosquito/', '/rodent/',
    '/therapy/', '/counseling/', '/mental-health/', '/treatment/'
  ];

  // ============================================================================
  // STATE
  // ============================================================================

  let userId = null;
  let sessionId = null;
  let sessionStart = null;
  let attributionData = {};
  let consentState = { analytics: true, marketing: true };
  const recentEvents = new Map();
  const PAGE_LOAD_ID = generateUUID();
  let lastPath = window.location.pathname;
  const trackedForms = new WeakSet();
  const formStarted = new WeakSet();

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function log(...args) {
    if (DEBUG) console.log('[pd-pixel-leadgen]', ...args);
  }

  function generateUUID() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ============================================================================
  // HASHING - SHA-256 for Meta/Google CAPI compliance
  // ============================================================================

  async function sha256(str) {
    if (!str) return null;

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str.toLowerCase().trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      log('SHA-256 fallback used');
      return simpleHash(str);
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  function normalizePhone(phone) {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = '1' + digits;
    }
    return digits;
  }

  function normalizeEmail(email) {
    if (!email) return null;
    return email.toLowerCase().trim();
  }

  // ============================================================================
  // COOKIE & IDENTITY
  // ============================================================================

  function getRootDomain() {
    const parts = location.hostname.split('.');
    if (parts.length >= 2) {
      if (parts[parts.length - 1] === 'localhost') return null;
      return parts.slice(-2).join('.');
    }
    return null;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const domain = getRootDomain();

    let cookieString = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    if (domain) {
      cookieString += `;domain=.${domain}`;
    }
    if (location.protocol === 'https:') {
      cookieString += ';Secure';
    }
    document.cookie = cookieString;

    try {
      localStorage.setItem(name, value);
    } catch (e) {
      log('localStorage backup failed:', e);
    }
  }

  function getUserId() {
    let uid = getCookie(COOKIE_NAME);
    if (!uid) {
      try {
        uid = localStorage.getItem(COOKIE_NAME);
        if (uid) log('Recovered user ID from localStorage');
      } catch (e) {}
    }
    if (!uid) {
      uid = generateUUID();
      log('Created new user ID:', uid);
    }
    setCookie(COOKIE_NAME, uid, COOKIE_DAYS);
    return uid;
  }

  function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  function getSessionId() {
    const stored = sessionStorage.getItem('pd_session');
    const now = Date.now();

    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (now - data.lastActivity < SESSION_TIMEOUT_MS) {
          sessionStorage.setItem('pd_session', JSON.stringify({
            id: data.id,
            start: data.start,
            lastActivity: now
          }));
          return { id: data.id, start: data.start, isNew: false };
        }
      } catch (e) {
        log('Session parse error:', e);
      }
    }

    const newSession = {
      id: generateUUID(),
      start: now,
      lastActivity: now
    };
    sessionStorage.setItem('pd_session', JSON.stringify(newSession));
    log('Created new session:', newSession.id);
    return { id: newSession.id, start: now, isNew: true };
  }

  // ============================================================================
  // DEVICE FINGERPRINT
  // ============================================================================

  function getDeviceFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.languages?.join(',') || '',
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      navigator.deviceMemory || 'unknown',
      navigator.platform || 'unknown',
      getCanvasFingerprint(),
      getWebGLFingerprint()
    ];
    return simpleHash(components.join('|'));
  }

  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('point.dog', 2, 15);
      return canvas.toDataURL().slice(-50);
    } catch (e) {
      return 'canvas-error';
    }
  }

  function getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return 'webgl-no-debug';
      return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'webgl-unknown';
    } catch (e) {
      return 'webgl-error';
    }
  }

  // ============================================================================
  // CONSENT MANAGEMENT
  // ============================================================================

  function initConsent() {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored) {
        consentState = JSON.parse(stored);
        log('Loaded consent state:', consentState);
      }
    } catch (e) {}

    window.addEventListener('pd-consent-update', (e) => {
      updateConsent(e.detail);
    });

    // OneTrust integration
    if (window.OneTrust) {
      try {
        window.OneTrust.OnConsentChanged(() => {
          const groups = window.OneTrust.GetDomainData()?.Groups || [];
          updateConsent({
            analytics: groups.some(g => g.CustomGroupId === 'C0002' && g.Status === true),
            marketing: groups.some(g => g.CustomGroupId === 'C0004' && g.Status === true)
          });
        });
      } catch (e) {}
    }

    // Cookiebot integration
    if (window.Cookiebot) {
      window.addEventListener('CookiebotOnAccept', () => {
        updateConsent({
          analytics: window.Cookiebot.consent.statistics,
          marketing: window.Cookiebot.consent.marketing
        });
      });
    }
  }

  function updateConsent(newState) {
    consentState = { ...consentState, ...newState };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consentState));
    } catch (e) {}
    log('Consent updated:', consentState);
  }

  function canTrack(type = 'analytics') {
    return consentState[type] !== false;
  }

  // ============================================================================
  // ATTRIBUTION DATA CAPTURE
  // ============================================================================

  function captureAttribution() {
    const data = {
      gclid: getUrlParam('gclid'),
      gbraid: getUrlParam('gbraid'),
      wbraid: getUrlParam('wbraid'),
      fbclid: getUrlParam('fbclid'),
      ttclid: getUrlParam('ttclid'),
      msclid: getUrlParam('msclid'),
      utm_source: getUrlParam('utm_source'),
      utm_medium: getUrlParam('utm_medium'),
      utm_campaign: getUrlParam('utm_campaign'),
      utm_content: getUrlParam('utm_content'),
      utm_term: getUrlParam('utm_term')
    };

    const stored = sessionStorage.getItem('pd_attribution');
    if (stored) {
      try {
        const existing = JSON.parse(stored);
        const hasNew = Object.values(data).some(v => v !== null);
        if (hasNew) {
          Object.keys(data).forEach(key => {
            if (data[key] !== null) {
              existing[key] = data[key];
            }
          });
          sessionStorage.setItem('pd_attribution', JSON.stringify(existing));
          return existing;
        }
        return existing;
      } catch (e) {}
    }

    sessionStorage.setItem('pd_attribution', JSON.stringify(data));

    if (data.gclid || data.fbclid || data.gbraid || data.wbraid) {
      try {
        localStorage.setItem('pd_click_id', JSON.stringify({
          gclid: data.gclid,
          gbraid: data.gbraid,
          wbraid: data.wbraid,
          fbclid: data.fbclid,
          timestamp: Date.now()
        }));
      } catch (e) {}
    }

    return data;
  }

  function getStoredClickId() {
    try {
      const stored = localStorage.getItem('pd_click_id');
      if (stored) {
        const data = JSON.parse(stored);
        const ageDays = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
        if (ageDays < 90) {
          return data;
        }
        localStorage.removeItem('pd_click_id');
      }
    } catch (e) {}
    return {};
  }

  // ============================================================================
  // EVENT DEDUPLICATION
  // ============================================================================

  function isDuplicate(eventType, key) {
    const dedupKey = `${eventType}:${key || 'default'}`;
    const now = Date.now();

    if (recentEvents.has(dedupKey)) {
      const lastTime = recentEvents.get(dedupKey);
      if (now - lastTime < DEDUP_WINDOW_MS) {
        log('Skipping duplicate event:', dedupKey);
        return true;
      }
    }

    recentEvents.set(dedupKey, now);

    if (recentEvents.size > 100) {
      for (const [k, v] of recentEvents) {
        if (now - v > DEDUP_WINDOW_MS * 10) {
          recentEvents.delete(k);
        }
      }
    }

    return false;
  }

  // ============================================================================
  // EVENT QUEUE WITH RETRY
  // ============================================================================

  function queueEvent(payload) {
    try {
      const queue = JSON.parse(localStorage.getItem(EVENT_QUEUE_KEY) || '[]');
      payload._retries = (payload._retries || 0) + 1;
      payload._queuedAt = Date.now();

      if (payload._retries <= MAX_RETRIES) {
        queue.push(payload);
        localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
        log('Event queued for retry:', payload.event_type);
      }
    } catch (e) {
      log('Queue error:', e);
    }
  }

  function processQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem(EVENT_QUEUE_KEY) || '[]');
      if (queue.length === 0) return;

      log('Processing event queue:', queue.length, 'events');
      const remaining = [];

      for (const event of queue) {
        if (Date.now() - event._queuedAt > 24 * 60 * 60 * 1000) {
          log('Dropping old queued event:', event.event_type);
          continue;
        }
        if (!trySend(event)) {
          remaining.push(event);
        }
      }

      localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(remaining));
    } catch (e) {
      log('Queue processing error:', e);
    }
  }

  function trySend(payload) {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        return navigator.sendBeacon(ENDPOINT, blob);
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => queueEvent(payload));
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  // ============================================================================
  // EVENT TRACKING
  // ============================================================================

  function buildEventPayload(eventType, eventData = {}) {
    const session = getSessionId();
    const storedClickId = getStoredClickId();

    return {
      event_id: generateUUID(),
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      client_timestamp: Date.now(),
      brand_id: BRAND_ID,
      pd_user_id: userId,
      device_fingerprint: getDeviceFingerprint(),

      // Attribution
      ...attributionData,
      gclid: attributionData.gclid || storedClickId.gclid,
      gbraid: attributionData.gbraid || storedClickId.gbraid,
      wbraid: attributionData.wbraid || storedClickId.wbraid,
      fbclid: attributionData.fbclid || storedClickId.fbclid,

      // Page context
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer,

      // Session
      session_id: session.id,
      is_new_session: session.isNew,
      page_load_id: PAGE_LOAD_ID,

      // Experiment
      experiment_id: getUrlParam('exp_id') || getCookie('pd_experiment') || null,
      test_group: getTestGroup(),

      // Device
      user_agent: navigator.userAgent,
      screen_resolution: screen.width + 'x' + screen.height,
      viewport_size: window.innerWidth + 'x' + window.innerHeight,

      // Event-specific data
      ...eventData
    };
  }

  function getTestGroup() {
    if (!userId) return null;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  function sendEvent(eventType, eventData = {}) {
    if (!canTrack('analytics')) {
      log('Skipping event due to analytics consent:', eventType);
      return;
    }

    const payload = buildEventPayload(eventType, eventData);

    if (!canTrack('marketing')) {
      delete payload.gclid;
      delete payload.gbraid;
      delete payload.wbraid;
      delete payload.fbclid;
      delete payload.ttclid;
      delete payload.msclid;
      delete payload.email_hash;
      delete payload.phone_hash;
    }

    log('Sending event:', eventType, payload);

    if (!trySend(payload)) {
      queueEvent(payload);
    }
  }

  // ============================================================================
  // SPA/HISTORY CHANGE HANDLING
  // ============================================================================

  function setupSPATracking() {
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      onRouteChange();
    };

    window.addEventListener('popstate', onRouteChange);

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      onRouteChange();
    };
  }

  function onRouteChange() {
    const currentPath = window.location.pathname;
    if (currentPath === lastPath) return;
    lastPath = currentPath;

    setTimeout(() => {
      handlePageView();
      // Re-scan for forms on new page
      setupFormTracking();
    }, 100);
  }

  // ============================================================================
  // PAGE TYPE DETECTION (Lead-Gen)
  // ============================================================================

  function getPageType() {
    const path = window.location.pathname.toLowerCase();

    if (path === '/' || path === '') return 'home';

    // Service pages
    for (const pattern of SERVICE_PATTERNS) {
      if (path.includes(pattern)) return 'service';
    }

    // Contact/Quote pages
    if (path.includes('/contact')) return 'contact';
    if (path.includes('/quote')) return 'quote';
    if (path.includes('/schedule') || path.includes('/appointment') || path.includes('/book')) return 'schedule';
    if (path.includes('/about')) return 'about';
    if (path.includes('/team') || path.includes('/staff')) return 'team';
    if (path.includes('/testimonial') || path.includes('/review')) return 'testimonials';
    if (path.includes('/blog') || path.includes('/news') || path.includes('/article')) return 'blog';
    if (path.includes('/faq') || path.includes('/help')) return 'faq';
    if (path.includes('/pricing') || path.includes('/rates')) return 'pricing';
    if (path.includes('/location') || path.includes('/area')) return 'locations';
    if (path.includes('/thank') || path.includes('/success') || path.includes('/confirmation')) return 'thank_you';

    return 'other';
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handlePageView() {
    const pageType = getPageType();
    if (isDuplicate('page_view', window.location.pathname)) return;

    sendEvent('page_view', {
      page_type: pageType
    });

    // Auto-track service page views
    if (pageType === 'service') {
      handleServiceView();
    }
  }

  function handleServiceView() {
    const path = window.location.pathname;
    const serviceName = extractServiceName(path);

    if (isDuplicate('service_view', path)) return;

    sendEvent('service_view', {
      service_name: serviceName,
      service_path: path
    });
  }

  function extractServiceName(path) {
    // Extract service name from URL path
    // /services/pest-control -> "pest control"
    // /termite-treatment -> "termite treatment"
    const segments = path.split('/').filter(s => s);
    const lastSegment = segments[segments.length - 1] || '';
    return lastSegment.replace(/-/g, ' ').replace(/_/g, ' ');
  }

  // ============================================================================
  // FORM TRACKING
  // ============================================================================

  function setupFormTracking() {
    const forms = document.querySelectorAll(FORM_SELECTORS);

    forms.forEach(form => {
      if (trackedForms.has(form)) return;
      trackedForms.add(form);

      const formId = form.id || form.getAttribute('data-form-id') || generateFormId(form);
      const formName = form.getAttribute('data-form-name') ||
                       form.getAttribute('name') ||
                       detectFormType(form);

      log('Tracking form:', formId, formName);

      // Track form view (when scrolled into viewport)
      setupFormViewTracking(form, formId, formName);

      // Track form start (first interaction)
      setupFormStartTracking(form, formId, formName);

      // Track form submit
      setupFormSubmitTracking(form, formId, formName);
    });
  }

  function generateFormId(form) {
    // Generate a stable ID based on form structure
    const action = form.action || '';
    const fieldCount = form.elements.length;
    return simpleHash(action + fieldCount + form.className);
  }

  function detectFormType(form) {
    const action = (form.action || '').toLowerCase();
    const html = form.innerHTML.toLowerCase();

    if (action.includes('quote') || html.includes('quote')) return 'quote_request';
    if (action.includes('contact') || html.includes('contact')) return 'contact';
    if (action.includes('schedule') || action.includes('appointment') ||
        html.includes('schedule') || html.includes('appointment')) return 'appointment';
    if (action.includes('newsletter') || html.includes('newsletter') ||
        html.includes('subscribe')) return 'newsletter';
    if (html.includes('callback') || html.includes('call me')) return 'callback_request';

    return 'lead_form';
  }

  function setupFormViewTracking(form, formId, formName) {
    if (!('IntersectionObserver' in window)) {
      // Fallback: track immediately
      handleFormView(formId, formName);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          handleFormView(formId, formName);
          observer.unobserve(form);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(form);
  }

  function handleFormView(formId, formName) {
    if (isDuplicate('form_view', formId)) return;

    sendEvent('form_view', {
      form_id: formId,
      form_name: formName
    });
  }

  function setupFormStartTracking(form, formId, formName) {
    const trackStart = () => {
      if (formStarted.has(form)) return;
      formStarted.add(form);

      if (isDuplicate('form_start', formId)) return;

      sendEvent('form_start', {
        form_id: formId,
        form_name: formName
      });
    };

    // Track on first focus
    form.addEventListener('focusin', trackStart, { once: true });

    // Also track on first input
    form.addEventListener('input', trackStart, { once: true });
  }

  function setupFormSubmitTracking(form, formId, formName) {
    form.addEventListener('submit', async function(e) {
      // Don't prevent default - let form submit normally
      // Capture data before submission
      const formData = extractFormData(form);

      if (isDuplicate('form_submit', formId)) return;

      // Hash PII
      let emailHash = null;
      let phoneHash = null;
      let nameHash = null;

      if (formData.email) {
        emailHash = await sha256(normalizeEmail(formData.email));
      }
      if (formData.phone) {
        phoneHash = await sha256(normalizePhone(formData.phone));
      }
      if (formData.name) {
        nameHash = await sha256(formData.name.toLowerCase().trim());
      }

      sendEvent('form_submit', {
        form_id: formId,
        form_name: formName,
        form_type: formName,
        service_interest: formData.service || formData.subject || null,
        lead_source: attributionData.utm_source || 'direct',
        email_hash: emailHash,
        phone_hash: phoneHash,
        name_hash: nameHash,
        // Estimated lead value (can be customized per brand)
        estimated_value: config.defaultLeadValue || null
      });
    });
  }

  function extractFormData(form) {
    const data = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      const keyLower = key.toLowerCase();

      // Email detection
      if (keyLower.includes('email') || keyLower === 'e-mail') {
        data.email = value;
      }
      // Phone detection
      else if (keyLower.includes('phone') || keyLower.includes('tel') ||
               keyLower.includes('mobile') || keyLower.includes('cell')) {
        data.phone = value;
      }
      // Name detection
      else if (keyLower === 'name' || keyLower.includes('fullname') ||
               keyLower === 'full_name' || keyLower === 'full-name') {
        data.name = value;
      }
      else if (keyLower === 'first_name' || keyLower === 'firstname' || keyLower === 'first-name') {
        data.firstName = value;
      }
      else if (keyLower === 'last_name' || keyLower === 'lastname' || keyLower === 'last-name') {
        data.lastName = value;
      }
      // Service/Subject detection
      else if (keyLower.includes('service') || keyLower.includes('interest') ||
               keyLower.includes('subject') || keyLower.includes('reason')) {
        data.service = value;
      }
    }

    // Combine first + last name if separate
    if (!data.name && (data.firstName || data.lastName)) {
      data.name = [data.firstName, data.lastName].filter(Boolean).join(' ');
    }

    return data;
  }

  // ============================================================================
  // PHONE CLICK TRACKING
  // ============================================================================

  function setupPhoneClickTracking() {
    document.addEventListener('click', async function(e) {
      const link = e.target.closest('a[href^="tel:"]');
      if (link) {
        const phoneNumber = link.href.replace('tel:', '');
        const normalizedPhone = normalizePhone(phoneNumber);

        if (isDuplicate('phone_click', normalizedPhone)) return;

        const phoneHash = await sha256(normalizedPhone);

        sendEvent('phone_click', {
          phone_number_hash: phoneHash,
          click_text: link.textContent?.trim(),
          click_location: getClickLocation(link)
        });
      }
    });
  }

  function getClickLocation(element) {
    // Determine where on the page the click occurred
    const header = element.closest('header, nav, .header, .nav, .navigation');
    if (header) return 'header';

    const footer = element.closest('footer, .footer');
    if (footer) return 'footer';

    const sidebar = element.closest('aside, .sidebar');
    if (sidebar) return 'sidebar';

    return 'content';
  }

  // ============================================================================
  // CHAT WIDGET TRACKING
  // ============================================================================

  function setupChatTracking() {
    // Common chat widgets
    const chatWidgets = [
      { name: 'Intercom', open: 'intercom:show', close: 'intercom:hide' },
      { name: 'Drift', open: 'drift.on("startConversation")', detect: () => window.drift },
      { name: 'HubSpot', detect: () => window.HubSpotConversations },
      { name: 'Zendesk', detect: () => window.zE },
      { name: 'LiveChat', detect: () => window.LC_API },
      { name: 'Tawk', detect: () => window.Tawk_API },
      { name: 'Crisp', detect: () => window.$crisp }
    ];

    // Generic click detection for chat buttons
    document.addEventListener('click', function(e) {
      const chatButton = e.target.closest(
        '[class*="chat"], [id*="chat"], [data-chat], ' +
        '[class*="livechat"], [class*="messenger"], ' +
        '[aria-label*="chat" i], [title*="chat" i]'
      );

      if (chatButton) {
        if (isDuplicate('chat_start', 'click')) return;

        sendEvent('chat_start', {
          chat_trigger: 'button_click',
          button_text: chatButton.textContent?.trim().slice(0, 50)
        });
      }
    });

    // Intercom
    if (window.Intercom) {
      const originalIntercom = window.Intercom;
      window.Intercom = function() {
        if (arguments[0] === 'show' || arguments[0] === 'showNewMessage') {
          if (!isDuplicate('chat_start', 'intercom')) {
            sendEvent('chat_start', { chat_provider: 'intercom' });
          }
        }
        return originalIntercom.apply(this, arguments);
      };
    }

    // Drift
    if (window.drift) {
      window.drift.on('startConversation', () => {
        if (!isDuplicate('chat_start', 'drift')) {
          sendEvent('chat_start', { chat_provider: 'drift' });
        }
      });
    }
  }

  // ============================================================================
  // APPOINTMENT/CALENDAR TRACKING
  // ============================================================================

  function setupAppointmentTracking() {
    // Calendly
    window.addEventListener('message', function(e) {
      if (e.origin.includes('calendly.com')) {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

          if (data.event === 'calendly.event_scheduled') {
            if (isDuplicate('appointment_booked', 'calendly')) return;

            sendEvent('appointment_booked', {
              appointment_provider: 'calendly',
              appointment_type: data.payload?.event_type?.name || 'unknown'
            });
          }
        } catch (err) {}
      }
    });

    // Acuity Scheduling
    window.addEventListener('message', function(e) {
      if (e.origin.includes('acuityscheduling.com')) {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

          if (data.event === 'acuity.scheduled') {
            if (isDuplicate('appointment_booked', 'acuity')) return;

            sendEvent('appointment_booked', {
              appointment_provider: 'acuity',
              appointment_type: data.type || 'unknown'
            });
          }
        } catch (err) {}
      }
    });

    // Generic booking button clicks
    document.addEventListener('click', function(e) {
      const bookingButton = e.target.closest(
        'a[href*="calendly"], a[href*="acuity"], a[href*="booking"], ' +
        '[class*="book-appointment"], [class*="schedule-button"], ' +
        'button[data-booking], a[data-booking]'
      );

      if (bookingButton) {
        if (isDuplicate('appointment_intent', 'click')) return;

        sendEvent('appointment_intent', {
          button_text: bookingButton.textContent?.trim().slice(0, 50),
          destination: bookingButton.href || 'unknown'
        });
      }
    });
  }

  // ============================================================================
  // SCROLL DEPTH TRACKING
  // ============================================================================

  function setupScrollTracking() {
    const milestones = [25, 50, 75, 90];
    const reached = new Set();

    function getScrollPercent() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      return Math.round((scrollTop / docHeight) * 100);
    }

    function checkMilestones() {
      const percent = getScrollPercent();

      for (const milestone of milestones) {
        if (percent >= milestone && !reached.has(milestone)) {
          reached.add(milestone);

          sendEvent('scroll_depth', {
            depth_percent: milestone,
            page_type: getPageType()
          });
        }
      }
    }

    // Throttle scroll events
    let ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          checkMilestones();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    log('Initializing point.dog Lead-Gen Pixel v1.0 for brand:', BRAND_ID);

    initConsent();
    userId = getUserId();
    log('User ID:', userId);

    attributionData = captureAttribution();
    log('Attribution data:', attributionData);

    // Set up all tracking
    setupFormTracking();
    setupPhoneClickTracking();
    setupChatTracking();
    setupAppointmentTracking();
    setupSPATracking();
    setupScrollTracking();

    // Process queued events
    processQueue();

    // Send initial page view
    handlePageView();

    // Expose API
    window.pdPixel = {
      track: sendEvent,
      trackFormSubmit: (formId, formName, data) => {
        sendEvent('form_submit', { form_id: formId, form_name: formName, ...data });
      },
      trackAppointment: (provider, type) => {
        sendEvent('appointment_booked', { appointment_provider: provider, appointment_type: type });
      },
      getUserId: () => userId,
      getSessionId: () => getSessionId().id,
      getAttribution: () => attributionData,
      setConsent: updateConsent,
      version: '1.0.0-leadgen'
    };

    log('Lead-gen pixel initialization complete');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
