.SILENT:
.DEFAULT_GOAL:=help
.PHONY: help init publish dev clean

help:
	echo "check Makefile for various commands"

init:
	git submodule init
	git submodule update

publish:
	hugo --minify # build public site
	cd build/main && git add . && git commit -m "Update site" && git push # publish

dev:
	hugo server --disableFastRender -D --destination build/dev

clean:
	git clean -Xdf build/dev/
