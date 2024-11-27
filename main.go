package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
	"gopkg.in/yaml.v3"
)

type frontMatter struct {
	title      string
	slug       string
	categories []string
	postType   string
}

type blogPost struct {
	frontMatter frontMatter
	dateStr     string
	excerpt     string
	body        string
}

func parseBlogPost(text string) (blogPost, error) {
	bp := blogPost{}

	// Extract YAML front matter
	yamlRegex := regexp.MustCompile(`(?s)^---(.*?)---`)
	yamlMatches := yamlRegex.FindStringSubmatch(text)
	if len(yamlMatches) < 2 {
		return bp, fmt.Errorf("YAML front matter not found")
	}
	frontMatterStr := strings.TrimSpace(yamlMatches[1])
	type YamlFrontMatter struct {
		Title            string   `yaml:"title"`
		Slug             string   `yaml:"slug"`
		Layout           string   `yaml:"layout"`
		ExcerptSeparator string   `yaml:"excerpt_separator"`
		Category         string   `yaml:"category"`
		Categories       string   `yaml:"categories"`
		Tag              []string `yaml:"tag"`
		Type             string   `yaml:"type"`
	}
	var yfm YamlFrontMatter
	err := yaml.Unmarshal([]byte(frontMatterStr), &yfm)
	if err != nil {
		return bp, fmt.Errorf("unable to parse yaml frontmatter: %w", err)
	}
	var fm frontMatter
	fm.title = yfm.Title
	fm.slug = yfm.Slug
	if yfm.Category != "" {
		fm.categories = []string{yfm.Category}
	} else {
		fm.categories = strings.Fields(yfm.Categories)
	}
	if yfm.Type != "" {
		fm.postType = yfm.Type
	} else {
		fm.postType = "note"
	}
	bp.frontMatter = fm

	// Extract excerpt and rest of body
	contentAfterYAML := text[len(yamlMatches[0]):] // Skip the front matter
	parts := strings.SplitN(contentAfterYAML, "<!--start-->", 2)
	if len(parts) < 2 {
		return bp, fmt.Errorf("content separator <!--start--> not found")
	}
	excerpt := strings.TrimSpace(parts[0])
	excerpt = regexp.MustCompile(`\s+`).ReplaceAllString(excerpt, " ")

	bp.excerpt = excerpt
	bp.body = strings.TrimSpace(parts[1])

	return bp, nil
}

func process(filePath string) (blogPost, error) {
	bp := blogPost{}
	// extract date from filepath
	re := regexp.MustCompile(`^.*/(\d{4}-\d{2}-\d{2}).*$`)
	matches := re.FindStringSubmatch(filePath)
	if len(matches) < 2 {
		return bp, fmt.Errorf("Unable to extract date from filePath: %s", filePath)
	}
	dateStr := matches[1]

	file, err := os.Open(filePath)
	if err != nil {
		return bp, fmt.Errorf("unable to open file %s: %w", filePath, err)
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return bp, fmt.Errorf("error on reading file %s: %w", filePath, err)
	}
	bp, err = parseBlogPost(string(content))
	if err != nil {
		return bp, fmt.Errorf("on parse blog post (%s): %w", filePath, err)
	}
	bp.dateStr = dateStr
	return bp, err
}

type HugoFrontMatter struct {
	Title      string   `toml:"title"`
	Date       string   `toml:"date"`
	Summary    string   `toml:"summary"`
	Tags       []string `toml:"tags"`
	Type       string   `toml:"type"`
	TOC        bool     `toml:"toc"`
	ReadTime   bool     `toml:"readTime"`
	AutoNumber bool     `toml:"autonumber"`
	ShowTags   bool     `toml:"showTags"`
	Slug       string   `toml:"slug"`
}

func NewHugoFrontMatter(title string) *HugoFrontMatter {
	currentDate := time.Now().Format("2006-01-02")
	return &HugoFrontMatter{
		Title:    title,
		Date:     currentDate,
		ReadTime: true,
	}
}

func (bp *blogPost) generateHugoFrontmatter() *HugoFrontMatter {
	fm := bp.frontMatter
	hfm := &HugoFrontMatter{
		Title:    fm.title,
		Slug:     fm.slug,
		Date:     bp.dateStr,
		Summary:  bp.excerpt,
		Tags:     fm.categories,
		Type:     fm.postType,
		ReadTime: true,
	}
	return hfm
}

func getBlogContent(bp *blogPost, buf *bytes.Buffer) error {
	buf.Reset()
	buf.WriteString("+++\n")
	err := toml.NewEncoder(buf).Encode(bp.generateHugoFrontmatter())
	if err != nil {
		return err
	}
	buf.WriteString("+++\n\n")
	buf.WriteString(bp.body)
	return nil
}

func getBlogDirname(filename string) (string, error) {
	re := regexp.MustCompile(`^(\d{4})-(\d{2})-\d{2}-(.*)\.md$`)
	matches := re.FindStringSubmatch(filename)
	if len(matches) < 4 {
		return "", fmt.Errorf("Unable to get dirname: %s", filename)
	}
	year := matches[1]
	month := matches[2]
	currName := strings.ReplaceAll(matches[3], "-", "_")
	name := fmt.Sprintf("%s_%s_%s", year, month, currName)
	return name, nil
}

func writeOutBlogPost(dir string, currFilename string, bp *blogPost) error {
	var content bytes.Buffer
	err := getBlogContent(bp, &content)
	if err != nil {
		return err
	}
	blogDirname, err := getBlogDirname(currFilename)
	if err != nil {
		return err
	}
	subDir := "notes"
	if bp.frontMatter.postType == "post" {
		subDir = "posts"
	}
	blogPostDirpath := filepath.Join(dir, subDir, blogDirname)
	err = os.Mkdir(blogPostDirpath, os.ModePerm)
	if err != nil {
		return err
	}
	outFilePath := filepath.Join(blogPostDirpath, "index.md")
	file, err := os.Create(outFilePath)
	if err != nil {
		return err
	}
	var errOnClose error = nil
	defer func() {
		errOnClose = file.Close()
	}()
	_, err = content.WriteTo(file)
	if err != nil {
		return err
	}
	return errOnClose
}

func main() {
	dirName := "_posts"
	outDirName := "content"
	entries, err := os.ReadDir(dirName)
	if err != nil {
		panic(err)
	}
	i := 1
	for _, e := range entries {
		filename := e.Name()
		bp, err := process(filepath.Join(dirName, filename))
		if err != nil {
			panic(err)
		}
		err = writeOutBlogPost(outDirName, filename, &bp)
		if err != nil {
			panic(err)
		}
		i += 1
	}
}
