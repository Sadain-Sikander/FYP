"""Generate synthetic browser-test documents; no real personal data."""
from pathlib import Path
from docx import Document
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

target = Path(__file__).resolve().parents[1] / "frontend" / "tests" / "fixtures"
target.mkdir(parents=True, exist_ok=True)
lines = [
    "Sam Example", "sam@example.com", "+92 300 1234567",
    "Education", "BS Computer Science, Example University, 2025",
    "Experience", "Built a reporting application using Python and PostgreSQL.",
    "Reduced reporting time by 30%.",
    "Skills", "Python, SQL, JavaScript, React, C++, Microsoft Excel",
    "Interests: Sustainability and accessible technology",
]
document = Document()
for line in lines:
    document.add_paragraph(line)
document.save(target / "resume.docx")

writer = PdfWriter()
page = writer.add_blank_page(width=612, height=792)
font = DictionaryObject({
    NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
    NameObject("/BaseFont"): NameObject("/Helvetica"),
})
page[NameObject("/Resources")] = DictionaryObject({
    NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
})
stream = DecodedStreamObject()
stream.set_data(("BT /F1 12 Tf 50 740 Td 18 TL\n" + "\n".join(f"({line}) Tj T*" for line in lines) + "\nET").encode("ascii"))
page[NameObject("/Contents")] = writer._add_object(stream)
writer.write(target / "resume.pdf")
blank = PdfWriter()
blank.add_blank_page(width=612, height=792)
blank.write(target / "blank.pdf")
print("Generated synthetic PDF/DOCX browser fixtures.")
