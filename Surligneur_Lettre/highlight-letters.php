<?php
/**
 * Plugin Name:       Surligneur de lettres
 * Description:       Permet aux utilisateurs de surligner des lettres, avec une option pour inclure les variantes accentuées.
 * Version:           1.8
 * Author:            UBS
 */
if (!defined('ABSPATH')) exit;
define('HIGHLIGHT_LETTERS_URL', plugin_dir_url(__FILE__));
class HighlightLettersPluginV8 {
    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_footer', [$this, 'add_control_panel']);
    }
    public function enqueue_assets() {
        wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css', [], '6.5.2');
        wp_enqueue_style('highlight-letters-css', HIGHLIGHT_LETTERS_URL . 'assets/highlight-letters.css', [], '8.0');
        wp_enqueue_script('highlight-letters-js', HIGHLIGHT_LETTERS_URL . 'assets/highlight-letters.js', ['jquery'], '8.0', true);
    }
    public function add_control_panel() { ?>
        <div id="hl-panel"><div id="hl-handle"><i class="fas fa-highlighter"></i></div><div id="hl-content"><h4>Surligner des lettres</h4><p>Tapez les lettres à surligner (ex: bdpq).</p><input type="text" id="hl-letters-input" placeholder="Lettres..." maxlength="15"><p>Choisissez une couleur :</p><input type="color" id="hl-color-input" value="#a5d6a7"><div class="hl-option-toggle"><label for="hl-variants-toggle">Inclure les accents (à, é...)</label><label class="hl-switch"><input type="checkbox" id="hl-variants-toggle" checked><span class="hl-slider"></span></label></div><div id="hl-buttons"><button id="hl-apply">Appliquer</button><button id="hl-clear">Effacer</button></div></div></div>
    <?php }
}
new HighlightLettersPluginV8();