jQuery(document).ready(function($) {
    const panel = $('#cb-panel'), handle = $('#cb-handle'), resetBtn = $('#cb-reset');
    const sizeSlider = $('#cb-size-slider'), sizeValue = $('#cb-size-value');
    const themePrevBtn = $('#cb-theme-prev'), themeNextBtn = $('#cb-theme-next'), themeName = $('#cb-theme-name');
    const dynamicStyles = $('#cb-dynamic-styles');
    const settingsKey = 'clickableButtonsSettings_v12';

    // *** MODIFICATION CLÉ ***
    // On définit séparément les conteneurs et les boutons
    const mainContentSelectors = ['main', '#content', '.site-content', '.entry-content'];
    const buttonSelectors = [
        '.wp-block-button__link:not(#cb-panel *)',
        '.wp-element-button:not(#cb-panel *)',
        'button:not(#cb-panel button)',
        '.button:not(#cb-panel .button)',
        '.btn:not(#cb-panel .btn)',
        'input[type="submit"]:not(#cb-panel input)',
        'input[type="button"]:not(#cb-panel input)',
        'input[type="reset"]:not(#cb-panel input)'
    ];

    // On construit la liste de sélecteurs correctement
    const targetSelectorsList = [];
    mainContentSelectors.forEach(mainSelector => {
        buttonSelectors.forEach(buttonSelector => {
            // On s'assure que chaque sélecteur cible bien un bouton DANS un conteneur
            targetSelectorsList.push(`${mainSelector} ${buttonSelector}`);
        });
    });
    const targetSelectors = targetSelectorsList.join(', ');
    
    // Le reste du code ne change pas...
    const insideButtonSelectors = targetSelectors.split(',').map(selector => {
        return `${selector} *`; 
    }).join(', ');

    const themes = [
        { key: 'default', name: 'Défaut' },
        { key: 'grey', name: 'Gris', colors: { bg: '#6c757d', text: '#ffffff' } },
        { key: 'dark', name: 'Sombre', colors: { bg: '#212529', text: '#ffffff' } },
        { key: 'light', name: 'Clair', colors: { bg: '#f8f9fa', text: '#212529', border: '#dee2e6' } },
        { key: 'contrast', name: 'Contrasté', colors: { bg: '#ffc107', text: '#000000' } }
    ];
    let currentThemeIndex = 0;

    function applyStyles() {
        const size = sizeSlider.val();
        const theme = themes[currentThemeIndex];
        let styleRules = '';

        if (parseFloat(size) > 1) {
            styleRules += `${targetSelectors} { font-size: calc(1em * ${size}) !important; padding: calc(0.8em * ${size}) calc(1.5em * ${size}) !important; }`;
        }
        
        if (theme.key !== 'default') {
            const palette = theme.colors;
            styleRules += `${targetSelectors} { background-color: ${palette.bg} !important; color: ${palette.text} !important; border-color: ${palette.border || palette.bg} !important; }`;
            styleRules += `${insideButtonSelectors} { color: ${palette.text} !important; fill: ${palette.text} !important; }`;
        }
        
        dynamicStyles.html(styleRules);
    }

    function updateSizeDisplay() {
        const size = parseFloat(sizeSlider.val()).toFixed(1);
        sizeValue.text('x' + size);
    }

    function updateThemeSelection() {
        themeName.text(themes[currentThemeIndex].name);
        applyStyles();
        saveSettings();
    }

    function saveSettings() {
        const size = sizeSlider.val();
        const themeKey = themes[currentThemeIndex].key;
        if (parseFloat(size) <= 1 && themeKey === 'default') {
            localStorage.removeItem(settingsKey);
        } else {
            localStorage.setItem(settingsKey, JSON.stringify({ size, theme: themeKey }));
        }
    }

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem(settingsKey));
        if (settings) {
            sizeSlider.val(settings.size || 1);
            const savedThemeIndex = themes.findIndex(t => t.key === settings.theme);
            currentThemeIndex = savedThemeIndex !== -1 ? savedThemeIndex : 0;
            updateSizeDisplay();
            themeName.text(themes[currentThemeIndex].name);
            applyStyles();
        }
    }
    
    function resetAll() {
        localStorage.removeItem(settingsKey);
        sizeSlider.val(1);
        currentThemeIndex = 0;
        updateSizeDisplay();
        updateThemeSelection();
    }

    handle.on('click', () => panel.toggleClass('open'));
    sizeSlider.on('input', () => {
        applyStyles();
        updateSizeDisplay();
    });
    sizeSlider.on('change', saveSettings);
    
    themePrevBtn.on('click', () => {
        currentThemeIndex = (currentThemeIndex > 0) ? currentThemeIndex - 1 : themes.length - 1;
        updateThemeSelection();
    });
    themeNextBtn.on('click', () => {
        currentThemeIndex = (currentThemeIndex < themes.length - 1) ? currentThemeIndex + 1 : 0;
        updateThemeSelection();
    });

    resetBtn.on('click', resetAll);

    updateSizeDisplay();
    loadSettings();
});