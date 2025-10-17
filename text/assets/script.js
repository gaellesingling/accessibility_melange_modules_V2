/**
 * Module Texte - JavaScript avec boutons +/- (sans changement de police)
 * Version: 1.0.0
 */

(function($) {
    'use strict';

    class TextModule {
        constructor() {
            this.module = $('#acc-module-text');
            this.toggle = $('#acc-text-toggle');
            this.content = $('#acc-text-content');
            this.sizeSlider = $('#acc-text-size');
            this.paragraphSpacingSlider = $('#acc-text-paragraph-spacing');
            this.lineHeightSlider = $('#acc-text-line-height');
            this.wordSpacingSlider = $('#acc-text-word-spacing');
            this.letterSpacingSlider = $('#acc-text-letter-spacing');
            this.resetBtn = $('#acc-text-reset');
            
            this.settings = this.getDefaultSettings();
            this.isActive = false;
            
            this.init();
        }

        init() {
            this.loadSettings();
            this.bindEvents();
            this.updateUI();
            
            if (this.isActive) {
                this.applyAllSettings();
            }
            
            console.log('✓ Module Texte initialisé', this.settings);
        }

        getDefaultSettings() {
            return {
                size: 16,
                paragraphSpacing: 1,
                lineHeight: 150,
                wordSpacing: 0,
                letterSpacing: 0
            };
        }

        bindEvents() {
            // Toggle du module
            this.toggle.on('change', () => this.handleToggle());
            
            // Sliders
            this.sizeSlider.on('input', () => this.handleSizeChange());
            this.paragraphSpacingSlider.on('input', () => this.handleParagraphSpacingChange());
            this.lineHeightSlider.on('input', () => this.handleLineHeightChange());
            this.wordSpacingSlider.on('input', () => this.handleWordSpacingChange());
            this.letterSpacingSlider.on('input', () => this.handleLetterSpacingChange());
            
            // Réinitialisation
            this.resetBtn.on('click', () => this.reset());
            
            // Boutons +/- pour tous les sliders
            this.bindSliderButtons();
        }

        /**
         * Gère les boutons +/- des sliders
         */
        bindSliderButtons() {
            $('.acc-slider-btn').on('click', (e) => {
                e.preventDefault();
                const $btn = $(e.currentTarget);
                const targetId = $btn.data('target');
                const $slider = $('#' + targetId);
                
                if (!$slider.length) return;
                
                const min = parseFloat($slider.attr('min'));
                const max = parseFloat($slider.attr('max'));
                const step = parseFloat($slider.attr('step'));
                let currentValue = parseFloat($slider.val());
                
                if ($btn.hasClass('acc-slider-plus')) {
                    currentValue = Math.min(currentValue + step, max);
                } else if ($btn.hasClass('acc-slider-minus')) {
                    currentValue = Math.max(currentValue - step, min);
                }
                
                currentValue = Math.round(currentValue * 100) / 100;
                $slider.val(currentValue).trigger('input');
            });
        }

        handleToggle() {
            this.isActive = this.toggle.is(':checked');
            
            if (this.isActive) {
                this.content.slideDown(300);
                this.applyAllSettings();
                this.savePreference('active', true);
                this.announce('Module texte activé');
            } else {
                this.content.slideUp(300);
                this.removeAllSettings();
                this.savePreference('active', false);
                this.announce('Module texte désactivé');
            }
        }

        handleSizeChange() {
            this.settings.size = parseInt(this.sizeSlider.val());
            $('#acc-text-size-value').text(this.settings.size + 'px');
            this.applySize();
            this.savePreference('size', this.settings.size);
        }

        handleParagraphSpacingChange() {
            this.settings.paragraphSpacing = parseFloat(this.paragraphSpacingSlider.val());
            $('#acc-text-paragraph-spacing-value').text(this.settings.paragraphSpacing.toFixed(1) + 'em');
            this.applyParagraphSpacing();
            this.savePreference('paragraphSpacing', this.settings.paragraphSpacing);
        }

        handleLineHeightChange() {
            this.settings.lineHeight = parseInt(this.lineHeightSlider.val());
            $('#acc-text-line-height-value').text(this.settings.lineHeight + '%');
            this.applyLineHeight();
            this.savePreference('lineHeight', this.settings.lineHeight);
        }

        handleWordSpacingChange() {
            this.settings.wordSpacing = parseInt(this.wordSpacingSlider.val());
            $('#acc-text-word-spacing-value').text(this.settings.wordSpacing + 'px');
            this.applyWordSpacing();
            this.savePreference('wordSpacing', this.settings.wordSpacing);
        }

        handleLetterSpacingChange() {
            this.settings.letterSpacing = parseFloat(this.letterSpacingSlider.val());
            $('#acc-text-letter-spacing-value').text(this.settings.letterSpacing.toFixed(1) + 'px');
            this.applyLetterSpacing();
            this.savePreference('letterSpacing', this.settings.letterSpacing);
        }

        applyAllSettings() {
            this.applySize();
            this.applyParagraphSpacing();
            this.applyLineHeight();
            this.applyWordSpacing();
            this.applyLetterSpacing();
        }

        applySize() {
            $('#acc-text-size-style').remove();
            const css = `body { font-size: ${this.settings.size}px !important; }`;
            $('<style>', { id: 'acc-text-size-style', html: css }).appendTo('head');
        }

        applyParagraphSpacing() {
            $('#acc-text-paragraph-style').remove();
            const css = `p { margin-bottom: ${this.settings.paragraphSpacing}em !important; }`;
            $('<style>', { id: 'acc-text-paragraph-style', html: css }).appendTo('head');
        }

        applyLineHeight() {
            $('#acc-text-lineheight-style').remove();
            const css = `body, p, div, li, td, th { line-height: ${this.settings.lineHeight}% !important; } h1, h2, h3, h4, h5, h6 { line-height: ${this.settings.lineHeight}% !important; }`;
            $('<style>', { id: 'acc-text-lineheight-style', html: css }).appendTo('head');
        }

        applyWordSpacing() {
            $('#acc-text-wordspacing-style').remove();
            if (this.settings.wordSpacing > 0) {
                const css = `p, div, span, a, li { word-spacing: ${this.settings.wordSpacing}px !important; }`;
                $('<style>', { id: 'acc-text-wordspacing-style', html: css }).appendTo('head');
            }
        }

        applyLetterSpacing() {
            $('#acc-text-letterspacing-style').remove();
            if (this.settings.letterSpacing > 0) {
                const css = `p, div, span, a, li, h1, h2, h3, h4, h5, h6 { letter-spacing: ${this.settings.letterSpacing}px !important; }`;
                $('<style>', { id: 'acc-text-letterspacing-style', html: css }).appendTo('head');
            }
        }

        removeAllSettings() {
            $('#acc-text-size-style, #acc-text-paragraph-style, #acc-text-lineheight-style, #acc-text-wordspacing-style, #acc-text-letterspacing-style').remove();
        }

        reset() {
            if (confirm('Réinitialiser tous les paramètres du texte ?')) {
                this.settings = this.getDefaultSettings();
                this.updateUI();
                this.applyAllSettings();
                this.saveAllSettings();
                this.announce('Paramètres du texte réinitialisés');
            }
        }

        updateUI() {
            this.sizeSlider.val(this.settings.size);
            this.paragraphSpacingSlider.val(this.settings.paragraphSpacing);
            this.lineHeightSlider.val(this.settings.lineHeight);
            this.wordSpacingSlider.val(this.settings.wordSpacing);
            this.letterSpacingSlider.val(this.settings.letterSpacing);
            
            $('#acc-text-size-value').text(this.settings.size + 'px');
            $('#acc-text-paragraph-spacing-value').text(this.settings.paragraphSpacing.toFixed(1) + 'em');
            $('#acc-text-line-height-value').text(this.settings.lineHeight + '%');
            $('#acc-text-word-spacing-value').text(this.settings.wordSpacing + 'px');
            $('#acc-text-letter-spacing-value').text(this.settings.letterSpacing.toFixed(1) + 'px');
        }

        savePreference(key, value) {
            const cookieName = `acc_text_${key}`;
            const cookieValue = JSON.stringify(value);
            document.cookie = `${cookieName}=${cookieValue};expires=Fri, 31 Dec 9999 23:59:59 GMT;path=/;SameSite=Lax`;
        }

        getPreference(key, defaultValue) {
            const cookieName = `acc_text_${key}=`;
            const decodedCookie = decodeURIComponent(document.cookie);
            const cookieArray = decodedCookie.split(';');
            for (let i = 0; i < cookieArray.length; i++) {
                let cookie = cookieArray[i].trim();
                if (cookie.indexOf(cookieName) === 0) {
                    try {
                        return JSON.parse(cookie.substring(cookieName.length, cookie.length));
                    } catch (e) {
                        return cookie.substring(cookieName.length, cookie.length);
                    }
                }
            }
            return defaultValue;
        }

        loadSettings() {
            this.isActive = this.getPreference('active', false);
            this.settings.size = this.getPreference('size', 16);
            this.settings.paragraphSpacing = this.getPreference('paragraphSpacing', 1);
            this.settings.lineHeight = this.getPreference('lineHeight', 150);
            this.settings.wordSpacing = this.getPreference('wordSpacing', 0);
            this.settings.letterSpacing = this.getPreference('letterSpacing', 0);
            
            this.toggle.prop('checked', this.isActive);
            if (this.isActive) {
                this.content.show();
            }
        }

        saveAllSettings() {
            this.savePreference('active', this.isActive);
            this.savePreference('size', this.settings.size);
            this.savePreference('paragraphSpacing', this.settings.paragraphSpacing);
            this.savePreference('lineHeight', this.settings.lineHeight);
            this.savePreference('wordSpacing', this.settings.wordSpacing);
            this.savePreference('letterSpacing', this.settings.letterSpacing);
        }

        announce(message) {
            let $announcer = $('#acc-screen-reader-announcer');
            if (!$announcer.length) {
                $announcer = $('<div>', {
                    id: 'acc-screen-reader-announcer', 'aria-live': 'polite', css: { position: 'absolute', left: '-10000px' }
                }).appendTo('body');
            }
            $announcer.text(message);
        }
    }

    $(document).ready(function() {
        if ($('#acc-module-text').length) {
            window.accTextModule = new TextModule();
        }
    });

})(jQuery);