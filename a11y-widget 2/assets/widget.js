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
  const root = document.getElementById('a11y-widget-root');
  const btn = document.getElementById('a11y-launcher');
  const overlay = document.getElementById('a11y-overlay');
  const panel = root ? root.querySelector('.a11y-panel') : null;
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

  const BRIGHTNESS_SLUG = 'luminosite-reglages';
  const BRIGHTNESS_SETTINGS_KEY = 'a11y-widget-brightness-settings:v1';
  const BRIGHTNESS_MODES = ['normal', 'night', 'blue_light', 'high_contrast', 'low_contrast', 'grayscale'];
  const BRIGHTNESS_MODE_CLASSES = {
    normal: '',
    night: 'acc-mode-night',
    blue_light: 'acc-mode-blue-light',
    high_contrast: 'acc-mode-high-contrast',
    low_contrast: 'acc-mode-low-contrast',
    grayscale: 'acc-mode-grayscale',
  };
  const BRIGHTNESS_MODE_FILTERS = {
    normal: '',
    night: 'invert(1) hue-rotate(180deg)',
    blue_light: 'sepia(90%) hue-rotate(-10deg)',
    high_contrast: 'contrast(200%)',
    low_contrast: 'contrast(70%)',
    grayscale: 'grayscale(100%)',
  };
  const BRIGHTNESS_MODE_CONFIG = [
    { key: 'normal', icon: '☀️', labelKey: 'mode_normal_label', ariaKey: 'mode_normal_aria' },
    { key: 'night', icon: '🌙', labelKey: 'mode_night_label', ariaKey: 'mode_night_aria' },
    { key: 'blue_light', icon: '🔶', labelKey: 'mode_blue_light_label', ariaKey: 'mode_blue_light_aria' },
    { key: 'high_contrast', icon: '⬛', labelKey: 'mode_high_contrast_label', ariaKey: 'mode_high_contrast_aria' },
    { key: 'low_contrast', icon: '⬜', labelKey: 'mode_low_contrast_label', ariaKey: 'mode_low_contrast_aria' },
    { key: 'grayscale', icon: '◧', labelKey: 'mode_grayscale_label', ariaKey: 'mode_grayscale_aria' },
  ];
  const BRIGHTNESS_SLIDER_CONFIG = {
    contrast: { min: 50, max: 200, step: 10 },
    brightness: { min: 50, max: 150, step: 5 },
    saturation: { min: 0, max: 200, step: 10 },
  };
  const brightnessInstances = new Set();
  let brightnessSettings = loadBrightnessSettings();
  let brightnessActive = false;
  let brightnessIdCounter = 0;

  const VISUAL_FILTER_ORDER = ['colorblind', 'brightness'];
  const visualFilterComponents = new Map();
  let visualFilterStyleElement = null;

  function ensureVisualFilterStyleElement(){
    if(visualFilterStyleElement && visualFilterStyleElement.isConnected){ return visualFilterStyleElement; }
    let el = document.getElementById('a11y-visual-filter-styles');
    if(!el){
      el = document.createElement('style');
      el.id = 'a11y-visual-filter-styles';
      document.head.appendChild(el);
    }
    visualFilterStyleElement = el;
    return el;
  }

  function composeVisualFilterValue(){
    const ordered = [];
    VISUAL_FILTER_ORDER.forEach(key => {
      const value = visualFilterComponents.get(key);
      if(typeof value === 'string' && value.trim()){ ordered.push(value.trim()); }
    });
    visualFilterComponents.forEach((value, key) => {
      if(VISUAL_FILTER_ORDER.includes(key)){ return; }
      if(typeof value === 'string' && value.trim()){ ordered.push(value.trim()); }
    });
    return ordered.join(' ').trim();
  }

  function updateVisualFilterStyles(){
    const combined = composeVisualFilterValue();
    if(!visualFilterStyleElement && !combined){
      return;
    }
    const styleEl = ensureVisualFilterStyleElement();
    const filterValue = combined || 'none';
    const rules = [
      `body { --a11y-visual-filter: ${filterValue}; }`,
      `body > :not([data-a11y-filter-exempt]) { filter: var(--a11y-visual-filter); transition: filter 0.25s ease, background-color 0.25s ease, color 0.25s ease; }`,
      `#a11y-overlay { --a11y-visual-filter: ${filterValue}; filter: var(--a11y-visual-filter); transition: filter 0.25s ease, background-color 0.25s ease, color 0.25s ease; }`,
    ];
    styleEl.textContent = rules.join('\n');
    if(combined){
      document.documentElement.classList.add('a11y-visual-filter-active');
    } else {
      document.documentElement.classList.remove('a11y-visual-filter-active');
    }
  }

  function setVisualFilterComponent(key, value){
    if(!key){ return; }
    const normalized = typeof value === 'string' ? value.trim() : '';
    if(normalized && normalized !== 'none'){
      visualFilterComponents.set(key, normalized);
    } else {
      visualFilterComponents.delete(key);
    }
    updateVisualFilterStyles();
  }

  function getVisualFilterComponent(key){
    return visualFilterComponents.get(key) || '';
  }

  function clampFloat(value, min, max){
    const numeric = Number(value);
    if(!Number.isFinite(numeric)){ return min; }
    return Math.min(max, Math.max(min, numeric));
  }

  function formatFilterNumber(value){
    if(!Number.isFinite(value)){ return '0'; }
    const rounded = Math.round(value * 1000) / 1000;
    if(Object.is(rounded, -0)){ return '0'; }
    return `${rounded}`;
  }

  const COLORBLIND_FILTER_PRESETS = {
    'vision-daltonisme-deuteranopie': { intensity: 0.8, hue: 10, saturate: 0.2, contrast: 0.1, sepia: 0.1 },
    'vision-daltonisme-deuteranomalie': { intensity: 0.6, hue: 8, saturate: 0.15, contrast: 0.08, sepia: 0.03 },
    'vision-daltonisme-protanopie': { intensity: 0.8, hue: -5, saturate: 0.3, contrast: 0.15, sepia: 0.05 },
    'vision-daltonisme-protanomalie': { intensity: 0.7, hue: -3, saturate: 0.2, contrast: 0.1, sepia: 0.02 },
    'vision-daltonisme-tritanopie': { intensity: 0.85, hue: 25, saturate: 0.25, contrast: 0.15, sepia: 0.05 },
    'vision-daltonisme-tritanomalie': { intensity: 0.6, hue: 12, saturate: 0.15, contrast: 0.08, sepia: 0.03, multiplier: 1 },
    'vision-daltonisme-achromatopsie': { grayscale: 1, contrastFactor: 1.2, brightnessFactor: 0.9 },
  };

  const colorblindActiveFilters = new Set();
  const colorblindRootClasses = new Set();

  function getColorblindShortName(slug){
    if(typeof slug !== 'string'){ return ''; }
    return slug.replace(/^vision-daltonisme-/, '');
  }

  function buildColorblindFilterValue(){
    if(!colorblindActiveFilters.size){ return ''; }
    let hueRotate = 0;
    let saturate = 1;
    let contrast = 1;
    let sepia = 0;
    let grayscale = 0;
    let brightness = 1;

    colorblindActiveFilters.forEach(slug => {
      const preset = COLORBLIND_FILTER_PRESETS[slug];
      if(!preset){ return; }
      const intensity = typeof preset.intensity === 'number' ? preset.intensity : 1;
      const multiplier = typeof preset.multiplier === 'number' ? preset.multiplier : 1;
      const effective = intensity * multiplier;
      if(typeof preset.hue === 'number'){ hueRotate += preset.hue * effective; }
      if(typeof preset.saturate === 'number'){ saturate *= 1 + (preset.saturate * effective); }
      if(typeof preset.contrast === 'number'){ contrast *= 1 + (preset.contrast * effective); }
      if(typeof preset.sepia === 'number'){ sepia += preset.sepia * effective; }
      if(typeof preset.grayscale === 'number'){ grayscale = Math.max(grayscale, preset.grayscale); }
      if(typeof preset.contrastFactor === 'number'){ contrast *= preset.contrastFactor; }
      if(typeof preset.brightnessFactor === 'number'){ brightness *= preset.brightnessFactor; }
    });

    const parts = [];
    if(grayscale > 0){ parts.push(`grayscale(${formatFilterNumber(clampFloat(grayscale, 0, 1))})`); }
    if(sepia > 0){ parts.push(`sepia(${formatFilterNumber(clampFloat(sepia, 0, 1))})`); }
    if(Math.abs(hueRotate) > 0.001){ parts.push(`hue-rotate(${formatFilterNumber(hueRotate)}deg)`); }
    if(Math.abs(saturate - 1) > 0.001){ parts.push(`saturate(${formatFilterNumber(clampFloat(saturate, 0.1, 5))})`); }
    if(Math.abs(contrast - 1) > 0.001){ parts.push(`contrast(${formatFilterNumber(clampFloat(contrast, 0.1, 5))})`); }
    if(Math.abs(brightness - 1) > 0.001){ parts.push(`brightness(${formatFilterNumber(clampFloat(brightness, 0.2, 3))})`); }
    return parts.join(' ');
  }

  function updateColorblindRootState(){
    const root = document.documentElement;
    if(!root){ return; }
    colorblindRootClasses.forEach(cls => root.classList.remove(cls));
    colorblindRootClasses.clear();
    if(!colorblindActiveFilters.size){
      root.classList.remove('a11y-colorblind-active');
      delete root.dataset.a11yColorblindActive;
      delete root.dataset.a11yColorblindFilters;
      return;
    }
    const names = Array.from(colorblindActiveFilters).map(getColorblindShortName).filter(Boolean);
    names.forEach(name => {
      const className = `a11y-colorblind-${name}`;
      root.classList.add(className);
      colorblindRootClasses.add(className);
    });
    root.classList.add('a11y-colorblind-active');
    root.dataset.a11yColorblindActive = 'on';
    root.dataset.a11yColorblindFilters = names.join(' ');
  }

  function refreshColorblindFilters(){
    const filterValue = buildColorblindFilterValue();
    setVisualFilterComponent('colorblind', filterValue);
    updateColorblindRootState();
  }

  function setColorblindFilterState(slug, enabled){
    if(!COLORBLIND_FILTER_PRESETS[slug]){ return; }
    if(enabled){
      colorblindActiveFilters.add(slug);
    } else {
      colorblindActiveFilters.delete(slug);
    }
    refreshColorblindFilters();
  }

  const DYSLEXIA_SLUG = 'cognitif-dyslexie';
  const DYSLEXIA_SETTINGS_KEY = 'a11y-widget-dyslexie-settings:v1';
  const DYSLEXIA_DEFAULT_COLOR = '#ffeb3b';
  const DYSLEXIA_FONT_SIZE_MIN = 14;
  const DYSLEXIA_FONT_SIZE_MAX = 26;
  const DYSLEXIA_FONT_SIZE_STEP = 1;
  const DYSLEXIA_LINE_HEIGHT_MIN = 100;
  const DYSLEXIA_LINE_HEIGHT_MAX = 250;
  const DYSLEXIA_LINE_HEIGHT_STEP = 10;
  const DYSLEXIA_TEXT_ELEMENTS = [
    'p', 'span', 'a', 'li', 'label', 'button', 'input', 'select', 'textarea', 'blockquote',
    'strong', 'b', 'em', 'i', 'cite', 'dfn', 'mark', 'code', 'pre', 'small', 'sup', 'sub',
    'td', 'th', 'dd', 'dt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ];
  const DYSLEXIA_TEXT_SELECTOR = `body, body :where(${DYSLEXIA_TEXT_ELEMENTS.join(', ')})`;
  const DYSLEXIA_FONT_SIZE_SELECTOR = `html, ${DYSLEXIA_TEXT_SELECTOR}`;
  const DYSLEXIA_FONT_STACKS = {
    default: 'inherit',
    arial: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
    verdana: '"Verdana", Geneva, sans-serif',
    trebuchet: '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", sans-serif',
    comic: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
    open: '"OpenDyslexic", "Open Dyslexic", Arial, sans-serif',
    dyslexic: '"OpenDyslexic Alta", "OpenDyslexicAlta", Arial, sans-serif',
    luciole: '"Luciole", "Luciole Regular", Arial, sans-serif',
    'atkinson-hyperlegible': '"Atkinson Hyperlegible", "AtkinsonHyperlegible", Arial, sans-serif',
    'inconstant-regular': '"Inconstant", "Inconstant Regular", "Inconsolata", Arial, sans-serif',
    'accessible-dfa': '"Accessible DfA", "AccessibleDfA", Arial, sans-serif',
  };
  const DYSLEXIA_DEFAULTS = {
    letter: '',
    color: DYSLEXIA_DEFAULT_COLOR,
    accentInclusive: false,
    font: 'default',
    fontSize: 16,
    lineHeight: 150,
    disableItalic: false,
    disableBold: false,
  };
  const dyslexiaInstances = new Set();
  let dyslexiaSettings = loadDyslexiaSettings();
  let dyslexiaActive = false;
  let dyslexiaStyleElement = null;

  const READING_GUIDE_SLUG = 'cognitif-reading-guide';
  const READING_GUIDE_SETTINGS_KEY = 'a11y-widget-reading-guide-settings:v1';
  const READING_GUIDE_HEIGHT_MIN = 40;
  const READING_GUIDE_HEIGHT_MAX = 320;
  const READING_GUIDE_HEIGHT_STEP = 4;
  const READING_GUIDE_OPACITY_MIN = 0.1;
  const READING_GUIDE_OPACITY_MAX = 1;
  const READING_GUIDE_OPACITY_STEP = 0.05;
  const READING_GUIDE_DEFAULTS = {
    color: '#ffe28a',
    opacity: 0.65,
    height: 120,
    summaryEnabled: false,
    summarySelector: '',
    summaryContainer: '',
    summaryTitle: '',
    syllableEnabled: false,
    syllableSelector: 'main p, main li',
    focusEnabled: false,
  };
  const READING_GUIDE_DEFAULT_SELECTORS = {
    headings: 'main h2, main h3',
    contentAttribute: 'data-reading-guide-content',
    tocAttribute: 'data-reading-guide-toc',
    tocTitleAttribute: 'data-reading-guide-toc-title',
    syllableAttribute: 'data-reading-guide-syllables',
    animationExemptAttribute: 'data-reading-guide-allow-animation',
  };
  const READING_GUIDE_GLOBAL_HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
  const readingGuideInstances = new Set();
  let readingGuideSettings = loadReadingGuideSettings();
  let readingGuideActive = false;
  let readingGuideOverlayEl = null;
  let readingGuideSummaryEl = null;
  let readingGuideFocusClassApplied = false;
  let readingGuidePointerY = null;
  const readingGuideTextNodes = new Map();
  const readingGuideCleanup = [];
  let readingGuideSelectorConfig = Object.assign({}, READING_GUIDE_DEFAULT_SELECTORS);
  let readingGuideTexts = { summaryTitleFallback: 'Sommaire' };

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
    '.wp-block-button__link:not(#a11y-overlay *):not(#a11y-widget-root *)',
    '.wp-element-button:not(#a11y-overlay *):not(#a11y-widget-root *)',
    'button:not(#a11y-overlay button):not(#a11y-widget-root button)',
    '.button:not(#a11y-overlay .button):not(#a11y-widget-root .button)',
    '.btn:not(#a11y-overlay .btn):not(#a11y-widget-root .btn)',
    'input[type="submit"]:not(#a11y-overlay input):not(#a11y-widget-root input)',
    'input[type="button"]:not(#a11y-overlay input):not(#a11y-widget-root input)',
    'input[type="reset"]:not(#a11y-overlay input):not(#a11y-widget-root input)'
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

  function normalizeDyslexiaFont(value){
    if(typeof value !== 'string'){ return DYSLEXIA_DEFAULTS.font; }
    const key = value.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(DYSLEXIA_FONT_STACKS, key)
      ? key
      : DYSLEXIA_DEFAULTS.font;
  }

  function clampDyslexiaFontSize(value){
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    if(!isFinite(numeric)){ return DYSLEXIA_DEFAULTS.fontSize; }
    return Math.min(DYSLEXIA_FONT_SIZE_MAX, Math.max(DYSLEXIA_FONT_SIZE_MIN, Math.round(numeric)));
  }

  function clampDyslexiaLineHeight(value){
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    if(!isFinite(numeric)){ return DYSLEXIA_DEFAULTS.lineHeight; }
    return Math.min(DYSLEXIA_LINE_HEIGHT_MAX, Math.max(DYSLEXIA_LINE_HEIGHT_MIN, Math.round(numeric)));
  }

  function formatDyslexiaFontSize(value){
    return `${clampDyslexiaFontSize(value)}px`;
  }

  function formatDyslexiaLineHeight(value){
    return `${clampDyslexiaLineHeight(value)}%`;
  }

  function ensureDyslexiaStyleElement(){
    if(dyslexiaStyleElement && dyslexiaStyleElement.parentNode){ return; }
    dyslexiaStyleElement = document.createElement('style');
    dyslexiaStyleElement.id = 'a11y-dyslexie-style';
    document.head.appendChild(dyslexiaStyleElement);
  }

  function updateDyslexiaStyles(){
    if(!dyslexiaActive){
      if(dyslexiaStyleElement){ dyslexiaStyleElement.textContent = ''; }
      return;
    }
    ensureDyslexiaStyleElement();
    const size = clampDyslexiaFontSize(dyslexiaSettings.fontSize);
    const lineHeight = clampDyslexiaLineHeight(dyslexiaSettings.lineHeight);
    const fontKey = normalizeDyslexiaFont(dyslexiaSettings.font);
    const fontStack = DYSLEXIA_FONT_STACKS[fontKey] || DYSLEXIA_FONT_STACKS[DYSLEXIA_DEFAULTS.font];
    const rules = [];
    rules.push(`${DYSLEXIA_FONT_SIZE_SELECTOR} { font-size: ${size}px !important; }`);
    rules.push(`${DYSLEXIA_TEXT_SELECTOR} { line-height: ${lineHeight}% !important; }`);
    if(fontKey !== 'default'){
      rules.push(`${DYSLEXIA_TEXT_SELECTOR} { font-family: ${fontStack} !important; }`);
    }
    if(dyslexiaSettings.disableItalic){
      rules.push(`${DYSLEXIA_TEXT_SELECTOR} { font-style: normal !important; }`);
    }
    if(dyslexiaSettings.disableBold){
      rules.push(`${DYSLEXIA_TEXT_SELECTOR} { font-weight: normal !important; }`);
    }
    dyslexiaStyleElement.textContent = rules.join('\n');
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

  function getDefaultBrightnessSettings(){
    return {
      mode: 'normal',
      contrast: 100,
      brightness: 100,
      saturation: 100,
    };
  }

  function normalizeBrightnessMode(value){
    if(typeof value !== 'string'){ return 'normal'; }
    const normalized = value.toLowerCase().replace(/-/g, '_');
    return BRIGHTNESS_MODES.includes(normalized) ? normalized : 'normal';
  }

  function clampBrightnessValue(value, config, fallback){
    const numeric = Number(value);
    if(Number.isFinite(numeric)){
      const step = config.step || 0;
      const stepped = step ? Math.round(numeric / step) * step : numeric;
      const bounded = Math.min(config.max, Math.max(config.min, stepped));
      return Math.round(bounded);
    }
    return fallback;
  }

  function clampBrightnessContrast(value){
    return clampBrightnessValue(value, BRIGHTNESS_SLIDER_CONFIG.contrast, 100);
  }

  function clampBrightnessLevel(value){
    return clampBrightnessValue(value, BRIGHTNESS_SLIDER_CONFIG.brightness, 100);
  }

  function clampBrightnessSaturation(value){
    return clampBrightnessValue(value, BRIGHTNESS_SLIDER_CONFIG.saturation, 100);
  }

  function loadBrightnessSettings(){
    const defaults = getDefaultBrightnessSettings();
    try {
      const raw = localStorage.getItem(BRIGHTNESS_SETTINGS_KEY);
      if(!raw){ return Object.assign({}, defaults); }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return Object.assign({}, defaults); }
      return {
        mode: normalizeBrightnessMode(parsed.mode),
        contrast: clampBrightnessContrast(parsed.contrast),
        brightness: clampBrightnessLevel(parsed.brightness),
        saturation: clampBrightnessSaturation(parsed.saturation),
      };
    } catch(err){
      return Object.assign({}, defaults);
    }
  }

  function persistBrightnessSettings(){
    const payload = {
      mode: normalizeBrightnessMode(brightnessSettings.mode),
      contrast: clampBrightnessContrast(brightnessSettings.contrast),
      brightness: clampBrightnessLevel(brightnessSettings.brightness),
      saturation: clampBrightnessSaturation(brightnessSettings.saturation),
    };
    try { localStorage.setItem(BRIGHTNESS_SETTINGS_KEY, JSON.stringify(payload)); } catch(err){ /* ignore */ }
  }

  function clearBrightnessModeClasses(){
    if(!overlay){ return; }
    Object.values(BRIGHTNESS_MODE_CLASSES).forEach(className => {
      if(className){ overlay.classList.remove(className); }
    });
  }

  function applyBrightnessMode(){
    if(!overlay){ return; }
    clearBrightnessModeClasses();
    if(!brightnessActive){ return; }
    const className = BRIGHTNESS_MODE_CLASSES[normalizeBrightnessMode(brightnessSettings.mode)];
    if(className){ overlay.classList.add(className); }
  }

  function buildBrightnessFilter(settings){
    const parts = [];
    const contrast = clampBrightnessContrast(settings.contrast);
    const lightness = clampBrightnessLevel(settings.brightness);
    const saturation = clampBrightnessSaturation(settings.saturation);
    if(contrast !== 100){ parts.push(`contrast(${contrast}%)`); }
    if(lightness !== 100){ parts.push(`brightness(${lightness}%)`); }
    if(saturation !== 100){ parts.push(`saturate(${saturation}%)`); }
    return parts.join(' ');
  }

  function updateBrightnessFilter(){
    if(!brightnessActive){
      setVisualFilterComponent('brightness', '');
      return;
    }
    const baseFilter = BRIGHTNESS_MODE_FILTERS[normalizeBrightnessMode(brightnessSettings.mode)] || '';
    const adjustments = buildBrightnessFilter(brightnessSettings);
    const combined = [baseFilter, adjustments].filter(Boolean).join(' ').trim();
    setVisualFilterComponent('brightness', combined);
  }

  function pruneBrightnessInstances(){
    brightnessInstances.forEach(instance => {
      if(!instance){
        brightnessInstances.delete(instance);
        return;
      }
      if(instance.wasConnected && (!instance.article || !instance.article.isConnected)){
        brightnessInstances.delete(instance);
      }
    });
  }

  function updateBrightnessInstanceUI(instance){
    if(!instance){ return; }
    const {
      article,
      controls,
      modesList,
      modeButtons,
      contrastSlider,
      brightnessSlider,
      saturationSlider,
      contrastValue,
      brightnessValue,
      saturationValue,
      contrastDecrease,
      contrastIncrease,
      brightnessDecrease,
      brightnessIncrease,
      saturationDecrease,
      saturationIncrease,
    } = instance;
    const active = brightnessActive;
    const mode = normalizeBrightnessMode(brightnessSettings.mode);
    const contrast = clampBrightnessContrast(brightnessSettings.contrast);
    const level = clampBrightnessLevel(brightnessSettings.brightness);
    const saturation = clampBrightnessSaturation(brightnessSettings.saturation);

    if(article){
      if(article.isConnected){ instance.wasConnected = true; }
      article.classList.toggle('is-disabled', !active);
    }
    if(controls){
      controls.classList.toggle('is-disabled', !active);
      if(!active){ controls.setAttribute('aria-disabled', 'true'); }
      else { controls.removeAttribute('aria-disabled'); }
    }
    if(modesList){
      if(!active){ modesList.setAttribute('aria-disabled', 'true'); }
      else { modesList.removeAttribute('aria-disabled'); }
    }
    if(Array.isArray(modeButtons)){
      modeButtons.forEach(({ button, mode: btnMode }) => {
        if(!button){ return; }
        const isCurrent = btnMode === mode && active;
        button.classList.toggle('is-active', isCurrent);
        button.setAttribute('aria-checked', isCurrent ? 'true' : 'false');
        if(active){
          button.disabled = false;
          button.tabIndex = isCurrent ? 0 : -1;
          button.removeAttribute('aria-disabled');
        } else {
          button.disabled = true;
          button.tabIndex = -1;
          button.setAttribute('aria-disabled', 'true');
        }
      });
    }

    const contrastCfg = BRIGHTNESS_SLIDER_CONFIG.contrast;
    const brightnessCfg = BRIGHTNESS_SLIDER_CONFIG.brightness;
    const saturationCfg = BRIGHTNESS_SLIDER_CONFIG.saturation;

    if(contrastSlider){
      contrastSlider.disabled = !active;
      setInputValue(contrastSlider, String(contrast));
      contrastSlider.setAttribute('aria-valuenow', String(contrast));
      contrastSlider.setAttribute('aria-valuetext', `${contrast}%`);
    }
    if(contrastValue){ contrastValue.textContent = `${contrast}%`; }
    if(contrastDecrease){ contrastDecrease.disabled = !active || contrast <= contrastCfg.min; }
    if(contrastIncrease){ contrastIncrease.disabled = !active || contrast >= contrastCfg.max; }

    if(brightnessSlider){
      brightnessSlider.disabled = !active;
      setInputValue(brightnessSlider, String(level));
      brightnessSlider.setAttribute('aria-valuenow', String(level));
      brightnessSlider.setAttribute('aria-valuetext', `${level}%`);
    }
    if(brightnessValue){ brightnessValue.textContent = `${level}%`; }
    if(brightnessDecrease){ brightnessDecrease.disabled = !active || level <= brightnessCfg.min; }
    if(brightnessIncrease){ brightnessIncrease.disabled = !active || level >= brightnessCfg.max; }

    if(saturationSlider){
      saturationSlider.disabled = !active;
      setInputValue(saturationSlider, String(saturation));
      saturationSlider.setAttribute('aria-valuenow', String(saturation));
      saturationSlider.setAttribute('aria-valuetext', `${saturation}%`);
    }
    if(saturationValue){ saturationValue.textContent = `${saturation}%`; }
    if(saturationDecrease){ saturationDecrease.disabled = !active || saturation <= saturationCfg.min; }
    if(saturationIncrease){ saturationIncrease.disabled = !active || saturation >= saturationCfg.max; }
  }

  function syncBrightnessInstances(){
    pruneBrightnessInstances();
    brightnessInstances.forEach(instance => updateBrightnessInstanceUI(instance));
  }

  function setBrightnessActive(on){
    const next = !!on;
    if(brightnessActive === next){
      if(next){ ensureVisualFilterStyleElement(); }
      applyBrightnessMode();
      updateBrightnessFilter();
      syncBrightnessInstances();
      return;
    }
    brightnessActive = next;
    if(next){
      ensureVisualFilterStyleElement();
    } else {
      setVisualFilterComponent('brightness', '');
    }
    applyBrightnessMode();
    updateBrightnessFilter();
    syncBrightnessInstances();
  }

  function setBrightnessMode(value, options = {}){
    const next = normalizeBrightnessMode(value);
    const current = normalizeBrightnessMode(brightnessSettings.mode);
    const changed = current !== next;
    brightnessSettings.mode = next;
    if(changed || options.force){
      applyBrightnessMode();
      updateBrightnessFilter();
      syncBrightnessInstances();
      if(options.persist !== false){ persistBrightnessSettings(); }
    } else if(options.syncOnly){
      syncBrightnessInstances();
    }
  }

  function setBrightnessContrast(value, options = {}){
    const next = clampBrightnessContrast(value);
    const current = clampBrightnessContrast(brightnessSettings.contrast);
    const changed = current !== next;
    brightnessSettings.contrast = next;
    if(changed || options.force){
      updateBrightnessFilter();
      syncBrightnessInstances();
      if(options.persist !== false){ persistBrightnessSettings(); }
    } else if(options.syncOnly){
      syncBrightnessInstances();
    }
  }

  function setBrightnessLevel(value, options = {}){
    const next = clampBrightnessLevel(value);
    const current = clampBrightnessLevel(brightnessSettings.brightness);
    const changed = current !== next;
    brightnessSettings.brightness = next;
    if(changed || options.force){
      updateBrightnessFilter();
      syncBrightnessInstances();
      if(options.persist !== false){ persistBrightnessSettings(); }
    } else if(options.syncOnly){
      syncBrightnessInstances();
    }
  }

  function setBrightnessSaturation(value, options = {}){
    const next = clampBrightnessSaturation(value);
    const current = clampBrightnessSaturation(brightnessSettings.saturation);
    const changed = current !== next;
    brightnessSettings.saturation = next;
    if(changed || options.force){
      updateBrightnessFilter();
      syncBrightnessInstances();
      if(options.persist !== false){ persistBrightnessSettings(); }
    } else if(options.syncOnly){
      syncBrightnessInstances();
    }
  }

  function adjustBrightnessSetting(key, delta){
    const step = Number(delta) || 0;
    if(key === 'contrast'){
      setBrightnessContrast(brightnessSettings.contrast + step, { force: true });
    } else if(key === 'brightness'){
      setBrightnessLevel(brightnessSettings.brightness + step, { force: true });
    } else if(key === 'saturation'){
      setBrightnessSaturation(brightnessSettings.saturation + step, { force: true });
    }
  }

  function resetBrightnessSettings(options = {}){
    brightnessSettings = getDefaultBrightnessSettings();
    applyBrightnessMode();
    updateBrightnessFilter();
    syncBrightnessInstances();
    if(options.persist !== false){
      persistBrightnessSettings();
    }
  }

  function handleBrightnessModeKeydown(event, instance, index){
    if(!instance || !Array.isArray(instance.modeButtons) || !instance.modeButtons.length){ return; }
    const buttons = instance.modeButtons.map(entry => entry && entry.button).filter(Boolean);
    if(!buttons.length){ return; }
    let targetIndex = null;
    switch(event.key){
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        targetIndex = (index + 1) % buttons.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        targetIndex = (index - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        event.preventDefault();
        targetIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        targetIndex = buttons.length - 1;
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        if(instance.modeButtons[index]){
          setBrightnessMode(instance.modeButtons[index].mode);
        }
        return;
      default:
        return;
    }
    if(targetIndex !== null){
      const target = buttons[targetIndex];
      if(target && !target.disabled){ target.focus(); }
    }
  }

  function createBrightnessCard(feature){
    if(!feature || typeof feature.slug !== 'string' || !feature.slug){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card a11y-card--brightness';
    article.setAttribute('data-role', 'feature-card');

    const header = document.createElement('div');
    header.className = 'a11y-brightness__header';

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
      switchEl.classList.add('a11y-brightness__switch');
      header.appendChild(switchEl);
    }

    article.appendChild(header);

    const controls = document.createElement('form');
    controls.className = 'a11y-brightness__controls';
    controls.setAttribute('data-role', 'brightness-controls');
    controls.addEventListener('submit', event => { event.preventDefault(); });

    const settings = feature.settings && typeof feature.settings === 'object' ? feature.settings : {};
    const texts = {
      modes_label: typeof settings.modes_label === 'string' ? settings.modes_label : '',
      modes_hint: typeof settings.modes_hint === 'string' ? settings.modes_hint : '',
      advanced_label: typeof settings.advanced_label === 'string' ? settings.advanced_label : '',
      advanced_hint: typeof settings.advanced_hint === 'string' ? settings.advanced_hint : '',
      contrast_label: typeof settings.contrast_label === 'string' ? settings.contrast_label : '',
      contrast_decrease: typeof settings.contrast_decrease === 'string' ? settings.contrast_decrease : '',
      contrast_increase: typeof settings.contrast_increase === 'string' ? settings.contrast_increase : '',
      brightness_label: typeof settings.brightness_label === 'string' ? settings.brightness_label : '',
      brightness_decrease: typeof settings.brightness_decrease === 'string' ? settings.brightness_decrease : '',
      brightness_increase: typeof settings.brightness_increase === 'string' ? settings.brightness_increase : '',
      saturation_label: typeof settings.saturation_label === 'string' ? settings.saturation_label : '',
      saturation_decrease: typeof settings.saturation_decrease === 'string' ? settings.saturation_decrease : '',
      saturation_increase: typeof settings.saturation_increase === 'string' ? settings.saturation_increase : '',
      reset_label: typeof settings.reset_label === 'string' ? settings.reset_label : '',
      reset_aria: typeof settings.reset_aria === 'string' ? settings.reset_aria : '',
    };

    const baseId = `a11y-brightness-${++brightnessIdCounter}`;

    const modesGroup = document.createElement('div');
    modesGroup.className = 'a11y-brightness__group';

    const modesLabel = document.createElement('p');
    modesLabel.className = 'a11y-brightness__label';
    modesLabel.id = `${baseId}-modes-label`;
    modesLabel.textContent = texts.modes_label || '';
    modesGroup.appendChild(modesLabel);

    let modesHintId = '';
    if(texts.modes_hint){
      const modesHint = document.createElement('p');
      modesHint.className = 'a11y-brightness__hint';
      modesHint.id = `${baseId}-modes-hint`;
      modesHint.textContent = texts.modes_hint;
      modesGroup.appendChild(modesHint);
      modesHintId = modesHint.id;
    }

    const modesList = document.createElement('div');
    modesList.className = 'a11y-brightness__modes';
    modesList.setAttribute('role', 'radiogroup');
    modesList.setAttribute('aria-labelledby', modesLabel.id);
    if(modesHintId){ modesList.setAttribute('aria-describedby', modesHintId); }

    const modeButtons = [];
    BRIGHTNESS_MODE_CONFIG.forEach(definition => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'a11y-brightness__mode';
      button.dataset.mode = definition.key;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');

      const icon = document.createElement('span');
      icon.className = 'a11y-brightness__mode-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = definition.icon;
      button.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'a11y-brightness__mode-label';
      const labelText = typeof settings[definition.labelKey] === 'string' ? settings[definition.labelKey] : definition.key;
      label.textContent = labelText;
      button.appendChild(label);

      const aria = typeof settings[definition.ariaKey] === 'string' ? settings[definition.ariaKey] : labelText;
      if(aria){ button.setAttribute('aria-label', aria); }

      button.addEventListener('click', () => setBrightnessMode(definition.key));

      modeButtons.push({ button, mode: definition.key });
      modesList.appendChild(button);
    });

    modesGroup.appendChild(modesList);
    controls.appendChild(modesGroup);

    const advanced = document.createElement('details');
    advanced.className = 'a11y-brightness__advanced';

    const summary = document.createElement('summary');
    summary.className = 'a11y-brightness__summary';
    summary.textContent = texts.advanced_label || '';
    advanced.appendChild(summary);

    if(texts.advanced_hint){
      const advancedHint = document.createElement('p');
      advancedHint.className = 'a11y-brightness__hint';
      advancedHint.textContent = texts.advanced_hint;
      advanced.appendChild(advancedHint);
    }

    const advancedContent = document.createElement('div');
    advancedContent.className = 'a11y-brightness__advanced-content';
    const advancedContentId = `${baseId}-advanced`;
    advancedContent.id = advancedContentId;
    advancedContent.setAttribute('role', 'group');
    const advancedLabel = texts.advanced_label || '';
    if(advancedLabel){
      advancedContent.setAttribute('aria-label', advancedLabel);
    }
    advanced.appendChild(advancedContent);

    summary.setAttribute('aria-controls', advancedContentId);
    summary.setAttribute('aria-expanded', advanced.open ? 'true' : 'false');
    advanced.addEventListener('toggle', () => {
      summary.setAttribute('aria-expanded', advanced.open ? 'true' : 'false');
    });

    function buildSlider(key, labelText, decreaseText, increaseText){
      const config = BRIGHTNESS_SLIDER_CONFIG[key];
      const field = document.createElement('div');
      field.className = 'a11y-brightness__group a11y-brightness__group--slider';

      const label = document.createElement('label');
      const fieldId = `${baseId}-${key}`;
      label.setAttribute('for', fieldId);
      label.className = 'a11y-brightness__label';
      label.textContent = labelText || '';
      const valueSpan = document.createElement('span');
      valueSpan.className = 'a11y-brightness__value';
      valueSpan.setAttribute('role', 'status');
      valueSpan.setAttribute('aria-live', 'polite');
      label.appendChild(valueSpan);
      field.appendChild(label);

      const sliderRow = document.createElement('div');
      sliderRow.className = 'a11y-brightness__slider';

      const decreaseBtn = document.createElement('button');
      decreaseBtn.type = 'button';
      decreaseBtn.className = 'a11y-brightness__step a11y-brightness__step--decrease';
      decreaseBtn.innerHTML = '<span aria-hidden="true">−</span>';
      if(decreaseText){ decreaseBtn.setAttribute('aria-label', decreaseText); }
      sliderRow.appendChild(decreaseBtn);

      const range = document.createElement('input');
      range.type = 'range';
      range.id = fieldId;
      range.className = 'a11y-brightness__range';
      range.min = String(config.min);
      range.max = String(config.max);
      range.step = String(config.step);
      if(labelText){ range.setAttribute('aria-label', labelText); }
      range.setAttribute('aria-valuemin', String(config.min));
      range.setAttribute('aria-valuemax', String(config.max));
      sliderRow.appendChild(range);

      const increaseBtn = document.createElement('button');
      increaseBtn.type = 'button';
      increaseBtn.className = 'a11y-brightness__step a11y-brightness__step--increase';
      increaseBtn.innerHTML = '<span aria-hidden="true">+</span>';
      if(increaseText){ increaseBtn.setAttribute('aria-label', increaseText); }
      sliderRow.appendChild(increaseBtn);

      field.appendChild(sliderRow);
      return { field, range, valueSpan, decreaseBtn, increaseBtn };
    }

    const contrastControls = buildSlider('contrast', texts.contrast_label, texts.contrast_decrease, texts.contrast_increase);
    const brightnessControls = buildSlider('brightness', texts.brightness_label, texts.brightness_decrease, texts.brightness_increase);
    const saturationControls = buildSlider('saturation', texts.saturation_label, texts.saturation_decrease, texts.saturation_increase);

    advancedContent.appendChild(contrastControls.field);
    advancedContent.appendChild(brightnessControls.field);
    advancedContent.appendChild(saturationControls.field);

    controls.appendChild(advanced);

    const actions = document.createElement('div');
    actions.className = 'a11y-brightness__actions';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'a11y-brightness__reset';
    const resetLabel = texts.reset_label || 'Réinitialiser';
    resetBtn.textContent = resetLabel;
    const resetAria = texts.reset_aria || resetLabel;
    resetBtn.setAttribute('aria-label', resetAria);
    actions.appendChild(resetBtn);

    controls.appendChild(actions);
    article.appendChild(controls);

    const instance = {
      article,
      controls,
      modesList,
      modeButtons,
      contrastSlider: contrastControls.range,
      brightnessSlider: brightnessControls.range,
      saturationSlider: saturationControls.range,
      contrastValue: contrastControls.valueSpan,
      brightnessValue: brightnessControls.valueSpan,
      saturationValue: saturationControls.valueSpan,
      contrastDecrease: contrastControls.decreaseBtn,
      contrastIncrease: contrastControls.increaseBtn,
      brightnessDecrease: brightnessControls.decreaseBtn,
      brightnessIncrease: brightnessControls.increaseBtn,
      saturationDecrease: saturationControls.decreaseBtn,
      saturationIncrease: saturationControls.increaseBtn,
      resetButton: resetBtn,
      wasConnected: false,
    };

    modeButtons.forEach((entry, index) => {
      if(entry && entry.button){
        entry.button.addEventListener('keydown', event => handleBrightnessModeKeydown(event, instance, index));
      }
    });

    contrastControls.range.addEventListener('input', () => setBrightnessContrast(contrastControls.range.value, { persist: false }));
    contrastControls.range.addEventListener('change', () => setBrightnessContrast(contrastControls.range.value, { force: true }));
    brightnessControls.range.addEventListener('input', () => setBrightnessLevel(brightnessControls.range.value, { persist: false }));
    brightnessControls.range.addEventListener('change', () => setBrightnessLevel(brightnessControls.range.value, { force: true }));
    saturationControls.range.addEventListener('input', () => setBrightnessSaturation(saturationControls.range.value, { persist: false }));
    saturationControls.range.addEventListener('change', () => setBrightnessSaturation(saturationControls.range.value, { force: true }));

    contrastControls.decreaseBtn.addEventListener('click', () => adjustBrightnessSetting('contrast', -BRIGHTNESS_SLIDER_CONFIG.contrast.step));
    contrastControls.increaseBtn.addEventListener('click', () => adjustBrightnessSetting('contrast', BRIGHTNESS_SLIDER_CONFIG.contrast.step));
    brightnessControls.decreaseBtn.addEventListener('click', () => adjustBrightnessSetting('brightness', -BRIGHTNESS_SLIDER_CONFIG.brightness.step));
    brightnessControls.increaseBtn.addEventListener('click', () => adjustBrightnessSetting('brightness', BRIGHTNESS_SLIDER_CONFIG.brightness.step));
    saturationControls.decreaseBtn.addEventListener('click', () => adjustBrightnessSetting('saturation', -BRIGHTNESS_SLIDER_CONFIG.saturation.step));
    saturationControls.increaseBtn.addEventListener('click', () => adjustBrightnessSetting('saturation', BRIGHTNESS_SLIDER_CONFIG.saturation.step));

    resetBtn.addEventListener('click', () => resetBrightnessSettings());

    brightnessInstances.add(instance);
    syncBrightnessInstances();

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

  function loadDyslexiaSettings(){
    const defaults = Object.assign({}, DYSLEXIA_DEFAULTS);
    try {
      const raw = localStorage.getItem(DYSLEXIA_SETTINGS_KEY);
      if(!raw){ return Object.assign({}, defaults); }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return Object.assign({}, defaults); }
      const result = Object.assign({}, defaults);
      if(Object.prototype.hasOwnProperty.call(parsed, 'letter')){
        result.letter = sanitizeDyslexiaLetter(typeof parsed.letter === 'string' ? parsed.letter : '');
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'color')){
        result.color = normalizeDyslexiaColor(typeof parsed.color === 'string' ? parsed.color : DYSLEXIA_DEFAULT_COLOR);
      }
      let accentInclusive = defaults.accentInclusive;
      const hasAccentInclusive = Object.prototype.hasOwnProperty.call(parsed, 'accentInclusive');
      if(hasAccentInclusive){
        accentInclusive = !!parsed.accentInclusive;
      } else if(Object.prototype.hasOwnProperty.call(parsed, 'accentSensitive')) {
        accentInclusive = !parsed.accentSensitive;
      }
      result.accentInclusive = accentInclusive;
      if(Object.prototype.hasOwnProperty.call(parsed, 'font')){
        result.font = normalizeDyslexiaFont(parsed.font);
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'fontSize')){
        result.fontSize = clampDyslexiaFontSize(parsed.fontSize);
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'lineHeight')){
        result.lineHeight = clampDyslexiaLineHeight(parsed.lineHeight);
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'disableItalic')){
        result.disableItalic = !!parsed.disableItalic;
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'disableBold')){
        result.disableBold = !!parsed.disableBold;
      }
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
      letter: sanitizeDyslexiaLetter(dyslexiaSettings.letter || ''),
      color: normalizeDyslexiaColor(dyslexiaSettings.color || DYSLEXIA_DEFAULT_COLOR),
      accentInclusive: !!dyslexiaSettings.accentInclusive,
      font: normalizeDyslexiaFont(dyslexiaSettings.font),
      fontSize: clampDyslexiaFontSize(dyslexiaSettings.fontSize),
      lineHeight: clampDyslexiaLineHeight(dyslexiaSettings.lineHeight),
      disableItalic: !!dyslexiaSettings.disableItalic,
      disableBold: !!dyslexiaSettings.disableBold,
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

  function clampReadingGuideHeight(value){
    const numeric = Number(value);
    if(!Number.isFinite(numeric)){ return READING_GUIDE_DEFAULTS.height; }
    const clamped = Math.min(READING_GUIDE_HEIGHT_MAX, Math.max(READING_GUIDE_HEIGHT_MIN, numeric));
    return Math.round(clamped);
  }

  function clampReadingGuideOpacity(value){
    const numeric = Number(value);
    if(!Number.isFinite(numeric)){ return READING_GUIDE_DEFAULTS.opacity; }
    const clamped = Math.min(READING_GUIDE_OPACITY_MAX, Math.max(READING_GUIDE_OPACITY_MIN, numeric));
    const steps = Math.round(clamped / READING_GUIDE_OPACITY_STEP);
    return Math.min(READING_GUIDE_OPACITY_MAX, Math.max(READING_GUIDE_OPACITY_MIN, steps * READING_GUIDE_OPACITY_STEP));
  }

  function normalizeReadingGuideColor(value){
    if(typeof value !== 'string'){ return READING_GUIDE_DEFAULTS.color; }
    const trimmed = value.trim();
    if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)){ 
      if(trimmed.length === 4){
        const expanded = trimmed.slice(1).split('').map(char => char + char).join('');
        return `#${expanded.toLowerCase()}`;
      }
      return trimmed.toLowerCase();
    }
    return READING_GUIDE_DEFAULTS.color;
  }

  function loadReadingGuideSettings(){
    const defaults = Object.assign({}, READING_GUIDE_DEFAULTS);
    try {
      const raw = localStorage.getItem(READING_GUIDE_SETTINGS_KEY);
      if(!raw){ return Object.assign({}, defaults); }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return Object.assign({}, defaults); }
      const result = Object.assign({}, defaults);
      if(Object.prototype.hasOwnProperty.call(parsed, 'color')){
        result.color = normalizeReadingGuideColor(parsed.color);
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'opacity')){
        result.opacity = clampReadingGuideOpacity(parsed.opacity);
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'height')){
        result.height = clampReadingGuideHeight(parsed.height);
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'summaryEnabled')){
        result.summaryEnabled = !!parsed.summaryEnabled;
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'summarySelector')){
        result.summarySelector = typeof parsed.summarySelector === 'string' ? parsed.summarySelector : '';
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'summaryContainer')){
        result.summaryContainer = typeof parsed.summaryContainer === 'string' ? parsed.summaryContainer : '';
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'summaryTitle')){
        result.summaryTitle = typeof parsed.summaryTitle === 'string' ? parsed.summaryTitle : '';
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'syllableEnabled')){
        result.syllableEnabled = !!parsed.syllableEnabled;
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'syllableSelector')){
        result.syllableSelector = typeof parsed.syllableSelector === 'string' ? parsed.syllableSelector : defaults.syllableSelector;
      }
      if(Object.prototype.hasOwnProperty.call(parsed, 'focusEnabled')){
        result.focusEnabled = !!parsed.focusEnabled;
      }
      return result;
    } catch(err){
      return Object.assign({}, defaults);
    }
  }

  function persistReadingGuideSettings(){
    const payload = {
      color: normalizeReadingGuideColor(readingGuideSettings.color),
      opacity: clampReadingGuideOpacity(readingGuideSettings.opacity),
      height: clampReadingGuideHeight(readingGuideSettings.height),
      summaryEnabled: !!readingGuideSettings.summaryEnabled,
      summarySelector: typeof readingGuideSettings.summarySelector === 'string' ? readingGuideSettings.summarySelector : '',
      summaryContainer: typeof readingGuideSettings.summaryContainer === 'string' ? readingGuideSettings.summaryContainer : '',
      summaryTitle: typeof readingGuideSettings.summaryTitle === 'string' ? readingGuideSettings.summaryTitle : '',
      syllableEnabled: !!readingGuideSettings.syllableEnabled,
      syllableSelector: typeof readingGuideSettings.syllableSelector === 'string' ? readingGuideSettings.syllableSelector : READING_GUIDE_DEFAULTS.syllableSelector,
      focusEnabled: !!readingGuideSettings.focusEnabled,
    };
    try { localStorage.setItem(READING_GUIDE_SETTINGS_KEY, JSON.stringify(payload)); } catch(err){ /* ignore */ }
  }

  function resetReadingGuideSettings(options = {}){
    const { persist: shouldPersist = true } = options;
    readingGuideSettings = Object.assign({}, READING_GUIDE_DEFAULTS);
    if(shouldPersist){ persistReadingGuideSettings(); }
    if(readingGuideActive){
      applyReadingGuideStyles();
      applyReadingGuideSummary();
      applyReadingGuideSyllables();
      applyReadingGuideFocusMode(readingGuideSettings.focusEnabled);
      refreshReadingGuideOverlay();
    }
    syncReadingGuideInstances();
  }

  function updateReadingGuideSelectors(rawSettings){
    if(!rawSettings || typeof rawSettings !== 'object'){ return; }
    const selectors = rawSettings.selectors;
    if(!selectors || typeof selectors !== 'object'){ return; }
    const updated = Object.assign({}, readingGuideSelectorConfig);
    Object.keys(READING_GUIDE_DEFAULT_SELECTORS).forEach(key => {
      if(Object.prototype.hasOwnProperty.call(selectors, key)){
        const value = selectors[key];
        if(typeof value === 'string' && value.trim()){
          updated[key] = value.trim();
        }
      }
    });
    readingGuideSelectorConfig = updated;
  }

  function updateReadingGuideTexts(rawSettings){
    if(!rawSettings || typeof rawSettings !== 'object'){ return; }
    const defaultTitle = typeof rawSettings.summary_title_default === 'string'
      ? rawSettings.summary_title_default.trim()
      : '';
    if(defaultTitle){
      readingGuideTexts.summaryTitleFallback = defaultTitle;
    }
    if(typeof rawSettings.syllable_selector_default === 'string' && rawSettings.syllable_selector_default.trim()){
      if(!readingGuideSettings.syllableSelector || readingGuideSettings.syllableSelector === READING_GUIDE_DEFAULTS.syllableSelector){
        readingGuideSettings.syllableSelector = rawSettings.syllable_selector_default.trim();
      }
    }
  }

  function getReadingGuideSelectorValue(key){
    if(!readingGuideSelectorConfig){ return ''; }
    const value = readingGuideSelectorConfig[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  function getReadingGuideAttributeSelector(key){
    const attrName = getReadingGuideSelectorValue(key);
    return attrName ? `[${attrName}]` : '';
  }

  function getReadingGuideHeadingSelector(){
    const custom = typeof readingGuideSettings.summarySelector === 'string' ? readingGuideSettings.summarySelector.trim() : '';
    if(custom){ return custom; }
    const fallback = getReadingGuideSelectorValue('headings');
    return fallback || READING_GUIDE_DEFAULT_SELECTORS.headings;
  }

  function getReadingGuideSyllableSelector(){
    const custom = typeof readingGuideSettings.syllableSelector === 'string' ? readingGuideSettings.syllableSelector.trim() : '';
    return custom || READING_GUIDE_DEFAULTS.syllableSelector;
  }

  function ensureReadingGuideOverlay(){
    if(readingGuideOverlayEl && readingGuideOverlayEl.isConnected){ return readingGuideOverlayEl; }
    const overlay = document.createElement('div');
    overlay.className = 'a11y-reading-guide-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = !readingGuideActive;
    document.body.appendChild(overlay);
    readingGuideOverlayEl = overlay;
    applyReadingGuideStyles();
    return overlay;
  }

  function applyReadingGuideStyles(){
    const rootEl = document.documentElement;
    if(!rootEl){ return; }
    const color = normalizeReadingGuideColor(readingGuideSettings.color);
    const opacity = clampReadingGuideOpacity(readingGuideSettings.opacity);
    const height = clampReadingGuideHeight(readingGuideSettings.height);
    rootEl.style.setProperty('--a11y-reading-guide-color', color);
    rootEl.style.setProperty('--a11y-reading-guide-opacity', String(opacity));
    rootEl.style.setProperty('--a11y-reading-guide-height', `${height}px`);
    if(readingGuideOverlayEl){
      readingGuideOverlayEl.style.backgroundColor = color;
      readingGuideOverlayEl.style.opacity = String(opacity);
      readingGuideOverlayEl.style.height = `${height}px`;
    }
  }

  function setReadingGuideOverlayVisibility(visible){
    const overlay = ensureReadingGuideOverlay();
    overlay.hidden = !visible;
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function updateReadingGuideOverlayPosition(y){
    if(typeof y !== 'number'){ return; }
    const overlay = ensureReadingGuideOverlay();
    const height = clampReadingGuideHeight(readingGuideSettings.height);
    const offset = height / 2;
    const max = Math.max(0, window.innerHeight - height);
    const next = Math.min(Math.max(y - offset, 0), max);
    overlay.style.transform = `translateY(${next}px)`;
    readingGuidePointerY = y;
  }

  function updateReadingGuideOverlayForElement(element){
    if(!element || typeof element.getBoundingClientRect !== 'function'){ return; }
    const rect = element.getBoundingClientRect();
    if(rect.height === 0 && rect.top === 0){ return; }
    const centerY = rect.top + (rect.height / 2);
    updateReadingGuideOverlayPosition(centerY);
  }

  function refreshReadingGuideOverlay(){
    if(!readingGuideActive){ return; }
    const active = document.activeElement;
    if(active && active !== document.body){
      updateReadingGuideOverlayForElement(active);
      setReadingGuideOverlayVisibility(true);
      return;
    }
    if(typeof readingGuidePointerY === 'number'){
      updateReadingGuideOverlayPosition(readingGuidePointerY);
      setReadingGuideOverlayVisibility(true);
    }
  }

  function handleReadingGuidePointer(event){
    if(!readingGuideActive){ return; }
    if(event && event.target && event.target.closest && event.target.closest('#a11y-widget-root')){
      return;
    }
    if(typeof event.clientY === 'number'){
      updateReadingGuideOverlayPosition(event.clientY);
      setReadingGuideOverlayVisibility(true);
    }
  }

  function handleReadingGuideFocus(event){
    if(!readingGuideActive){ return; }
    const target = event && event.target ? event.target : null;
    if(!(target instanceof Element)){ return; }
    if(target.closest('#a11y-widget-root')){ return; }
    updateReadingGuideOverlayForElement(target);
    setReadingGuideOverlayVisibility(true);
  }

  function handleReadingGuideScroll(){
    refreshReadingGuideOverlay();
  }

  function removeReadingGuideListeners(){
    while(readingGuideCleanup.length){
      const disposer = readingGuideCleanup.pop();
      try { disposer(); } catch(err){ /* ignore */ }
    }
    readingGuidePointerY = null;
  }

  function setupReadingGuideListeners(){
    removeReadingGuideListeners();
    const pointerHandler = event => handleReadingGuidePointer(event);
    if(supportsPointer){
      const pointerOptions = { passive: true };
      document.addEventListener('pointermove', pointerHandler, pointerOptions);
      readingGuideCleanup.push(() => document.removeEventListener('pointermove', pointerHandler, pointerOptions));
    } else {
      document.addEventListener('mousemove', pointerHandler);
      readingGuideCleanup.push(() => document.removeEventListener('mousemove', pointerHandler));
    }
    const focusHandler = event => handleReadingGuideFocus(event);
    document.addEventListener('focusin', focusHandler, true);
    readingGuideCleanup.push(() => document.removeEventListener('focusin', focusHandler, true));
    const scrollHandler = () => handleReadingGuideScroll();
    window.addEventListener('scroll', scrollHandler, true);
    readingGuideCleanup.push(() => window.removeEventListener('scroll', scrollHandler, true));
    const resizeHandler = () => refreshReadingGuideOverlay();
    window.addEventListener('resize', resizeHandler);
    readingGuideCleanup.push(() => window.removeEventListener('resize', resizeHandler));
    const blurHandler = () => { setReadingGuideOverlayVisibility(false); };
    window.addEventListener('blur', blurHandler);
    readingGuideCleanup.push(() => window.removeEventListener('blur', blurHandler));
  }

  function resolveReadingGuideSummaryContainer(){
    const customSelector = typeof readingGuideSettings.summaryContainer === 'string'
      ? readingGuideSettings.summaryContainer.trim()
      : '';
    if(customSelector){
      try {
        const node = document.querySelector(customSelector);
        if(node){ return node; }
      } catch(err){ /* ignore invalid selector */ }
    }
    const attrSelector = getReadingGuideAttributeSelector('tocAttribute');
    if(attrSelector){
      const node = document.querySelector(attrSelector);
      if(node){ return node; }
    }
    if(readingGuideSummaryEl && readingGuideSummaryEl.isConnected){
      return readingGuideSummaryEl;
    }
    const nav = document.createElement('nav');
    nav.className = 'a11y-reading-guide-summary';
    nav.setAttribute('aria-live', 'polite');
    nav.dataset.readingGuideInjected = 'true';
    document.body.appendChild(nav);
    return nav;
  }

  function slugifyReadingGuideId(text){
    if(typeof text !== 'string'){ return `rg-${Date.now()}`; }
    const normalized = typeof text.normalize === 'function' ? text.normalize('NFD') : text;
    const cleaned = normalized.replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned || `rg-${Date.now()}`;
  }

  function ensureReadingGuideHeadingId(heading, index){
    if(!heading){ return ''; }
    if(heading.id){ return heading.id; }
    const base = slugifyReadingGuideId(heading.textContent || `section-${index + 1}`);
    let candidate = base;
    let counter = 1;
    while(document.getElementById(candidate)){
      candidate = `${base}-${counter++}`;
    }
    heading.id = candidate;
    return candidate;
  }

  function getReadingGuideHeadingLevel(heading){
    if(!(heading instanceof Element)){ return 6; }
    const dataLevel = heading.getAttribute('data-reading-guide-level');
    if(dataLevel){
      const parsed = parseInt(dataLevel, 10);
      if(!Number.isNaN(parsed) && parsed >= 1 && parsed <= 6){ return parsed; }
    }
    const ariaLevel = heading.getAttribute('aria-level');
    if(ariaLevel){
      const parsed = parseInt(ariaLevel, 10);
      if(!Number.isNaN(parsed) && parsed >= 1 && parsed <= 6){ return parsed; }
    }
    const tag = typeof heading.tagName === 'string' ? heading.tagName.toUpperCase() : '';
    const match = /^H([1-6])$/.exec(tag);
    if(match){ return parseInt(match[1], 10); }
    return 6;
  }

  function isReadingGuideHeadingCandidate(element, selector){
    if(!(element instanceof Element)){ return false; }
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if(/^H[1-6]$/.test(tag)){ return true; }
    if(element.hasAttribute('data-reading-guide-level')){ return true; }
    if(element.getAttribute && element.getAttribute('role') === 'heading'){ return true; }
    if(selector){
      try {
        if(element.matches(selector)){ return true; }
      } catch(err){ /* ignore */ }
    }
    return false;
  }

  function extractReadingGuideSectionSummary(heading, selector){
    if(!(heading instanceof Element)){ return ''; }
    const maxLength = 320;
    const preferredSelectors = [
      '[data-reading-guide-summary]',
      'p',
      'li',
      '[role="paragraph"]'
    ];
    const currentLevel = getReadingGuideHeadingLevel(heading);
    let sibling = heading.nextElementSibling;
    const collected = [];
    while(sibling){
      if(isReadingGuideHeadingCandidate(sibling, selector)){
        const siblingLevel = getReadingGuideHeadingLevel(sibling);
        if(siblingLevel <= currentLevel){ break; }
      }
      let text = '';
      if(sibling.hasAttribute && sibling.hasAttribute('data-reading-guide-summary')){
        text = sibling.getAttribute('data-reading-guide-summary') || sibling.textContent || '';
      } else {
        const target = preferredSelectors.reduce((found, sel) => {
          if(found){ return found; }
          try {
            return sibling.matches(sel) ? sibling : sibling.querySelector(sel);
          } catch(err){
            return found;
          }
        }, null);
        if(target){ text = target.textContent || ''; }
      }
      text = text.replace(/\s+/g, ' ').trim();
      if(text){
        collected.push(text);
        if(collected.join(' ').length >= maxLength){ break; }
      }
      sibling = sibling.nextElementSibling;
    }
    if(!collected.length){ return ''; }
    const full = collected.join(' ').replace(/\s+/g, ' ').trim();
    if(!full){ return ''; }
    if(full.length <= maxLength){ return full; }
    const clipped = full.slice(0, maxLength);
    const trimmed = clipped.replace(/[,;:\-\s]+\S*$/, '').trim();
    const safe = trimmed || clipped.trim();
    return safe ? `${safe}…` : '';
  }

  function buildReadingGuideSummaryTree(headings, selector){
    const nodes = [];
    const stack = [];
    headings.forEach((heading, index) => {
      const level = getReadingGuideHeadingLevel(heading);
      const node = {
        heading,
        level,
        index,
        children: [],
        summary: extractReadingGuideSectionSummary(heading, selector)
      };
      while(stack.length && stack[stack.length - 1].level >= level){
        stack.pop();
      }
      if(!stack.length){
        nodes.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    });
    return nodes;
  }

  function createReadingGuideSummaryList(nodes){
    const list = document.createElement('ol');
    list.className = 'a11y-reading-guide-summary__list';
    nodes.forEach(node => {
      const heading = node.heading;
      const id = ensureReadingGuideHeadingId(heading, node.index);
      const text = heading.textContent || heading.getAttribute('aria-label') || id;
      const item = document.createElement('li');
      item.className = 'a11y-reading-guide-summary__item';
      const link = document.createElement('a');
      link.className = 'a11y-reading-guide-summary__link';
      link.href = `#${id}`;
      link.textContent = text.replace(/\s+/g, ' ').trim();
      item.appendChild(link);
      if(node.summary){
        const excerpt = document.createElement('p');
        excerpt.className = 'a11y-reading-guide-summary__excerpt';
        excerpt.textContent = node.summary;
        item.appendChild(excerpt);
      }
      if(node.children.length){
        const childList = createReadingGuideSummaryList(node.children);
        childList.setAttribute('aria-label', link.textContent);
        item.appendChild(childList);
      }
      list.appendChild(item);
    });
    return list;
  }

  function buildReadingGuideSummary(container, headings, selector){
    if(!container){ return; }
    container.classList.add('a11y-reading-guide-summary');
    container.innerHTML = '';
    const titleText = (typeof readingGuideSettings.summaryTitle === 'string' && readingGuideSettings.summaryTitle.trim())
      ? readingGuideSettings.summaryTitle.trim()
      : readingGuideTexts.summaryTitleFallback;
    if(titleText){
      const title = document.createElement('h2');
      title.className = 'a11y-reading-guide-summary__title';
      title.textContent = titleText;
      const titleAttr = getReadingGuideSelectorValue('tocTitleAttribute');
      if(titleAttr){ title.setAttribute(titleAttr, ''); }
      container.appendChild(title);
      container.setAttribute('aria-label', titleText);
    }
    container.setAttribute('role', 'navigation');
    const tree = buildReadingGuideSummaryTree(headings, selector);
    const list = createReadingGuideSummaryList(tree);
    container.appendChild(list);
    container.dataset.readingGuideSummary = 'on';
    readingGuideSummaryEl = container;
  }

  function clearReadingGuideSummary(){
    if(!readingGuideSummaryEl){ return; }
    if(readingGuideSummaryEl.dataset && readingGuideSummaryEl.dataset.readingGuideInjected === 'true'){
      readingGuideSummaryEl.remove();
    } else {
      readingGuideSummaryEl.innerHTML = '';
      if(readingGuideSummaryEl.dataset){
        delete readingGuideSummaryEl.dataset.readingGuideSummary;
      }
      readingGuideSummaryEl.classList.remove('a11y-reading-guide-summary');
    }
    readingGuideSummaryEl = null;
  }

  function getReadingGuideContentScopes(){
    const scopes = [];
    const seen = new Set();
    const addScope = node => {
      if(!node || seen.has(node)){ return; }
      seen.add(node);
      scopes.push(node);
    };

    const attrSelector = getReadingGuideAttributeSelector('contentAttribute');
    if(attrSelector){
      document.querySelectorAll(attrSelector).forEach(addScope);
    }

    document.querySelectorAll('[data-reading-guide-content]').forEach(addScope);

    const main = document.querySelector('main');
    if(main){ addScope(main); }

    if(document.body){ addScope(document.body); }

    return scopes.filter(Boolean);
  }

  function applyReadingGuideSummary(){
    clearReadingGuideSummary();
    if(!readingGuideActive || !readingGuideSettings.summaryEnabled){ return; }
    const selector = getReadingGuideHeadingSelector();
    if(!selector){ return; }
    const headings = [];
    const scopes = getReadingGuideContentScopes();
    scopes.forEach(scope => {
      if(!scope){ return; }
      let found = [];
      try {
        found = Array.from(scope.querySelectorAll(selector));
      } catch(err){
        found = [];
      }
      if(!found.length){
        try {
          found = Array.from(scope.querySelectorAll(READING_GUIDE_DEFAULT_SELECTORS.headings));
        } catch(err2){
          found = [];
        }
      }
      if(!found.length){
        try {
          found = Array.from(scope.querySelectorAll(READING_GUIDE_GLOBAL_HEADINGS));
        } catch(err3){
          found = [];
        }
      }
      found.forEach(node => {
        if(!(node instanceof Element)){ return; }
        if(node.closest('#a11y-widget-root')){ return; }
        if(!headings.includes(node)){ headings.push(node); }
      });
    });
    if(!headings.length){ return; }
    const container = resolveReadingGuideSummaryContainer();
    if(!container){ return; }
    buildReadingGuideSummary(container, headings, selector);
  }

  function syllabifyReadingGuideWord(word){
    if(typeof word !== 'string' || word.length < 6){ return word; }
    const pattern = /([aeiouyàâäéèêëîïôöùûüœ])([bcdfghjklmnpqrstvwxz]{1,2})(?=[aeiouyàâäéèêëîïôöùûüœ])/gi;
    let result = word.replace(pattern, '$1·$2');
    if(result === word){
      const mid = Math.floor(word.length / 2);
      result = `${word.slice(0, mid)}·${word.slice(mid)}`;
    }
    return result;
  }

  function insertReadingGuideMiddots(text){
    if(typeof text !== 'string' || !text.trim()){ return text; }
    return text.replace(/([A-Za-zÀ-ÖØ-öø-ÿ]{4,})/g, match => syllabifyReadingGuideWord(match));
  }

  function applyReadingGuideSyllablesToElement(element){
    if(!element || !(element instanceof Element)){ return; }
    const skipContainers = ['#a11y-widget-root', '#a11y-overlay'];
    if(element.closest && skipContainers.some(sel => element.closest(sel))){ return; }
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node || !node.textContent || !node.textContent.trim()){ return NodeFilter.FILTER_REJECT; }
        const parent = node.parentElement;
        if(parent && parent.closest('#a11y-widget-root')){ return NodeFilter.FILTER_REJECT; }
        if(parent && ['script','style','code','pre','noscript','textarea'].includes(parent.nodeName.toLowerCase())){
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let current = walker.nextNode();
    while(current){
      nodes.push(current);
      current = walker.nextNode();
    }
    nodes.forEach(node => {
      if(readingGuideTextNodes.has(node)){ return; }
      const original = node.textContent;
      const transformed = insertReadingGuideMiddots(original);
      if(transformed !== original){
        readingGuideTextNodes.set(node, original);
        node.textContent = transformed;
      }
    });
  }

  function clearReadingGuideSyllables(){
    readingGuideTextNodes.forEach((original, node) => {
      if(node && node.textContent !== original){
        node.textContent = original;
      }
    });
    readingGuideTextNodes.clear();
  }

  function applyReadingGuideSyllables(){
    clearReadingGuideSyllables();
    if(!readingGuideActive || !readingGuideSettings.syllableEnabled){ return; }
    const selector = getReadingGuideSyllableSelector();
    const elements = new Set();
    if(selector){
      try {
        document.querySelectorAll(selector).forEach(el => elements.add(el));
      } catch(err){ /* ignore invalid selector */ }
    }
    const attrSelector = getReadingGuideAttributeSelector('syllableAttribute');
    if(attrSelector){
      document.querySelectorAll(attrSelector).forEach(el => elements.add(el));
    }
    if(!elements.size){
      document.querySelectorAll(READING_GUIDE_DEFAULTS.syllableSelector).forEach(el => elements.add(el));
    }
    elements.forEach(el => applyReadingGuideSyllablesToElement(el));
  }

  function applyReadingGuideFocusMode(enabled){
    const rootEl = document.documentElement;
    if(!rootEl){ return; }
    if(enabled){
      rootEl.classList.add('a11y-reading-guide-focus');
      rootEl.dataset.a11yReadingGuideFocus = 'on';
      readingGuideFocusClassApplied = true;
    } else {
      rootEl.classList.remove('a11y-reading-guide-focus');
      delete rootEl.dataset.a11yReadingGuideFocus;
      readingGuideFocusClassApplied = false;
    }
  }

  function setReadingGuideSetting(key, value, options = {}){
    if(!Object.prototype.hasOwnProperty.call(readingGuideSettings, key)){ return; }
    const { persist = true, syncUI = true, apply = true } = options;
    let next = value;
    switch(key){
      case 'color':
        next = normalizeReadingGuideColor(value);
        break;
      case 'opacity':
        next = clampReadingGuideOpacity(value);
        break;
      case 'height':
        next = clampReadingGuideHeight(value);
        break;
      case 'summaryEnabled':
      case 'syllableEnabled':
      case 'focusEnabled':
        next = !!value;
        break;
      case 'summarySelector':
      case 'summaryContainer':
      case 'summaryTitle':
      case 'syllableSelector':
        next = typeof value === 'string' ? value : '';
        break;
      default:
        break;
    }
    if(readingGuideSettings[key] === next){
      if(syncUI){ syncReadingGuideInstances(); }
      return;
    }
    readingGuideSettings[key] = next;
    if(persist){ persistReadingGuideSettings(); }
    if(apply && readingGuideActive){
      if(key === 'color' || key === 'opacity' || key === 'height'){
        applyReadingGuideStyles();
        refreshReadingGuideOverlay();
      }
      if(key === 'summaryEnabled' || key === 'summarySelector' || key === 'summaryContainer' || key === 'summaryTitle'){
        applyReadingGuideSummary();
      }
      if(key === 'syllableEnabled' || key === 'syllableSelector'){
        applyReadingGuideSyllables();
      }
      if(key === 'focusEnabled'){
        applyReadingGuideFocusMode(readingGuideSettings.focusEnabled);
      }
    }
    if(syncUI){ syncReadingGuideInstances(); }
  }

  function pruneReadingGuideInstances(){
    readingGuideInstances.forEach(instance => {
      if(!instance){ readingGuideInstances.delete(instance); return; }
      if(instance.wasConnected && (!instance.article || !instance.article.isConnected)){
        readingGuideInstances.delete(instance);
      }
    });
  }

  function updateReadingGuideInstanceUI(instance){
    if(!instance){ return; }
    const {
      article,
      controls,
      colorInput,
      opacitySlider,
      opacityValue,
      heightSlider,
      heightValue,
      summaryToggle,
      summaryAdvancedDetails,
      summarySelectorInput,
      summaryContainerInput,
      summaryTitleInput,
      syllableToggle,
      syllableSelectorInput,
      focusToggle,
      settings = {},
    } = instance;
    const active = readingGuideActive;
    const color = normalizeReadingGuideColor(readingGuideSettings.color);
    const opacity = clampReadingGuideOpacity(readingGuideSettings.opacity);
    const height = clampReadingGuideHeight(readingGuideSettings.height);
    if(article){
      if(article.isConnected){ instance.wasConnected = true; }
      article.classList.toggle('is-disabled', !active);
    }
    if(controls){
      controls.classList.toggle('is-disabled', !active);
      if(!active){ controls.setAttribute('aria-disabled', 'true'); }
      else { controls.removeAttribute('aria-disabled'); }
    }
    if(colorInput){
      colorInput.disabled = !active;
      setInputValue(colorInput, color);
      if(settings.color_hint){ colorInput.setAttribute('title', settings.color_hint); }
    }
    if(opacitySlider){
      opacitySlider.disabled = !active;
      setInputValue(opacitySlider, String(opacity));
    }
    if(opacityValue){
      opacityValue.textContent = Math.round(opacity * 100) + '%';
    }
    if(heightSlider){
      heightSlider.disabled = !active;
      setInputValue(heightSlider, String(height));
    }
    if(heightValue){
      heightValue.textContent = `${height}px`;
    }
    if(summaryToggle){
      summaryToggle.disabled = !active;
      setCheckboxState(summaryToggle, !!readingGuideSettings.summaryEnabled);
    }
    const summaryBaseDisabled = !active || !readingGuideSettings.summaryEnabled;
    let summaryAdvancedEnabled = true;
    if(summaryAdvancedDetails){
      summaryAdvancedDetails.classList.toggle('is-disabled', summaryBaseDisabled);
      if(summaryBaseDisabled){ summaryAdvancedDetails.setAttribute('data-disabled', 'true'); }
      else { summaryAdvancedDetails.removeAttribute('data-disabled'); }
      if(summaryBaseDisabled && summaryAdvancedDetails.open){ summaryAdvancedDetails.open = false; }
      summaryAdvancedEnabled = summaryAdvancedDetails.open && !summaryBaseDisabled;
    }
    const summaryInputsDisabled = summaryBaseDisabled || !summaryAdvancedEnabled;
    if(summarySelectorInput){
      summarySelectorInput.disabled = summaryInputsDisabled;
      setInputValue(summarySelectorInput, readingGuideSettings.summarySelector || '');
      if(settings.summary_selector_placeholder){ summarySelectorInput.setAttribute('placeholder', settings.summary_selector_placeholder); }
    }
    if(summaryContainerInput){
      summaryContainerInput.disabled = summaryInputsDisabled;
      setInputValue(summaryContainerInput, readingGuideSettings.summaryContainer || '');
      if(settings.summary_container_placeholder){ summaryContainerInput.setAttribute('placeholder', settings.summary_container_placeholder); }
    }
    if(summaryTitleInput){
      summaryTitleInput.disabled = summaryInputsDisabled;
      setInputValue(summaryTitleInput, readingGuideSettings.summaryTitle || '');
      if(settings.summary_title_placeholder){ summaryTitleInput.setAttribute('placeholder', settings.summary_title_placeholder); }
    }
    if(syllableToggle){
      syllableToggle.disabled = !active;
      setCheckboxState(syllableToggle, !!readingGuideSettings.syllableEnabled);
    }
    if(syllableSelectorInput){
      syllableSelectorInput.disabled = !active || !readingGuideSettings.syllableEnabled;
      setInputValue(syllableSelectorInput, readingGuideSettings.syllableSelector || '');
      if(settings.syllable_selector_placeholder){ syllableSelectorInput.setAttribute('placeholder', settings.syllable_selector_placeholder); }
    }
    if(focusToggle){
      focusToggle.disabled = !active;
      setCheckboxState(focusToggle, !!readingGuideSettings.focusEnabled);
    }
  }

  function syncReadingGuideInstances(){
    pruneReadingGuideInstances();
    readingGuideInstances.forEach(instance => updateReadingGuideInstanceUI(instance));
  }

  function setReadingGuideActive(on){
    const desired = !!on;
    if(readingGuideActive === desired){
      if(desired){ refreshReadingGuideOverlay(); }
      syncReadingGuideInstances();
      return;
    }
    readingGuideActive = desired;
    if(desired){
      applyReadingGuideStyles();
      ensureReadingGuideOverlay();
      setReadingGuideOverlayVisibility(true);
      if(document.documentElement){
        document.documentElement.classList.add('a11y-reading-guide-enabled');
        document.documentElement.dataset.a11yReadingGuideActive = 'on';
      }
      setupReadingGuideListeners();
      applyReadingGuideSummary();
      applyReadingGuideSyllables();
      applyReadingGuideFocusMode(readingGuideSettings.focusEnabled);
      refreshReadingGuideOverlay();
    } else {
      removeReadingGuideListeners();
      clearReadingGuideSummary();
      clearReadingGuideSyllables();
      applyReadingGuideFocusMode(false);
      if(readingGuideOverlayEl){
        readingGuideOverlayEl.remove();
        readingGuideOverlayEl = null;
      }
      if(document.documentElement){
        document.documentElement.classList.remove('a11y-reading-guide-enabled');
        delete document.documentElement.dataset.a11yReadingGuideActive;
      }
    }
    syncReadingGuideInstances();
  }

  function createReadingGuideCard(feature){
    if(!feature || typeof feature.slug !== 'string' || !feature.slug){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card a11y-card--reading-guide';
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
    header.className = 'a11y-reading-guide__header';
    header.appendChild(meta);

    const switchEl = buildSwitch(feature.slug, feature.aria_label || feature.label || '');
    if(switchEl){
      switchEl.classList.add('a11y-reading-guide__switch');
      header.appendChild(switchEl);
    }

    article.appendChild(header);

    const settings = feature.settings && typeof feature.settings === 'object' ? feature.settings : {};
    updateReadingGuideSelectors(settings);
    updateReadingGuideTexts(settings);

    const controls = document.createElement('form');
    controls.className = 'a11y-reading-guide__controls';
    controls.setAttribute('data-role', 'reading-guide-controls');
    controls.addEventListener('submit', event => { event.preventDefault(); });
    article.appendChild(controls);

    const ruleSection = document.createElement('fieldset');
    ruleSection.className = 'a11y-reading-guide__section';
    const ruleLegend = document.createElement('legend');
    ruleLegend.className = 'a11y-reading-guide__legend';
    ruleLegend.textContent = settings.rule_label || '';
    ruleSection.appendChild(ruleLegend);
    if(settings.rule_hint){
      const ruleHint = document.createElement('p');
      ruleHint.className = 'a11y-reading-guide__hint';
      ruleHint.textContent = settings.rule_hint;
      ruleSection.appendChild(ruleHint);
    }

    if(settings.personalization_label){
      const personalization = document.createElement('p');
      personalization.className = 'a11y-reading-guide__subheading';
      personalization.textContent = settings.personalization_label;
      ruleSection.appendChild(personalization);
    }

    const colorField = document.createElement('div');
    colorField.className = 'a11y-reading-guide__field';
    const colorLabel = document.createElement('label');
    colorLabel.className = 'a11y-reading-guide__label';
    colorLabel.textContent = settings.color_label || '';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'a11y-reading-guide__input a11y-reading-guide__input--color';
    colorLabel.appendChild(colorInput);
    colorField.appendChild(colorLabel);
    if(settings.color_hint){
      const colorHint = document.createElement('p');
      colorHint.className = 'a11y-reading-guide__hint';
      colorHint.textContent = settings.color_hint;
      colorField.appendChild(colorHint);
    }
    ruleSection.appendChild(colorField);

    const opacityField = document.createElement('div');
    opacityField.className = 'a11y-reading-guide__field';
    const opacityLabel = document.createElement('label');
    opacityLabel.className = 'a11y-reading-guide__label';
    opacityLabel.textContent = settings.opacity_label || '';
    const opacityValue = document.createElement('span');
    opacityValue.className = 'a11y-reading-guide__value';
    opacityLabel.appendChild(opacityValue);
    opacityField.appendChild(opacityLabel);
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.className = 'a11y-reading-guide__slider';
    opacitySlider.min = String(READING_GUIDE_OPACITY_MIN);
    opacitySlider.max = String(READING_GUIDE_OPACITY_MAX);
    opacitySlider.step = String(READING_GUIDE_OPACITY_STEP);
    opacityField.appendChild(opacitySlider);
    if(settings.opacity_hint){
      const opacityHint = document.createElement('p');
      opacityHint.className = 'a11y-reading-guide__hint';
      opacityHint.textContent = settings.opacity_hint;
      opacityField.appendChild(opacityHint);
    }
    ruleSection.appendChild(opacityField);

    const heightField = document.createElement('div');
    heightField.className = 'a11y-reading-guide__field';
    const heightLabel = document.createElement('label');
    heightLabel.className = 'a11y-reading-guide__label';
    heightLabel.textContent = settings.height_label || '';
    const heightValue = document.createElement('span');
    heightValue.className = 'a11y-reading-guide__value';
    heightLabel.appendChild(heightValue);
    heightField.appendChild(heightLabel);
    const heightSlider = document.createElement('input');
    heightSlider.type = 'range';
    heightSlider.className = 'a11y-reading-guide__slider';
    heightSlider.min = String(READING_GUIDE_HEIGHT_MIN);
    heightSlider.max = String(READING_GUIDE_HEIGHT_MAX);
    heightSlider.step = String(READING_GUIDE_HEIGHT_STEP);
    heightField.appendChild(heightSlider);
    if(settings.height_hint){
      const heightHint = document.createElement('p');
      heightHint.className = 'a11y-reading-guide__hint';
      heightHint.textContent = settings.height_hint;
      heightField.appendChild(heightHint);
    }
    ruleSection.appendChild(heightField);

    controls.appendChild(ruleSection);

    const summarySection = document.createElement('fieldset');
    summarySection.className = 'a11y-reading-guide__section';
    const summaryLegend = document.createElement('legend');
    summaryLegend.className = 'a11y-reading-guide__legend';
    summaryLegend.textContent = settings.summary_label || '';
    summarySection.appendChild(summaryLegend);
    if(settings.summary_hint){
      const summaryHint = document.createElement('p');
      summaryHint.className = 'a11y-reading-guide__hint';
      summaryHint.textContent = settings.summary_hint;
      summarySection.appendChild(summaryHint);
    }
    const summaryToggleWrap = document.createElement('label');
    summaryToggleWrap.className = 'a11y-reading-guide__checkbox';
    const summaryToggle = document.createElement('input');
    summaryToggle.type = 'checkbox';
    summaryToggle.className = 'a11y-reading-guide__checkbox-input';
    summaryToggleWrap.appendChild(summaryToggle);
    const summaryToggleText = document.createElement('span');
    summaryToggleText.textContent = settings.summary_toggle_label || settings.summary_label || '';
    summaryToggleWrap.appendChild(summaryToggleText);
    summarySection.appendChild(summaryToggleWrap);

    const summaryAdvancedDetails = document.createElement('details');
    summaryAdvancedDetails.className = 'a11y-reading-guide__advanced';
    const summaryAdvancedSummary = document.createElement('summary');
    summaryAdvancedSummary.className = 'a11y-reading-guide__advanced-summary';
    summaryAdvancedSummary.textContent = settings.summary_advanced_label || 'Options avancées';
    summaryAdvancedDetails.appendChild(summaryAdvancedSummary);
    const summaryAdvancedContent = document.createElement('div');
    summaryAdvancedContent.className = 'a11y-reading-guide__advanced-content';
    summaryAdvancedDetails.appendChild(summaryAdvancedContent);

    const summarySelectorField = document.createElement('div');
    summarySelectorField.className = 'a11y-reading-guide__field';
    const summarySelectorLabel = document.createElement('label');
    summarySelectorLabel.className = 'a11y-reading-guide__label';
    summarySelectorLabel.textContent = settings.summary_selector_label || '';
    const summarySelectorInput = document.createElement('input');
    summarySelectorInput.type = 'text';
    summarySelectorInput.className = 'a11y-reading-guide__input';
    summarySelectorLabel.appendChild(summarySelectorInput);
    summarySelectorField.appendChild(summarySelectorLabel);
    if(settings.summary_selector_hint){
      const summarySelectorHint = document.createElement('p');
      summarySelectorHint.className = 'a11y-reading-guide__hint';
      summarySelectorHint.textContent = settings.summary_selector_hint;
      summarySelectorField.appendChild(summarySelectorHint);
    }
    summaryAdvancedContent.appendChild(summarySelectorField);

    const summaryContainerField = document.createElement('div');
    summaryContainerField.className = 'a11y-reading-guide__field';
    const summaryContainerLabel = document.createElement('label');
    summaryContainerLabel.className = 'a11y-reading-guide__label';
    summaryContainerLabel.textContent = settings.summary_container_label || '';
    const summaryContainerInput = document.createElement('input');
    summaryContainerInput.type = 'text';
    summaryContainerInput.className = 'a11y-reading-guide__input';
    summaryContainerLabel.appendChild(summaryContainerInput);
    summaryContainerField.appendChild(summaryContainerLabel);
    if(settings.summary_container_hint){
      const summaryContainerHint = document.createElement('p');
      summaryContainerHint.className = 'a11y-reading-guide__hint';
      summaryContainerHint.textContent = settings.summary_container_hint;
      summaryContainerField.appendChild(summaryContainerHint);
    }
    summaryAdvancedContent.appendChild(summaryContainerField);

    const summaryTitleField = document.createElement('div');
    summaryTitleField.className = 'a11y-reading-guide__field';
    const summaryTitleLabel = document.createElement('label');
    summaryTitleLabel.className = 'a11y-reading-guide__label';
    summaryTitleLabel.textContent = settings.summary_title_label || '';
    const summaryTitleInput = document.createElement('input');
    summaryTitleInput.type = 'text';
    summaryTitleInput.className = 'a11y-reading-guide__input';
    summaryTitleLabel.appendChild(summaryTitleInput);
    summaryTitleField.appendChild(summaryTitleLabel);
    summaryAdvancedContent.appendChild(summaryTitleField);

    summarySection.appendChild(summaryAdvancedDetails);

    controls.appendChild(summarySection);

    const syllableSection = document.createElement('fieldset');
    syllableSection.className = 'a11y-reading-guide__section';
    const syllableLegend = document.createElement('legend');
    syllableLegend.className = 'a11y-reading-guide__legend';
    syllableLegend.textContent = settings.syllable_label || '';
    syllableSection.appendChild(syllableLegend);
    if(settings.syllable_hint){
      const syllableHint = document.createElement('p');
      syllableHint.className = 'a11y-reading-guide__hint';
      syllableHint.textContent = settings.syllable_hint;
      syllableSection.appendChild(syllableHint);
    }
    const syllableToggleWrap = document.createElement('label');
    syllableToggleWrap.className = 'a11y-reading-guide__checkbox';
    const syllableToggle = document.createElement('input');
    syllableToggle.type = 'checkbox';
    syllableToggle.className = 'a11y-reading-guide__checkbox-input';
    syllableToggleWrap.appendChild(syllableToggle);
    const syllableToggleText = document.createElement('span');
    syllableToggleText.textContent = settings.syllable_toggle_label || settings.syllable_label || '';
    syllableToggleWrap.appendChild(syllableToggleText);
    syllableSection.appendChild(syllableToggleWrap);

    const syllableSelectorField = document.createElement('div');
    syllableSelectorField.className = 'a11y-reading-guide__field';
    const syllableSelectorLabel = document.createElement('label');
    syllableSelectorLabel.className = 'a11y-reading-guide__label';
    syllableSelectorLabel.textContent = settings.syllable_selector_label || '';
    const syllableSelectorInput = document.createElement('input');
    syllableSelectorInput.type = 'text';
    syllableSelectorInput.className = 'a11y-reading-guide__input';
    syllableSelectorLabel.appendChild(syllableSelectorInput);
    syllableSelectorField.appendChild(syllableSelectorLabel);
    if(settings.syllable_selector_hint){
      const syllableSelectorHint = document.createElement('p');
      syllableSelectorHint.className = 'a11y-reading-guide__hint';
      syllableSelectorHint.textContent = settings.syllable_selector_hint;
      syllableSelectorField.appendChild(syllableSelectorHint);
    }
    syllableSection.appendChild(syllableSelectorField);
    controls.appendChild(syllableSection);

    const focusSection = document.createElement('fieldset');
    focusSection.className = 'a11y-reading-guide__section';
    const focusLegend = document.createElement('legend');
    focusLegend.className = 'a11y-reading-guide__legend';
    focusLegend.textContent = settings.focus_label || '';
    focusSection.appendChild(focusLegend);
    if(settings.focus_hint){
      const focusHint = document.createElement('p');
      focusHint.className = 'a11y-reading-guide__hint';
      focusHint.textContent = settings.focus_hint;
      focusSection.appendChild(focusHint);
    }
    const focusToggleWrap = document.createElement('label');
    focusToggleWrap.className = 'a11y-reading-guide__checkbox';
    const focusToggle = document.createElement('input');
    focusToggle.type = 'checkbox';
    focusToggle.className = 'a11y-reading-guide__checkbox-input';
    focusToggleWrap.appendChild(focusToggle);
    const focusToggleText = document.createElement('span');
    focusToggleText.textContent = settings.focus_toggle_label || settings.focus_label || '';
    focusToggleWrap.appendChild(focusToggleText);
    focusSection.appendChild(focusToggleWrap);
    controls.appendChild(focusSection);

    const instance = {
      article,
      controls,
      colorInput,
      opacitySlider,
      opacityValue,
      heightSlider,
      heightValue,
      summaryToggle,
      summaryAdvancedDetails,
      summarySelectorInput,
      summaryContainerInput,
      summaryTitleInput,
      syllableToggle,
      syllableSelectorInput,
      focusToggle,
      settings,
      wasConnected: false,
    };

    if(summaryAdvancedDetails){
      summaryAdvancedDetails.addEventListener('toggle', () => updateReadingGuideInstanceUI(instance));
    }

    readingGuideInstances.add(instance);
    syncReadingGuideInstances();

    const markConnection = () => {
      if(instance.article && instance.article.isConnected){ instance.wasConnected = true; }
    };
    if(typeof requestAnimationFrame === 'function'){ requestAnimationFrame(markConnection); }
    else { setTimeout(markConnection, 0); }

    colorInput.addEventListener('input', () => setReadingGuideSetting('color', colorInput.value, { persist: false, syncUI: false }));
    colorInput.addEventListener('change', () => setReadingGuideSetting('color', colorInput.value));

    opacitySlider.addEventListener('input', () => setReadingGuideSetting('opacity', opacitySlider.value, { persist: false, syncUI: false }));
    opacitySlider.addEventListener('change', () => setReadingGuideSetting('opacity', opacitySlider.value));

    heightSlider.addEventListener('input', () => setReadingGuideSetting('height', heightSlider.value, { persist: false, syncUI: false }));
    heightSlider.addEventListener('change', () => setReadingGuideSetting('height', heightSlider.value));

    summaryToggle.addEventListener('change', () => setReadingGuideSetting('summaryEnabled', summaryToggle.checked));

    summarySelectorInput.addEventListener('input', () => setReadingGuideSetting('summarySelector', summarySelectorInput.value, { persist: false, apply: false }));
    summarySelectorInput.addEventListener('change', () => setReadingGuideSetting('summarySelector', summarySelectorInput.value));

    summaryContainerInput.addEventListener('input', () => setReadingGuideSetting('summaryContainer', summaryContainerInput.value, { persist: false, apply: false }));
    summaryContainerInput.addEventListener('change', () => setReadingGuideSetting('summaryContainer', summaryContainerInput.value));

    summaryTitleInput.addEventListener('input', () => setReadingGuideSetting('summaryTitle', summaryTitleInput.value, { persist: false, apply: false }));
    summaryTitleInput.addEventListener('change', () => setReadingGuideSetting('summaryTitle', summaryTitleInput.value));

    syllableToggle.addEventListener('change', () => setReadingGuideSetting('syllableEnabled', syllableToggle.checked));

    syllableSelectorInput.addEventListener('input', () => setReadingGuideSetting('syllableSelector', syllableSelectorInput.value, { persist: false, apply: false }));
    syllableSelectorInput.addEventListener('change', () => setReadingGuideSetting('syllableSelector', syllableSelectorInput.value));

    focusToggle.addEventListener('change', () => setReadingGuideSetting('focusEnabled', focusToggle.checked));

    return article;
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
    const {
      article,
      controls,
      letterInput,
      colorInput,
      accentInput,
      message,
      fontSelect,
      sizeSlider,
      sizeValue,
      lineSlider,
      lineValue,
      italicInput,
      boldInput,
      resetButton,
      settings = {},
    } = instance;
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
    if(fontSelect){
      fontSelect.disabled = !active;
      setInputValue(fontSelect, normalizeDyslexiaFont(dyslexiaSettings.font));
      if(fontSelect.dataset.helpTarget){
        const helpEl = document.getElementById(fontSelect.dataset.helpTarget);
        if(helpEl){
          const helpText = typeof settings.font_help === 'string' ? settings.font_help : '';
          helpEl.textContent = helpText;
          helpEl.hidden = !helpText;
        }
      }
    }
    if(sizeSlider){
      sizeSlider.disabled = !active;
      setInputValue(sizeSlider, String(clampDyslexiaFontSize(dyslexiaSettings.fontSize)));
    }
    if(sizeValue){
      sizeValue.textContent = formatDyslexiaFontSize(dyslexiaSettings.fontSize);
    }
    if(lineSlider){
      lineSlider.disabled = !active;
      setInputValue(lineSlider, String(clampDyslexiaLineHeight(dyslexiaSettings.lineHeight)));
    }
    if(lineValue){
      lineValue.textContent = formatDyslexiaLineHeight(dyslexiaSettings.lineHeight);
    }
    if(italicInput){
      italicInput.disabled = !active;
      setCheckboxState(italicInput, !!dyslexiaSettings.disableItalic);
    }
    if(boldInput){
      boldInput.disabled = !active;
      setCheckboxState(boldInput, !!dyslexiaSettings.disableBold);
    }
    if(resetButton){
      resetButton.disabled = !active;
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
    if(parent.closest && (parent.closest('#a11y-overlay') || parent.closest('#a11y-widget-root') || parent.closest('#a11y-launcher'))){
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

  function setDyslexiaFont(value, options = {}){
    const next = normalizeDyslexiaFont(value);
    const changed = dyslexiaSettings.font !== next;
    dyslexiaSettings.font = next;
    if(changed || options.force){
      updateDyslexiaStyles();
      syncDyslexiaInstances();
      if(options.persist !== false){ persistDyslexiaSettings(); }
    } else if(options.syncOnly){
      syncDyslexiaInstances();
    }
  }

  function setDyslexiaFontSize(value, options = {}){
    const next = clampDyslexiaFontSize(value);
    const changed = clampDyslexiaFontSize(dyslexiaSettings.fontSize) !== next;
    dyslexiaSettings.fontSize = next;
    if(changed || options.force){
      updateDyslexiaStyles();
      syncDyslexiaInstances();
      if(options.persist !== false){ persistDyslexiaSettings(); }
    } else if(options.syncOnly){
      syncDyslexiaInstances();
    }
  }

  function setDyslexiaLineHeight(value, options = {}){
    const next = clampDyslexiaLineHeight(value);
    const changed = clampDyslexiaLineHeight(dyslexiaSettings.lineHeight) !== next;
    dyslexiaSettings.lineHeight = next;
    if(changed || options.force){
      updateDyslexiaStyles();
      syncDyslexiaInstances();
      if(options.persist !== false){ persistDyslexiaSettings(); }
    } else if(options.syncOnly){
      syncDyslexiaInstances();
    }
  }

  function setDyslexiaDisableItalic(value, options = {}){
    const next = !!value;
    const changed = !!dyslexiaSettings.disableItalic !== next;
    dyslexiaSettings.disableItalic = next;
    if(changed || options.force){
      updateDyslexiaStyles();
      syncDyslexiaInstances();
      if(options.persist !== false){ persistDyslexiaSettings(); }
    } else if(options.syncOnly){
      syncDyslexiaInstances();
    }
  }

  function setDyslexiaDisableBold(value, options = {}){
    const next = !!value;
    const changed = !!dyslexiaSettings.disableBold !== next;
    dyslexiaSettings.disableBold = next;
    if(changed || options.force){
      updateDyslexiaStyles();
      syncDyslexiaInstances();
      if(options.persist !== false){ persistDyslexiaSettings(); }
    } else if(options.syncOnly){
      syncDyslexiaInstances();
    }
  }

  function resetDyslexiaTypography(){
    dyslexiaSettings.font = DYSLEXIA_DEFAULTS.font;
    dyslexiaSettings.fontSize = DYSLEXIA_DEFAULTS.fontSize;
    dyslexiaSettings.lineHeight = DYSLEXIA_DEFAULTS.lineHeight;
    dyslexiaSettings.disableItalic = DYSLEXIA_DEFAULTS.disableItalic;
    dyslexiaSettings.disableBold = DYSLEXIA_DEFAULTS.disableBold;
    persistDyslexiaSettings();
    updateDyslexiaStyles();
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

  function handleDyslexiaFontInput(value){
    setDyslexiaFont(value, { force: true });
  }

  function handleDyslexiaFontSizeInput(value){
    setDyslexiaFontSize(value, { persist: false });
  }

  function handleDyslexiaFontSizeChange(value){
    setDyslexiaFontSize(value, { force: true });
  }

  function handleDyslexiaLineHeightInput(value){
    setDyslexiaLineHeight(value, { persist: false });
  }

  function handleDyslexiaLineHeightChange(value){
    setDyslexiaLineHeight(value, { force: true });
  }

  function handleDyslexiaItalicToggle(checked){
    setDyslexiaDisableItalic(checked, { force: true });
  }

  function handleDyslexiaBoldToggle(checked){
    setDyslexiaDisableBold(checked, { force: true });
  }

  function setDyslexiaActive(active){
    const next = !!active;
    if(dyslexiaActive === next){
      if(!next){ clearDyslexiaHighlights(); }
      updateDyslexiaStyles();
      syncDyslexiaInstances();
      return;
    }
    dyslexiaActive = next;
    if(dyslexiaActive){
      applyDyslexiaHighlights();
      updateDyslexiaHighlightColors();
      updateDyslexiaStyles();
    } else {
      clearDyslexiaHighlights();
      updateDyslexiaStyles();
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
      font_label: typeof settings.font_label === 'string' ? settings.font_label : '',
      font_help: typeof settings.font_help === 'string' ? settings.font_help : '',
      font_option_default: typeof settings.font_option_default === 'string' ? settings.font_option_default : '',
      font_option_arial: typeof settings.font_option_arial === 'string' ? settings.font_option_arial : '',
      font_option_verdana: typeof settings.font_option_verdana === 'string' ? settings.font_option_verdana : '',
      font_option_trebuchet: typeof settings.font_option_trebuchet === 'string' ? settings.font_option_trebuchet : '',
      font_option_comic: typeof settings.font_option_comic === 'string' ? settings.font_option_comic : '',
      size_label: typeof settings.size_label === 'string' ? settings.size_label : '',
      size_help: typeof settings.size_help === 'string' ? settings.size_help : '',
      line_label: typeof settings.line_label === 'string' ? settings.line_label : '',
      line_help: typeof settings.line_help === 'string' ? settings.line_help : '',
      styles_label: typeof settings.styles_label === 'string' ? settings.styles_label : '',
      styles_help: typeof settings.styles_help === 'string' ? settings.styles_help : '',
      disable_italic_label: typeof settings.disable_italic_label === 'string' ? settings.disable_italic_label : '',
      disable_bold_label: typeof settings.disable_bold_label === 'string' ? settings.disable_bold_label : '',
      reset_label: typeof settings.reset_label === 'string' ? settings.reset_label : '',
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

    const fontField = document.createElement('div');
    fontField.className = 'a11y-dyslexie__field';
    const fontLabel = document.createElement('label');
    const fontId = `${baseId}-font`;
    fontLabel.setAttribute('for', fontId);
    fontLabel.textContent = texts.font_label || '';
    const fontSelect = document.createElement('select');
    fontSelect.id = fontId;
    fontSelect.className = 'a11y-dyslexie__input a11y-dyslexie__input--select';
    const fontOptions = [
      { value: 'default', label: texts.font_option_default || 'Default' },
      { value: 'arial', label: texts.font_option_arial || 'Arial' },
      { value: 'verdana', label: texts.font_option_verdana || 'Verdana' },
      { value: 'trebuchet', label: texts.font_option_trebuchet || 'Trebuchet MS' },
      { value: 'comic', label: texts.font_option_comic || 'Comic Sans MS' },
      { value: 'open', label: texts.font_option_open || 'OpenDyslexic' },
      { value: 'dyslexic', label: texts.font_option_dyslexic || 'OpenDyslexic Alta' },
      { value: 'luciole', label: texts.font_option_luciole || 'Luciole' },
      { value: 'atkinson-hyperlegible', label: texts.font_option_atkinson || 'Atkinson Hyperlegible' },
      { value: 'inconstant-regular', label: texts.font_option_inconstant || 'Inconstant' },
      { value: 'accessible-dfa', label: texts.font_option_accessible_dfa || 'Accessible DfA' },
    ];
    fontOptions.forEach(option => {
      if(!option.label){ return; }
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      fontSelect.appendChild(opt);
    });
    fontSelect.value = normalizeDyslexiaFont(dyslexiaSettings.font);
    fontField.appendChild(fontLabel);
    fontField.appendChild(fontSelect);
    if(texts.font_help){
      const fontHelp = document.createElement('p');
      fontHelp.className = 'a11y-dyslexie__help';
      fontHelp.id = `${baseId}-font-help`;
      fontHelp.textContent = texts.font_help;
      fontField.appendChild(fontHelp);
      fontSelect.dataset.helpTarget = fontHelp.id;
      fontSelect.setAttribute('aria-describedby', fontHelp.id);
    }
    controls.appendChild(fontField);

    const sizeField = document.createElement('div');
    sizeField.className = 'a11y-dyslexie__field a11y-dyslexie__field--range';
    const sizeLabel = document.createElement('label');
    const sizeId = `${baseId}-font-size`;
    sizeLabel.setAttribute('for', sizeId);
    sizeLabel.textContent = texts.size_label || '';
    const sizeValue = document.createElement('span');
    sizeValue.className = 'a11y-dyslexie__value';
    sizeValue.textContent = formatDyslexiaFontSize(dyslexiaSettings.fontSize);
    sizeLabel.appendChild(sizeValue);
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.id = sizeId;
    sizeSlider.className = 'a11y-dyslexie__range';
    sizeSlider.min = String(DYSLEXIA_FONT_SIZE_MIN);
    sizeSlider.max = String(DYSLEXIA_FONT_SIZE_MAX);
    sizeSlider.step = String(DYSLEXIA_FONT_SIZE_STEP);
    sizeSlider.value = String(clampDyslexiaFontSize(dyslexiaSettings.fontSize));
    sizeField.appendChild(sizeLabel);
    sizeField.appendChild(sizeSlider);
    if(texts.size_help){
      const sizeHelp = document.createElement('p');
      sizeHelp.className = 'a11y-dyslexie__help';
      sizeHelp.textContent = texts.size_help;
      sizeField.appendChild(sizeHelp);
    }
    controls.appendChild(sizeField);

    const lineField = document.createElement('div');
    lineField.className = 'a11y-dyslexie__field a11y-dyslexie__field--range';
    const lineId = `${baseId}-line-height`;
    const lineLabel = document.createElement('label');
    lineLabel.setAttribute('for', lineId);
    lineLabel.textContent = texts.line_label || '';
    const lineValue = document.createElement('span');
    lineValue.className = 'a11y-dyslexie__value';
    lineValue.textContent = formatDyslexiaLineHeight(dyslexiaSettings.lineHeight);
    lineLabel.appendChild(lineValue);
    const lineSlider = document.createElement('input');
    lineSlider.type = 'range';
    lineSlider.id = lineId;
    lineSlider.className = 'a11y-dyslexie__range';
    lineSlider.min = String(DYSLEXIA_LINE_HEIGHT_MIN);
    lineSlider.max = String(DYSLEXIA_LINE_HEIGHT_MAX);
    lineSlider.step = String(DYSLEXIA_LINE_HEIGHT_STEP);
    lineSlider.value = String(clampDyslexiaLineHeight(dyslexiaSettings.lineHeight));
    lineField.appendChild(lineLabel);
    lineField.appendChild(lineSlider);
    if(texts.line_help){
      const lineHelp = document.createElement('p');
      lineHelp.className = 'a11y-dyslexie__help';
      lineHelp.textContent = texts.line_help;
      lineField.appendChild(lineHelp);
    }
    controls.appendChild(lineField);

    const stylesField = document.createElement('fieldset');
    stylesField.className = 'a11y-dyslexie__fieldset';
    const stylesLegend = document.createElement('legend');
    stylesLegend.className = 'a11y-dyslexie__legend';
    stylesLegend.textContent = texts.styles_label || '';
    stylesField.appendChild(stylesLegend);
    if(texts.styles_help){
      const stylesHelp = document.createElement('p');
      stylesHelp.className = 'a11y-dyslexie__help';
      stylesHelp.textContent = texts.styles_help;
      stylesField.appendChild(stylesHelp);
    }
    const stylesOptions = document.createElement('div');
    stylesOptions.className = 'a11y-dyslexie__style-options';
    const italicLabel = document.createElement('label');
    italicLabel.className = 'a11y-dyslexie__checkbox';
    const italicInput = document.createElement('input');
    italicInput.type = 'checkbox';
    italicInput.id = `${baseId}-remove-italic`;
    italicInput.className = 'a11y-dyslexie__checkbox-input';
    const italicText = document.createElement('span');
    italicText.textContent = texts.disable_italic_label || '';
    italicLabel.appendChild(italicInput);
    italicLabel.appendChild(italicText);
    stylesOptions.appendChild(italicLabel);
    const boldLabel = document.createElement('label');
    boldLabel.className = 'a11y-dyslexie__checkbox';
    const boldInput = document.createElement('input');
    boldInput.type = 'checkbox';
    boldInput.id = `${baseId}-remove-bold`;
    boldInput.className = 'a11y-dyslexie__checkbox-input';
    const boldText = document.createElement('span');
    boldText.textContent = texts.disable_bold_label || '';
    boldLabel.appendChild(boldInput);
    boldLabel.appendChild(boldText);
    stylesOptions.appendChild(boldLabel);
    italicInput.checked = !!dyslexiaSettings.disableItalic;
    boldInput.checked = !!dyslexiaSettings.disableBold;
    stylesField.appendChild(stylesOptions);
    controls.appendChild(stylesField);

    const message = document.createElement('p');
    message.className = 'a11y-dyslexie__message';
    message.id = `${baseId}-message`;
    message.hidden = true;
    if(texts.no_letter_warning){
      message.textContent = texts.no_letter_warning;
    }
    controls.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'a11y-dyslexie__actions';
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'a11y-dyslexie__reset';
    const resetText = texts.reset_label || 'Réinitialiser';
    resetButton.textContent = resetText;
    resetButton.setAttribute('aria-label', resetText);
    actions.appendChild(resetButton);
    controls.appendChild(actions);

    article.appendChild(controls);

    const instance = {
      article,
      controls,
      letterInput,
      colorInput,
      accentInput,
      fontSelect,
      sizeSlider,
      sizeValue,
      lineSlider,
      lineValue,
      italicInput,
      boldInput,
      resetButton,
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
    fontSelect.addEventListener('change', () => handleDyslexiaFontInput(fontSelect.value));
    sizeSlider.addEventListener('input', () => handleDyslexiaFontSizeInput(sizeSlider.value));
    sizeSlider.addEventListener('change', () => handleDyslexiaFontSizeChange(sizeSlider.value));
    lineSlider.addEventListener('input', () => handleDyslexiaLineHeightInput(lineSlider.value));
    lineSlider.addEventListener('change', () => handleDyslexiaLineHeightChange(lineSlider.value));
    italicInput.addEventListener('change', () => handleDyslexiaItalicToggle(italicInput.checked));
    boldInput.addEventListener('change', () => handleDyslexiaBoldToggle(boldInput.checked));
    resetButton.addEventListener('click', () => resetDyslexiaTypography());

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
    if(template === 'brightness-settings'){
      return createBrightnessCard(feature);
    }
    if(template === 'button-settings'){
      return createButtonCard(feature);
    }
    if(template === 'cursor-settings'){
      return createCursorCard(feature);
    }
    if(template === 'reading-guide'){
      return createReadingGuideCard(feature);
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
    if(!panel){ return; }
    lastFocused = document.activeElement;
    if(overlay){ overlay.setAttribute('aria-hidden','false'); }
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    if(root){ root.classList.add('is-open'); }
    document.body.style.overflow = 'hidden';
    if(btn){ btn.setAttribute('aria-expanded','true'); }
    // focus premier focusable
    const focusables = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    for (const el of focusables){ if(!el.hasAttribute('disabled') && el.offsetParent !== null){ el.focus(); break; } }
    panel.addEventListener('keydown', trap, true);
  }
  function closePanel(){
    disableSearchMode();
    if(overlay){ overlay.setAttribute('aria-hidden','true'); }
    if(panel){
      panel.setAttribute('aria-hidden', 'true');
      panel.hidden = true;
      panel.removeEventListener('keydown', trap, true);
    }
    if(root){ root.classList.remove('is-open'); }
    document.body.style.overflow = '';
    if(btn){ btn.setAttribute('aria-expanded','false'); }
    if(lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function trap(e){
    if(e.key === 'Escape'){ e.preventDefault(); closePanel(); return; }
    if(e.key !== 'Tab') return;
    if(!panel){ return; }
    const focusables = Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el=>!el.hasAttribute('disabled') && el.offsetParent !== null);
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
  Object.keys(COLORBLIND_FILTER_PRESETS).forEach(slug => {
    A11yAPI.registerFeature(slug, on => {
      if(on){ ensureVisualFilterStyleElement(); }
      setColorblindFilterState(slug, on);
    });
  });

  A11yAPI.registerFeature(BRIGHTNESS_SLUG, on => {
    if(on){ ensureVisualFilterStyleElement(); }
    setBrightnessActive(on);
  });

  A11yAPI.registerFeature(READING_GUIDE_SLUG, on => {
    setReadingGuideActive(on);
  });

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
      try { localStorage.removeItem(BRIGHTNESS_SETTINGS_KEY); } catch(err){}
      try { localStorage.removeItem(READING_GUIDE_SETTINGS_KEY); } catch(err){}
      document.documentElement.style.removeProperty('--a11y-launcher-x');
      document.documentElement.style.removeProperty('--a11y-launcher-y');
      launcherLastPos = null;
      hasCustomLauncherPosition = false;
      applyPanelSide('right');
      resetBrightnessSettings({ persist: false });
      resetButtonSettings({ persist: false });
      resetCursorSettings();
      resetReadingGuideSettings({ persist: false });
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
  const rootEl = document.getElementById('a11y-widget-root');
  const overlayEl = document.getElementById('a11y-overlay');
  if(!overlayEl || !rootEl) return;
  const launcherBtn = document.getElementById('a11y-launcher');
  function getPanel(){ return rootEl.querySelector('.a11y-panel'); }
  function open(){
    overlayEl.setAttribute('aria-hidden','false');
    const panelEl = getPanel();
    if(panelEl){
      panelEl.hidden = false;
      panelEl.setAttribute('aria-hidden', 'false');
    }
    rootEl.classList.add('is-open');
    document.body.style.overflow='hidden';
    if(launcherBtn){ launcherBtn.setAttribute('aria-expanded','true'); }
  }
  function close(){
    overlayEl.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    if(launcherBtn){ launcherBtn.setAttribute('aria-expanded','false'); }
    const panelEl = getPanel();
    if(panelEl){
      panelEl.classList.remove('is-searching');
      panelEl.hidden = true;
      panelEl.setAttribute('aria-hidden', 'true');
    }
    rootEl.classList.remove('is-open');
    const tablistEl = panelEl ? panelEl.querySelector('[data-role="section-tablist"]') : null;
    if(tablistEl){
      tablistEl.removeAttribute('hidden');
      tablistEl.removeAttribute('aria-hidden');
    }
    const resultsEl = panelEl ? panelEl.querySelector('[data-role="search-results"]') : null;
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
