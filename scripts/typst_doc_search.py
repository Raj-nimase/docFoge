import os
import sys
import json
import argparse
import pypdf

# Ensure standard output uses UTF-8 encoding on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_PATH = os.path.join(BASE_DIR, "typst-documentation.pdf")
INDEX_PATH = os.path.join(BASE_DIR, ".agentMemory", "typst_doc_index.json")

def build_index():
    if not os.path.exists(PDF_PATH):
        print(f"Error: PDF file not found at {PDF_PATH}")
        sys.exit(1)

    print(f"Building search index from {PDF_PATH}...")
    reader = pypdf.PdfReader(PDF_PATH)
    total_pages = len(reader.pages)
    print(f"Total pages to process: {total_pages}")

    pages_data = []
    
    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        try:
            text = page.extract_text() or ""
        except Exception as e:
            text = ""
        
        # Clean text
        text_clean = " ".join(text.split())
        if text_clean:
            pages_data.append({
                "page": page_num,
                "text": text_clean
            })
            
        if page_num % 100 == 0 or page_num == total_pages:
            print(f"Indexed {page_num}/{total_pages} pages...")

    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "total_pages": total_pages,
            "pages": pages_data
        }, f, ensure_ascii=False, indent=2)

    print(f"Index successfully built and saved to {INDEX_PATH} ({len(pages_data)} pages indexed).")

def load_index():
    if not os.path.exists(INDEX_PATH):
        print("Index not found. Building now...")
        build_index()
    
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def search_query(query, max_results=10):
    data = load_index()
    query_lower = query.lower()
    results = []

    for page_item in data.get("pages", []):
        text = page_item["text"]
        text_lower = text.lower()
        if query_lower in text_lower:
            # Find match positions
            pos = text_lower.find(query_lower)
            start = max(0, pos - 100)
            end = min(len(text), pos + 200)
            snippet = text[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(text):
                snippet = snippet + "..."
            
            results.append({
                "page": page_item["page"],
                "snippet": snippet,
                "full_text": text
            })
            if len(results) >= max_results:
                break

    return results

def main():
    parser = argparse.ArgumentParser(description="Typst Documentation Search CLI")
    parser.add_argument("--build-index", action="store_true", help="Rebuild index from PDF")
    parser.add_argument("--query", "-q", type=str, help="Search term to query in Typst documentation")
    parser.add_argument("--max", "-m", type=int, default=5, help="Max results to display")
    
    args = parser.parse_args()

    if args.build_index:
        build_index()
        return

    if args.query:
        print(f"Searching Typst Documentation for: '{args.query}'...\n")
        matches = search_query(args.query, max_results=args.max)
        if not matches:
            print("No matches found.")
            return

        print(f"Found {len(matches)} relevant sections/pages:\n")
        for idx, match in enumerate(matches, 1):
            print(f"[{idx}] Page {match['page']}:")
            print(f"    {match['snippet']}")
            print("-" * 60)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
