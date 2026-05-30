import sys

def update_panel_heights():
    file_path = 'frontend/src/pages/ApplicationLifecycle.jsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Target 1: minHeight: '400px' block (Saved and Applied panels)
    target_400 = """      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '400px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>"""

    repl_400 = """      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: 'calc(100vh - 130px)',
        paddingBottom: '4rem',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>"""

    count_400 = content.count(target_400)
    if count_400 > 0:
        content = content.replace(target_400, repl_400)
        print(f"Successfully replaced {count_400} instances of minHeight: '400px' block with responsive viewport height and blank padding.")
    else:
        print("Warning: target_400 block not found.")

    # Target 2: minHeight: '600px' block (Interviewing, Decision, Accepted, Rejected, Declined, Withdrawn panels)
    target_600 = """      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: '600px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>"""

    repl_600 = """      <div style={{ 
        background: 'var(--bg-panel)', 
        borderRadius: '1.25rem', 
        padding: '2rem',
        border: '1px solid var(--border-color)',
        minHeight: 'calc(100vh - 130px)',
        paddingBottom: '4rem',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>"""

    count_600 = content.count(target_600)
    if count_600 > 0:
        content = content.replace(target_600, repl_600)
        print(f"Successfully replaced {count_600} instances of minHeight: '600px' block with responsive viewport height and blank padding.")
    else:
        print("Warning: target_600 block not found.")

    # Target 3: GeneratedSubStagePanel content wrapper
    target_gen = """      {/* Right: Content Panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </div>"""

    repl_gen = """      {/* Right: Content Panel */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 'calc(100vh - 130px)', paddingBottom: '4rem' }}>
        {renderContent()}
      </div>"""

    if target_gen in content:
        content = content.replace(target_gen, repl_gen)
        print("Successfully updated GeneratedSubStagePanel content wrapper with responsive viewport height and blank padding.")
    else:
        print("Warning: target_gen block not found.")

    # Write changes back
    with open(file_path, 'w') as f:
        f.write(content)
    print("ApplicationLifecycle.jsx successfully updated with dynamic bottom padding and heights!")

if __name__ == '__main__':
    update_panel_heights()
