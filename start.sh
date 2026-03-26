#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  MoM Interview Note Agent — One-click Startup Script (Linux / macOS)
#
#  Usage:
#    chmod +x start.sh
#    ./start.sh              # Start all services
#    ./start.sh --stop       # Stop all services
#    ./start.sh --restart    # Restart all services
#    ./start.sh --logs       # View live logs
#    ./start.sh --status     # Check service status
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/backend/.env"
ENV_EXAMPLE="$PROJECT_DIR/backend/.env.example"

print_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   MoM Interview Note Agent — Startup Script     ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}[ERROR] Docker is not installed.${NC}"
        echo "  Install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! docker info &> /dev/null 2>&1; then
        echo -e "${RED}[ERROR] Docker daemon is not running.${NC}"
        echo "  Please start Docker Desktop or the Docker daemon."
        exit 1
    fi
    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}[ERROR] Docker Compose is not available.${NC}"
        exit 1
    fi
    echo -e "${GREEN}[OK] Docker is running${NC}"
}

# Use 'docker compose' (V2) if available, else 'docker-compose' (V1)
DC="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    DC="docker-compose"
fi

setup_env() {
    if [ -f "$ENV_FILE" ]; then
        echo -e "${GREEN}[OK] .env file found${NC}"
        # Check if GEMINI_API_KEY is set to placeholder
        if grep -q "your-gemini-api-key-here" "$ENV_FILE" 2>/dev/null; then
            echo -e "${YELLOW}[WARN] GEMINI_API_KEY is not configured in backend/.env${NC}"
            read -rp "  Enter your Gemini API key (or press Enter to skip): " api_key
            if [ -n "$api_key" ]; then
                sed -i.bak "s|your-gemini-api-key-here|$api_key|g" "$ENV_FILE"
                rm -f "$ENV_FILE.bak"
                echo -e "${GREEN}[OK] Gemini API key saved${NC}"
            else
                echo -e "${YELLOW}[SKIP] AI features will not work without an API key${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}[INFO] Creating .env from .env.example ...${NC}"
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        read -rp "  Enter your Gemini API key (or press Enter to skip): " api_key
        if [ -n "$api_key" ]; then
            sed -i.bak "s|your-gemini-api-key-here|$api_key|g" "$ENV_FILE"
            rm -f "$ENV_FILE.bak"
            echo -e "${GREEN}[OK] Gemini API key saved${NC}"
        else
            echo -e "${YELLOW}[SKIP] AI features will not work without an API key${NC}"
        fi

        # Generate a random JWT secret
        jwt_secret=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || echo "auto-generated-$(date +%s)")
        sed -i.bak "s|change-me-to-a-strong-random-secret|$jwt_secret|g" "$ENV_FILE"
        rm -f "$ENV_FILE.bak"
        echo -e "${GREEN}[OK] JWT secret auto-generated${NC}"
    fi
}

start_services() {
    echo ""
    echo -e "${CYAN}[1/3] Building Docker images...${NC}"
    cd "$PROJECT_DIR"
    $DC build --parallel

    echo ""
    echo -e "${CYAN}[2/3] Starting services...${NC}"
    $DC up -d

    echo ""
    echo -e "${CYAN}[3/3] Waiting for services to be ready...${NC}"
    sleep 3

    # Wait for backend health
    echo -n "  Backend: "
    for i in $(seq 1 30); do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo -e "${YELLOW}still starting (check logs with: ./start.sh --logs)${NC}"
        fi
        sleep 2
    done

    # Wait for frontend
    echo -n "  Frontend: "
    for i in $(seq 1 30); do
        if curl -sf http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo -e "${YELLOW}still starting (check logs with: ./start.sh --logs)${NC}"
        fi
        sleep 2
    done

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  All services are up!${NC}"
    echo ""
    echo -e "  Frontend:  ${CYAN}http://localhost:3000${NC}"
    echo -e "  Backend:   ${CYAN}http://localhost:8000${NC}"
    echo -e "  API Docs:  ${CYAN}http://localhost:8000/docs${NC}"
    echo -e "  Qdrant:    ${CYAN}http://localhost:6333/dashboard${NC}"
    echo ""
    echo -e "  Logs:    ${YELLOW}./start.sh --logs${NC}"
    echo -e "  Stop:    ${YELLOW}./start.sh --stop${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
}

stop_services() {
    echo -e "${YELLOW}Stopping all services...${NC}"
    cd "$PROJECT_DIR"
    $DC down
    echo -e "${GREEN}All services stopped.${NC}"
}

show_logs() {
    cd "$PROJECT_DIR"
    $DC logs -f --tail=100
}

show_status() {
    cd "$PROJECT_DIR"
    $DC ps
}

# ── Main ──────────────────────────────────────────────────────────────────────

print_banner

case "${1:-start}" in
    --stop|-s)
        check_docker
        stop_services
        ;;
    --restart|-r)
        check_docker
        stop_services
        setup_env
        start_services
        ;;
    --logs|-l)
        show_logs
        ;;
    --status)
        show_status
        ;;
    start|"")
        check_docker
        setup_env
        start_services
        ;;
    *)
        echo "Usage: $0 [--stop|--restart|--logs|--status]"
        exit 1
        ;;
esac
