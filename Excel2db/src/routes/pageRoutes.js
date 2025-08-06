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

// router.get('/Excel', excelController.getExcelData);

// router.post('/Excel', excelController.uploadFile, excelController.processExcel);

router.get('/UploadExcel', excelController.FromProbe);

// router.post('/Excel', excelController.uploadFile,excelController.GreatPage);
router.post('/Dashboard', excelController.uploadFile,excelController.GreatPage);
router.get('/Dashboard', excelController.uploadFile,excelController.GreatPage);

module.exports = router;
