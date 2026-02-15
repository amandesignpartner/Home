import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find style attributes that have nested double quotes in url()
broken_patterns = re.findall(r'style="[^"]*url\("images/.*?\.webp"\)[^"]*"', content)

if broken_patterns:
    print(f"Found {len(broken_patterns)} broken patterns:")
    for p in broken_patterns:
        print(p)
else:
    print("No broken patterns found.")
