.PHONY: all install lint build test test-watch test-integration clean dev package publish verify

all: lint build

install:
	npm ci

lint:
	npm run lint

build:
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

verify: install lint test

package: build
	@VERSION=$$(node -p "require('./package.json').version"); \
	mkdir -p .dist/releases; \
	npm pack --pack-destination .dist/releases; \
	cd .dist/releases && \
	for f in *gitea-mcp-*.tgz; do \
		[ -f "$$f" ] && mv "$$f" "gitea-mcp-$$VERSION.tgz" 2>/dev/null; \
	done

publish:
	[ -n "$$NPM_TOKEN" ] || { echo "ERROR: NPM_TOKEN is required for npm publishing"; exit 1; }; \
	npm publish --access public

publish-dry-run:
	npm publish --dry-run --access public
