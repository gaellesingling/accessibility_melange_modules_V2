/*!
 * A11y Widget – logic
 * Expose window.A11yWidget (registerFeature, get, set)
 */
(function(){
  const STORAGE_KEY = 'a11y-widget-prefs:v1';
  const LAUNCHER_POS_KEY = 'a11y-widget-launcher-pos:v1';
  const PANEL_SIDE_KEY = 'a11y-widget-panel-side:v1';

  // -------- API publique --------
  const listeners = new Map(); // key -> Set<fct>

  const A11yAPI = {
    registerFeature(key, handler){
      if(!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(handler);
      return () => listeners.get(key)?.delete(handler);
    },
    get(key){ return document.documentElement.dataset['a11y' + dashToCamel(key)] === 'on'; },
    set(key, value){ toggleFeature(key, !!value); persist(); }
  };
  window.A11yWidget = A11yAPI;

  function dashToCamel(s){
    return s.split('-').map((p,i)=> p.charAt(0).toUpperCase()+p.slice(1)).join('');
  }

  // ---------- Elements ----------
  const btn = document.getElementById('a11y-launcher');
  const overlay = document.getElementById('a11y-overlay');
  const panel = overlay ? overlay.querySelector('.a11y-panel') : null;
  const closeBtn = document.getElementById('a11y-close');
  const closeBtn2 = document.getElementById('a11y-close2');
  const resetBtn = document.getElementById('a11y-reset');
  const sideToggleBtn = document.getElementById('a11y-side-toggle');
  const sideToggleLabels = sideToggleBtn ? {
    left: sideToggleBtn.dataset.labelLeft || '',
    right: sideToggleBtn.dataset.labelRight || ''
  } : null;

  const tablist = document.querySelector('[data-role="section-tablist"]');
  const tabs = tablist ? Array.from(tablist.querySelectorAll('[data-role="section-tab"]')) : [];
  const panelPartsBySection = new Map();
  const featureTemplate = document.querySelector('[data-role="feature-placeholder-template"]');
  const featureDataScript = document.querySelector('[data-role="feature-data"]');
  const searchForm = document.querySelector('[data-role="search-form"]');
  const searchInput = document.getElementById('a11y-search');
  const searchResults = document.querySelector('[data-role="search-results"]');
  const searchList = searchResults ? searchResults.querySelector('[data-role="search-list"]') : null;
  const searchEmpty = searchResults ? searchResults.querySelector('[data-role="search-empty"]') : null;

  const sectionsData = (() => {
    if(!featureDataScript){ return []; }
    try {
      const raw = (featureDataScript.textContent || '[]').trim();
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch(err){
      return [];
    }
  })();

  const sectionsById = new Map();
  sectionsData.forEach(section => {
    if(section && typeof section.id === 'string' && section.id){
      sectionsById.set(section.id, section);
    }
  });

  tabs.forEach(tab => {
    const sectionId = tab.dataset.sectionId || '';
    if(!sectionId){ return; }
    const container = tab.closest('[data-role="tab-item"]');
    if(!container){ return; }
    const panel = container.querySelector('[data-role="section-panel"][data-section-id]');
    if(!panel){ return; }
    const grid = panel.querySelector('[data-role="feature-grid"]');
    const empty = panel.querySelector('[data-role="feature-empty"]');
    panelPartsBySection.set(sectionId, { panel, grid, empty });
    if(panel.hidden){ panel.setAttribute('aria-hidden','true'); }
    else { panel.setAttribute('aria-hidden','false'); }
  });

  const DYSLEXIA_SLUG = 'cognitif-dyslexie';
  const DYSLEXIA_SETTINGS_KEY = 'a11y-widget-dyslexie-settings:v1';
  const DYSLEXIA_DEFAULT_COLOR = '#ffeb3b';
  const dyslexiaInstances = new Set();
  let dyslexiaSettings = loadDyslexiaSettings();
  let dyslexiaActive = false;

  const CURSOR_SLUG = 'moteur-curseur';
  const CURSOR_SETTINGS_KEY = 'a11y-widget-cursor-settings:v1';
  const CURSOR_BASE_SIZE = 24;
  const CURSOR_SIZE_MIN = 1;
  const CURSOR_SIZE_MAX = 2;
  const CURSOR_SIZE_STEP = 0.1;
  const CURSOR_COLORS = {
    white: { label: 'Blanc', fill: '#ffffff', stroke: '#202124' },
    black: { label: 'Noir', fill: '#202124', stroke: '#ffffff' },
  };
  const CURSOR_ARROW_HOTSPOT = [4, 0];
  const CURSOR_POINTER_HOTSPOT = [12, 12];

  const BUTTONS_SLUG = 'moteur-boutons';
  const BUTTONS_SETTINGS_KEY = 'a11y-widget-buttons-settings:v1';
  const BUTTONS_SIZE_MIN = 1;
  const BUTTONS_SIZE_MAX = 1.5;
  const BUTTONS_SIZE_STEP = 0.05;
  const BUTTONS_ATTR_SELECTOR = 'html[data-a11y-moteur-boutons="on"]';
  const BUTTONS_CONTAINER_SELECTORS = ['main', '#content', '.site-content', '.entry-content'];
  const BUTTONS_BUTTON_SELECTORS = [
    '.wp-block-button__link:not(#a11y-overlay *)',
    '.wp-element-button:not(#a11y-overlay *)',
    'button:not(#a11y-overlay button)',
    '.button:not(#a11y-overlay .button)',
    '.btn:not(#a11y-overlay .btn)',
    'input[type="submit"]:not(#a11y-overlay input)',
    'input[type="button"]:not(#a11y-overlay input)',
    'input[type="reset"]:not(#a11y-overlay input)'
  ];
  const BUTTONS_TARGET_LIST = (() => {
    const combos = [];
    BUTTONS_CONTAINER_SELECTORS.forEach(container => {
      BUTTONS_BUTTON_SELECTORS.forEach(selector => {
        combos.push(`${container} ${selector}`);
      });
    });
    return combos;
  })();
  const BUTTONS_INSIDE_LIST = BUTTONS_TARGET_LIST.map(selector => `${selector} *`);
  const BUTTONS_THEMES = [
    { key: 'default', name: 'Défaut' },
    { key: 'grey', name: 'Gris', colors: { bg: '#6c757d', text: '#ffffff' } },
    { key: 'dark', name: 'Sombre', colors: { bg: '#212529', text: '#ffffff' } },
    { key: 'light', name: 'Clair', colors: { bg: '#f8f9fa', text: '#212529', border: '#dee2e6' } },
    { key: 'contrast', name: 'Contrasté', colors: { bg: '#ffc107', text: '#000000' } },
  ];
  const BUTTONS_THEME_BY_KEY = new Map(BUTTONS_THEMES.map(theme => [theme.key, theme]));
  const buttonInstances = new Set();
  let buttonSettings = loadButtonSettings();
  let buttonActive = false;
  let buttonStyleElement = null;
  let buttonIdCounter = 0;

  function buildCursorArrow({ fill, stroke, size }){
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${fill}" stroke="${stroke}" stroke-width="1.5" d="M4.2,3.8l15,10.2l-7.1,1.5l-3.3,7.4L4.2,3.8z"/></svg>`;
  }

  function buildCursorPointer({ fill, stroke, size }){
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${fill}" stroke="${stroke}" stroke-width="1.5" d="M9.6,22.2c-0.4,0.1-0.9-0.1-1-0.5l-1.3-4.2H4.8c-1.8,0-2.5-1.1-1.6-2.5L9,2.2c0.7-1.1,2-1.1,2.8,0l5.8,12.8c0.9,1.4,0.2,2.5-1.6,2.5h-2.5l-1.3,4.2C10.1,22.1,9.8,22.3,9.6,22.2z"/></svg>`;
  }
  const cursorInstances = new Set();
  let cursorSettings = loadCursorSettings();
  let cursorActive = false;
  let cursorStyleElement = null;

  const featureInputs = new Map();
  const renderedSections = new Set();
  let featureState = loadStoredState();
  let activeSectionId = null;
  let panelSide = 'right';
  let searchQuery = '';

  let launcherLastPos = null;
  let hasCustomLauncherPosition = false;
  let skipNextClick = false;
  let dragMoved = false;
  let dragging = false;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragStartPos = null;
  let activeTouchId = null;
  const supportsPointer = 'PointerEvent' in window;

  function getCurrentLauncherPosition(){
    if(!btn){ return { x: 0, y: 0 }; }
    const rect = btn.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  function clampLauncherPosition(x, y){
    if(!btn){ return { x, y }; }
    const rect = btn.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const maxX = Math.max(0, window.innerWidth - width);
    const maxY = Math.max(0, window.innerHeight - height);
    return {
      x: Math.min(Math.max(x, 0), maxX),
      y: Math.min(Math.max(y, 0), maxY)
    };
  }

  function applyLauncherPosition(x, y){
    document.documentElement.style.setProperty('--a11y-launcher-x', `${x}px`);
    document.documentElement.style.setProperty('--a11y-launcher-y', `${y}px`);
    launcherLastPos = { x, y };
  }

  function persistLauncherPosition(x, y){
    hasCustomLauncherPosition = true;
    try {
      localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ x, y }));
    } catch(err){ /* ignore */ }
  }

  function restoreLauncherPosition(){
    if(!btn) return;
    try {
      const raw = localStorage.getItem(LAUNCHER_POS_KEY);
      if(!raw) return;
      const data = JSON.parse(raw);
      if(typeof data.x !== 'number' || typeof data.y !== 'number') return;
      const clamped = clampLauncherPosition(data.x, data.y);
      applyLauncherPosition(clamped.x, clamped.y);
      hasCustomLauncherPosition = true;
      if(clamped.x !== data.x || clamped.y !== data.y){
        persistLauncherPosition(clamped.x, clamped.y);
      }
    } catch(err){ /* ignore */ }
  }

  function loadPanelSide(){
    try {
      const stored = localStorage.getItem(PANEL_SIDE_KEY);
      if(stored === 'left' || stored === 'right'){
        return stored;
      }
    } catch(err){ /* ignore */ }
    return 'right';
  }

  function persistPanelSide(side){
    try { localStorage.setItem(PANEL_SIDE_KEY, side); } catch(err){ /* ignore */ }
  }

  function updateSideToggleUI(side){
    if(!sideToggleBtn) return;
    const label = side === 'left'
      ? ((sideToggleLabels && sideToggleLabels.right) || '')
      : ((sideToggleLabels && sideToggleLabels.left) || '');
    if(label){
      sideToggleBtn.setAttribute('aria-label', label);
      sideToggleBtn.setAttribute('title', label);
    }
    sideToggleBtn.setAttribute('aria-pressed', side === 'left' ? 'true' : 'false');
  }

  function applyPanelSide(side){
    const resolved = side === 'left' ? 'left' : 'right';
    panelSide = resolved;
    if(panel){
      panel.classList.toggle('is-left', resolved === 'left');
      panel.classList.toggle('is-right', resolved === 'right');
    }
    updateSideToggleUI(resolved);
  }

  function startDragging(clientX, clientY){
    if(!btn) return;
    skipNextClick = false;
    dragMoved = false;
    const rect = btn.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;
    dragStartPos = { x: rect.left, y: rect.top };
    launcherLastPos = { x: rect.left, y: rect.top };
    dragging = true;
  }

  function moveDragging(clientX, clientY){
    if(!dragging) return;
    const targetX = clientX - dragOffsetX;
    const targetY = clientY - dragOffsetY;
    const clamped = clampLauncherPosition(targetX, targetY);
    applyLauncherPosition(clamped.x, clamped.y);
    if(Math.abs(clamped.x - dragStartPos.x) > 1 || Math.abs(clamped.y - dragStartPos.y) > 1){
      dragMoved = true;
    }
  }

  function endDragging(){
    if(!dragging) return;
    dragging = false;
    dragPointerId = null;
    activeTouchId = null;
    if(dragMoved && launcherLastPos){
      persistLauncherPosition(launcherLastPos.x, launcherLastPos.y);
      skipNextClick = true;
      setTimeout(()=>{ skipNextClick = false; }, 0);
    } else {
      skipNextClick = false;
    }
    dragMoved = false;
  }

  function handleResize(){
    if(!btn || !hasCustomLauncherPosition) return;
    const current = getCurrentLauncherPosition();
    const clamped = clampLauncherPosition(current.x, current.y);
    if(clamped.x !== current.x || clamped.y !== current.y){
      applyLauncherPosition(clamped.x, clamped.y);
      persistLauncherPosition(clamped.x, clamped.y);
    }
  }

  function onPointerDown(e){
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    dragPointerId = e.pointerId;
    startDragging(e.clientX, e.clientY);
    if(btn.setPointerCapture){
      try { btn.setPointerCapture(dragPointerId); } catch(err){}
    }
    if(e.pointerType !== 'mouse'){
      e.preventDefault();
    }
  }

  function onPointerMove(e){
    if(!dragging || e.pointerId !== dragPointerId) return;
    moveDragging(e.clientX, e.clientY);
  }

  function onPointerUp(e){
    if(e.pointerId !== dragPointerId) return;
    if(btn.releasePointerCapture){
      try { btn.releasePointerCapture(dragPointerId); } catch(err){}
    }
    endDragging();
  }

  function findTouchById(touchList, id){
    for(let i=0;i<touchList.length;i++){
      if(touchList[i].identifier === id) return touchList[i];
    }
    return null;
  }

  function onTouchStart(e){
    if(e.touches.length > 1) return;
    const touch = e.changedTouches[0];
    if(!touch) return;
    activeTouchId = touch.identifier;
    startDragging(touch.clientX, touch.clientY);
    e.preventDefault();
  }

  function onTouchMove(e){
    if(activeTouchId === null) return;
    const touch = findTouchById(e.changedTouches, activeTouchId);
    if(!touch) return;
    moveDragging(touch.clientX, touch.clientY);
    e.preventDefault();
  }

  function onTouchEnd(e){
    if(activeTouchId === null) return;
    const touch = findTouchById(e.changedTouches, activeTouchId);
    if(!touch) return;
    endDragging();
  }

  // ---------- Section navigation ----------
  function clearFeatureGrid(targetGrid){
    if(!targetGrid) return;
    const inputs = targetGrid.querySelectorAll('[data-role="feature-input"]');
    inputs.forEach(input => {
      const key = input.dataset.feature;
      if(key){ featureInputs.delete(key); }
    });
    targetGrid.innerHTML = '';
  }

  function registerFeatureInput(key, input){
    if(!key || !input) return;
    if(featureInputs.has(key) && featureInputs.get(key) !== input){
      featureInputs.delete(key);
    }
    featureInputs.set(key, input);
    const stored = Object.prototype.hasOwnProperty.call(featureState, key) ? !!featureState[key] : false;
    input.checked = stored;
    input.addEventListener('change', () => toggleFeature(key, input.checked));
  }

  function buildSwitch(slug, ariaLabel){
    if(!slug){ return null; }
    const switchLabel = document.createElement('label');
    switchLabel.className = 'a11y-switch';
    switchLabel.setAttribute('data-role', 'feature-switch');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data-role', 'feature-input');
    input.dataset.feature = slug;
    if(ariaLabel){ input.setAttribute('aria-label', ariaLabel); }
    const track = document.createElement('span');
    track.className = 'track';
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    switchLabel.appendChild(input);
    switchLabel.appendChild(track);
    switchLabel.appendChild(thumb);
    registerFeatureInput(slug, input);
    return switchLabel;
  }

  function createFeaturePlaceholder(feature){
    if(!featureTemplate || !featureTemplate.content){ return null; }
    const fragment = featureTemplate.content.cloneNode(true);
    const labelEl = fragment.querySelector('[data-role="feature-label"]');
    if(labelEl){ labelEl.textContent = feature.label || ''; }
    const inputEl = fragment.querySelector('[data-role="feature-input"]');
    if(inputEl){
      const slug = typeof feature.slug === 'string' ? feature.slug : '';
      inputEl.dataset.feature = slug;
      const aria = feature.aria_label || feature.label || '';
      if(aria){ inputEl.setAttribute('aria-label', aria); }
      registerFeatureInput(slug, inputEl);
    }
    return fragment;
  }

  function createFeatureGroup(feature){
    const children = Array.isArray(feature.children) ? feature.children : [];
    if(!children.length){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card has-children';
    article.setAttribute('data-role', 'feature-card');

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.setAttribute('data-role', 'feature-meta');

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = feature.label || '';
    meta.appendChild(labelEl);

    article.appendChild(meta);

    const list = document.createElement('div');
    list.className = 'a11y-subfeatures';

    let rendered = 0;

    children.forEach(child => {
      if(!child || typeof child.slug !== 'string' || !child.slug || typeof child.label !== 'string' || !child.label){
        return;
      }

      const row = document.createElement('div');
      row.className = 'a11y-subfeature';

      const rowMeta = document.createElement('div');
      rowMeta.className = 'sub-meta';

      const rowLabel = document.createElement('span');
      rowLabel.className = 'label';
      rowLabel.textContent = child.label;
      rowMeta.appendChild(rowLabel);

      const switchEl = buildSwitch(child.slug, child.aria_label || child.label || '');
      if(!switchEl){
        return;
      }

      row.appendChild(rowMeta);
      row.appendChild(switchEl);
      list.appendChild(row);
      rendered++;
    });

    if(!rendered){
      return null;
    }

    article.appendChild(list);

    return article;
  }

  let dyslexiaIdCounter = 0;

  function sanitizeDyslexiaLetter(value){
    if(typeof value !== 'string'){ return ''; }
    const trimmed = value.trim();
    if(!trimmed){ return ''; }
    const first = Array.from(trimmed)[0];
    return typeof first === 'string' ? first : '';
  }

  function normalizeDyslexiaColor(value){
    if(typeof value !== 'string'){ return DYSLEXIA_DEFAULT_COLOR; }
    const trimmed = value.trim();
    const match = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if(!match){ return DYSLEXIA_DEFAULT_COLOR; }
    let digits = match[1];
    if(digits.length === 3){
      digits = digits.split('').map(ch => ch + ch).join('');
    }
    return ('#' + digits).toLowerCase();
  }

  function getDefaultCursorSettings(){
    return { size: 1, color: 'black' };
  }

  function clampCursorSize(value){
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    const fallback = getDefaultCursorSettings().size;
    if(!isFinite(numeric)){ return fallback; }
    return Math.min(CURSOR_SIZE_MAX, Math.max(CURSOR_SIZE_MIN, numeric));
  }

  function normalizeCursorColor(value){
    if(typeof value !== 'string'){ return getDefaultCursorSettings().color; }
    const key = value.toLowerCase();
    return Object.prototype.hasOwnProperty.call(CURSOR_COLORS, key) ? key : getDefaultCursorSettings().color;
  }

  function loadCursorSettings(){
    const defaults = getDefaultCursorSettings();
    try {
      const raw = localStorage.getItem(CURSOR_SETTINGS_KEY);
      if(!raw){ return Object.assign({}, defaults); }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return Object.assign({}, defaults); }
      const size = clampCursorSize(parsed.size);
      const color = normalizeCursorColor(parsed.color);
      return { size, color };
    } catch(err){
      return Object.assign({}, defaults);
    }
  }

  function persistCursorSettings(){
    const payload = {
      size: clampCursorSize(cursorSettings.size),
      color: normalizeCursorColor(cursorSettings.color),
    };
    try { localStorage.setItem(CURSOR_SETTINGS_KEY, JSON.stringify(payload)); } catch(err){ /* ignore */ }
  }

  function ensureCursorStyleElement(){
    if(cursorStyleElement && cursorStyleElement.isConnected){
      return cursorStyleElement;
    }
    const styleEl = cursorStyleElement || document.createElement('style');
    styleEl.setAttribute('data-role', 'a11y-cursor-styles');
    document.head.appendChild(styleEl);
    cursorStyleElement = styleEl;
    return cursorStyleElement;
  }

  const CURSOR_ATTR_SELECTOR = 'html[data-a11y-moteur-curseur="on"]';
  const CURSOR_CLICKABLE_SELECTORS = [
    'a',
    'button',
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="range"]',
    'select',
    'summary',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[contenteditable]'
  ];

  function getCursorPayload(settings){
    const colorKey = normalizeCursorColor(settings.color);
    const sizeMultiplier = clampCursorSize(settings.size);
    const color = CURSOR_COLORS[colorKey] || CURSOR_COLORS.black;
    const pixelSize = Math.round(CURSOR_BASE_SIZE * sizeMultiplier);
    return { colorKey, color, pixelSize, sizeMultiplier };
  }

  function buildCursorRule(svgBuilder, hotspot, payload){
    const svg = svgBuilder({
      fill: payload.color.fill,
      stroke: payload.color.stroke,
      size: payload.pixelSize,
    });
    const [x, y] = Array.isArray(hotspot) ? hotspot : [12, 12];
    return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${x} ${y}`;
  }

  function buildCursorCss(settings){
    const payload = getCursorPayload(settings);
    const defaultRule = buildCursorRule(buildCursorArrow, CURSOR_ARROW_HOTSPOT, payload);
    const interactiveRule = buildCursorRule(buildCursorPointer, CURSOR_POINTER_HOTSPOT, payload);
    if(payload.sizeMultiplier === 1 && payload.colorKey === 'black'){
      return '';
    }
    const scopeSelector = `${CURSOR_ATTR_SELECTOR} body`;
    const clickableSelectors = CURSOR_CLICKABLE_SELECTORS.map(sel => `${scopeSelector} ${sel}`);
    const sliderSelectors = [
      `${scopeSelector} .a11y-cursor__slider`,
      `${scopeSelector} .a11y-cursor__slider::-webkit-slider-thumb`,
      `${scopeSelector} .a11y-cursor__slider::-moz-range-thumb`,
      `${scopeSelector} .a11y-cursor__slider::-moz-range-track`,
      `${scopeSelector} .a11y-cursor__option`
    ];
    const interactiveSelectors = clickableSelectors.concat(sliderSelectors).join(',\n');
    return `
${CURSOR_ATTR_SELECTOR},
${scopeSelector},
${scopeSelector} * {
  cursor: ${defaultRule}, auto !important;
}
${interactiveSelectors} {
  cursor: ${interactiveRule}, pointer !important;
}
`; }

  function updateCursorStyles(){
    if(!cursorActive){
      if(cursorStyleElement){ cursorStyleElement.textContent = ''; }
      return;
    }
    const css = buildCursorCss(cursorSettings);
    if(!css){
      if(cursorStyleElement){ cursorStyleElement.textContent = ''; }
      return;
    }
    const styleEl = ensureCursorStyleElement();
    styleEl.textContent = css;
  }

  let cursorIdCounter = 0;

  function pruneCursorInstances(){
    cursorInstances.forEach(instance => {
      if(!instance){
        cursorInstances.delete(instance);
        return;
      }
      if(instance.wasConnected && (!instance.article || !instance.article.isConnected)){
        cursorInstances.delete(instance);
      }
    });
  }

  function updateCursorInstanceUI(instance){
    if(!instance){ return; }
    const { article, controls, sizeSlider, sizeValue, colorInputs, colorOptions } = instance;
    const active = cursorActive;
    if(article){
      if(article.isConnected){ instance.wasConnected = true; }
      article.classList.toggle('is-disabled', !active);
    }
    if(controls){
      controls.classList.toggle('is-disabled', !active);
      if(!active){ controls.setAttribute('aria-disabled', 'true'); }
      else { controls.removeAttribute('aria-disabled'); }
    }
    if(sizeSlider){
      sizeSlider.disabled = !active;
      setInputValue(sizeSlider, String(clampCursorSize(cursorSettings.size)));
    }
    if(sizeValue){
      const formatted = clampCursorSize(cursorSettings.size).toFixed(1).replace('.', ',');
      sizeValue.textContent = `x${formatted}`;
    }
    const currentColor = normalizeCursorColor(cursorSettings.color);
    if(Array.isArray(colorInputs)){
      colorInputs.forEach((input, index) => {
        if(!input){ return; }
        const isSelected = input.value === currentColor;
        input.disabled = !active;
        setCheckboxState(input, isSelected);
        const label = Array.isArray(colorOptions) ? colorOptions[index] : null;
        if(label){
          label.classList.toggle('is-selected', isSelected);
        }
      });
    }
  }

  function syncCursorInstances(){
    pruneCursorInstances();
    cursorInstances.forEach(instance => updateCursorInstanceUI(instance));
  }

  function setCursorSize(value, options = {}){
    const next = clampCursorSize(value);
    const changed = clampCursorSize(cursorSettings.size) !== next;
    cursorSettings.size = next;
    if(changed || options.force){
      updateCursorStyles();
      syncCursorInstances();
      if(options.persist !== false){ persistCursorSettings(); }
    } else if(options.syncOnly){
      syncCursorInstances();
    }
  }

  function setCursorColor(value, options = {}){
    const next = normalizeCursorColor(value);
    const changed = normalizeCursorColor(cursorSettings.color) !== next;
    cursorSettings.color = next;
    if(changed || options.force){
      updateCursorStyles();
      syncCursorInstances();
      if(options.persist !== false){ persistCursorSettings(); }
    } else if(options.syncOnly){
      syncCursorInstances();
    }
  }

  function resetCursorSettings(){
    cursorSettings = getDefaultCursorSettings();
    updateCursorStyles();
    syncCursorInstances();
  }

  function setCursorActive(value){
    const next = !!value;
    if(cursorActive === next){
      if(next){ updateCursorStyles(); }
      syncCursorInstances();
      return;
    }
    cursorActive = next;
    if(cursorActive){
      updateCursorStyles();
    } else if(cursorStyleElement){
      cursorStyleElement.textContent = '';
    }
    syncCursorInstances();
  }

  function loadDyslexiaSettings(){
    const defaults = { letter: '', color: DYSLEXIA_DEFAULT_COLOR, accentInclusive: false };
    try {
      const raw = localStorage.getItem(DYSLEXIA_SETTINGS_KEY);
      if(!raw){ return Object.assign({}, defaults); }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return Object.assign({}, defaults); }
      const letter = sanitizeDyslexiaLetter(typeof parsed.letter === 'string' ? parsed.letter : '');
      const color = normalizeDyslexiaColor(typeof parsed.color === 'string' ? parsed.color : DYSLEXIA_DEFAULT_COLOR);
      let accentInclusive = defaults.accentInclusive;
      const hasAccentInclusive = Object.prototype.hasOwnProperty.call(parsed, 'accentInclusive');
      if(hasAccentInclusive){
        accentInclusive = !!parsed.accentInclusive;
      } else if(Object.prototype.hasOwnProperty.call(parsed, 'accentSensitive')) {
        accentInclusive = !parsed.accentSensitive;
      }
      const result = { letter, color, accentInclusive };
      if(!hasAccentInclusive && Object.prototype.hasOwnProperty.call(parsed, 'accentSensitive')){
        try { localStorage.setItem(DYSLEXIA_SETTINGS_KEY, JSON.stringify(result)); } catch(err){ /* ignore */ }
      }
      return result;
    } catch(err){
      return Object.assign({}, defaults);
    }
  }

  function persistDyslexiaSettings(){
    const payload = {
      letter: dyslexiaSettings.letter || '',
      color: dyslexiaSettings.color || DYSLEXIA_DEFAULT_COLOR,
      accentInclusive: !!dyslexiaSettings.accentInclusive
    };
    try { localStorage.setItem(DYSLEXIA_SETTINGS_KEY, JSON.stringify(payload)); } catch(err){ /* ignore */ }
  }

  function setInputValue(input, value){
    if(input && input.value !== value){
      input.value = value;
    }
  }

  function setCheckboxState(input, checked){
    if(input && input.checked !== checked){
      input.checked = checked;
    }
  }

  function pruneDyslexiaInstances(){
    dyslexiaInstances.forEach(instance => {
      if(!instance){
        dyslexiaInstances.delete(instance);
        return;
      }
      if(instance.wasConnected && (!instance.article || !instance.article.isConnected)){
        dyslexiaInstances.delete(instance);
      }
    });
  }

  function syncDyslexiaInstances(){
    pruneDyslexiaInstances();
    dyslexiaInstances.forEach(instance => updateDyslexiaInstanceUI(instance));
  }

  function updateDyslexiaInstanceUI(instance){
    if(!instance){ return; }
    const { article, controls, letterInput, colorInput, accentInput, message, settings = {} } = instance;
    const active = dyslexiaActive;
    if(article){
      if(article.isConnected){ instance.wasConnected = true; }
      article.classList.toggle('is-disabled', !active);
    }
    if(controls){
      controls.classList.toggle('is-disabled', !active);
      if(!active){ controls.setAttribute('aria-disabled', 'true'); }
      else { controls.removeAttribute('aria-disabled'); }
    }
    if(letterInput){
      letterInput.disabled = !active;
      setInputValue(letterInput, dyslexiaSettings.letter || '');
      const placeholder = typeof settings.letter_placeholder === 'string' ? settings.letter_placeholder : '';
      if(placeholder){ letterInput.setAttribute('placeholder', placeholder); }
      else { letterInput.removeAttribute('placeholder'); }
    }
    if(colorInput){
      colorInput.disabled = !active;
      setInputValue(colorInput, dyslexiaSettings.color || DYSLEXIA_DEFAULT_COLOR);
    }
    if(accentInput){
      accentInput.disabled = !active;
      setCheckboxState(accentInput, !!dyslexiaSettings.accentInclusive);
      const accentLabel = accentInput.nextElementSibling && accentInput.nextElementSibling.matches('[data-role="dyslexie-accent-label"]')
        ? accentInput.nextElementSibling
        : null;
      if(accentLabel){
        const text = typeof settings.accent_label === 'string' ? settings.accent_label : '';
        if(text){ accentLabel.textContent = text; }
      }
    }
    if(message){
      const warning = typeof settings.no_letter_warning === 'string' ? settings.no_letter_warning : '';
      if(warning){
        message.textContent = warning;
      }
      const shouldShow = active && !dyslexiaSettings.letter && !!warning;
      message.hidden = !shouldShow;
    }
  }

  function stripDyslexiaAccents(value){
    if(typeof value !== 'string'){ return ''; }
    if(typeof value.normalize === 'function'){
      return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return value;
  }

  function dyslexiaCharMatches(char, baseLetter, normalizedLetter, accentInclusive){
    if(!char){ return false; }
    if(accentInclusive){
      const normalized = stripDyslexiaAccents(char).toLocaleLowerCase();
      return normalized === normalizedLetter;
    }
    return char.toLocaleLowerCase() === baseLetter;
  }

  function clearDyslexiaHighlights(){
    const highlights = document.querySelectorAll('.a11y-letter-highlight');
    highlights.forEach(span => {
      const parent = span.parentNode;
      if(!parent){ return; }
      const text = span.textContent || '';
      const node = document.createTextNode(text);
      parent.replaceChild(node, span);
      if(parent.normalize){ parent.normalize(); }
    });
  }

  function buildDyslexiaFragments(text, baseLetter, normalizedLetter, accentInclusive, color){
    if(!text){ return null; }
    const chars = Array.from(text);
    if(!chars.length){ return null; }
    const nodes = [];
    let buffer = '';
    let matched = false;
    chars.forEach(char => {
      if(dyslexiaCharMatches(char, baseLetter, normalizedLetter, accentInclusive)){
        matched = true;
        if(buffer){
          nodes.push(document.createTextNode(buffer));
          buffer = '';
        }
        const span = document.createElement('span');
        span.className = 'a11y-letter-highlight';
        span.textContent = char;
        span.style.setProperty('--a11y-dyslexie-color', color);
        span.style.backgroundColor = color;
        span.style.boxShadow = `0 0 0 2px ${color}`;
        nodes.push(span);
      } else {
        buffer += char;
      }
    });
    if(!matched){
      return null;
    }
    if(buffer){
      nodes.push(document.createTextNode(buffer));
    }
    return nodes;
  }

  function shouldSkipDyslexiaNode(node){
    if(!node || !node.parentNode){ return true; }
    const parent = node.parentNode;
    if(parent.nodeType !== Node.ELEMENT_NODE){ return true; }
    if(!node.nodeValue || !node.nodeValue.trim()){ return true; }
    if(parent.closest && (parent.closest('#a11y-overlay') || parent.closest('#a11y-launcher'))){
      return true;
    }
    const tag = parent.tagName;
    if(tag){
      const blacklist = ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','BUTTON','CODE','PRE','KBD','SAMP','SVG','TITLE'];
      if(blacklist.includes(tag)){ return true; }
    }
    if(parent.isContentEditable){ return true; }
    if(parent.closest && parent.closest('.a11y-letter-highlight')){ return true; }
    return false;
  }

  function applyDyslexiaHighlights(){
    clearDyslexiaHighlights();
    if(!dyslexiaActive){ return; }
    const letter = sanitizeDyslexiaLetter(dyslexiaSettings.letter || '');
    if(!letter){ return; }
    const root = document.body;
    if(!root){ return; }
    const baseLetter = letter.toLocaleLowerCase();
    const normalizedLetter = stripDyslexiaAccents(letter).toLocaleLowerCase();
    const accentInclusive = !!dyslexiaSettings.accentInclusive;
    const color = dyslexiaSettings.color || DYSLEXIA_DEFAULT_COLOR;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        return shouldSkipDyslexiaNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const replacements = [];
    while(walker.nextNode()){
      const node = walker.currentNode;
      if(!node || !node.nodeValue){ continue; }
      const fragments = buildDyslexiaFragments(node.nodeValue, baseLetter, normalizedLetter, accentInclusive, color);
      if(!fragments || !fragments.length){ continue; }
      const fragment = document.createDocumentFragment();
      fragments.forEach(part => fragment.appendChild(part));
      const parent = node.parentNode;
      if(parent){
        replacements.push({ parent, node, fragment });
      }
    }
    replacements.forEach(item => {
      if(!item.parent.isConnected){ return; }
      item.parent.replaceChild(item.fragment, item.node);
      if(item.parent.normalize){ item.parent.normalize(); }
    });
  }

  function updateDyslexiaHighlightColors(){
    const color = dyslexiaSettings.color || DYSLEXIA_DEFAULT_COLOR;
    document.querySelectorAll('.a11y-letter-highlight').forEach(span => {
      span.style.setProperty('--a11y-dyslexie-color', color);
      span.style.backgroundColor = color;
      span.style.boxShadow = `0 0 0 2px ${color}`;
    });
  }

  function setDyslexiaLetter(value){
    const sanitized = sanitizeDyslexiaLetter(value);
    const changed = dyslexiaSettings.letter !== sanitized;
    dyslexiaSettings.letter = sanitized;
    if(changed){ persistDyslexiaSettings(); }
    clearDyslexiaHighlights();
    if(dyslexiaActive && sanitized){
      applyDyslexiaHighlights();
    }
    syncDyslexiaInstances();
  }

  function setDyslexiaAccentInclusive(value){
    const next = !!value;
    const changed = !!dyslexiaSettings.accentInclusive !== next;
    dyslexiaSettings.accentInclusive = next;
    if(changed){ persistDyslexiaSettings(); }
    if(dyslexiaActive && dyslexiaSettings.letter){
      applyDyslexiaHighlights();
    }
    syncDyslexiaInstances();
  }

  function setDyslexiaColor(value){
    const normalized = normalizeDyslexiaColor(value);
    const changed = dyslexiaSettings.color !== normalized;
    dyslexiaSettings.color = normalized;
    if(changed){ persistDyslexiaSettings(); }
    updateDyslexiaHighlightColors();
    syncDyslexiaInstances();
  }

  function handleDyslexiaLetterInput(value){
    setDyslexiaLetter(value);
  }

  function handleDyslexiaColorInput(value){
    setDyslexiaColor(value);
  }

  function handleDyslexiaAccentInput(checked){
    setDyslexiaAccentInclusive(checked);
  }

  function setDyslexiaActive(active){
    const next = !!active;
    if(dyslexiaActive === next){
      if(!next){ clearDyslexiaHighlights(); }
      syncDyslexiaInstances();
      return;
    }
    dyslexiaActive = next;
    if(dyslexiaActive){
      applyDyslexiaHighlights();
      updateDyslexiaHighlightColors();
    } else {
      clearDyslexiaHighlights();
    }
    syncDyslexiaInstances();
  }

  function createDyslexiaCard(feature){
    if(!feature || typeof feature.slug !== 'string' || !feature.slug){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card a11y-card--dyslexie';
    article.setAttribute('data-role', 'feature-card');

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.setAttribute('data-role', 'feature-meta');

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = feature.label || '';
    meta.appendChild(labelEl);

    if(feature.hint){
      const hintEl = document.createElement('span');
      hintEl.className = 'hint';
      hintEl.textContent = feature.hint;
      meta.appendChild(hintEl);
    }

    const header = document.createElement('div');
    header.className = 'a11y-dyslexie__header';
    header.appendChild(meta);

    const switchEl = buildSwitch(feature.slug, feature.aria_label || feature.label || '');
    if(switchEl){
      switchEl.classList.add('a11y-dyslexie__switch');
      header.appendChild(switchEl);
    }

    article.appendChild(header);

    const controls = document.createElement('form');
    controls.className = 'a11y-dyslexie__controls';
    controls.setAttribute('data-role', 'dyslexie-controls');
    controls.addEventListener('submit', event => { event.preventDefault(); });

    const settings = feature.settings && typeof feature.settings === 'object' ? feature.settings : {};
    const texts = {
      letter_label: typeof settings.letter_label === 'string' ? settings.letter_label : '',
      letter_placeholder: typeof settings.letter_placeholder === 'string' ? settings.letter_placeholder : '',
      color_label: typeof settings.color_label === 'string' ? settings.color_label : '',
      accent_label: typeof settings.accent_label === 'string' ? settings.accent_label : '',
      no_letter_warning: typeof settings.no_letter_warning === 'string' ? settings.no_letter_warning : '',
    };

    const baseId = `a11y-dyslexie-${++dyslexiaIdCounter}`;

    const letterField = document.createElement('div');
    letterField.className = 'a11y-dyslexie__field';
    const letterLabel = document.createElement('label');
    const letterId = `${baseId}-letter`;
    letterLabel.setAttribute('for', letterId);
    letterLabel.textContent = texts.letter_label || '';
    const letterInput = document.createElement('input');
    letterInput.type = 'text';
    letterInput.id = letterId;
    letterInput.className = 'a11y-dyslexie__input';
    letterInput.autocomplete = 'off';
    letterInput.inputMode = 'text';
    letterInput.maxLength = 2;
    letterInput.setAttribute('aria-describedby', `${baseId}-message`);
    letterField.appendChild(letterLabel);
    letterField.appendChild(letterInput);
    controls.appendChild(letterField);

    const colorField = document.createElement('div');
    colorField.className = 'a11y-dyslexie__field';
    const colorLabel = document.createElement('label');
    const colorId = `${baseId}-color`;
    colorLabel.setAttribute('for', colorId);
    colorLabel.textContent = texts.color_label || '';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = colorId;
    colorInput.className = 'a11y-dyslexie__input a11y-dyslexie__input--color';
    colorField.appendChild(colorLabel);
    colorField.appendChild(colorInput);
    controls.appendChild(colorField);

    const accentField = document.createElement('div');
    accentField.className = 'a11y-dyslexie__field a11y-dyslexie__field--checkbox';
    const accentLabel = document.createElement('label');
    accentLabel.className = 'a11y-dyslexie__checkbox';
    const accentInput = document.createElement('input');
    accentInput.type = 'checkbox';
    accentInput.id = `${baseId}-accent`;
    accentInput.className = 'a11y-dyslexie__checkbox-input';
    const accentText = document.createElement('span');
    accentText.setAttribute('data-role', 'dyslexie-accent-label');
    accentText.textContent = texts.accent_label || '';
    accentLabel.appendChild(accentInput);
    accentLabel.appendChild(accentText);
    accentField.appendChild(accentLabel);
    controls.appendChild(accentField);

    const message = document.createElement('p');
    message.className = 'a11y-dyslexie__message';
    message.id = `${baseId}-message`;
    message.hidden = true;
    if(texts.no_letter_warning){
      message.textContent = texts.no_letter_warning;
    }
    controls.appendChild(message);

    article.appendChild(controls);

    const instance = {
      article,
      controls,
      letterInput,
      colorInput,
      accentInput,
      message,
      settings: texts,
      wasConnected: false,
    };

    dyslexiaInstances.add(instance);
    syncDyslexiaInstances();

    letterInput.addEventListener('input', () => handleDyslexiaLetterInput(letterInput.value));
    letterInput.addEventListener('change', () => handleDyslexiaLetterInput(letterInput.value));
    colorInput.addEventListener('input', () => handleDyslexiaColorInput(colorInput.value));
    colorInput.addEventListener('change', () => handleDyslexiaColorInput(colorInput.value));
    accentInput.addEventListener('change', () => handleDyslexiaAccentInput(accentInput.checked));

    const markConnection = () => {
      if(instance.article && instance.article.isConnected){
        instance.wasConnected = true;
      }
    };
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(markConnection);
    } else {
      setTimeout(markConnection, 0);
    }

    return article;
  }

  function createCursorCard(feature){
    if(!feature || typeof feature.slug !== 'string' || !feature.slug){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card a11y-card--cursor';
    article.setAttribute('data-role', 'feature-card');

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.setAttribute('data-role', 'feature-meta');

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = feature.label || '';
    meta.appendChild(labelEl);

    if(feature.hint){
      const hintEl = document.createElement('span');
      hintEl.className = 'hint';
      hintEl.textContent = feature.hint;
      meta.appendChild(hintEl);
    }

    const header = document.createElement('div');
    header.className = 'a11y-cursor__header';
    header.appendChild(meta);

    const switchEl = buildSwitch(feature.slug, feature.aria_label || feature.label || '');
    if(switchEl){
      switchEl.classList.add('a11y-cursor__switch');
      header.appendChild(switchEl);
    }

    article.appendChild(header);

    const controls = document.createElement('form');
    controls.className = 'a11y-cursor__controls';
    controls.setAttribute('data-role', 'cursor-controls');
    controls.addEventListener('submit', event => { event.preventDefault(); });

    const settings = feature.settings && typeof feature.settings === 'object' ? feature.settings : {};
    const texts = {
      size_label: typeof settings.size_label === 'string' ? settings.size_label : '',
      size_help: typeof settings.size_help === 'string' ? settings.size_help : '',
      color_label: typeof settings.color_label === 'string' ? settings.color_label : '',
      color_help: typeof settings.color_help === 'string' ? settings.color_help : '',
    };

    const baseId = `a11y-cursor-${++cursorIdCounter}`;

    const sizeField = document.createElement('div');
    sizeField.className = 'a11y-cursor__field';
    const sizeLabel = document.createElement('label');
    sizeLabel.setAttribute('for', `${baseId}-size`);
    sizeLabel.className = 'a11y-cursor__label';
    sizeLabel.textContent = texts.size_label || '';
    sizeLabel.appendChild(document.createTextNode(' '));
    const sizeValue = document.createElement('span');
    sizeValue.className = 'a11y-cursor__value';
    sizeLabel.appendChild(sizeValue);
    sizeField.appendChild(sizeLabel);

    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.id = `${baseId}-size`;
    sizeSlider.className = 'a11y-cursor__slider';
    sizeSlider.min = String(CURSOR_SIZE_MIN);
    sizeSlider.max = String(CURSOR_SIZE_MAX);
    sizeSlider.step = String(CURSOR_SIZE_STEP);
    sizeSlider.value = String(clampCursorSize(cursorSettings.size));
    sizeField.appendChild(sizeSlider);

    if(texts.size_help){
      const sizeHelp = document.createElement('p');
      sizeHelp.className = 'a11y-cursor__help';
      sizeHelp.textContent = texts.size_help;
      sizeField.appendChild(sizeHelp);
    }

    controls.appendChild(sizeField);

    const colorField = document.createElement('fieldset');
    colorField.className = 'a11y-cursor__field';
    const colorLegend = document.createElement('legend');
    colorLegend.className = 'a11y-cursor__label';
    colorLegend.textContent = texts.color_label || '';
    colorField.appendChild(colorLegend);

    const colorChoices = document.createElement('div');
    colorChoices.className = 'a11y-cursor__choices a11y-cursor__choices--colors';
    const colorInputs = [];
    const colorOptions = [];
    Object.keys(CURSOR_COLORS).forEach(colorKey => {
      const colorData = CURSOR_COLORS[colorKey];
      const colorId = `${baseId}-color-${colorKey}`;
      const optionLabel = document.createElement('label');
      optionLabel.className = 'a11y-cursor__option a11y-cursor__option--color';
      optionLabel.setAttribute('for', colorId);
      optionLabel.style.setProperty('--a11y-cursor-option-color', colorData ? colorData.fill : '#000000');
      optionLabel.style.setProperty('--a11y-cursor-option-stroke', colorData ? colorData.stroke : '#ffffff');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'a11y-cursor__radio';
      radio.name = `${baseId}-color`;
      radio.id = colorId;
      radio.value = colorKey;
      const swatch = document.createElement('span');
      swatch.className = 'a11y-cursor__swatch';
      const text = document.createElement('span');
      text.className = 'a11y-cursor__option-text';
      text.textContent = colorData && colorData.label ? colorData.label : colorKey;
      optionLabel.appendChild(radio);
      optionLabel.appendChild(swatch);
      optionLabel.appendChild(text);
      colorChoices.appendChild(optionLabel);
      colorInputs.push(radio);
      colorOptions.push(optionLabel);
    });
    colorField.appendChild(colorChoices);

    if(texts.color_help){
      const colorHelp = document.createElement('p');
      colorHelp.className = 'a11y-cursor__help';
      colorHelp.textContent = texts.color_help;
      colorField.appendChild(colorHelp);
    }

    controls.appendChild(colorField);

    article.appendChild(controls);

    const instance = {
      article,
      controls,
      sizeSlider,
      sizeValue,
      colorInputs,
      colorOptions,
      wasConnected: false,
    };

    cursorInstances.add(instance);
    syncCursorInstances();

    sizeSlider.addEventListener('input', () => setCursorSize(sizeSlider.value, { persist: false }));
    sizeSlider.addEventListener('change', () => setCursorSize(sizeSlider.value, { force: true }));
    colorInputs.forEach(input => {
      input.addEventListener('change', () => { if(input.checked){ setCursorColor(input.value); } });
    });

    const markConnection = () => {
      if(instance.article && instance.article.isConnected){
        instance.wasConnected = true;
      }
    };
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(markConnection);
    } else {
      setTimeout(markConnection, 0);
    }

    return article;
  }

  function getDefaultButtonSettings(){
    return { size: 1, theme: 'default' };
  }

  function clampButtonSize(value){
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    const fallback = getDefaultButtonSettings().size;
    if(!isFinite(numeric)){ return fallback; }
    return Math.min(BUTTONS_SIZE_MAX, Math.max(BUTTONS_SIZE_MIN, numeric));
  }

  function normalizeButtonTheme(value){
    if(typeof value !== 'string'){ return getDefaultButtonSettings().theme; }
    const key = value.toLowerCase();
    return BUTTONS_THEME_BY_KEY.has(key) ? key : getDefaultButtonSettings().theme;
  }

  function loadButtonSettings(){
    const defaults = getDefaultButtonSettings();
    try {
      const raw = localStorage.getItem(BUTTONS_SETTINGS_KEY);
      if(!raw){ return Object.assign({}, defaults); }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return Object.assign({}, defaults); }
      const size = clampButtonSize(parsed.size);
      const theme = normalizeButtonTheme(parsed.theme);
      return { size, theme };
    } catch(err){
      return Object.assign({}, defaults);
    }
  }

  function persistButtonSettings(){
    const defaults = getDefaultButtonSettings();
    const size = clampButtonSize(buttonSettings.size);
    const theme = normalizeButtonTheme(buttonSettings.theme);
    if(size === defaults.size && theme === defaults.theme){
      try { localStorage.removeItem(BUTTONS_SETTINGS_KEY); } catch(err){ /* ignore */ }
      return;
    }
    const payload = { size, theme };
    try { localStorage.setItem(BUTTONS_SETTINGS_KEY, JSON.stringify(payload)); } catch(err){ /* ignore */ }
  }

  function ensureButtonStyleElement(){
    if(buttonStyleElement && buttonStyleElement.isConnected){
      return buttonStyleElement;
    }
    const styleEl = buttonStyleElement || document.createElement('style');
    styleEl.setAttribute('data-role', 'a11y-button-styles');
    document.head.appendChild(styleEl);
    buttonStyleElement = styleEl;
    return buttonStyleElement;
  }

  function formatButtonSize(value){
    const numeric = clampButtonSize(value);
    return `x${numeric.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')}`;
  }

  function buildButtonCss(settings){
    if(!BUTTONS_TARGET_LIST.length){ return ''; }
    const defaults = getDefaultButtonSettings();
    const size = clampButtonSize(settings.size);
    const themeKey = normalizeButtonTheme(settings.theme);
    const theme = BUTTONS_THEME_BY_KEY.get(themeKey) || BUTTONS_THEME_BY_KEY.get(defaults.theme) || BUTTONS_THEMES[0];
    const scopedTargets = BUTTONS_TARGET_LIST.map(selector => `${BUTTONS_ATTR_SELECTOR} ${selector}`);
    const scopedInside = BUTTONS_INSIDE_LIST.map(selector => `${BUTTONS_ATTR_SELECTOR} ${selector}`);
    const cssParts = [];

    if(size > defaults.size){
      const formatted = size.toFixed(2).replace(/\.0+$/, '').replace(/\.([1-9])0$/, '.$1');
      cssParts.push(`${scopedTargets.join(',\n')} { font-size: calc(1em * ${formatted}) !important; padding: calc(0.8em * ${formatted}) calc(1.5em * ${formatted}) !important; }`);
    }

    if(theme && theme.colors && themeKey !== defaults.theme){
      const bg = theme.colors.bg || '#000000';
      const text = theme.colors.text || '#ffffff';
      const border = theme.colors.border || bg;
      cssParts.push(`${scopedTargets.join(',\n')} { background-color: ${bg} !important; color: ${text} !important; border-color: ${border} !important; }`);
      if(scopedInside.length){
        cssParts.push(`${scopedInside.join(',\n')} { color: ${text} !important; fill: ${text} !important; }`);
      }
    }

    return cssParts.join('\n');
  }

  function updateButtonStyles(){
    if(!buttonActive){
      if(buttonStyleElement){ buttonStyleElement.textContent = ''; }
      return;
    }
    const css = buildButtonCss(buttonSettings);
    if(!css){
      if(buttonStyleElement){ buttonStyleElement.textContent = ''; }
      return;
    }
    const styleEl = ensureButtonStyleElement();
    styleEl.textContent = css;
  }

  function pruneButtonInstances(){
    buttonInstances.forEach(instance => {
      if(!instance){
        buttonInstances.delete(instance);
        return;
      }
      if(instance.wasConnected && (!instance.article || !instance.article.isConnected)){
        buttonInstances.delete(instance);
      }
    });
  }

  function getButtonThemeIndex(themeKey){
    const normalized = normalizeButtonTheme(themeKey);
    const index = BUTTONS_THEMES.findIndex(theme => theme.key === normalized);
    return index === -1 ? 0 : index;
  }

  function getButtonTheme(themeKey){
    const normalized = normalizeButtonTheme(themeKey);
    return BUTTONS_THEME_BY_KEY.get(normalized) || BUTTONS_THEMES[0];
  }

  function updateButtonInstanceUI(instance){
    if(!instance){ return; }
    const { article, controls, sizeSlider, sizeValue, themeName, prevBtn, nextBtn, resetBtn } = instance;
    const active = buttonActive;
    const theme = getButtonTheme(buttonSettings.theme);

    if(article){
      if(article.isConnected){ instance.wasConnected = true; }
      article.classList.toggle('is-disabled', !active);
    }

    if(controls){
      controls.classList.toggle('is-disabled', !active);
      if(!active){ controls.setAttribute('aria-disabled', 'true'); }
      else { controls.removeAttribute('aria-disabled'); }
    }

    if(sizeSlider){
      sizeSlider.disabled = !active;
      setInputValue(sizeSlider, String(clampButtonSize(buttonSettings.size)));
    }

    if(sizeValue){
      sizeValue.textContent = formatButtonSize(buttonSettings.size);
    }

    if(themeName){
      themeName.textContent = theme && theme.name ? theme.name : normalizeButtonTheme(buttonSettings.theme);
    }

    const disableControls = !active;
    if(prevBtn){ prevBtn.disabled = disableControls; }
    if(nextBtn){ nextBtn.disabled = disableControls; }
    if(resetBtn){ resetBtn.disabled = disableControls; }
  }

  function syncButtonInstances(){
    pruneButtonInstances();
    buttonInstances.forEach(instance => updateButtonInstanceUI(instance));
  }

  function setButtonSize(value, options = {}){
    const next = clampButtonSize(value);
    const changed = clampButtonSize(buttonSettings.size) !== next;
    buttonSettings.size = next;
    if(changed || options.force){
      updateButtonStyles();
      syncButtonInstances();
      if(options.persist !== false){ persistButtonSettings(); }
    } else if(options.syncOnly){
      syncButtonInstances();
    }
  }

  function setButtonTheme(value, options = {}){
    const next = normalizeButtonTheme(value);
    const changed = normalizeButtonTheme(buttonSettings.theme) !== next;
    buttonSettings.theme = next;
    if(changed || options.force){
      updateButtonStyles();
      syncButtonInstances();
      if(options.persist !== false){ persistButtonSettings(); }
    } else if(options.syncOnly){
      syncButtonInstances();
    }
  }

  function cycleButtonTheme(direction){
    if(!BUTTONS_THEMES.length){ return; }
    const step = direction >= 0 ? 1 : -1;
    const currentIndex = getButtonThemeIndex(buttonSettings.theme);
    const total = BUTTONS_THEMES.length;
    const nextIndex = (currentIndex + step + total) % total;
    setButtonTheme(BUTTONS_THEMES[nextIndex].key);
  }

  function resetButtonSettings(options = {}){
    buttonSettings = getDefaultButtonSettings();
    updateButtonStyles();
    syncButtonInstances();
    if(options.persist !== false){
      persistButtonSettings();
    }
  }

  function setButtonActive(value){
    const next = !!value;
    if(buttonActive === next){
      if(next){ updateButtonStyles(); }
      syncButtonInstances();
      return;
    }
    buttonActive = next;
    if(buttonActive){
      ensureButtonStyleElement();
      updateButtonStyles();
    } else if(buttonStyleElement){
      buttonStyleElement.textContent = '';
    }
    syncButtonInstances();
  }

  function createButtonCard(feature){
    if(!feature || typeof feature.slug !== 'string' || !feature.slug){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card a11y-card--buttons';
    article.setAttribute('data-role', 'feature-card');

    const header = document.createElement('div');
    header.className = 'a11y-buttons__header';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.setAttribute('data-role', 'feature-meta');

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = feature.label || '';
    meta.appendChild(labelEl);

    if(feature.hint){
      const hintEl = document.createElement('span');
      hintEl.className = 'hint';
      hintEl.textContent = feature.hint;
      meta.appendChild(hintEl);
    }

    header.appendChild(meta);

    const switchEl = buildSwitch(feature.slug, feature.aria_label || feature.label || '');
    if(switchEl){
      switchEl.classList.add('a11y-buttons__switch');
      header.appendChild(switchEl);
    }

    article.appendChild(header);

    const controls = document.createElement('form');
    controls.className = 'a11y-buttons__controls';
    controls.setAttribute('data-role', 'buttons-controls');
    controls.addEventListener('submit', event => { event.preventDefault(); });

    const settings = feature.settings && typeof feature.settings === 'object' ? feature.settings : {};
    const texts = {
      size_label: typeof settings.size_label === 'string' ? settings.size_label : '',
      size_help: typeof settings.size_help === 'string' ? settings.size_help : '',
      theme_label: typeof settings.theme_label === 'string' ? settings.theme_label : '',
      theme_help: typeof settings.theme_help === 'string' ? settings.theme_help : '',
      theme_prev: typeof settings.theme_prev === 'string' ? settings.theme_prev : '',
      theme_next: typeof settings.theme_next === 'string' ? settings.theme_next : '',
      reset_label: typeof settings.reset_label === 'string' ? settings.reset_label : '',
    };

    const baseId = `a11y-buttons-${++buttonIdCounter}`;

    const sizeField = document.createElement('div');
    sizeField.className = 'a11y-buttons__field';
    const sizeLabel = document.createElement('label');
    sizeLabel.setAttribute('for', `${baseId}-size`);
    sizeLabel.className = 'a11y-buttons__label';
    sizeLabel.textContent = texts.size_label || '';
    sizeLabel.appendChild(document.createTextNode(' '));
    const sizeValue = document.createElement('span');
    sizeValue.className = 'a11y-buttons__value';
    sizeLabel.appendChild(sizeValue);
    sizeField.appendChild(sizeLabel);

    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.id = `${baseId}-size`;
    sizeSlider.className = 'a11y-buttons__slider';
    sizeSlider.min = String(BUTTONS_SIZE_MIN);
    sizeSlider.max = String(BUTTONS_SIZE_MAX);
    sizeSlider.step = String(BUTTONS_SIZE_STEP);
    sizeSlider.value = String(clampButtonSize(buttonSettings.size));
    sizeField.appendChild(sizeSlider);

    if(texts.size_help){
      const sizeHelp = document.createElement('p');
      sizeHelp.className = 'a11y-buttons__help';
      sizeHelp.textContent = texts.size_help;
      sizeField.appendChild(sizeHelp);
    }

    controls.appendChild(sizeField);

    const themeField = document.createElement('div');
    themeField.className = 'a11y-buttons__field';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'a11y-buttons__label';
    themeLabel.textContent = texts.theme_label || '';
    themeField.appendChild(themeLabel);

    const themeControls = document.createElement('div');
    themeControls.className = 'a11y-buttons__themes';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'a11y-buttons__theme-button a11y-buttons__theme-button--prev';
    const prevLabel = texts.theme_prev || 'Thème précédent';
    prevBtn.setAttribute('aria-label', prevLabel);
    prevBtn.title = prevLabel;
    prevBtn.innerHTML = '<span aria-hidden="true">◀</span>';
    themeControls.appendChild(prevBtn);

    const themeName = document.createElement('span');
    themeName.className = 'a11y-buttons__theme-name';
    themeControls.appendChild(themeName);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'a11y-buttons__theme-button a11y-buttons__theme-button--next';
    const nextLabel = texts.theme_next || 'Thème suivant';
    nextBtn.setAttribute('aria-label', nextLabel);
    nextBtn.title = nextLabel;
    nextBtn.innerHTML = '<span aria-hidden="true">▶</span>';
    themeControls.appendChild(nextBtn);

    themeField.appendChild(themeControls);

    if(texts.theme_help){
      const themeHelp = document.createElement('p');
      themeHelp.className = 'a11y-buttons__help';
      themeHelp.textContent = texts.theme_help;
      themeField.appendChild(themeHelp);
    }

    controls.appendChild(themeField);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'a11y-buttons__reset';
    const resetLabel = texts.reset_label || 'Réinitialiser';
    resetBtn.textContent = resetLabel;
    resetBtn.setAttribute('aria-label', resetLabel);
    controls.appendChild(resetBtn);

    article.appendChild(controls);

    const instance = {
      article,
      controls,
      sizeSlider,
      sizeValue,
      themeName,
      prevBtn,
      nextBtn,
      resetBtn,
      wasConnected: false,
    };

    buttonInstances.add(instance);
    syncButtonInstances();

    sizeSlider.addEventListener('input', () => setButtonSize(sizeSlider.value, { persist: false }));
    sizeSlider.addEventListener('change', () => setButtonSize(sizeSlider.value, { force: true }));
    prevBtn.addEventListener('click', () => cycleButtonTheme(-1));
    nextBtn.addEventListener('click', () => cycleButtonTheme(1));
    resetBtn.addEventListener('click', () => resetButtonSettings());

    const markConnection = () => {
      if(instance.article && instance.article.isConnected){
        instance.wasConnected = true;
      }
    };
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(markConnection);
    } else {
      setTimeout(markConnection, 0);
    }

    return article;
  }

  function createCustomFeature(feature){
    const template = typeof feature.template === 'string' ? feature.template : '';
    if(template === 'dyslexie-highlighter'){
      return createDyslexiaCard(feature);
    }
    if(template === 'button-settings'){
      return createButtonCard(feature);
    }
    if(template === 'cursor-settings'){
      return createCursorCard(feature);
    }
    return createFeaturePlaceholder(feature);
  }

  function normalizeString(value){
    if(typeof value !== 'string'){ return ''; }
    const normalized = typeof value.normalize === 'function' ? value.normalize('NFD') : value;
    return normalized.replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function normalizeSearchQuery(value){
    return normalizeString(value).replace(/\s+/g, ' ').trim();
  }

  function matchesText(value, normalizedQuery){
    if(!normalizedQuery || typeof value !== 'string'){ return false; }
    return normalizeString(value).includes(normalizedQuery);
  }

  function annotateSearchInstance(instance, sectionTitle){
    if(!instance || !searchList){ return; }
    const cardEl = instance instanceof DocumentFragment
      ? instance.querySelector('[data-role="feature-card"]')
      : instance;
    if(cardEl){
      cardEl.classList.add('is-search-match');
      if(sectionTitle){
        const meta = cardEl.querySelector('[data-role="feature-meta"]');
        if(meta){
          const badge = document.createElement('span');
          badge.className = 'context';
          badge.textContent = sectionTitle;
          meta.insertBefore(badge, meta.firstChild || null);
        }
      }
    }
    searchList.appendChild(instance);
  }

  function renderSearchResults(normalizedQuery){
    if(!searchList){ return; }
    searchList.innerHTML = '';
    if(searchEmpty){ searchEmpty.hidden = true; }
    if(!normalizedQuery){ return; }
    let total = 0;
    sectionsData.forEach(section => {
      if(!section){ return; }
      const sectionTitle = typeof section.title === 'string' ? section.title : '';
      const sectionSlug = typeof section.slug === 'string' ? section.slug : '';
      const sectionMatches = matchesText(sectionTitle, normalizedQuery) || matchesText(sectionSlug, normalizedQuery);
      const features = Array.isArray(section.features) ? section.features : [];
      features.forEach(feature => {
        if(!feature){ return; }
        const hasChildren = Array.isArray(feature.children) && feature.children.length;
        const featureMatches = sectionMatches
          || matchesText(feature.label, normalizedQuery)
          || matchesText(feature.hint, normalizedQuery)
          || matchesText(feature.aria_label, normalizedQuery)
          || matchesText(feature.slug, normalizedQuery);
        let instance = null;
        if(hasChildren){
          const matchingChildren = feature.children.filter(child => {
            return matchesText(child.label, normalizedQuery)
              || matchesText(child.hint, normalizedQuery)
              || matchesText(child.aria_label, normalizedQuery)
              || matchesText(child.slug, normalizedQuery);
          });
          if(featureMatches){
            instance = createFeatureGroup(feature);
          } else if(matchingChildren.length){
            const subset = Object.assign({}, feature, { children: matchingChildren });
            instance = createFeatureGroup(subset);
          }
        } else if(featureMatches){
          instance = createCustomFeature(feature);
        }
        if(instance){
          annotateSearchInstance(instance, sectionTitle);
          total++;
        }
      });
    });
    if(total === 0 && searchEmpty){
      searchEmpty.hidden = false;
    }
  }

  function isSearchActive(){
    return !!(panel && panel.classList.contains('is-searching'));
  }

  function pruneDetachedFeatureInputs(){
    featureInputs.forEach((input, key) => {
      if(!input || !input.isConnected){
        featureInputs.delete(key);
      }
    });
  }

  function disableSearchMode(options = {}){
    const { keepInput = false } = options;
    if(!isSearchActive() && !searchQuery){
      if(!keepInput && searchInput){ searchInput.value = ''; }
      return;
    }
    if(panel){
      panel.classList.remove('is-searching');
    }
    if(tablist){
      tablist.removeAttribute('hidden');
      tablist.removeAttribute('aria-hidden');
    }
    if(searchResults){
      searchResults.hidden = true;
      searchResults.setAttribute('aria-hidden', 'true');
    }
    if(searchList){ searchList.innerHTML = ''; }
    if(searchEmpty){ searchEmpty.hidden = true; }
    if(!keepInput && searchInput){ searchInput.value = ''; }
    pruneDetachedFeatureInputs();
    pruneDyslexiaInstances();
    pruneCursorInstances();
    const sectionsToRefresh = Array.from(renderedSections);
    sectionsToRefresh.forEach(sectionId => renderSection(sectionId));
    searchQuery = '';
  }

  function enterSearchMode(normalizedQuery){
    if(!panel){ return; }
    panel.classList.add('is-searching');
    if(tablist){
      tablist.setAttribute('aria-hidden', 'true');
      tablist.setAttribute('hidden', '');
    }
    if(searchResults){
      searchResults.hidden = false;
      searchResults.setAttribute('aria-hidden', 'false');
    }
    renderSearchResults(normalizedQuery);
  }

  function getPanelParts(sectionId){
    if(!sectionId){ return null; }
    return panelPartsBySection.get(sectionId) || null;
  }

  function renderSection(sectionId){
    const parts = getPanelParts(sectionId);
    if(!parts){ return; }
    const { panel, grid, empty } = parts;
    if(!grid){ return; }
    clearFeatureGrid(grid);
    if(panel){ panel.setAttribute('data-active-section', sectionId || ''); }
    const section = sectionId ? sectionsById.get(sectionId) : null;
    const features = section && Array.isArray(section.features) ? section.features : [];
    if(!features.length){
      if(empty){ empty.hidden = false; }
      if(sectionId){ renderedSections.delete(sectionId); }
      return;
    }
    const fragment = document.createDocumentFragment();
    let renderedCount = 0;
    features.forEach(feature => {
      if(!feature || typeof feature.label !== 'string' || !feature.label){
        return;
      }

      const hasChildren = Array.isArray(feature.children) && feature.children.length;
      let instance = null;

      if(hasChildren){
        instance = createFeatureGroup(feature);
      } else {
        if(typeof feature.slug !== 'string' || !feature.slug){
          return;
        }
        const template = typeof feature.template === 'string' ? feature.template : '';
        if(template){
          instance = createCustomFeature(feature);
        } else {
          instance = createFeaturePlaceholder(feature);
        }
      }

      if(instance){
        fragment.appendChild(instance);
        renderedCount++;
      }
    });
    if(renderedCount){
      if(empty){ empty.hidden = true; }
      grid.appendChild(fragment);
      if(sectionId){ renderedSections.add(sectionId); }
    } else if(empty){
      empty.hidden = false;
      if(sectionId){ renderedSections.delete(sectionId); }
    }
  }

  function focusTab(tab){
    if(tab && tab.focus){ tab.focus(); }
  }

  function collapseSection(triggerTab){
    const fallback = triggerTab || tabs[0] || null;
    activeSectionId = null;
    tabs.forEach(item => {
      const isFallback = item === fallback;
      item.setAttribute('aria-selected', 'false');
      item.classList.remove('is-active');
      item.setAttribute('tabindex', isFallback ? '0' : '-1');
    });
    panelPartsBySection.forEach(({ panel }) => {
      if(!panel) return;
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.removeAttribute('aria-labelledby');
      panel.removeAttribute('data-active-section');
    });
    if(triggerTab){ focusTab(triggerTab); }
  }

  function setActiveTab(tab, opts={}){
    if(!tab){
      collapseSection(null);
      return;
    }
    const sectionId = tab.dataset.sectionId || '';
    const changed = sectionId !== activeSectionId;
    activeSectionId = sectionId;
    const activeParts = getPanelParts(sectionId);
    tabs.forEach(item => {
      const isActive = item === tab;
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      item.setAttribute('tabindex', isActive ? '0' : '-1');
      item.classList.toggle('is-active', isActive);
    });
    panelPartsBySection.forEach(({ panel }) => {
      if(!panel) return;
      const isActive = panel.dataset.sectionId === sectionId;
      if(isActive){
        panel.hidden = false;
        panel.setAttribute('aria-hidden', 'false');
        if(tab.id){ panel.setAttribute('aria-labelledby', tab.id); }
        else { panel.removeAttribute('aria-labelledby'); }
        panel.setAttribute('data-active-section', sectionId || '');
      } else {
        panel.hidden = true;
        panel.setAttribute('aria-hidden', 'true');
        panel.removeAttribute('aria-labelledby');
        panel.removeAttribute('data-active-section');
      }
    });
    if(opts.focus){ focusTab(tab); }
    if(activeParts){
      const { grid } = activeParts;
      if(changed || !grid || !grid.children.length){
        renderSection(sectionId);
      }
    }
  }

  function getNextTab(current, delta){
    if(!tabs.length){ return null; }
    const index = tabs.indexOf(current);
    if(index === -1){ return tabs[0]; }
    const nextIndex = (index + delta + tabs.length) % tabs.length;
    return tabs[nextIndex];
  }

  function handleTabKeydown(event, tab){
    if(!tab){ return; }
    let target = null;
    switch(event.key){
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        target = getNextTab(tab, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        target = getNextTab(tab, -1);
        break;
      case 'Home':
        event.preventDefault();
        target = tabs[0];
        break;
      case 'End':
        event.preventDefault();
        target = tabs[tabs.length - 1];
        break;
      default:
        return;
    }
    if(target){ setActiveTab(target, { focus: true }); }
  }

  function setupSectionNavigation(){
    if(!tabs.length){
      panelPartsBySection.forEach(({ empty }) => {
        if(empty){ empty.hidden = false; }
      });
      return;
    }
    const defaultSectionId = tabs.length ? (tabs[0].dataset.sectionId || '') : '';
    panelPartsBySection.forEach(({ panel }) => {
      if(!panel) return;
      if(panel.hidden !== true && panel.dataset.sectionId !== defaultSectionId){
        panel.hidden = true;
        panel.setAttribute('aria-hidden','true');
      }
    });
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const sectionId = tab.dataset.sectionId || '';
        if(activeSectionId === sectionId){
          collapseSection(tab);
        } else {
          setActiveTab(tab);
        }
      });
      tab.addEventListener('keydown', event => handleTabKeydown(event, tab));
    });
    const initiallySelected = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    if(initiallySelected){
      setActiveTab(initiallySelected);
    }
  }

  // ---------- Focus trap ----------
  let lastFocused = null;
  function openPanel(){
    lastFocused = document.activeElement;
    overlay.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    btn.setAttribute('aria-expanded','true');
    // focus premier focusable
    const focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    for (const el of focusables){ if(!el.hasAttribute('disabled') && el.offsetParent !== null){ el.focus(); break; } }
    overlay.addEventListener('keydown', trap, true);
  }
  function closePanel(){
    disableSearchMode();
    overlay.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    btn.setAttribute('aria-expanded','false');
    overlay.removeEventListener('keydown', trap, true);
    if(lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function trap(e){
    if(e.key === 'Escape'){ e.preventDefault(); closePanel(); return; }
    if(e.key !== 'Tab') return;
    const focusables = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el=>!el.hasAttribute('disabled') && el.offsetParent !== null);
    if(!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }

  // ---------- Persistance ----------
  function loadStoredState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){ return {}; }
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch(err){
      return {};
    }
  }

  function persist(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(featureState)); } catch(err){ /* ignore */ }
  }

  function applyStoredState(){
    for(const key in featureState){
      if(Object.prototype.hasOwnProperty.call(featureState, key)){
        toggleFeature(key, !!featureState[key], { silent: true });
      }
    }
  }

  // ---------- Core toggle ----------
  function toggleFeature(key, on, opts={}){
    const attr = 'a11y' + dashToCamel(key);
    if(on) document.documentElement.dataset[attr] = 'on';
    else delete document.documentElement.dataset[attr];

    const ev = new CustomEvent('a11y:toggle', { detail: { key, on } });
    window.dispatchEvent(ev);

    const set = listeners.get(key);
    if(set) for(const fn of set) try { fn(on, key); } catch(e){}

    if(on){
      featureState[key] = true;
    } else {
      delete featureState[key];
    }

    if(opts.syncInput !== false){
      const input = featureInputs.get(key);
      if(input && input.checked !== on){
        input.checked = on;
      }
    }

    if(!opts.silent) persist();
  }

  // ---------- Wiring ----------
  A11yAPI.registerFeature(DYSLEXIA_SLUG, on => {
    setDyslexiaActive(on);
  });

  A11yAPI.registerFeature(BUTTONS_SLUG, on => {
    if(on){ ensureButtonStyleElement(); }
    setButtonActive(on);
  });

  A11yAPI.registerFeature(CURSOR_SLUG, on => {
    if(on){ ensureCursorStyleElement(); }
    setCursorActive(on);
  });

  applyPanelSide(loadPanelSide());
  applyStoredState();
  setupSectionNavigation();

  if(searchForm){
    searchForm.addEventListener('submit', event => {
      event.preventDefault();
    });
  }
  if(searchInput){
    const handleSearchInput = () => {
      const rawValue = searchInput.value || '';
      const normalized = normalizeSearchQuery(rawValue);
      if(!normalized){
        searchQuery = '';
        disableSearchMode({ keepInput: rawValue.length > 0 });
        return;
      }
      searchQuery = normalized;
      enterSearchMode(normalized);
    };
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('search', handleSearchInput);
  }

  if(btn){
    btn.addEventListener('click', (e)=>{
      if(skipNextClick){
        e.preventDefault();
        e.stopImmediatePropagation();
        skipNextClick = false;
        return;
      }
      openPanel();
    });

    if(supportsPointer){
      btn.addEventListener('pointerdown', onPointerDown);
      btn.addEventListener('pointermove', onPointerMove);
      btn.addEventListener('pointerup', onPointerUp);
      btn.addEventListener('pointercancel', onPointerUp);
    } else {
      btn.addEventListener('touchstart', onTouchStart, { passive: false });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    }
  }
  if(overlay){
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closePanel(); });
  }
  if(closeBtn){ closeBtn.addEventListener('click', closePanel); }
  if(closeBtn2){ closeBtn2.addEventListener('click', closePanel); }
  if(sideToggleBtn){
    sideToggleBtn.addEventListener('click', () => {
      const next = panelSide === 'left' ? 'right' : 'left';
      applyPanelSide(next);
      persistPanelSide(next);
    });
  }
  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      const keys = new Set([...featureInputs.keys(), ...Object.keys(featureState)]);
      keys.forEach(key => toggleFeature(key, false));
      featureInputs.forEach(input => { input.checked = false; });
      featureState = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch(err){}
      try { localStorage.removeItem(LAUNCHER_POS_KEY); } catch(err){}
      try { localStorage.removeItem(PANEL_SIDE_KEY); } catch(err){}
      try { localStorage.removeItem(BUTTONS_SETTINGS_KEY); } catch(err){}
      try { localStorage.removeItem(CURSOR_SETTINGS_KEY); } catch(err){}
      document.documentElement.style.removeProperty('--a11y-launcher-x');
      document.documentElement.style.removeProperty('--a11y-launcher-y');
      launcherLastPos = null;
      hasCustomLauncherPosition = false;
      applyPanelSide('right');
      resetButtonSettings({ persist: false });
      resetCursorSettings();
      setCursorActive(false);
    });
  }
  restoreLauncherPosition();
  if(btn){ window.addEventListener('resize', handleResize); }

})();


// --- Robust event delegation (in case markup is injected after scripts) ---
document.addEventListener('click', function(e){
  const launcher = e.target.closest && e.target.closest('#a11y-launcher');
  const close1 = e.target.closest && e.target.closest('#a11y-close');
  const close2 = e.target.closest && e.target.closest('#a11y-close2');
  const overlayEl = document.getElementById('a11y-overlay');
  if(!overlayEl) return;
  function open(){ overlayEl.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function close(){
    overlayEl.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    const panelEl = overlayEl.querySelector('.a11y-panel');
    if(panelEl){ panelEl.classList.remove('is-searching'); }
    const tablistEl = overlayEl.querySelector('[data-role="section-tablist"]');
    if(tablistEl){
      tablistEl.removeAttribute('hidden');
      tablistEl.removeAttribute('aria-hidden');
    }
    const resultsEl = overlayEl.querySelector('[data-role="search-results"]');
    if(resultsEl){
      resultsEl.hidden = true;
      resultsEl.setAttribute('aria-hidden','true');
      const listEl = resultsEl.querySelector('[data-role="search-list"]');
      if(listEl){ listEl.innerHTML = ''; }
      const emptyEl = resultsEl.querySelector('[data-role="search-empty"]');
      if(emptyEl){ emptyEl.hidden = true; }
    }
    const searchInputEl = document.getElementById('a11y-search');
    if(searchInputEl){ searchInputEl.value = ''; }
  }
  if(launcher){ open(); }
  if(close1 || close2){ close(); }
});
