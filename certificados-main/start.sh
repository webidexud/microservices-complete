#!/bin/bash
# 📂 UBICACIÓN: start.sh (raíz del proyecto)
# Script de inicio rápido para el microservicio de certificados

set -e

echo "🚀 INICIANDO MICROSERVICIO DE CERTIFICADOS DIGITALES"
echo "=================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que Docker y Docker Compose están instalados
print_status "Verificando dependencias..."

if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

print_success "Docker y Docker Compose están disponibles"

# Crear directorios necesarios si no existen
print_status "Creando directorios necesarios..."

mkdir -p docker/mysql/init
mkdir -p docker/mysql/logs
mkdir -p uploads/plantillas
mkdir -p uploads/participantes  
mkdir -p generated/certificados
mkdir -p templates
mkdir -p logs

print_success "Directorios creados"

# Verificar que el archivo .env existe
if [ ! -f .env ]; then
    print_warning "Archivo .env no encontrado. Creando uno por defecto..."
    
    cat > .env << 'EOF'
# Configuración por defecto para desarrollo
MYSQL_ROOT_PASSWORD=root_secure_789
DB_PASSWORD=secure_password_123
REDIS_PASSWORD=redis_secure_456
ENVIRONMENT=docker
EOF
    
    print_success "Archivo .env creado"
fi

# Limpiar contenedores anteriores si existen
print_status "Limpiando contenedores anteriores..."
docker-compose down --remove-orphans 2>/dev/null || true
print_success "Limpieza completada"

# Construir e iniciar servicios
print_status "Construyendo e iniciando servicios..."
print_warning "Esto puede tomar varios minutos la primera vez..."

if docker-compose up --build -d; then
    print_success "Servicios iniciados correctamente"
else
    print_error "Error al iniciar los servicios"
    exit 1
fi

# Esperar a que los servicios estén listos
print_status "Esperando a que los servicios estén listos..."

# Función para verificar salud de un servicio
check_health() {
    local service_url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$service_url" > /dev/null 2>&1; then
            print_success "$service_name está listo"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name no respondió después de $max_attempts intentos"
    return 1
}

# Verificar cada servicio
echo ""
print_status "Verificando salud de los servicios..."

check_health "http://localhost/health" "Gateway"
check_health "http://localhost/health/admin" "Admin Service" 
check_health "http://localhost/health/public" "Public Service"
check_health "http://localhost/health/files" "File Service"

echo ""
print_success "¡Microservicio iniciado exitosamente! 🎉"
echo ""
echo "==============================================="
echo "📋 INFORMACIÓN DE ACCESO"
echo "==============================================="
echo -e "${GREEN}Frontend Público:${NC}     http://localhost/"
echo -e "${GREEN}Panel Admin:${NC}          http://localhost/admin/"
echo -e "${GREEN}Admin Directo:${NC}        http://localhost:8080/"
echo -e "${GREEN}Health Check:${NC}         http://localhost/health"
echo ""
echo "===============================================" 
echo "🔧 COMANDOS ÚTILES"
echo "==============================================="
echo -e "${YELLOW}Ver logs en tiempo real:${NC}  docker-compose logs -f"
echo -e "${YELLOW}Parar servicios:${NC}          docker-compose down"
echo -e "${YELLOW}Reiniciar servicios:${NC}      docker-compose restart"
echo -e "${YELLOW}Ver estado:${NC}               docker-compose ps"
echo -e "${YELLOW}Acceder a MySQL:${NC}          docker exec -it certificates-mysql mysql -u root -p"
echo ""
echo "==============================================="
echo "📊 MONITOREO"
echo "==============================================="
echo "Puedes monitorear el estado de los servicios visitando:"
echo "• http://localhost/health (Estado general)"
echo "• http://localhost/health/admin (Admin service)" 
echo "• http://localhost/health/public (Public service)"
echo "• http://localhost/health/files (File service)"
echo ""

# Mostrar logs iniciales si hay errores
if docker-compose ps | grep -q "Exit"; then
    print_error "Algunos servicios han fallado. Mostrando logs..."
    docker-compose logs --tail=20
fi

print_success "Script de inicio completado. ¡El microservicio está listo para usar!"