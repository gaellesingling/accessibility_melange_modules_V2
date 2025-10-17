<?php
/**
 * Plugin Name:       Curseur Personnalisé
 * Description:       Permet de changer la couleur et la taille du curseur via un panneau de contrôle.
 * Version:           2.5
 */
if (!defined('ABSPATH')) exit;

define('CUSTOM_CURSOR_ASSETS_URL', plugin_dir_url(__FILE__) . 'assets/');

class CustomCursorPluginV25 {
    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_footer', [$this, 'add_control_panel']);
    }

    public function enqueue_assets() {
        wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css');
        wp_enqueue_style('custom-cursor-css', CUSTOM_CURSOR_ASSETS_URL . 'custom-cursor.css', [], '2.5');
        wp_enqueue_script('custom-cursor-js', CUSTOM_CURSOR_ASSETS_URL . 'custom-cursor.js', ['jquery'], '2.5', true);
    }

    public function add_control_panel() { ?>
        <div id="cc-panel">
            <div id="cc-handle" title="Personnaliser le curseur">
                <i class="fa-solid fa-hand-pointer"></i>
            </div>
            <div id="cc-content">
                <h4>Apparence du curseur</h4>
                <div class="cc-switch-container">
                    <label class="cc-switch">
                        <input type="checkbox" id="cc-toggle-switch">
                        <span class="cc-slider">
                            <span class="cc-label-off">Blanc</span>
                            <span class="cc-label-on">Noir</span>
                        </span>
                    </label>
                </div>
                
                <p class="cc-setting-label">Taille : <span id="cc-size-value">x1.0</span></p>
                <input type="range" id="cc-size-slider" min="1" max="2" value="1" step="0.1">

                <div id="cc-buttons">
                    <button id="cc-reset">Réinitialiser</button>
                </div>
            </div>
        </div>
        <style id="cc-dynamic-styles"></style>
    <?php }
}

new CustomCursorPluginV25();
