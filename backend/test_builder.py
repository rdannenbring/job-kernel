import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.document_service import DocumentService

# Mock tailor
import json

def test():
    ds = DocumentService()
    
    file_path = "Robert-Dannenbring-Resume-Base.docx"
    resume_data = ds.parse_docx(file_path)
    
    tailored_resume_data = resume_data.copy()
    tailored_resume_data["full_text"][4] = "This is a NEW TITLE!"
    print("AI returned:")
    for item in tailored_resume_data.get("full_text", [])[:10]:
        print(f" - {item}")
        
    output_path = "outputs/debug_tailored.docx"
    ds.create_docx_with_xml_preservation(
        file_path,
        tailored_resume_data,
        output_path
    )
    
    print("Checking DOCX output:")
    import docx
    c = docx.Document("outputs/debug_tailored.docx")
    for p in c.paragraphs[:10]:
        if p.text.strip():
            print(f" -> {p.text}")

if __name__ == "__main__":
    test()
