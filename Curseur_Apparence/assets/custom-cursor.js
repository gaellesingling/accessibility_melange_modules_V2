jQuery(document).ready(function($) {
    const panel = $('#cc-panel');
    const handle = $('#cc-handle');
    const toggleSwitch = $('#cc-toggle-switch');
    const sizeSlider = $('#cc-size-slider');
    const sizeValueDisplay = $('#cc-size-value');
    const resetButton = $('#cc-reset');
    const dynamicStyles = $('#cc-dynamic-styles');
    const storageKey = 'customCursorState_v2_5';

    const cursorSVG = {
        arrow: {
            white: (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="white" stroke="black" stroke-width="1.5" d="M4.2,3.8l15,10.2l-7.1,1.5l-3.3,7.4L4.2,3.8z"/></svg>`,
            black: (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="black" stroke="white" stroke-width="1.5" d="M4.2,3.8l15,10.2l-7.1,1.5l-3.3,7.4L4.2,3.8z"/></svg>`
        },
        pointer: {
            white: (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="white" stroke="black" stroke-width="1.5" d="M9.6,22.2c-0.4,0.1-0.9-0.1-1-0.5l-1.3-4.2H4.8c-1.8,0-2.5-1.1-1.6-2.5L9,2.2c0.7-1.1,2-1.1,2.8,0l5.8,12.8c0.9,1.4,0.2,2.5-1.6,2.5h-2.5l-1.3,4.2C10.1,22.1,9.8,22.3,9.6,22.2z"/></svg>`,
            black: (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="black" stroke="white" stroke-width="1.5" d="M9.6,22.2c-0.4,0.1-0.9-0.1-1-0.5l-1.3-4.2H4.8c-1.8,0-2.5-1.1-1.6-2.5L9,2.2c0.7-1.1,2-1.1,2.8,0l5.8,12.8c0.9,1.4,0.2,2.5-1.6,2.5h-2.5l-1.3,4.2C10.1,22.1,9.8,22.3,9.6,22.2z"/></svg>`
        }
    };
    const clickableSelectors = 'a, button, input[type="submit"], input[type="button"], [role="button"], #cc-handle, .cc-slider';

    function applyStyles() {
        const isBlack = toggleSwitch.is(':checked');
        const sizeMultiplier = parseFloat(sizeSlider.val());
        const cursorSize = 24 * sizeMultiplier;
        const color = isBlack ? 'black' : 'white';
        let styleRules = '';

        if (sizeMultiplier > 1 || isBlack) {
            const arrowCursorSVG = `url('data:image/svg+xml;utf8,${encodeURIComponent(cursorSVG.arrow[color](cursorSize))}') 4 0, auto`;
            const pointerCursorSVG = `url('data:image/svg+xml;utf8,${encodeURIComponent(cursorSVG.pointer[color](cursorSize))}') 12 12, pointer`;
            styleRules = `
                html {
                    cursor: ${arrowCursorSVG} !important;
                }

                html body, html body * {
                    cursor: inherit !important;
                }
                
                html body ${clickableSelectors},
                html body #cc-size-slider,
                html body #cc-size-slider::-webkit-slider-thumb,
                html body #cc-size-slider::-moz-range-thumb,
                html body #cc-size-slider::-moz-range-track {
                    cursor: ${pointerCursorSVG} !important;
                }
            `;
        }
        
        dynamicStyles.html(styleRules);
    }
    
    function updateSizeDisplay() {
        const size = parseFloat(sizeSlider.val()).toFixed(1);
        sizeValueDisplay.text('x' + size);
    }

    function saveState() {
        const settings = { isBlack: toggleSwitch.is(':checked'), size: sizeSlider.val() };
        if (!settings.isBlack && parseFloat(settings.size) <= 1) {
            localStorage.removeItem(storageKey);
        } else {
            localStorage.setItem(storageKey, JSON.stringify(settings));
        }
    }

    function loadState() {
        const savedSettings = JSON.parse(localStorage.getItem(storageKey));
        if (savedSettings) {
            toggleSwitch.prop('checked', savedSettings.isBlack || false);
            sizeSlider.val(savedSettings.size || 1);
        } else {
            toggleSwitch.prop('checked', false);
            sizeSlider.val(1);
        }
        updateSizeDisplay();
        applyStyles();
    }
    
    function resetAll() {
        toggleSwitch.prop('checked', false);
        sizeSlider.val(1);
        updateSizeDisplay();
        applyStyles();
        localStorage.removeItem(storageKey);
    }

    handle.on('click', () => panel.toggleClass('open'));
    toggleSwitch.on('change', () => { applyStyles(); saveState(); });
    resetButton.on('click', resetAll);
    sizeSlider.on('input', () => { updateSizeDisplay(); applyStyles(); });
    sizeSlider.on('change', saveState);

    loadState();
});