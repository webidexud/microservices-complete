// Función para formatear números como moneda
function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 2 
    }).format(value);
}


function inicializarFiltros(Idfiltros=["filtroAnio", "filtroEntidad", "filtroEstado"],datosFiltros=[[1,2,3],["Data1","Data2"],["Estado1","Estado2"]]) {
    // Obtener los selects de filtros
    // Inicializar cada filtro con sus datos correspondientes
    Idfiltros.forEach((filtroId, index) => {
        const selectElement = document.getElementById(filtroId);
        if (!selectElement) {
            console.warn(`No se encontró el elemento con ID: ${filtroId}`);
            return;
        }

        // Limpiar el select
        selectElement.innerHTML = '<option value="">Todos los valores</option>';

        // Obtener los datos correspondientes para este filtro
        const datos = datosFiltros[index];
        if (!datos || !Array.isArray(datos)) {
            console.warn(`Datos no válidos para el filtro: ${filtroId}`);
            return;
        }

        // Llenar el select con las opciones
        datos.forEach(valor => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = valor;
            selectElement.appendChild(option);
        });
    });

}




