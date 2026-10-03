<?php

namespace odiseIAFramework;

/**
 * Gate for developer-only admin UI (CPT Builder management screens, REST routes, etc.).
 */
class Dev_Tools
{
    /**
     * Whether developer tooling admin UI should be shown.
     *
     * Defaults to visible: hidden only when `ODISEIA_DEV_TOOLS` is defined and falsy. This gates
     * admin pages and REST management routes only — CPT registration, meta, bindings, and
     * variations always run so existing content keeps working when dev tools are hidden.
     *
     * @return bool
     */
    public static function is_visible()
    {
        return ! defined('ODISEIA_DEV_TOOLS') || (bool) ODISEIA_DEV_TOOLS;
    }
}
