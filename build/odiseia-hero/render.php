<?php
$classes = 'odiseia-hero';
if (!empty($attributes['className'])) {
    $classes .= ' ' . $attributes['className'];
}
if (!empty($attributes['align'])) {
    $classes .= ' align' . $attributes['align']; // Agrega alignwide o alignfull si está configurado
}

if ( ! empty( $attributes['className'] ) ) {
    $classes .= ' ' . $attributes['className'];
}

echo sprintf( $content );