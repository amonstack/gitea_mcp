.PHONY: all install lint build test test-watch test-integration clean dev version sync verify verify-publish package package-source package-release publish

all: lint build

install:
	npm ci

lint:
	npm run lint

version:
	@TAG=""; \
	if [ -n "$$GITHUB_REF_NAME" ] && echo "$$GITHUB_REF_NAME" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+'; then \
		TAG="$$GITHUB_REF_NAME"; \
	else \
		TAG=$$(git describe --tags --abbrev=0 2>/dev/null || echo ""); \
	fi; \
	if [ -n "$$TAG" ]; then \
		VERSION=$${TAG#v}; \
		CURRENT=$$(node -p "require('./package.json').version"); \
		if [ "$$VERSION" != "$$CURRENT" ]; then \
			node -e "var p=require('./package.json');p.version='$$VERSION';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"; \
			echo "Version: $$VERSION (from tag $$TAG)"; \
		fi; \
	fi

build: version
	npm run build

test:
	npm test

test-watch:
	npm run test:watch

test-integration:
	npm run test:integration

clean:
	rm -rf dist .dist

dev:
	npm run dev

sync:
	npm install

verify: install lint test

verify-publish:
	@DETECTPlatform=""; DETECTOwner=""; \
	if [ -n "$$GITHUB_PUBLISH_OWNER" ]; then \
		DETECTOwner="$$GITHUB_PUBLISH_OWNER"; \
	fi; \
	REMOTE_URL=$$(git remote get-url origin 2>/dev/null); \
	if [ -n "$$REMOTE_URL" ]; then \
		HOST=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?([^/]+).*#\2#'); \
		if [ -z "$$DETECTOwner" ]; then \
			DETECTOwner=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?[^/]+/([^/]+).*#\2#'); \
		fi; \
		if [ "$$HOST" = "github.com" ]; then \
			DETECTPlatform="github"; \
		else \
			DETECTPlatform="gitea"; \
		fi; \
	fi; \
	if [ -z "$$DETECTPlatform" ] || [ -z "$$DETECTOwner" ]; then \
		echo "ERROR: Cannot determine platform/owner. Set GITHUB_PUBLISH_OWNER env var or ensure git remote is configured."; \
		exit 1; \
	fi; \
	VERSION=$$(node -p "require('./package.json').version"); \
	echo "========================================"; \
	echo " Package : gitea-mcp"; \
	echo " Version : $$VERSION"; \
	echo " Platform: $$DETECTPlatform"; \
	echo " Owner   : $$DETECTOwner"; \
	if [ "$$DETECTPlatform" = "github" ]; then \
		echo " Registry: https://npm.pkg.github.com/$$DETECTOwner"; \
		ARCHIVE=".dist/github/releases/gitea-mcp-$$VERSION.tgz"; \
	else \
		echo " Registry: $${GITEA_PUBLISH_URL:-<not set>}"; \
		ARCHIVE=".dist/gitea/releases/gitea-mcp-$$VERSION.tgz"; \
	fi; \
	if [ -f "$$ARCHIVE" ]; then \
		echo " Archive : $$ARCHIVE ($$(du -h "$$ARCHIVE" | cut -f1))"; \
	else \
		echo " Archive : $$ARCHIVE (not found -- run make package first)"; \
	fi; \
	echo "========================================"

package: build package-source package-release

package-source: build
	@DETECTPlatform=""; DETECTOwner=""; \
	if [ -n "$$GITHUB_PUBLISH_OWNER" ]; then \
		DETECTOwner="$$GITHUB_PUBLISH_OWNER"; \
	fi; \
	REMOTE_URL=$$(git remote get-url origin 2>/dev/null); \
	if [ -n "$$REMOTE_URL" ]; then \
		HOST=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?([^/]+).*#\2#'); \
		if [ -z "$$DETECTOwner" ]; then \
			DETECTOwner=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?[^/]+/([^/]+).*#\2#'); \
		fi; \
		if [ "$$HOST" = "github.com" ]; then \
			DETECTPlatform="github"; \
		else \
			DETECTPlatform="gitea"; \
		fi; \
	fi; \
	if [ -z "$$DETECTPlatform" ]; then \
		echo "ERROR: Cannot detect platform. Ensure git remote is configured."; \
		exit 1; \
	fi; \
	if [ -n "$$DETECTOwner" ]; then \
		cp package.json package.json.bak && \
		node -e "var p=require('./package.json');p.name='@$$DETECTOwner/gitea-mcp';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"; \
	fi; \
	VERSION=$$(node -p "require('./package.json').version"); \
	mkdir -p .dist/$$DETECTPlatform/sources; \
	tar czf .dist/$$DETECTPlatform/sources/gitea-mcp-src-$$VERSION.tgz \
		--exclude='node_modules' \
		--exclude='dist' \
		--exclude='.dist' \
		--exclude='.git' \
		--exclude='*.tgz' \
		--transform='s|^|gitea-mcp/|' \
		.; \
	if [ -f package.json.bak ]; then \
		mv package.json.bak package.json; \
	fi

package-release: build
	@DETECTPlatform=""; DETECTOwner=""; \
	if [ -n "$$GITHUB_PUBLISH_OWNER" ]; then \
		DETECTOwner="$$GITHUB_PUBLISH_OWNER"; \
	fi; \
	REMOTE_URL=$$(git remote get-url origin 2>/dev/null); \
	if [ -n "$$REMOTE_URL" ]; then \
		HOST=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?([^/]+).*#\2#'); \
		if [ -z "$$DETECTOwner" ]; then \
			DETECTOwner=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?[^/]+/([^/]+).*#\2#'); \
		fi; \
		if [ "$$HOST" = "github.com" ]; then \
			DETECTPlatform="github"; \
		else \
			DETECTPlatform="gitea"; \
		fi; \
	fi; \
	if [ -z "$$DETECTPlatform" ]; then \
		echo "ERROR: Cannot detect platform. Ensure git remote is configured."; \
		exit 1; \
	fi; \
	mkdir -p .dist/$$DETECTPlatform/releases; \
	if [ -n "$$DETECTOwner" ]; then \
		cp package.json package.json.bak && \
		node -e "var p=require('./package.json');p.name='@$$DETECTOwner/gitea-mcp';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"; \
	fi; \
	VERSION=$$(node -p "require('./package.json').version"); \
	npm pack --pack-destination .dist/$$DETECTPlatform/releases; \
	EXIT=$$?; \
	if [ -f package.json.bak ]; then \
		mv package.json.bak package.json; \
	fi; \
	cd .dist/$$DETECTPlatform/releases && \
	for f in *gitea-mcp-*.tgz; do \
		[ -f "$$f" ] && mv "$$f" "gitea-mcp-$$VERSION.tgz" 2>/dev/null; \
	done; \
	exit $$EXIT

publish:
	@DETECTPlatform=""; DETECTOwner=""; \
	if [ -n "$$GITHUB_PUBLISH_OWNER" ]; then \
		DETECTOwner="$$GITHUB_PUBLISH_OWNER"; \
	fi; \
	REMOTE_URL=$$(git remote get-url origin 2>/dev/null); \
	if [ -n "$$REMOTE_URL" ]; then \
		HOST=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?([^/]+).*#\2#'); \
		if [ -z "$$DETECTOwner" ]; then \
			DETECTOwner=$$(echo "$$REMOTE_URL" | sed -E 's#^https?://([^@]*@)?[^/]+/([^/]+).*#\2#'); \
		fi; \
		if [ "$$HOST" = "github.com" ]; then \
			DETECTPlatform="github"; \
		else \
			DETECTPlatform="gitea"; \
		fi; \
	fi; \
	if [ -z "$$DETECTPlatform" ] || [ -z "$$DETECTOwner" ]; then \
		echo "ERROR: Cannot determine platform/owner. Set GITHUB_PUBLISH_OWNER env var or ensure git remote is configured."; \
		exit 1; \
	fi; \
	if [ "$$DETECTPlatform" = "github" ]; then \
		[ -n "$$GITHUB_PUBLISH_TOKEN" ] || { echo "ERROR: GITHUB_PUBLISH_TOKEN is required for GitHub publishing"; exit 1; }; \
		npm publish --registry https://npm.pkg.github.com \
			--//npm.pkg.github.com/:_authToken="$$GITHUB_PUBLISH_TOKEN" \
			.dist/github/releases/gitea-mcp-*.tgz; \
	else \
		[ -n "$$GITEA_PUBLISH_TOKEN" ] || { echo "ERROR: GITEA_PUBLISH_TOKEN is required for Gitea publishing"; exit 1; }; \
		[ -n "$$GITEA_PUBLISH_URL" ]   || { echo "ERROR: GITEA_PUBLISH_URL is required for Gitea publishing"; exit 1; }; \
		npm config set "@$$DETECTOwner:registry" "$$GITEA_PUBLISH_URL"; \
		REGISTRY_HOST=$$(echo "$$GITEA_PUBLISH_URL" | sed 's|^https\?://||'); \
		npm publish --//"$$REGISTRY_HOST":_authToken="$$GITEA_PUBLISH_TOKEN" \
			.dist/gitea/releases/gitea-mcp-*.tgz; \
		npm config delete "@$$DETECTOwner:registry"; \
	fi; \
	echo "Published."
