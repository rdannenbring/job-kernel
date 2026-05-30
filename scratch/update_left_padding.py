import sys

def update_left_padding():
    file_path = 'frontend/src/pages/ApplicationLifecycle.jsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Target 1: 3 instances (Generated, Saved, Applied panels)
    target_1 = "    padding: navCollapsed ? '0.875rem 0' : '0.875rem 1.25rem',"
    repl_1 = "    padding: navCollapsed ? '0.875rem 0' : '0.875rem 1.25rem 0.875rem 0.5rem',"

    count_1 = content.count(target_1)
    if count_1 > 0:
        content = content.replace(target_1, repl_1)
        print(f"Successfully updated {count_1} instances of navStyle padding for Generated/Saved/Applied panels to reduce left padding.")
    else:
        print("Warning: target_1 string not found.")

    # Target 2: 6 instances (Interviewing, Decision, Accepted, Rejected, Declined, Withdrawn panels)
    target_2 = """  const navStyle = (id) => ({
    padding: '1rem 1.25rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',"""

    repl_2 = """  const navStyle = (id) => ({
    padding: navCollapsed ? '1rem 0' : '1rem 1.25rem 1rem 0.5rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: navCollapsed ? 'center' : 'space-between',"""

    count_2 = content.count(target_2)
    if count_2 > 0:
        content = content.replace(target_2, repl_2)
        print(f"Successfully updated {count_2} instances of navStyle block for remaining 6 panels to reduce left padding and support responsive collapse centering.")
    else:
        print("Warning: target_2 block not found.")

    # Write changes back
    with open(file_path, 'w') as f:
        f.write(content)
    print("ApplicationLifecycle.jsx successfully updated with refined left padding!")

if __name__ == '__main__':
    update_left_padding()
