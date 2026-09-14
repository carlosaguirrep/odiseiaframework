<?php

spl_autoload_register( function ( $class ) {
    if ( strpos( $class, 'odiseIAFramework\\' ) !== 0 ) {
        return;
    }

    $path = str_replace( '\\', '/', $class );
    $file = ODISEIAFRAMEWORK_PATH . 'includes/' . strtolower( str_replace( 'odiseIAFramework/', '', $path ) ) . '.php';


    if ( file_exists( $file ) ) {
        require_once $file;
    }
    
} );
