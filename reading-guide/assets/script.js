/**
 * Module Guide de Lecture - JavaScript
 * Version: 1.7.1 - Sommaire non auto-restauré + Syllabification v4.0
 * 
 * IMPORTANT: Utilise uniquement les cookies (pas localStorage)
 */

(function($) {
    'use strict';

    /**
     * Classe du module Guide de Lecture
     */
    class ReadingGuideModule {
        constructor() {
            this.module = $('#acc-module-reading-guide');
            this.toggle = $('#acc-reading-guide-toggle');
            this.content = $('#acc-reading-guide-content');
            this.featureInputs = $('.acc-feature-input');
            this.resetBtn = $('#acc-reading-guide-reset');
            this.sliderButtons = $('.acc-slider-btn');
            
            this.features = {
                ruler: new RulerFeature(),
                syllables: new SyllablesFeature(),
                toc: new TOCFeature(),
                focus: new FocusFeature()
            };
            
            this.isActive = false;
            
            this.init();
        }

        init() {
            this.loadSettings();
            this.bindEvents();
            
            if (this.isActive) {
                this.restoreFeatures();
            }
        }

        bindEvents() {
            this.toggle.on('change', () => this.handleToggle());
            this.featureInputs.on('change', (e) => this.handleFeatureToggle(e));
            this.sliderButtons.on('click', (e) => this.handleSliderButton(e));
            this.resetBtn.on('click', () => this.reset());
        }

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

        handleToggle() {
            this.isActive = this.toggle.is(':checked');
            
            if (this.isActive) {
                this.content.slideDown(300);
                this.savePreference('active', true);
                this.announce('Module Guide de Lecture activé');
            } else {
                this.content.slideUp(300);
                this.disableAllFeatures();
                this.savePreference('active', false);
                this.announce('Module Guide de Lecture désactivé');
            }
        }

        handleFeatureToggle(e) {
            const $input = $(e.currentTarget);
            const featureName = $input.data('feature');
            const isEnabled = $input.is(':checked');
            
            const feature = this.features[featureName];
            if (!feature) return;
            
            if (isEnabled) {
                feature.enable();
                this.announce(`${featureName} activé`);
                
                if (featureName === 'ruler') {
                    $('#acc-ruler-options').slideDown(300);
                }
            } else {
                feature.disable();
                this.announce(`${featureName} désactivé`);
                
                if (featureName === 'ruler') {
                    $('#acc-ruler-options').slideUp(300);
                }
            }
            
            this.savePreference(`feature_${featureName}`, isEnabled);
        }

        disableAllFeatures() {
            this.featureInputs.each((i, input) => {
                $(input).prop('checked', false);
                const featureName = $(input).data('feature');
                if (this.features[featureName]) {
                    this.features[featureName].disable();
                }
            });
            
            $('#acc-ruler-options').hide();
        }

        /**
         * Restaure les features sauvegardées
         */
        restoreFeatures() {
            this.featureInputs.each((i, input) => {
                const $input = $(input);
                const featureName = $input.data('feature');
                const isEnabled = this.getPreference(`feature_${featureName}`, false);
                
                if (isEnabled) {
                    $input.prop('checked', true);
                    
                    // NE PAS restaurer automatiquement le sommaire
                    // Il doit être activé manuellement par l'utilisateur
                    if (featureName !== 'toc' && this.features[featureName]) {
                        this.features[featureName].enable();
                        
                        // Afficher les options si c'est la règle
                        if (featureName === 'ruler') {
                            $('#acc-ruler-options').show();
                        }
                    }
                }
            });
        }

        reset() {
            if (confirm('Désactiver toutes les fonctionnalités ?')) {
                this.disableAllFeatures();
                
                this.featureInputs.each((i, input) => {
                    const featureName = $(input).data('feature');
                    this.savePreference(`feature_${featureName}`, false);
                });
                
                this.announce('Toutes les fonctionnalités désactivées');
            }
        }

        savePreference(key, value) {
            window.accWidget.savePreference(`reading_${key}`, value);
        }

        getPreference(key, defaultValue) {
            return window.accWidget.getPreference(`reading_${key}`, defaultValue);
        }

        loadSettings() {
            this.isActive = this.getPreference('active', false);
            this.toggle.prop('checked', this.isActive);
            
            if (this.isActive) {
                this.content.show();
            }
        }

        announce(message) {
            if (window.accWidget) {
                window.accWidget.announce(message);
            }
        }
    }

    /**
     * Feature: Règle de lecture
     */
    class RulerFeature {
        constructor() {
            this.enabled = false;
            this.$ruler = null;
            
            this.settings = {
                color: '#ffff00',
                height: 40,
                opacity: 30
            };
            
            this.initControls();
        }

        initControls() {
            this.loadSettings();
            
            $('#acc-ruler-color').val(this.settings.color);
            $('#acc-ruler-height').val(this.settings.height);
            $('#acc-ruler-opacity').val(this.settings.opacity);
            $('#acc-ruler-height-value').text(this.settings.height + 'px');
            $('#acc-ruler-opacity-value').text(this.settings.opacity + '%');
            
            $('#acc-ruler-color').on('input change', (e) => {
                this.settings.color = e.target.value;
                this.applySettings();
                this.saveSettings();
            });
            
            $('#acc-ruler-height').on('input', (e) => {
                this.settings.height = parseInt(e.target.value);
                $('#acc-ruler-height-value').text(this.settings.height + 'px');
                this.applySettings();
                this.saveSettings();
            });
            
            $('#acc-ruler-opacity').on('input', (e) => {
                this.settings.opacity = parseInt(e.target.value);
                $('#acc-ruler-opacity-value').text(this.settings.opacity + '%');
                this.applySettings();
                this.saveSettings();
            });
        }

        loadSettings() {
            this.settings.color = this.getPreference('ruler_color', '#ffff00');
            this.settings.height = this.getPreference('ruler_height', 40);
            this.settings.opacity = this.getPreference('ruler_opacity', 30);
        }

        saveSettings() {
            this.savePreference('ruler_color', this.settings.color);
            this.savePreference('ruler_height', this.settings.height);
            this.savePreference('ruler_opacity', this.settings.opacity);
        }

        applySettings() {
            if (!this.$ruler) return;
            
            const rgba = this.hexToRgba(this.settings.color, this.settings.opacity / 100);
            
            this.$ruler.css({
                'height': this.settings.height + 'px',
                'background': rgba
            });
        }

        enable() {
            if (this.enabled) return;
            
            this.$ruler = $('<div>', {
                id: 'acc-reading-ruler-active',
                class: 'acc-reading-ruler'
            });
            
            $('body').append(this.$ruler);
            this.applySettings();
            
            $(document).on('mousemove.ruler', (e) => {
                if (this.$ruler) {
                    const top = e.clientY - (this.settings.height / 2);
                    this.$ruler.css('top', top + 'px').show();
                }
            });
            
            this.enabled = true;
        }

        disable() {
            if (!this.enabled) return;
            
            $(document).off('mousemove.ruler');
            if (this.$ruler) {
                this.$ruler.remove();
                this.$ruler = null;
            }
            
            this.enabled = false;
        }

        hexToRgba(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        savePreference(key, value) {
            window.accWidget.savePreference(`reading_${key}`, value);
        }

        getPreference(key, defaultValue) {
            return window.accWidget.getPreference(`reading_${key}`, defaultValue);
        }
    }

    /**
     * Feature: Division des syllabes (ALGORITHME ROBUSTE v4.0)
     * Approche simplifiée mais complète et fiable
     */
    class SyllablesFeature {
        constructor() {
            this.enabled = false;
            this.originalContent = new Map();
            this.separator = '·';
            
            // VOYELLES complètes
            this.vowels = 'aeiouyàâäæéèêëïîôœöùûüÿ';
            
            // GROUPES CONSONANTIQUES INSÉPARABLES (tous)
            this.inseparableGroups = [
                // Consonne + L
                'bl', 'cl', 'fl', 'gl', 'pl', 'kl', 'vl', 'sl',
                // Consonne + R
                'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'vr', 'kr', 'sr',
                // Digraphes spéciaux
                'ch', 'sh', 'ph', 'th', 'gh',
                // Autres groupes
                'gn', 'qu', 'gu', 'sc', 'sp', 'st', 'sk', 'sm', 'sn', 'sw'
            ];
        }

        enable() {
            if (this.enabled) return;
            
            const $elements = $('p, h1, h2, h3, h4, h5, h6, li, span, td, th')
                .not('[data-syllabified]')
                .not('.acc-widget *');
            
            $elements.each((i, el) => {
                const $el = $(el);
                
                if ($el.children().length === 0) {
                    const text = $el.text().trim();
                    
                    if (text && text.length > 2) {
                        this.originalContent.set(el, text);
                        const syllabified = this.syllabify(text);
                        $el.html(syllabified)
                            .attr('data-syllabified', 'true')
                            .addClass('acc-syllabified');
                    }
                }
            });
            
            this.enabled = true;
            console.log(`✓ Syllabification v4.0 (robuste) appliquée à ${this.originalContent.size} éléments`);
        }

        disable() {
            if (!this.enabled) return;
            
            this.originalContent.forEach((original, el) => {
                $(el).text(original)
                    .removeAttr('data-syllabified')
                    .removeClass('acc-syllabified');
            });
            
            this.originalContent.clear();
            this.enabled = false;
        }

        /**
         * Syllabifie un texte complet
         */
        syllabify(text) {
            // Séparer en mots et garder ponctuation/espaces
            const tokens = text.split(/(\s+|[.,;:!?()«»"'\-—–])/);
            
            return tokens.map(token => {
                // Ne pas traiter les espaces, ponctuation ou mots très courts
                if (/^\s+$/.test(token) || token.length < 3 || /^[.,;:!?()«»"'\-—–\d]+$/.test(token)) {
                    return token;
                }
                
                return this.syllabifyWord(token);
            }).join('');
        }

        /**
         * Syllabifie un mot selon les règles françaises
         * 
         * PRINCIPE DE BASE (simplifié mais complet) :
         * 1. Construire la structure Voyelle/Consonne du mot
         * 2. Trouver tous les "noyaux syllabiques" (voyelles ou groupes de voyelles)
         * 3. Entre deux noyaux, déterminer où couper selon les règles :
         *    - V-CV : une consonne va avec la voyelle suivante
         *    - VC-CV : deux consonnes → coupe entre elles (sauf groupe inséparable)
         *    - VCC-CV : consonnes identiques → toujours couper entre
         *    - V-CCV : groupe inséparable → reste avec la voyelle suivante
         */
        syllabifyWord(word) {
            if (word.length < 3) {
                return word;
            }
            
            const lower = word.toLowerCase();
            
            // 1. Identifier les noyaux syllabiques (voyelles)
            const nuclei = this.findSyllableNuclei(lower);
            
            if (nuclei.length <= 1) {
                return word; // Un seul noyau = une seule syllabe
            }
            
            // 2. Trouver les points de coupure entre les noyaux
            const cuts = [];
            
            for (let i = 0; i < nuclei.length - 1; i++) {
                const nucleus1 = nuclei[i];
                const nucleus2 = nuclei[i + 1];
                
                // Analyser ce qui se trouve entre les deux noyaux
                const between = lower.substring(nucleus1.end, nucleus2.start);
                
                // Déterminer où couper
                const cutPos = this.findCutPosition(lower, nucleus1.end, nucleus2.start, between);
                
                if (cutPos !== null) {
                    cuts.push(cutPos);
                }
            }
            
            // 3. Construire les syllabes
            if (cuts.length === 0) {
                return word;
            }
            
            const syllables = [];
            let start = 0;
            
            for (const cut of cuts) {
                syllables.push(word.substring(start, cut));
                start = cut;
            }
            syllables.push(word.substring(start));
            
            return syllables.filter(s => s.length > 0).join(this.separator);
        }

        /**
         * Trouve tous les noyaux syllabiques (groupes de voyelles)
         */
        findSyllableNuclei(word) {
            const nuclei = [];
            let i = 0;
            
            while (i < word.length) {
                if (this.isVowel(word[i])) {
                    const start = i;
                    
                    // Continuer tant qu'on a des voyelles (groupe de voyelles = un seul noyau)
                    while (i < word.length && this.isVowel(word[i])) {
                        i++;
                    }
                    
                    nuclei.push({
                        start: start,
                        end: i,
                        text: word.substring(start, i)
                    });
                } else {
                    i++;
                }
            }
            
            return nuclei;
        }

        /**
         * Détermine où couper entre deux noyaux syllabiques
         * 
         * RÈGLES APPLIQUÉES :
         * - Pas de consonne : pas de coupure
         * - 1 consonne (V-CV) : la consonne va avec la 2e voyelle → couper avant
         * - 2 consonnes identiques (VC-CV) : couper entre (pom-me)
         * - 2 consonnes formant groupe inséparable (V-CCV) : le groupe va avec la 2e voyelle
         * - 2 consonnes différentes (VC-CV) : couper entre (par-tir)
         * - 3+ consonnes : chercher groupe inséparable et couper avant lui
         */
        findCutPosition(word, start, end, between) {
            if (between.length === 0) {
                return null; // Pas de consonne entre les voyelles
            }
            
            // H est transparent
            const betweenNoH = between.replace(/h/g, '');
            
            if (betweenNoH.length === 0) {
                return null; // Que des H
            }
            
            // CAS 1 : Une seule consonne → V-CV
            // La consonne va avec la voyelle suivante
            if (betweenNoH.length === 1) {
                return start; // Couper avant la consonne
            }
            
            // CAS 2 : Deux consonnes identiques → VC-CV
            // TOUJOURS couper entre (pom-me, ter-re, bel-le)
            if (betweenNoH.length === 2 && betweenNoH[0] === betweenNoH[1]) {
                // Trouver la position de la 2e consonne dans le mot original
                let pos = start;
                let count = 0;
                while (pos < end && count < 1) {
                    if (word[pos] !== 'h' && !this.isVowel(word[pos])) {
                        count++;
                    }
                    pos++;
                }
                return pos;
            }
            
            // CAS 3 : Deux consonnes formant un groupe inséparable → V-CCV
            // Le groupe reste avec la voyelle suivante (ta-ble, a-bri)
            if (betweenNoH.length === 2 && this.isInseparableGroup(betweenNoH)) {
                return start; // Couper avant le groupe
            }
            
            // CAS 4 : Deux consonnes différentes sans groupe → VC-CV
            // Couper entre les deux (par-tir, car-ton)
            if (betweenNoH.length === 2) {
                let pos = start;
                let count = 0;
                while (pos < end && count < 1) {
                    if (word[pos] !== 'h' && !this.isVowel(word[pos])) {
                        count++;
                    }
                    pos++;
                }
                return pos;
            }
            
            // CAS 5 : Trois consonnes ou plus
            // Chercher un groupe inséparable et couper avant lui
            if (betweenNoH.length >= 3) {
                // Chercher un groupe inséparable dans la séquence
                for (let i = 0; i < betweenNoH.length - 1; i++) {
                    const pair = betweenNoH.substring(i, i + 2);
                    if (this.isInseparableGroup(pair)) {
                        // Trouver cette position dans le mot original
                        let pos = start;
                        let consonantCount = 0;
                        while (pos < end) {
                            if (word[pos] !== 'h' && !this.isVowel(word[pos])) {
                                if (consonantCount === i) {
                                    return pos; // Couper avant le groupe
                                }
                                consonantCount++;
                            }
                            pos++;
                        }
                    }
                }
                
                // Pas de groupe trouvé : couper après la 1ère consonne
                let pos = start;
                let count = 0;
                while (pos < end && count < 1) {
                    if (word[pos] !== 'h' && !this.isVowel(word[pos])) {
                        count++;
                    }
                    pos++;
                }
                return pos;
            }
            
            return null;
        }

        /**
         * Vérifie si deux consonnes forment un groupe inséparable
         */
        isInseparableGroup(consonants) {
            return this.inseparableGroups.includes(consonants.toLowerCase());
        }

        /**
         * Vérifie si un caractère est une voyelle
         */
        isVowel(char) {
            return this.vowels.includes(char.toLowerCase());
        }
    }

    /**
     * Feature: Sommaire
     */
    class TOCFeature {
        constructor() {
            this.enabled = false;
            this.$toc = null;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
        }

        enable() {
            if (this.enabled) return;
            this.generateTOC();
            this.enabled = true;
        }

        disable() {
            if (!this.enabled) return;
            
            if (this.$toc) {
                this.$toc.fadeOut(300, () => {
                    this.$toc.remove();
                    this.$toc = null;
                });
            }
            
            this.enabled = false;
        }

        detectHeadings() {
            const headings = [];
            
            $('h1, h2, h3, h4, h5, h6').not('.acc-widget *').each((i, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                if (text.length > 0 && $el.is(':visible')) {
                    headings.push({
                        element: el,
                        text: text,
                        level: parseInt(el.tagName.substring(1)),
                        type: 'semantic'
                    });
                }
            });
            
            $('[role="heading"]').not('.acc-widget *').each((i, el) => {
                const $el = $(el);
                if (!el.tagName.match(/^H[1-6]$/i) && $el.is(':visible')) {
                    const ariaLevel = parseInt($el.attr('aria-level')) || 2;
                    const text = $el.text().trim();
                    if (text.length > 0) {
                        headings.push({
                            element: el,
                            text: text,
                            level: ariaLevel,
                            type: 'aria'
                        });
                    }
                }
            });
            
            const titleSelectors = [
                '.entry-title', '.post-title', '.page-title', 
                '.article-title', '.section-title', '.widget-title',
                '.block-title', '.content-title', '.heading-title',
                '.card-title', '.box-title', '.panel-title'
            ];
            
            titleSelectors.forEach(selector => {
                try {
                    $(selector).not('.acc-widget *').each((i, el) => {
                        const $el = $(el);
                        if (!headings.find(h => h.element === el) && $el.is(':visible')) {
                            const text = $el.text().trim();
                            if (text.length > 0) {
                                const level = this.guessLevelFromStyle($el);
                                headings.push({
                                    element: el,
                                    text: text,
                                    level: level,
                                    type: 'class'
                                });
                            }
                        }
                    });
                } catch(e) {}
            });
            
            if (headings.length < 5) {
                this.detectByStyle(headings);
            }
            
            headings.sort((a, b) => {
                const posA = $(a.element).offset();
                const posB = $(b.element).offset();
                return posA.top - posB.top;
            });
            
            return headings;
        }

        detectByStyle(headings) {
            const $candidates = $('p, div, span, strong, b, a')
                .not('.acc-widget *')
                .not('.acc-module *')
                .not('script, style, noscript');
            
            $candidates.each((i, el) => {
                const $el = $(el);
                
                if (headings.find(h => h.element === el)) return;
                if (!$el.is(':visible')) return;
                
                const text = $el.text().trim();
                if (text.length < 3 || text.length > 150) return;
                if ($el.find('*').length > 5) return;
                
                const score = this.calculateHeadingScore($el);
                
                if (score >= 3) {
                    headings.push({
                        element: el,
                        text: text,
                        level: this.guessLevelFromStyle($el),
                        type: 'style',
                        score: score
                    });
                }
            });
        }

        calculateHeadingScore($el) {
            let score = 0;
            const styles = window.getComputedStyle($el[0]);
            
            const fontSize = parseFloat(styles.fontSize);
            if (fontSize >= 28) score += 3;
            else if (fontSize >= 22) score += 2;
            else if (fontSize >= 16) score += 1;
            
            const fontWeight = parseInt(styles.fontWeight) || 400;
            if (fontWeight >= 700) score += 2;
            else if (fontWeight >= 600) score += 1;
            
            const marginTop = parseFloat(styles.marginTop);
            if (marginTop >= 20) score += 1;
            
            if (styles.display === 'block' || styles.display === 'flex') score += 1;
            
            const textLength = $el.text().trim().length;
            if (textLength <= 60) score += 1;
            
            if (!$el.text().trim().endsWith('.')) score += 1;
            
            return score;
        }

        guessLevelFromStyle($el) {
            const styles = window.getComputedStyle($el[0]);
            const fontSize = parseFloat(styles.fontSize);
            
            if (fontSize >= 32) return 1;
            if (fontSize >= 28) return 2;
            if (fontSize >= 24) return 3;
            if (fontSize >= 20) return 4;
            if (fontSize >= 18) return 5;
            return 6;
        }

        generateTOC() {
            const headings = this.detectHeadings();
            
            if (headings.length === 0) {
                alert('❌ Aucun titre trouvé sur cette page.');
                $('#acc-reading-toc').prop('checked', false);
                return;
            }

            this.$toc = $('<div>', {
                id: 'acc-toc-container',
                class: 'acc-reading-toc-container',
                css: {
                    position: 'fixed',
                    top: '120px',
                    right: '20px',
                    width: '320px',
                    maxHeight: '70vh',
                    background: 'white',
                    border: '2px solid #333',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    zIndex: 999998,
                    display: 'none',
                    overflow: 'hidden'
                }
            });

            let html = `
                <div class="acc-toc-header" style="
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                ">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">
                        📑 Sommaire (${headings.length})
                    </h4>
                    <button class="acc-toc-close" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 18px;
                        transition: all 0.2s;
                        line-height: 1;
                    " aria-label="Fermer le sommaire">✕</button>
                </div>
                <div class="acc-toc-content" style="
                    padding: 15px 20px;
                    overflow-y: auto;
                    max-height: calc(70vh - 60px);
                ">
                    <ul class="acc-toc-list" style="
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    ">
            `;

            headings.forEach((heading, i) => {
                const $h = $(heading.element);
                const text = heading.text;
                const level = heading.level;
                const indent = (level - 1) * 15;
                
                if (!$h.attr('id')) {
                    $h.attr('id', 'acc-heading-' + i);
                }
                const id = $h.attr('id');

                html += `
                    <li style="margin-bottom: 8px; margin-left: ${indent}px;">
                        <a href="#${id}" class="acc-toc-link" data-target="${id}" style="
                            display: block;
                            padding: 8px 12px;
                            color: #0066cc;
                            text-decoration: none;
                            font-size: 14px;
                            border-radius: 6px;
                            transition: all 0.2s;
                            border-left: 3px solid transparent;
                        ">
                            ${text}
                        </a>
                    </li>
                `;
            });

            html += `
                    </ul>
                </div>
                <div class="acc-toc-footer" style="
                    padding: 10px 20px;
                    background: #f5f5f5;
                    border-top: 1px solid #ddd;
                    font-size: 11px;
                    color: #666;
                    text-align: center;
                ">
                    💡 Glissez pour déplacer
                </div>
            `;

            this.$toc.html(html);
            $('body').append(this.$toc);
            this.$toc.fadeIn(400);
            this.attachTOCEvents();
        }

        attachTOCEvents() {
            this.$toc.find('.acc-toc-link').on('click', (e) => {
                e.preventDefault();
                const targetId = $(e.currentTarget).data('target');
                const $target = $('#' + targetId);
                
                if ($target.length) {
                    $('html, body').animate({
                        scrollTop: $target.offset().top - 100
                    }, 500);
                    
                    $target.css({
                        'background-color': 'rgba(255, 255, 0, 0.5)',
                        'transition': 'background-color 0.3s'
                    });
                    setTimeout(() => {
                        $target.css('background-color', '');
                    }, 2000);
                }
            });

            this.$toc.find('.acc-toc-link').on('mouseenter', function() {
                $(this).css({
                    'background': '#e8f4ff',
                    'padding-left': '18px',
                    'border-left-color': '#0066cc'
                });
            }).on('mouseleave', function() {
                $(this).css({
                    'background': '',
                    'padding-left': '12px',
                    'border-left-color': 'transparent'
                });
            });

            this.$toc.find('.acc-toc-close').on('click', () => {
                this.disable();
                $('#acc-reading-toc').prop('checked', false);
            }).on('mouseenter', function() {
                $(this).css({
                    'background': 'rgba(255,255,255,0.3)',
                    'transform': 'rotate(90deg)'
                });
            }).on('mouseleave', function() {
                $(this).css({
                    'background': 'rgba(255,255,255,0.2)',
                    'transform': 'rotate(0deg)'
                });
            });

            const $header = this.$toc.find('.acc-toc-header');
            
            $header.on('mousedown', (e) => {
                this.isDragging = true;
                this.dragOffset = {
                    x: e.clientX - this.$toc.offset().left,
                    y: e.clientY - this.$toc.offset().top
                };
                
                $header.css('cursor', 'grabbing');
                $('body').css('user-select', 'none');
                
                e.preventDefault();
            });

            $(document).on('mousemove.toc', (e) => {
                if (!this.isDragging) return;
                
                const newLeft = e.clientX - this.dragOffset.x;
                const newTop = e.clientY - this.dragOffset.y;
                
                const maxLeft = $(window).width() - this.$toc.outerWidth();
                const maxTop = $(window).height() - this.$toc.outerHeight();
                
                this.$toc.css({
                    left: Math.max(0, Math.min(newLeft, maxLeft)) + 'px',
                    top: Math.max(0, Math.min(newTop, maxTop)) + 'px',
                    right: 'auto',
                    bottom: 'auto'
                });
            });

            $(document).on('mouseup.toc', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    $header.css('cursor', 'move');
                    $('body').css('user-select', '');
                }
            });
        }
    }

    /**
     * Feature: Mode focus
     */
    class FocusFeature {
        constructor() {
            this.enabled = false;
        }

        enable() {
            if (this.enabled) return;
            $('body').addClass('acc-focus-mode');
            this.enabled = true;
        }

        disable() {
            if (!this.enabled) return;
            $('body').removeClass('acc-focus-mode');
            this.enabled = false;
        }
    }

    /**
     * Initialisation
     */
    $(document).ready(function() {
        if ($('#acc-module-reading-guide').length) {
            window.accReadingGuide = new ReadingGuideModule();
            console.log('✓ Module Guide de Lecture initialisé (v1.7.1 - Sommaire non auto-restauré)');
        }
    });

})(jQuery);