.PHONY: all install lint build build-assets assets test test-watch test-integration coverage smoke scan clean dev package publish verify

all: lint build

install:
	npm ci

lint:
	npm run lint

build:
	npm run build

build-assets:
	npm run build:assets

assets: build-assets

test:
	npm test

test-watch:
	npm run test:watch

test-integration:
	npm run test:integration

coverage:
	npm run test:coverage

smoke: build
	npm run smoke

scan:
	@mkdir -p .dist
	npm run scan

clean:
	rm -rf dist .dist

dev:
	npm run dev

verify: install scan lint build test smoke

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
