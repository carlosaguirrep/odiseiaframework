<div class="odisiaoptions">
    <div class="odiseiaoptions-container">
        <div class="odiseiaoptions-heading">
            <div class="col-1">
                <img class="odiseiaoptions-heading-logo" src="<?= ODISEIAFRAMEWORK_URL ?>assets/odiseia_options/logo_odisea.svg" alt="">
                <h1>OdiseIaFramwework Options</h1>
            </div>
            <div class="col-2">
                <button class="odiseiaoptions-button">Exportar/Importar Opciones</button>
            </div>
        </div>
        <form method="post" action="options.php">
            <?php
            settings_fields('odiseiaFrameworkOptions'); // Grupo de opciones
            do_settings_sections('odiseiaframework');// Sección de la página
            submit_button();
            ?>
        </form>
    </div>
   
</div>