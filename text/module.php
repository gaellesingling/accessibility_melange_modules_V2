<?php
/**
 * Module Texte
 * Personnalisation de la typographie
 * * @package AccessibilityModular
 * @subpackage Modules
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe du module Texte
 */
class ACC_Module_Text {
    
    /**
     * Version du module
     */
    const VERSION = '1.0.0';
    
    /**
     * Nom du module
     */
    const MODULE_NAME = 'text';
    
    /**
     * Constructeur
     */
    public function __construct() {
        // Le module est principalement géré en JS, la classe PHP sert de structure.
    }
    
    /**
     * Retourne les paramètres par défaut
     * * @return array
     */
    public static function get_default_settings() {
        return [
            'font_size' => 16,
            'paragraph_spacing' => 1,
            'line_height' => 150,
            'word_spacing' => 0,
            'letter_spacing' => 0
        ];
    }
    
    /**
     * Valide les paramètres
     * * @param array $settings Paramètres à valider
     * @return array|WP_Error
     */
    public static function validate_settings($settings) {
        $defaults = self::get_default_settings();
        $validated = [];
        
        // Validation de la taille
        if (isset($settings['font_size'])) {
            $size = intval($settings['font_size']);
            if ($size >= 12 && $size <= 24) {
                $validated['font_size'] = $size;
            }
        }
        
        // Validation de l'espacement des paragraphes
        if (isset($settings['paragraph_spacing'])) {
            $spacing = floatval($settings['paragraph_spacing']);
            if ($spacing >= 0 && $spacing <= 2) {
                $validated['paragraph_spacing'] = $spacing;
            }
        }
        
        // Validation de l'interligne
        if (isset($settings['line_height'])) {
            $height = intval($settings['line_height']);
            if ($height >= 100 && $height <= 250) {
                $validated['line_height'] = $height;
            }
        }
        
        // Validation de l'espacement des mots
        if (isset($settings['word_spacing'])) {
            $spacing = intval($settings['word_spacing']);
            if ($spacing >= 0 && $spacing <= 10) {
                $validated['word_spacing'] = $spacing;
            }
        }
        
        // Validation de l'espacement des lettres
        if (isset($settings['letter_spacing'])) {
            $spacing = floatval($settings['letter_spacing']);
            if ($spacing >= 0 && $spacing <= 5) {
                $validated['letter_spacing'] = $spacing;
            }
        }
        
        // Fusionne avec les valeurs par défaut
        return array_merge($defaults, $validated);
    }
    
    /**
     * Nettoie les cookies du module
     */
    public static function clear_cookies() {
        $cookies = [
            'acc_text_size',
            'acc_text_paragraph_spacing',
            'acc_text_line_height',
            'acc_text_word_spacing',
            'acc_text_letter_spacing'
        ];
        
        foreach ($cookies as $cookie) {
            if (isset($_COOKIE[$cookie])) {
                setcookie($cookie, '', time() - 3600, '/');
            }
        }
    }
}

// Initialise le module
new ACC_Module_Text();