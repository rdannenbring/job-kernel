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
import math


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
        
        # Only process main document paragraphs (headers/footers are preserved automatically)
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
            
            # Collect all paragraph elements from main document ONLY
            # We explicitly SKIP headers/footers to preserve contact info/name
            all_paragraphs = []
            
            # Process main document paragraphs
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
                print(f"   Original: {len(all_paragraphs)} paragraphs (body only)")
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
                
                # Identify runs that actually contain text elements
                text_bearing_runs = []
                for run in text_runs:
                    t_elems = run.findall('.//w:t', namespaces)
                    if t_elems:
                        text_bearing_runs.append((run, t_elems))
                
                if not text_bearing_runs:
                    # If no existing text runs (maybe just a shape?), try to find ANY run to add text to
                    # or create a new run (complex), but typically we are replacing text so there should be text
                    continue
                
                # Check for colon pattern (bold before colon, normal after)
                has_colon_pattern = ':' in sanitized_text and len(text_bearing_runs) > 1
                
                if has_colon_pattern:
                    # Split at colon
                    parts = sanitized_text.split(':', 1)
                    if len(parts) == 2:
                        label_part = parts[0] + ':'
                        content_part = parts[1]
                        
                        # Update first text run with label
                        run, t_elems = text_bearing_runs[0]
                        if t_elems:
                            t_elems[0].text = label_part
                            # Clear extra text tags in this run if any
                            for t in t_elems[1:]:
                                t.text = ""
                        
                        # Update second text run with content
                        run, t_elems = text_bearing_runs[1]
                        if t_elems:
                            t_elems[0].text = content_part
                            for t in t_elems[1:]:
                                t.text = ""
                        
                        # Clear remaining text runs
                        for run, t_elems in text_bearing_runs[2:]:
                            for t in t_elems:
                                t.text = ""
                    else:
                        # Fallback to simple
                        has_colon_pattern = False
                
                if not has_colon_pattern:
                    # Simple case: put all text in first text-bearing run
                    run, t_elems = text_bearing_runs[0]
                    if t_elems:
                        t_elems[0].text = sanitized_text
                        for t in t_elems[1:]:
                            t.text = ""
                    
                    # Clear all other text-bearing runs
                    for run, t_elems in text_bearing_runs[1:]:
                        for t in t_elems:
                            t.text = ""
                
                # Mark this file as modified
                modified_files.add(para_file)
            
            # RESIZE HEADER BACKGROUND SHAPE LOGIC
            # Goal: Make the grey box cover the header text and end halfway to "EXECUTIVE SUMMARY"
            # 1. Find the index of "EXECUTIVE SUMMARY"
            exec_summary_idx = -1
            for i, text in enumerate(full_text_items):
                if "EXECUTIVE SUMMARY" in str(text).upper():
                    exec_summary_idx = i
                    break
            
            if exec_summary_idx > 0:
                # 2. Calculate "visual units" for all paragraphs before Exec Summary
                # Heuristic: 1 line ≈ 85 chars. Paragraph gap ≈ 0.8 line height.
                total_visual_lines = 0.0
                header_text_items = full_text_items[:exec_summary_idx]
                
                for text in header_text_items:
                    clean_text = str(text).strip()
                    if not clean_text: 
                        continue
                    
                    # Estimate wrapped lines (min 1)
                    lines = max(1, math.ceil(len(clean_text) / 85.0))
                    total_visual_lines += lines
                    # Add spacing for paragraph gap
                    total_visual_lines += 0.8
                
                # Add a little extra padding at the bottom (gap to Exec Summary)
                total_visual_lines += 0.5
                
                # 3. Convert to EMUs (English Metric Units)
                # Calibrated baseline: 2.36M EMUs for ~11 visual line units -> ~215,000 per unit
                estimated_height = int(total_visual_lines * 215000)
                
                # 4. Update the drawing object in the XML
                # Look for <wp:anchor ...> <wp:extent cy="...">
                # namespaces are needed
                drawings = root.findall('.//wp:anchor', namespaces)
                updated_shape = False
                for drawing in drawings:
                    # Check if this is likely the background shape (usually locked/behindDoc)
                    # or just the first/largest one.
                    # Or check extent: huge width, specific height range
                    extent = drawing.find('wp:extent', namespaces)
                    if extent is not None:
                        current_cx = int(extent.get('cx', 0))
                        # Width > 6 inches (5.4M EMUs) -> likely full width header
                        if current_cx > 5000000:
                            # Update extent height
                            extent.set('cy', str(estimated_height))
                            
                            # Also need to update the inner shape extent if present
                            # <a:graphic> ... <a:xfrm> <a:ext cx="..." cy="...">
                            graphic = drawing.find('.//a:graphic', namespaces)
                            if graphic is not None:
                                xfrm_ext = graphic.find('.//a:xfrm/a:ext', namespaces)
                                if xfrm_ext is not None:
                                    xfrm_ext.set('cy', str(estimated_height))
                            
                            updated_shape = True
                            print(f"   ℹ️  Auto-resize: Header Shape height adjusted to {estimated_height} EMUs (~{total_visual_lines:.1f} lines)")
                            modified_files.add(document_xml_path)
                            break
            
            # AUTO-FIT LOGIC: Adjust margins if text has grown significantly
            # Calculate total text length
            original_len = 0
            for para, _ in all_paragraphs:
                for t in para.findall('.//w:t', namespaces):
                    if t.text:
                        original_len += len(t.text)
            
            tailored_len = sum(len(str(t)) for t in full_text_items)
            
            # If tailored text is > 5% longer, try to squeeze margins
            if tailored_len > original_len * 1.05:
                # Determine reduction amount based on growth
                ratio = tailored_len / original_len
                # Max reduction = 720 twips (0.5 inch)
                # 10% growth -> 360 twips (0.25 inch)
                # 20% growth -> 720 twips
                reduction = int(min(720, (ratio - 1.0) * 10 * 360))
                
                # Check section properties (usually last element in body)
                sect_pr = root.find('.//w:body/w:sectPr', namespaces)
                if sect_pr is not None:
                    pg_mar = sect_pr.find('w:pgMar', namespaces)
                    if pg_mar is not None:
                        # Get current margins (default 1440 = 1 inch)
                        # We prioritize top/bottom reduction
                        top = int(pg_mar.get(f'{{{namespaces["w"]}}}top', 1440))
                        bottom = int(pg_mar.get(f'{{{namespaces["w"]}}}bottom', 1440))
                        left = int(pg_mar.get(f'{{{namespaces["w"]}}}left', 1440))
                        right = int(pg_mar.get(f'{{{namespaces["w"]}}}right', 1440))
                        
                        # Reduce Top/Bottom first
                        new_top = max(720, top - reduction)
                        new_bottom = max(720, bottom - reduction)
                        
                        # Reduce Left/Right only if needed (growth > 15%)
                        if ratio > 1.15:
                            reduction_lr = int(min(720, (ratio - 1.15) * 10 * 360))
                            new_left = max(720, left - reduction_lr)
                            new_right = max(720, right - reduction_lr)
                        else:
                            new_left = left
                            new_right = right
                            
                        # Apply new margins
                        pg_mar.set(f'{{{namespaces["w"]}}}top', str(new_top))
                        pg_mar.set(f'{{{namespaces["w"]}}}bottom', str(new_bottom))
                        pg_mar.set(f'{{{namespaces["w"]}}}left', str(new_left))
                        pg_mar.set(f'{{{namespaces["w"]}}}right', str(new_right))
                        
                        print(f"   ℹ️  Auto-fitting: Reduced margins (T/B: {top}->{new_top}, L/R: {left}->{new_left})")
                        modified_files.add(document_xml_path)

            # Write all modified XML files back
            for file_path in modified_files:
                if file_path == document_xml_path:
                    tree.write(file_path, xml_declaration=True, encoding='UTF-8', standalone=True)
            
            # Repackage as DOCX
            with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as docx:
                for folder_name, subfolders, filenames in os.walk(temp_dir):
                    for filename in filenames:
                        file_path = os.path.join(folder_name, filename)
                        arcname = os.path.relpath(file_path, temp_dir)
                        docx.write(file_path, arcname)
            
            print(f"✓ Successfully updated {len(all_paragraphs)} paragraphs with XML-level preservation")
    
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
