<?php
// $content is the inner blocks markup already rendered by core; printing it through
// sprintf() caused an ArgumentCountError whenever it contained a "%" character.
echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
