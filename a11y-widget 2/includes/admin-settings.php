<?php
/**
 * Administration settings for the accessibility widget.
 *
 * @package A11yWidget
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Normalize a list of feature slugs.
 *
 * @param mixed $items Slugs to sanitize.
 *
 * @return string[]
 */
if ( ! function_exists( 'a11y_widget_normalize_feature_slugs' ) ) {
    function a11y_widget_normalize_feature_slugs( $items ) {
        if ( ! is_array( $items ) ) {
            $items = array( $items );
        }

        $normalized = array();

        foreach ( $items as $slug ) {
            $slug = sanitize_key( $slug );

            if ( '' === $slug ) {
                continue;
            }

            $normalized[ $slug ] = true;
        }

        return array_keys( $normalized );
    }
}

/**
 * Option name helper for disabled features.
 *
 * @return string
 */
function a11y_widget_get_disabled_features_option_name() {
    return 'a11y_widget_disabled_features';
}

/**
 * Option name helper for the "force all features" toggle.
 *
 * @return string
 */
function a11y_widget_get_force_all_features_option_name() {
    return 'a11y_widget_force_all_features';
}

/**
 * Option name helper for the custom feature layout.
 *
 * @return string
 */
function a11y_widget_get_feature_layout_option_name() {
    return 'a11y_widget_feature_layout';
}

/**
 * Default heading levels used by the reading guide summary.
 *
 * @return string[]
 */
function a11y_widget_get_reading_guide_heading_levels_default() {
    return array( 'h2', 'h3' );
}

/**
 * Option name helper for the reading guide heading levels.
 *
 * @return string
 */
function a11y_widget_get_reading_guide_heading_levels_option_name() {
    return 'a11y_widget_reading_guide_heading_levels';
}

/**
 * Sanitize the heading levels stored for the reading guide summary.
 *
 * @param mixed $input Raw input.
 *
 * @return string[]
 */
function a11y_widget_sanitize_heading_levels( $input ) {
    if ( null === $input ) {
        return a11y_widget_get_reading_guide_heading_levels_default();
    }

    if ( is_string( $input ) ) {
        $input = preg_split( '/,/', $input );
    }

    if ( ! is_array( $input ) ) {
        $input = array();
    }

    $valid     = array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' );
    $sanitized = array();

    foreach ( $input as $value ) {
        if ( is_array( $value ) ) {
            continue;
        }

        $value = strtolower( sanitize_key( $value ) );

        if ( in_array( $value, $valid, true ) ) {
            $sanitized[ $value ] = true;
        }
    }

    $levels = array();

    foreach ( $valid as $heading ) {
        if ( isset( $sanitized[ $heading ] ) ) {
            $levels[] = $heading;
        }
    }

    if ( empty( $levels ) ) {
        return a11y_widget_get_reading_guide_heading_levels_default();
    }

    return $levels;
}

/**
 * Retrieve the sanitized list of heading levels for the reading guide summary.
 *
 * @return string[]
 */
function a11y_widget_get_reading_guide_heading_levels() {
    $stored = get_option(
        a11y_widget_get_reading_guide_heading_levels_option_name(),
        a11y_widget_get_reading_guide_heading_levels_default()
    );

    return a11y_widget_sanitize_heading_levels( $stored );
}

/**
 * Build the CSS selector used to target headings for the reading guide summary.
 *
 * @return string
 */
function a11y_widget_get_reading_guide_heading_selector() {
    $levels = a11y_widget_get_reading_guide_heading_levels();

    if ( empty( $levels ) ) {
        $levels = a11y_widget_get_reading_guide_heading_levels_default();
    }

    $selectors = array();

    foreach ( $levels as $level ) {
        $selectors[] = 'main ' . $level;
    }

    return implode( ', ', $selectors );
}

/**
 * Retrieve the list of disabled features stored in the database.
 *
 * @return string[]
 */
function a11y_widget_get_disabled_features() {
    $stored = get_option( a11y_widget_get_disabled_features_option_name(), array() );

    if ( empty( $stored ) ) {
        return array();
    }

    return a11y_widget_normalize_feature_slugs( $stored );
}

/**
 * Determine if all features should be displayed, regardless of customization.
 *
 * @return bool
 */
function a11y_widget_force_all_features_enabled() {
    return (bool) get_option( a11y_widget_get_force_all_features_option_name(), true );
}

/**
 * Retrieve the stored feature layout with sanitized slugs.
 *
 * @return array<string, string[]>
 */
function a11y_widget_get_feature_layout() {
    $layout = get_option( a11y_widget_get_feature_layout_option_name(), array() );

    return a11y_widget_sanitize_feature_layout( $layout );
}

/**
 * Sanitize disabled features before saving the option.
 *
 * @param mixed $input Raw input.
 *
 * @return string[]
 */
function a11y_widget_sanitize_disabled_features( $input ) {
    if ( null === $input ) {
        return array();
    }

    return a11y_widget_normalize_feature_slugs( $input );
}

/**
 * Sanitize the "force all features" option.
 *
 * @param mixed $input Raw input value.
 *
 * @return bool
 */
function a11y_widget_sanitize_force_all_features( $input ) {
    return ! empty( $input );
}

/**
 * Sanitize the custom feature layout option.
 *
 * @param mixed $input Raw input.
 *
 * @return array<string, string[]>
 */
function a11y_widget_sanitize_feature_layout( $input ) {
    if ( ! is_array( $input ) ) {
        return array();
    }

    $layout = array();

    foreach ( $input as $section_slug => $children ) {
        $section_slug = sanitize_title( $section_slug );

        if ( '' === $section_slug ) {
            continue;
        }

        if ( is_string( $children ) ) {
            $children = preg_split( '/,/', $children );
        }

        if ( ! is_array( $children ) ) {
            continue;
        }

        $child_lookup = array();

        foreach ( $children as $child_slug ) {
            if ( is_array( $child_slug ) ) {
                continue;
            }

            $child_slug = sanitize_key( $child_slug );

            if ( '' === $child_slug ) {
                continue;
            }

            $child_lookup[ $child_slug ] = true;
        }

        $layout[ $section_slug ] = array_keys( $child_lookup );
    }

    return $layout;
}

/**
 * Register plugin settings used by the admin screen.
 */
function a11y_widget_register_settings() {
    register_setting(
        'a11y_widget_settings',
        a11y_widget_get_disabled_features_option_name(),
        array(
            'type'              => 'array',
            'sanitize_callback' => 'a11y_widget_sanitize_disabled_features',
            'default'           => array(),
        )
    );

    register_setting(
        'a11y_widget_settings',
        a11y_widget_get_force_all_features_option_name(),
        array(
            'type'              => 'boolean',
            'sanitize_callback' => 'a11y_widget_sanitize_force_all_features',
            'default'           => true,
        )
    );

    register_setting(
        'a11y_widget_settings',
        a11y_widget_get_feature_layout_option_name(),
        array(
            'type'              => 'array',
            'sanitize_callback' => 'a11y_widget_sanitize_feature_layout',
            'default'           => array(),
        )
    );

    register_setting(
        'a11y_widget_settings',
        a11y_widget_get_reading_guide_heading_levels_option_name(),
        array(
            'type'              => 'array',
            'sanitize_callback' => 'a11y_widget_sanitize_heading_levels',
            'default'           => a11y_widget_get_reading_guide_heading_levels_default(),
        )
    );
}
add_action( 'admin_init', 'a11y_widget_register_settings' );

/**
 * Add the "Accessibilité" menu entry in the WordPress administration.
 */
function a11y_widget_register_admin_menu() {
    add_menu_page(
        __( 'Accessibilité RGAA', 'a11y-widget' ),
        __( 'Accessibilité', 'a11y-widget' ),
        'manage_options',
        'a11y-widget',
        'a11y_widget_render_admin_page',
        'dashicons-universal-access-alt',
        58
    );
}
add_action( 'admin_menu', 'a11y_widget_register_admin_menu' );

/**
 * Enqueue styles for the admin settings screen.
 *
 * @param string $hook Current admin page.
 */
function a11y_widget_enqueue_admin_assets( $hook ) {
    if ( 'toplevel_page_a11y-widget' !== $hook ) {
        return;
    }

    wp_enqueue_style(
        'a11y-widget-admin',
        A11Y_WIDGET_URL . 'assets/admin.css',
        array(),
        A11Y_WIDGET_VERSION
    );

    wp_enqueue_script(
        'a11y-widget-admin',
        A11Y_WIDGET_URL . 'assets/admin.js',
        array(),
        A11Y_WIDGET_VERSION,
        true
    );
}
add_action( 'admin_enqueue_scripts', 'a11y_widget_enqueue_admin_assets' );

/**
 * Render the admin page that lets site administrators hide specific features.
 */
function a11y_widget_render_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $sections             = a11y_widget_get_sections();
    $disabled             = a11y_widget_get_disabled_features();
    $disabled_lookup      = array_fill_keys( $disabled, true );
    $force_all_features   = a11y_widget_force_all_features_enabled();
    $force_all_option_key = a11y_widget_get_force_all_features_option_name();
    $layout_option_key    = a11y_widget_get_feature_layout_option_name();
    $heading_option_key   = a11y_widget_get_reading_guide_heading_levels_option_name();
    $heading_levels       = a11y_widget_get_reading_guide_heading_levels();
    $available_headings   = array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' );
    ?>
    <div class="wrap a11y-widget-admin">
        <h1><?php esc_html_e( 'Accessibilité RGAA', 'a11y-widget' ); ?></h1>
        <p class="a11y-widget-admin__intro">
            <?php esc_html_e( 'Toutes les fonctionnalités sont actives par défaut. Décochez celles que vous souhaitez masquer aux utilisateurs finaux.', 'a11y-widget' ); ?>
        </p>

        <form method="post" action="options.php">
            <?php settings_fields( 'a11y_widget_settings' ); ?>

            <fieldset class="a11y-widget-admin-force-all">
                <legend class="screen-reader-text"><?php esc_html_e( 'Affichage des fonctionnalités', 'a11y-widget' ); ?></legend>
                <label for="a11y-widget-force-all">
                    <input type="hidden" name="<?php echo esc_attr( $force_all_option_key ); ?>" value="0" />
                    <input
                        type="checkbox"
                        id="a11y-widget-force-all"
                        name="<?php echo esc_attr( $force_all_option_key ); ?>"
                        value="1"
                        <?php checked( $force_all_features ); ?>
                    />
                    <?php esc_html_e( 'Afficher toutes les fonctionnalités du widget', 'a11y-widget' ); ?>
                </label>
                <p class="description">
                    <?php esc_html_e( 'Lorsque cette option est active, toutes les fonctionnalités sont affichées et la personnalisation ci-dessous est ignorée.', 'a11y-widget' ); ?>
                </p>
            </fieldset>

            <fieldset class="a11y-widget-admin-reading-guide">
                <legend><?php esc_html_e( 'Guide de lecture : niveaux de titres', 'a11y-widget' ); ?></legend>
                <p class="description">
                    <?php esc_html_e( 'Choisissez les niveaux de titres inclus dans le sommaire automatique du guide de lecture.', 'a11y-widget' ); ?>
                </p>
                <div class="a11y-widget-admin-reading-guide__choices">
                    <?php foreach ( $available_headings as $heading_level ) : ?>
                        <label>
                            <input
                                type="checkbox"
                                name="<?php echo esc_attr( $heading_option_key ); ?>[]"
                                value="<?php echo esc_attr( $heading_level ); ?>"
                                <?php checked( in_array( $heading_level, $heading_levels, true ) ); ?>
                            />
                            <?php echo esc_html( sprintf( __( 'Titres %s', 'a11y-widget' ), strtoupper( $heading_level ) ) ); ?>
                        </label>
                    <?php endforeach; ?>
                </div>
            </fieldset>

            <p class="a11y-widget-admin__hint">
                <?php esc_html_e( 'Glissez-déposez les fonctionnalités pour les réorganiser ou les déplacer vers une autre catégorie.', 'a11y-widget' ); ?>
            </p>

            <?php if ( empty( $sections ) ) : ?>
                <p class="a11y-widget-admin-empty">
                    <?php esc_html_e( 'Aucune fonctionnalité n’est disponible pour le moment.', 'a11y-widget' ); ?>
                </p>
            <?php else : ?>
                <div class="a11y-widget-admin-grid">
                    <?php
                    foreach ( $sections as $section ) :
                        $section_title = isset( $section['title'] ) ? $section['title'] : '';
                        $section_slug  = isset( $section['slug'] ) ? sanitize_title( $section['slug'] ) : '';
                        $section_icon  = isset( $section['icon'] ) ? sanitize_key( $section['icon'] ) : '';
                        $icon_markup   = '';
                        $children      = isset( $section['children'] ) && is_array( $section['children'] ) ? $section['children'] : array();

                        if ( '' !== $section_icon && function_exists( 'a11y_widget_get_icon_markup' ) ) {
                            $icon_markup = a11y_widget_get_icon_markup(
                                $section_icon,
                                array(
                                    'class' => 'a11y-widget-admin-section__icon-svg',
                                )
                            );
                        }

                        if ( '' === $section_slug ) {
                            continue;
                        }
                        ?>
                        <?php
                        $section_classes = array(
                            'a11y-widget-admin-section',
                            'a11y-widget-admin-section--' . $section_slug,
                        );
                        ?>
                        <fieldset class="<?php echo esc_attr( implode( ' ', $section_classes ) ); ?>">
                            <legend class="a11y-widget-admin-section__title">
                                <?php if ( '' !== $icon_markup ) : ?>
                                    <span class="a11y-widget-admin-section__icon" aria-hidden="true"><?php echo $icon_markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
                                <?php endif; ?>
                                <span class="a11y-widget-admin-section__title-text"><?php echo esc_html( $section_title ); ?></span>
                            </legend>

                            <?php
                            $layout_input_id = 'a11y-widget-layout-' . $section_slug;
                            ?>
                            <input
                                type="hidden"
                                id="<?php echo esc_attr( $layout_input_id ); ?>"
                                class="a11y-widget-admin-layout"
                                name="<?php echo esc_attr( $layout_option_key ); ?>[<?php echo esc_attr( $section_slug ); ?>]"
                                value="<?php echo esc_attr( implode( ',', wp_list_pluck( $children, 'slug' ) ) ); ?>"
                            />

                            <div
                                class="a11y-widget-admin-section__content"
                                data-section="<?php echo esc_attr( $section_slug ); ?>"
                                data-layout-input="#<?php echo esc_attr( $layout_input_id ); ?>"
                            >
                                <p class="a11y-widget-admin-empty a11y-widget-admin-section__empty-message"<?php if ( ! empty( $children ) ) : ?> hidden<?php endif; ?>>
                                    <em><?php esc_html_e( 'Aucune fonctionnalité dans cette catégorie.', 'a11y-widget' ); ?></em>
                                </p>

                                <?php
                                foreach ( $children as $feature ) :
                                    $feature_slug  = isset( $feature['slug'] ) ? sanitize_key( $feature['slug'] ) : '';
                                    $feature_label = isset( $feature['label'] ) ? $feature['label'] : '';
                                    $feature_hint  = isset( $feature['hint'] ) ? $feature['hint'] : '';
                                    $feature_children = array();

                                    if ( isset( $feature['children'] ) && is_array( $feature['children'] ) ) {
                                        foreach ( $feature['children'] as $sub_feature ) {
                                            if ( empty( $sub_feature['slug'] ) || empty( $sub_feature['label'] ) ) {
                                                continue;
                                            }

                                            $sub_slug  = sanitize_key( $sub_feature['slug'] );
                                            $sub_label = wp_strip_all_tags( $sub_feature['label'] );

                                            if ( '' === $sub_slug || '' === $sub_label ) {
                                                continue;
                                            }

                                            $feature_children[] = array(
                                                'slug'       => $sub_slug,
                                                'label'      => $sub_label,
                                                'hint'       => isset( $sub_feature['hint'] ) ? wp_strip_all_tags( $sub_feature['hint'] ) : '',
                                                'aria_label' => isset( $sub_feature['aria_label'] ) ? wp_strip_all_tags( $sub_feature['aria_label'] ) : $sub_label,
                                            );
                                        }
                                    }

                                    if ( '' === $feature_slug || '' === $feature_label ) {
                                        continue;
                                    }

                                    $is_disabled   = isset( $disabled_lookup[ $feature_slug ] );
                                    $input_id      = 'a11y-widget-toggle-' . ( $section_slug ? $section_slug . '-' : '' ) . $feature_slug;
                                    $group_label_id = 'a11y-widget-feature-label-' . $feature_slug;
                                    $has_children  = ! empty( $feature_children );
                                    ?>
                                    <div class="a11y-widget-admin-feature<?php echo $has_children ? ' a11y-widget-admin-feature--group' : ''; ?>" data-feature-slug="<?php echo esc_attr( $feature_slug ); ?>">
                                        <button type="button" class="a11y-widget-admin-feature__handle">
                                            <span class="screen-reader-text">
                                                <?php
                                                printf(
                                                    /* translators: %s: feature label */
                                                    esc_html__( 'Déplacer la fonctionnalité « %s »', 'a11y-widget' ),
                                                    wp_strip_all_tags( $feature_label )
                                                );
                                                ?>
                                            </span>
                                            <span class="dashicons dashicons-move" aria-hidden="true"></span>
                                        </button>

                                        <div class="a11y-widget-admin-feature__main">
                                            <div class="a11y-widget-admin-feature__description">
                                                <?php if ( $has_children ) : ?>
                                                    <span class="a11y-widget-admin-feature__label" id="<?php echo esc_attr( $group_label_id ); ?>"><?php echo esc_html( $feature_label ); ?></span>
                                                <?php else : ?>
                                                    <label for="<?php echo esc_attr( $input_id ); ?>">
                                                        <span class="a11y-widget-admin-feature__label"><?php echo esc_html( $feature_label ); ?></span>
                                                    </label>
                                                <?php endif; ?>
                                            </div>
                                            <?php if ( ! $has_children ) : ?>
                                                <div class="a11y-widget-admin-toggle">
                                                    <label class="a11y-widget-switch" for="<?php echo esc_attr( $input_id ); ?>">
                                                        <span class="screen-reader-text">
                                                            <?php
                                                            printf(
                                                                /* translators: %s: feature label */
                                                                esc_html__( 'Masquer la fonctionnalité « %s » pour les utilisateurs', 'a11y-widget' ),
                                                                wp_strip_all_tags( $feature_label )
                                                            );
                                                            ?>
                                                        </span>
                                                        <input
                                                            type="checkbox"
                                                            id="<?php echo esc_attr( $input_id ); ?>"
                                                            name="<?php echo esc_attr( a11y_widget_get_disabled_features_option_name() ); ?>[]"
                                                            value="<?php echo esc_attr( $feature_slug ); ?>"
                                                            <?php checked( $is_disabled ); ?>
                                                            <?php disabled( $force_all_features ); ?>
                                                        />
                                                        <span class="a11y-widget-switch__ui">
                                                            <span
                                                                class="a11y-widget-switch__state"
                                                                data-state-visible="<?php echo esc_attr_x( 'Visible', 'feature state', 'a11y-widget' ); ?>"
                                                                data-state-hidden="<?php echo esc_attr_x( 'Masqué', 'feature state', 'a11y-widget' ); ?>"
                                                            ></span>
                                                        </span>
                                                    </label>
                                                </div>
                                            <?php endif; ?>
                                        </div>

                                        <?php if ( $has_children ) : ?>
                                            <div class="a11y-widget-admin-subfeatures" role="group" aria-labelledby="<?php echo esc_attr( $group_label_id ); ?>">
                                                <?php foreach ( $feature_children as $sub_feature ) :
                                                    $sub_slug        = $sub_feature['slug'];
                                                    $sub_label       = $sub_feature['label'];
                                                    $sub_hint        = $sub_feature['hint'];
                                                    $sub_aria_label  = $sub_feature['aria_label'];
                                                    $sub_is_disabled = isset( $disabled_lookup[ $sub_slug ] );
                                                    $sub_input_id    = 'a11y-widget-toggle-' . $sub_slug;
                                                    $sub_label_id    = $sub_input_id . '-label';
                                                    ?>
                                                    <div class="a11y-widget-admin-subfeature">
                                                        <div class="a11y-widget-admin-subfeature__description">
                                                            <label for="<?php echo esc_attr( $sub_input_id ); ?>" id="<?php echo esc_attr( $sub_label_id ); ?>">
                                                                <span class="a11y-widget-admin-subfeature__label"><?php echo esc_html( $sub_label ); ?></span>
                                                            </label>
                                                        </div>
                                                        <div class="a11y-widget-admin-toggle">
                                                            <label class="a11y-widget-switch" for="<?php echo esc_attr( $sub_input_id ); ?>">
                                                                <span class="screen-reader-text">
                                                                    <?php
                                                                    printf(
                                                                        /* translators: %s: feature label */
                                                                        esc_html__( 'Masquer la fonctionnalité « %s » pour les utilisateurs', 'a11y-widget' ),
                                                                        wp_strip_all_tags( $sub_label )
                                                                    );
                                                                    ?>
                                                                </span>
                                                                <input
                                                                    type="checkbox"
                                                                    id="<?php echo esc_attr( $sub_input_id ); ?>"
                                                                    name="<?php echo esc_attr( a11y_widget_get_disabled_features_option_name() ); ?>[]"
                                                                    value="<?php echo esc_attr( $sub_slug ); ?>"
                                                                    <?php checked( $sub_is_disabled ); ?>
                                                                    <?php disabled( $force_all_features ); ?>
                                                                    aria-label="<?php echo esc_attr( $sub_aria_label ); ?>"
                                                                />
                                                                <span class="a11y-widget-switch__ui">
                                                                    <span
                                                                        class="a11y-widget-switch__state"
                                                                        data-state-visible="<?php echo esc_attr_x( 'Visible', 'feature state', 'a11y-widget' ); ?>"
                                                                        data-state-hidden="<?php echo esc_attr_x( 'Masqué', 'feature state', 'a11y-widget' ); ?>"
                                                                    ></span>
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                <?php endforeach; ?>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </fieldset>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <?php submit_button( __( 'Enregistrer les modifications', 'a11y-widget' ) ); ?>
        </form>
    </div>
    <?php
}

/**
 * Remove disabled sub-features from a feature tree.
 *
 * @param array $feature          Feature definition.
 * @param array $disabled_lookup  Lookup of disabled slugs.
 *
 * @return array
 */
function a11y_widget_filter_disabled_subfeatures( $feature, $disabled_lookup ) {
    if ( empty( $feature['children'] ) || ! is_array( $feature['children'] ) ) {
        return $feature;
    }

    $filtered_children = array();

    foreach ( $feature['children'] as $child ) {
        if ( empty( $child['slug'] ) ) {
            continue;
        }

        $child_slug = sanitize_key( $child['slug'] );

        if ( '' === $child_slug || isset( $disabled_lookup[ $child_slug ] ) ) {
            continue;
        }

        if ( isset( $child['children'] ) && is_array( $child['children'] ) ) {
            $child = a11y_widget_filter_disabled_subfeatures( $child, $disabled_lookup );

            if ( empty( $child['children'] ) ) {
                unset( $child['children'] );
            }
        }

        $filtered_children[] = $child;
    }

    if ( empty( $filtered_children ) ) {
        unset( $feature['children'] );
    } else {
        $feature['children'] = array_values( $filtered_children );
    }

    return $feature;
}

/**
 * Remove disabled features from the sections used on the front-end.
 *
 * @param array $sections Sections passed to the template.
 *
 * @return array
 */
function a11y_widget_filter_disabled_features( $sections ) {
    if ( a11y_widget_force_all_features_enabled() ) {
        return $sections;
    }

    $doing_ajax = false;

    if ( function_exists( 'wp_doing_ajax' ) ) {
        $doing_ajax = wp_doing_ajax();
    } elseif ( defined( 'DOING_AJAX' ) && DOING_AJAX ) {
        $doing_ajax = true;
    }

    if ( is_admin() && ! $doing_ajax ) {
        return $sections;
    }

    $disabled = a11y_widget_get_disabled_features();

    if ( empty( $disabled ) ) {
        return $sections;
    }

    $disabled_lookup = array_fill_keys( $disabled, true );
    $filtered        = array();

    foreach ( $sections as $section ) {
        if ( ! isset( $section['children'] ) || ! is_array( $section['children'] ) ) {
            continue;
        }

        $children = array();

        foreach ( $section['children'] as $feature ) {
            $slug = isset( $feature['slug'] ) ? sanitize_key( $feature['slug'] ) : '';

            if ( '' === $slug ) {
                continue;
            }

            if ( isset( $disabled_lookup[ $slug ] ) ) {
                continue;
            }

            if ( isset( $feature['children'] ) && is_array( $feature['children'] ) ) {
                $feature = a11y_widget_filter_disabled_subfeatures( $feature, $disabled_lookup );

                if ( empty( $feature['children'] ) ) {
                    continue;
                }
            }

            $children[] = $feature;
        }

        if ( empty( $children ) ) {
            continue;
        }

        $section['children'] = array_values( $children );
        $filtered[]           = $section;
    }

    return $filtered;
}
add_filter( 'a11y_widget_sections', 'a11y_widget_filter_disabled_features', 20 );
