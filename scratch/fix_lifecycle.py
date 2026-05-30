
import sys
import re

file_path = 'frontend/src/pages/ApplicationLifecycle.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# Define the correct useEffect block
correct_block = """  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const main = document.querySelector('main');
    const grid = document.querySelector('.substage-grid');
    if (main && grid) {
      setTimeout(() => {
        main.scrollTo({
          top: grid.getBoundingClientRect().top + main.scrollTop - 135,
          behavior: 'smooth'
        });
      }, 50);
    }
  }, [activeSubStage]);"""

# Pattern to match the broken useEffect blocks
# We'll look for the beginning of the block and the end.
# It starts after "const [activeSubStage, setActiveSubStage] = useState(...);"
# and ends with "}, [activeSubStage]);"

# This is a bit risky if there are other activeSubStage effects, but in this file they are all standard.
# We'll find the blocks that have "grid.getBoundingClientRect().top" inside them.

def fix_blocks(text):
    # Find all occurrences of the pattern
    # We'll use a non-greedy match between "useEffect(() => {" and "}, [activeSubStage]);"
    pattern = r'useEffect\(\(\) => \{.*?\}, \[activeSubStage\]\);'
    
    def replacement(match):
        # Double check if it contains the grid logic to avoid replacing unrelated effects
        if 'getBoundingClientRect' in match.group(0) or 'scrollTo' in match.group(0):
            return correct_block
        return match.group(0)

    return re.sub(pattern, replacement, text, flags=re.DOTALL)

new_content = fix_blocks(content)

with open(file_path, 'w') as f:
    f.write(new_content)

print("Successfully fixed all blocks.")
