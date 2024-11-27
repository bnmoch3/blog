.SILENT:
.DEFAULT_GOAL:=help
.PHONY: help clean

help:
	echo "check Makefile for various commands"

clean:
	rm -r public/*

dev:
	hugo server --disableFastRender -D
