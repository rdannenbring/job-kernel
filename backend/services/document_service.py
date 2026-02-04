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
