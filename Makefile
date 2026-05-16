# draw.wine Makefile

# Colors
RESET   := \033[0m
BOLD    := \033[1m
DIM     := \033[2m
RED     := \033[31m
GREEN   := \033[32m
YELLOW  := \033[33m
BLUE    := \033[34m
MAGENTA := \033[35m
CYAN    := \033[36m

# Directories
FE_DIR := fe
BE_DIR := be

.DEFAULT_GOAL := help

# ── Setup ────────────────────────────────────────────────────────────

.PHONY: install
install: ## Install all dependencies (frontend + backend)
	@echo ""
	@printf "$(BOLD)$(CYAN)  Installing Dependencies$(RESET)\n"
	@printf "$(DIM)  -> Frontend...$(RESET)\n"
	@cd $(FE_DIR) && npm install --silent
	@printf "$(GREEN)  ✔ Frontend deps installed$(RESET)\n"
	@printf "$(DIM)  -> Backend...$(RESET)\n"
	@cd $(BE_DIR) && npm install --silent
	@printf "$(GREEN)  ✔ Backend deps installed$(RESET)\n"

.PHONY: install-fe
install-fe: ## Install frontend dependencies only
	@printf "$(CYAN)  Installing frontend deps...$(RESET)\n"
	@cd $(FE_DIR) && npm install
	@printf "$(GREEN)  ✔ Done$(RESET)\n"

.PHONY: install-be
install-be: ## Install backend dependencies only
	@printf "$(CYAN)  Installing backend deps...$(RESET)\n"
	@cd $(BE_DIR) && npm install
	@printf "$(GREEN)  ✔ Done$(RESET)\n"

# ── Development ──────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start both frontend and backend dev servers
	@echo ""
	@printf "$(BOLD)$(MAGENTA)  🍷 Starting draw.wine$(RESET)\n"
	@printf "$(BLUE)  ℹ Frontend → http://localhost:5173$(RESET)\n"
	@printf "$(BLUE)  ℹ Backend  → http://localhost:3000$(RESET)\n"
	@printf "$(YELLOW)  ⚠ Press Ctrl+C to stop$(RESET)\n"
	@echo ""
	@(trap 'kill 0' INT; \
		cd $(BE_DIR) && npm run dev & \
		cd $(FE_DIR) && npm run dev & \
		wait)

.PHONY: dev-fe
dev-fe: ## Start frontend dev server only
	@printf "$(CYAN)  Starting frontend → http://localhost:5173$(RESET)\n"
	@cd $(FE_DIR) && npm run dev

.PHONY: dev-be
dev-be: ## Start backend dev server only
	@printf "$(CYAN)  Starting backend → http://localhost:3000$(RESET)\n"
	@cd $(BE_DIR) && npm run dev

# ── Build ────────────────────────────────────────────────────────────

.PHONY: build
build: build-fe build-be ## Build everything for production
	@printf "\n$(BOLD)$(GREEN)  ✔ Production build complete!$(RESET)\n"

.PHONY: build-fe
build-fe: ## Build frontend for production
	@printf "$(CYAN)  Building frontend...$(RESET)\n"
	@cd $(FE_DIR) && npm run build
	@printf "$(GREEN)  ✔ Frontend built → $(FE_DIR)/dist/$(RESET)\n"

.PHONY: build-be
build-be: ## Build backend for production
	@printf "$(CYAN)  Building backend...$(RESET)\n"
	@cd $(BE_DIR) && npm run build
	@printf "$(GREEN)  ✔ Backend built → $(BE_DIR)/dist/$(RESET)\n"

# ── Quality ──────────────────────────────────────────────────────────

.PHONY: lint
lint: ## Run linter on frontend
	@printf "$(CYAN)  Linting frontend...$(RESET)\n"
	@cd $(FE_DIR) && npm run lint
	@printf "$(GREEN)  ✔ No lint errors$(RESET)\n"

.PHONY: typecheck
typecheck: ## Run TypeScript type checking (both)
	@printf "$(CYAN)  Type checking frontend...$(RESET)\n"
	@cd $(FE_DIR) && npx tsc --noEmit
	@printf "$(GREEN)  ✔ Frontend types OK$(RESET)\n"
	@printf "$(CYAN)  Type checking backend...$(RESET)\n"
	@cd $(BE_DIR) && npx tsc --noEmit
	@printf "$(GREEN)  ✔ Backend types OK$(RESET)\n"

.PHONY: typecheck-fe
typecheck-fe: ## Type-check frontend only
	@printf "$(CYAN)  Type checking frontend...$(RESET)\n"
	@cd $(FE_DIR) && npx tsc --noEmit
	@printf "$(GREEN)  ✔ All types valid$(RESET)\n"

.PHONY: typecheck-be
typecheck-be: ## Type-check backend only
	@printf "$(CYAN)  Type checking backend...$(RESET)\n"
	@cd $(BE_DIR) && npx tsc --noEmit
	@printf "$(GREEN)  ✔ All types valid$(RESET)\n"

.PHONY: check
check: lint typecheck ## Run all quality checks (lint + types)
	@printf "\n$(BOLD)$(GREEN)  ✔ All checks passed!$(RESET)\n"

# ── Preview ──────────────────────────────────────────────────────────

.PHONY: preview
preview: ## Preview production frontend build
	@printf "$(CYAN)  Previewing production build...$(RESET)\n"
	@printf "$(YELLOW)  ⚠ Run 'make build-fe' first$(RESET)\n"
	@cd $(FE_DIR) && npm run preview

# ── Cleanup ──────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts
	@printf "$(CYAN)  Cleaning build artifacts...$(RESET)\n"
	@rm -rf $(FE_DIR)/dist $(BE_DIR)/dist
	@printf "$(GREEN)  ✔ Clean$(RESET)\n"

.PHONY: clean-all
clean-all: clean ## Remove build artifacts AND node_modules
	@printf "$(YELLOW)  ⚠ Removing node_modules...$(RESET)\n"
	@rm -rf $(FE_DIR)/node_modules $(BE_DIR)/node_modules
	@printf "$(GREEN)  ✔ Deep clean complete$(RESET)\n"

# ── Utilities ────────────────────────────────────────────────────────

.PHONY: loc
loc: ## Count lines of source code
	@echo ""
	@printf "$(BOLD)$(MAGENTA)  Lines of Code$(RESET)\n"
	@printf "$(CYAN)  Frontend: $(RESET)"
	@find $(FE_DIR)/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' | xargs wc -l 2>/dev/null | tail -1 | awk '{printf "%s lines\n", $$1}'
	@printf "$(CYAN)  Backend:  $(RESET)"
	@find $(BE_DIR)/src -name '*.ts' | xargs wc -l 2>/dev/null | tail -1 | awk '{printf "%s lines\n", $$1}'

# ── Help ─────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help message
	@echo ""
	@printf "$(BOLD)$(MAGENTA)  🍷 draw.wine$(DIM) — collaborative drawing app$(RESET)\n"
	@echo ""
	@printf "$(BOLD)  Usage:$(RESET)  make $(CYAN)<target>$(RESET)\n"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
# LLM
install-aider: ## Install Aider globally (for map generation)
	@printf "$(CYAN)  Installing Aider...$(RESET)\n"
	@npx install -g @aider/aider
	@printf "$(GREEN)  ✔ Aider installed$(RESET)\n"
setup-aider: ## Install Aider globally (for map generation)
	@printf "$(CYAN)  Setting up Aider...$(RESET)\n"
	@echo 'export OPENAI_API_KEY=dummy' >> ~/.bashrc
	@printf "$(GREEN)  ✔ Aider setup complete$(RESET)\n"
create-map:
	@printf "$(CYAN)  Creating map...$(RESET)\n"
	@aider --show-repo-map . > repo-context.txt
	@printf "$(GREEN)  ✔ Map created$(RESET)\n"