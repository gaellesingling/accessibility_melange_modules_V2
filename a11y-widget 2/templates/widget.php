<?php
/**
 * Widget markup (front)
 * This is printed in the footer or via shortcode.
 */
?>
<div id="a11y-widget-root" class="a11y-root" data-a11y-filter-exempt>
  <button class="a11y-launcher" id="a11y-launcher" aria-haspopup="dialog" aria-expanded="false" aria-controls="a11y-panel" aria-label="<?php echo esc_attr__('Ouvrir le module d’accessibilité', 'a11y-widget'); ?>" data-a11y-preserve-colors data-a11y-filter-exempt>
    <svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6.75 6.5h-4.5v11a1 1 0 1 1-2 0v-5h-1v5a1 1 0 1 1-2 0v-11h-4.5a1 1 0 1 1 0-2h14a1 1 0 1 1 0 2Z"/></svg>
  </button>

  <section class="a11y-panel is-right" id="a11y-panel" role="dialog" aria-modal="true" aria-labelledby="a11y-title" aria-hidden="true" hidden data-a11y-preserve-colors>
    <?php
    $panel_label_left  = esc_attr__( 'Placer le panneau à gauche', 'a11y-widget' );
    $panel_label_right = esc_attr__( 'Placer le panneau à droite', 'a11y-widget' );
    ?>
    <header class="a11y-header">
      <button
        type="button"
        class="a11y-side-toggle"
        id="a11y-side-toggle"
        aria-pressed="false"
        aria-label="<?php echo $panel_label_left; ?>"
        data-label-left="<?php echo $panel_label_left; ?>"
        data-label-right="<?php echo $panel_label_right; ?>"
        title="<?php echo $panel_label_left; ?>"
      >
        <svg class="a11y-side-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="8 5 3 12 8 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
          <polyline points="16 5 21 12 16 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
          <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
        </svg>
      </button>
      <svg class="a11y-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6.75 6.5h-4.5v11a1 1 0 1 1-2 0v-5h-1v5a1 1 0 1 1-2 0v-11h-4.5a1 1 0 1 1 0-2h14a1 1 0 1 1 0 2Z"/></svg>
      <h2 id="a11y-title" class="a11y-title"><?php echo esc_html__('Accessibilité du site', 'a11y-widget'); ?></h2>
      <div class="a11y-spacer" aria-hidden="true"></div>
      <button class="a11y-close" id="a11y-close" aria-label="<?php echo esc_attr__('Fermer le module', 'a11y-widget'); ?>">✕</button>
    </header>

    <div class="a11y-content" id="a11y-content">
      <?php
      $search_label       = esc_html__( 'Rechercher une fonctionnalité', 'a11y-widget' );
      $search_placeholder = esc_attr__( 'Rechercher une fonctionnalité…', 'a11y-widget' );
      $search_empty       = esc_html__( 'Aucun résultat ne correspond à votre recherche pour le moment.', 'a11y-widget' );
      ?>
      <form class="a11y-search" role="search" data-role="search-form">
        <label class="a11y-search__label" for="a11y-search"><?php echo $search_label; ?></label>
        <input
          type="search"
          id="a11y-search"
          class="a11y-search__input"
          placeholder="<?php echo $search_placeholder; ?>"
          autocomplete="off"
        />
      </form>

      <section
        class="a11y-search-results"
        data-role="search-results"
        hidden
        aria-hidden="true"
        aria-live="polite"
      >
        <h3 class="a11y-search-results__title" data-sr-only><?php echo esc_html__( 'Résultats de recherche', 'a11y-widget' ); ?></h3>
        <div class="a11y-search-results__list" data-role="search-list"></div>
        <p class="a11y-empty" data-role="search-empty" hidden><?php echo $search_empty; ?></p>
      </section>

      <?php $sections = a11y_widget_get_sections(); ?>
      <?php if ( ! empty( $sections ) ) : ?>
        <?php
        $tablist_id   = 'a11y-section-tabs';
        $tabpanel_id  = 'a11y-section-panel';
        $template_id  = 'a11y-feature-template';
        $payload      = array();
        $first_tab_id = '';
        ?>
        <nav
          id="<?php echo esc_attr( $tablist_id ); ?>"
          class="a11y-tabs"
          role="tablist"
          aria-label="<?php echo esc_attr__( 'Catégories d’accessibilité', 'a11y-widget' ); ?>"
          data-role="section-tablist"
        >
          <?php foreach ( $sections as $index => $section ) :
            $section_slug  = ! empty( $section['slug'] ) ? sanitize_title( $section['slug'] ) : '';
            $section_id    = $section_slug ? $section_slug : ( ! empty( $section['id'] ) ? sanitize_title( $section['id'] ) : sanitize_title( uniqid( 'a11y-sec-', true ) ) );
            $section_title = isset( $section['title'] ) ? $section['title'] : '';
            $children      = isset( $section['children'] ) ? (array) $section['children'] : array();
            $features_data = array();
            $section_icon  = isset( $section['icon'] ) ? sanitize_key( $section['icon'] ) : '';
            $icon_markup   = '';

            if ( ! empty( $children ) ) {
                foreach ( $children as $feature ) {
                    $feature_slug       = isset( $feature['slug'] ) ? sanitize_title( $feature['slug'] ) : '';
                    $feature_label      = isset( $feature['label'] ) ? $feature['label'] : '';
                    $feature_hint       = isset( $feature['hint'] ) ? $feature['hint'] : '';
                    $feature_aria_label = isset( $feature['aria_label'] ) ? $feature['aria_label'] : $feature_label;

                    if ( '' === $feature_slug || '' === $feature_label ) {
                        continue;
                    }

                    $children_payload = array();
                    if ( isset( $feature['children'] ) && is_array( $feature['children'] ) ) {
                        foreach ( $feature['children'] as $sub_feature ) {
                            $sub_slug       = isset( $sub_feature['slug'] ) ? sanitize_title( $sub_feature['slug'] ) : '';
                            $sub_label      = isset( $sub_feature['label'] ) ? $sub_feature['label'] : '';
                            $sub_hint       = isset( $sub_feature['hint'] ) ? $sub_feature['hint'] : '';
                            $sub_aria_label = isset( $sub_feature['aria_label'] ) ? $sub_feature['aria_label'] : $sub_label;

                            if ( '' === $sub_slug || '' === $sub_label ) {
                                continue;
                            }

                            $children_payload[] = array(
                                'slug'       => $sub_slug,
                                'label'      => wp_strip_all_tags( $sub_label ),
                                'hint'       => wp_strip_all_tags( $sub_hint ),
                                'aria_label' => wp_strip_all_tags( $sub_aria_label ),
                            );
                        }
                    }

                    $feature_payload = array(
                        'slug'       => $feature_slug,
                        'label'      => wp_strip_all_tags( $feature_label ),
                        'hint'       => wp_strip_all_tags( $feature_hint ),
                        'aria_label' => wp_strip_all_tags( $feature_aria_label ),
                    );

                    if ( isset( $feature['template'] ) ) {
                        $feature_template = sanitize_key( $feature['template'] );
                        if ( '' !== $feature_template ) {
                            $feature_payload['template'] = $feature_template;
                        }
                    }

                    if ( isset( $feature['settings'] ) && is_array( $feature['settings'] ) ) {
                        $settings_payload = array();
                        foreach ( $feature['settings'] as $setting_key => $setting_value ) {
                            $setting_slug = sanitize_key( $setting_key );

                            if ( '' === $setting_slug ) {
                                continue;
                            }

                            if ( is_scalar( $setting_value ) ) {
                                $settings_payload[ $setting_slug ] = wp_strip_all_tags( (string) $setting_value );
                            }
                        }

                        if ( ! empty( $settings_payload ) ) {
                            $feature_payload['settings'] = $settings_payload;
                        }
                    }

                    if ( ! empty( $children_payload ) ) {
                        $feature_payload['children'] = $children_payload;
                    }

                    $features_data[] = $feature_payload;
                }
            }

            if ( '' !== $section_icon && function_exists( 'a11y_widget_get_icon_markup' ) ) {
                $icon_markup = a11y_widget_get_icon_markup(
                    $section_icon,
                    array(
                        'class' => 'a11y-tab__icon-svg',
                    )
                );
            }

            $payload[] = array(
                'index'    => (int) $index,
                'id'       => $section_id,
                'slug'     => $section_slug ? $section_slug : $section_id,
                'title'    => wp_strip_all_tags( $section_title ),
                'icon'     => $section_icon,
                'features' => $features_data,
            );

            $tab_id     = 'a11y-tab-' . $section_id;
            $panel_id   = 'a11y-panel-' . $section_id;
            $is_active  = 0 === (int) $index;
            if ( $is_active && '' === $first_tab_id ) {
                $first_tab_id = $tab_id;
            }
            $tab_class = 'a11y-tab' . ( $is_active ? ' is-active' : '' );
            ?>
            <div class="a11y-tab-item" role="presentation" data-role="tab-item" data-section-id="<?php echo esc_attr( $section_id ); ?>">
              <button
                type="button"
                class="<?php echo esc_attr( $tab_class ); ?>"
                role="tab"
                id="<?php echo esc_attr( $tab_id ); ?>"
                aria-selected="<?php echo $is_active ? 'true' : 'false'; ?>"
                aria-controls="<?php echo esc_attr( $panel_id ); ?>"
                tabindex="<?php echo $is_active ? '0' : '-1'; ?>"
                data-role="section-tab"
                data-section-index="<?php echo esc_attr( $index ); ?>"
                data-section-id="<?php echo esc_attr( $section_id ); ?>"
                data-tablist-id="<?php echo esc_attr( $tablist_id ); ?>"
                <?php if ( '' !== $section_icon ) : ?>
                  data-section-icon="<?php echo esc_attr( $section_icon ); ?>"
                <?php endif; ?>
              >
                <?php if ( '' !== $icon_markup ) : ?>
                  <span class="a11y-tab__icon" aria-hidden="true"><?php echo $icon_markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
                <?php endif; ?>
                <span class="a11y-tab__label"><?php echo esc_html( $section_title ); ?></span>
              </button>
              <section
                class="a11y-section-panel"
                role="tabpanel"
                id="<?php echo esc_attr( $panel_id ); ?>"
                tabindex="0"
                aria-live="polite"
                data-role="section-panel"
                data-section-id="<?php echo esc_attr( $section_id ); ?>"
                <?php if ( $is_active && '' !== $first_tab_id ) : ?>aria-labelledby="<?php echo esc_attr( $first_tab_id ); ?>"<?php endif; ?>
                <?php if ( $is_active ) : ?>aria-hidden="false"<?php else : ?>hidden aria-hidden="true"<?php endif; ?>
              >
                <div class="a11y-grid" data-role="feature-grid"></div>
                <p class="a11y-empty" data-role="feature-empty" hidden><?php echo esc_html__( 'Aucune fonctionnalité disponible pour le moment.', 'a11y-widget' ); ?></p>
              </section>
            </div>
          <?php endforeach; ?>
        </nav>

        <template id="<?php echo esc_attr( $template_id ); ?>" data-role="feature-placeholder-template">
          <article class="a11y-card" data-role="feature-card">
            <div class="meta" data-role="feature-meta">
              <span class="label" data-role="feature-label"></span>
            </div>
            <label class="a11y-switch" data-role="feature-switch">
              <input type="checkbox" data-role="feature-input" data-feature="" aria-label="" />
              <span class="track"></span><span class="thumb"></span>
            </label>
          </article>
        </template>

        <script type="application/json" data-role="feature-data">
          <?php echo wp_json_encode( $payload ); ?>
        </script>
      <?php else : ?>
        <p class="a11y-empty"><?php echo esc_html__( 'Aucune fonctionnalité disponible pour le moment.', 'a11y-widget' ); ?></p>
      <?php endif; ?>
    </div>

    <footer class="a11y-footer">
      <div>
        <button class="a11y-btn" id="a11y-reset"><?php echo esc_html__('Réinitialiser', 'a11y-widget'); ?></button>
      </div>
      <div>
        <button class="a11y-btn primary" id="a11y-close2"><?php echo esc_html__('Fermer', 'a11y-widget'); ?></button>
      </div>
    </footer>
  </section>
</div>

<div class="a11y-overlay" id="a11y-overlay" role="presentation" aria-hidden="true" data-a11y-filter-exempt></div>
