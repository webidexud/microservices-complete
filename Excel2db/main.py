# Cargar variables de entorno desde el archivo .env
from dotenv import load_dotenv
import os

# Librerías principales para visualización y manipulación de datos
import panel as pn
import pandas as pd
import hvplot.pandas
import requests

# Cargar el archivo .env
load_dotenv()

# Habilitar extensiones de Panel (para widgets y temas)
pn.extension('tabulator', template='bootstrap')

# Obtener variables de entorno
shared_link = os.getenv("SHARED_LINK")
sheet_name = os.getenv("SHEET_NAME")
dir_and_name_xlsx = os.getenv("DIR_AND_NAME_XLSX","./archivo_default.xlsx")

# Panel para mostrar errores en la interfaz
error_panel = pn.pane.Markdown("")  # Panel para mostrar errores



# -----------------------
# Función para descargar el archivo Excel desde el enlace
# -----------------------
def descargar_excel():
    try:
        # Construir el enlace de descarga directa
        download_link = shared_link.split('?')[0] + '?download=1'
        response = requests.get(download_link, stream=True)
        response.raise_for_status()  
        with open(dir_and_name_xlsx, "wb") as f:
            f.write(response.content)
        return True
    except Exception as e:
        error_panel.object = f"❌ Error al descargar el archivo: {e}"
        return False


# -----------------------
# Función para leer los datos del archivo Excel
# -----------------------
def leer_datos():
    try:
        df = pd.read_excel(dir_and_name_xlsx, sheet_name=sheet_name)
        error_panel.object = ""  # Limpiar errores anteriores
        return df
    except Exception as e:
        error_panel.object = f"❌ Error al leer el archivo Excel: {e}"
        return pd.DataFrame()  # Retornar vacío para evitar fallos


# -----------------------
# Función para crear los gráficos con los datos leídos
# -----------------------
def crear_graficas(df):
    if df.empty:
        return pn.pane.Markdown("⚠️ No hay datos disponibles para mostrar.")
    
    # Agrupar los datos por día y sumar los valores
    grouped = df.groupby("dia")["valor"].sum().reset_index()

    # Crear gráfico de barras
    bar_plot = grouped.hvplot.bar(
        x="dia", y="valor",
        title="Ventas por día", xlabel="Día", ylabel="Valor", color="orange"
    )

    # Crear gráfico de líneas
    line_plot = grouped.hvplot.line(
        x="dia", y="valor",
        title="Tendencia de ventas", xlabel="Día", ylabel="Valor", line_width=2, color="green"
    )

    # Devolver ambos gráficos como un panel en una fila
    return pn.Row(
        pn.pane.HoloViews(line_plot, sizing_mode='stretch_both'),
        pn.pane.HoloViews(bar_plot, sizing_mode='stretch_both'),
    )

# Spinner (indicador de carga) que se activa durante la actualización
spinner = pn.indicators.LoadingSpinner(value=False, width=50, height=50, color='primary')

# Botón para actualizar los datos manualmente
boton_actualizar = pn.widgets.Button(name="Actualizar datos", button_type="primary")

# -----------------------
# Inicialización de datos al arrancar
# -----------------------
descargar_excel()
data = leer_datos()
graficas_panel = crear_graficas(data)

# -----------------------
# Función para actualizar los datos cuando se presiona el botón
# -----------------------
def actualizar_dashboard():
    spinner.value = True
    try:
        if not descargar_excel():
            return graficas_panel  # Si falló descarga, no actualiza
        nuevo_df = leer_datos()
        return crear_graficas(nuevo_df)
    finally:
        spinner.value = False


# -----------------------
# Función para manejar clics en el botón de actualizar
# -----------------------
def on_click(event):
    dashboard[-1].objects = actualizar_dashboard().objects

boton_actualizar.on_click(on_click)


# -----------------------
# Composición final del dashboard
# -----------------------
dashboard = pn.Column(
    pn.pane.Markdown("## Interactive Dashboard"),
    pn.Row(boton_actualizar, spinner),
    error_panel,
    graficas_panel
)

# Mostrar la aplicación usando Panel
# Se expone por el puerto 8080 y se permite origen WebSocket desde los valores definidos
dashboard.show(
    port=8080,
    address='0.0.0.0',
    allowed_websocket_origin=[os.getenv("BOKEH_ALLOW_WS_ORIGIN")]
)

# Mensaje por consola para indicar el puerto visible externamente
port=os.getenv("PORT")
print(f'Aplicación corriendo en http://localhost:{port}')

