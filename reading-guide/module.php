<?php
/**
 * Module: Guide de Lecture
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe du module Guide de Lecture
 */
class ACC_Reading_Guide_Module {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Le module est enregistré, pas besoin de hooks ici
        // Les assets sont chargés par le plugin principal
    }
    
    /**
     * Retourne les informations du module
     */
    public static function get_info() {
        return [
            'name' => 'reading-guide',
            'title' => 'Guide de Lecture',
            'description' => 'Outils d\'aide à la lecture : règle, syllabes, sommaire et mode focus',
            'version' => '1.0.0',
            'icon' => '📖',
            'category' => 'lecture',
            'enabled' => true
        ];
    }
    
    /**
     * Rendu du template
     */
    public static function render() {
        include dirname(__FILE__) . '/template.php';
    }
}

// Initialiser le module
ACC_Reading_Guide_Module::get_instance();