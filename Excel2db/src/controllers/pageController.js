/**
 * Muestra la página de Inicio.
 */
 exports.showHomePage = (req, res) => {
    res.render('pages/graficas', {
        title: 'Inicio'
    });
};
