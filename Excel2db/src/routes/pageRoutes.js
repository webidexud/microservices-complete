const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const excelController = require('../controllers/excelController');

// Health check endpoint 
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'Excel2db',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

// Define las rutas y las asocia a una función del controlador
router.get('/', pageController.showHomePage);

// Ruta para mostrar el formulario de carga de Excel
router.get('/UploadExcel', excelController.FromProbe);

// ✅ RUTAS DASHBOARD - SOLUCIÓN SIMPLE Y FUNCIONAL
// Ruta GET para acceso directo al dashboard
router.get('/Dashboard', excelController.uploadFile, excelController.GreatPage);

// Ruta POST para el formulario (mismo endpoint)
router.post('/Dashboard', excelController.uploadFile, excelController.GreatPage);

// Rutas comentadas (mantener por referencia)
// router.get('/Excel', excelController.getExcelData);
// router.post('/Excel', excelController.uploadFile, excelController.processExcel);
// router.post('/Excel', excelController.uploadFile,excelController.GreatPage);

module.exports = router;