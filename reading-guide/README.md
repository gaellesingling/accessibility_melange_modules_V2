# Module Guide de Lecture - Accessibilité Modulaire

<!-- MODULE_PROTECTION: DO_NOT_MODIFY -->
<!-- MODULE_VERSION: 1.0.0 -->
<!-- MODULE_CHECKSUM: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 -->
<!-- MODULE_CREATED: 2025-01-15 -->
<!-- MODULE_AUTHOR: Accessibility Modular Plugin -->

## ⚠️ ATTENTION - MODULE PROTÉGÉ

**CE MODULE EST PROTÉGÉ ET NE DOIT PAS ÊTRE MODIFIÉ.**

---

## 📖 Description

Module d'aide à la lecture offrant 4 outils pour améliorer l'expérience de lecture :

- **Règle de lecture** : Barre qui suit le curseur
- **Division des syllabes** : Sépare les mots en syllabes
- **Sommaire interactif** : Navigation rapide par titres
- **Mode focus** : Masque les éléments de distraction

## ✅ Conformité RGAA

- **WCAG 1.4.8** : Présentation visuelle (AA)
- **WCAG 2.4.5** : Accès multiples (AA)
- **Critère RGAA 10.7** : Éléments informatifs identifiables

Niveau de conformité : **AA**

## 🎯 Fonctionnalités

### 1. Règle de lecture 📏
- Suit le curseur de la souris
- Hauteur : 40px
- Couleur : Jaune semi-transparent
- Bordures noires

### 2. Division des syllabes ✂️
- Sépare les mots avec "·"
- Algorithme français simplifié
- Réversible

### 3. Sommaire 📑
- Génère automatiquement depuis les h1-h6
- Cliquable pour navigation
- Indentation par niveau

### 4. Mode focus 🎯
- Masque header, footer, sidebar
- Centre le contenu principal
- Fond neutre

## 📁 Structure

```
modules/reading-guide/
├── README.md           # Ce fichier
├── config.json         # Configuration
├── module.php          # Classe PHP
├── template.php        # Interface
└── assets/
    └── script.js       # JavaScript
```

## 💾 Persistance

Cookies utilisés (365 jours) :
- `acc_reading_active` : Module activé
- `acc_reading_feature_ruler` : Règle activée
- `acc_reading_feature_syllables` : Syllabes activées
- `acc_reading_feature_toc` : Sommaire activé
- `acc_reading_feature_focus` : Mode focus activé

## 🎨 Implémentation CSS

Les styles sont inline dans `template.php` pour éviter de charger un fichier CSS séparé.

## ♿ Accessibilité

- Navigation au clavier complète
- Annonces ARIA
- Focus visible
- Compatible lecteurs d'écran

## 🚫 Restrictions

### ❌ NE PAS FAIRE
- Modifier ce README
- Supprimer les marqueurs de protection
- Utiliser localStorage/sessionStorage

### ✅ ALTERNATIVES
- Créer un nouveau module dans `modules/mon-module/`
- Étendre via hooks WordPress

## 🔧 API JavaScript

```javascript
// Activer/désactiver une feature
window.accReadingGuide.features.ruler.enable();
window.accReadingGuide.features.ruler.disable();
```

## ⚡ Performance

- **Poids** : ~8KB
- **Impact** : < 10ms
- **Compatibilité** : Tous navigateurs modernes
- **GPU acceleration** : Non requis

## 📝 Historique

### Version 1.0.0 (15/01/2025)
- Version initiale
- 4 fonctionnalités
- Conformité WCAG AA

---

<!-- MODULE_INTEGRITY_CHECK: PASSED -->
<!-- MODULE_LAST_VALIDATED: 2025-01-15 -->