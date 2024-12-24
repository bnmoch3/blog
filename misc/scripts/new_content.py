import os
import argparse
import sys
from datetime import datetime


def init_content(title, year, month, content_type, content_types_to_dir):
    # get base dir to place new content
    base_dir = f"content/{content_types_to_dir[content_type]}"

    # ensure base dir exists
    if not os.path.exists(base_dir):
        sys.exit(f"Error: directory '{base_dir}' does not exist")
        return

    # create content dir if not exists
    dir_name = f"{year}_{month:02d}_{title.replace(' ', '_')}".lower()
    dir_path = os.path.join(base_dir, dir_name)
    os.makedirs(dir_path, exist_ok=True)

    # path to the index.md file
    index_file_path = os.path.join(dir_path, "index.md")

    # Populate the frontmatter
    date = datetime.now().strftime("%Y-%m-%d")
    slug = title.replace(" ", "-").lower()
    frontmatter = f"""+++
title = "{title}"
date = "{date}"
summary = ""
tags = []
type = "{content_type}"
toc = false
readTime = true
autonumber = false
showTags = true
slug = "{slug}"
+++

"""

    # Write the frontmatter to the index.md file
    with open(index_file_path, "w") as f:
        f.write(frontmatter)

    print(f"New {content_type} created")
    print(f"\ttitle:\t{title}")
    print(f"\tdir:\t{dir_name}")
    print(f"\tslug:\t{slug}")
    print(f"\tpath:\t{index_file_path}")


def main():
    content_types_to_dir = {"post": "posts", "note": "notes"}
    content_types = list(content_types_to_dir.keys())
    parser = argparse.ArgumentParser(description="Create new post/note.")
    parser.add_argument(
        "--title", help="Working title (usef for slug & directory name)"
    )
    parser.add_argument(
        "--type",
        choices=content_types,
        help="Content Type",
    )
    parser.add_argument("--year", type=int, help="Publish year")
    parser.add_argument("--month", type=int, help="Publish month")

    args = parser.parse_args()

    # get title
    title = (args.title or input("Enter working title: ")).strip()
    if title == "":
        sys.exit("Error: empty title")

    # get content type
    content_type = args.type or input("Enter content type(post/note): ")
    if content_type not in content_types:
        sys.exit(
            f"Error: invalid content type, should be one of: {content_types}"
        )

    # get date
    now = datetime.now()
    year = args.year or now.year
    month = args.month or now.month

    init_content(title, year, month, content_type, content_types_to_dir)


if __name__ == "__main__":
    main()
