async function testOllama() {
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen3-coder:480b-cloud',
                prompt: `Transform the given C++ code from one data structure to another while preserving behavior.

Rules:
- Do not break logic
- Update all usage patterns (push_back, indexing, iteration)
- If conversion is unsafe, return warning instead
- Output STRICT JSON matching this schema:
{
  "new_code": "string",
  "changes": ["string"],
  "warnings": ["string"]
}

Current Data Structure: std::vector
Target Data Structure: std::unordered_map

Original Code:
\`\`\`cpp
std::vector<int> myData;
for (int i = 0; i < 100; ++i) {
    myData.push_back(i);
}
\`\`\`
`,
                stream: false,
                format: 'json'
            })
        });

        const data = await response.json();
        console.log("Raw Response:");
        console.log(data.response);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}
testOllama();
