<?php
/**
 * Plugin Name:       Boutons Accessibles
 * Description:       Permet aux utilisateurs de changer la taille et la couleur des boutons cliquables.
 * Version:           1.14
 */
if (!defined('ABSPATH')) exit;

define('CLICKABLE_BUTTONS_ASSETS_URL', plugin_dir_url(__FILE__) . 'assets/');

class ClickableButtonsPluginV14 {
    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_footer', [$this, 'add_control_panel']);
    }

    public function enqueue_assets() {
        wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css');
        wp_enqueue_style('clickable-buttons-css', CLICKABLE_BUTTONS_ASSETS_URL . 'clickable-buttons.css', [], '14.0');
        wp_enqueue_script('clickable-buttons-js', CLICKABLE_BUTTONS_ASSETS_URL . 'clickable-buttons.js', ['jquery'], '14.0', true);
    }

    public function add_control_panel() { ?>
        <div id="cb-panel">
            <div id="cb-handle"><i class="fas fa-toggle-on"></i></div>
            <div id="cb-content">
                <h4>Accessibilité des boutons</h4>
                <p>Taille : <span id="cb-size-value">x1.0</span></p>
                <input type="range" id="cb-size-slider" min="1" max="1.5" value="1" step="0.05">
                
                <p>Couleurs :</p>
                <div id="cb-theme-carousel">
                    <button id="cb-theme-prev" class="cb-arrow-btn"><i class="fas fa-chevron-left"></i></button>
                    <span id="cb-theme-name">Défaut</span>
                    <button id="cb-theme-next" class="cb-arrow-btn"><i class="fas fa-chevron-right"></i></button>
                </div>

                <div id="cb-buttons">
                    <button id="cb-reset">Réinitialiser</button>
                </div>
            </div>
        </div>
        <style id="cb-dynamic-styles"></style>
    <?php }
}
new ClickableButtonsPluginV14();
