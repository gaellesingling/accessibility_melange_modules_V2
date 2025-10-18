<?php
/**
 * Module Luminosité
 * Gestion des modes d'affichage et filtres visuels
 * 
 * @package AccessibilityModular
 * @subpackage Modules
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe du module Luminosité
 */
class ACC_Module_Brightness {
    
    /**
     * Version du module
     */
    const VERSION = '1.0.0';
    
    /**
     * Nom du module
     */
    const MODULE_NAME = 'brightness';
    
    /**
     * Modes disponibles
     */
    const MODES = [
        'normal',
        'night',
        'blue_light',
        'high_contrast',
        'low_contrast',
        'grayscale'
    ];
    
    /**
     * Constructeur
     */
    public function __construct() {
        $this->init_hooks();
    }
    
    /**
     * Initialise les hooks
     */
    private function init_hooks() {
        // Ajoute une classe au body si mode spécial actif
        add_filter('body_class', [$this, 'add_body_class']);
        
        // Filtre pour ajouter des métadonnées
        add_filter('acc_module_metadata', [$this, 'add_metadata'], 10, 2);
    }
    
    /**
     * Ajoute une classe au body selon le mode
     * 
     * @param array $classes Classes existantes
     * @return array
     */
    public function add_body_class($classes) {
        if (isset($_COOKIE['acc_brightness_mode'])) {
            $mode = json_decode(stripslashes($_COOKIE['acc_brightness_mode']), true);
            
            if (in_array($mode, self::MODES) && $mode !== 'normal') {
                $classes[] = 'acc-mode-' . str_replace('_', '-', $mode);
            }
        }
        
        return $classes;
    }
    
    /**
     * Ajoute des métadonnées au module
     * 
     * @param array $metadata Métadonnées existantes
     * @param string $module_name Nom du module
     * @return array
     */
    public function add_metadata($metadata, $module_name) {
        if ($module_name !== self::MODULE_NAME) {
            return $metadata;
        }
        
        $metadata['modes_available'] = $this->get_available_modes();
        $metadata['rgaa_compliance'] = [
            'criteria' => ['3.2', '3.3', '10.11'],
            'level' => 'AAA'
        ];
        $metadata['wcag_contrast'] = [
            'normal' => 'AA',
            'high_contrast' => 'AAA'
        ];
        
        return $metadata;
    }
    
    /**
     * Retourne la liste des modes disponibles
     * 
     * @return array
     */
    private function get_available_modes() {
        return [
            'normal' => [
                'label' => __('Normal', 'accessibility-modular'),
                'description' => __('Affichage par défaut', 'accessibility-modular')
            ],
            'night' => [
                'label' => __('Mode nuit', 'accessibility-modular'),
                'description' => __('Fond sombre, texte clair', 'accessibility-modular')
            ],
            'blue_light' => [
                'label' => __('Lumière bleue', 'accessibility-modular'),
                'description' => __('Filtre chaud anti-lumière bleue', 'accessibility-modular')
            ],
            'high_contrast' => [
                'label' => __('Contraste élevé', 'accessibility-modular'),
                'description' => __('Contraste maximum (AAA)', 'accessibility-modular')
            ],
            'low_contrast' => [
                'label' => __('Contraste faible', 'accessibility-modular'),
                'description' => __('Contraste réduit', 'accessibility-modular')
            ],
            'grayscale' => [
                'label' => __('Niveaux de gris', 'accessibility-modular'),
                'description' => __('Suppression des couleurs', 'accessibility-modular')
            ]
        ];
    }
    
    /**
     * Retourne les paramètres par défaut
     * 
     * @return array
     */
    public static function get_default_settings() {
        return [
            'mode' => 'normal',
            'contrast' => 100,
            'brightness' => 100,
            'saturation' => 100
        ];
    }
    
    /**
     * Valide les paramètres
     * 
     * @param array $settings Paramètres à valider
     * @return array|WP_Error
     */
    public static function validate_settings($settings) {
        $defaults = self::get_default_settings();
        $validated = [];
        
        // Validation du mode
        if (isset($settings['mode'])) {
            if (in_array($settings['mode'], self::MODES)) {
                $validated['mode'] = $settings['mode'];
            }
        }
        
        // Validation du contraste
        if (isset($settings['contrast'])) {
            $contrast = intval($settings['contrast']);
            if ($contrast >= 50 && $contrast <= 200) {
                $validated['contrast'] = $contrast;
            }
        }
        
        // Validation de la luminosité
        if (isset($settings['brightness'])) {
            $brightness = intval($settings['brightness']);
            if ($brightness >= 50 && $brightness <= 150) {
                $validated['brightness'] = $brightness;
            }
        }
        
        // Validation de la saturation
        if (isset($settings['saturation'])) {
            $saturation = intval($settings['saturation']);
            if ($saturation >= 0 && $saturation <= 200) {
                $validated['saturation'] = $saturation;
            }
        }
        
        // Fusionne avec les valeurs par défaut
        return array_merge($defaults, $validated);
    }
    
    /**
     * Calcule le ratio de contraste entre deux couleurs
     * 
     * @param string $color1 Couleur hex
     * @param string $color2 Couleur hex
     * @return float
     */
    public static function calculate_contrast_ratio($color1, $color2) {
        $l1 = self::get_relative_luminance($color1);
        $l2 = self::get_relative_luminance($color2);
        
        $lighter = max($l1, $l2);
        $darker = min($l1, $l2);
        
        return ($lighter + 0.05) / ($darker + 0.05);
    }
    
    /**
     * Calcule la luminance relative d'une couleur
     * 
     * @param string $hex Couleur hex
     * @return float
     */
    private static function get_relative_luminance($hex) {
        $hex = ltrim($hex, '#');
        
        $r = hexdec(substr($hex, 0, 2)) / 255;
        $g = hexdec(substr($hex, 2, 2)) / 255;
        $b = hexdec(substr($hex, 4, 2)) / 255;
        
        $r = ($r <= 0.03928) ? $r / 12.92 : pow(($r + 0.055) / 1.055, 2.4);
        $g = ($g <= 0.03928) ? $g / 12.92 : pow(($g + 0.055) / 1.055, 2.4);
        $b = ($b <= 0.03928) ? $b / 12.92 : pow(($b + 0.055) / 1.055, 2.4);
        
        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    }
    
    /**
     * Vérifie si un contraste est conforme WCAG
     * 
     * @param float $ratio Ratio de contraste
     * @param string $level Niveau (AA ou AAA)
     * @param string $size Taille (normal ou large)
     * @return bool
     */
    public static function is_wcag_compliant($ratio, $level = 'AA', $size = 'normal') {
        if ($level === 'AAA') {
            return $size === 'large' ? $ratio >= 4.5 : $ratio >= 7;
        }
        
        return $size === 'large' ? $ratio >= 3 : $ratio >= 4.5;
    }
    
    /**
     * Nettoie les cookies du module
     */
    public static function clear_cookies() {
        $cookies = [
            'acc_brightness_mode',
            'acc_brightness_contrast',
            'acc_brightness_brightness',
            'acc_brightness_saturation'
        ];
        
        foreach ($cookies as $cookie) {
            if (isset($_COOKIE[$cookie])) {
                setcookie($cookie, '', time() - 3600, '/');
            }
        }
    }
}

// Initialise le module
new ACC_Module_Brightness();
wp_enqueue_script('acc-brightness', plugins_url('assets/script.js', __FILE__));
wp_enqueue_style('acc-brightness', plugins_url('assets/style.css', __FILE__));