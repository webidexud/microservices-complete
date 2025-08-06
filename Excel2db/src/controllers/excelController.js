const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { title } = require('process');
const xlsxpopulate = require('xlsx-populate');
const XlsxPopulate = require('xlsx-populate');
const { get } = require('http');

// Configuración de Multer para manejar la subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/app/src/uploads'); // Asegúrate de que esta carpeta exista
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Mantener el nombre original del archivo
    }
});

// Crear una instancia de Multer con la configuración de almacenamiento
const upload = multer({storage: storage});

// El atributo de upload.single indica que viene desde el formulario con name=avatar
// Es una nueva instancia para enviarla a la vista mediante una ruta 
exports.uploadFile = upload.single("file"); // Middleware para manejar la subida de archivos

exports.FromProbe = (req, res) =>{
    res.render('pages/SubidaArchivo', {
        title: 'Update Excel',
        message: 'Sube tu archivo Excel'
    });
}

exports.GreatPage = async (req, res) => {
    try {

        const uploadsDir = '/app/src/uploads'; // Ruta donde Multer guarda los archivos
        let latestFilePath = null;

        // 1. Obtener el archivo más reciente en la carpeta de subidas (si existe)
        const getLatestFile = () => {
            const files = fs.readdirSync(uploadsDir);
            if (files.length === 0) return null;

            const sortedFiles = files.map(file => ({
                name: file,
                time: fs.statSync(path.join(uploadsDir, file)).mtime.getTime()
            })).sort((a, b) => b.time - a.time);

            return path.join(uploadsDir, sortedFiles[0].name);
        };

        // 2. Si es POST, procesar el nuevo archivo y limpiar los antiguos
        if (req.method === 'POST') {
            if (!req.file) {
                return res.status(400).send('No se subió ningún archivo');
            }

            // Borrar todos los archivos excepto el recién subido (req.file.path)
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                if (filePath !== req.file.path) {
                    fs.unlinkSync(filePath);
                    console.log(`Archivo borrado: ${file}`);
                }
            });

            latestFilePath = req.file.path; // Usar el archivo recién subido
        } else {
            // 3. Si es GET, usar el archivo más reciente de la carpeta (sin borrar nada)
            latestFilePath = getLatestFile();
        }

        XlsxPopulate.fromFileAsync(latestFilePath)
            .then(workbook => {
                const sheet = workbook.sheet("PROYECTOS VIGENCIA 2025");
                const lastRow = sheet.usedRange().endCell().rowNumber();
                const data = [];
                const entidades = new Set();
                const años = new Set();

                // Procesar datos
                for (let row = 3; row <= lastRow; row++) {
                    const anio = sheet.cell(`A${row}`).value();
                    const entidad = sheet.cell(`C${row}`).value();
                    const codContable = sheet.cell(`E${row}`).value();
                    const abogado = sheet.cell(`H${row}`).value();
                    const relevancia = sheet.cell(`M${row}`).value();
                    const estado = sheet.cell(`X${row}`).value();
                    const modalidad = sheet.cell(`Y${row}`).value();
                    const valorTotal = parseFloat(sheet.cell(`AD${row}`).value()) || 0;
                    const beneficio = parseFloat(sheet.cell(`AE${row}`).value()) || 0;
                    const aporteEntidad = parseFloat(sheet.cell(`Z${row}`).value()) || 0;
                    const adicionAporte = parseFloat(sheet.cell(`AA${row}`).value()) || 0;
                    const contrapartida = parseFloat(sheet.cell(`AB${row}`).value()) || 0;
                    const adicionContrapartida = parseFloat(sheet.cell(`AC${row}`).value()) || 0;

                    // Limpiar y sanitizar los datos de texto
                    const cleanText = (text) => {
                        if (typeof text !== 'string') return text;
                        return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
                    };

                    data.push({
                        anio: cleanText(anio),
                        entidad: cleanText(entidad),
                        codContable: cleanText(codContable),
                        abogado: cleanText(abogado),
                        relevancia: cleanText(relevancia),
                        estado: cleanText(estado),
                        modalidad: cleanText(modalidad),
                        valorTotal,
                        beneficio,
                        aporteEntidad,
                        adicionAporte,
                        contrapartida,
                        adicionContrapartida
                    });

                    // Agregar a listas de filtros
                    if (entidad) entidades.add(cleanText(entidad));
                    if (anio) años.add(cleanText(anio));
                }

                // Calcular totales generales
                const totales = data.reduce((acc, item) => {
                    return {
                        aporteEntidad: acc.aporteEntidad + item.aporteEntidad,
                        adicionAporte: acc.adicionAporte + item.adicionAporte,
                        contrapartida: acc.contrapartida + item.contrapartida,
                        adicionContrapartida: acc.adicionContrapartida + item.adicionContrapartida,
                        valorTotal: acc.valorTotal + item.valorTotal,
                        beneficio: acc.beneficio + item.beneficio
                    };
                }, {
                    aporteEntidad: 0,
                    adicionAporte: 0,
                    contrapartida: 0,
                    adicionContrapartida: 0,
                    valorTotal: 0,
                    beneficio: 0
                });

                // Preparar datos para el frontend con sanitización adicional
                const datosFrontend = {
                    proyectos: data,
                    entidades: Array.from(entidades).sort(),
                    años: Array.from(años).sort(),
                    totales: {
                        aporteEntidad: totales.aporteEntidad,
                        adicionAporte: totales.adicionAporte,
                        contrapartida: totales.contrapartida,
                        adicionContrapartida: totales.adicionContrapartida,
                        valorTotal: totales.valorTotal,
                        beneficio: totales.beneficio
                    }
                };

                // Convertir a JSON con reemplazo de caracteres problemáticos
                const jsonData = JSON.stringify(datosFrontend)
                    .replace(/\u2028/g, '\\u2028')
                    .replace(/\u2029/g, '\\u2028')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r');
                
                res.render('pages/Dashboard', {
                    title: 'Dashboard',
                    datos: jsonData
                });
            });
    } catch (error) {
        console.error('Error al procesar el archivo:', error);
        res.status(500).send('Error al procesar el archivo');
    }
};










