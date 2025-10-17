<?php
/**
 * Template du module Texte
 * Interface utilisateur pour la personnalisation de la typographie
 * Avec boutons +/- et toggle iOS
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="acc-module acc-module-text" id="acc-module-text" data-module="text">
    <div class="acc-module-header">
        <h3 class="acc-module-title">
            <span class="acc-module-icon" aria-hidden="true">📝</span>
            <?php esc_html_e('Texte', 'accessibility-modular'); ?>
        </h3>
        <label class="acc-module-toggle">
            <input 
                type="checkbox" 
                id="acc-text-toggle"
                aria-label="<?php esc_attr_e('Activer/désactiver le module texte', 'accessibility-modular'); ?>"
            />
            <span class="acc-module-toggle-slider"></span>
        </label>
    </div>

    <div class="acc-module-content" id="acc-text-content" style="display: none;">
        <div class="acc-control-group">
            <label for="acc-text-size" class="acc-control-label">
                <?php esc_html_e('Taille du texte', 'accessibility-modular'); ?>
                <span class="acc-control-value" id="acc-text-size-value">16px</span>
            </label>
            <div class="acc-slider-container">
                <button type="button" class="acc-slider-btn acc-slider-minus" data-target="acc-text-size" aria-label="<?php esc_attr_e('Diminuer la taille', 'accessibility-modular'); ?>">−</button>
                <input 
                    type="range" 
                    id="acc-text-size" 
                    class="acc-slider"
                    min="12" 
                    max="24" 
                    step="1" 
                    value="16"
                    aria-label="<?php esc_attr_e('Ajuster la taille du texte', 'accessibility-modular'); ?>"
                />
                <button type="button" class="acc-slider-btn acc-slider-plus" data-target="acc-text-size" aria-label="<?php esc_attr_e('Augmenter la taille', 'accessibility-modular'); ?>">+</button>
            </div>
        </div>

        <div class="acc-control-group">
            <label for="acc-text-paragraph-spacing" class="acc-control-label">
                <?php esc_html_e('Espacement des paragraphes', 'accessibility-modular'); ?>
                <span class="acc-control-value" id="acc-text-paragraph-spacing-value">1em</span>
            </label>
            <div class="acc-slider-container">
                <button type="button" class="acc-slider-btn acc-slider-minus" data-target="acc-text-paragraph-spacing" aria-label="<?php esc_attr_e('Diminuer l\'espacement', 'accessibility-modular'); ?>">−</button>
                <input 
                    type="range" 
                    id="acc-text-paragraph-spacing" 
                    class="acc-slider"
                    min="0" 
                    max="2" 
                    step="0.1" 
                    value="1"
                    aria-label="<?php esc_attr_e('Ajuster l\'espacement des paragraphes', 'accessibility-modular'); ?>"
                />
                <button type="button" class="acc-slider-btn acc-slider-plus" data-target="acc-text-paragraph-spacing" aria-label="<?php esc_attr_e('Augmenter l\'espacement', 'accessibility-modular'); ?>">+</button>
            </div>
        </div>

        <div class="acc-control-group">
            <label for="acc-text-line-height" class="acc-control-label">
                <?php esc_html_e('Interligne', 'accessibility-modular'); ?>
                <span class="acc-control-value" id="acc-text-line-height-value">150%</span>
            </label>
            <div class="acc-slider-container">
                <button type="button" class="acc-slider-btn acc-slider-minus" data-target="acc-text-line-height" aria-label="<?php esc_attr_e('Diminuer l\'interligne', 'accessibility-modular'); ?>">−</button>
                <input 
                    type="range" 
                    id="acc-text-line-height" 
                    class="acc-slider"
                    min="100" 
                    max="250" 
                    step="10" 
                    value="150"
                    aria-label="<?php esc_attr_e('Ajuster l\'interligne', 'accessibility-modular'); ?>"
                />
                <button type="button" class="acc-slider-btn acc-slider-plus" data-target="acc-text-line-height" aria-label="<?php esc_attr_e('Augmenter l\'interligne', 'accessibility-modular'); ?>">+</button>
            </div>
        </div>

        <div class="acc-control-group">
            <label for="acc-text-word-spacing" class="acc-control-label">
                <?php esc_html_e('Espacement des mots', 'accessibility-modular'); ?>
                <span class="acc-control-value" id="acc-text-word-spacing-value">0px</span>
            </label>
            <div class="acc-slider-container">
                <button type="button" class="acc-slider-btn acc-slider-minus" data-target="acc-text-word-spacing" aria-label="<?php esc_attr_e('Diminuer l\'espacement', 'accessibility-modular'); ?>">−</button>
                <input 
                    type="range" 
                    id="acc-text-word-spacing" 
                    class="acc-slider"
                    min="0" 
                    max="10" 
                    step="1" 
                    value="0"
                    aria-label="<?php esc_attr_e('Ajuster l\'espacement des mots', 'accessibility-modular'); ?>"
                />
                <button type="button" class="acc-slider-btn acc-slider-plus" data-target="acc-text-word-spacing" aria-label="<?php esc_attr_e('Augmenter l\'espacement', 'accessibility-modular'); ?>">+</button>
            </div>
        </div>

        <div class="acc-control-group">
            <label for="acc-text-letter-spacing" class="acc-control-label">
                <?php esc_html_e('Espacement des lettres', 'accessibility-modular'); ?>
                <span class="acc-control-value" id="acc-text-letter-spacing-value">0px</span>
            </label>
            <div class="acc-slider-container">
                <button type="button" class="acc-slider-btn acc-slider-minus" data-target="acc-text-letter-spacing" aria-label="<?php esc_attr_e('Diminuer l\'espacement', 'accessibility-modular'); ?>">−</button>
                <input 
                    type="range" 
                    id="acc-text-letter-spacing" 
                    class="acc-slider"
                    min="0" 
                    max="5" 
                    step="0.5" 
                    value="0"
                    aria-label="<?php esc_attr_e('Ajuster l\'espacement des lettres', 'accessibility-modular'); ?>"
                />
                <button type="button" class="acc-slider-btn acc-slider-plus" data-target="acc-text-letter-spacing" aria-label="<?php esc_attr_e('Augmenter l\'espacement', 'accessibility-modular'); ?>">+</button>
            </div>
        </div>
        
        <div class="acc-control-group" style="margin-top: 20px;">
            <div class="acc-button-group">
                <button 
                    type="button" 
                    id="acc-text-reset" 
                    class="acc-button"
                    aria-label="<?php esc_attr_e('Réinitialiser les paramètres du texte', 'accessibility-modular'); ?>"
                >
                    <?php esc_html_e('Réinitialiser', 'accessibility-modular'); ?>
                </button>
            </div>
        </div>
    </div>
</div>

<style>
/* ... (styles inchangés) ... */
.acc-slider-container { display: flex; align-items: center; gap: 10px; }
.acc-slider-btn { width: 32px; height: 32px; min-width: 32px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 18px; font-weight: bold; color: #495057; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink: 0; }
.acc-slider-btn:hover { background: #e9ecef; border-color: #adb5bd; color: #212529; }
.acc-slider-btn:active { background: #dee2e6; transform: scale(0.95); }
.acc-slider-btn:focus { outline: 2px solid #2196f3; outline-offset: 2px; }
.acc-slider-container .acc-slider { flex: 1; margin: 0; }
</style>