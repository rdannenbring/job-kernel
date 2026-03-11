# XML-Level Preservation Approach

## Branch: `feature/xml-shape-preservation`

This experimental branch implements a new approach to preserve ALL Word document elements, including shapes, backgrounds, and complex formatting.

## What Changed

### New Method: `create_docx_with_xml_preservation()`

Instead of using `python-docx`'s save method (which loses unsupported elements), this method:

1. **Extracts the DOCX** - Unzips it to access internal XML files
2. **Parses document.xml** - Uses `lxml` to parse the Word XML structure  
3. **Updates text directly in XML** - Modifies only the text nodes, leaving all other elements intact
4. **Repackages as DOCX** - Zips everything back up

### Benefits

✅ **Preserves ALL Word elements:**
   - Background shapes
   - Text boxes
  - Images
   - Headers/footers
   - Complex formatting
   - Drawing objects
   - Any other Word-specific elements

✅ **Still supports multi-run formatting:**
   - Bold before colon, normal after (Core Competencies)
   - Mixed formatting within paragraphs

✅ **Fallback protection:**
   - If paragraph counts don't match, falls back to the previous method

## How It Works

### DOCX File Structure
```
resume.docx (ZIP file)
├── word/
│   ├── document.xml      ← Main content (we modify this)
│   ├── header1.xml       ← Headers (preserved)
│   ├── footer1.xml       ← Footers (preserved)
│   └── media/            ← Images (preserved)
├── _rels/                ← Relationships (preserved)
└── [Content_Types].xml   ← Manifest (preserved)
```

### XML Manipulation
```xml
<!-- Before -->
<w:t>Old text here</w:t>

<!-- After -->
<w:t>New tailored text here</w:t>
```

All surrounding XML (formatting, styles, shapes) remains untouched.

## Testing

To test this new approach:

1. **Process a resume** through the web app
2. **Check the output DOCX**:
   - Background shapes should be preserved ✓
   - Bold formatting before colon should work ✓
   - All other formatting should be intact ✓

## Reverting if Needed

If this approach causes issues, to go back to the previous version:

```bash
# Switch back to master branch
git checkout master

# Delete the experimental branch (optional)
git branch -D feature/xml-shape-preservation
```

The server will auto-reload and use the previous `create_docx_preserve_formatting()` method.

## Technical Details

### Dependencies
- `lxml` - Already in requirements.txt
- `zipfile` - Python standard library
- `tempfile` - Python standard library

### Namespaces Used
- `w` - Main WordprocessingML namespace
- `w14`, `wpc`, `cx`, `mc`, `o`, `r`, `v`, `wp`, `wp14`, `wps` - Extended Word namespaces

### What Stays the Same
- AI processing (unchanged)
- Resume parsing (unchanged)
- PDF generation (unchanged)
- TXT generation (unchanged)
- Frontend (unchanged)

Only the DOCX generation method changed to use XML-level manipulation.

## Status

🟢 **Ready to Test** - The feature is implemented and the server is running with the new code.

Try processing your resume now and check if the background shape is preserved!
