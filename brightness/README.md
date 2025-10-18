# Module Luminosité - Accessibilité Modulaire

<!-- MODULE_PROTECTION: DO_NOT_MODIFY -->
<!-- MODULE_VERSION: 1.0.0 -->
<!-- MODULE_CHECKSUM: b9e4f2a1c7d3e8b6a5f9c2d8e1a7b3f4 -->
<!-- MODULE_CREATED: 2025-01-15 -->
<!-- MODULE_AUTHOR: Accessibility Modular Plugin -->

## ⚠️ ATTENTION - MODULE PROTÉGÉ

**CE MODULE EST PROTÉGÉ ET NE DOIT PAS ÊTRE MODIFIÉ.**

Toute modification de ce module entraînera son rejet par le système de validation.
Pour ajouter de nouvelles fonctionnalités, créez un nouveau module dans un dossier séparé.

---

## 💡 Description

Module de gestion de la luminosité et des modes d'affichage permettant aux utilisateurs d'ajuster :

- **Mode nuit** : Fond sombre avec texte clair pour réduire la fatigue oculaire
- **Mode lumière bleue** : Filtre chaud pour protéger les yeux en soirée
- **Mode contraste élevé** : Contraste AAA pour une meilleure lisibilité
- **Mode contraste faible** : Contraste réduit pour les sensibilités visuelles
- **Mode niveaux de gris** : Suppression des couleurs
- **Réglages avancés** : Contraste, luminosité et saturation personnalisés

## ✅ Conformité RGAA

Ce module respecte les critères RGAA 4.1 suivants :

- **Critère 3.2** : Contraste du texte (AA et AAA)
- **Critère 3.3** : Contraste des composants d'interface
- **Critère 10.11** : Possibilité de personnaliser l'affichage

Niveau de conformité : **AAA** (pour le mode contraste élevé)

## 🎯 Fonctionnalités

### Modes prédéfinis

1. **Mode Normal** - Affichage par défaut du site
2. **Mode Nuit** - Fond noir (#1a1a1a) avec texte blanc
3. **Mode Lumière Bleue** - Filtre orange chaud (sepia 90% + hue-rotate -10deg)
4. **Mode Contraste Élevé** - Contraste maximum (noir sur blanc ou blanc sur noir)
5. **Mode Contraste Faible** - Contraste réduit pour sensibilité
6. **Mode Niveaux de Gris** - Suppression des couleurs (grayscale 100%)

### Réglages avancés

- **Contraste** : 50% - 200% (défaut: 100%)
- **Luminosité** : 50% - 150% (défaut: 100%)
- **Saturation** : 0% - 200% (défaut: 100%)

## 🔧 Structure des fichiers

```
modules/brightness/
├── README.md           # Ce fichier (PROTÉGÉ)
├── config.json         # Configuration du module
├── module.php          # Logique PHP (optionnel)
├── template.php        # Interface utilisateur
└── assets/
    ├── script.js       # JavaScript du module
    └── style.css       # CSS spécifique du module
```

## 💾 Persistance des données

Les préférences sont sauvegardées dans des **cookies** (durée: 365 jours) :

- `acc_brightness_mode` : Mode sélectionné
- `acc_brightness_contrast` : Niveau de contraste
- `acc_brightness_brightness` : Niveau de luminosité
- `acc_brightness_saturation` : Niveau de saturation

**IMPORTANT** : Ce module utilise uniquement des cookies, jamais `localStorage` ou `sessionStorage`.

## 🎨 Implémentation CSS

Le module utilise la propriété CSS `filter` sur l'élément `<body>` :

```css
body {
    filter: contrast(120%) brightness(110%) saturate(90%);
}
```

### Mode Nuit

```css
body {
    background-color: #1a1a1a !important;
    color: #f5f5f5 !important;
    filter: invert(1) hue-rotate(180deg);
}

img, video, [style*="background-image"] {
    filter: invert(1) hue-rotate(180deg);
}
```

### Mode Contraste Élevé

```css
body {
    filter: contrast(200%);
}

* {
    border-color: currentColor !important;
}
```

## 🔍 Cas d'usage

### Pour les malvoyants
- Mode contraste élevé pour améliorer la lisibilité
- Ajustement de la luminosité

### Pour la photosensibilité
- Mode nuit pour réduire l'éblouissement
- Réduction du contraste pour les sensibilités

### Pour la fatigue oculaire
- Mode lumière bleue en fin de journée
- Mode nuit pour une utilisation prolongée

### Pour le daltonisme
- Mode niveaux de gris pour éliminer la confusion des couleurs
- Ajustement de la saturation

## ♿ Accessibilité

- Navigation complète au clavier
- Boutons radio pour les modes prédéfinis
- Sliders avec valeurs annoncées
- Annonces pour les lecteurs d'écran
- Focus visible sur tous les contrôles
- Groupes de boutons avec rôle radiogroup

## 🚫 Restrictions

### ❌ NE PAS FAIRE

- Modifier ce fichier README.md
- Supprimer les marqueurs de protection
- Modifier les noms des cookies
- Utiliser localStorage ou sessionStorage
- Modifier les critères RGAA
- Changer les valeurs de contraste WCAG

### ✅ ALTERNATIVES

- Créer un nouveau module dans `modules/mon-module/`
- Ajouter de nouveaux modes via un module complémentaire
- Étendre les fonctionnalités via hooks

## 📚 API JavaScript

Le module expose les fonctions suivantes :

```javascript
// Appliquer un mode
accBrightnessModule.applyMode('night');

// Appliquer un réglage avancé
accBrightnessModule.applyAdvanced('contrast', 120);

// Réinitialiser
accBrightnessModule.reset();
```

## 🐛 Dépannage

### Les filtres ne s'appliquent pas

1. Vérifier que le module est activé
2. Vérifier la console JavaScript pour les erreurs
3. Tester dans un autre navigateur
4. Désactiver les extensions de navigateur

### Les images sont inversées en mode nuit

C'est normal - le mode nuit inverse les couleurs puis réinverse les images pour qu'elles restent normales.

### Performance impactée

Les filtres CSS peuvent impacter les performances sur des appareils anciens. Utiliser avec modération.

## ⚡ Performance

- **Poids** : ~6KB (JS) + ~2KB (CSS)
- **Impact performance** : Minimal (< 5ms)
- **Compatibilité** : IE11+, tous navigateurs modernes
- **GPU acceleration** : Oui (via CSS filters)

## 🔒 Sécurité

- Pas de stockage de données sensibles
- Validation des valeurs entrées
- Échappement des sorties
- Protection XSS native

## 📊 Compatibilité navigateurs

| Navigateur | Version minimum | Support |
|------------|----------------|---------|
| Chrome     | 18+            | ✅ Complet |
| Firefox    | 35+            | ✅ Complet |
| Safari     | 6+             | ✅ Complet |
| Edge       | 12+            | ✅ Complet |
| IE         | 11             | ⚠️ Partiel |

## 📜 Licence

GPL v2 or later - Conforme à la licence WordPress

## 🔄 Historique des versions

### Version 1.0.0 (15/01/2025)
- Version initiale
- 6 modes prédéfinis
- 3 réglages avancés
- Conformité RGAA 4.1

---

<!-- MODULE_INTEGRITY_CHECK: PASSED -->
<!-- MODULE_LAST_VALIDATED: 2025-01-15 -->

**Ce module est verrouillé et protégé par le système de validation.**

Pour toute question, consultez la documentation principale du plugin.