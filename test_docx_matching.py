import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from services.document_service import DocumentService

ds = DocumentService()
print("Parsing Original...")
resume_data = ds.parse_docx("resources/Robert-Dannenbring-Resume.docx")

print(f"full_text items: {len(resume_data['full_text'])}")
for i, text in enumerate(resume_data['full_text'][:10]):
    print(f"  {i}: {text[:50]}...")

print("\nRunning XML prep step...")
import zipfile
import tempfile
from lxml import etree
with tempfile.TemporaryDirectory() as temp_dir:
    with zipfile.ZipFile("resources/Robert-Dannenbring-Resume.docx", 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    document_xml_path = os.path.join(temp_dir, 'word', 'document.xml')
    parser = etree.XMLParser(remove_blank_text=False)
    tree = etree.parse(document_xml_path, parser)
    root = tree.getroot()
    namespaces = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    }
    body = root.find('w:body', namespaces)
    if body is not None:
        paragraphs = body.findall('w:p', namespaces)
    else:
        paragraphs = []
    
    all_paragraphs = []
    for para in paragraphs:
        text_content = ''
        for t_elem in para.findall('.//w:t', namespaces):
            if t_elem.text:
                text_content += t_elem.text
        if text_content.strip():
            all_paragraphs.append((para, document_xml_path, text_content))

print(f"XML paragraphs containing text: {len(all_paragraphs)}")
for i, (para, pfile, text) in enumerate(all_paragraphs[:10]):
    print(f"  {i}: {text[:50]}...")
