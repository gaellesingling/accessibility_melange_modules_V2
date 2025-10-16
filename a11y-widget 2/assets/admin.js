(function () {
    'use strict';

    function toArray(list) {
        return Array.prototype.slice.call(list || []);
    }

    function getLayoutInput(container) {
        var selector = container.getAttribute('data-layout-input');
        if (selector) {
            var target = document.querySelector(selector);
            if (target) {
                return target;
            }
        }
        return container.querySelector('.a11y-widget-admin-layout');
    }

    function updateSection(container) {
        var slugs = [];
        toArray(container.querySelectorAll('.a11y-widget-admin-feature')).forEach(function (feature) {
            var slug = feature.getAttribute('data-feature-slug');
            if (slug) {
                slugs.push(slug);
            }
        });

        var input = getLayoutInput(container);
        if (input) {
            input.value = slugs.join(',');
        }

        var empty = container.querySelector('.a11y-widget-admin-section__empty-message');
        if (empty) {
            if (slugs.length) {
                empty.setAttribute('hidden', 'hidden');
            } else {
                empty.removeAttribute('hidden');
            }
        }
    }

    function refreshAll(containers) {
        toArray(containers).forEach(updateSection);
    }

    function closestContainer(element) {
        while (element && element !== document) {
            if (element.classList && element.classList.contains('a11y-widget-admin-section__content')) {
                return element;
            }

            element = element.parentElement;
        }

        return null;
    }

    function getDragAfterElement(container, y) {
        var siblings = toArray(container.querySelectorAll('.a11y-widget-admin-feature:not(.a11y-widget-admin-feature--dragging)'));
        var closest = {
            offset: Number.NEGATIVE_INFINITY,
            element: null
        };

        siblings.forEach(function (child) {
            var box = child.getBoundingClientRect();
            var offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                closest = {
                    offset: offset,
                    element: child
                };
            }
        });

        return closest.element;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var containers = toArray(document.querySelectorAll('.a11y-widget-admin-section__content'));

        if (!containers.length) {
            return;
        }

        var draggedFeature = null;
        var dragOrigin = null;
        var dragNextSibling = null;
        var dropOccurred = false;

        function cleanupDrag() {
            containers.forEach(function (container) {
                container.classList.remove('a11y-widget-admin-section__content--drag-over');
            });

            if (draggedFeature) {
                draggedFeature.classList.remove('a11y-widget-admin-feature--dragging');
            }

            if (draggedFeature) {
                draggedFeature = null;
            }

            dragOrigin = null;
            dragNextSibling = null;
            dropOccurred = false;
        }

        function enableFeatureDrag(feature) {
            feature.setAttribute('draggable', 'true');

            feature.addEventListener('dragstart', function (event) {
                draggedFeature = feature;
                dragOrigin = feature.parentElement;
                dragNextSibling = feature.nextElementSibling;
                dropOccurred = false;

                feature.classList.add('a11y-widget-admin-feature--dragging');

                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    try {
                        event.dataTransfer.setData('text/plain', feature.getAttribute('data-feature-slug') || 'feature');
                        if (event.dataTransfer.setDragImage) {
                            event.dataTransfer.setDragImage(feature, event.offsetX || 0, event.offsetY || 0);
                        }
                    } catch (err) {
                        // Ignore errors from browsers that disallow setting data.
                    }
                }
            });

            feature.addEventListener('dragend', function () {
                if (!dropOccurred && dragOrigin) {
                    if (dragNextSibling && dragNextSibling.parentNode === dragOrigin) {
                        dragOrigin.insertBefore(feature, dragNextSibling);
                    } else {
                        dragOrigin.appendChild(feature);
                    }
                }

                refreshAll(containers);
                cleanupDrag();
            });
        }

        containers.forEach(function (container) {
            toArray(container.querySelectorAll('.a11y-widget-admin-feature')).forEach(enableFeatureDrag);

            container.addEventListener('dragenter', function (event) {
                if (!draggedFeature) {
                    return;
                }
                event.preventDefault();
                container.classList.add('a11y-widget-admin-section__content--drag-over');
            });

            container.addEventListener('dragover', function (event) {
                if (!draggedFeature) {
                    return;
                }

                event.preventDefault();

                var afterElement = getDragAfterElement(container, event.clientY);

                if (!afterElement) {
                    container.appendChild(draggedFeature);
                } else if (afterElement !== draggedFeature) {
                    container.insertBefore(draggedFeature, afterElement);
                }
            });

            container.addEventListener('dragleave', function (event) {
                if (!draggedFeature) {
                    return;
                }

                if (!container.contains(event.relatedTarget)) {
                    container.classList.remove('a11y-widget-admin-section__content--drag-over');
                }
            });

            container.addEventListener('drop', function (event) {
                if (!draggedFeature) {
                    return;
                }

                event.preventDefault();
                dropOccurred = true;
                container.classList.remove('a11y-widget-admin-section__content--drag-over');
            });
        });

        document.addEventListener('drop', function (event) {
            if (!draggedFeature) {
                return;
            }

            if (closestContainer(event.target)) {
                dropOccurred = true;
            }
        }, true);

        refreshAll(containers);

        var form = document.querySelector('.a11y-widget-admin form');
        if (form) {
            form.addEventListener('submit', function () {
                refreshAll(containers);
            });
        }
    });
})();
