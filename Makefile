.SILENT:
.DEFAULT_GOAL:=help
.PHONY: help serve

help:
	echo "check Makefile for various commands"

serve:
	bundle exec jekyll serve --trace --livereload
