/**
 * Module Luminosité - JavaScript
 * Gestion des modes d'affichage et filtres visuels
 * Version: 1.0.0
 * 
 * IMPORTANT: Utilise uniquement les cookies (pas localStorage)
 */

(function($) {
    'use strict';

    /**
     * Classe du module Luminosité
     */
    class BrightnessModule {
        constructor() {
            this.module = $('#acc-module-brightness');
            this.toggle = $('#acc-brightness-toggle');
            this.content = $('#acc-brightness-content');
            this.modeButtons = $('.acc-brightness-mode');
            this.contrastSlider = $('#acc-brightness-contrast');
            this.brightnessSlider = $('#acc-brightness-brightness');
            this.saturationSlider = $('#acc-brightness-saturation');
            this.resetBtn = $('#acc-brightness-reset');
            this.advanced = $('#acc-brightness-advanced');
            this.sliderButtons = $('.acc-slider-btn');
            
            this.settings = this.getDefaultSettings();
            this.isActive = false;
            
            this.init();
        }

        /**
         * Initialisation
         */
        init() {
            this.loadSettings();
            this.bindEvents();
            this.updateUI();
            
            // Applique les paramètres sauvegardés
            if (this.isActive) {
                this.applyAllSettings();
            }
        }

        /**
         * Paramètres par défaut
         */
        getDefaultSettings() {
            return {
                mode: 'normal',
                contrast: 100,
                brightness: 100,
                saturation: 100
            };
        }

        /**
         * Liaison des événements
         */
        bindEvents() {
            // Toggle du module
            this.toggle.on('change', () => this.handleToggle());
            
            // Modes d'affichage
            this.modeButtons.on('click', (e) => this.handleModeChange(e));
            
            // Navigation clavier dans les modes
            this.modeButtons.on('keydown', (e) => this.handleModeKeyboard(e));
            
            // Contraste
            this.contrastSlider.on('input', () => this.handleContrastChange());
            
            // Luminosité
            this.brightnessSlider.on('input', () => this.handleBrightnessChange());
            
            // Saturation
            this.saturationSlider.on('input', () => this.handleSaturationChange());
            
            // Boutons +/-
            this.sliderButtons.on('click', (e) => this.handleSliderButton(e));
            
            // Réinitialisation
            this.resetBtn.on('click', () => this.reset());
        }

        /**
         * Gère les clics sur les boutons +/-
         */
        handleSliderButton(e) {
            const $button = $(e.currentTarget);
            const targetId = $button.data('target');
            const $slider = $('#' + targetId);
            
            if (!$slider.length) return;
            
            const currentValue = parseInt($slider.val());
            const min = parseInt($slider.attr('min'));
            const max = parseInt($slider.attr('max'));
            const step = parseInt($slider.attr('step'));
            
            let newValue = currentValue;
            
            if ($button.hasClass('acc-slider-decrease')) {
                newValue = Math.max(min, currentValue - step);
            } else if ($button.hasClass('acc-slider-increase')) {
                newValue = Math.min(max, currentValue + step);
            }
            
            if (newValue !== currentValue) {
                $slider.val(newValue).trigger('input');
            }
        }

        /**
         * Gère l'activation/désactivation du module
         */
        handleToggle() {
            this.isActive = this.toggle.is(':checked');
            
            if (this.isActive) {
                this.content.slideDown(300);
                this.applyAllSettings();
                this.savePreference('active', true);
                this.announce('Module luminosité activé');
            } else {
                this.content.slideUp(300);
                this.removeAllSettings();
                this.savePreference('active', false);
                this.announce('Module luminosité désactivé');
            }
        }

        /**
         * Gère le changement de mode
         */
        handleModeChange(e) {
            const $button = $(e.currentTarget);
            const mode = $button.data('mode');
            
            if (mode === this.settings.mode) {
                return;
            }
            
            this.settings.mode = mode;
            this.applyMode();
            this.savePreference('mode', mode);
            this.updateModeUI(mode);
            this.announce(`Mode ${this.getModeName(mode)} activé`);
        }

        /**
         * Navigation clavier dans les modes
         */
        handleModeKeyboard(e) {
            const $current = $(e.currentTarget);
            const $buttons = this.modeButtons;
            const currentIndex = $buttons.index($current);
            let $next = null;

            switch(e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    $next = $buttons.eq((currentIndex + 1) % $buttons.length);
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    $next = $buttons.eq((currentIndex - 1 + $buttons.length) % $buttons.length);
                    break;
                case 'Home':
                    e.preventDefault();
                    $next = $buttons.first();
                    break;
                case 'End':
                    e.preventDefault();
                    $next = $buttons.last();
                    break;
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    $current.click();
                    return;
            }

            if ($next && $next.length) {
                $next.focus();
            }
        }

        /**
         * Gère le changement de contraste
         */
        handleContrastChange() {
            this.settings.contrast = parseInt(this.contrastSlider.val());
            $('#acc-brightness-contrast-value').text(this.settings.contrast + '%');
            this.contrastSlider.attr('aria-valuenow', this.settings.contrast)
                              .attr('aria-valuetext', this.settings.contrast + ' pourcent');
            this.applyAdvanced();
            this.savePreference('contrast', this.settings.contrast);
        }

        /**
         * Gère le changement de luminosité
         */
        handleBrightnessChange() {
            this.settings.brightness = parseInt(this.brightnessSlider.val());
            $('#acc-brightness-brightness-value').text(this.settings.brightness + '%');
            this.brightnessSlider.attr('aria-valuenow', this.settings.brightness)
                                .attr('aria-valuetext', this.settings.brightness + ' pourcent');
            this.applyAdvanced();
            this.savePreference('brightness', this.settings.brightness);
        }

        /**
         * Gère le changement de saturation
         */
        handleSaturationChange() {
            this.settings.saturation = parseInt(this.saturationSlider.val());
            $('#acc-brightness-saturation-value').text(this.settings.saturation + '%');
            this.saturationSlider.attr('aria-valuenow', this.settings.saturation)
                                .attr('aria-valuetext', this.settings.saturation + ' pourcent');
            this.applyAdvanced();
            this.savePreference('saturation', this.settings.saturation);
        }

        /**
         * Applique tous les paramètres
         */
        applyAllSettings() {
            this.applyMode();
            this.applyAdvanced();
        }

        /**
         * Applique le mode sélectionné
         */
        applyMode() {
            // Retire toutes les classes de mode
            $('body').removeClass((index, className) => {
                return (className.match(/\bacc-mode-\S+/g) || []).join(' ');
            });
            
            switch(this.settings.mode) {
                case 'night':
                    this.applyNightMode();
                    break;
                case 'blue_light':
                    this.applyBlueLightMode();
                    break;
                case 'high_contrast':
                    this.applyHighContrastMode();
                    break;
                case 'low_contrast':
                    this.applyLowContrastMode();
                    break;
                case 'grayscale':
                    this.applyGrayscaleMode();
                    break;
                default:
                    this.removeMode();
                    break;
            }
        }

        /**
         * Mode nuit
         */
        applyNightMode() {
            $('body').addClass('acc-mode-night');
        }

        /**
         * Mode lumière bleue
         */
        applyBlueLightMode() {
            $('body').addClass('acc-mode-blue-light');
        }

        /**
         * Mode contraste élevé
         */
        applyHighContrastMode() {
            $('body').addClass('acc-mode-high-contrast');
        }

        /**
         * Mode contraste faible
         */
        applyLowContrastMode() {
            $('body').addClass('acc-mode-low-contrast');
        }

        /**
         * Mode niveaux de gris
         */
        applyGrayscaleMode() {
            $('body').addClass('acc-mode-grayscale');
        }

        /**
         * Retire le mode
         */
        removeMode() {
            $('body').removeClass((index, className) => {
                return (className.match(/\bacc-mode-\S+/g) || []).join(' ');
            });
        }

        /**
         * Applique les réglages avancés
         */
        applyAdvanced() {
            const filters = [];
            
            if (this.settings.contrast !== 100) {
                filters.push(`contrast(${this.settings.contrast}%)`);
            }
            
            if (this.settings.brightness !== 100) {
                filters.push(`brightness(${this.settings.brightness}%)`);
            }
            
            if (this.settings.saturation !== 100) {
                filters.push(`saturate(${this.settings.saturation}%)`);
            }
            
            if (filters.length > 0) {
                const filterCSS = filters.join(' ');
                window.accUtils.applyFilter(filterCSS);
            } else {
                $('body').css('filter', '');
            }
        }

        /**
         * Supprime tous les paramètres
         */
        removeAllSettings() {
            this.removeMode();
            $('body').css('filter', '');
        }

        /**
         * Réinitialise tous les paramètres
         */
        reset() {
            if (confirm('Réinitialiser tous les paramètres de luminosité ?')) {
                this.settings = this.getDefaultSettings();
                this.updateUI();
                this.applyAllSettings();
                this.saveAllSettings();
                this.announce('Paramètres de luminosité réinitialisés');
            }
        }

        /**
         * Met à jour l'interface
         */
        updateUI() {
            this.updateModeUI(this.settings.mode);
            
            this.contrastSlider.val(this.settings.contrast);
            this.brightnessSlider.val(this.settings.brightness);
            this.saturationSlider.val(this.settings.saturation);
            
            $('#acc-brightness-contrast-value').text(this.settings.contrast + '%');
            $('#acc-brightness-brightness-value').text(this.settings.brightness + '%');
            $('#acc-brightness-saturation-value').text(this.settings.saturation + '%');
        }

        /**
         * Met à jour l'UI des modes
         */
        updateModeUI(mode) {
            this.modeButtons.removeClass('active')
                           .attr('aria-checked', 'false');
            
            this.modeButtons.filter(`[data-mode="${mode}"]`)
                           .addClass('active')
                           .attr('aria-checked', 'true');
        }

        /**
         * Récupère le nom d'un mode
         */
        getModeName(mode) {
            const names = {
                'normal': 'normal',
                'night': 'nuit',
                'blue_light': 'lumière bleue',
                'high_contrast': 'contraste élevé',
                'low_contrast': 'contraste faible',
                'grayscale': 'niveaux de gris'
            };
            
            return names[mode] || mode;
        }

        /**
         * Sauvegarde une préférence
         */
        savePreference(key, value) {
            window.accWidget.savePreference(`brightness_${key}`, value);
        }

        /**
         * Récupère une préférence
         */
        getPreference(key, defaultValue) {
            return window.accWidget.getPreference(`brightness_${key}`, defaultValue);
        }

        /**
         * Charge les paramètres sauvegardés
         */
        loadSettings() {
            this.isActive = this.getPreference('active', false);
            this.settings.mode = this.getPreference('mode', 'normal');
            this.settings.contrast = this.getPreference('contrast', 100);
            this.settings.brightness = this.getPreference('brightness', 100);
            this.settings.saturation = this.getPreference('saturation', 100);
            
            this.toggle.prop('checked', this.isActive);
            if (this.isActive) {
                this.content.show();
            }
        }

        /**
         * Sauvegarde tous les paramètres
         */
        saveAllSettings() {
            this.savePreference('active', this.isActive);
            this.savePreference('mode', this.settings.mode);
            this.savePreference('contrast', this.settings.contrast);
            this.savePreference('brightness', this.settings.brightness);
            this.savePreference('saturation', this.settings.saturation);
        }

        /**
         * Annonce pour les lecteurs d'écran
         */
        announce(message) {
            if (window.accWidget) {
                window.accWidget.announce(message);
            }
        }
    }

    /**
     * Initialisation
     */
    $(document).ready(function() {
        if ($('#acc-module-brightness').length) {
            window.accBrightnessModule = new BrightnessModule();
        }
    });

})(jQuery);