.SILENT:
.DEFAULT_GOAL:=help
.PHONY: help init publish dev clean add

help:
	echo "check Makefile for various commands"

init:
	git submodule init
	git submodule update

# builds into build/main and pushes the deploy repo; refuses unless CONFIRM=1
publish:
	if [ "$(CONFIRM)" != "1" ]; then echo "refusing to publish: run 'make publish CONFIRM=1'"; exit 1; fi
	hugo --minify # build public site
	cd build/main && git add . && git commit -m "Update site" && git push # publish

# runs local HTTP server, renders pages in memory only (never writes to
# build/main), watches files and hot-reloads on change, includes drafts (-D)
dev:
	hugo server --renderToMemory --disableFastRender -D

#  generates real static files, writes them to build/dev, inlcudes draft, but
#  no server nor watching
#  use it to inspect final HTML ouptut and test deploy steps locally
build-dev:
	hugo -D --destination build/dev

add:
	python misc/scripts/new_content.py

clean:
	git clean -Xdf build/dev/
