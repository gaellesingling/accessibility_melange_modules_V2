<?php
/**
 * Template du module Luminosité
 * Interface utilisateur pour les modes d'affichage et filtres visuels
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="acc-module acc-module-brightness" id="acc-module-brightness" data-module="brightness">
    <div class="acc-module-header">
        <h3 class="acc-module-title">
            <span class="acc-module-icon" aria-hidden="true">💡</span>
            <?php esc_html_e('Luminosité', 'accessibility-modular'); ?>
        </h3>
        <label class="acc-module-toggle">
            <input 
                type="checkbox" 
                id="acc-brightness-toggle"
                aria-label="<?php esc_attr_e('Activer/désactiver le module luminosité', 'accessibility-modular'); ?>"
            />
            <span class="acc-module-toggle-slider"></span>
        </label>
    </div>

    <div class="acc-module-content" id="acc-brightness-content" style="display: none;">
        <!-- Modes d'affichage -->
        <div class="acc-control-group">
            <label class="acc-control-label">
                <?php esc_html_e('Mode d\'affichage', 'accessibility-modular'); ?>
            </label>
            <div 
                class="acc-brightness-modes" 
                role="radiogroup" 
                aria-label="<?php esc_attr_e('Sélectionner un mode d\'affichage', 'accessibility-modular'); ?>"
            >
                <button 
                    type="button" 
                    class="acc-brightness-mode active" 
                    data-mode="normal"
                    role="radio"
                    aria-checked="true"
                    aria-label="<?php esc_attr_e('Mode normal', 'accessibility-modular'); ?>"
                >
                    <span class="acc-mode-icon">☀️</span>
                    <span class="acc-mode-label"><?php esc_html_e('Normal', 'accessibility-modular'); ?></span>
                </button>

                <button 
                    type="button" 
                    class="acc-brightness-mode" 
                    data-mode="night"
                    role="radio"
                    aria-checked="false"
                    aria-label="<?php esc_attr_e('Mode nuit', 'accessibility-modular'); ?>"
                >
                    <span class="acc-mode-icon">🌙</span>
                    <span class="acc-mode-label"><?php esc_html_e('Nuit', 'accessibility-modular'); ?></span>
                </button>

                <button 
                    type="button" 
                    class="acc-brightness-mode" 
                    data-mode="blue_light"
                    role="radio"
                    aria-checked="false"
                    aria-label="<?php esc_attr_e('Mode anti lumière bleue', 'accessibility-modular'); ?>"
                >
                    <span class="acc-mode-icon">🔶</span>
                    <span class="acc-mode-label"><?php esc_html_e('Lumière bleue', 'accessibility-modular'); ?></span>
                </button>

                <button 
                    type="button" 
                    class="acc-brightness-mode" 
                    data-mode="high_contrast"
                    role="radio"
                    aria-checked="false"
                    aria-label="<?php esc_attr_e('Mode contraste élevé', 'accessibility-modular'); ?>"
                >
                    <span class="acc-mode-icon">⚫</span>
                    <span class="acc-mode-label"><?php esc_html_e('Contraste +', 'accessibility-modular'); ?></span>
                </button>

                <button 
                    type="button" 
                    class="acc-brightness-mode" 
                    data-mode="low_contrast"
                    role="radio"
                    aria-checked="false"
                    aria-label="<?php esc_attr_e('Mode contraste faible', 'accessibility-modular'); ?>"
                >
                    <span class="acc-mode-icon">⚪</span>
                    <span class="acc-mode-label"><?php esc_html_e('Contraste -', 'accessibility-modular'); ?></span>
                </button>

                <button 
                    type="button" 
                    class="acc-brightness-mode" 
                    data-mode="grayscale"
                    role="radio"
                    aria-checked="false"
                    aria-label="<?php esc_attr_e('Mode niveaux de gris', 'accessibility-modular'); ?>"
                >
                    <span class="acc-mode-icon">⚫</span>
                    <span class="acc-mode-label"><?php esc_html_e('N. de gris', 'accessibility-modular'); ?></span>
                </button>
            </div>
        </div>

        <!-- Séparateur -->
        <hr style="border: none; border-top: 1px solid var(--acc-border); margin: 20px 0;">

        <!-- Réglages avancés -->
        <details id="acc-brightness-advanced">
            <summary class="acc-control-label" style="cursor: pointer; user-select: none;">
                <?php esc_html_e('Réglages avancés', 'accessibility-modular'); ?>
            </summary>

            <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 16px;">
                <!-- Contraste -->
                <div class="acc-control-group">
                    <label for="acc-brightness-contrast" class="acc-control-label">
                        <?php esc_html_e('Contraste', 'accessibility-modular'); ?>
                        <span class="acc-control-value" id="acc-brightness-contrast-value">100%</span>
                    </label>
                    <div class="acc-slider-container">
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-decrease" 
                            data-target="acc-brightness-contrast"
                            aria-label="<?php esc_attr_e('Diminuer le contraste', 'accessibility-modular'); ?>"
                        >
                            −
                        </button>
                        <input 
                            type="range" 
                            id="acc-brightness-contrast" 
                            class="acc-slider"
                            min="50" 
                            max="200" 
                            step="10" 
                            value="100"
                            aria-label="<?php esc_attr_e('Ajuster le contraste', 'accessibility-modular'); ?>"
                            aria-valuemin="50"
                            aria-valuemax="200"
                            aria-valuenow="100"
                            aria-valuetext="100 pourcent"
                        />
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-increase" 
                            data-target="acc-brightness-contrast"
                            aria-label="<?php esc_attr_e('Augmenter le contraste', 'accessibility-modular'); ?>"
                        >
                            +
                        </button>
                    </div>
                </div>

                <!-- Luminosité -->
                <div class="acc-control-group">
                    <label for="acc-brightness-brightness" class="acc-control-label">
                        <?php esc_html_e('Luminosité', 'accessibility-modular'); ?>
                        <span class="acc-control-value" id="acc-brightness-brightness-value">100%</span>
                    </label>
                    <div class="acc-slider-container">
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-decrease" 
                            data-target="acc-brightness-brightness"
                            aria-label="<?php esc_attr_e('Diminuer la luminosité', 'accessibility-modular'); ?>"
                        >
                            −
                        </button>
                        <input 
                            type="range" 
                            id="acc-brightness-brightness" 
                            class="acc-slider"
                            min="50" 
                            max="150" 
                            step="5" 
                            value="100"
                            aria-label="<?php esc_attr_e('Ajuster la luminosité', 'accessibility-modular'); ?>"
                            aria-valuemin="50"
                            aria-valuemax="150"
                            aria-valuenow="100"
                            aria-valuetext="100 pourcent"
                        />
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-increase" 
                            data-target="acc-brightness-brightness"
                            aria-label="<?php esc_attr_e('Augmenter la luminosité', 'accessibility-modular'); ?>"
                        >
                            +
                        </button>
                    </div>
                </div>

                <!-- Saturation -->
                <div class="acc-control-group">
                    <label for="acc-brightness-saturation" class="acc-control-label">
                        <?php esc_html_e('Saturation', 'accessibility-modular'); ?>
                        <span class="acc-control-value" id="acc-brightness-saturation-value">100%</span>
                    </label>
                    <div class="acc-slider-container">
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-decrease" 
                            data-target="acc-brightness-saturation"
                            aria-label="<?php esc_attr_e('Diminuer la saturation', 'accessibility-modular'); ?>"
                        >
                            −
                        </button>
                        <input 
                            type="range" 
                            id="acc-brightness-saturation" 
                            class="acc-slider"
                            min="0" 
                            max="200" 
                            step="10" 
                            value="100"
                            aria-label="<?php esc_attr_e('Ajuster la saturation des couleurs', 'accessibility-modular'); ?>"
                            aria-valuemin="0"
                            aria-valuemax="200"
                            aria-valuenow="100"
                            aria-valuetext="100 pourcent"
                        />
                        <button 
                            type="button" 
                            class="acc-slider-btn acc-slider-increase" 
                            data-target="acc-brightness-saturation"
                            aria-label="<?php esc_attr_e('Augmenter la saturation', 'accessibility-modular'); ?>"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>
        </details>

        <!-- Bouton de réinitialisation -->
        <div class="acc-control-group" style="margin-top: 20px;">
            <div class="acc-button-group">
                <button 
                    type="button" 
                    id="acc-brightness-reset" 
                    class="acc-button"
                    aria-label="<?php esc_attr_e('Réinitialiser les paramètres de luminosité', 'accessibility-modular'); ?>"
                >
                    <?php esc_html_e('Réinitialiser', 'accessibility-modular'); ?>
                </button>
            </div>
        </div>
    </div>
</div>