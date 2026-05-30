
with open('/home/rdannenbring/Development/JobApplicationAutomator/frontend/src/pages/ApplicationLifecycle.jsx', 'r') as f:
    lines = f.readlines()

start = 1026
end = 2738

content = "".join(lines[start-1:end])

brace_count = 0
paren_count = 0

for i, char in enumerate(content):
    if char == '{':
        brace_count += 1
    elif char == '}':
        brace_count -= 1
    elif char == '(':
        paren_count += 1
    elif char == ')':
        paren_count -= 1

print(f"Brace count: {brace_count}")
print(f"Paren count: {paren_count}")
