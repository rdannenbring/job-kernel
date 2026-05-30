
with open('/home/rdannenbring/Development/JobApplicationAutomator/frontend/src/pages/ApplicationLifecycle.jsx', 'r') as f:
    content = f.read()

brace_stack = []
paren_stack = []

for i, char in enumerate(content):
    if char == '{':
        brace_stack.append(i)
    elif char == '}':
        if not brace_stack:
            print(f"Extra brace at index {i}")
        else:
            brace_stack.pop()
    elif char == '(':
        paren_stack.append(i)
    elif char == ')':
        if not paren_stack:
            print(f"Extra paren at index {i}")
        else:
            paren_stack.pop()

if brace_stack:
    print(f"Unclosed braces at indices: {brace_stack}")
if paren_stack:
    print(f"Unclosed parens at indices: {paren_stack}")
