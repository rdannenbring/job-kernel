import zipfile
import os
import sys
from lxml import etree

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'v': 'urn:schemas-microsoft-com:vml'
}

def count_elements(docx_path, tag_names):
    """
    Counts occurrences of specific tags in the document.xml of a DOCX file.
    tag_names: list of tags to count (e.g., ['w:drawing', 'mc:AlternateContent'])
    """
    counts = {tag: 0 for tag in tag_names}
    
    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            xml_content = z.read('word/document.xml')
            root = etree.fromstring(xml_content)
            
            for tag in tag_names:
                # Handle namespace prefixes manually if needed, but xpath with namespaces is better
                # We interpret 'w:drawing' using the map
                found = root.findall(f'.//{tag}', NAMESPACES)
                counts[tag] = len(found)
                
    except Exception as e:
        print(f"Error processing {docx_path}: {e}")
        return None
        
    return counts

def verify_preservation(original_path, generated_path):
    print(f"--- XML Preservation Verification ---")
    print(f"Original:  {os.path.basename(original_path)}")
    print(f"Generated: {os.path.basename(generated_path)}")
    
    # Elements that represent complex formatting/shapes
    critical_tags = ['w:drawing', 'mc:AlternateContent', 'w:pict', 'w:object']
    
    org_counts = count_elements(original_path, critical_tags)
    gen_counts = count_elements(generated_path, critical_tags)
    
    if not org_counts or not gen_counts:
        print("Failed to parse files.")
        return False
        
    success = True
    print("\nElement Counts:")
    print(f"{'Tag':<20} | {'Original':<8} | {'Generated':<9} | {'Status'}")
    print("-" * 60)
    
    for tag in critical_tags:
        org = org_counts[tag]
        gen = gen_counts[tag]
        
        # We expect generated to have AT LEAST as many as original 
        # (usually equal, unless we added something, but definitely don't lose any)
        match = gen >= org
        status = "✅ PASS" if match else "❌ FAIL"
        if not match:
            success = False
            
        print(f"{tag:<20} | {org:<8} | {gen:<9} | {status}")
        
    print("-" * 60)
    if success:
        print("RESULT: Formatting structure appears PRESERVED.")
    else:
        print("RESULT: POTENTIAL DATA LOSS DETECTED.")
        
    return success

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python verify_preservation.py <original_docx> <generated_docx>")
        sys.exit(1)
        
    orig = sys.argv[1]
    gen = sys.argv[2]
    
    if not os.path.exists(orig):
        print(f"Original file not found: {orig}")
        sys.exit(1)
    if not os.path.exists(gen):
        print(f"Generated file not found: {gen}")
        sys.exit(1)
        
    verify_preservation(orig, gen)
