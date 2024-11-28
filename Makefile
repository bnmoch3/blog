.SILENT:
.DEFAULT_GOAL:=help
.PHONY: help clean

init:
	git submodule init
	git submodule update

help:
	echo "check Makefile for various commands"

clean:
	rm -r public/*

build:
	hugo --minify

dev:
	hugo server --disableFastRender -D --destination build/dev
