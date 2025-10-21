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
    'vision-daltonisme-achromatopsie': { intensity: 0.5, grayscale: 1, contrastFactor: 1.2, brightnessFactor: 0.9 },
  };

  const COLORBLIND_ACHROMATOPSIA_SLUG = 'vision-daltonisme-achromatopsie';

  const COLORBLIND_EXCLUSIVE_GROUPS = [
    [
      'vision-daltonisme-deuteranopie',
      'vision-daltonisme-deuteranomalie',
    ],
    [
      'vision-daltonisme-protanopie',
      'vision-daltonisme-protanomalie',
    ],
    [
      'vision-daltonisme-tritanopie',
      'vision-daltonisme-tritanomalie',
    ],
  ];

  const COLORBLIND_CONTROLLED_SLUGS = (() => {
    const set = new Set([COLORBLIND_ACHROMATOPSIA_SLUG]);
    COLORBLIND_EXCLUSIVE_GROUPS.forEach(group => {
      if(!Array.isArray(group)){ return; }
      group.forEach(slug => {
        if(typeof slug === 'string' && slug){
          set.add(slug);
        }
      });
    });
    return set;
  })();

  const COLORBLIND_CONTROLLED_SET = new Set(COLORBLIND_CONTROLLED_SLUGS);
  let isUpdatingColorblindAvailability = false;

  const colorblindActiveFilters = new Set();
  const colorblindRootClasses = new Set();
  const COLORBLIND_TRITANOMALY_SLUG = 'vision-daltonisme-tritanomalie';
  const COLORBLIND_SETTINGS_STORAGE_KEY = 'a11y-widget-colorblind-settings:v1';
  const COLORBLIND_SENSITIVITY_OPTIONS = [
    { value: 'mild', label: 'L\u00e9ger' },
    { value: 'moderate', label: 'Mod\u00e9r\u00e9' },
    { value: 'severe', label: 'S\u00e9v\u00e8re' },
  ];
  const COLORBLIND_PHOTOPHOBIA_OPTIONS = COLORBLIND_SENSITIVITY_OPTIONS;
  const COLORBLIND_INTENSITY_RANGES = {
    'vision-daltonisme-deuteranopie': { min: 0.3, max: 1, step: 0.1 },
    'vision-daltonisme-deuteranomalie': { min: 0.2, max: 1, step: 0.1 },
    'vision-daltonisme-protanopie': { min: 0.3, max: 1, step: 0.1 },
    'vision-daltonisme-protanomalie': { min: 0.2, max: 1, step: 0.1 },
    'vision-daltonisme-tritanopie': { min: 0.3, max: 1, step: 0.1 },
    'vision-daltonisme-tritanomalie': { min: 0.2, max: 1, step: 0.1 },
    'vision-daltonisme-achromatopsie': { min: 0, max: 1, step: 0.1 },
  };
  const COLORBLIND_ACHROM_CONTROL_RANGES = {
    contrast: { min: 1, max: 1.8, step: 0.05 },
    brightness: { min: 0.6, max: 1.2, step: 0.05 },
    textScale: { min: 1, max: 2.5, step: 0.1 },
  };
  const COLORBLIND_SENSITIVITY_MULTIPLIERS = {
    mild: 0.7,
    moderate: 1,
    severe: 1.4,
  };
  const COLORBLIND_PHOTOPHOBIA_CONFIG = {
    mild: { brightnessFactor: 1, dimmingFactor: 0.8 },
    moderate: { brightnessFactor: 0.92, dimmingFactor: 1 },
    severe: { brightnessFactor: 0.85, dimmingFactor: 1.25 },
  };
  const COLORBLIND_DEFAULT_SETTINGS = (() => {
    const defaults = {};
    Object.keys(COLORBLIND_FILTER_PRESETS).forEach(slug => {
      const preset = COLORBLIND_FILTER_PRESETS[slug] || {};
      if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
        defaults[slug] = {
          intensity: typeof preset.intensity === 'number' ? preset.intensity : 0.5,
          photophobia: 'moderate',
          contrast: 1.2,
          brightness: 0.9,
          textScale: 2,
        };
      } else {
        defaults[slug] = {
          intensity: typeof preset.intensity === 'number' ? preset.intensity : 0.8,
        };
        if(slug === COLORBLIND_TRITANOMALY_SLUG){
          defaults[slug].sensitivity = 'moderate';
        }
      }
    });
    return defaults;
  })();
  let colorblindSettings = loadColorblindSettings();
  const colorblindControlRefs = new Map();
  let colorblindSettingsSaveTimer = null;
  let colorblindAchroDimmer = null;

  function cloneColorblindDefaults(){
    const defaults = {};
    Object.keys(COLORBLIND_DEFAULT_SETTINGS).forEach(slug => {
      defaults[slug] = Object.assign({}, COLORBLIND_DEFAULT_SETTINGS[slug]);
    });
    return defaults;
  }

  function getColorblindIntensityRange(slug){
    return COLORBLIND_INTENSITY_RANGES[slug] || { min: 0, max: 1, step: 0.1 };
  }

  function getColorblindDefaultIntensity(slug){
    const defaults = COLORBLIND_DEFAULT_SETTINGS[slug];
    return defaults && typeof defaults.intensity === 'number' ? defaults.intensity : 1;
  }

  function normalizeColorblindIntensity(slug, value){
    const range = getColorblindIntensityRange(slug);
    const fallback = getColorblindDefaultIntensity(slug);
    const numeric = Number(value);
    if(!Number.isFinite(numeric)){ return fallback; }
    return Math.min(range.max, Math.max(range.min, numeric));
  }

  function normalizeColorblindSensitivity(value){
    const key = typeof value === 'string' ? value.toLowerCase() : '';
    if(Object.prototype.hasOwnProperty.call(COLORBLIND_SENSITIVITY_MULTIPLIERS, key)){
      return key;
    }
    return 'moderate';
  }

  function getColorblindSensitivityMultiplier(level){
    return COLORBLIND_SENSITIVITY_MULTIPLIERS[normalizeColorblindSensitivity(level)] || 1;
  }

  function normalizeColorblindPhotophobia(value){
    const key = typeof value === 'string' ? value.toLowerCase() : '';
    if(Object.prototype.hasOwnProperty.call(COLORBLIND_PHOTOPHOBIA_CONFIG, key)){
      return key;
    }
    return 'moderate';
  }

  function getColorblindPhotophobiaSettings(level){
    return COLORBLIND_PHOTOPHOBIA_CONFIG[normalizeColorblindPhotophobia(level)] || COLORBLIND_PHOTOPHOBIA_CONFIG.moderate;
  }

  function getColorblindAchromDefault(key){
    const defaults = COLORBLIND_DEFAULT_SETTINGS[COLORBLIND_ACHROMATOPSIA_SLUG] || {};
    if(key === 'photophobia'){
      return defaults.photophobia || 'moderate';
    }
    const value = defaults[key];
    if(Number.isFinite(value)){ return value; }
    const range = COLORBLIND_ACHROM_CONTROL_RANGES[key];
    return range ? range.min : 1;
  }

  function normalizeColorblindAchromValue(key, value){
    if(key === 'photophobia'){ return normalizeColorblindPhotophobia(value); }
    const range = COLORBLIND_ACHROM_CONTROL_RANGES[key];
    if(!range){ return value; }
    const numeric = Number(value);
    if(!Number.isFinite(numeric)){ return getColorblindAchromDefault(key); }
    return Math.min(range.max, Math.max(range.min, numeric));
  }

  function formatColorblindPercentage(value){
    if(!Number.isFinite(value)){ return '0%'; }
    return `${Math.round(value * 100)}%`;
  }

  function formatColorblindDecimal(value, decimals = 2){
    if(!Number.isFinite(value)){ return '0'; }
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    const fixed = rounded.toFixed(decimals);
    return fixed.replace(/\.0+$|(?<=[^0])0+$/, '').replace(/\.$/, '');
  }

  function loadColorblindSettings(){
    const base = cloneColorblindDefaults();
    try {
      const raw = localStorage.getItem(COLORBLIND_SETTINGS_STORAGE_KEY);
      if(!raw){ return base; }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object'){ return base; }
      Object.keys(base).forEach(slug => {
        const stored = parsed[slug];
        if(!stored || typeof stored !== 'object'){ return; }
        if(Object.prototype.hasOwnProperty.call(stored, 'intensity')){
          base[slug].intensity = normalizeColorblindIntensity(slug, stored.intensity);
        }
        if(slug === COLORBLIND_TRITANOMALY_SLUG && Object.prototype.hasOwnProperty.call(stored, 'sensitivity')){
          base[slug].sensitivity = normalizeColorblindSensitivity(stored.sensitivity);
        }
        if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
          if(Object.prototype.hasOwnProperty.call(stored, 'photophobia')){
            base[slug].photophobia = normalizeColorblindPhotophobia(stored.photophobia);
          }
          if(Object.prototype.hasOwnProperty.call(stored, 'contrast')){
            base[slug].contrast = normalizeColorblindAchromValue('contrast', stored.contrast);
          }
          if(Object.prototype.hasOwnProperty.call(stored, 'brightness')){
            base[slug].brightness = normalizeColorblindAchromValue('brightness', stored.brightness);
          }
          if(Object.prototype.hasOwnProperty.call(stored, 'textScale')){
            base[slug].textScale = normalizeColorblindAchromValue('textScale', stored.textScale);
          }
        }
      });
    } catch(err){ /* ignore */ }
    return base;
  }

  function getOrCreateColorblindSettings(slug){
    if(!Object.prototype.hasOwnProperty.call(colorblindSettings, slug)){
      const defaults = COLORBLIND_DEFAULT_SETTINGS[slug] || {};
      colorblindSettings[slug] = Object.assign({}, defaults);
    }
    return colorblindSettings[slug];
  }

  function scheduleColorblindSettingsSave(){
    cancelScheduledColorblindSave();
    colorblindSettingsSaveTimer = setTimeout(() => {
      colorblindSettingsSaveTimer = null;
      saveColorblindSettings();
    }, 150);
  }

  function cancelScheduledColorblindSave(){
    if(colorblindSettingsSaveTimer){
      clearTimeout(colorblindSettingsSaveTimer);
      colorblindSettingsSaveTimer = null;
    }
  }

  function getSerializableColorblindSettings(){
    const serialized = {};
    Object.keys(COLORBLIND_DEFAULT_SETTINGS).forEach(slug => {
      const settings = colorblindSettings[slug];
      if(!settings){ return; }
      const entry = {};
      if(Object.prototype.hasOwnProperty.call(settings, 'intensity')){
        entry.intensity = normalizeColorblindIntensity(slug, settings.intensity);
      }
      if(slug === COLORBLIND_TRITANOMALY_SLUG){
        entry.sensitivity = normalizeColorblindSensitivity(settings.sensitivity);
      }
      if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
        entry.photophobia = normalizeColorblindPhotophobia(settings.photophobia);
        entry.contrast = normalizeColorblindAchromValue('contrast', settings.contrast);
        entry.brightness = normalizeColorblindAchromValue('brightness', settings.brightness);
        entry.textScale = normalizeColorblindAchromValue('textScale', settings.textScale);
      }
      serialized[slug] = entry;
    });
    return serialized;
  }

  function saveColorblindSettings(){
    cancelScheduledColorblindSave();
    try {
      localStorage.setItem(COLORBLIND_SETTINGS_STORAGE_KEY, JSON.stringify(getSerializableColorblindSettings()));
    } catch(err){ /* ignore */ }
  }

  function updateColorblindSettings(slug, partial, options = {}){
    const { forceRefresh = false, refresh = true, persist = true, forcePersist = false, updateUI = true } = options;
    const settings = getOrCreateColorblindSettings(slug);
    let changed = false;
    if(partial && typeof partial === 'object'){
      Object.keys(partial).forEach(key => {
        let normalized;
        if(key === 'intensity'){
          normalized = normalizeColorblindIntensity(slug, partial[key]);
        } else if(slug === COLORBLIND_TRITANOMALY_SLUG && key === 'sensitivity'){
          normalized = normalizeColorblindSensitivity(partial[key]);
        } else if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
          if(key === 'photophobia'){
            normalized = normalizeColorblindPhotophobia(partial[key]);
          } else if(key === 'contrast' || key === 'brightness' || key === 'textScale'){
            normalized = normalizeColorblindAchromValue(key, partial[key]);
          }
        }
        if(typeof normalized === 'undefined'){ return; }
        if(settings[key] !== normalized){
          settings[key] = normalized;
          changed = true;
        }
      });
    }
    if(updateUI){ updateColorblindControlDisplay(slug); }
    if(refresh && (changed || forceRefresh)){ refreshColorblindFilters(); }
    if(persist && (changed || forcePersist)){ scheduleColorblindSettingsSave(); }
    return settings;
  }

  function updateColorblindControlDisplay(slug){
    const refs = colorblindControlRefs.get(slug);
    if(!refs){ return; }
    const settings = getOrCreateColorblindSettings(slug);
    if(refs.intensityInput){
      const intensity = normalizeColorblindIntensity(slug, settings.intensity);
      if(settings.intensity !== intensity){ settings.intensity = intensity; }
      const display = formatColorblindPercentage(intensity);
      refs.intensityInput.value = `${intensity}`;
      refs.intensityInput.setAttribute('aria-valuetext', display);
      if(refs.intensityValue){ refs.intensityValue.textContent = display; }
    }
    if(refs.sensitivitySelect){
      const sensitivity = normalizeColorblindSensitivity(settings.sensitivity);
      if(settings.sensitivity !== sensitivity){ settings.sensitivity = sensitivity; }
      refs.sensitivitySelect.value = sensitivity;
    }
    if(refs.photophobiaSelect){
      const photophobia = normalizeColorblindPhotophobia(settings.photophobia);
      if(settings.photophobia !== photophobia){ settings.photophobia = photophobia; }
      refs.photophobiaSelect.value = photophobia;
    }
    if(refs.contrastInput){
      const contrast = normalizeColorblindAchromValue('contrast', settings.contrast);
      if(settings.contrast !== contrast){ settings.contrast = contrast; }
      const display = formatColorblindDecimal(contrast, 2);
      refs.contrastInput.value = `${contrast}`;
      refs.contrastInput.setAttribute('aria-valuetext', display);
      if(refs.contrastValue){ refs.contrastValue.textContent = display; }
    }
    if(refs.brightnessInput){
      const brightness = normalizeColorblindAchromValue('brightness', settings.brightness);
      if(settings.brightness !== brightness){ settings.brightness = brightness; }
      const display = formatColorblindDecimal(brightness, 2);
      refs.brightnessInput.value = `${brightness}`;
      refs.brightnessInput.setAttribute('aria-valuetext', display);
      if(refs.brightnessValue){ refs.brightnessValue.textContent = display; }
    }
    if(refs.textScaleInput){
      const textScale = normalizeColorblindAchromValue('textScale', settings.textScale);
      if(settings.textScale !== textScale){ settings.textScale = textScale; }
      const display = formatColorblindPercentage(textScale);
      refs.textScaleInput.value = `${textScale}`;
      refs.textScaleInput.setAttribute('aria-valuetext', display);
      if(refs.textScaleValue){ refs.textScaleValue.textContent = display; }
    }
  }

  function setColorblindControlsDisabled(slug, disabled){
    const refs = colorblindControlRefs.get(slug);
    if(!refs){ return; }
    [
      refs.intensityInput,
      refs.sensitivitySelect,
      refs.photophobiaSelect,
      refs.contrastInput,
      refs.brightnessInput,
      refs.textScaleInput,
    ].forEach(el => {
      if(el){ el.disabled = disabled; }
    });
  }

  function ensureColorblindAchroDimmer(){
    if(colorblindAchroDimmer && colorblindAchroDimmer.isConnected){ return colorblindAchroDimmer; }
    let dimmer = document.getElementById('a11y-colorblind-achro-dimmer');
    if(!dimmer){
      dimmer = document.createElement('div');
      dimmer.id = 'a11y-colorblind-achro-dimmer';
      dimmer.className = 'a11y-achro-dimmer';
    }
    if(document.body && !dimmer.isConnected){
      document.body.appendChild(dimmer);
    }
    colorblindAchroDimmer = dimmer;
    return dimmer;
  }

  function applyColorblindAchromatopsiaExtras(){
    if(!colorblindActiveFilters.has(COLORBLIND_ACHROMATOPSIA_SLUG)){
      if(colorblindAchroDimmer){ colorblindAchroDimmer.style.opacity = '0'; }
      document.documentElement.classList.remove('a11y-achromatopsia-text-boost');
      document.documentElement.style.removeProperty('--a11y-achrom-text-scale');
      return;
    }
    const settings = getOrCreateColorblindSettings(COLORBLIND_ACHROMATOPSIA_SLUG);
    const intensity = normalizeColorblindIntensity(COLORBLIND_ACHROMATOPSIA_SLUG, settings.intensity);
    const photophobia = getColorblindPhotophobiaSettings(settings.photophobia);
    const dimmer = ensureColorblindAchroDimmer();
    if(dimmer){
      const alpha = Math.min(0.9, Math.max(0, intensity * 0.6 * photophobia.dimmingFactor));
      dimmer.style.opacity = `${alpha}`;
    }
    const textScale = normalizeColorblindAchromValue('textScale', settings.textScale);
    if(textScale > 1.001){
      document.documentElement.classList.add('a11y-achromatopsia-text-boost');
      document.documentElement.style.setProperty('--a11y-achrom-text-scale', `${textScale}`);
    } else {
      document.documentElement.classList.remove('a11y-achromatopsia-text-boost');
      document.documentElement.style.removeProperty('--a11y-achrom-text-scale');
    }
  }

  function resetColorblindSettings(options = {}){
    const { persist = true } = options;
    cancelScheduledColorblindSave();
    colorblindSettings = cloneColorblindDefaults();
    colorblindControlRefs.forEach((_, slug) => updateColorblindControlDisplay(slug));
    if(persist){ saveColorblindSettings(); }
    refreshColorblindFilters();
  }

  function isManagedColorblindSlug(slug){
    return COLORBLIND_CONTROLLED_SET.has(slug);
  }

  function getActiveColorblindDisabledSlugs(){
    const disabled = new Set();
    const hasAchromatopsia = colorblindActiveFilters.has(COLORBLIND_ACHROMATOPSIA_SLUG);
    if(hasAchromatopsia){
      COLORBLIND_EXCLUSIVE_GROUPS.forEach(group => {
        if(!Array.isArray(group)){ return; }
        group.forEach(slug => {
          if(typeof slug === 'string' && slug){
            disabled.add(slug);
          }
        });
      });
      return disabled;
    }

    const hasOtherActive = Array.from(colorblindActiveFilters).some(slug => slug !== COLORBLIND_ACHROMATOPSIA_SLUG);
    if(hasOtherActive){
      disabled.add(COLORBLIND_ACHROMATOPSIA_SLUG);
    }

    COLORBLIND_EXCLUSIVE_GROUPS.forEach(group => {
      if(!Array.isArray(group)){ return; }
      const groupActive = group.some(slug => colorblindActiveFilters.has(slug));
      if(!groupActive){ return; }
      group.forEach(slug => {
        if(!colorblindActiveFilters.has(slug) && typeof slug === 'string' && slug){
          disabled.add(slug);
        }
      });
    });

    return disabled;
  }

  function updateColorblindToggleAvailability(){
    if(isUpdatingColorblindAvailability){ return; }
    isUpdatingColorblindAvailability = true;
    const disabledSlugs = getActiveColorblindDisabledSlugs();
    COLORBLIND_CONTROLLED_SLUGS.forEach(slug => {
      const input = featureInputs.get(slug);
      const shouldDisable = disabledSlugs.has(slug);
      const isActive = colorblindActiveFilters.has(slug);
      const disableInput = shouldDisable && !isActive;
      if(input){
        if(input.disabled !== disableInput){
          input.disabled = disableInput;
        }
        const switchEl = input.closest('.a11y-switch');
        if(switchEl){
          switchEl.classList.toggle('is-disabled', disableInput);
          if(disableInput){ switchEl.setAttribute('aria-disabled', 'true'); }
          else { switchEl.removeAttribute('aria-disabled'); }
        }
        const rowEl = input.closest('.a11y-subfeature');
        if(rowEl){
          rowEl.classList.toggle('is-disabled', disableInput);
          if(disableInput){ rowEl.setAttribute('aria-disabled', 'true'); }
          else { rowEl.removeAttribute('aria-disabled'); }
        }
      }
      setColorblindControlsDisabled(slug, disableInput);
    });
    isUpdatingColorblindAvailability = false;
    disabledSlugs.forEach(slug => {
      if(colorblindActiveFilters.has(slug)){
        toggleFeature(slug, false);
      }
    });
  }

  function isManagedColorblindSlug(slug){
    return COLORBLIND_CONTROLLED_SET.has(slug);
  }

  function getActiveColorblindDisabledSlugs(){
    const disabled = new Set();
    const hasAchromatopsia = colorblindActiveFilters.has(COLORBLIND_ACHROMATOPSIA_SLUG);
    if(hasAchromatopsia){
      COLORBLIND_EXCLUSIVE_GROUPS.forEach(group => {
        if(!Array.isArray(group)){ return; }
        group.forEach(slug => {
          if(typeof slug === 'string' && slug){
            disabled.add(slug);
          }
        });
      });
      return disabled;
    }

    const hasOtherActive = Array.from(colorblindActiveFilters).some(slug => slug !== COLORBLIND_ACHROMATOPSIA_SLUG);
    if(hasOtherActive){
      disabled.add(COLORBLIND_ACHROMATOPSIA_SLUG);
    }

    COLORBLIND_EXCLUSIVE_GROUPS.forEach(group => {
      if(!Array.isArray(group)){ return; }
      const groupActive = group.some(slug => colorblindActiveFilters.has(slug));
      if(!groupActive){ return; }
      group.forEach(slug => {
        if(!colorblindActiveFilters.has(slug) && typeof slug === 'string' && slug){
          disabled.add(slug);
        }
      });
    });

    return disabled;
  }

  function updateColorblindToggleAvailability(){
    if(isUpdatingColorblindAvailability){ return; }
    isUpdatingColorblindAvailability = true;
    const disabledSlugs = getActiveColorblindDisabledSlugs();
    COLORBLIND_CONTROLLED_SLUGS.forEach(slug => {
      const input = featureInputs.get(slug);
      const shouldDisable = disabledSlugs.has(slug);
      const isActive = colorblindActiveFilters.has(slug);
      if(input){
        const disableInput = shouldDisable && !isActive;
        if(input.disabled !== disableInput){
          input.disabled = disableInput;
        }
        const switchEl = input.closest('.a11y-switch');
        if(switchEl){
          switchEl.classList.toggle('is-disabled', disableInput);
          if(disableInput){ switchEl.setAttribute('aria-disabled', 'true'); }
          else { switchEl.removeAttribute('aria-disabled'); }
        }
        const rowEl = input.closest('.a11y-subfeature');
        if(rowEl){
          rowEl.classList.toggle('is-disabled', disableInput);
          if(disableInput){ rowEl.setAttribute('aria-disabled', 'true'); }
          else { rowEl.removeAttribute('aria-disabled'); }
        }
      }
    });
    isUpdatingColorblindAvailability = false;
    disabledSlugs.forEach(slug => {
      if(colorblindActiveFilters.has(slug)){
        toggleFeature(slug, false);
      }
    });
  }

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
      if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
        const settings = getOrCreateColorblindSettings(slug);
        const contrastValue = normalizeColorblindAchromValue('contrast', settings.contrast);
        const brightnessBase = normalizeColorblindAchromValue('brightness', settings.brightness);
        const photophobia = getColorblindPhotophobiaSettings(settings.photophobia);
        const brightnessValue = clampFloat(brightnessBase * photophobia.brightnessFactor, 0.2, 3);
        const grayBase = typeof preset.grayscale === 'number' ? clampFloat(preset.grayscale, 0, 1) : 1;
        grayscale = Math.max(grayscale, grayBase);
        contrast *= contrastValue;
        brightness *= brightnessValue;
        return;
      }

      const settings = getOrCreateColorblindSettings(slug);
      const intensity = normalizeColorblindIntensity(slug, settings.intensity);
      const baseMultiplier = typeof preset.multiplier === 'number' ? preset.multiplier : 1;
      let multiplier = baseMultiplier;
      if(slug === COLORBLIND_TRITANOMALY_SLUG){
        multiplier *= getColorblindSensitivityMultiplier(settings.sensitivity);
      }
      const effective = intensity * multiplier;
      if(typeof preset.hue === 'number'){ hueRotate += preset.hue * effective; }
      if(typeof preset.saturate === 'number'){ saturate *= 1 + (preset.saturate * effective); }
      if(typeof preset.contrast === 'number'){ contrast *= 1 + (preset.contrast * effective); }
      if(typeof preset.sepia === 'number'){ sepia += preset.sepia * effective; }
      if(typeof preset.grayscale === 'number'){ grayscale = Math.max(grayscale, clampFloat(preset.grayscale, 0, 1)); }
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
    applyColorblindAchromatopsiaExtras();
  }

  function setColorblindFilterState(slug, enabled){
    if(!COLORBLIND_FILTER_PRESETS[slug]){ return; }
    if(enabled){
      if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
        COLORBLIND_CONTROLLED_SLUGS.forEach(otherSlug => {
          if(otherSlug === slug){ return; }
          if(colorblindActiveFilters.has(otherSlug)){
            toggleFeature(otherSlug, false);
          }
        });
      } else {
        if(colorblindActiveFilters.has(COLORBLIND_ACHROMATOPSIA_SLUG)){
          toggleFeature(COLORBLIND_ACHROMATOPSIA_SLUG, false);
        }
        COLORBLIND_EXCLUSIVE_GROUPS.forEach(group => {
          if(!Array.isArray(group) || !group.includes(slug)){ return; }
          group.forEach(otherSlug => {
            if(otherSlug === slug){ return; }
            if(colorblindActiveFilters.has(otherSlug)){
              toggleFeature(otherSlug, false);
            }
          });
        });
      }
      colorblindActiveFilters.add(slug);
    } else {
      colorblindActiveFilters.delete(slug);
    }
    refreshColorblindFilters();
    updateColorblindToggleAvailability();
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
  const READING_GUIDE_SUMMARY_POS_KEY = 'a11y-widget-reading-guide-summary-pos:v1';
  const readingGuideInstances = new Set();
  let readingGuideSettings = loadReadingGuideSettings();
  let readingGuideActive = false;
  let readingGuideOverlayEl = null;
  let readingGuideSummaryEl = null;
  let readingGuideSummaryPosition = null;
  let readingGuideSummaryHasCustomPosition = false;
  let readingGuideSummaryPointerId = null;
  let readingGuideSummaryDragging = false;
  let readingGuideSummaryDragOffsetX = 0;
  let readingGuideSummaryDragOffsetY = 0;
  let readingGuideSummaryDragStart = null;
  let readingGuideSummaryDragMoved = false;
  let readingGuideSummaryActiveTouchId = null;
  let readingGuideSummaryPreventClick = false;
  let readingGuideSummaryClickResetTimer = null;
  const readingGuideSummaryDisposers = [];
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
    if(isManagedColorblindSlug(key)){
      updateColorblindToggleAvailability();
    }
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

  function createColorblindCard(feature){
    const children = Array.isArray(feature.children) ? feature.children : [];
    if(!children.length){ return null; }

    const article = document.createElement('article');
    article.className = 'a11y-card a11y-card--colorblind has-children';
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

    article.appendChild(meta);

    const list = document.createElement('div');
    list.className = 'a11y-subfeatures';
    article.appendChild(list);

    let rendered = 0;

    children.forEach(child => {
      if(!child || typeof child.slug !== 'string' || !child.slug || typeof child.label !== 'string' || !child.label){
        return;
      }

      const slug = child.slug;
      const baseId = `a11y-colorblind-${slug.replace(/[^a-z0-9\-]+/gi, '-').toLowerCase()}`;
      const row = document.createElement('div');
      row.className = 'a11y-subfeature a11y-colorblind-item';
      row.dataset.colorblindSlug = slug;

      const header = document.createElement('div');
      header.className = 'a11y-colorblind-item__header';

      const labelWrapper = document.createElement('div');
      labelWrapper.className = 'a11y-colorblind-item__label';

      const title = document.createElement('span');
      title.className = 'label';
      title.textContent = child.label;
      labelWrapper.appendChild(title);

      if(child.hint){
        const hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = child.hint;
        labelWrapper.appendChild(hint);
      }

      header.appendChild(labelWrapper);

      const switchEl = buildSwitch(slug, child.aria_label || child.label || '');
      if(!switchEl){ return; }
      header.appendChild(switchEl);
      row.appendChild(header);

      const controls = document.createElement('div');
      controls.className = 'a11y-colorblind-item__controls';
      row.appendChild(controls);

      const buildRangeControl = (idSuffix, labelText, range) => {
        const field = document.createElement('div');
        field.className = 'a11y-colorblind-field a11y-colorblind-field--range';
        const fieldHeader = document.createElement('div');
        fieldHeader.className = 'a11y-colorblind-field-header';
        const label = document.createElement('label');
        label.className = 'a11y-colorblind-field-label';
        const labelId = `${baseId}-${idSuffix}-label`;
        label.id = labelId;
        label.textContent = labelText;
        fieldHeader.appendChild(label);
        const value = document.createElement('span');
        value.className = 'a11y-colorblind-field-value';
        value.id = `${baseId}-${idSuffix}-value`;
        fieldHeader.appendChild(value);
        field.appendChild(fieldHeader);
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'a11y-colorblind-range';
        input.id = `${baseId}-${idSuffix}-input`;
        input.min = `${range.min}`;
        input.max = `${range.max}`;
        input.step = `${range.step}`;
        input.setAttribute('aria-labelledby', `${labelId} ${value.id}`);
        field.appendChild(input);
        return { field, input, value };
      };

      const intensityRange = getColorblindIntensityRange(slug);
      const intensityLabelText = slug === COLORBLIND_ACHROMATOPSIA_SLUG ? 'Confort lumineux' : 'Intensit\u00e9';
      const intensityControl = buildRangeControl('intensity', intensityLabelText, intensityRange);
      controls.appendChild(intensityControl.field);

      const refs = {
        container: row,
        intensityInput: intensityControl.input,
        intensityValue: intensityControl.value,
      };

      intensityControl.input.addEventListener('input', () => {
        updateColorblindSettings(slug, { intensity: parseFloat(intensityControl.input.value) }, { forceRefresh: true, persist: false });
      });
      intensityControl.input.addEventListener('change', () => {
        updateColorblindSettings(slug, { intensity: parseFloat(intensityControl.input.value) }, { forceRefresh: true });
      });

      if(slug === COLORBLIND_TRITANOMALY_SLUG){
        const sensitivityField = document.createElement('div');
        sensitivityField.className = 'a11y-colorblind-field';
        const sensitivityLabel = document.createElement('label');
        const sensitivityLabelId = `${baseId}-sensitivity-label`;
        sensitivityLabel.id = sensitivityLabelId;
        sensitivityLabel.className = 'a11y-colorblind-field-label';
        sensitivityLabel.setAttribute('for', `${baseId}-sensitivity-select`);
        sensitivityLabel.textContent = 'Niveau de sensibilit\u00e9';
        sensitivityField.appendChild(sensitivityLabel);
        const sensitivitySelect = document.createElement('select');
        sensitivitySelect.id = `${baseId}-sensitivity-select`;
        sensitivitySelect.className = 'a11y-colorblind-select';
        sensitivitySelect.setAttribute('aria-labelledby', sensitivityLabelId);
        COLORBLIND_SENSITIVITY_OPTIONS.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          sensitivitySelect.appendChild(optionEl);
        });
        sensitivityField.appendChild(sensitivitySelect);
        controls.appendChild(sensitivityField);
        sensitivitySelect.addEventListener('change', () => {
          updateColorblindSettings(slug, { sensitivity: sensitivitySelect.value }, { forceRefresh: true });
        });
        refs.sensitivitySelect = sensitivitySelect;
      }

      if(slug === COLORBLIND_ACHROMATOPSIA_SLUG){
        const photophobiaField = document.createElement('div');
        photophobiaField.className = 'a11y-colorblind-field';
        const photophobiaLabel = document.createElement('label');
        const photophobiaLabelId = `${baseId}-photophobia-label`;
        photophobiaLabel.id = photophobiaLabelId;
        photophobiaLabel.className = 'a11y-colorblind-field-label';
        photophobiaLabel.setAttribute('for', `${baseId}-photophobia-select`);
        photophobiaLabel.textContent = 'Niveau de photophobie';
        photophobiaField.appendChild(photophobiaLabel);
        const photophobiaSelect = document.createElement('select');
        photophobiaSelect.id = `${baseId}-photophobia-select`;
        photophobiaSelect.className = 'a11y-colorblind-select';
        photophobiaSelect.setAttribute('aria-labelledby', photophobiaLabelId);
        COLORBLIND_PHOTOPHOBIA_OPTIONS.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          photophobiaSelect.appendChild(optionEl);
        });
        photophobiaField.appendChild(photophobiaSelect);
        controls.appendChild(photophobiaField);
        photophobiaSelect.addEventListener('change', () => {
          updateColorblindSettings(slug, { photophobia: photophobiaSelect.value }, { forceRefresh: true, forcePersist: true });
        });
        refs.photophobiaSelect = photophobiaSelect;

        const contrastControl = buildRangeControl('contrast', 'Contraste', COLORBLIND_ACHROM_CONTROL_RANGES.contrast);
        controls.appendChild(contrastControl.field);
        contrastControl.input.addEventListener('input', () => {
          updateColorblindSettings(slug, { contrast: parseFloat(contrastControl.input.value) }, { forceRefresh: true, persist: false });
        });
        contrastControl.input.addEventListener('change', () => {
          updateColorblindSettings(slug, { contrast: parseFloat(contrastControl.input.value) }, { forceRefresh: true });
        });
        refs.contrastInput = contrastControl.input;
        refs.contrastValue = contrastControl.value;

        const brightnessControl = buildRangeControl('brightness', 'Luminosit\u00e9', COLORBLIND_ACHROM_CONTROL_RANGES.brightness);
        controls.appendChild(brightnessControl.field);
        brightnessControl.input.addEventListener('input', () => {
          updateColorblindSettings(slug, { brightness: parseFloat(brightnessControl.input.value) }, { forceRefresh: true, persist: false });
        });
        brightnessControl.input.addEventListener('change', () => {
          updateColorblindSettings(slug, { brightness: parseFloat(brightnessControl.input.value) }, { forceRefresh: true });
        });
        refs.brightnessInput = brightnessControl.input;
        refs.brightnessValue = brightnessControl.value;

        const textScaleControl = buildRangeControl('textscale', 'Taille du texte', COLORBLIND_ACHROM_CONTROL_RANGES.textScale);
        controls.appendChild(textScaleControl.field);
        textScaleControl.input.addEventListener('input', () => {
          updateColorblindSettings(slug, { textScale: parseFloat(textScaleControl.input.value) }, { forceRefresh: true, persist: false });
        });
        textScaleControl.input.addEventListener('change', () => {
          updateColorblindSettings(slug, { textScale: parseFloat(textScaleControl.input.value) }, { forceRefresh: true });
        });
        refs.textScaleInput = textScaleControl.input;
        refs.textScaleValue = textScaleControl.value;
      }

      colorblindControlRefs.set(slug, refs);
      updateColorblindControlDisplay(slug);

      list.appendChild(row);
      rendered++;
    });

    if(!rendered){ return null; }

    updateColorblindToggleAvailability();

    return article;
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
    try { localStorage.removeItem(READING_GUIDE_SUMMARY_POS_KEY); } catch(err){ /* ignore */ }
    readingGuideSummaryHasCustomPosition = false;
    readingGuideSummaryPosition = null;
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

  function cleanupReadingGuideSummaryInteractions(){
    if(readingGuideSummaryClickResetTimer){
      clearTimeout(readingGuideSummaryClickResetTimer);
      readingGuideSummaryClickResetTimer = null;
    }
    while(readingGuideSummaryDisposers.length){
      const disposer = readingGuideSummaryDisposers.pop();
      try { disposer(); } catch(err){ /* ignore */ }
    }
    readingGuideSummaryDragging = false;
    readingGuideSummaryPointerId = null;
    readingGuideSummaryActiveTouchId = null;
    readingGuideSummaryDragMoved = false;
    readingGuideSummaryDragStart = null;
    readingGuideSummaryPreventClick = false;
    if(readingGuideSummaryEl){
      readingGuideSummaryEl.classList.remove('is-dragging');
    }
  }

  function loadReadingGuideSummaryPosition(){
    try {
      const raw = localStorage.getItem(READING_GUIDE_SUMMARY_POS_KEY);
      if(!raw){ return null; }
      const data = JSON.parse(raw);
      if(typeof data?.left === 'number' && typeof data?.top === 'number'){
        return { left: data.left, top: data.top };
      }
    } catch(err){ /* ignore */ }
    return null;
  }

  function persistReadingGuideSummaryPosition(left, top){
    try {
      localStorage.setItem(READING_GUIDE_SUMMARY_POS_KEY, JSON.stringify({ left, top }));
    } catch(err){ /* ignore */ }
  }

  function clampReadingGuideSummaryPosition(left, top){
    if(!readingGuideSummaryEl){ return { left, top }; }
    const rect = readingGuideSummaryEl.getBoundingClientRect();
    const width = rect.width || readingGuideSummaryEl.offsetWidth || 0;
    const height = rect.height || readingGuideSummaryEl.offsetHeight || 0;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    return {
      left: Math.min(Math.max(left, 0), maxLeft),
      top: Math.min(Math.max(top, 0), maxTop)
    };
  }

  function applyReadingGuideSummaryPosition(left, top, options = {}){
    if(!readingGuideSummaryEl){ return null; }
    const clamped = clampReadingGuideSummaryPosition(left, top);
    readingGuideSummaryEl.style.left = `${clamped.left}px`;
    readingGuideSummaryEl.style.top = `${clamped.top}px`;
    readingGuideSummaryPosition = { left: clamped.left, top: clamped.top };
    if(options.persist){
      persistReadingGuideSummaryPosition(clamped.left, clamped.top);
      readingGuideSummaryHasCustomPosition = true;
    }
    return readingGuideSummaryPosition;
  }

  function computeReadingGuideSummaryDefaultPosition(){
    const margin = 24;
    if(!readingGuideSummaryEl){
      return { left: margin, top: margin };
    }
    const rect = readingGuideSummaryEl.getBoundingClientRect();
    const width = rect.width || readingGuideSummaryEl.offsetWidth || 0;
    const height = rect.height || readingGuideSummaryEl.offsetHeight || 0;
    const availableLeft = Math.max(0, window.innerWidth - width);
    const baseLeft = availableLeft > margin ? availableLeft - margin : availableLeft;
    const baseTop = Math.min(Math.max(margin, 0), Math.max(0, window.innerHeight - height));
    return clampReadingGuideSummaryPosition(baseLeft, baseTop);
  }

  function restoreReadingGuideSummaryPosition(){
    if(!readingGuideSummaryEl){ return; }
    const stored = loadReadingGuideSummaryPosition();
    if(stored){
      const applied = applyReadingGuideSummaryPosition(stored.left, stored.top) || stored;
      readingGuideSummaryHasCustomPosition = true;
      if(applied.left !== stored.left || applied.top !== stored.top){
        persistReadingGuideSummaryPosition(applied.left, applied.top);
      }
      return;
    }
    readingGuideSummaryHasCustomPosition = false;
    const defaults = computeReadingGuideSummaryDefaultPosition();
    applyReadingGuideSummaryPosition(defaults.left, defaults.top);
  }

  function ensureReadingGuideSummaryWithinViewport(persistIfChanged){
    if(!readingGuideSummaryEl || !readingGuideSummaryPosition){ return; }
    const clamped = clampReadingGuideSummaryPosition(readingGuideSummaryPosition.left, readingGuideSummaryPosition.top);
    if(clamped.left !== readingGuideSummaryPosition.left || clamped.top !== readingGuideSummaryPosition.top){
      applyReadingGuideSummaryPosition(clamped.left, clamped.top);
      if(persistIfChanged){
        persistReadingGuideSummaryPosition(clamped.left, clamped.top);
      }
    }
  }

  function handleReadingGuideSummaryResize(){
    ensureReadingGuideSummaryWithinViewport(readingGuideSummaryHasCustomPosition);
  }

  function isReadingGuideSummaryDragSuppressed(target){
    if(!(target instanceof Element)){ return false; }
    if(target.closest('a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [data-reading-guide-no-drag]')){
      return true;
    }
    return false;
  }

  function startReadingGuideSummaryDrag(clientX, clientY){
    if(!readingGuideSummaryEl){ return; }
    readingGuideSummaryDragging = true;
    readingGuideSummaryDragMoved = false;
    const rect = readingGuideSummaryEl.getBoundingClientRect();
    readingGuideSummaryDragOffsetX = clientX - rect.left;
    readingGuideSummaryDragOffsetY = clientY - rect.top;
    readingGuideSummaryDragStart = { left: rect.left, top: rect.top };
    readingGuideSummaryPosition = { left: rect.left, top: rect.top };
    readingGuideSummaryEl.classList.add('is-dragging');
  }

  function moveReadingGuideSummaryDrag(clientX, clientY){
    if(!readingGuideSummaryDragging){ return; }
    const targetLeft = clientX - readingGuideSummaryDragOffsetX;
    const targetTop = clientY - readingGuideSummaryDragOffsetY;
    const applied = applyReadingGuideSummaryPosition(targetLeft, targetTop);
    if(!applied || !readingGuideSummaryDragStart){ return; }
    if(Math.abs(applied.left - readingGuideSummaryDragStart.left) > 1 || Math.abs(applied.top - readingGuideSummaryDragStart.top) > 1){
      readingGuideSummaryDragMoved = true;
    }
  }

  function endReadingGuideSummaryDrag(){
    if(!readingGuideSummaryDragging){ return; }
    readingGuideSummaryDragging = false;
    readingGuideSummaryPointerId = null;
    readingGuideSummaryActiveTouchId = null;
    readingGuideSummaryDragStart = null;
    if(readingGuideSummaryEl){
      readingGuideSummaryEl.classList.remove('is-dragging');
    }
    if(readingGuideSummaryDragMoved && readingGuideSummaryPosition){
      persistReadingGuideSummaryPosition(readingGuideSummaryPosition.left, readingGuideSummaryPosition.top);
      readingGuideSummaryHasCustomPosition = true;
      readingGuideSummaryPreventClick = true;
      if(readingGuideSummaryClickResetTimer){
        clearTimeout(readingGuideSummaryClickResetTimer);
      }
      readingGuideSummaryClickResetTimer = setTimeout(() => {
        readingGuideSummaryPreventClick = false;
        readingGuideSummaryClickResetTimer = null;
      }, 0);
    } else {
      readingGuideSummaryPreventClick = false;
    }
    readingGuideSummaryDragMoved = false;
  }

  function setupReadingGuideSummaryContainer(container){
    if(!container){ return; }
    readingGuideSummaryEl = container;
    restoreReadingGuideSummaryPosition();
    const clickHandler = event => {
      if(!readingGuideSummaryPreventClick){ return; }
      event.preventDefault();
      event.stopPropagation();
      readingGuideSummaryPreventClick = false;
    };
    container.addEventListener('click', clickHandler, true);
    readingGuideSummaryDisposers.push(() => container.removeEventListener('click', clickHandler, true));

    if(supportsPointer){
      const pointerDown = event => {
        if(event.pointerType === 'mouse' && event.button !== 0){ return; }
        if(isReadingGuideSummaryDragSuppressed(event.target)){ return; }
        readingGuideSummaryPointerId = event.pointerId;
        startReadingGuideSummaryDrag(event.clientX, event.clientY);
        if(container.setPointerCapture){
          try { container.setPointerCapture(event.pointerId); } catch(err){ /* ignore */ }
        }
        if(event.pointerType !== 'mouse'){
          event.preventDefault();
        }
      };
      const pointerMove = event => {
        if(!readingGuideSummaryDragging || event.pointerId !== readingGuideSummaryPointerId){ return; }
        moveReadingGuideSummaryDrag(event.clientX, event.clientY);
      };
      const pointerUp = event => {
        if(event.pointerId !== readingGuideSummaryPointerId){ return; }
        if(container.releasePointerCapture){
          try { container.releasePointerCapture(event.pointerId); } catch(err){ /* ignore */ }
        }
        endReadingGuideSummaryDrag();
      };
      container.addEventListener('pointerdown', pointerDown);
      container.addEventListener('pointermove', pointerMove);
      container.addEventListener('pointerup', pointerUp);
      container.addEventListener('pointercancel', pointerUp);
      readingGuideSummaryDisposers.push(() => {
        container.removeEventListener('pointerdown', pointerDown);
        container.removeEventListener('pointermove', pointerMove);
        container.removeEventListener('pointerup', pointerUp);
        container.removeEventListener('pointercancel', pointerUp);
      });
    } else {
      const mouseMove = event => {
        if(!readingGuideSummaryDragging){ return; }
        moveReadingGuideSummaryDrag(event.clientX, event.clientY);
      };
      const mouseUp = () => {
        if(!readingGuideSummaryDragging){ return; }
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
        endReadingGuideSummaryDrag();
      };
      const mouseDown = event => {
        if(event.button !== 0){ return; }
        if(isReadingGuideSummaryDragSuppressed(event.target)){ return; }
        startReadingGuideSummaryDrag(event.clientX, event.clientY);
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
        event.preventDefault();
      };
      container.addEventListener('mousedown', mouseDown);
      readingGuideSummaryDisposers.push(() => {
        container.removeEventListener('mousedown', mouseDown);
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
      });

      const touchMove = event => {
        if(readingGuideSummaryActiveTouchId == null){ return; }
        const touch = findTouchById(event.changedTouches, readingGuideSummaryActiveTouchId) || findTouchById(event.touches, readingGuideSummaryActiveTouchId);
        if(!touch){ return; }
        event.preventDefault();
        moveReadingGuideSummaryDrag(touch.clientX, touch.clientY);
      };
      const touchEnd = event => {
        if(readingGuideSummaryActiveTouchId == null){ return; }
        const touch = findTouchById(event.changedTouches, readingGuideSummaryActiveTouchId);
        if(!touch){ return; }
        readingGuideSummaryActiveTouchId = null;
        document.removeEventListener('touchmove', touchMove);
        document.removeEventListener('touchend', touchEnd);
        document.removeEventListener('touchcancel', touchEnd);
        endReadingGuideSummaryDrag();
      };
      const touchStart = event => {
        if(readingGuideSummaryActiveTouchId != null){ return; }
        if(event.changedTouches && event.changedTouches.length){
          if(isReadingGuideSummaryDragSuppressed(event.target)){ return; }
          const touch = event.changedTouches[0];
          readingGuideSummaryActiveTouchId = touch.identifier;
          startReadingGuideSummaryDrag(touch.clientX, touch.clientY);
          document.addEventListener('touchmove', touchMove, { passive: false });
          document.addEventListener('touchend', touchEnd);
          document.addEventListener('touchcancel', touchEnd);
          event.preventDefault();
        }
      };
      container.addEventListener('touchstart', touchStart, { passive: false });
      readingGuideSummaryDisposers.push(() => {
        container.removeEventListener('touchstart', touchStart, { passive: false });
        document.removeEventListener('touchmove', touchMove, { passive: false });
        document.removeEventListener('touchend', touchEnd);
        document.removeEventListener('touchcancel', touchEnd);
      });
    }

    const resizeHandler = () => handleReadingGuideSummaryResize();
    window.addEventListener('resize', resizeHandler);
    readingGuideSummaryDisposers.push(() => window.removeEventListener('resize', resizeHandler));
    handleReadingGuideSummaryResize();
  }

  function resolveReadingGuideSummaryContainer(){
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

  function buildReadingGuideSummaryTree(headings){
    const nodes = [];
    const stack = [];
    headings.forEach((heading, index) => {
      const level = getReadingGuideHeadingLevel(heading);
      const node = {
        heading,
        level,
        index,
        children: []
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
    list.dataset.readingGuideNoDrag = 'true';
    nodes.forEach(node => {
      const heading = node.heading;
      const id = ensureReadingGuideHeadingId(heading, node.index);
      const text = heading.textContent || heading.getAttribute('aria-label') || id;
      const item = document.createElement('li');
      item.className = 'a11y-reading-guide-summary__item';
      item.dataset.readingGuideNoDrag = 'true';
      const link = document.createElement('a');
      link.className = 'a11y-reading-guide-summary__link';
      link.href = `#${id}`;
      link.textContent = text.replace(/\s+/g, ' ').trim();
      item.appendChild(link);
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
    cleanupReadingGuideSummaryInteractions();
    container.classList.add('a11y-reading-guide-summary');
    container.innerHTML = '';
    const titleText = readingGuideTexts.summaryTitleFallback;
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
    const tree = buildReadingGuideSummaryTree(headings);
    const list = createReadingGuideSummaryList(tree);
    const content = document.createElement('div');
    content.className = 'a11y-reading-guide-summary__content';
    content.dataset.readingGuideNoDrag = 'true';
    content.appendChild(list);
    container.appendChild(content);
    container.dataset.readingGuideSummary = 'on';
    readingGuideSummaryEl = container;
    setupReadingGuideSummaryContainer(container);
  }

  function clearReadingGuideSummary(){
    if(!readingGuideSummaryEl){ return; }
    cleanupReadingGuideSummaryInteractions();
    if(readingGuideSummaryEl.dataset && readingGuideSummaryEl.dataset.readingGuideInjected === 'true'){
      readingGuideSummaryEl.remove();
    } else {
      readingGuideSummaryEl.innerHTML = '';
      if(readingGuideSummaryEl.dataset){
        delete readingGuideSummaryEl.dataset.readingGuideSummary;
      }
      readingGuideSummaryEl.classList.remove('a11y-reading-guide-summary');
      if(readingGuideSummaryEl.style){
        readingGuideSummaryEl.style.removeProperty('left');
        readingGuideSummaryEl.style.removeProperty('top');
      }
    }
    readingGuideSummaryEl = null;
    readingGuideSummaryPosition = null;
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

  const FRENCH_HYPHENATION_DATA = {
    // Hyphenation patterns sourced from https://github.com/bramstein/hyphenation-patterns (MIT License).
    leftmin: 2,
    rightmin: 3,
    patterns: {
      2: "1ç1j1q",
      3: "1gè’â41zu1zo1zi1zè1zé1ze1za’y4_y41wu1wo1wi1we1wa1vy1vû1vu1vô1vo1vî1vi1vê1vè1vé1ve1vâ1va’û4_û4’u4_u41ba1bâ1ty1be1bé1bè1bê1tû1tu1tô1bi1bî1to1tî1ti1tê1tè1té1te1tà1tâ1ta1bo1bô1sy1sû1su1sœ1bu1bû1by2’21ca1câ1sô1ce1cé1cè1cê1so1sî1si1sê1sè1sé1se1sâ1sa1ry1rû1ru1rô1ro1rî1ri1rê1rè1ré1re1râ1ra’a41py1pû1pu1pô1po1pî1pi1pê1pè1pé1pe1pâ1pa_ô41ci1cî’ô4’o4_o41nyn1x1nû1nu1nœ1nô1no1nî1ni1nê1nè1né1ne1nâ1co1cô1na1my1mû1mu1mœ1mô1mo1mî1mi1cœ1mê1mè1mé1me1mâ1ma1ly1lû1lu1lô1lo1lî1li1lê1lè1cu1cû1cy1lé1d’1da1dâ1le1là1de1dé1dè1dê1lâ1la1ky1kû1ku1kô1ko1kî1ki1kê1kè1ké1ke1kâ1ka2jk_a4’î4_î4’i4_i41hy1hû1hu1hô1ho1hî1hi1hê1hè1hé1he1hâ1ha1gy1gû1gu1gô1go1gî1gi1gê_â41gé1ge1gâ1ga1fy1di1dî1fû1fu1fô1fo’e41fî1fi1fê1fè1do1dô1fé1fe1fâ1fa’è41du1dû1dy_è4’é4_é4’ê4_ê4_e41zy",
      4: "1f2lab2h2ckg2ckp2cksd1s22ckb4ck_1c2k2chw4ze_4ne_2ckt1c2lad2hm1s22cht2chsch2r2chp4pe_1t2r1p2h_ph44ph_ph2l2phnph2r2phs1d2r2pht2chn4fe_2chm1p2l1p2r4me_1w2rch2l2chg1c2r2chb4ch_1f2r4le_4re_4de_f1s21k2r4we_1r2h_kh44kh_1k2h4ke_1c2h_ch44ge_4je_4se_1v2r_sh41s2h4ve_4sh_2shm2shr2shs4ce_il2l1b2r4be_1b2l4he_4te__th41t2h4th_g1s21g2r2thl1g2l2thm2thnth2r1g2n2ths2ckf",
      5: "2ck3h4rhe_4kes_4wes_4res_4cke_éd2hi4vre_4jes_4tre_4zes_4ges_4des_i1oxy4gle_d1d2h_cul44gne_4fre_o1d2l_sch44nes_4les_4gre_1s2ch_réu24sch_4the_1g2hy4gue_2schs4cle_1g2ho1g2hi1g2he4ses_4tes_1g2ha4ves_4she_4che_4cre_4ces_t1t2l4hes_l1s2t4bes_4ble__con4xil3lco1ap4que_vil3l4fle_co1arco1exco1enco1auco1axco1ef4pes_co1é2per3h4mes__pe4r4bre_4pre_4phe_1p2né4ple__dé2smil3llil3lhil3l4dre_cil3lgil3l4fes_",
      6: "’in1o2rcil4l4phre_4dres_l3lioni1algi2fent_émil4l4phle_rmil4l4ples_4phes_1p2neuextra14pres_y1asthpé2nul2xent__mé2sa2pent_y1algi4chre_1m2nès4bres_1p2tèr1p2tér4chle_’en1o24fles_oxy1a2avil4l_en1o24ques_uvil4lco1a2d4bles__in1a2’in1a21s2por_cons4_bi1u2’as2ta_in1e2’in1e2_in1é2’in1é21s2lov1s2lavco1acq2cent__as2ta_co1o24ches_hémi1é_in2er’in2er2s3homo1ioni_in1i2’in1i22went_4shes__ré1a2_ré1é2_ré1e2_ré2el_in1o2ucil4lco1accu2s3tr_ré2er_ré2èr4cles_2vent__ré1i22sent_2tent_2gent__ré1o24gues__re1s24sche_4thes_’en1a2e2s3ch4gres_1s2cop2lent__en1a22nent__in1u2’in1u24gnes_4cres_wa2g3n4fres_4tres_4gles_1octet_dé1o2_dé1io4thre__bi1au2jent__dé1a22zent_4vres_2dent_4ckes_4rhes__dy2s3sub1s22kent_2rent_2bent_3d2hal",
      7: "a2g3nos3d2houdé3rent__dé3s2t_dé3s2pé3dent_2r3heur2r3hydri1s2tat2frent_io1a2ctla2w3re’in2u3l_in2u3l2crent_’in2uit_in2uit1s2caph1s2clér_ré2ussi2s3ché_re2s3t_re2s3s4sches_é3cent__seu2le’in2ond_in2ond’in2i3t_in2i3t’in2i3q_ré2aux_in2i3q2shent__di1alduni1a2x’in2ept2flent__in2eptuni1o2v2brent_co2nurb2chent_2quent_1s2perm1s2phèr_ma2c3kuevil4l1s2phér1s2piel1s2tein1s2tigm4chles_1s2tock1s2tyle1p2sych_pro1é2_ma2r1x_stil3lpusil3libril3lcyril3l_pré1s2thril3l_mé3san_pré1u2_mé2s1i_pré1o2_pré1i2piril3lpupil3lâ2ment__pré1e2_pré1é2_pré2au_pré1a22prent_2vrent_supero2_di1e2npoly1u2è2ment_poly1s2poly1o2poly1i2poly1è2poly1é2poly1e2poly1a2supe4r1capil3l2plent_armil5lsemil4lmil4letvacil4l_di2s3h3ph2tis2dlent_a2s3tro4phres_l2ment_i1è2drei1arthr2drent_4phles_supers2ô2ment_extra2i2phent_su3r2ah_su2r3hextra2chypo1u21alcool_per1u2_per1o2_per1i2_per1é2hypo1s2_per1a2hypo1o2hypo1i2hypo1é2_penta_hypo1e2hypo1a2y1s2tome2s3cophyperu2hype4r1hypers2hypero21m2némohyperi21m2nési4chres_a1è2drehyperé2hypere2hypera2’oua1ou_oua1ouo1s2tomo1s2timo1s2tato1s2tasomni1s2tung2s3_dé3s2c2blent__bio1a2télé1e2télé1i22clent_télé1s22guent_1é2nerg2grent_2trent__dé2s1œ2t3heuro1è2dre2gnent_2glent_4thres__bi1a2t1é2drie_bi1a2c_i2g3nin3s2at_’i2g3ni2ckent__i2g3né’ab3réa’i2g3né_ab3réa_per1e2",
      8: "_ma2l1ap_dy2s1u2_dy2s1o2_dy2s1i2n3s2ats__dy2s1a2distil3l1é2lectrinstil3l1s2trophe2n1i2vro2b3long1s2tomos_ae3s4ch’ae3s4ch_eu2r1a2ombud2s3’eu2r1a2_mono1s2_mono1u2o1s2téro_mono1o2eu1s2tato1s2tradfritil3l1a2l1algi_mono1i2_mono1é2_ovi1s2c’ovi1s2c_mono1e2_mono1a2co1assocpaléo1é2boutil3l1s2piros_ré2i3fi_pa2n1ischevil4l1s2patiaca3ou3t2_di1a2cé_para1s2_pa2r3héco1assur_su2b1é2tu2ment_su2ment__su2b1in_su2b3lupapil3lire3pent_’inte4r3_su2b1urab3sent__su2b1a2di2s3cophu2ment_fu2ment__intera2au2ment_as2ment_or2ment_’intera2_intere2pé1r2é2q_péri1os_péri1s2ja3cent__anti1a2_péri1u2’anti1a2er2ment__anti1e2ac3cent_ar2ment_to2ment_’intere2ré3gent_papil3leom2ment_’anti1e2photo1s2_anti1é2_interé2’anti1é2_anti1s2’anti1s23ph2talé’interé2ri2ment__interi2’interi2mi2ment_apo2s3tri2s3chio_pluri1ai2s3chia_intero2’intero2_inte4r3po1astre_interu2’interu2_inters2ai2ment_’inters2papil3la_tri1o2n_su2r1a2_pon2tet_pos2t3h_dés2a3mes3cent__pos2t3r_post1s2_tri1a2tta2ment__tri1a2nra2ment_is3cent__su2r1e2_tri1a2cfa2ment_da2ment__su3r2et_su2r1é2_mé2s1es_mé2g1oh_su2r1of_su2r1ox_re3s4ty_re3s4tu_ma2l1oc’a2g3nat_dé2s1é2_ma2l1entachy1a2_pud1d2ltchin3t2_re3s4trtran2s3p_bi2s1a2tran2s3hhémo1p2té3quent__a2g3nat_dé2s1i2télé1o2bo2g3nosiradio1a2télé1o2ppu2g3nacru3lent__sta2g3nre3lent__ré2a3le_di1a2mi",
      9: "_ré2a3lit_dé3s2o3lthermo1s2_dé3s2ist_dé3s2i3rmit3tent_éni3tent__do3lent__ré2a3lisopu3lent__pa3tent__re2s3cap_la3tent__co2o3lie_re2s3cou_re2s3cri_ma2g3num_re2s3pir_dé3s2i3dco2g3nititran2s1a2tran2s1o2_dé3s2exu_re3s4tab_re3s4tag_dé3s2ert_re3s4tat_re3s4tén_re3s4tér_re3s4tim_re3s4tip_re3s4toc_re3s4toptran2s1u2_no2n1obs_ma2l1a2v_ma2l1int_prou3d2hpro2s3tativa3lent__ta3lent__rétro1a2_pro1s2cé_ma2l1o2dcci3dent__pa3rent__su2r1int_su2r1inf_su2r1i2mtor3rent_cur3rent__mé2s1u2stri3dent__dé3s2orm_su3r2ell_ar3dent__su3r2eaupru3dent__pré2a3lacla2ment__su3r2a3t_pos2t1o2_pos2t1inqua2ment_ter3gent_ser3gent_rai3ment_abî2ment_éci2ment_’ar3gent__ar3gent_rin3gent_tan3gent_éli2ment_ani2ment_’apo2s3ta_apo2s3tavélo1s2kivol2t1amp_dé3s2orp_dé2s1u2n_péri2s3ssesqui1a2’ana3s4trfir2ment_écu2ment_ser3pent_pré3sent_’ar3pent__ar3pent_’in1s2tab_in1s2tab’in2o3cul_in2o3culplu2ment_bou2ment_’in2exora_in2exora_su2b3linbru2ment__su3b2é3r_milli1am’in2effab_in2effab’in2augur_di1a2cid_in2augur_pa2n1opt’in2a3nit_in2a3nit1informat_ana3s4trvanil3lis_di1a2tom_su3b2altvanil3linstéréo1s2_pa2n1a2fo1s2tratuépi2s3cop_ci2s1alp1s2tructu1é2lément1é2driquepapil3lomllu2ment_",
      10: "1s2tandardimmi3nent__émi3nent_imma3nent_réma3nent_épi3s4cope_in2i3miti’in2i3miti_res3sent_moye2n1â2gréti3cent__dé3s2a3crmon2t3réalinno3cent__mono1ï2dé_pa2n1a2méimpu3dent__pa2n1a2ra_amino1a2c’amino1a2c_pa2n1o2phinci3dent__ser3ment_appa3rent_déca3dent__dacryo1a2_dé3s2astr_re4s5trin_dé3s2é3gr_péri2s3ta_sar3ment__dé3s2oufr_re3s4tandchro2ment__com3ment__re2s3quil_re2s3pons_gem2ment__re2s3pect_re2s3ciso_dé3s2i3gn_dé3s2i3ligram2ment__dé3s2invo_re2s3cisi_tran3s2act’anti2enneindo3lent__sou3vent_indi3gent_dili3gent_flam2ment_impo3tent_inso3lent_esti2ment_’on3guent__on3guent_inti2ment__dé3s2o3défécu3lent_veni2ment_reli2ment_vidi2ment_chlo2r3é2tpu2g3nablechlo2r3a2cryth2ment_o2g3nomonicarê2ment__méta1s2ta_ma2l1aisé_macro1s2célo3quent_tran3s2ats_anti2enne",
      11: "_contre1s2cperti3nent_conti3nent__ma2l1a2dro_in2é3lucta_psycho1a2n_dé3s2o3pil’in2é3luctaperma3nent__in2é3narratesta3ment__su2b3liminrésur3gent_’in2é3narraimmis4cent__pro2g3nathchien3dent_sporu4lent_dissi3dent_corpu3lent_archi1é2pissubli2ment_indul3gent_confi3dent__syn2g3nathtrucu3lent_détri3ment_nutri3ment_succu3lent_turbu3lent__pa2r1a2che_pa2r1a2chèfichu3ment__entre3gent_conni3vent_mécon3tent_compé3tent__re4s5trict_dé3s2i3nen_re2s3plend1a2nesthésislalo2ment__dé3s2ensib_re4s5trein_phalan3s2tabsti3nent_",
      12: "polyva3lent_équiva4lent_monova3lent_amalga2ment_omnipo3tent__ma2l1a2dreséquipo3tent__dé3s2a3tellproémi3nent_contin3gent_munifi3cent__ma2g3nicideo1s2trictionsurémi3nent_préémi3nent__bai2se3main",
      13: "acquies4cent_intelli3gent_tempéra3ment_transpa3rent__ma2g3nificatantifer3ment_",
      14: "privatdo3cent_diaphrag2ment_privatdo3zent_ventripo3tent__contre3maître",
      15: "grandilo3quent_",
      16: "_chè2vre3feuille"
    }
  };

  function stripFrenchDiacritics(str){
    if(typeof str !== 'string'){ return ''; }
    const normalized = typeof str.normalize === 'function' ? str.normalize('NFD') : str;
    return normalized
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae');
  }

  function createHyphenationTrie(patternObject){
    const tree = { _points: [] };
    if(!patternObject){ return tree; }
    for(const sizeKey in patternObject){
      if(!Object.prototype.hasOwnProperty.call(patternObject, sizeKey)){ continue; }
      const patternString = patternObject[sizeKey];
      if(typeof patternString !== 'string' || !patternString){ continue; }
      const size = Number(sizeKey) || 0;
      if(!size){ continue; }
      const chunkRegex = new RegExp(`.{1,${size}}`, 'g');
      const chunks = patternString.match(chunkRegex);
      if(!chunks){ continue; }
      for(let i = 0; i < chunks.length; i++){
        const chunk = chunks[i];
        const chars = chunk.replace(/[0-9]/g, '').split('');
        const points = chunk.split(/\D/);
        let node = tree;
        for(let c = 0; c < chars.length; c++){
          const codePoint = chars[c].charCodeAt(0);
          if(!node[codePoint]){ node[codePoint] = {}; }
          node = node[codePoint];
        }
        node._points = [];
        for(let p = 0; p < points.length; p++){
          node._points[p] = points[p] ? Number(points[p]) : 0;
        }
      }
    }
    return tree;
  }

  function createHyphenationExceptions(exceptionsString){
    const map = new Map();
    if(typeof exceptionsString !== 'string' || !exceptionsString.trim()){ return map; }
    const entries = exceptionsString.split(/,\s?/g);
    for(let i = 0; i < entries.length; i++){
      const entry = entries[i];
      if(!entry){ continue; }
      const normalized = entry.replace(/\u2027/g, '').toLowerCase();
      const segments = entry.split('\u2027');
      map.set(normalized, segments);
    }
    return map;
  }

  function applyHyphenationException(word, segments){
    if(!Array.isArray(segments) || !segments.length){ return [word]; }
    const pieces = [];
    let offset = 0;
    for(let i = 0; i < segments.length; i++){
      const segment = segments[i];
      if(!segment){ continue; }
      const end = offset + segment.length;
      pieces.push(word.slice(offset, end));
      offset = end;
    }
    if(!pieces.length){ return [word]; }
    if(offset < word.length){ pieces[pieces.length - 1] += word.slice(offset); }
    return pieces;
  }

  const FRENCH_HYPHENATION_TRIE = createHyphenationTrie(FRENCH_HYPHENATION_DATA.patterns);
  const FRENCH_HYPHENATION_LEFT_MIN = FRENCH_HYPHENATION_DATA.leftmin || 2;
  const FRENCH_HYPHENATION_RIGHT_MIN = FRENCH_HYPHENATION_DATA.rightmin || 3;
  const FRENCH_HYPHENATION_EXCEPTIONS = createHyphenationExceptions(FRENCH_HYPHENATION_DATA.exceptions);

  function hyphenateFrenchWord(word){
    if(typeof word !== 'string' || !word){ return [word]; }
    const lowerWord = word.toLowerCase();
    if(FRENCH_HYPHENATION_EXCEPTIONS.has(lowerWord)){
      return applyHyphenationException(word, FRENCH_HYPHENATION_EXCEPTIONS.get(lowerWord));
    }
    if(word.indexOf('\u00AD') !== -1){ return [word]; }

    const padded = `_${word}_`;
    const characters = padded.toLowerCase().split('');
    const originalCharacters = padded.split('');
    const length = characters.length;
    const points = new Array(length).fill(0);
    const codePoints = new Array(length);
    for(let i = 0; i < length; i++){
      codePoints[i] = characters[i].charCodeAt(0);
    }

    for(let i = 0; i < length; i++){
      let node = FRENCH_HYPHENATION_TRIE;
      for(let j = i; j < length; j++){
        node = node[codePoints[j]];
        if(!node){ break; }
        const nodePoints = node._points;
        if(nodePoints){
          for(let k = 0; k < nodePoints.length; k++){
            const value = nodePoints[k] || 0;
            if(value > (points[i + k] || 0)){
              points[i + k] = value;
            }
          }
        }
      }
    }

    const result = [''];
    for(let i = 1; i < length - 1; i++){
      const shouldBreak = i > FRENCH_HYPHENATION_LEFT_MIN && i < (length - FRENCH_HYPHENATION_RIGHT_MIN) && (points[i] % 2 === 1);
      if(shouldBreak){
        result.push(originalCharacters[i]);
      } else {
        result[result.length - 1] += originalCharacters[i];
      }
    }
    return result;
  }

  function mergeFrenchTerminalMuteE(syllables){
    if(!Array.isArray(syllables) || syllables.length < 2){ return syllables; }
    for(let i = 1; i < syllables.length; i++){
      const syllable = syllables[i];
      if(typeof syllable !== 'string'){ continue; }
      const lower = stripFrenchDiacritics(syllable.toLowerCase());
      if(lower === 'e' || lower === 'es' || lower === 'ent'){
        syllables[i - 1] += syllable;
        syllables.splice(i, 1);
        i--;
      }
    }
    return syllables;
  }

  function syllabifyReadingGuideWord(word){
    if(typeof word !== 'string' || word.length < 4){ return word; }
    const hyphenated = hyphenateFrenchWord(word);
    if(!Array.isArray(hyphenated) || !hyphenated.length){ return word; }
    const syllables = hyphenated.filter(Boolean);
    if(!syllables.length){ return word; }
    mergeFrenchTerminalMuteE(syllables);
    return syllables.join('·');
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
      if(key === 'summaryEnabled'){
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
      syllableToggle,
      syllableSelectorInput,
      focusToggle,
      settings,
      wasConnected: false,
    };

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
        if(typeof feature.slug === 'string' && feature.slug === 'vision-daltonisme'){
          instance = createColorblindCard(feature);
        } else {
          instance = createFeatureGroup(feature);
        }
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
      try { localStorage.removeItem(READING_GUIDE_SUMMARY_POS_KEY); } catch(err){}
      try { localStorage.removeItem(COLORBLIND_SETTINGS_STORAGE_KEY); } catch(err){}
      document.documentElement.style.removeProperty('--a11y-launcher-x');
      document.documentElement.style.removeProperty('--a11y-launcher-y');
      launcherLastPos = null;
      hasCustomLauncherPosition = false;
      applyPanelSide('right');
      resetColorblindSettings({ persist: false });
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
