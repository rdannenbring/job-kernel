from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from typing import Dict, Any, List
import json
import re
import zipfile
import shutil
import os
from lxml import etree
import tempfile


class DocumentService:
    """Service for document parsing and generation."""
    
    @staticmethod
    def sanitize_text(text: str) -> str:
        """
        Sanitize text to be XML/DOCX compatible by removing control characters.
        Keeps only valid Unicode characters and common whitespace.
        """
        if not isinstance(text, str):
            return str(text)
        
        # Remove control characters except tab, newline, and carriage return
        # XML 1.0 valid characters: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD]
        cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', text)
        
        # Also remove any null bytes that might have slipped through
        cleaned = cleaned.replace('\x00', '')
        
        return cleaned
    
    def parse_docx(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a DOCX file and extract structured content.
        """
        doc = Document(file_path)
        
        resume_data = {
            "sections": [],
            "full_text": [],
            "formatting": {
                "font": None,
                "has_tables": False
            }
        }
        
        current_section = None
        
        for para in doc.paragraphs:
            text = para.text.strip()
            
            if not text:
                continue
            
            resume_data["full_text"].append(text)
            
            # Detect section headers (usually bold or larger font)
            is_header = False
            if para.runs:
                first_run = para.runs[0]
                if first_run.bold or (first_run.font.size and first_run.font.size >= Pt(14)):
                    is_header = True
            
            if is_header:
                # Start new section
                if current_section:
                    resume_data["sections"].append(current_section)
                current_section = {
                    "title": text,
                    "content": []
                }
            else:
                # Add to current section
                if current_section:
                    current_section["content"].append(text)
                else:
                    # Create a default section if none exists
                    current_section = {
                        "title": "Header",
                        "content": [text]
                    }
        
        # Add last section
        if current_section:
            resume_data["sections"].append(current_section)
        
        # Check for tables
        if doc.tables:
            resume_data["formatting"]["has_tables"] = True
            for table in doc.tables:
                table_data = []
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells]
                    table_data.append(row_data)
                resume_data["sections"].append({
                    "title": "Table",
                    "type": "table",
                    "content": table_data
                })
        
        return resume_data
    
    def create_docx_with_xml_preservation(self, original_file_path: str, resume_data: Dict[str, Any], output_path: str):
        """
        Create a DOCX file using XML-level manipulation to preserve ALL elements including shapes and backgrounds.
        This works by manipulating the document.xml directly without using python-docx's save method.
        """
        # DOCX files are ZIP archives containing XML files
        # Extract, modify XML, and repackage
        
        # Create a temporary directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract the original DOCX
            with zipfile.ZipFile(original_file_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Path to the main document XML
            document_xml_path = os.path.join(temp_dir, 'word', 'document.xml')
            
            # Parse the XML
            parser = etree.XMLParser(remove_blank_text=False)
            tree = etree.parse(document_xml_path, parser)
            root = tree.getroot()
            
            # Define namespaces
            namespaces = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
                'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
                'wpc': 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
                'cx': 'http://schemas.microsoft.com/office/drawing/2014/chartex',
                'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
                'o': 'urn:schemas-microsoft-com:office:office',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'v': 'urn:schemas-microsoft-com:vml',
                'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
                'wp14': 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
                'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
            }
            
            # Get full text from resume data
            full_text_items = resume_data.get("full_text", [])
            
            if not full_text_items:
                # Fallback
                full_text_items = []
                for section in resume_data.get("sections", []):
                    if section.get("type") == "table":
                        continue
                    if section.get("title"):
                        full_text_items.append(section["title"])
                    for item in section.get("content", []):
                        if item:
                            full_text_items.append(str(item))
            
            # Collect all paragraph elements from both headers and main document
            all_paragraphs = []
            header_trees = {}  # Track header trees by file path
            
            # Process headers first (header1.xml, header2.xml, etc.)
            word_dir = os.path.join(temp_dir, 'word')
            header_files = sorted([f for f in os.listdir(word_dir) if f.startswith('header') and f.endswith('.xml')])
            
            for header_file in header_files:
                header_path = os.path.join(word_dir, header_file)
                header_tree = etree.parse(header_path, parser)
                header_trees[header_path] = header_tree  # Save the tree
                header_root = header_tree.getroot()
                header_paragraphs = header_root.findall('.//w:p', namespaces)
                
                for para in header_paragraphs:
                    text_content = ''
                    for t_elem in para.findall('.//w:t', namespaces):
                        if t_elem.text:
                            text_content += t_elem.text
                    
                    if text_content.strip():
                        all_paragraphs.append((para, header_path))
            
            # Then process main document paragraphs
            paragraphs = root.findall('.//w:p', namespaces)
            for para in paragraphs:
                text_content = ''
                for t_elem in para.findall('.//w:t', namespaces):
                    if t_elem.text:
                        text_content += t_elem.text
                
                if text_content.strip():
                    all_paragraphs.append((para, document_xml_path))
            
            # Check if counts match
            if len(all_paragraphs) != len(full_text_items):
                print(f"⚠️  Warning: XML paragraph count mismatch!")
                print(f"   Original: {len(all_paragraphs)} paragraphs (headers + body)")
                print(f"   AI Generated: {len(full_text_items)} text items")
                print(f"   Falling back to standard method.")
                # Fall back
                self.create_docx_preserve_formatting(original_file_path, resume_data, output_path)
                return
            
            # Track which files have been modified
            modified_files = set()
            
            # Update each paragraph's text
            for (para, para_file), new_text in zip(all_paragraphs, full_text_items):
                sanitized_text = self.sanitize_text(str(new_text))
                
                # Find all text runs in this paragraph
                text_runs = para.findall('.//w:r', namespaces)
                
                if not text_runs:
                    continue
                
                # Check for colon pattern (bold before colon, normal after)
                has_colon_pattern = ':' in sanitized_text and len(text_runs) > 1
                
                if has_colon_pattern:
                    # Split at colon
                    parts = sanitized_text.split(':', 1)
                    if len(parts) == 2:
                        label_part = parts[0] + ':'
                        content_part = parts[1]
                        
                        # Update first run with label
                        first_t = text_runs[0].find('.//w:t', namespaces)
                        if first_t is not None:
                            first_t.text = label_part
                        
                        # Clear other runs except the second one
                        for i, run in enumerate(text_runs):
                            t_elem = run.find('.//w:t', namespaces)
                            if t_elem is not None:
                                if i == 1:
                                    t_elem.text = content_part
                                elif i > 1:
                                    t_elem.text = ""
                    else:
                        # Couldn't split, use first run only
                        first_t = text_runs[0].find('.//w:t', namespaces)
                        if first_t is not None:
                            first_t.text = sanitized_text
                        # Clear others
                        for run in text_runs[1:]:
                            t_elem = run.find('.//w:t', namespaces)
                            if t_elem is not None:
                                t_elem.text = ""
                else:
                    # Simple case: put all text in first run
                    first_t = text_runs[0].find('.//w:t', namespaces)
                    if first_t is not None:
                        first_t.text = sanitized_text
                    
                    # Clear other runs
                    for run in text_runs[1:]:
                        t_elem = run.find('.//w:t', namespaces)
                        if t_elem is not None:
                            t_elem.text = ""
                
                # Mark this file as modified
                modified_files.add(para_file)
            
            # Write all modified XML files back
            for file_path in modified_files:
                if file_path == document_xml_path:
                    tree.write(file_path, xml_declaration=True, encoding='UTF-8', standalone=True)
                elif file_path in header_trees:
                    header_trees[file_path].write(file_path, xml_declaration=True, encoding='UTF-8', standalone=True)
            
            # Repackage as DOCX
            with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as docx:
                for folder_name, subfolders, filenames in os.walk(temp_dir):
                    for filename in filenames:
                        file_path = os.path.join(folder_name, filename)
                        arcname = os.path.relpath(file_path, temp_dir)
                        docx.write(file_path, arcname)
            
            print(f"✓ Successfully updated {len(text_paragraphs)} paragraphs with XML-level preservation")
    
    def create_docx_preserve_formatting(self, original_file_path: str, resume_data: Dict[str, Any], output_path: str):
        """
        Create a DOCX file by copying the original and updating text paragraph-by-paragraph.
        This preserves ALL formatting: fonts, colors, spacing, styles, alignment, etc.
        """
        import shutil
        
        # Copy the original file to the output path first
        shutil.copy2(original_file_path, output_path)
        
        # Now open the copied document
        doc = Document(output_path)
        
        # Get full text from AI-generated resume in order
        full_text_items = resume_data.get("full_text", [])
        
        if not full_text_items:
            print("⚠️  Warning: No full_text in resume_data, falling back to sections")
            # Fallback: build from sections
            full_text_items = []
            for section in resume_data.get("sections", []):
                if section.get("type") == "table":
                    continue
                if section.get("title"):
                    full_text_items.append(section["title"])
                for item in section.get("content", []):
                    if item:
                        full_text_items.append(str(item))
        
        # Get all non-empty paragraphs from the original
        original_paragraphs = []
        for para in doc.paragraphs:
            if para.text.strip():
                original_paragraphs.append(para)
        
        # Check if counts match
        if len(original_paragraphs) != len(full_text_items):
            print(f"⚠️  Warning: Paragraph count mismatch!")
            print(f"   Original: {len(original_paragraphs)} paragraphs")
            print(f"   AI Generated: {len(full_text_items)} text items")
            print(f"   Using fallback method.")
            # Recreate fresh document
            self.create_docx(resume_data, output_path)
            return
        
        # Update each paragraph's text while keeping its formatting
        for para, new_text in zip(original_paragraphs, full_text_items):
            # Sanitize the new text
            sanitized_text = self.sanitize_text(str(new_text))
            
            # Check if the paragraph has a pattern like "Bold: Normal" (e.g., Core Competencies)
            # This is indicated by multiple runs or a colon in the text
            has_colon_pattern = ':' in sanitized_text and len(para.runs) > 1
            
            if has_colon_pattern:
                # Handle multi-run formatting (e.g., "Leadership & Strategy: IT Roadmap Development...")
                # Split at the colon to preserve bold/normal pattern
                parts = sanitized_text.split(':', 1)
                if len(parts) == 2:
                    label_part = parts[0] + ':'  # Include the colon in the bold part
                    content_part = parts[1]
                    
                    # Check if first run is bold
                    first_run_bold = para.runs[0].bold if para.runs[0].bold is not None else False
                    
                    if first_run_bold:
                        # Clear all runs
                        for run in para.runs:
                            run.text = ""
                        
                        # Use first run for bold label
                        para.runs[0].text = label_part
                        
                        # Add second run for normal content if we have multiple runs
                        if len(para.runs) > 1:
                            para.runs[1].text = content_part
                        else:
                            # Create a new run with normal (non-bold) formatting
                            new_run = para.add_run(content_part)
                            if para.runs[0].font.name:
                                new_run.font.name = para.runs[0].font.name
                            if para.runs[0].font.size:
                                new_run.font.size = para.runs[0].font.size
                            new_run.bold = False
                    else:
                        # Not a bold pattern, treat normally
                        para.runs[0].text = sanitized_text
                        for run in para.runs[1:]:
                            run.text = ""
                else:
                    # Couldn't split properly, use default behavior
                    para.runs[0].text = sanitized_text
                    for run in para.runs[1:]:
                        run.text = ""
            else:
                # Single-run paragraph or no colon pattern
                if para.runs:
                    # Update the first run with all the text
                    para.runs[0].text = sanitized_text
                    # Clear other runs
                    for run in para.runs[1:]:
                        run.text = ""
                else:
                    # No runs, just set paragraph text
                    para.text = sanitized_text
        
        # Save the document
        doc.save(output_path)
        print(f"✓ Successfully updated {len(original_paragraphs)} paragraphs with preserved formatting")
    
    def create_docx(self, resume_data: Dict[str, Any], output_path: str):
        """
        Create a DOCX file from structured resume data.
        """
        doc = Document()
        
        # Set document margins
        sections = doc.sections
        for section in sections:
            section.top_margin = Inches(0.5)
            section.bottom_margin = Inches(0.5)
            section.left_margin = Inches(0.75)
            section.right_margin = Inches(0.75)
        
        # Process sections
        sections_data = resume_data.get("sections", [])
        
        for section in sections_data:
            title = section.get("title", "")
            content = section.get("content", [])
            section_type = section.get("type", "text")
            
            if section_type == "table":
                # Handle tables
                if isinstance(content, list) and content:
                    table = doc.add_table(rows=len(content), cols=len(content[0]))
                    table.style = 'Light Grid Accent 1'
                    
                    for i, row_data in enumerate(content):
                        row = table.rows[i]
                        for j, cell_text in enumerate(row_data):
                            row.cells[j].text = self.sanitize_text(str(cell_text))
            else:
                # Add section title
                if title:
                    heading = doc.add_paragraph(self.sanitize_text(title))
                    heading.runs[0].bold = True
                    heading.runs[0].font.size = Pt(14)
                    heading.runs[0].font.color.rgb = RGBColor(0, 0, 0)
                
                # Add section content
                for item in content:
                    if item:
                        para = doc.add_paragraph(self.sanitize_text(str(item)))
                        para.runs[0].font.size = Pt(11)
        
        doc.save(output_path)
    
    def create_pdf(self, resume_data: Dict[str, Any], output_path: str):
        """
        Create a PDF file from structured resume data.
        """
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )
        
        styles = getSampleStyleSheet()
        
        # Custom styles
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor='#000000',
            spaceAfter=12,
            bold=True
        )
        
        body_style = ParagraphStyle(
            'CustomBody',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=6
        )
        
        story = []
        
        sections_data = resume_data.get("sections", [])
        
        for section in sections_data:
            title = section.get("title", "")
            content = section.get("content", [])
            section_type = section.get("type", "text")
            
            if section_type != "table":
                # Add section title
                if title:
                    story.append(Paragraph(self.sanitize_text(title), heading_style))
                    story.append(Spacer(1, 0.1*inch))
                
                # Add section content
                for item in content:
                    if item:
                        story.append(Paragraph(self.sanitize_text(str(item)), body_style))
        
        doc.build(story)
    
    def create_txt(self, resume_data: Dict[str, Any], output_path: str):
        """
        Create a plain text file from structured resume data.
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            sections_data = resume_data.get("sections", [])
            
            for section in sections_data:
                title = section.get("title", "")
                content = section.get("content", [])
                section_type = section.get("type", "text")
                
                if section_type != "table":
                    # Add section title
                    if title:
                        sanitized_title = self.sanitize_text(title)
                        f.write(f"\n{sanitized_title.upper()}\n")
                        f.write("=" * len(sanitized_title) + "\n\n")
                    
                    # Add section content
                    for item in content:
                        if item:
                            f.write(f"{self.sanitize_text(str(item))}\n")
                    
                    f.write("\n")
