<?php
/**
 * Template du module Guide de Lecture
 * Interface utilisateur pour les outils d'aide à la lecture
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="acc-module acc-module-reading-guide" id="acc-module-reading-guide" data-module="reading-guide">
    <div class="acc-module-header">
        <h3 class="acc-module-title">
            <span class="acc-module-icon" aria-hidden="true">📖</span>
            <?php esc_html_e('Guide de Lecture', 'accessibility-modular'); ?>
        </h3>
        <label class="acc-module-toggle">
            <input 
                type="checkbox" 
                id="acc-reading-guide-toggle"
                aria-label="<?php esc_attr_e('Activer/désactiver le module guide de lecture', 'accessibility-modular'); ?>"
            />
            <span class="acc-module-toggle-slider"></span>
        </label>
    </div>

    <div class="acc-module-content" id="acc-reading-guide-content" style="display: none;">
        
        <!-- Règle de lecture -->
        <div class="acc-control-group">
            <div class="acc-feature-item">
                <div class="acc-feature-header">
                    <span class="acc-feature-icon" aria-hidden="true">📏</span>
                    <label for="acc-reading-ruler" class="acc-control-label">
                        <?php esc_html_e('Règle de lecture', 'accessibility-modular'); ?>
                    </label>
                </div>
                <label class="acc-module-toggle acc-feature-toggle">
                    <input 
                        type="checkbox" 
                        id="acc-reading-ruler"
                        class="acc-feature-input"
                        data-feature="ruler"
                        aria-label="<?php esc_attr_e('Activer la règle de lecture', 'accessibility-modular'); ?>"
                    />
                    <span class="acc-module-toggle-slider"></span>
                </label>
            </div>
            <p class="acc-control-hint">
                <?php esc_html_e('Une barre colorée suit votre curseur pour faciliter la lecture ligne par ligne', 'accessibility-modular'); ?>
            </p>

            <!-- Options de personnalisation de la règle -->
            <div id="acc-ruler-options" class="acc-ruler-options" style="display: none; margin-top: 15px; padding: 15px; background: var(--acc-surface); border-radius: 8px;">
                
                <!-- Couleur -->
                <div class="acc-ruler-option-row">
                    <label for="acc-ruler-color" class="acc-control-label">
                        <?php esc_html_e('Couleur', 'accessibility-modular'); ?>
                    </label>
                    <div class="acc-color-picker-wrapper">
                        <input 
                            type="color" 
                            id="acc-ruler-color"
                            value="#ffff00"
                            aria-label="<?php esc_attr_e('Couleur de la règle', 'accessibility-modular'); ?>"
                        />
                    </div>
                </div>

                <!-- Épaisseur -->
                <div class="acc-ruler-option-row">
                    <label for="acc-ruler-height" class="acc-control-label">
                        <?php esc_html_e('Épaisseur', 'accessibility-modular'); ?>
                        <span class="acc-control-value" id="acc-ruler-height-value">40px</span>
                    </label>
                    <div class="acc-slider-container">
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-decrease" 
                            data-target="acc-ruler-height"
                            aria-label="<?php esc_attr_e('Diminuer l\'épaisseur', 'accessibility-modular'); ?>"
                        >
                            −
                        </button>
                        <input 
                            type="range" 
                            id="acc-ruler-height"
                            class="acc-slider"
                            min="20"
                            max="100"
                            step="5"
                            value="40"
                            aria-label="<?php esc_attr_e('Épaisseur de la règle', 'accessibility-modular'); ?>"
                            aria-valuemin="20"
                            aria-valuemax="100"
                            aria-valuenow="40"
                        />
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-increase" 
                            data-target="acc-ruler-height"
                            aria-label="<?php esc_attr_e('Augmenter l\'épaisseur', 'accessibility-modular'); ?>"
                        >
                            +
                        </button>
                    </div>
                </div>

                <!-- Opacité -->
                <div class="acc-ruler-option-row">
                    <label for="acc-ruler-opacity" class="acc-control-label">
                        <?php esc_html_e('Opacité', 'accessibility-modular'); ?>
                        <span class="acc-control-value" id="acc-ruler-opacity-value">30%</span>
                    </label>
                    <div class="acc-slider-container">
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-decrease" 
                            data-target="acc-ruler-opacity"
                            aria-label="<?php esc_attr_e('Diminuer l\'opacité', 'accessibility-modular'); ?>"
                        >
                            −
                        </button>
                        <input 
                            type="range" 
                            id="acc-ruler-opacity"
                            class="acc-slider"
                            min="10"
                            max="90"
                            step="5"
                            value="30"
                            aria-label="<?php esc_attr_e('Opacité de la règle', 'accessibility-modular'); ?>"
                            aria-valuemin="10"
                            aria-valuemax="90"
                            aria-valuenow="30"
                        />
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-increase" 
                            data-target="acc-ruler-opacity"
                            aria-label="<?php esc_attr_e('Augmenter l\'opacité', 'accessibility-modular'); ?>"
                        >
                            +
                        </button>
                    </div>
                </div>

            </div>
        </div>

        <!-- Division des syllabes -->
        <div class="acc-control-group">
            <div class="acc-feature-item">
                <div class="acc-feature-header">
                    <span class="acc-feature-icon" aria-hidden="true">✂️</span>
                    <label for="acc-reading-syllables" class="acc-control-label">
                        <?php esc_html_e('Division des syllabes', 'accessibility-modular'); ?>
                    </label>
                </div>
                <label class="acc-module-toggle acc-feature-toggle">
                    <input 
                        type="checkbox" 
                        id="acc-reading-syllables"
                        class="acc-feature-input"
                        data-feature="syllables"
                        aria-label="<?php esc_attr_e('Activer la division des syllabes', 'accessibility-modular'); ?>"
                    />
                    <span class="acc-module-toggle-slider"></span>
                </label>
            </div>
            <p class="acc-control-hint">
                <?php esc_html_e('Sépare les mots en syllabes avec un point médian (·)', 'accessibility-modular'); ?>
            </p>
        </div>

        <!-- Sommaire -->
        <div class="acc-control-group">
            <div class="acc-feature-item">
                <div class="acc-feature-header">
                    <span class="acc-feature-icon" aria-hidden="true">📑</span>
                    <label for="acc-reading-toc" class="acc-control-label">
                        <?php esc_html_e('Sommaire interactif', 'accessibility-modular'); ?>
                    </label>
                </div>
                <label class="acc-module-toggle acc-feature-toggle">
                    <input 
                        type="checkbox" 
                        id="acc-reading-toc"
                        class="acc-feature-input"
                        data-feature="toc"
                        aria-label="<?php esc_attr_e('Activer le sommaire', 'accessibility-modular'); ?>"
                    />
                    <span class="acc-module-toggle-slider"></span>
                </label>
            </div>
            <p class="acc-control-hint">
                <?php esc_html_e('Génère un sommaire déplaçable basé sur les titres de la page', 'accessibility-modular'); ?>
            </p>
        </div>

        <!-- Mode focus -->
        <div class="acc-control-group">
            <div class="acc-feature-item">
                <div class="acc-feature-header">
                    <span class="acc-feature-icon" aria-hidden="true">🎯</span>
                    <label for="acc-reading-focus" class="acc-control-label">
                        <?php esc_html_e('Mode focus', 'accessibility-modular'); ?>
                    </label>
                </div>
                <label class="acc-module-toggle acc-feature-toggle">
                    <input 
                        type="checkbox" 
                        id="acc-reading-focus"
                        class="acc-feature-input"
                        data-feature="focus"
                        aria-label="<?php esc_attr_e('Activer le mode focus', 'accessibility-modular'); ?>"
                    />
                    <span class="acc-module-toggle-slider"></span>
                </label>
            </div>
            <p class="acc-control-hint">
                <?php esc_html_e('Masque les éléments secondaires pour se concentrer sur le contenu principal', 'accessibility-modular'); ?>
            </p>
        </div>

        <!-- Bouton de réinitialisation -->
        <div class="acc-control-group" style="margin-top: 20px;">
            <div class="acc-button-group">
                <button 
                    type="button" 
                    id="acc-reading-guide-reset" 
                    class="acc-button"
                    aria-label="<?php esc_attr_e('Réinitialiser les paramètres du guide de lecture', 'accessibility-modular'); ?>"
                >
                    <?php esc_html_e('Tout désactiver', 'accessibility-modular'); ?>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Élément pour la règle de lecture (créé dynamiquement par JavaScript) -->
<div id="acc-reading-ruler" class="acc-reading-ruler" style="display: none;"></div>

<!-- Le sommaire est maintenant créé entièrement par JavaScript et n'a plus besoin de div ici -->

<style>
/* Styles pour les features */
.acc-feature-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.acc-feature-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.acc-feature-icon {
    font-size: 20px;
}

.acc-feature-toggle {
    flex-shrink: 0;
}

/* Options de personnalisation de la règle */
.acc-ruler-options {
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        max-height: 0;
    }
    to {
        opacity: 1;
        max-height: 500px;
    }
}

.acc-ruler-option-row {
    margin-bottom: 15px;
}

.acc-ruler-option-row:last-child {
    margin-bottom: 0;
}

/* Color picker wrapper */
.acc-color-picker-wrapper {
    margin-top: 8px;
}

.acc-color-picker-wrapper input[type="color"] {
    width: 80px;
    height: 40px;
    border: 2px solid var(--acc-border);
    border-radius: 6px;
    cursor: pointer;
    padding: 2px;
}

/* ===========================
   SLIDERS AVEC BOUTONS +/-
   =========================== */

/* Conteneur du slider avec boutons */
.acc-slider-container {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
}

/* Boutons +/- */
.acc-slider-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    background: var(--acc-surface, #f8fafc);
    border: 2px solid var(--acc-border, #e2e8f0);
    border-radius: 6px;
    font-size: 18px;
    font-weight: 600;
    color: var(--acc-text, #1e293b);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
}

.acc-slider-btn:hover {
    background: var(--acc-primary, #2563eb);
    border-color: var(--acc-primary, #2563eb);
    color: white;
    transform: scale(1.05);
}

.acc-slider-btn:active {
    transform: scale(0.95);
}

.acc-slider-btn:focus {
    outline: 2px solid var(--acc-primary, #2563eb);
    outline-offset: 2px;
}

.acc-slider-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.acc-slider-btn:disabled:hover {
    background: var(--acc-surface, #f8fafc);
    border-color: var(--acc-border, #e2e8f0);
    color: var(--acc-text, #1e293b);
    transform: none;
}

/* Le slider prend l'espace restant */
.acc-slider-container .acc-slider {
    flex: 1;
    margin: 0;
}

/* Style du slider */
.acc-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--acc-border, #e2e8f0);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
}

.acc-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--acc-primary, #2563eb);
    cursor: pointer;
    transition: all 0.2s ease;
}

.acc-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2);
}

.acc-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--acc-primary, #2563eb);
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
}

.acc-slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2);
}

.acc-slider:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);
}

.acc-slider:focus::-moz-range-thumb {
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);
}

/* Responsive */
@media (max-width: 480px) {
    .acc-slider-btn {
        width: 28px;
        height: 28px;
        min-width: 28px;
        font-size: 16px;
    }
    
    .acc-slider-container {
        gap: 6px;
    }
}

/* ============================================
   RÈGLE DE LECTURE - Z-INDEX RÉDUIT 
   Pour passer SOUS le widget d'accessibilité
   ============================================ */
.acc-reading-ruler {
    position: fixed;
    left: 0;
    width: 100%;
    height: 40px;
    background: rgba(255, 255, 0, 0.3);
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    pointer-events: none;
    z-index: 1000; /* ⬅️ MODIFIÉ : Réduit de 9999 à 1000 pour passer sous le widget */
    transition: top 0.1s ease-out;
}

/* Mode focus */
body.acc-focus-mode header,
body.acc-focus-mode footer,
body.acc-focus-mode aside,
body.acc-focus-mode nav,
body.acc-focus-mode .sidebar,
body.acc-focus-mode .widget {
    display: none !important;
}

body.acc-focus-mode {
    background: #f5f5f5 !important;
}

body.acc-focus-mode main,
body.acc-focus-mode article,
body.acc-focus-mode .content {
    max-width: 800px !important;
    margin: 0 auto !important;
    padding: 40px 20px !important;
}

/* Division des syllabes */
.acc-syllabified {
    word-spacing: 0.05em;
    letter-spacing: 0.02em;
}
</style>