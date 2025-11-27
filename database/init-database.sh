#!/bin/bash

# ============================================
# Authentication Database Initialization
# ============================================
# One-command setup for standalone auth database
#
# This script will:
#   1. Create PostgreSQL database and user
#   2. Create schema (tables, indexes)
#   3. Generate RSA keys and secrets
#   4. Seed demo data (users and groups)
#
# Usage: ./init-database.sh [options]
#
# Options:
#   --encrypted    Use encrypted private key
#   --no-demo      Skip demo data seeding
#   --drop         Drop existing database (DANGEROUS)
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ENCRYPTED=false
SKIP_DEMO=false
DROP_DB=false

for arg in "$@"; do
  case $arg in
    --encrypted)
      ENCRYPTED=true
      ;;
    --no-demo)
      SKIP_DEMO=true
      ;;
    --drop)
      DROP_DB=true
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      echo "Usage: $0 [--encrypted] [--no-demo] [--drop]"
      exit 1
      ;;
  esac
done

# Default configuration (can be overridden with environment variables)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-auth_db}"
DB_USER="${DB_USER:-auth_user}"
DB_PASSWORD="${DB_PASSWORD:-auth_password}"

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Authentication Database Setup${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "  Database: ${GREEN}${DB_NAME}${NC}"
echo -e "  User:     ${GREEN}${DB_USER}${NC}"
echo -e "  Host:     ${GREEN}${DB_HOST}:${DB_PORT}${NC}"
echo -e "  Encrypted key: ${GREEN}${ENCRYPTED}${NC}"
echo -e "  Demo data: ${GREEN}$([ "$SKIP_DEMO" = true ] && echo "NO" || echo "YES")${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; then
  echo -e "${RED}❌ PostgreSQL is not running on ${DB_HOST}:${DB_PORT}${NC}"
  echo -e "${YELLOW}   Start PostgreSQL and try again${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} PostgreSQL is running"
echo ""

# Drop database if requested
if [ "$DROP_DB" = true ]; then
  echo -e "${YELLOW}⚠️  Dropping existing database...${NC}"
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
  sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
  echo -e "${GREEN}✓${NC} Existing database dropped"
  echo ""
fi

# Create database user
echo -e "${BLUE}1. Creating database user...${NC}"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
  echo -e "${YELLOW}   User already exists, skipping...${NC}"
}
echo -e "${GREEN}✓${NC} Database user ready"
echo ""

# Create database
echo -e "${BLUE}2. Creating database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || {
  echo -e "${YELLOW}   Database already exists, skipping...${NC}"
}
echo -e "${GREEN}✓${NC} Database ready"
echo ""

# Create schema
echo -e "${BLUE}3. Creating database schema...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f schema.sql
echo -e "${GREEN}✓${NC} Schema created"
echo ""

# Generate RSA keys
echo -e "${BLUE}4. Generating RSA keys and secrets...${NC}"
export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
if [ "$ENCRYPTED" = true ]; then
  node generate-keys.js --encrypted
else
  node generate-keys.js
fi
echo -e "${GREEN}✓${NC} RSA keys generated"
echo ""

# Seed demo data
if [ "$SKIP_DEMO" = false ]; then
  echo -e "${BLUE}5. Seeding demo data...${NC}"
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f seed-demo-data.sql
  echo -e "${GREEN}✓${NC} Demo data seeded"
  echo ""
fi

# Final summary
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ Database initialization complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "${BLUE}Database Configuration:${NC}"
echo -e "  Host:     ${DB_HOST}"
echo -e "  Port:     ${DB_PORT}"
echo -e "  Database: ${DB_NAME}"
echo -e "  User:     ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo ""

if [ "$SKIP_DEMO" = false ]; then
  echo -e "${BLUE}Demo Accounts (password: password123):${NC}"
  echo -e "  ${GREEN}admin@example.com${NC}  - Administrator"
  echo -e "  ${GREEN}alice@example.com${NC}  - Managers, Developers"
  echo -e "  ${GREEN}bob@example.com${NC}    - Developers"
  echo -e "  ${GREEN}carol@example.com${NC}  - Viewers"
  echo -e "  ${GREEN}guest@example.com${NC}  - No groups"
  echo ""
fi

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Update config.js with database credentials:"
echo -e "     ${YELLOW}host: '${DB_HOST}'${NC}"
echo -e "     ${YELLOW}database: '${DB_NAME}'${NC}"
echo -e "     ${YELLOW}user: '${DB_USER}'${NC}"
echo -e "     ${YELLOW}password: '${DB_PASSWORD}'${NC}"
echo ""
echo -e "  2. Start the auth service:"
echo -e "     ${YELLOW}cd ..${NC}"
echo -e "     ${YELLOW}node auth-service.js${NC}"
echo ""
echo -e "  3. Visit: ${GREEN}http://localhost:3004${NC}"
echo ""
echo -e "${GREEN}==========================================${NC}"
echo ""
