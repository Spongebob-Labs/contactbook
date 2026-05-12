.PHONY: help up down reload reset logs ps build prisma

COMPOSE ?= docker compose
COMPOSE_FILE ?= docker/docker-compose.dev.yml
COMPOSE_PROJECT ?= monorepo-dev
COMPOSE_CMD := $(COMPOSE) -f $(COMPOSE_FILE) -p $(COMPOSE_PROJECT)

help:
	@echo "Monorepo dev stack (docker/docker-compose.dev.yml)"
	@echo ""
	@echo "Targets:"
	@echo "  up      Build + start stack (detached)"
	@echo "  down    Stop stack"
	@echo "  reload  Rebuild + recreate containers (detached)"
	@echo "  reset   Stop stack + remove compose volumes"
	@echo "  logs    Tail logs"
	@echo "  ps      Show container status"
	@echo "  build   Build images"
	@echo "  prisma  Push Prisma schema to DB (host pnpm)"

up:
	$(COMPOSE_CMD) up --build -d

down:
	$(COMPOSE_CMD) down

reload:
	$(COMPOSE_CMD) up --build -d --force-recreate
	$(MAKE) prisma

reset:
	$(COMPOSE_CMD) down -v --remove-orphans

logs:
	$(COMPOSE_CMD) logs -f --tail=200

ps:
	$(COMPOSE_CMD) ps

build:
	$(COMPOSE_CMD) build

prisma:
	pnpm --filter api prisma:push
