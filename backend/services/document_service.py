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
import subprocess


class DocumentService:
    """Service for document parsing and generation."""
    
    @staticmethod
    def get_page_count(docx_path: str) -> int:
        """
        Get the page count of a DOCX file using python-docx.
        This is an approximation based on the document structure.
        """
        try:
            doc = Document(docx_path)
            # Check if there are explicit page breaks or section properties that indicate page count
            # For more accurate counting, we'd use Word's API or convert to PDF
            # For now, we'll use a simple heuristic or return 0 to trigger calculation
            
            # Try to extract page count from document properties
            # DOCX doesn't store page count reliably, so this is approximate
            # A better approach would be to convert to PDF and count pages
            # For now, return 0 to indicate we need to measure differently
            return 0
        except Exception as e:
            print(f"Error getting page count: {e}")
            return 0
    
    @staticmethod
    def estimate_page_count_from_content(docx_path: str) -> int:
        """
        Estimate page count based on content length and formatting.
        This is a rough approximation.
        """
        try:
            doc = Document(docx_path)
            
            # Count total characters and lines
            total_chars = 0
            total_paragraphs = 0
            
            for para in doc.paragraphs:
                if para.text.strip():
                    total_chars += len(para.text)
                    total_paragraphs += 1
            
            # Rough estimate: ~3000 characters per page with standard formatting
            # Adjust based on paragraph count (more paragraphs = more spacing)
            estimated_pages = max(1, int((total_chars / 3000) + (total_paragraphs / 40)))
            
            return estimated_pages
        except Exception as e:
            print(f"Error estimating page count: {e}")
            return 1
    
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
        
        # Remove literal markdown bold/italic asterisks that the AI might generate
        cleaned = cleaned.replace('**', '').replace('*', '')
        
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
                'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006'
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
            # STRICTLY match python-docx behavior: Only direct children of w:body
            body = root.find('w:body', namespaces)
            if body is not None:
                paragraphs = body.findall('w:p', namespaces)
            else:
                paragraphs = []

            for para in paragraphs:
                text_content = ''
                for t_elem in para.findall('.//w:t', namespaces):
                    if t_elem.text:
                        text_content += t_elem.text
                
                if text_content.strip():
                    all_paragraphs.append((para, document_xml_path, text_content))
            
            # Check if counts match
            if len(all_paragraphs) != len(full_text_items):
                print(f"⚠️  Warning: XML paragraph count mismatch!")
                print(f"   Original: {len(all_paragraphs)} paragraphs (body only)")
                print(f"   AI Generated: {len(full_text_items)} text items")
                print(f"   Proceeding with XML preservation anyway (safest option for shapes).")
                # DO NOT FALL BACK - The fallback method destroys shapes
                # self.create_docx_preserve_formatting(original_file_path, resume_data, output_path)
             
            # Track which files have been modified
            modified_files = set()
            
            # Update each paragraph's text
            for (para, para_file, old_text), new_text in zip(all_paragraphs, full_text_items):
                sanitized_text = self.sanitize_text(str(new_text))
                old_text_clean = self.sanitize_text(old_text)
                
                if sanitized_text.strip() == old_text_clean.strip():
                    continue
                
                # Find all text runs in this paragraph
                text_runs = para.findall('.//w:r', namespaces)
                
                if not text_runs:
                    continue
                
                # Identify runs that actually contain text elements
                text_bearing_runs = []
                for run in text_runs:
                    # Check if run contains drawing/object/alternateContent - if so, skip it to preserve the shape
                    has_drawing = False
                    
                    # check direct namespace matches
                    if (run.find('.//w:drawing', namespaces) is not None or 
                        run.find('.//w:pict', namespaces) is not None or 
                        run.find('.//w:object', namespaces) is not None or
                        run.find('.//mc:AlternateContent', namespaces) is not None):
                        has_drawing = True
                    
                    # Fallback: Check tag names for anything suspicious not caught by namespace
                    if not has_drawing:
                        for child in run.iter():
                            if 'drawing' in child.tag.lower() or 'pict' in child.tag.lower():
                                has_drawing = True
                                break
                                
                    if has_drawing:
                        continue

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
            

            
            # SMART MARGIN ADJUSTMENT: Try to keep the same page count as original
            # by adjusting margins intelligently
            self._adjust_margins_for_page_count(
                root, namespaces, document_xml_path, 
                original_file_path, temp_dir, modified_files
            )

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
    
    def _adjust_margins_for_page_count(self, root, namespaces: dict, document_xml_path: str, 
                                        original_file_path: str, temp_dir: str, modified_files: set):
        """
        Adjust margins intelligently to try to keep the same page count as the original.
        
        Rules:
        1. First adjust top/bottom margins equally (minimum 0.5" = 720 twips)
        2. Then adjust left/right margins equally (minimum 0.5" = 720 twips)
        3. Always keep top=bottom and left=right
        
        Note: 1 inch = 1440 twips, 0.5 inch = 720 twips
        """
        try:
            # Estimate original page count
            original_pages = self.estimate_page_count_from_content(original_file_path)
            print(f"   📄 Original document: ~{original_pages} page(s)")
            
            # Get section properties
            sect_pr = root.find('.//w:body/w:sectPr', namespaces)
            if sect_pr is None:
                print("   ⚠️  No section properties found, skipping margin adjustment")
                return
            
            pg_mar = sect_pr.find('w:pgMar', namespaces)
            if pg_mar is None:
                print("   ⚠️  No page margins found, skipping margin adjustment")
                return
            
            # Get current margins (default 1440 twips = 1 inch)
            top = int(pg_mar.get(f'{{{namespaces["w"]}}}top', 1440))
            bottom = int(pg_mar.get(f'{{{namespaces["w"]}}}bottom', 1440))
            left = int(pg_mar.get(f'{{{namespaces["w"]}}}left', 1440))
            right = int(pg_mar.get(f'{{{namespaces["w"]}}}right', 1440))
            
            MIN_MARGIN = 720  # 0.5 inches
            STEP = 72  # 0.05 inches per step
            
            # Current margins
            current_top_bottom = min(top, bottom)
            current_left_right = min(left, right)
            
            print(f"   📏 Current margins: T/B={current_top_bottom/1440:.2f}\", L/R={current_left_right/1440:.2f}\"")
            
            # Strategy: Aggressive margin reduction for PDF conversion
            # LibreOffice PDF rendering adds extra spacing, so we need tighter margins
            # to ensure the PDF matches the page count
            # Step 1: Reduce top/bottom first (up to minimum of 0.5")
            # Step 2: Reduce left/right if needed (up to minimum of 0.5")
            
            # First, reduce top/bottom margins more aggressively
            new_top_bottom = current_top_bottom
            if current_top_bottom > MIN_MARGIN:
                # Reduce by up to 0.35 inches (504 twips) - more aggressive for PDF
                # This compensates for LibreOffice's PDF renderer adding extra line spacing
                reduction = min(504, current_top_bottom - MIN_MARGIN)
                new_top_bottom = current_top_bottom - reduction
                new_top_bottom = max(MIN_MARGIN, new_top_bottom)
            
            # Also reduce left/right margins if needed
            new_left_right = current_left_right
            if current_left_right > MIN_MARGIN:
                # Reduce by up to 0.25 inches (360 twips)
                reduction = min(360, current_left_right - MIN_MARGIN)
                new_left_right = current_left_right - reduction
                new_left_right = max(MIN_MARGIN, new_left_right)
            
            # Apply new margins (keep them equal)
            pg_mar.set(f'{{{namespaces["w"]}}}top', str(new_top_bottom))
            pg_mar.set(f'{{{namespaces["w"]}}}bottom', str(new_top_bottom))
            pg_mar.set(f'{{{namespaces["w"]}}}left', str(new_left_right))
            pg_mar.set(f'{{{namespaces["w"]}}}right', str(new_left_right))
            
            print(f"   ✨ Adjusted margins: T/B={new_top_bottom/1440:.2f}\", L/R={new_left_right/1440:.2f}\" (targeting {original_pages} page(s))")
            modified_files.add(document_xml_path)
            
        except Exception as e:
            print(f"   ⚠️  Error adjusting margins: {e}")
    
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
    def create_redline_docx(self, original_file_path: str, resume_data: Dict[str, Any], output_path: str):
        """
        Create a 'Redline' DOCX where changed text is highlighted in Red.
        Uses granular diffs to highlight specific words.
        """
        import shutil
        import difflib
        from docx import Document
        from docx.shared import RGBColor
        
        # Copy the original file to the output path first
        shutil.copy2(original_file_path, output_path)
        doc = Document(output_path)
        
        full_text_items = resume_data.get("full_text", [])
        if not full_text_items: return
            
        original_paragraphs = [p for p in doc.paragraphs if p.text.strip()]
    
        if len(original_paragraphs) != len(full_text_items):
            print(f"⚠️  Redline count mismatch: {len(original_paragraphs)} vs {len(full_text_items)}. Proceeding with partial diff.")
    
        for para, new_text in zip(original_paragraphs, full_text_items):
            original_text = para.text
            sanitized_new = self.sanitize_text(str(new_text))
            
            # Helper to rebuild paragraph with diffs
            def build_diff_runs(target_para, old_txt, new_txt, bold=False):
                # Diff logic
                # We split by words for better readability than char-level
                a_words = old_txt.split(' ')
                b_words = new_txt.split(' ')
                
                matcher = difflib.SequenceMatcher(None, a_words, b_words)
                
                for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                    chunk_text = " ".join(b_words[j1:j2]) + " "
                    
                    if not chunk_text.strip(): continue
                        
                    if tag == 'equal':
                        run = target_para.add_run(chunk_text)
                        run.bold = bold
                    elif tag in ('replace', 'insert'):
                        run = target_para.add_run(chunk_text)
                        run.bold = bold
                        run.font.color.rgb = RGBColor(255, 0, 0)
                    # delete is ignored
            
            # Check patterns
            # Identify if this looks like a bold header line (e.g. "Key Achievement: ...")
            # We use a heuristic or check existing runs
            has_colon_pattern = ':' in sanitized_new and len(para.runs) > 1
            
            # Clear existing content
            para.text = "" 
            
            if has_colon_pattern:
                parts = sanitized_new.split(':', 1)
                orig_parts = original_text.split(':', 1)
                
                if len(parts) == 2:
                    label_part = parts[0] + ':'
                    content_part = parts[1].strip()
                    
                    # Add label (assume BOLD)
                    run = para.add_run(label_part + " ")
                    run.bold = True
                    
                    # Diff the content part
                    orig_content = orig_parts[1] if len(orig_parts) == 2 else ""
                    build_diff_runs(para, orig_content, content_part, bold=False)
                else:
                    build_diff_runs(para, original_text, sanitized_new)
            else:
                build_diff_runs(para, original_text, sanitized_new)
        
        doc.save(output_path)

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
    
    def create_pdf_from_docx(self, docx_path: str, output_path: str) -> dict:
        """
        Convert a DOCX file to PDF using the best available method.
        
        Priority:
        1. LibreOffice (best - perfect DOCX formatting preservation)
        2. DOCX → HTML → PDF (good for basic documents)
        3. Pandoc with CSS-based engines (fallback)
        4. Pure Python reportlab (basic fallback)
        
        Returns dict with success status and font information.
        """
        # Check for missing fonts before conversion
        font_info = {'fonts_detected': [], 'missing_fonts': [], 'all_available': True}
        try:
            from services.font_service import FontService
            font_service = FontService()
            font_info = font_service.ensure_fonts_available(docx_path)
        except Exception as e:
            print(f"   ℹ️  Font check skipped: {e}")
        
        # Try LibreOffice FIRST - best for preserving DOCX formatting
        success = False
        if self._try_libreoffice_conversion(docx_path, output_path):
            success = True
        elif self._try_html_intermediate_conversion(docx_path, output_path):
            success = True
        elif self._try_pandoc_conversion(docx_path, output_path):
            success = True
        else:
            # Last resort: Pure Python implementation
            print("   ℹ️  No converters available, using basic reportlab fallback...")
            success = self._convert_with_reportlab(docx_path, output_path)
        
        return {
            'success': success,
            'font_info': font_info
        }
    
    def _try_html_intermediate_conversion(self, docx_path: str, output_path: str) -> bool:
        """
        Convert DOCX → HTML → PDF for better formatting preservation.
        Uses Pandoc for DOCX→HTML and WeasyPrint for HTML→PDF.
        """
        import tempfile
        
        try:
            # Setup environment to include venv binaries
            env = os.environ.copy()
            venv_bin = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'venv', 'bin')
            if os.path.exists(venv_bin):
                env['PATH'] = f"{venv_bin}:{env.get('PATH', '')}"
            
            # Check if pandoc is available
            result = subprocess.run(
                ['pandoc', '--version'],
                capture_output=True,
                timeout=5,
                text=True,
                env=env
            )
            
            if result.returncode != 0:
                return False
            
            # Check if weasyprint is available
            result = subprocess.run(
                ['weasyprint', '--version'],
                capture_output=True,
                timeout=5,
                text=True,
                env=env
            )
            
            if result.returncode != 0:
                print("   ℹ️  WeasyPrint not found for HTML conversion")
                return False
            
            # Step 1: Convert DOCX to HTML with embedded styles
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as html_file:
                html_path = html_file.name
            
            try:
                # Convert DOCX to standalone HTML with CSS
                pandoc_cmd = [
                    'pandoc',
                    docx_path,
                    '-o', html_path,
                    '--standalone',
                    '--self-contained',
                    '--css', 'style.css'  # Pandoc will embed default styles
                ]
                
                result = subprocess.run(
                    pandoc_cmd,
                    capture_output=True,
                    timeout=30,
                    text=True,
                    env=env
                )
                
                if result.returncode != 0 or not os.path.exists(html_path):
                    print(f"   ℹ️  DOCX→HTML conversion failed")
                    return False
                
                # Step 2: Convert HTML to PDF using WeasyPrint
                weasyprint_cmd = [
                    'weasyprint',
                    html_path,
                    output_path
                ]
                
                result = subprocess.run(
                    weasyprint_cmd,
                    capture_output=True,
                    timeout=30,
                    text=True,
                    env=env
                )
                
                if result.returncode == 0 and os.path.exists(output_path):
                    print(f"   ✓ PDF generated via HTML (DOCX→HTML→PDF)")
                    return True
                else:
                    print(f"   ℹ️  HTML→PDF conversion failed: {result.stderr[:200]}")
                    return False
                    
            finally:
                # Clean up temporary HTML file
                if os.path.exists(html_path):
                    os.unlink(html_path)
                    
        except subprocess.TimeoutExpired:
            print("   ⚠️  HTML conversion timed out")
            return False
        except Exception as e:
            print(f"   ℹ️  HTML intermediate conversion error: {e}")
            return False
    
    def _try_libreoffice_conversion(self, docx_path: str, output_path: str) -> bool:
        """
        Try to convert DOCX to PDF using LibreOffice.
        This preserves the most formatting including shapes, colors, and headers.
        """
        try:
            # Check for LibreOffice
            libreoffice_cmd = None
            for cmd in ['libreoffice', 'soffice', '/usr/bin/libreoffice', '/usr/bin/soffice']:
                try:
                    result = subprocess.run(
                        [cmd, '--version'],
                        capture_output=True,
                        timeout=5,
                        text=True
                    )
                    if result.returncode == 0:
                        libreoffice_cmd = cmd
                        break
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
            
            if not libreoffice_cmd:
                return False
            
            # Get absolute paths
            output_dir = os.path.dirname(os.path.abspath(output_path))
            docx_abs_path = os.path.abspath(docx_path)
            
            # Convert with proper PDF export filter to preserve formatting
            # Using filter:writer_pdf_Export with specific options
            cmd = [
                libreoffice_cmd,
                '--headless',
                '--convert-to', 'pdf:writer_pdf_Export',
                '--outdir', output_dir,
                docx_abs_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60,
                text=True
            )
            
            if result.returncode != 0:
                print(f"   ℹ️  LibreOffice conversion failed: {result.stderr[:200]}")
                return False
            
            # LibreOffice creates PDF with same base name
            base_name = os.path.splitext(os.path.basename(docx_path))[0]
            generated_pdf = os.path.join(output_dir, f"{base_name}.pdf")
            
            # Rename if needed
            if os.path.exists(generated_pdf) and generated_pdf != output_path:
                shutil.move(generated_pdf, output_path)
            
            if os.path.exists(output_path):
                print(f"   ✓ PDF generated with LibreOffice (formatting preserved)")
                return True
            
            return False
                
        except subprocess.TimeoutExpired:
            print("   ⚠️  LibreOffice conversion timed out")
            return False
        except Exception as e:
            print(f"   ℹ️  LibreOffice error: {e}")
            return False
    
    def _try_pandoc_conversion(self, docx_path: str, output_path: str) -> bool:
        """
        Try to convert DOCX to PDF using Pandoc with CSS-based engines.
        CSS-based engines preserve layout better than LaTeX.
        
        Priority:
        1. weasyprint (CSS-based, good for layout preservation)
        2. prince (CSS-based, commercial but high quality)
        3. wkhtmltopdf (WebKit-based, decent fallback)
        """
        try:
            # Setup environment to include venv binaries
            env = os.environ.copy()
            venv_bin = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'venv', 'bin')
            if os.path.exists(venv_bin):
                env['PATH'] = f"{venv_bin}:{env.get('PATH', '')}"
            
            # Check if pandoc is available
            result = subprocess.run(
                ['pandoc', '--version'],
                capture_output=True,
                timeout=5,
                text=True,
                env=env
            )
            
            if result.returncode != 0:
                return False
            
            # Try different PDF engines in order of preference
            pdf_engines = [
                ('weasyprint', 'WeasyPrint (CSS-based)'),
                ('prince', 'Prince (CSS-based)'),
                ('wkhtmltopdf', 'wkhtmltopdf'),
            ]
            
            for engine, engine_name in pdf_engines:
                try:
                    # Check if the engine is available
                    engine_check = subprocess.run(
                        [engine, '--version'] if engine != 'prince' else ['prince', '--version'],
                        capture_output=True,
                        timeout=5,
                        text=True,
                        stderr=subprocess.DEVNULL,
                        env=env
                    )
                    
                    if engine_check.returncode != 0:
                        continue
                    
                    # Try conversion with this engine
                    cmd = [
                        'pandoc',
                        docx_path,
                        '-o', output_path,
                        f'--pdf-engine={engine}'
                    ]
                    
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        timeout=60,
                        text=True,
                        env=env
                    )
                    
                    if result.returncode == 0 and os.path.exists(output_path):
                        print(f"   ✓ PDF generated with Pandoc using {engine_name}")
                        return True
                    
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
            
            # If no CSS-based engine worked, inform user
            print(f"   ℹ️  Pandoc available but no suitable PDF engine found")
            print(f"   💡 Install weasyprint: pip install weasyprint")
            return False
                
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
        except Exception as e:
            print(f"   ℹ️  Pandoc error: {e}")
            return False
    
    def _convert_with_reportlab(self, docx_path: str, output_path: str) -> bool:
        """
        Convert DOCX to PDF using pure Python (reportlab).
        Fallback method when Pandoc is not available.
        """
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.units import inch
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
            from reportlab.lib import colors
            from docx import Document
            from docx.shared import Pt, Inches as DocxInches
            from docx.enum.text import WD_ALIGN_PARAGRAPH
            
            # Open the DOCX file
            doc = Document(docx_path)
            
            # Get page setup from DOCX
            section = doc.sections[0]
            page_width = float(section.page_width) / 914400 * inch  # Convert EMUs to inches
            page_height = float(section.page_height) / 914400 * inch
            top_margin = float(section.top_margin) / 914400 * inch
            bottom_margin = float(section.bottom_margin) / 914400 * inch
            left_margin = float(section.left_margin) / 914400 * inch
            right_margin = float(section.right_margin) / 914400 * inch
            
            # Create PDF with matching page setup
            pdf = SimpleDocTemplate(
                output_path,
                pagesize=(page_width, page_height),
                topMargin=top_margin,
                bottomMargin=bottom_margin,
                leftMargin=left_margin,
                rightMargin=right_margin
            )
            
            # Build styles
            styles = getSampleStyleSheet()
            story = []
            
            # Process paragraphs
            for para in doc.paragraphs:
                if not para.text.strip():
                    story.append(Spacer(1, 0.1*inch))
                    continue
                
                # Determine alignment
                alignment = TA_LEFT
                if para.alignment == WD_ALIGN_PARAGRAPH.CENTER:
                    alignment = TA_CENTER
                elif para.alignment == WD_ALIGN_PARAGRAPH.RIGHT:
                    alignment = TA_RIGHT
                elif para.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
                    alignment = TA_JUSTIFY
                
                # Get formatting from first run
                font_size = 11
                font_name = 'Helvetica'
                is_bold = False
                is_italic = False
                text_color = colors.black
                
                # Standard PDF fonts supported by reportlab natively
                standard_fonts = ['Courier', 'Helvetica', 'Times-Roman', 'Symbol', 'ZapfDingbats']
                
                if para.runs:
                    first_run = para.runs[0]
                    if first_run.font.size:
                        font_size = first_run.font.size.pt
                    if first_run.font.name:
                        # Reportlab crashes on non-standard fonts without explicit TTF registration
                        doc_font = first_run.font.name
                        if any(s in doc_font for s in standard_fonts):
                            font_name = doc_font
                        else:
                            font_name = 'Helvetica'
                    is_bold = first_run.bold if first_run.bold is not None else False
                    is_italic = first_run.italic if first_run.italic is not None else False
                    
                    # Get color
                    if first_run.font.color and first_run.font.color.rgb:
                        rgb = first_run.font.color.rgb
                        text_color = colors.Color(rgb[0]/255, rgb[1]/255, rgb[2]/255)
                
                # Create paragraph style
                style = ParagraphStyle(
                    'CustomStyle',
                    parent=styles['Normal'],
                    fontSize=font_size,
                    fontName=font_name,
                    alignment=alignment,
                    textColor=text_color,
                    spaceAfter=6
                )
                
                if is_bold:
                    style.fontName = font_name + '-Bold' if font_name == 'Helvetica' else font_name
                
                # Build formatted text with run-level formatting
                formatted_text = ""
                from docx.text.run import Run
                
                # To include hyperlinks which python-docx skips in para.runs
                for child in para._element:
                    runs_to_process = []
                    
                    if child.tag.endswith('}r'):
                        runs_to_process.append(Run(child, para))
                    elif child.tag.endswith('}hyperlink'):
                        for r_node in child.findall('.//w:r', namespaces={'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}):
                            runs_to_process.append(Run(r_node, para))
                            
                    for run in runs_to_process:
                        text = self.sanitize_text(run.text)
                        if not text:
                            continue
                            
                        # Build formatting tags
                        is_run_bold = run.bold if run.bold is not None else False
                        is_run_italic = run.italic if run.italic is not None else False
                        is_run_underline = run.underline if run.underline is not None else False
                        
                        # Apply fallback formatting if we detected a hyperlink run
                        # (hyperlink runs often lose explicit visual formatting info when instantiated dynamically)
                        if child.tag.endswith('}hyperlink'):
                            # Hyperlinks are usually blue and underlined
                            is_run_underline = True
                            text = f'<font color="blue">{text}</font>'
                            
                        if is_run_bold:
                            text = f"<b>{text}</b>"
                        if is_run_italic:
                            text = f"<i>{text}</i>"
                        if is_run_underline:
                            text = f"<u>{text}</u>"
                        
                        formatted_text += text
                
                if formatted_text:
                    try:
                        p = Paragraph(formatted_text, style)
                        story.append(p)
                    except Exception as e:
                        # Fallback to plain text if formatting fails
                        p = Paragraph(self.sanitize_text(para.text), style)
                        story.append(p)
            
            # Process tables
            for table in doc.tables:
                table_data = []
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells]
                    table_data.append(row_data)
                
                if table_data:
                    t = Table(table_data)
                    t.setStyle(TableStyle([
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 0), (-1, -1), 10),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('PADDING', (0, 0), (-1, -1), 6),
                    ]))
                    story.append(t)
                    story.append(Spacer(1, 0.2*inch))
            
            # Build PDF
            pdf.build(story)
            print(f"   ✓ PDF generated successfully (pure Python)")
            return True
            
        except Exception as e:
            print(f"   ⚠️  Error converting DOCX to PDF: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def create_pdf(self, resume_data: Dict[str, Any], output_path: str):
        """
        DEPRECATED: Create a PDF file from structured resume data.
        This method is kept for backward compatibility but should not be used
        as it doesn't preserve DOCX formatting.
        Use create_pdf_from_docx() instead.
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

    def create_cover_letter_docx(self, content: str, output_path: str):
        """Creates a simple formatted cover letter DOCX."""
        doc = Document()
        
        style = doc.styles['Normal']
        style.font.name = 'Calibri'
        style.font.size = Pt(11)
        
        paragraphs = content.split('\n')
        for p_text in paragraphs:
            p = doc.add_paragraph(p_text.strip())
            p.paragraph_format.space_after = Pt(6)
        
        doc.save(output_path)
